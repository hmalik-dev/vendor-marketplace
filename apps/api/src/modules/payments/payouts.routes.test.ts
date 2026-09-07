import {
  availability,
  bookingRequests,
  bookings,
  categories,
  conversations,
  notifications,
  users,
  vendorProfiles,
} from '@vendor-marketplace/db/schema';
import {
  addDays,
  payoutReleaseAt,
  SUPPORT_REFERENCE_PATTERN,
  SUPPORT_TOPIC_LABELS,
  toDateString,
} from '@vendor-marketplace/shared';
import { eq } from 'drizzle-orm';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { EmailMessage } from '../../lib/email.js';
import {
  bearer,
  createTestHarness,
  TEST_ENV,
  type TestHarness,
} from '../../testing/test-server.js';
import { liftDisputeHold } from './payments.service.js';
import { releaseDuePayouts } from './payouts.service.js';

const VENDOR = 'user_vendor';
const CUSTOMER = 'user_customer';
const ADMIN = 'user_admin';
const OUTSIDER = 'user_customer_two';

/** $1,450 — the frame's own figure, so a wrong split is visible as a wrong price. */
const PRICE_CENTS = 145_000;
const EXPECTED_PAYOUT_CENTS = 127_600;
const VENDOR_ACCOUNT = 'acct_test_vendor';

/**
 * One fixed timeline, moved deliberately rather than read from the wall clock.
 *
 * Every assertion in this file is about which side of a date something falls
 * on, so the clock is an input. Time moves *forward* past the event rather than
 * a row being back-dated into it: the booking route refuses a past date, and a
 * hand-written row would be a state the application cannot reach — which is
 * exactly the kind of fixture that makes a money test agree with itself and
 * disagree with production.
 */
const START = new Date('2026-06-01T12:00:00Z');
const EVENT_DATE = toDateString(addDays(START, 30));
/** Inside the payout window: the event has happened, the money has not moved. */
const JUST_AFTER_EVENT = addDays(START, 31);
/** Past `payoutReleaseAt(EVENT_DATE)`, so the payout is due. */
const AFTER_RELEASE = addDays(START, 34);

let clockNow = START;

