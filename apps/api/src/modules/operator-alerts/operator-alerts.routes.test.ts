import {
  bookingRequests,
  bookings,
  categories,
  notifications,
  operatorAlerts,
  supportCases,
  users,
  vendorCategories,
  vendorProfiles,
} from '@vendor-marketplace/db/schema';
import { eq } from 'drizzle-orm';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { EmailMessage } from '../../lib/email.js';
import {
  bearer,
  createTestHarness,
  TEST_ENV,
  type TestHarness,
} from '../../testing/test-server.js';
import { releaseDuePayouts } from '../payments/payouts.service.js';

const VENDOR = 'user_vendor_alerts';
const CUSTOMER = 'user_customer_alerts';
const CUSTOMER_EMAIL = `${CUSTOMER}@example.com`;
const CUSTOMER_PHONE = '+15125550142';
const ADMIN = 'user_admin_alerts';
const PAST_EVENT = '2020-06-01';
const FUTURE_EVENT = '2099-06-01';
const TOTAL_CENTS = 120_000;
const PAYOUT_CENTS = 105_600;

interface Fixture {
  customerId: string;
  vendorProfileId: string;
  bookingId: string;
  paymentIntentId: string;
}

/**
 * VEN-405: the events that need a person arrive in the operator's inbox, once,
 * and carry ids and console links rather than customer PII.
 */
