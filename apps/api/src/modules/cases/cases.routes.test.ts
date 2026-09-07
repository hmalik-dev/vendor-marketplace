import {
  adminCaseBookingSchema,
  adminCaseDetailSchema,
  adminCaseRowSchema,
  paginatedSchema,
  SUPPORT_REFERENCE_PATTERN,
} from '@vendor-marketplace/shared';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import {
  adminActions,
  bookingRequests,
  bookings,
  categories,
  notifications,
  supportCases,
  users,
  vendorCategories,
  vendorProfiles,
} from '@vendor-marketplace/db/schema';
import { Writable } from 'node:stream';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { createResendGateway } from '../../lib/email.js';
import {
  bearer,
  createTestHarness,
  TEST_ENV,
  type TestHarness,
} from '../../testing/test-server.js';

/**
 * The API's schemas with their dates coerced back from the ISO strings JSON
 * carries — `apps/web`'s `wire-schemas.ts` in miniature, and for the same
 * reason: `z.date()` on the wire is a string, and asserting against the response
 * with the server-side schema would only ever fail. Declared here rather than
 * imported because the web package is not a dependency of the API.
 */
const wireCaseRowSchema = adminCaseRowSchema.extend({ createdAt: z.coerce.date() });
const wireCasePageSchema = paginatedSchema(wireCaseRowSchema);
const wireCaseDetailSchema = adminCaseDetailSchema.extend({
  createdAt: z.coerce.date(),
  emailFailedAt: z.coerce.date().nullable(),
  resolvedAt: z.coerce.date().nullable(),
  booking: adminCaseBookingSchema
    .extend({ paidAt: z.coerce.date().nullable(), payoutReleasedAt: z.coerce.date().nullable() })
    .nullable(),
});

const ADMIN = 'user_admin_cases';
const VENDOR = 'user_vendor_cases';
const CUSTOMER = 'user_customer_cases';

/** A past event, so `placeDisputeHold` will take it — the hold's own rule. */
const PAST_EVENT = '2020-06-01';
const TOTAL_CENTS = 120_000;

/**
 * A fresh caller per request.
 *
 * `/support/messages` allows six sends an hour keyed by account or IP, so a
 * suite firing every case from `inject`'s default address would exhaust the
 * allowance mid-file and start asserting 429s. Lifted verbatim from
 * `support.routes.test.ts`, which found this the hard way.
 */
let callers = 0;
function fromANewVisitor(): { remoteAddress: string } {
  callers += 1;
  return { remoteAddress: `10.4.${Math.floor(callers / 250)}.${callers % 250}` };
}

interface Fixture {
  adminId: string;
  customerId: string;
  vendorProfileId: string;
  bookingId: string;
  paymentIntentId: string;
}

