import {
  bookingRequests,
  bookings,
  categories,
  vendorProfiles,
} from '@vendor-marketplace/db/schema';
import {
  addDays,
  CURRENT_VENDOR_AGREEMENT_VERSION,
  toDateString,
} from '@vendor-marketplace/shared';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  bearer,
  createTestHarness,
  signInAs,
  type TestHarness,
} from '../../testing/test-server.js';

const ADMIN = 'user_admin';
const VENDOR = 'user_vendor';
const CUSTOMER = 'user_customer';

/**
 * One fixed timeline, moved deliberately rather than read from the wall clock.
 *
 * The whole point of this suite is a booking that has **already happened**, and
 * the application refuses to produce one from a past date: `/booking-requests`
 * rejects a request for a date that is gone, and the vendor's completion route
 * refuses an event that has not. So the clock moves forward past the event
 * instead of a row being back-dated into a state no route could have written —
 * which is the fixture rule #444 states, because a hand-set `status:
 * 'completed'` only agrees with the payment path while somebody keeps it in
 * step by hand.
 */
const START = new Date('2026-06-01T12:00:00Z');
const SETTLED_EVENT_DATE = toDateString(addDays(START, 30));
let clockNow = START;

/**
 * #444: an unwind must not rewrite the history of a booking that already
 * happened.
 *
 * Driven through **`setUserBanned`** rather than through the newer closure
 * route, because the ban is where this defect has been reachable longest — it
 * predates both #433's `user.deleted` path and #438's closure, and all three
 * share `unwindAccountBookings`. Closure's own assertion of the same rule lives
 * in `data-rights.routes.test.ts`, where #438 pinned the behaviour this changes.
 *
 * The fixture carries **both** shapes through one unwind on purpose: an
 * accepted request whose booking is settled, which must survive, and an
 * accepted request nobody ever paid for, which must still be declined. A
 * fixture holding only one of them passes for the wrong reason — dropping
 * `accepted` from the predicate outright satisfies the first alone, and leaving
 * the predicate as it was satisfies the second alone.
 */