describe('operator alerts', () => {
  let harness: TestHarness;
  let photographyId: string;

  function operatorMail(): EmailMessage[] {
    return harness.email.sent.filter((message) => message.to === TEST_ENV.OPERATOR_ALERT_EMAIL);
  }

  /** Every rendered part of a message, for the PII scan. */
  function rendered(message: EmailMessage): string {
    return `${message.subject}\n${message.text}\n${message.html}`;
  }

  async function signIn(authUserId: string): Promise<string> {
    const response = await harness.app.inject({
      method: 'GET',
      url: '/users/me',
      headers: bearer(authUserId),
    });
    expect(response.statusCode).toBe(200);

    const rows = await harness.database.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.authUserId, authUserId))
      .limit(1);

    return rows[0]!.id;
  }

  async function seed(
    options: { payoutModel?: 'separate' | 'destination'; eventDate?: string } = {},
  ): Promise<Fixture> {
    const eventDate = options.eventDate ?? PAST_EVENT;
    const customerId = await signIn(CUSTOMER);
    await harness.database.db
      .update(users)
      .set({ phone: CUSTOMER_PHONE })
      .where(eq(users.id, customerId));

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
      .from(vendorProfiles);
    const vendorProfileId = profiles[0]!.id;

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

    const paymentIntentId = 'pi_alert_fixture';
    const bookingRows = await harness.database.db
      .insert(bookings)
      .values({
        requestId: requestRows[0]!.id,
        customerId,
        vendorId: vendorProfileId,
        eventDate,
        totalAmountCents: TOTAL_CENTS,
        platformFeeCents: TOTAL_CENTS - PAYOUT_CENTS,
        vendorPayoutCents: PAYOUT_CENTS,
        payoutModel: options.payoutModel ?? 'destination',
        status: 'confirmed',
        paidAt: new Date('2020-05-01T00:00:00Z'),
        stripePaymentIntentId: paymentIntentId,
      })
      .returning({ id: bookings.id });

    return { customerId, vendorProfileId, bookingId: bookingRows[0]!.id, paymentIntentId };
  }

  async function postStripe(signature = 'valid-signature') {
    return harness.app.inject({
      method: 'POST',
      url: '/webhooks/stripe',
      headers: { 'stripe-signature': signature, 'content-type': 'application/json' },
      payload: JSON.stringify({ id: 'evt_alert', object: 'event' }),
    });
  }

  async function deliverDispute(disputeId: string, intentId: string) {
    harness.stripe.disputes.set(disputeId, {
      id: disputeId,
      status: 'needs_response',
      reason: 'fraudulent',
      amountCents: TOTAL_CENTS,
      paymentIntentId: intentId,
    });
    harness.stripe.nextEvent = {
      type: 'charge.dispute.created',
      accountId: null,
      objectId: disputeId,
    };

    const response = await postStripe();
    await harness.flushEmail();
    return response;
  }

  beforeAll(async () => {
    harness = await createTestHarness();

    for (const [authUserId, role] of [
      [ADMIN, 'customer'],
      [VENDOR, 'vendor'],
      [CUSTOMER, 'customer'],
    ] as const) {
      harness.clerkUsers.set(authUserId, {
        authUserId,
        email: `${authUserId}@example.com`,
        firstName: 'Casey',
        lastName: 'Rivera',
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
    await harness.flushEmail();
    await harness.database.db.delete(operatorAlerts);
    await harness.database.db.delete(notifications);
    await harness.database.db.delete(supportCases);
    await harness.database.db.delete(bookings);
    await harness.database.db.delete(bookingRequests);
    await harness.database.db.delete(vendorCategories);
    await harness.database.db.delete(vendorProfiles);
    await harness.database.db.delete(users);
    harness.email.sent.length = 0;
    harness.stripe.disputes.clear();
    harness.stripe.accountStatuses.clear();
    harness.stripe.refundsToRefuse.clear();
    harness.stripe.refunds.length = 0;
  });

  afterAll(async () => {
    await harness.close();
  });

  it('emails the operator once for a chargeback, and not again on redelivery', async () => {
    const fixture = await seed();

    const first = await deliverDispute('dp_alert_1', fixture.paymentIntentId);
    expect(first.statusCode).toBe(200);
    expect(first.json().outcome).toBe('dispute-opened');

    const cases = await harness.database.db.select({ id: supportCases.id }).from(supportCases);
    expect(cases).toHaveLength(1);
    const caseId = cases[0]!.id;

    const sent = operatorMail();
    expect(sent).toHaveLength(1);
    expect(sent[0]!.subject).toBe(`[Orla ops] Chargeback opened on booking ${fixture.bookingId}`);
    expect(sent[0]!.text).toContain(`Booking: ${fixture.bookingId}`);
    expect(sent[0]!.text).toContain('Amount: $1,200');
    expect(sent[0]!.text).toContain(`Open: ${TEST_ENV.WEB_URL}/admin/cases/${caseId}`);
    expect(sent[0]!.html).toContain(`href="${TEST_ENV.WEB_URL}/admin/cases/${caseId}"`);

    const replay = await deliverDispute('dp_alert_1', fixture.paymentIntentId);
    expect(replay.statusCode).toBe(200);
    expect(replay.json().outcome).toBe('already-recorded');
    expect(operatorMail()).toHaveLength(1);

    const recorded = await harness.database.db
      .select({
        kind: operatorAlerts.kind,
        subjectId: operatorAlerts.subjectId,
        outcome: operatorAlerts.outcome,
      })
      .from(operatorAlerts);
    expect(recorded).toEqual([{ kind: 'dispute_opened', subjectId: caseId, outcome: 'sent' }]);
  });

  it('sends one email per failure kind for repeated Stripe webhook failures inside ten minutes', async () => {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      expect((await postStripe('forged-signature')).statusCode).toBe(401);
    }
    await harness.flushEmail();
    expect(operatorMail().map((message) => message.subject)).toEqual([
      '[Orla ops] Stripe webhook refused 3 times in 10 minutes',
    ]);

    /*
     * A burst of refused signatures — which anybody can send — must not
     * silence a real handler outage: server errors are deduplicated apart.
     */
    harness.stripe.nextEvent = {
      type: 'charge.dispute.created',
      accountId: null,
      objectId: 'dp_missing',
    };
    for (let attempt = 0; attempt < 3; attempt += 1) {
      expect((await postStripe()).statusCode).toBe(500);
    }
    await harness.flushEmail();
    expect(operatorMail().map((message) => message.subject)).toEqual([
      '[Orla ops] Stripe webhook refused 3 times in 10 minutes',
      '[Orla ops] Stripe webhook failed 3 times in 10 minutes',
    ]);

    // Crossing the threshold again inside six hours stays deduplicated.
    for (let attempt = 0; attempt < 3; attempt += 1) {
      expect((await postStripe('forged-signature')).statusCode).toBe(401);
    }
    await harness.flushEmail();
    expect(operatorMail()).toHaveLength(2);
  });

  it('retries a failed alert send, because a chargeback is never redelivered to alert again', async () => {
    const fixture = await seed();
    harness.email.failNext = true;

    expect((await deliverDispute('dp_alert_retry', fixture.paymentIntentId)).json().outcome).toBe(
      'dispute-opened',
    );

    const sent = operatorMail();
    expect(sent).toHaveLength(1);
    expect(sent[0]!.subject).toBe(`[Orla ops] Chargeback opened on booking ${fixture.bookingId}`);
    expect(
      await harness.database.db.select({ outcome: operatorAlerts.outcome }).from(operatorAlerts),
    ).toEqual([{ outcome: 'sent' }]);
  });

  it('does not count an accepted webhook as a failure', async () => {
    harness.stripe.nextEvent = { type: 'customer.created', accountId: null, objectId: null };

    for (let attempt = 0; attempt < 3; attempt += 1) {
      expect((await postStripe()).statusCode).toBe(200);
    }
    await harness.flushEmail();

    expect(operatorMail()).toEqual([]);
  });

  it('emails once when a payout fails its third attempt, and not on the fourth', async () => {
    // A `separate` payout to a vendor with no connected account fails every sweep.
    const fixture = await seed({ payoutModel: 'separate' });
    const context = {
      db: harness.database.db,
      stripe: harness.stripe,
      log: harness.app.log,
      alerts: harness.app.operatorAlerts,
    };

    for (let sweep = 1; sweep <= 2; sweep += 1) {
      expect((await releaseDuePayouts(context, new Date())).failed).toBe(1);
      await harness.flushEmail();
    }
    expect(operatorMail()).toEqual([]);

    expect((await releaseDuePayouts(context, new Date())).failed).toBe(1);
    await harness.flushEmail();

    const sent = operatorMail();
    expect(sent).toHaveLength(1);
    expect(sent[0]!.subject).toBe(
      `[Orla ops] Payout failed 3 times on booking ${fixture.bookingId}`,
    );
    expect(sent[0]!.text).toContain("The vendor's $1,056 transfer has failed 3 attempts in a row.");
    expect(sent[0]!.text).toContain(`Open: ${TEST_ENV.WEB_URL}/admin/payments`);

    expect((await releaseDuePayouts(context, new Date())).failed).toBe(1);
    await harness.flushEmail();
    expect(operatorMail()).toHaveLength(1);
  });

  it('emails when Stripe disables a vendor who could be paid', async () => {
    await seed();
    const vendorUserId = (
      await harness.database.db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.authUserId, VENDOR))
    )[0]!.id;
    await harness.database.db
      .update(vendorProfiles)
      .set({ stripeAccountId: 'acct_alert_vendor', stripeOnboarded: true });
    harness.stripe.accountStatuses.set('acct_alert_vendor', {
      transfersActive: false,
      payoutsActive: false,
      disabledReason: 'requirements.past_due',
    });
    harness.stripe.nextEvent = {
      type: 'account.updated',
      accountId: 'acct_alert_vendor',
      objectId: null,
    };

    const response = await postStripe();
    expect(response.json().outcome).toBe('not-onboarded');
    await harness.flushEmail();

    const sent = operatorMail();
    expect(sent).toHaveLength(1);
    expect(sent[0]!.subject).toBe('[Orla ops] Sunlit Studio can no longer be paid out');
    expect(sent[0]!.text).toContain('Stripe reason: requirements.past_due');
    expect(sent[0]!.text).toContain(`Open: ${TEST_ENV.WEB_URL}/admin/users/${vendorUserId}`);

    // The same state redelivered is `unchanged`, and nobody is paged for it.
    expect((await postStripe()).json().outcome).toBe('unchanged');
    await harness.flushEmail();
    expect(operatorMail()).toHaveLength(1);
  });

  it('emails when a safety report is filed, without the reporter or their words', async () => {
    const fixture = await seed();

    const filed = await harness.app.inject({
      method: 'POST',
      url: '/reports',
      headers: bearer(CUSTOMER),
      payload: {
        subjectType: 'vendor_profile',
        subjectId: fixture.vendorProfileId,
        reason: 'harassment',
        detail: `Call me back on ${CUSTOMER_PHONE} or ${CUSTOMER_EMAIL}`,
      },
    });
    expect(filed.statusCode).toBe(200);
    await harness.flushEmail();

    const caseId = (
      await harness.database.db.select({ id: supportCases.id }).from(supportCases)
    )[0]!.id;
    const sent = operatorMail();
    expect(sent).toHaveLength(1);
    expect(sent[0]!.subject).toBe('[Orla ops] Report filed: Harassment or abuse');
    expect(sent[0]!.text).toContain(`Case: ${filed.json().reference} (${caseId})`);
    expect(sent[0]!.text).toContain(`Open: ${TEST_ENV.WEB_URL}/admin/cases/${caseId}`);
  });

  it('emails when Stripe refuses the refund on a customer cancellation', async () => {
    const fixture = await seed({ payoutModel: 'separate', eventDate: FUTURE_EVENT });
    harness.stripe.refundsToRefuse.add(fixture.paymentIntentId);

    const cancelled = await harness.app.inject({
      method: 'PUT',
      url: `/customer/bookings/${fixture.bookingId}/cancel`,
      headers: bearer(CUSTOMER),
      payload: {},
    });
    expect(cancelled.statusCode).toBe(500);
    await harness.flushEmail();

    const sent = operatorMail();
    expect(sent).toHaveLength(1);
    expect(sent[0]!.subject).toBe(`[Orla ops] Refund failed on booking ${fixture.bookingId}`);
    expect(sent[0]!.text).toContain('A refund attempted during a cancellation did not go through');
  });

  it('does not write a refund Stripe answered as failed, and alerts once', async () => {
    const fixture = await seed({ payoutModel: 'separate', eventDate: FUTURE_EVENT });
    harness.stripe.nextRefundStatus = 'failed';

    const cancelled = await harness.app.inject({
      method: 'PUT',
      url: `/customer/bookings/${fixture.bookingId}/cancel`,
      headers: bearer(CUSTOMER),
      payload: {},
    });
    harness.stripe.nextRefundStatus = undefined;
    expect(cancelled.statusCode).toBe(500);
    await harness.flushEmail();

    const row = (
      await harness.database.db
        .select({ refund: bookings.refundAmountCents, status: bookings.status })
        .from(bookings)
    )[0]!;
    expect(row).toEqual({ refund: null, status: 'confirmed' });
    expect(operatorMail().map((message) => message.subject)).toEqual([
      `[Orla ops] Refund failed on booking ${fixture.bookingId}`,
    ]);
  });

  it('alerts once when a pending refund later fails, however many events say so', async () => {
    const fixture = await seed({ payoutModel: 'separate', eventDate: FUTURE_EVENT });
    harness.stripe.refunds.push({
      paymentIntentId: fixture.paymentIntentId,
      amountCents: TOTAL_CENTS,
      reason: 'requested_by_customer',
      idempotencyKey: undefined,
      reverseTransfer: false,
      refundApplicationFee: false,
      status: 'pending',
    });

    harness.stripe.nextEvent = {
      type: 'charge.refund.updated',
      accountId: null,
      objectId: 're_test_1',
    };
    expect((await postStripe()).json().outcome).toBe('refund-unchanged');
    await harness.flushEmail();
    expect(operatorMail()).toEqual([]);

    harness.stripe.refunds[0]!.status = 'failed';
    for (const type of ['charge.refund.updated', 'refund.failed', 'charge.refund.updated']) {
      harness.stripe.nextEvent = { type, accountId: null, objectId: 're_test_1' };
      expect((await postStripe()).json().outcome).toBe('refund-failed');
    }
    await harness.flushEmail();

    expect(operatorMail().map((message) => message.subject)).toEqual([
      `[Orla ops] Refund failed on booking ${fixture.bookingId}`,
    ]);
  });

  it('emails when a dispute names a payment intent no booking owns', async () => {
    const response = await deliverDispute('dp_orphan', 'pi_no_booking');

    expect(response.json().outcome).toBe('ignored');
    expect(await harness.database.db.select({ id: supportCases.id }).from(supportCases)).toEqual(
      [],
    );
    const sent = operatorMail();
    expect(sent.map((message) => message.subject)).toEqual([
      '[Orla ops] Chargeback on pi_no_booking matches no booking',
    ]);
    expect(sent[0]!.text).toContain('dispute dp_orphan for $1,200 on payment intent pi_no_booking');
  });

  it('emails when a refund fails while a ban unwinds the account', async () => {
    const fixture = await seed({ payoutModel: 'separate', eventDate: FUTURE_EVENT });
    await signIn(ADMIN);
    await harness.database.db
      .update(users)
      .set({ role: 'admin' })
      .where(eq(users.authUserId, ADMIN));
    const vendorUserId = (
      await harness.database.db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.authUserId, VENDOR))
    )[0]!.id;
    harness.stripe.refundsToRefuse.add(fixture.paymentIntentId);

    const banned = await harness.app.inject({
      method: 'PUT',
      url: `/admin/users/${vendorUserId}/ban`,
      headers: bearer(ADMIN),
    });
    expect(banned.statusCode).toBe(200);
    expect(banned.json().refundsFailed).toBe(1);
    await harness.flushEmail();

    expect(operatorMail().map((message) => message.subject)).toEqual([
      `[Orla ops] Refund failed on booking ${fixture.bookingId}`,
    ]);
  });

  it('puts no customer email address or phone number in any alert body', async () => {
    const fixture = await seed({ payoutModel: 'separate' });

    await deliverDispute('dp_alert_pii', fixture.paymentIntentId);
    await harness.app.inject({
      method: 'POST',
      url: '/reports',
      headers: bearer(CUSTOMER),
      payload: {
        subjectType: 'vendor_profile',
        subjectId: fixture.vendorProfileId,
        reason: 'something-else',
        detail: `Reach me at ${CUSTOMER_EMAIL} or ${CUSTOMER_PHONE}`,
      },
    });
    await harness.flushEmail();

    const sent = operatorMail();
    expect(sent.map((message) => message.subject.split(':')[0])).toEqual([
      '[Orla ops] Chargeback opened on booking ' + fixture.bookingId,
      '[Orla ops] Report filed',
    ]);

    for (const message of sent) {
      expect(rendered(message)).not.toContain(CUSTOMER_EMAIL);
      expect(rendered(message)).not.toContain(CUSTOMER_PHONE);
    }
  });
});