describe('the operations case queue (#431)', () => {
  let harness: TestHarness;
  let photographyId: string;

  async function signIn(clerkUserId: string, promoteToAdmin = false): Promise<string> {
    const response = await harness.app.inject({
      method: 'GET',
      url: '/users/me',
      headers: bearer(clerkUserId),
    });
    expect(response.statusCode).toBe(200);

    if (promoteToAdmin) {
      await harness.database.db
        .update(users)
        .set({ role: 'admin' })
        .where(eq(users.clerkUserId, clerkUserId));
    }

    const rows = await harness.database.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.clerkUserId, clerkUserId))
      .limit(1);

    return rows[0]!.id;
  }

  /**
   * A paid, confirmed booking whose event has already happened — the one state
   * a payout hold can still be placed on, and therefore the only fixture from
   * which the whole chain is reachable.
   */
  async function seed(
    overrides: { paymentIntentId?: string; payoutReleasedAt?: Date; eventDate?: string } = {},
  ): Promise<Fixture> {
    const adminId = await signIn(ADMIN, true);
    const customerId = await signIn(CUSTOMER);

    const created = await harness.app.inject({
      method: 'POST',
      url: '/vendor/profile',
      headers: bearer(VENDOR),
      payload: {
        businessName: 'Sunlit Studio',
        categoryIds: [photographyId],
        city: 'Austin',
        state: 'TX',
      },
    });
    expect(created.statusCode).toBe(201);

    const profiles = await harness.database.db
      .select({ id: vendorProfiles.id })
      .from(vendorProfiles)
      .limit(1);
    const vendorProfileId = profiles[0]!.id;

    const eventDate = overrides.eventDate ?? PAST_EVENT;

    const requestRows = await harness.database.db
      .insert(bookingRequests)
      .values({
        customerId,
        vendorId: vendorProfileId,
        eventDate,
        status: 'accepted',
        finalPriceCents: TOTAL_CENTS,
      })
      .returning({ id: bookingRequests.id });

    const paymentIntentId = overrides.paymentIntentId ?? 'pi_case_fixture';

    const bookingRows = await harness.database.db
      .insert(bookings)
      .values({
        requestId: requestRows[0]!.id,
        customerId,
        vendorId: vendorProfileId,
        eventDate,
        totalAmountCents: TOTAL_CENTS,
        platformFeeCents: 14_400,
        vendorPayoutCents: 105_600,
        status: 'confirmed',
        paidAt: new Date('2020-05-01T00:00:00Z'),
        stripePaymentIntentId: paymentIntentId,
        ...(overrides.payoutReleasedAt ? { payoutReleasedAt: overrides.payoutReleasedAt } : {}),
      })
      .returning({ id: bookings.id });

    return { adminId, customerId, vendorProfileId, bookingId: bookingRows[0]!.id, paymentIntentId };
  }

  async function report(body: Record<string, unknown>) {
    return harness.app.inject({
      method: 'POST',
      url: '/support/messages',
      headers: bearer(CUSTOMER),
      ...fromANewVisitor(),
      payload: { topic: 'booking-or-payment', message: 'The photographer never showed.', ...body },
    });
  }

  async function readCases(query = '') {
    const response = await harness.app.inject({
      method: 'GET',
      url: `/admin/cases${query}`,
      headers: bearer(ADMIN),
    });
    expect(response.statusCode).toBe(200);

    return wireCasePageSchema.parse(response.json());
  }

  async function readCase(caseId: string) {
    const response = await harness.app.inject({
      method: 'GET',
      url: `/admin/cases/${caseId}`,
      headers: bearer(ADMIN),
    });
    expect(response.statusCode).toBe(200);

    return wireCaseDetailSchema.parse(response.json());
  }

  /** Delivers one Stripe dispute event, the two steps Stripe itself takes. */
  async function deliverDispute(
    type: string,
    dispute: { id: string; status: string; reason: string; amountCents: number; intentId: string },
  ) {
    harness.stripe.disputes.set(dispute.id, {
      id: dispute.id,
      status: dispute.status,
      reason: dispute.reason,
      amountCents: dispute.amountCents,
      paymentIntentId: dispute.intentId,
    });
    harness.stripe.nextEvent = { type, accountId: dispute.id, objectId: dispute.id };

    return harness.app.inject({
      method: 'POST',
      url: '/webhooks/stripe',
      headers: { 'stripe-signature': 'valid-signature', 'content-type': 'application/json' },
      payload: JSON.stringify({ id: 'evt_dispute', object: 'event' }),
    });
  }

  beforeAll(async () => {
    harness = await createTestHarness();

    for (const [clerkUserId, role] of [
      [ADMIN, 'customer'],
      [VENDOR, 'vendor'],
      [CUSTOMER, 'customer'],
    ] as const) {
      harness.clerkUsers.set(clerkUserId, {
        clerkUserId,
        email: `${clerkUserId}@example.com`,
        firstName: 'Test',
        lastName: 'User',
        roleHint: role,
        avatarUrl: null,
      });
    }

    const rows = await harness.database.db
      .select({ id: categories.id })
      .from(categories)
      .where(eq(categories.slug, 'photography'))
      .limit(1);
    photographyId = rows[0]!.id;
  });

  afterEach(async () => {
    await harness.database.db.delete(notifications);
    await harness.database.db.delete(supportCases);
    await harness.database.db.delete(bookings);
    await harness.database.db.delete(bookingRequests);
    await harness.database.db.delete(vendorCategories);
    await harness.database.db.delete(vendorProfiles);
    /*
     * `admin_actions` is never deleted here. The table is immutable by trigger
     * and `DELETE` raises; the `actor_id` cascade from `users` below is the one
     * removal it permits, and it is what takes these rows (#434).
     */
    await harness.database.db.delete(users);
    harness.email.sent.length = 0;
    harness.stripe.disputes.clear();
  });

  afterAll(async () => {
    await harness.close();
  });

  // --- Acceptance 1 and 2: the report writes a case -------------------------

  it('writes a case and places the hold for a report that names a booking', async () => {
    const fixture = await seed();

    const sent = await report({ bookingId: fixture.bookingId });
    expect(sent.statusCode).toBe(200);
    const reference = sent.json().reference as string;
    expect(reference).toMatch(SUPPORT_REFERENCE_PATTERN);

    const page = await readCases();
    expect(page.total).toBe(1);

    const row = page.items[0]!;
    // Acceptance 1: the case carries the same reference the sender was shown.
    expect(row.reference).toBe(reference);
    expect(row.origin).toBe('support_message');
    expect(row.status).toBe('open');
    expect(row.bookingId).toBe(fixture.bookingId);
    expect(row.senderUserId).toBe(fixture.customerId);
    expect(row.senderEmail).toBe(`${CUSTOMER}@example.com`);

    // And the hold really was placed, by the primitive rather than by us.
    const detail = await readCase(row.id);
    expect(detail.booking?.status).toBe('disputed');
    expect(detail.booking?.payoutStatus).toBe('held');
    expect(detail.message).toBe('The photographer never showed.');
  });

  it('writes a case and places no hold for a report that names no booking', async () => {
    await seed();

    const sent = await report({ topic: 'something-else' });
    expect(sent.statusCode).toBe(200);

    const page = await readCases();
    expect(page.total).toBe(1);
    expect(page.items[0]!.bookingId).toBeNull();
    expect(page.items[0]!.topic).toBe('something-else');

    const detail = await readCase(page.items[0]!.id);
    expect(detail.booking).toBeNull();

    // No booking left `disputed`, which is the half a hold would have written.
    const rows = await harness.database.db.select({ status: bookings.status }).from(bookings);
    expect(rows.map((row) => row.status)).toEqual(['confirmed']);
  });

  // --- Acceptance 5 and 6: the queue and the case --------------------------

  it('lists open cases oldest first and filters by status and by booking', async () => {
    const fixture = await seed();

    const first = await report({ topic: 'something-else' });
    expect(first.statusCode).toBe(200);
    const second = await report({ bookingId: fixture.bookingId });
    expect(second.statusCode).toBe(200);

    const open = await readCases();
    expect(open.items.map((row) => row.reference)).toEqual([
      first.json().reference,
      second.json().reference,
    ]);

    expect((await readCases('?booking=with')).items.map((row) => row.reference)).toEqual([
      second.json().reference,
    ]);
    expect((await readCases('?booking=without')).items.map((row) => row.reference)).toEqual([
      first.json().reference,
    ]);
    expect((await readCases('?status=resolved')).total).toBe(0);
  });

  it('shows every money field on the case the booking is under dispute on', async () => {
    const fixture = await seed();
    expect((await report({ bookingId: fixture.bookingId })).statusCode).toBe(200);

    const page = await readCases();
    const detail = await readCase(page.items[0]!.id);

    expect(detail.booking).toMatchObject({
      id: fixture.bookingId,
      status: 'disputed',
      totalAmountCents: TOTAL_CENTS,
      platformFeeCents: 14_400,
      vendorPayoutCents: 105_600,
      refundAmountCents: null,
      payoutReleasedAt: null,
      payoutStatus: 'held',
      cancelledBy: null,
      stripePaymentIntentId: fixture.paymentIntentId,
      vendorName: 'Sunlit Studio',
    });
    expect(detail.booking?.paidAt).not.toBeNull();
    // The reason is the customer's own words, carried onto the booking by the hold.
    expect(detail.booking?.disputeReason).toBe('The photographer never showed.');
  });

  // --- Acceptance 7 and 8: the resolution ----------------------------------

  it('lifts the hold and closes the case when it is resolved for the vendor', async () => {
    const fixture = await seed();
    expect((await report({ bookingId: fixture.bookingId })).statusCode).toBe(200);
    const caseId = (await readCases()).items[0]!.id;

    const resolved = await harness.app.inject({
      method: 'PUT',
      url: `/admin/bookings/${fixture.bookingId}/dispute`,
      headers: bearer(ADMIN),
      payload: { outcome: 'vendor' },
    });
    expect(resolved.statusCode).toBe(200);
    // Back to `confirmed`: the vendor had not marked it complete, and the next
    // sweep is what pays it out.
    expect(resolved.json().status).toBe('confirmed');

    const detail = await readCase(caseId);
    expect(detail.status).toBe('resolved');
    expect(detail.resolvedByName).toBe('Test User');
    expect(detail.resolvedAt).not.toBeNull();
    expect(detail.booking?.payoutStatus).toBe('pending');
    expect(await readCases().then((page) => page.total)).toBe(0);
  });

  it('refunds, cancels as admin, and closes the case when it is resolved for the customer', async () => {
    const fixture = await seed();
    expect((await report({ bookingId: fixture.bookingId })).statusCode).toBe(200);
    const caseId = (await readCases()).items[0]!.id;

    const resolved = await harness.app.inject({
      method: 'PUT',
      url: `/admin/bookings/${fixture.bookingId}/dispute`,
      headers: bearer(ADMIN),
      payload: { outcome: 'customer' },
    });
    expect(resolved.statusCode).toBe(200);

    const detail = await readCase(caseId);
    expect(detail.status).toBe('resolved');
    expect(detail.booking?.status).toBe('cancelled');
    expect(detail.booking?.cancelledBy).toBe('admin');
    // Refunded in full, and the refund really went to Stripe.
    expect(detail.booking?.refundAmountCents).toBe(TOTAL_CENTS);
    expect(harness.stripe.refunds).toHaveLength(1);
    expect(harness.stripe.refunds[0]?.amountCents).toBe(TOTAL_CENTS);
  });

  it('refuses a resolution on a booking that is not disputed with a 409, not a 500', async () => {
    const fixture = await seed();

    for (const outcome of ['vendor', 'customer'] as const) {
      const response = await harness.app.inject({
        method: 'PUT',
        url: `/admin/bookings/${fixture.bookingId}/dispute`,
        headers: bearer(ADMIN),
        payload: { outcome },
      });

      expect(response.statusCode, outcome).toBe(409);
      expect(response.json().message).toContain('no open report');
    }
  });

  it('closes a case with no money on it, and refuses one that still holds a payout', async () => {
    const fixture = await seed();
    expect((await report({ topic: 'something-else' })).statusCode).toBe(200);
    expect((await report({ bookingId: fixture.bookingId })).statusCode).toBe(200);

    const [plain, holding] = (await readCases()).items;

    const closed = await harness.app.inject({
      method: 'PUT',
      url: `/admin/cases/${plain!.id}/resolve`,
      headers: bearer(ADMIN),
    });
    expect(closed.statusCode).toBe(200);
    expect(wireCaseDetailSchema.parse(closed.json()).status).toBe('resolved');

    /*
     * The console's own record (#434). A mutating admin route that wrote no row
     * here is the accountability gap that table exists to close, and the detail
     * carries what changed rather than what was said.
     */
    const logged = await harness.database.db
      .select()
      .from(adminActions)
      .where(eq(adminActions.subjectId, plain!.id));
    expect(logged).toHaveLength(1);
    expect(logged[0]).toMatchObject({
      actorId: fixture.adminId,
      action: 'support_case_resolved',
      subjectType: 'support_case',
      detail: { reference: plain!.reference, origin: 'support_message', hadBooking: false },
    });
    expect(JSON.stringify(logged[0]!.detail)).not.toContain('photographer');

    // The second press finds nothing open and says so rather than overwriting.
    const again = await harness.app.inject({
      method: 'PUT',
      url: `/admin/cases/${plain!.id}/resolve`,
      headers: bearer(ADMIN),
    });
    expect(again.statusCode).toBe(409);

    /*
     * The one that matters: closing the complaint while the payout it froze
     * stays frozen is the exact state this ticket exists to end.
     */
    const refused = await harness.app.inject({
      method: 'PUT',
      url: `/admin/cases/${holding!.id}/resolve`,
      headers: bearer(ADMIN),
    });
    expect(refused.statusCode).toBe(409);
    expect(refused.json().message).toContain('holds a payout');
  });

  // --- Acceptance 4: chargebacks -------------------------------------------

  it('opens a case and places the hold when a chargeback arrives', async () => {
    const fixture = await seed();

    const delivered = await deliverDispute('charge.dispute.created', {
      id: 'dp_test_1',
      status: 'needs_response',
      reason: 'fraudulent',
      amountCents: TOTAL_CENTS,
      intentId: fixture.paymentIntentId,
    });
    expect(delivered.statusCode).toBe(200);
    expect(delivered.json().outcome).toBe('dispute-opened');

    const page = await readCases();
    expect(page.total).toBe(1);
    expect(page.items[0]!.origin).toBe('chargeback');
    expect(page.items[0]!.reference).toMatch(SUPPORT_REFERENCE_PATTERN);
    expect(page.items[0]!.topic).toBeNull();
    expect(page.items[0]!.senderEmail).toBeNull();

    const detail = await readCase(page.items[0]!.id);
    expect(detail.stripeDisputeId).toBe('dp_test_1');
    expect(detail.holdRefusal).toBeNull();
    expect(detail.message).toContain('fraudulent');
    // The hold went through the same primitive a customer's report uses.
    expect(detail.booking?.status).toBe('disputed');
    expect(detail.booking?.payoutStatus).toBe('held');
  });

  it('does not double-open or double-hold under a replayed event', async () => {
    const fixture = await seed();
    const dispute = {
      id: 'dp_test_replay',
      status: 'needs_response',
      reason: 'fraudulent',
      amountCents: TOTAL_CENTS,
      intentId: fixture.paymentIntentId,
    };

    const first = await deliverDispute('charge.dispute.created', dispute);
    expect(first.json().outcome).toBe('dispute-opened');

    const replay = await deliverDispute('charge.dispute.created', dispute);
    expect(replay.statusCode).toBe(200);
    expect(replay.json().outcome).toBe('already-recorded');

    const page = await readCases();
    expect(page.total).toBe(1);

    // One hold, and the booking is still on it rather than lifted and re-placed.
    const rows = await harness.database.db
      .select({ status: bookings.status, reason: bookings.disputeReason })
      .from(bookings)
      .where(eq(bookings.id, fixture.bookingId));
    expect(rows[0]?.status).toBe('disputed');
    expect(rows[0]?.reason).toContain('dp_test_replay');
  });

  it('records a refused hold rather than losing the case or failing the webhook', async () => {
    const fixture = await seed({ payoutReleasedAt: new Date('2020-06-10T00:00:00Z') });

    const delivered = await deliverDispute('charge.dispute.created', {
      id: 'dp_test_released',
      status: 'needs_response',
      reason: 'product_not_received',
      amountCents: TOTAL_CENTS,
      intentId: fixture.paymentIntentId,
    });
    expect(delivered.statusCode).toBe(200);
    expect(delivered.json().outcome).toBe('dispute-opened');

    const detail = await readCase((await readCases()).items[0]!.id);
    // The money had already left, so there was nothing to freeze — and the
    // operator is told that rather than left looking at a case with no hold.
    expect(detail.holdRefusal).toContain('already been released');
    // The platform's own words, never `placeDisputeHold`'s customer-facing copy.
    expect(detail.holdRefusal).not.toContain('Contact support');
    expect(detail.booking?.status).toBe('confirmed');
    expect(detail.booking?.payoutStatus).toBe('released');
  });

  it('records the network outcome on close without resolving the booking', async () => {
    const fixture = await seed();
    const dispute = {
      id: 'dp_test_close',
      status: 'needs_response',
      reason: 'fraudulent',
      amountCents: TOTAL_CENTS,
      intentId: fixture.paymentIntentId,
    };
    expect((await deliverDispute('charge.dispute.created', dispute)).statusCode).toBe(200);

    const closed = await deliverDispute('charge.dispute.closed', { ...dispute, status: 'lost' });
    expect(closed.statusCode).toBe(200);
    expect(closed.json().outcome).toBe('dispute-recorded');

    const detail = await readCase((await readCases()).items[0]!.id);
    expect(detail.networkOutcome).toBe('lost');
    /*
     * Stripe's outcome and the platform's disposition are different facts. The
     * case stays open and the booking stays held until an operator rules.
     */
    expect(detail.status).toBe('open');
    expect(detail.booking?.status).toBe('disputed');

    const reinstated = await deliverDispute('charge.dispute.funds_reinstated', {
      ...dispute,
      status: 'won',
    });
    expect(reinstated.json().outcome).toBe('dispute-recorded');
    expect((await readCase(detail.id)).networkOutcome).toBe('won');
  });

  it('ignores a dispute on a charge this platform did not make', async () => {
    await seed();

    const delivered = await deliverDispute('charge.dispute.created', {
      id: 'dp_test_foreign',
      status: 'needs_response',
      reason: 'fraudulent',
      amountCents: 5_000,
      intentId: 'pi_not_ours',
    });
    expect(delivered.statusCode).toBe(200);
    expect(delivered.json().outcome).toBe('ignored');
    expect((await readCases()).total).toBe(0);
  });

  it("uses the platform's own words when a chargeback lands on a booking already on hold", async () => {
    const fixture = await seed();

    // The customer reports it first, which places the hold and opens case one.
    expect((await report({ bookingId: fixture.bookingId })).statusCode).toBe(200);

    // Then they charge back at their bank.
    const delivered = await deliverDispute('charge.dispute.created', {
      id: 'dp_test_already_held',
      status: 'needs_response',
      reason: 'fraudulent',
      amountCents: TOTAL_CENTS,
      intentId: fixture.paymentIntentId,
    });
    expect(delivered.statusCode).toBe(200);
    expect(delivered.json().outcome).toBe('dispute-opened');

    const chargeback = (await readCases()).items.find((row) => row.origin === 'chargeback');
    const detail = await readCase(chargeback!.id);

    /*
     * `NOT_DISPUTABLE.disputed` is *"You have already reported a problem with
     * this booking"* — second-person copy written for the customer's report
     * form. Printed here it would tell an operator, on the screen where they
     * decide who keeps the money, that the payout is loose while it is frozen.
     */
    expect(detail.holdRefusal).not.toContain('You have already reported');
    expect(detail.holdRefusal).toContain('already on hold');
    // And it really is frozen, which is the fact the sentence has to match.
    expect(detail.booking?.payoutStatus).toBe('held');
  });

  it('holds a payout for a chargeback on an event that has not happened yet', async () => {
    /*
     * **The loss this closes.** `placeDisputeHold` refuses a customer's report
     * before the event — rightly: there is nothing to report yet and cancelling
     * is the better move. A card network is not asking for advice, and
     * `RELEASABLE_STATUSES` includes `confirmed`, so a chargeback that left the
     * booking unheld because the event was months out would be paid out to the
     * vendor on schedule with the dispute still live. That is precisely the loss
     * #423's hold-until-the-event design exists to prevent, arriving through the
     * one door that had opted out of it.
     */
    const fixture = await seed({ eventDate: '2099-06-01', paymentIntentId: 'pi_case_future' });

    const delivered = await deliverDispute('charge.dispute.created', {
      id: 'dp_test_future_event',
      status: 'needs_response',
      reason: 'fraudulent',
      amountCents: TOTAL_CENTS,
      intentId: fixture.paymentIntentId,
    });
    expect(delivered.statusCode).toBe(200);
    expect(delivered.json().outcome).toBe('dispute-opened');

    const detail = await readCase((await readCases()).items[0]!.id);

    expect(detail.holdRefusal).toBeNull();
    expect(detail.booking?.status).toBe('disputed');
    expect(detail.booking?.payoutStatus).toBe('held');

    // And the sweep can no longer see it: `disputed` is not releasable.
    const rows = await harness.database.db
      .select({ status: bookings.status, released: bookings.payoutReleasedAt })
      .from(bookings)
      .where(eq(bookings.id, fixture.bookingId));
    expect(rows[0]?.status).toBe('disputed');
    expect(rows[0]?.released).toBeNull();
  });

  it('still tells a customer to cancel rather than report an event that has not happened', async () => {
    /*
     * The other half of the same rule: the origin loosens exactly one refusal
     * and only for the network. A customer reporting a future booking still
     * gets the product's advice, and no case is written for a send that never
     * happened.
     */
    const fixture = await seed({ eventDate: '2099-07-01', paymentIntentId: 'pi_case_future_two' });

    const refused = await report({ bookingId: fixture.bookingId });

    expect(refused.statusCode).toBe(409);
    expect(refused.json().message).toContain('has not happened yet');
    expect((await readCases()).total).toBe(0);
  });

  it('tells the vendor when a chargeback freezes their payout', async () => {
    const fixture = await seed();

    expect(
      (
        await deliverDispute('charge.dispute.created', {
          id: 'dp_test_notice',
          status: 'needs_response',
          reason: 'fraudulent',
          amountCents: TOTAL_CENTS,
          intentId: fixture.paymentIntentId,
        })
      ).statusCode,
    ).toBe(200);

    /*
     * `sendSupportMessage` announces its hold; this door was silent, so a vendor
     * saw `On hold` appear with no notification. One queue means one notice.
     */
    const bells = await harness.database.db
      .select({ title: notifications.title, body: notifications.body })
      .from(notifications)
      .where(eq(notifications.type, 'booking_cancelled'));

    expect(bells).toHaveLength(1);
    expect(bells[0]?.title).toBe('A customer reported a problem');
    expect(bells[0]?.body).toContain('on hold');
  });

  it('still delivers a report about a booking a chargeback has already frozen', async () => {
    const fixture = await seed();

    // The bank freezes it first. The customer has filed nothing through us.
    expect(
      (
        await deliverDispute('charge.dispute.created', {
          id: 'dp_test_then_report',
          status: 'needs_response',
          reason: 'fraudulent',
          amountCents: TOTAL_CENTS,
          intentId: fixture.paymentIntentId,
        })
      ).statusCode,
    ).toBe(200);

    harness.email.sent.length = 0;

    /*
     * **The regression.** This used to be refused 409 with *"You have already
     * reported a problem with this booking"* — told to somebody who had not —
     * and `placeReportHold` runs before the send, so the message went nowhere.
     * The customer was locked out of support for the one booking they most
     * needed to talk about. The person most likely to need this form is the one
     * who cannot get through, which is why the route is public at all.
     */
    const sent = await report({
      bookingId: fixture.bookingId,
      message: 'My bank did this, not me.',
    });

    expect(sent.statusCode).toBe(200);
    expect(sent.json().reference).toMatch(SUPPORT_REFERENCE_PATTERN);
    // The message really went.
    expect(harness.email.sent.length).toBeGreaterThan(0);

    // Two cases about one booking, and still exactly one hold.
    const open = await readCases('?booking=with');
    expect(open.total).toBe(2);
    expect(open.items.map((row) => row.origin).sort()).toEqual(['chargeback', 'support_message']);

    const rows = await harness.database.db
      .select({ status: bookings.status })
      .from(bookings)
      .where(eq(bookings.id, fixture.bookingId));
    expect(rows[0]?.status).toBe('disputed');
  });

  it('refuses a report on a booking that cannot be disputed at all', async () => {
    /*
     * The other side of the same branch: `AlreadyHeldError` is only the
     * `disputed` case. A cancelled booking is still a refusal, and still one the
     * sender is told about rather than a message quietly sent about nothing.
     */
    const fixture = await seed();

    await harness.database.db
      .update(bookings)
      .set({ status: 'cancelled' })
      .where(eq(bookings.id, fixture.bookingId));

    const refused = await report({ bookingId: fixture.bookingId });

    expect(refused.statusCode).toBe(409);
    expect((await readCases()).total).toBe(0);
  });

  // --- Acceptance 9: authorization ------------------------------------------

  it('refuses every case route to a non-admin before validation', async () => {
    const fixture = await seed();
    expect((await report({ bookingId: fixture.bookingId })).statusCode).toBe(200);
    const caseId = (await readCases()).items[0]!.id;

    const routes = [
      { method: 'GET', url: '/admin/cases?status=not-a-status' },
      { method: 'GET', url: `/admin/cases/${caseId}` },
      { method: 'PUT', url: `/admin/cases/${caseId}/resolve` },
    ] as const;

    for (const route of routes) {
      const anonymous = await harness.app.inject({ method: route.method, url: route.url });
      expect(anonymous.statusCode, `anonymous ${route.url}`).toBe(401);

      for (const caller of [CUSTOMER, VENDOR]) {
        const response = await harness.app.inject({
          method: route.method,
          url: route.url,
          headers: bearer(caller),
        });

        /*
         * 403, not 400, on the route carrying a bad query string. `preHandler`
         * runs after validation, so the wrong-role caller would otherwise be
         * handed the enum's members in `details` — schema disclosure on the one
         * plugin that reads other people's complaints.
         */
        expect(response.statusCode, `${caller} ${route.url}`).toBe(403);
        expect(JSON.stringify(response.json())).not.toContain('resolved');
      }
    }

    // And nothing was closed by any of those attempts.
    expect((await readCase(caseId)).status).toBe('open');
  });
});