describe('an account unwind and the requests behind settled bookings', () => {
  let harness: TestHarness;
  let photographyId: string;

  async function inject(
    method: 'GET' | 'POST' | 'PUT',
    url: string,
    actor: string | null,
    payload?: Record<string, unknown>,
  ): Promise<Awaited<ReturnType<TestHarness['app']['inject']>>> {
    return harness.app.inject({
      method,
      url,
      ...(actor ? { headers: bearer(actor) } : {}),
      ...(payload ? { payload } : {}),
    });
  }

  /** A published, payout-ready vendor holding the current agreement. */
  async function createVendor(): Promise<{ vendorId: string; packageId: string }> {
    const profile = await inject('POST', '/vendor/profile', VENDOR, {
      businessName: 'Sunlit Studio',
      categoryIds: [photographyId],
      city: 'Austin',
      state: 'TX',
      bio: 'Documentary wedding photography for people who hate posing.',
    });
    expect(profile.statusCode).toBe(201);
    const vendorId: string = profile.json().id;

    const created = await inject('POST', '/vendor/packages', VENDOR, {
      name: 'Full day coverage',
      description: 'Six hours of coverage with two photographers on site.',
      priceCents: 120_000,
      durationHours: 6,
    });
    expect(created.statusCode).toBe(201);

    await harness.database.db
      .update(vendorProfiles)
      .set({ isPublished: true, stripeOnboarded: true, stripeAccountId: 'acct_unwind_vendor' })
      .where(eq(vendorProfiles.id, vendorId));

    /* A vendor cannot take payment without the current agreement (#427). */
    const accepted = await inject('POST', '/vendor/agreement/accept', VENDOR, {
      version: CURRENT_VENDOR_AGREEMENT_VERSION,
    });
    expect(accepted.statusCode).toBe(200);

    return { vendorId, packageId: created.json().id };
  }

  /**
   * A request for one date. `packageId` is optional because a **quote** is only
   * legal on a custom request — a packaged one is already priced, and the quote
   * route says so in as many words.
   */
  async function requestFor(
    vendorId: string,
    packageId: string | null,
    eventDate: string,
  ): Promise<string> {
    const request = await inject('POST', '/booking-requests', CUSTOMER, {
      vendorId,
      ...(packageId
        ? { packageId }
        : {
            /* A custom request has to carry the brief the quote is priced from. */
            customDetails: 'Two photographers, ceremony through to the first dance, all day.',
          }),
      eventDate,
      eventType: 'wedding',
      eventLocation: 'Barr Mansion, Austin, TX',
      guestCount: 120,
    });
    expect(request.statusCode).toBe(201);

    return request.json().id;
  }

  /** Opens checkout and settles the charge, as confirming the card would. */
  async function payFor(requestId: string): Promise<void> {
    const checkout = await inject(
      'POST',
      `/customer/booking-requests/${requestId}/checkout`,
      CUSTOMER,
    );
    expect(checkout.statusCode).toBe(200);

    const intentId: string = checkout.json().paymentIntentId;
    harness.stripe.succeed(intentId);
    harness.stripe.nextEvent = {
      type: 'payment_intent.succeeded',
      accountId: null,
      objectId: intentId,
    };

    const webhook = await harness.app.inject({
      method: 'POST',
      url: '/webhooks/stripe',
      headers: { 'stripe-signature': 'valid-signature', 'content-type': 'application/json' },
      payload: { id: 'evt_test', type: 'payment_intent.succeeded' },
    });
    expect(webhook.statusCode).toBe(200);
  }

  async function requestStatus(requestId: string): Promise<string> {
    const [row] = await harness.database.db
      .select({ status: bookingRequests.status })
      .from(bookingRequests)
      .where(eq(bookingRequests.id, requestId));

    return row!.status;
  }

  beforeAll(async () => {
    harness = await createTestHarness({ clock: () => clockNow });

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

  afterAll(async () => {
    clockNow = START;
    await harness.close();
  });

  it('leaves the request behind a settled booking alone and still declines the rest', async () => {
    await signInAs(harness, ADMIN, true);
    await signInAs(harness, CUSTOMER);
    const vendorUserId = await signInAs(harness, VENDOR);
    const { vendorId, packageId } = await createVendor();

    /*
     * Shape one, built entirely through the product's own routes: requested,
     * accepted, paid for, and marked done by the vendor once the day had
     * passed. Its request is `accepted` because that is what checkout leaves
     * behind — nothing moves it afterwards, which is exactly why the unwind
     * could reach it.
     */
    const settledRequestId = await requestFor(vendorId, packageId, SETTLED_EVENT_DATE);
    expect(
      (await inject('POST', `/booking-requests/${settledRequestId}/accept`, VENDOR)).statusCode,
    ).toBe(200);
    await payFor(settledRequestId);

    clockNow = addDays(START, 31);

    const [booking] = await harness.database.db
      .select({ id: bookings.id })
      .from(bookings)
      .where(eq(bookings.requestId, settledRequestId));
    const finished = await inject('PUT', `/vendor/bookings/${booking!.id}/complete`, VENDOR);
    expect(finished.statusCode).toBe(200);
    expect(finished.json().status).toBe('completed');

    /*
     * Shape two: accepted and never paid for. A real open commitment — the
     * vendor is holding a date for an account that is about to stop trading —
     * so the unwind must still decline it. Created after the clock moved, so
     * the lazy expiry sweep cannot reach it.
     */
    const unpaidAcceptedId = await requestFor(
      vendorId,
      packageId,
      toDateString(addDays(START, 90)),
    );
    expect(
      (await inject('POST', `/booking-requests/${unpaidAcceptedId}/accept`, VENDOR)).statusCode,
    ).toBe(200);

    /*
     * Shape three: accepted, paid for, and for an event that has **not**
     * happened — so this unwind cancels and refunds the booking itself.
     *
     * It is here to pin the answer to the ticket's open question, which turns
     * out not to be `declineOpenRequests`' to give: the request lands on
     * `cancelled`, written by `cancelBookingAndFreeDate` in the same
     * transaction as the cancellation (#400), long before the decline UPDATE
     * runs. So the predicate never sees this row as `accepted` and needs no
     * case for it — and a future edit that moved that settlement out of the
     * cancellation would fail here rather than quietly leaving the request
     * `accepted` for a booking that no longer exists.
     */
    const cancelledId = await requestFor(vendorId, packageId, toDateString(addDays(START, 120)));
    expect(
      (await inject('POST', `/booking-requests/${cancelledId}/accept`, VENDOR)).statusCode,
    ).toBe(200);
    await payFor(cancelledId);

    const pendingId = await requestFor(vendorId, packageId, toDateString(addDays(START, 91)));

    const quotedId = await requestFor(vendorId, null, toDateString(addDays(START, 92)));
    const quoted = await inject('POST', `/booking-requests/${quotedId}/quote`, VENDOR, {
      quotedPriceCents: 130_000,
      quoteNote: 'Happy to cover this one, here is the price for the extra hour.',
    });
    expect(quoted.json()).toMatchObject({ status: 'quoted' });

    const response = await inject('PUT', `/admin/users/${vendorUserId}/ban`, ADMIN);

    expect(response.statusCode).toBe(200);
    /*
     * Three of the five. The settled request survives — the defect — and the
     * cancelled booking's request is not in this count either, because the
     * cancellation had already moved it out of `accepted`.
     */
    expect(response.json()).toMatchObject({
      isBanned: true,
      requestsDeclined: 3,
      bookingsCancelled: 1,
      refundsIssued: 1,
      refundsFailed: 0,
    });

    expect(await requestStatus(settledRequestId)).toBe('accepted');
    expect(await requestStatus(unpaidAcceptedId)).toBe('declined');
    expect(await requestStatus(cancelledId)).toBe('cancelled');
    expect(await requestStatus(pendingId)).toBe('declined');
    expect(await requestStatus(quotedId)).toBe('declined');

    /* The settled booking is untouched — the event happened and was paid for. */
    const [after] = await harness.database.db
      .select({ status: bookings.status, refundAmountCents: bookings.refundAmountCents })
      .from(bookings)
      .where(eq(bookings.id, booking!.id));
    expect(after).toMatchObject({ status: 'completed', refundAmountCents: null });
  });
});