describe('payouts', () => {
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

  /** The sweep, driven by hand — the same function the timer calls. */
  async function sweep(now: Date = clockNow): Promise<ReturnType<typeof releaseDuePayouts>> {
    return releaseDuePayouts(
      { db: harness.database.db, stripe: harness.stripe, log: harness.app.log },
      now,
    );
  }

  const REPORT = 'The photographer never turned up, and nobody answered the phone all day.';

  /**
   * One report, sent the way the support screen sends it — and **the only way
   * the product places a hold** (#425).
   *
   * Every case that needs a held booking goes through this, including #423's
   * own, because the hold has exactly one entry point now: a `PUT` that froze a
   * payout without filing a complaint would leave an operator a hold with
   * nothing to act on, which is the half of acceptance 4 a second route made
   * reachable.
   */
  async function report(
    bookingId: string,
    actor: string | null,
    message = REPORT,
  ): Promise<Awaited<ReturnType<TestHarness['app']['inject']>>> {
    return inject('POST', '/support/messages', actor, {
      topic: 'booking-or-payment',
      message,
      bookingId,
    });
  }

  /** The message addressed to the support inbox, if one was sent. */
  function reportEmail(): EmailMessage | undefined {
    return harness.email.sent.find((message) => message.to === TEST_ENV.SUPPORT_EMAIL_TO);
  }

  /**
   * Whether the vendor has been told a problem was reported.
   *
   * Scoped to that one title rather than the whole list: the booking flow sends
   * the vendor several notices of its own on the way to a paid booking, and a
   * test that asserted on all of them would be asserting on the fixture.
   */
  async function reportNotices(): Promise<string[]> {
    const rows = await harness.database.db
      .select({ title: notifications.title, userId: notifications.userId })
      .from(notifications);
    const vendorUser = await harness.database.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.clerkUserId, VENDOR));

    return rows
      .filter((row) => row.userId === vendorUser[0]?.id)
      .map((row) => row.title)
      .filter((title) => title === 'A customer reported a problem');
  }

  async function currentBooking(): Promise<typeof bookings.$inferSelect> {
    const [row] = await harness.database.db.select().from(bookings);
    expect(row).toBeDefined();

    return row!;
  }

  /** A published, payout-ready vendor with one package. */
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
      priceCents: PRICE_CENTS,
      priceType: 'fixed',
      durationHours: 6,
      inclusions: ['6 hours'],
    });
    expect(created.statusCode).toBe(201);

    await harness.database.db
      .update(vendorProfiles)
      .set({ isPublished: true, stripeOnboarded: true, stripeAccountId: VENDOR_ACCOUNT })
      .where(eq(vendorProfiles.id, vendorId));

    return { vendorId, packageId: created.json().id };
  }

  /** A paid booking for `EVENT_DATE`, reached the way a customer reaches one. */
  async function paidBooking(): Promise<typeof bookings.$inferSelect> {
    const { vendorId, packageId } = await createVendor();

    const request = await inject('POST', '/booking-requests', CUSTOMER, {
      vendorId,
      packageId,
      eventDate: EVENT_DATE,
      eventType: 'wedding',
      eventLocation: 'Barr Mansion, Austin, TX',
      guestCount: 120,
    });
    expect(request.statusCode).toBe(201);
    const requestId: string = request.json().id;

    expect((await inject('POST', `/booking-requests/${requestId}/accept`, VENDOR)).statusCode).toBe(
      200,
    );

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

    return currentBooking();
  }

  /** A booking whose payout has been released — the far side of the boundary. */
  async function releasedBooking(): Promise<typeof bookings.$inferSelect> {
    await paidBooking();
    clockNow = AFTER_RELEASE;
    expect(await sweep()).toEqual({ released: 1, skipped: 0, failed: 0 });

    return currentBooking();
  }

  beforeAll(async () => {
    harness = await createTestHarness({ clock: () => clockNow });

    for (const [clerkUserId, role, email] of [
      [VENDOR, 'vendor', 'grace@example.com'],
      [CUSTOMER, 'customer', 'alan@example.com'],
      [OUTSIDER, 'customer', 'edsger@example.com'],
      [ADMIN, 'admin', 'ada@example.com'],
    ] as const) {
      harness.clerkUsers.set(clerkUserId, {
        clerkUserId,
        email,
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

  /**
   * `admin` is promoted in the database, because it cannot be reached from
   * inside the product: `normalizeRole` refuses it at sync precisely so the
   * account holder cannot grant it to themselves through Clerk metadata. The
   * users table is wiped after every test, so this runs per test rather than
   * once.
   */
  async function signInAsAdmin(): Promise<void> {
    expect((await inject('GET', '/users/me', ADMIN)).statusCode).toBe(200);
    await harness.database.db
      .update(users)
      .set({ role: 'admin' })
      .where(eq(users.clerkUserId, ADMIN));
  }

  afterEach(async () => {
    clockNow = START;
    harness.stripe.paymentIntents.clear();
    harness.stripe.intentsByKey.clear();
    harness.stripe.refunds.length = 0;
    harness.stripe.transfers.length = 0;
    harness.stripe.reversals.length = 0;
    harness.stripe.transfersToRefuse.clear();
    harness.stripe.failedTransferKeys.clear();
    await harness.database.db.delete(bookings);
    await harness.database.db.delete(conversations);
    await harness.database.db.delete(notifications);
    await harness.database.db.delete(bookingRequests);
    await harness.database.db.delete(availability);
    await harness.database.db.delete(vendorProfiles);
    await harness.database.db.delete(users);
  });

  afterAll(async () => {
    await harness.close();
  });

  beforeAll(() => {
    /*
     * The connected account can actually receive a transfer. Not decoration —
     * the double refuses a transfer to an account without `stripe_transfers`
     * exactly as Stripe does, which is #387's failure: a fixture account every
     * column-shaped check read as payment-capable and Stripe refused outright.
     */
    harness.stripe.accountStatuses.set(VENDOR_ACCOUNT, {
      transfersActive: true,
      payoutsActive: true,
    });
  });

  describe('the charge', () => {
    /* #423 acceptance 1 and 2. */
    it('records the split on the booking and no transfer at all', async () => {
      const booking = await paidBooking();

      expect(booking.totalAmountCents).toBe(PRICE_CENTS);
      expect(booking.platformFeeCents).toBe(PRICE_CENTS - EXPECTED_PAYOUT_CENTS);
      expect(booking.vendorPayoutCents).toBe(EXPECTED_PAYOUT_CENTS);
      expect(booking.stripeTransferId).toBeNull();
      expect(booking.payoutReleasedAt).toBeNull();
      expect(harness.stripe.transfers).toEqual([]);
    });
  });

  describe('the release', () => {
    /* #423 acceptance 3. */
    it('transfers the stored payout once the window has closed', async () => {
      const paid = await paidBooking();
      clockNow = AFTER_RELEASE;

      expect(await sweep()).toEqual({ released: 1, skipped: 0, failed: 0 });

      expect(harness.stripe.transfers).toHaveLength(1);
      expect(harness.stripe.transfers[0]).toMatchObject({
        bookingId: paid.id,
        /*
         * The **stored** figure, not a freshly computed fee. If the release
         * recomputed the split, a rate change would silently reprice every
         * unreleased booking — months of them, at a fee their customers were
         * never quoted.
         */
        amountCents: EXPECTED_PAYOUT_CENTS,
        destinationAccountId: VENDOR_ACCOUNT,
        transferGroup: `booking_${paid.requestId}`,
      });

      const row = await currentBooking();
      expect(row.stripeTransferId).toBe(harness.stripe.transfers[0]!.transferId);
      expect(row.payoutReleasedAt).not.toBeNull();
      expect(row.payoutFailureReason).toBeNull();
    });

    /* #423 acceptance 4. */
    it('leaves a booking inside the window alone', async () => {
      await paidBooking();
      clockNow = JUST_AFTER_EVENT;

      expect(await sweep()).toEqual({ released: 0, skipped: 0, failed: 0 });

      expect(harness.stripe.transfers).toEqual([]);
      expect((await currentBooking()).payoutReleasedAt).toBeNull();
    });

    /**
     * #423 acceptance 5, asserted on the **call count**.
     *
     * A second run that no-ops because the row already changed is not the same
     * as one that never issues the transfer, and only the transfer list can
     * tell them apart — the booking looks identical either way.
     */
    it('transfers once however many times the sweep runs', async () => {
      await paidBooking();
      clockNow = AFTER_RELEASE;

      await sweep();
      await sweep();
      await sweep();

      expect(harness.stripe.transfers).toHaveLength(1);
    });

    /**
     * #423 acceptance 6 — the defining case.
     *
     * `Mark complete` is vendor-only, and the vendor is the party who benefits
     * from pressing it, so it evidences nothing about whether the event
     * happened. A vendor who never presses it must still be paid, or the money
     * is stranded with no owner.
     */
    it('releases a booking the vendor never marked complete', async () => {
      const paid = await paidBooking();
      clockNow = AFTER_RELEASE;

      expect(paid.completedAt).toBeNull();
      expect(await sweep()).toEqual({ released: 1, skipped: 0, failed: 0 });

      expect(harness.stripe.transfers).toHaveLength(1);
      expect((await currentBooking()).completedAt).toBeNull();
    });

    /** And the other direction: marking it complete does not release it early. */
    it('does not release a completed booking before its window closes', async () => {
      const paid = await paidBooking();
      clockNow = JUST_AFTER_EVENT;

      expect((await inject('PUT', `/vendor/bookings/${paid.id}/complete`, VENDOR)).statusCode).toBe(
        200,
      );
      expect((await currentBooking()).status).toBe('completed');

      expect(await sweep()).toEqual({ released: 0, skipped: 0, failed: 0 });
      expect(harness.stripe.transfers).toEqual([]);
    });

    /** A completed booking still releases once the date says so. */
    it('releases a completed booking on the same date as any other', async () => {
      const paid = await paidBooking();
      clockNow = JUST_AFTER_EVENT;
      await inject('PUT', `/vendor/bookings/${paid.id}/complete`, VENDOR);

      clockNow = AFTER_RELEASE;
      expect(await sweep()).toEqual({ released: 1, skipped: 0, failed: 0 });

      expect(harness.stripe.transfers).toHaveLength(1);
    });

    /**
     * #423 acceptance 7. A failed transfer must never be indistinguishable
     * from a completed one, or from one nobody has reached yet.
     */
    it('records a failed transfer and retries it on the next run', async () => {
      const paid = await paidBooking();
      clockNow = AFTER_RELEASE;
      harness.stripe.transfersToRefuse.add(paid.id);

      expect(await sweep()).toEqual({ released: 0, skipped: 0, failed: 1 });

      const failed = await currentBooking();
      expect(failed.payoutReleasedAt).toBeNull();
      expect(failed.stripeTransferId).toBeNull();
      expect(failed.payoutAttempts).toBe(1);
      expect(failed.payoutFailureReason).toContain('refused a transfer');

      harness.stripe.transfersToRefuse.clear();
      expect(await sweep()).toEqual({ released: 1, skipped: 0, failed: 0 });

      const released = await currentBooking();
      expect(released.payoutReleasedAt).not.toBeNull();
      expect(released.payoutFailureReason).toBeNull();
      // The count is kept: a payout that took two goes is worth knowing about.
      expect(released.payoutAttempts).toBe(1);
    });

    /**
     * The retry is a **new request at Stripe**, not a replay of the failure.
     *
     * Found by driving the real gateway rather than by reasoning: the first
     * attempt was refused `balance_insufficient`, and every later attempt came
     * back with the identical error — and the original request's log URL — even
     * once the balance was funded. Stripe caches an idempotent result for 24
     * hours and that includes a failure, so a key fixed at
     * `payout_<bookingId>` froze one transient refusal for a day while the
     * sweep asked for the same cached "no" every quarter of an hour.
     *
     * The double replays a cached failure the same way, so deleting `attempt`
     * from the key turns this red rather than stranding a payout in production.
     */
    it('retries under a fresh idempotency key rather than replaying the failure', async () => {
      const paid = await paidBooking();
      clockNow = AFTER_RELEASE;
      harness.stripe.transfersToRefuse.add(paid.id);
      await sweep();

      harness.stripe.transfersToRefuse.clear();
      expect(await sweep()).toEqual({ released: 1, skipped: 0, failed: 0 });

      expect(harness.stripe.transfers).toHaveLength(1);
      expect(harness.stripe.transfers[0]?.idempotencyKey).toBe(`payout_${paid.id}_1`);
    });

    /**
     * A vendor who cannot receive a transfer is a failure, not a skip. The
     * money is genuinely stuck, the row has to say so, and the sweep has to
     * keep trying so it self-heals when they finish onboarding.
     */
    it('holds the payout and says why when the vendor is not onboarded', async () => {
      const paid = await paidBooking();
      await harness.database.db
        .update(vendorProfiles)
        .set({ stripeOnboarded: false })
        .where(eq(vendorProfiles.id, paid.vendorId));
      clockNow = AFTER_RELEASE;

      expect(await sweep()).toEqual({ released: 0, skipped: 0, failed: 1 });

      expect(harness.stripe.transfers).toEqual([]);
      const row = await currentBooking();
      expect(row.payoutFailureReason).toBe(
        'The vendor is not set up to receive payouts yet, so the transfer could not be made',
      );

      await harness.database.db
        .update(vendorProfiles)
        .set({ stripeOnboarded: true })
        .where(eq(vendorProfiles.id, paid.vendorId));
      expect(await sweep()).toEqual({ released: 1, skipped: 0, failed: 0 });
    });

    /**
     * The 24-hour hole the Stripe idempotency key cannot cover.
     *
     * The transfer goes out inside the transaction that claims the booking, so
     * a commit that never lands leaves the money moved and the row unchanged.
     * Past a day the key has expired and the retry would be a *second* transfer
     * of the vendor's whole share out of the platform balance. Asking Stripe
     * first is what makes that state self-healing.
     */
    it('adopts a transfer that reached Stripe under a transaction that did not commit', async () => {
      const paid = await paidBooking();
      clockNow = AFTER_RELEASE;
      const orphan = await harness.stripe.createTransfer({
        bookingId: 'a-run-whose-commit-was-lost',
        attempt: 0,
        amountCents: EXPECTED_PAYOUT_CENTS,
        destinationAccountId: VENDOR_ACCOUNT,
        transferGroup: `booking_${paid.requestId}`,
      });

      expect(await sweep()).toEqual({ released: 1, skipped: 0, failed: 0 });

      expect(harness.stripe.transfers).toHaveLength(1);
      expect((await currentBooking()).stripeTransferId).toBe(orphan.transferId);
    });

    /**
     * The deploy window, and the demo seed, in one predicate.
     *
     * `payout_model` defaults to `destination` and only `recordSuccessfulPayment`
     * writes `separate`, so a booking written by the **old image** between the
     * migration and the new code serving identifies itself — the backfill cannot
     * reach those rows, because they do not exist when it runs. Without this
     * guard the sweep would transfer a share Stripe had already paid.
     *
     * `seed-demo.ts` is the same shape and the reason this is not theoretical:
     * it writes past-dated `completed` bookings with a fake `tr_demo_…`, and any
     * environment that had run it would have had the sweep chasing every one of
     * them against Stripe every quarter of an hour, forever.
     */
    it('never touches a booking paid under the destination-charge model', async () => {
      const paid = await paidBooking();
      await harness.database.db
        .update(bookings)
        .set({ payoutModel: 'destination' })
        .where(eq(bookings.id, paid.id));
      clockNow = AFTER_RELEASE;

      expect(await sweep()).toEqual({ released: 0, skipped: 0, failed: 0 });
      expect(harness.stripe.transfers).toEqual([]);
    });

    it('never touches a cancelled booking', async () => {
      const paid = await paidBooking();
      await inject('PUT', `/customer/bookings/${paid.id}/cancel`, CUSTOMER, {});
      clockNow = AFTER_RELEASE;

      expect(await sweep()).toEqual({ released: 0, skipped: 0, failed: 0 });
      expect(harness.stripe.transfers).toEqual([]);
    });
  });

  describe('the dispute hold', () => {
    /* #423 acceptance 8. */
    it('lets the customer report a problem on an unreleased past booking', async () => {
      const paid = await paidBooking();
      clockNow = JUST_AFTER_EVENT;

      const response = await report(paid.id, CUSTOMER, 'The photographer never arrived.');

      expect(response.statusCode).toBe(200);

      const row = await currentBooking();
      expect(row.status).toBe('disputed');
      expect(row.disputeReason).toBe('The photographer never arrived.');
    });

    it('refuses a report before the event, where cancelling is the right move', async () => {
      const paid = await paidBooking();

      const response = await report(paid.id, CUSTOMER);

      expect(response.statusCode).toBe(409);
      expect(response.json().message).toBe(
        'That event has not happened yet — cancel the booking instead',
      );
    });

    it('refuses the vendor reporting a problem with their own booking', async () => {
      const paid = await paidBooking();
      clockNow = JUST_AFTER_EVENT;

      expect((await report(paid.id, VENDOR)).statusCode).toBe(403);
    });

    /* A stranger walking ids learns nothing about which of them exist. */
    it('answers 404 to somebody who is not a party to the booking', async () => {
      const paid = await paidBooking();
      clockNow = JUST_AFTER_EVENT;

      expect((await report(paid.id, OUTSIDER)).statusCode).toBe(404);
    });

    /* #423 acceptance 9 — and with no time limit that would release it. */
    it('skips a disputed booking for as long as it is disputed', async () => {
      const paid = await paidBooking();
      clockNow = JUST_AFTER_EVENT;
      await report(paid.id, CUSTOMER);

      clockNow = AFTER_RELEASE;
      expect(await sweep()).toEqual({ released: 0, skipped: 0, failed: 0 });
      // A year on, and still held. There is no window that expires a complaint
      // out from under the person who made it.
      expect(await sweep(addDays(START, 400))).toEqual({ released: 0, skipped: 0, failed: 0 });

      expect(harness.stripe.transfers).toEqual([]);
    });

    /* #423 acceptance 10, the vendor's side. */
    it('releases on the next run once a dispute is resolved for the vendor', async () => {
      const paid = await paidBooking();
      clockNow = JUST_AFTER_EVENT;
      await report(paid.id, CUSTOMER);
      clockNow = AFTER_RELEASE;

      await signInAsAdmin();
      const resolved = await inject('PUT', `/admin/bookings/${paid.id}/dispute`, ADMIN, {
        outcome: 'vendor',
      });

      expect(resolved.statusCode).toBe(200);
      expect(resolved.json().status).toBe('confirmed');
      // The hold is `status` alone, and the customer's words go with it.
      const lifted = await currentBooking();
      expect(lifted.disputeReason).toBeNull();

      expect(await sweep()).toEqual({ released: 1, skipped: 0, failed: 0 });
      expect(harness.stripe.transfers).toHaveLength(1);
    });

    /**
     * The prior status is read off `completed_at` rather than remembered, so a
     * vendor who had marked the booking complete gets that status back rather
     * than being silently demoted to `confirmed`.
     */
    it('restores a completed booking to completed, not to confirmed', async () => {
      const paid = await paidBooking();
      clockNow = JUST_AFTER_EVENT;
      await inject('PUT', `/vendor/bookings/${paid.id}/complete`, VENDOR);
      await report(paid.id, CUSTOMER);

      await signInAsAdmin();
      const resolved = await inject('PUT', `/admin/bookings/${paid.id}/dispute`, ADMIN, {
        outcome: 'vendor',
      });

      expect(resolved.json().status).toBe('completed');
    });

    /* #423 acceptance 10, the customer's side. */
    it('refunds in full and transfers nothing when the report is upheld', async () => {
      const paid = await paidBooking();
      clockNow = JUST_AFTER_EVENT;
      await report(paid.id, CUSTOMER);
      clockNow = AFTER_RELEASE;

      await signInAsAdmin();
      const resolved = await inject('PUT', `/admin/bookings/${paid.id}/dispute`, ADMIN, {
        outcome: 'customer',
      });

      expect(resolved.statusCode).toBe(200);
      expect(resolved.json().status).toBe('cancelled');
      /*
       * In full, not on D3's tiers. Those price a customer changing their mind
       * against how much notice they gave; this is an operator's ruling that
       * the service was not delivered, and the event being two days ago is not
       * the customer's lateness.
       */
      expect(harness.stripe.refunds).toHaveLength(1);
      expect(harness.stripe.refunds[0]).toMatchObject({
        amountCents: PRICE_CENTS,
        reverseTransfer: false,
        refundApplicationFee: false,
      });
      // Nothing was ever transferred, so nothing is reversed and no vendor
      // balance is touched — the whole benefit of holding the money.
      expect(harness.stripe.transfers).toEqual([]);
      expect(harness.stripe.reversals).toEqual([]);

      const row = await currentBooking();
      expect(row.cancelledBy).toBe('admin');
      expect(row.refundAmountCents).toBe(PRICE_CENTS);

      // And the sweep never pays it afterwards.
      expect(await sweep()).toEqual({ released: 0, skipped: 0, failed: 0 });
    });

    it('refuses a resolution on a booking with no open report', async () => {
      const paid = await paidBooking();

      await signInAsAdmin();
      const response = await inject('PUT', `/admin/bookings/${paid.id}/dispute`, ADMIN, {
        outcome: 'vendor',
      });

      expect(response.statusCode).toBe(409);
      expect(response.json().message).toBe('That booking has no open report to resolve');
    });

    /**
     * #423 acceptance 11, and the ruling it asked for: **refused**.
     *
     * Routing it into the post-release refund path would let a self-serve
     * button claw a third party's balance negative on one party's say-so, which
     * is an operator's judgement rather than a customer's. Support can still
     * unwind it, and the message says so.
     */
    it('refuses a report on a booking that has already been paid out', async () => {
      const released = await releasedBooking();

      const response = await report(released.id, CUSTOMER);

      expect(response.statusCode).toBe(409);
      expect(response.json().message).toBe(
        'This booking has already been paid out, so it cannot be put on hold. ' +
          'Contact support and we will look into it.',
      );
      expect((await currentBooking()).status).toBe('confirmed');
    });

    it('refuses a second report on a booking already under one', async () => {
      const paid = await paidBooking();
      clockNow = JUST_AFTER_EVENT;
      await report(paid.id, CUSTOMER);

      const response = await report(paid.id, CUSTOMER);

      expect(response.statusCode).toBe(409);
      expect(response.json().message).toBe('You have already reported a problem with this booking');
    });

    /* The hold is real on the vendor's side too: they cannot complete out of it. */
    it('tells the vendor a disputed booking is on hold rather than calling it cancelled', async () => {
      const paid = await paidBooking();
      clockNow = JUST_AFTER_EVENT;
      await report(paid.id, CUSTOMER);

      const response = await inject('PUT', `/vendor/bookings/${paid.id}/complete`, VENDOR);

      expect(response.statusCode).toBe(409);
      expect(response.json().message).toBe(
        'The customer has raised a problem with this booking, so it is on hold until that is resolved',
      );
    });
  });

  /**
   * #425 — the customer's way into the hold above, and the reason it is not
   * only a link.
   *
   * The report is submitted through `/support/messages`, which is the screen
   * frame `29` draws and the one #421 already built the prefill for. Carrying a
   * `bookingId` is what makes that send more than an email: it places the hold
   * in the same request, and **the two land together or neither does**.
   */
  describe('the report that places the hold', () => {
    /*
     * The recorder is not cleared between cases in this file, and every case
     * here asserts on whether a support message exists — so a leftover from the
     * case before would answer for this one.
     */
    beforeEach(() => {
      harness.email.sent.length = 0;
    });

    /* Acceptance 4 and 7: both writes, and an email a human can act on. */
    it('sends the report and holds the payout in one request', async () => {
      const paid = await paidBooking();
      clockNow = JUST_AFTER_EVENT;

      const response = await report(paid.id, CUSTOMER);
      await harness.flushEmail();

      /* The vendor is told, once the report has actually gone. */
      expect(await reportNotices()).toEqual(['A customer reported a problem']);

      expect(response.statusCode).toBe(200);
      expect(response.json().reference).toMatch(SUPPORT_REFERENCE_PATTERN);

      const row = await currentBooking();
      expect(row.status).toBe('disputed');
      expect(row.disputeReason).toBe(REPORT);

      const sent = reportEmail();
      expect(sent).toBeDefined();
      // The booking, so a human can act without asking which one it was.
      expect(sent!.text).toContain(paid.id);
      expect(sent!.text).toContain('Payout held on this booking');
      expect(sent!.text).toContain(REPORT);
      expect(sent!.subject).toContain(SUPPORT_TOPIC_LABELS['booking-or-payment']);
    });

    /**
     * The first end of acceptance 4. A mail service that refused the report
     * must not leave the booking frozen with nothing to explain why it is:
     * `disputed` with no complaint behind it is a payout stopped by a bug.
     */
    it('leaves no hold behind when the report cannot be sent', async () => {
      const paid = await paidBooking();
      clockNow = JUST_AFTER_EVENT;
      harness.email.failNext = true;

      const response = await report(paid.id, CUSTOMER);
      await harness.flushEmail();

      expect(response.statusCode).toBe(502);

      const row = await currentBooking();
      expect(row.status).toBe('confirmed');
      expect(row.disputeReason).toBeNull();
      expect(reportEmail()).toBeUndefined();

      /*
       * And the vendor was never told. The notice comes after the send for this
       * reason and no other: one alarmed about a payout freeze that was
       * withdrawn before they read it has been told something that is not true.
       */
      expect(await reportNotices()).toEqual([]);

      // And the money is free to move again, which is the fact that matters.
      clockNow = AFTER_RELEASE;
      expect(await sweep()).toEqual({ released: 1, skipped: 0, failed: 0 });
    });

    /**
     * The other end. A refused hold must not put a message in the inbox saying
     * a report was filed — the reader would act on a complaint against a
     * booking whose money is still running.
     */
    it('sends nothing when the hold is refused', async () => {
      const paid = await paidBooking();

      // Before the event: `placeDisputeHold` refuses, and it refuses first.
      const response = await report(paid.id, CUSTOMER);
      await harness.flushEmail();

      expect(response.statusCode).toBe(409);
      expect(response.json().message).toBe(
        'That event has not happened yet — cancel the booking instead',
      );
      expect((await currentBooking()).status).toBe('confirmed');
      expect(reportEmail()).toBeUndefined();
    });

    /**
     * The unwind lifts **its own** hold, and not whichever one is current.
     *
     * The interleaving a status-only guard loses: a report's mail send stalls,
     * an operator resolves that complaint, the customer files a second report
     * that lands — and only then does the first send fail. Compensating on
     * `status = 'disputed'` alone would lift the *second* hold, releasing a
     * payout against a complaint already in the support inbox and clearing the
     * text that explained it.
     *
     * Driven at the service boundary rather than through two overlapping HTTP
     * requests: what has to be pinned is which row the lift matches, and a
     * fixture that has to win a race to express that is a fixture that will
     * pass when the guard is gone.
     */
    it('refuses to lift a hold that is no longer the one it placed', async () => {
      const paid = await paidBooking();
      clockNow = JUST_AFTER_EVENT;
      await signInAsAdmin();

      expect((await report(paid.id, CUSTOMER, 'The first report.')).statusCode).toBe(200);
      const first = await currentBooking();
      expect(first.status).toBe('disputed');

      /* The operator settles it, and the customer reports again. */
      expect(
        (await inject('PUT', `/admin/bookings/${paid.id}/dispute`, ADMIN, { outcome: 'vendor' }))
          .statusCode,
      ).toBe(200);
      expect((await report(paid.id, CUSTOMER, 'The second report.')).statusCode).toBe(200);

      const second = await currentBooking();
      expect(second.status).toBe('disputed');
      expect(second.updatedAt).not.toEqual(first.updatedAt);

      const context = {
        db: harness.database.db,
        stripe: harness.stripe,
        hub: harness.app.events,
        log: harness.app.log,
        mail: {
          db: harness.database.db,
          email: harness.email,
          log: harness.app.log,
          webOrigin: 'http://localhost:3000',
          background: harness.app.background,
        },
      };

      /* The first report's late unwind finds a row it did not write, and stops. */
      expect(await liftDisputeHold(context, first, first.updatedAt)).toBeNull();

      const after = await currentBooking();
      expect(after.status).toBe('disputed');
      expect(after.disputeReason).toBe('The second report.');

      /* And the money is still held, which is the fact that matters. */
      clockNow = AFTER_RELEASE;
      expect(await sweep()).toEqual({ released: 0, skipped: 0, failed: 0 });

      /* The hold that *is* current still lifts, so the guard is not a wall. */
      expect(await liftDisputeHold(context, second, second.updatedAt)).not.toBeNull();
      expect((await currentBooking()).status).toBe('confirmed');
    });

    /* Acceptance 5: one open report, not two. */
    it('refuses a second report while one is open, and sends no second message', async () => {
      const paid = await paidBooking();
      clockNow = JUST_AFTER_EVENT;
      expect((await report(paid.id, CUSTOMER)).statusCode).toBe(200);
      await harness.flushEmail();
      harness.email.sent.length = 0;

      const response = await report(paid.id, CUSTOMER);
      await harness.flushEmail();

      expect(response.statusCode).toBe(409);
      expect(response.json().message).toBe('You have already reported a problem with this booking');
      expect(reportEmail()).toBeUndefined();
    });

    /* Acceptance 2, the far bound: the money is gone, so a hold cannot hold. */
    it('refuses a report once the payout has been released', async () => {
      const released = await releasedBooking();

      const response = await report(released.id, CUSTOMER);
      await harness.flushEmail();

      expect(response.statusCode).toBe(409);
      expect((await currentBooking()).status).toBe('confirmed');
      expect(reportEmail()).toBeUndefined();
    });

    /**
     * Acceptance 1 and 6, one case per role.
     *
     * A vendor is refused on the booking they are the vendor on — 403, because
     * `participantIn` already placed them on it and pretending otherwise would
     * be a lie they can disprove. Everybody else gets 404: whether a booking
     * exists is not something a stranger learns by walking ids. **None of them
     * puts an email in the inbox**, which is the half a status code alone would
     * not catch.
     */
    it.each([
      ['the vendor on the booking', () => VENDOR, 403],
      ['another customer', () => OUTSIDER, 404],
      ['an admin', () => ADMIN, 404],
    ])('refuses a report from %s', async (_who, actor, expected) => {
      const paid = await paidBooking();
      clockNow = JUST_AFTER_EVENT;
      if (expected === 404 && actor() === ADMIN) {
        await signInAsAdmin();
      }

      const response = await report(paid.id, actor());
      await harness.flushEmail();

      expect(response.statusCode).toBe(expected);
      expect((await currentBooking()).status).toBe('confirmed');
      expect(reportEmail()).toBeUndefined();
    });

    /**
     * Signed out, which only this route can be asked: `/support/messages` is
     * public by design — the visitor most likely to need it is the one who
     * cannot get in — so a booking report is the one payload on it that has to
     * insist on a session.
     */
    it('refuses a booking report from a signed-out visitor', async () => {
      const paid = await paidBooking();
      clockNow = JUST_AFTER_EVENT;

      const response = await inject('POST', '/support/messages', null, {
        topic: 'booking-or-payment',
        email: 'stranger@example.com',
        message: REPORT,
        bookingId: paid.id,
      });
      await harness.flushEmail();

      expect(response.statusCode).toBe(401);
      expect((await currentBooking()).status).toBe('confirmed');
      expect(reportEmail()).toBeUndefined();
    });

    /**
     * The read the report surface makes before it offers anything (#425).
     *
     * Same ownership rule as the send it precedes, and the same 404 for
     * everybody else — a stranger walking ids learns nothing, and the vendor is
     * not handed a control that is the customer's.
     */
    describe('the booking the surface reads', () => {
      it('answers the customer with the booking, and the release column', async () => {
        const paid = await paidBooking();

        const response = await inject('GET', `/customer/bookings/${paid.id}`, CUSTOMER);

        expect(response.statusCode).toBe(200);
        expect(response.json()).toMatchObject({
          id: paid.id,
          status: 'confirmed',
          eventDate: EVENT_DATE,
          totalAmountCents: PRICE_CENTS,
          payoutReleasedAt: null,
        });
        /* The split and the Stripe ids stay out of it (#407). */
        expect(response.payload).not.toContain(String(EXPECTED_PAYOUT_CENTS));
      });

      /*
       * The whole point of shipping the column: the surface can tell "the sweep
       * may run" from "the money has gone", and only the second shuts the door.
       */
      it('reports the release once the sweep has actually moved the money', async () => {
        const released = await releasedBooking();

        const response = await inject('GET', `/customer/bookings/${released.id}`, CUSTOMER);

        expect(response.statusCode).toBe(200);
        expect(response.json().payoutReleasedAt).not.toBeNull();
      });

      it.each([
        ['the vendor on the booking', () => VENDOR],
        ['another customer', () => OUTSIDER],
      ])('answers 404 to %s', async (_who, actor) => {
        const paid = await paidBooking();

        expect((await inject('GET', `/customer/bookings/${paid.id}`, actor())).statusCode).toBe(
          404,
        );
      });

      it('answers 401 to a signed-out visitor', async () => {
        const paid = await paidBooking();

        expect((await inject('GET', `/customer/bookings/${paid.id}`, null)).statusCode).toBe(401);
      });
    });

    /**
     * The loop closes. This is the assertion the whole ticket is for: a report
     * that does not stop the money is the only way it can fail silently.
     */
    it('stops the release sweep on the booking it held', async () => {
      const paid = await paidBooking();
      clockNow = JUST_AFTER_EVENT;
      expect((await report(paid.id, CUSTOMER)).statusCode).toBe(200);

      clockNow = AFTER_RELEASE;
      expect(await sweep()).toEqual({ released: 0, skipped: 0, failed: 0 });
      expect(harness.stripe.transfers).toEqual([]);
      expect((await currentBooking()).payoutReleasedAt).toBeNull();
    });
  });

  describe('the refund boundary', () => {
    /* #423 acceptance 13. */
    it('reverses the vendor transfer when a released booking is cancelled', async () => {
      const released = await releasedBooking();
      const transferId = harness.stripe.transfers[0]!.transferId;

      const response = await inject(
        'PUT',
        `/customer/bookings/${released.id}/cancel`,
        CUSTOMER,
        {},
      );

      expect(response.statusCode).toBe(200);
      /*
       * The event is past, so D3's second tier applies: half the total comes
       * back to the customer, and the vendor gives back the same proportion of
       * their payout. Orla keeps half its commission, and the three shares sum
       * back exactly.
       */
      expect(response.json().refundCents).toBe(PRICE_CENTS / 2);
      expect(harness.stripe.refunds).toHaveLength(1);
      expect(harness.stripe.refunds[0]).toMatchObject({
        amountCents: PRICE_CENTS / 2,
        // Never on the refund. The charge is a plain one into the platform
        // balance, and Stripe refuses `reverse_transfer` on a charge with no
        // transfer — the reversal is its own call against the transfer object.
        reverseTransfer: false,
        refundApplicationFee: false,
      });
      expect(harness.stripe.reversals).toHaveLength(1);
      expect(harness.stripe.reversals[0]).toMatchObject({
        transferId,
        amountCents: EXPECTED_PAYOUT_CENTS / 2,
      });
    });

    /* #423 acceptance 12, stated against the reversal list rather than a flag. */
    it('reverses nothing when an unreleased booking is cancelled', async () => {
      const paid = await paidBooking();

      expect(
        (await inject('PUT', `/customer/bookings/${paid.id}/cancel`, CUSTOMER, {})).statusCode,
      ).toBe(200);

      expect(harness.stripe.refunds).toHaveLength(1);
      expect(harness.stripe.reversals).toEqual([]);
      expect(harness.stripe.transfers).toEqual([]);
    });

    /**
     * #423 acceptance 14, and the half that nearly shipped inverted.
     *
     * Inside D3's 48-hour cutoff half the total comes back and the vendor keeps
     * the same proportion of their share — "the split survives the 50% tier"
     * (D31). Under the destination charge that needed no code: the money was
     * already in the vendor's balance and Stripe reversed only the refunded
     * part. Under separate charges **nobody holds that share but Orla**, and a
     * cancelled booking is one the sweep ignores — so writing the residual down
     * is the whole of the difference between the vendor being paid and the
     * platform quietly keeping it.
     */
    it('still owes the vendor their share after a late cancellation, and pays it', async () => {
      const paid = await paidBooking();
      // Inside the cutoff: the event is tomorrow.
      clockNow = addDays(new Date(`${EVENT_DATE}T00:00:00Z`), -1);

      const response = await inject('PUT', `/customer/bookings/${paid.id}/cancel`, CUSTOMER, {});

      expect(response.statusCode).toBe(200);
      expect(response.json().refundCents).toBe(PRICE_CENTS / 2);
      expect(harness.stripe.reversals).toEqual([]);

      const cancelled = await currentBooking();
      expect(cancelled.status).toBe('cancelled');
      expect(cancelled.vendorPayoutCents).toBe(EXPECTED_PAYOUT_CENTS / 2);

      // And the sweep pays that residual on the original schedule.
      clockNow = AFTER_RELEASE;
      expect(await sweep()).toEqual({ released: 1, skipped: 0, failed: 0 });
      expect(harness.stripe.transfers).toHaveLength(1);
      expect(harness.stripe.transfers[0]?.amountCents).toBe(EXPECTED_PAYOUT_CENTS / 2);
    });

    /* A full refund leaves nothing owed, and the sweep must never pay it. */
    it('owes the vendor nothing after a full refund', async () => {
      const paid = await paidBooking();

      await inject('PUT', `/customer/bookings/${paid.id}/cancel`, CUSTOMER, {});

      expect((await currentBooking()).vendorPayoutCents).toBe(0);

      clockNow = AFTER_RELEASE;
      expect(await sweep()).toEqual({ released: 0, skipped: 0, failed: 0 });
      expect(harness.stripe.transfers).toEqual([]);
    });

    /**
     * Past Stripe's 24-hour idempotency window, a repeated cancellation is a
     * *fresh* reversal request — and Stripe refuses an over-reversal, which
     * would then wedge the booking: refunded, uncancellable, still holding the
     * date. `reverseOutstanding` asks what is already reversed, exactly as
     * `findRefund` asks what is already refunded.
     */
    it('does not reverse twice when a released cancellation is retried', async () => {
      const released = await releasedBooking();
      await inject('PUT', `/customer/bookings/${released.id}/cancel`, CUSTOMER, {});
      expect(harness.stripe.reversals).toHaveLength(1);

      // The state a failed row write leaves: money moved, booking still live.
      await harness.database.db
        .update(bookings)
        .set({ status: 'confirmed', cancelledAt: null, refundAmountCents: null })
        .where(eq(bookings.id, released.id));
      // ...and the key Stripe has since forgotten.
      harness.stripe.reversals.length = 0;

      const retry = await inject('PUT', `/customer/bookings/${released.id}/cancel`, CUSTOMER, {});

      expect(retry.statusCode).toBe(200);
      // No second reversal: the transfer is already fully reversed.
      expect(harness.stripe.reversals).toEqual([]);
      expect((await currentBooking()).status).toBe('cancelled');
    });

    /* #423 acceptance 14 — `refundAmountCents` records what actually moved. */
    it('records the amount that moved on both sides of the boundary', async () => {
      const released = await releasedBooking();
      await inject('PUT', `/customer/bookings/${released.id}/cancel`, CUSTOMER, {});

      expect((await currentBooking()).refundAmountCents).toBe(PRICE_CENTS / 2);
    });

    /**
     * The vendor is told the truth about their own balance, and which sentence
     * they get is a money claim rather than a copy choice.
     */
    it('names the reversal to the vendor only when there is one', async () => {
      const released = await releasedBooking();
      await inject('PUT', `/customer/bookings/${released.id}/cancel`, CUSTOMER, {});

      const rows = await harness.database.db
        .select()
        .from(notifications)
        .where(eq(notifications.type, 'booking_cancelled'));

      expect(rows).toHaveLength(1);
      expect(rows[0]?.body).toBe(
        'The date is free again on your calendar. Their refund takes back the same share of ' +
          'your payout, out of your Stripe balance — which can leave it negative, because this ' +
          'booking had already been paid out.',
      );
    });
  });

  describe('what the vendor dashboard can read', () => {
    /* #423 acceptance 15. */
    it('names the stored amount and the release date the sweep will pay on', async () => {
      await paidBooking();

      const response = await inject('GET', '/vendor/dashboard', VENDOR);

      expect(response.statusCode).toBe(200);
      const { next, pendingCents } = response.json().payouts;
      expect(next).toMatchObject({
        // The stored figure, not a recomputed fee.
        cents: EXPECTED_PAYOUT_CENTS,
        isDue: false,
      });
      // One owed booking, so the next payout and the total are the same money.
      expect(pendingCents).toBe(EXPECTED_PAYOUT_CENTS);
      /*
       * The same helper the sweep pays on, so the date a vendor is shown and
       * the date they are paid cannot drift. The suite derives it rather than
       * hard-coding a day, because a hard-coded one would keep passing if the
       * two ever came apart.
       */
      expect(new Date(next.releaseAt as string).toISOString()).toBe(
        payoutReleaseAt(EVENT_DATE)!.toISOString(),
      );
    });

    /**
     * #423 acceptance 16 — held is distinguishable from pending, in the data.
     *
     * **#424 moved where that distinction is stated.** It was a `status` field
     * on the one booking the dashboard named, which left the surface reading it
     * to decide what to draw; it is now two figures the server has already
     * split with `payoutStatusOf`, so held money is reported as held money and
     * cannot be mistaken for a payout on its way. The acceptance is the same
     * and this asserts it in the shape that shipped.
     */
    it('says a payout is held rather than pending while a report is open', async () => {
      const paid = await paidBooking();
      clockNow = JUST_AFTER_EVENT;
      await report(paid.id, CUSTOMER);

      const { payouts } = (await inject('GET', '/vendor/dashboard', VENDOR)).json();

      expect(payouts.heldCents).toBe(EXPECTED_PAYOUT_CENTS);
      expect(payouts.heldCount).toBe(1);
      // Held money is owed, but it is not on its way and it has no date.
      expect(payouts.pendingCents).toBe(0);
      expect(payouts.next).toBeNull();
    });

    /**
     * A completed booking is still an owed payout, which it was not under the
     * destination charge — the vendor pressing `Mark complete` moves no money
     * now, so hiding it would show nothing where a transfer is due.
     */
    it('still names a completed booking whose payout has not gone out', async () => {
      const paid = await paidBooking();
      clockNow = JUST_AFTER_EVENT;
      await inject('PUT', `/vendor/bookings/${paid.id}/complete`, VENDOR);

      expect((await inject('GET', '/vendor/dashboard', VENDOR)).json().payouts).toMatchObject({
        pendingCents: EXPECTED_PAYOUT_CENTS,
        pendingCount: 1,
        heldCents: 0,
      });
    });

    it('names nothing once the payout has gone out', async () => {
      await releasedBooking();

      const { payouts } = (await inject('GET', '/vendor/dashboard', VENDOR)).json();
      expect(payouts.next).toBeNull();
      expect(payouts.pendingCents).toBe(0);
    });
  });
});