// --- Acceptance 3: the send fails ------------------------------------------

describe('a report whose email is refused (#431 acceptance 3)', () => {
  let harness: TestHarness;

  beforeAll(async () => {
    vi.stubGlobal('fetch', async () => {
      return new Response(
        JSON.stringify({ statusCode: 422, name: 'validation_error', message: 'refused' }),
        { status: 422, headers: { 'content-type': 'application/json' } },
      );
    });

    harness = await createTestHarness({
      emailGateway: createResendGateway({
        apiKey: TEST_ENV.RESEND_API_KEY,
        from: TEST_ENV.EMAIL_FROM,
      }),
    });

    for (const [clerkUserId, role] of [
      [ADMIN, 'customer'],
      [VENDOR, 'vendor'],
      [CUSTOMER, 'customer'],
    ] as const) {
      harness.clerkUsers.set(clerkUserId, {
        clerkUserId,
        email: `${clerkUserId}@example.com`,
        firstName: 'Test',
        lastName: 'User',
        roleHint: role,
        avatarUrl: null,
      });
    }
  });

  afterAll(async () => {
    await harness.close();
    vi.unstubAllGlobals();
  });

  it('lifts the hold and records the failure on the case', async () => {
    await harness.app.inject({ method: 'GET', url: '/users/me', headers: bearer(ADMIN) });
    await harness.database.db
      .update(users)
      .set({ role: 'admin' })
      .where(eq(users.clerkUserId, ADMIN));

    await harness.app.inject({ method: 'GET', url: '/users/me', headers: bearer(CUSTOMER) });
    const customers = await harness.database.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.clerkUserId, CUSTOMER))
      .limit(1);
    const customerId = customers[0]!.id;

    const categoryRows = await harness.database.db
      .select({ id: categories.id })
      .from(categories)
      .where(eq(categories.slug, 'photography'))
      .limit(1);

    await harness.app.inject({
      method: 'POST',
      url: '/vendor/profile',
      headers: bearer(VENDOR),
      payload: {
        businessName: 'Sunlit Studio',
        categoryIds: [categoryRows[0]!.id],
        city: 'Austin',
        state: 'TX',
      },
    });
    const profiles = await harness.database.db
      .select({ id: vendorProfiles.id })
      .from(vendorProfiles)
      .limit(1);

    const requestRows = await harness.database.db
      .insert(bookingRequests)
      .values({
        customerId,
        vendorId: profiles[0]!.id,
        eventDate: PAST_EVENT,
        status: 'accepted',
        finalPriceCents: TOTAL_CENTS,
      })
      .returning({ id: bookingRequests.id });

    const bookingRows = await harness.database.db
      .insert(bookings)
      .values({
        requestId: requestRows[0]!.id,
        customerId,
        vendorId: profiles[0]!.id,
        eventDate: PAST_EVENT,
        totalAmountCents: TOTAL_CENTS,
        platformFeeCents: 14_400,
        vendorPayoutCents: 105_600,
        status: 'confirmed',
        paidAt: new Date('2020-05-01T00:00:00Z'),
        stripePaymentIntentId: 'pi_case_failing_send',
      })
      .returning({ id: bookings.id });
    const bookingId = bookingRows[0]!.id;

    const sent = await harness.app.inject({
      method: 'POST',
      url: '/support/messages',
      headers: bearer(CUSTOMER),
      ...fromANewVisitor(),
      payload: { topic: 'booking-or-payment', message: 'Nobody came.', bookingId },
    });
    expect(sent.statusCode).toBe(502);

    const page = await harness.app.inject({
      method: 'GET',
      url: '/admin/cases',
      headers: bearer(ADMIN),
    });
    const cases = wireCasePageSchema.parse(page.json());
    expect(cases.total).toBe(1);
    expect(cases.items[0]!.reference).toBe(sent.json().details.reference);

    const detail = await harness.app.inject({
      method: 'GET',
      url: `/admin/cases/${cases.items[0]!.id}`,
      headers: bearer(ADMIN),
    });
    const parsed = wireCaseDetailSchema.parse(detail.json());

    // Acceptance 3, both halves: the compensation still lifts the hold with a
    // row in play, and the row records that nobody received the report.
    expect(parsed.emailFailedAt).not.toBeNull();
    expect(parsed.booking?.status).toBe('confirmed');
    expect(parsed.booking?.payoutStatus).toBe('pending');
  });
});

// --- What the security audit found -----------------------------------------

describe('a case row that cannot be written (#431 security review)', () => {
  const captured: string[] = [];
  let harness: TestHarness;

  const collector = new Writable({
    write(chunk, _encoding, callback) {
      captured.push(String(chunk));
      callback();
    },
  });

  beforeAll(async () => {
    harness = await createTestHarness({ env: { LOG_LEVEL: 'trace' }, loggerStream: collector });

    harness.clerkUsers.set(CUSTOMER, {
      clerkUserId: CUSTOMER,
      email: `${CUSTOMER}@example.com`,
      firstName: 'Test',
      lastName: 'User',
      roleHint: 'customer',
      avatarUrl: null,
    });
  });

  afterAll(async () => {
    await harness.close();
  });

  it('logs the driver code and never the message body or the sender address', async () => {
    await harness.app.inject({ method: 'GET', url: '/users/me', headers: bearer(CUSTOMER) });

    /*
     * **A caller-chosen insert failure.** `freeText()` strips bidi controls and
     * trims; neither removes `U+0000`, and Postgres refuses a null byte with
     * `22021` — so a stranger on a public, rate-limited form decides when this
     * write fails and what is bound to it.
     *
     * The regression: drizzle wraps a failed statement in a `DrizzleQueryError`
     * whose `message` is `Failed query: … params: <every bound parameter>`, and
     * which carries `params` as an own enumerable property. pino's `err`
     * serialiser copies own properties and `server.ts`'s redaction is path-based
     * on `req.headers.*`, so handing that error to the logger wrote the
     * complaint and the reply-to address into the log stream — six times an
     * hour, at the caller's choosing.
     */
    const secret = 'A-COMPLAINT-NOBODY-ELSE-SHOULD-EVER-READ';
    captured.length = 0;

    const sent = await harness.app.inject({
      method: 'POST',
      url: '/support/messages',
      headers: bearer(CUSTOMER),
      ...fromANewVisitor(),
      payload: { topic: 'trust-and-safety', message: `${secret}\u0000` },
    });

    // The send still succeeds: the row is best-effort and must not cost the email.
    expect(sent.statusCode).toBe(200);
    expect(harness.email.sent.length).toBeGreaterThan(0);

    const written = captured.join('\n');

    // It really failed — otherwise this test proves nothing about the log.
    expect(written).toContain('could not be written');
    expect(written).not.toContain(secret);
    expect(written).not.toContain(`${CUSTOMER}@example.com`);
    // And the half that says what to fix survives.
    expect(written).toContain('22021');
  });
});
