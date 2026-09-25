import { setUserRole } from '../../testing/set-user-role.js';
import {
  adminActions,
  availability,
  bookingRequests,
  bookings,
  categories,
  conversations,
  notifications,
  adminAlerts,
  supportCases,
  users,
  vendorProfiles,
} from '@vendor-marketplace/db/schema';
import {
  addDays,
  CURRENT_VENDOR_AGREEMENT_VERSION,
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
import { lowerReleasedVendorPayout } from './payments.dao.js';
import { liftDisputeHold } from './payments.service.js';
import { releaseDuePayouts, retryPayoutRelease } from './payouts.service.js';

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
      {
        db: harness.database.db,
        stripe: harness.stripe,
        log: harness.app.log,
        notify: {
          hub: harness.app.events,
          mail: {
            db: harness.database.db,
            email: harness.app.email,
            log: harness.app.log,
            webOrigin: 'https://web.test',
            background: harness.app.background,
          },
        },
      },
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
   * payout without filing a complaint would leave an admin a hold with
   * nothing to act on, which is the half of acceptance 4 a second route made
   * reachable.
   */
  async function report(
    bookingId: string,
    actor: string | null,
    message = REPORT,
  ): Promise<Awaited<ReturnType<TestHarness['app']['inject']>>> {
    return inject('POST', '/v1/support/messages', actor, {
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
      .where(eq(users.authUserId, VENDOR));

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
    const profile = await inject('POST', '/v1/vendor/profile', VENDOR, {
      businessName: 'Sunlit Studio',
      categoryIds: [photographyId],
      city: 'Austin',
      state: 'TX',
      bio: 'Documentary wedding photography for people who hate posing.',
    });
    expect(profile.statusCode).toBe(201);
    const vendorId: string = profile.json().id;

    const created = await inject('POST', '/v1/vendor/packages', VENDOR, {
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

    /*
     * A vendor cannot take payment until they hold the current vendor
     * agreement (#427), so a fixture that skips this is a vendor checkout
     * correctly refuses. Accepted through the real route rather than inserted,
     * because that is how a vendor reaches this state.
     */
    const accepted = await inject('POST', '/v1/vendor/agreement/accept', VENDOR, {
      version: CURRENT_VENDOR_AGREEMENT_VERSION,
    });
    expect(accepted.statusCode).toBe(200);

    return { vendorId, packageId: created.json().id };
  }

  /** A paid booking for `EVENT_DATE`, reached the way a customer reaches one. */
  async function paidBooking(): Promise<typeof bookings.$inferSelect> {
    const { vendorId, packageId } = await createVendor();

    return paidBookingFor(vendorId, packageId, EVENT_DATE);
  }

  /** A paid booking with an existing vendor, for a second date. */
  async function paidBookingFor(
    vendorId: string,
    packageId: string,
    eventDate: string,
  ): Promise<typeof bookings.$inferSelect> {
    const request = await inject('POST', '/v1/booking-requests', CUSTOMER, {
      vendorId,
      packageId,
      eventDate,
      eventType: 'wedding',
      eventLocation: 'Barr Mansion, Austin, TX',
      guestCount: 120,
    });
    expect(request.statusCode).toBe(201);
    const requestId: string = request.json().id;

    expect(
      (await inject('POST', `/v1/booking-requests/${requestId}/accept`, VENDOR)).statusCode,
    ).toBe(200);

    const checkout = await inject(
      'POST',
      `/v1/customer/booking-requests/${requestId}/checkout`,
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

    const [row] = await harness.database.db
      .select()
      .from(bookings)
      .where(eq(bookings.requestId, requestId));
    expect(row).toBeDefined();

    return row!;
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

    for (const [authUserId, role, email] of [
      [VENDOR, 'vendor', 'grace@example.com'],
      [CUSTOMER, 'customer', 'alan@example.com'],
      [OUTSIDER, 'customer', 'edsger@example.com'],
      [ADMIN, 'admin', 'ada@example.com'],
    ] as const) {
      harness.authUsers.set(authUserId, {
        authUserId,
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
   * account holder cannot grant it to themselves through auth metadata. The
   * users table is wiped after every test, so this runs per test rather than
   * once.
   */
  /** Returns the admin's own id, which #434's action rows are keyed by. */
  async function signInAsAdmin(): Promise<string> {
    expect((await inject('GET', '/v1/users/me', ADMIN)).statusCode).toBe(200);
    await setUserRole(harness.database.db, 'admin', eq(users.authUserId, ADMIN));

    const rows = await harness.database.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.authUserId, ADMIN))
      .limit(1);

    return rows[0]!.id;
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
    harness.email.sent.length = 0;
    await harness.database.db.delete(adminAlerts);
    await harness.database.db.delete(supportCases);
    await harness.database.db.delete(bookings);
    await harness.database.db.delete(conversations);
    await harness.database.db.delete(notifications);
    await harness.database.db.delete(bookingRequests);
    await harness.database.db.delete(availability);
    await harness.database.db.delete(vendorProfiles);
    /*
     * `admin_actions` refuses a direct DELETE while the admin it names still
     * exists (#434), and lets the cascade through when the account itself is
     * erased — so this line is what clears the log between tests.
     */
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

  /* #432 acceptance 3 — the admin retry and everything it refuses. */
  describe('the admin retry', () => {
    /** The retry, driven the way the admin route drives it. */
    async function retry(bookingId: string, now: Date = clockNow) {
      return retryPayoutRelease(
        { db: harness.database.db, stripe: harness.stripe, log: harness.app.log },
        bookingId,
        now,
      );
    }

    /**
     * **The D36 regression, and the only test that can see it.**
     *
     * The first attempt is refused and the double caches that refusal under its
     * key exactly as Stripe does. A retry that reused `payout_<bookingId>_0`
     * would be answered from that cache — the same error, forever, with the
     * original request's log URL — and the admin would press the button and
     * learn nothing. A test that only asserts the happy retry cannot tell the
     * two apart, which is how this shipped in the first place.
     */
    it('mints a key versioned by the attempt rather than replaying the cached failure', async () => {
      const paid = await paidBooking();
      clockNow = AFTER_RELEASE;
      harness.stripe.transfersToRefuse.add(paid.id);
      expect(await sweep()).toEqual({ released: 0, skipped: 0, failed: 1 });

      harness.stripe.transfersToRefuse.clear();
      const result = await retry(paid.id);

      expect(result.outcome).toBe('released');
      expect(result.payoutFailureReason).toBeNull();
      expect(result.stripeTransferId).not.toBeNull();
      expect(harness.stripe.transfers).toHaveLength(1);
      expect(harness.stripe.transfers[0]?.idempotencyKey).toBe(`payout_${paid.id}_1`);
    });

    /** A retry that fails again counts the attempt and reports today's reason. */
    it('records the new attempt and returns the reason when it fails again', async () => {
      const paid = await paidBooking();
      clockNow = AFTER_RELEASE;
      harness.stripe.transfersToRefuse.add(paid.id);
      await sweep();

      const result = await retry(paid.id);

      expect(result.outcome).toBe('failed');
      expect(result.payoutAttempts).toBe(2);
      expect(result.payoutFailureReason).toContain('refused a transfer');
      expect(result.payoutReleasedAt).toBeNull();
      expect(harness.stripe.transfers).toEqual([]);
    });

    /**
     * `PayoutContext.alerts` is documented as the sweep's alone — the admin
     * pressing Retry is already looking at the result. The admin route built its
     * context from `bookingContextFor`, which always carries the pager, so the
     * third failure paged the person who had just caused it.
     */
    it('does not page the admin for their own failed retry, and still pages for the sweep', async () => {
      await signInAsAdmin();
      const paid = await paidBooking();
      clockNow = AFTER_RELEASE;
      harness.stripe.transfersToRefuse.add(paid.id);
      const sweepWithPager = () =>
        releaseDuePayouts(
          {
            db: harness.database.db,
            stripe: harness.stripe,
            log: harness.app.log,
            alerts: harness.app.adminAlerts,
          },
          clockNow,
        );
      const adminMail = (): EmailMessage[] =>
        harness.email.sent.filter((message) => message.to === TEST_ENV.ADMIN_ALERT_EMAIL);

      await sweepWithPager();
      await sweepWithPager();
      await harness.flushEmail();
      expect(adminMail()).toEqual([]);

      const retried = await inject('PUT', `/v1/admin/bookings/${paid.id}/payout/retry`, ADMIN);
      await harness.flushEmail();

      expect(retried.statusCode).toBe(200);
      expect(retried.json().outcome).toBe('failed');
      expect(retried.json().payoutAttempts).toBe(3);
      expect(adminMail()).toEqual([]);
      expect(await harness.database.db.select().from(adminAlerts)).toEqual([]);

      await sweepWithPager();
      await harness.flushEmail();

      expect(adminMail().map((message) => message.subject)).toEqual([
        `[Orla ops] Payout failed 4 times on booking ${paid.id}`,
      ]);
    });

    it('refuses a payout that has already been released, and says so', async () => {
      const paid = await paidBooking();
      clockNow = AFTER_RELEASE;
      expect(await sweep()).toEqual({ released: 1, skipped: 0, failed: 0 });

      await expect(retry(paid.id)).rejects.toThrow('This payout was already released.');
    });

    it('refuses a payout held by a reported problem, and says so', async () => {
      const paid = await paidBooking();
      clockNow = JUST_AFTER_EVENT;
      expect((await report(paid.id, CUSTOMER)).statusCode).toBe(200);
      clockNow = AFTER_RELEASE;

      await expect(retry(paid.id)).rejects.toThrow(
        'This payout is on hold while the reported problem is being resolved',
      );
      expect(harness.stripe.transfers).toEqual([]);
    });

    it('refuses a cancelled booking, and says the sweep owns the residual', async () => {
      const paid = await paidBooking();
      const cancelled = await inject(
        'PUT',
        `/v1/customer/bookings/${paid.id}/cancel`,
        CUSTOMER,
        {},
      );
      expect(cancelled.statusCode).toBe(200);
      clockNow = AFTER_RELEASE;

      await expect(retry(paid.id)).rejects.toThrow(
        'This booking was canceled. The scheduled sweep releases anything the vendor is still owed.',
      );
    });

    it('refuses a payout whose window has not closed yet, and says so', async () => {
      const paid = await paidBooking();
      clockNow = JUST_AFTER_EVENT;

      await expect(retry(paid.id)).rejects.toThrow('This payout is not due yet');
      expect(harness.stripe.transfers).toEqual([]);
    });

    it('refuses a booking id that does not exist', async () => {
      await expect(retry('00000000-0000-4000-8000-000000000000')).rejects.toThrow(
        'No booking with that id',
      );
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

      expect(
        (await inject('PUT', `/v1/vendor/bookings/${paid.id}/complete`, VENDOR)).statusCode,
      ).toBe(200);
      expect((await currentBooking()).status).toBe('completed');

      expect(await sweep()).toEqual({ released: 0, skipped: 0, failed: 0 });
      expect(harness.stripe.transfers).toEqual([]);
    });

    /** A completed booking still releases once the date says so. */
    it('releases a completed booking on the same date as any other', async () => {
      const paid = await paidBooking();
      clockNow = JUST_AFTER_EVENT;
      await inject('PUT', `/v1/vendor/bookings/${paid.id}/complete`, VENDOR);

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
     * VEN-473. Reproduced from a lane that logged `released 0 / failed 100` on
     * every tick: more unpayable due rows than one batch holds, and one payable
     * booking behind them by event date.
     */
    it('reaches a payable booking however many due bookings of an unonboarded vendor precede it', async () => {
      const payable = await paidBooking();
      const [vendor] = await harness.database.db
        .select()
        .from(vendorProfiles)
        .where(eq(vendorProfiles.id, payable.vendorId));
      const [vendorUser] = await harness.database.db
        .select()
        .from(users)
        .where(eq(users.id, vendor!.userId));
      const [request] = await harness.database.db
        .select()
        .from(bookingRequests)
        .where(eq(bookingRequests.id, payable.requestId));

      const { id: _userId, ...userColumns } = vendorUser!;
      const [stuckUser] = await harness.database.db
        .insert(users)
        .values({
          ...userColumns,
          authUserId: 'user_stuck_vendor',
          email: 'stuck@example.com',
        })
        .returning({ id: users.id });
      const { id: _vendorId, ...vendorColumns } = vendor!;
      const [stuckVendor] = await harness.database.db
        .insert(vendorProfiles)
        .values({
          ...vendorColumns,
          userId: stuckUser!.id,
          slug: 'stuck-studio',
          stripeOnboarded: false,
          stripeAccountId: null,
        })
        .returning({ id: vendorProfiles.id });

      const { id: _requestId, ...requestColumns } = request!;
      const { id: _bookingId, ...bookingColumns } = payable;

      for (let index = 0; index < 101; index += 1) {
        // One accepted request per vendor date is a database rule (VEN-482), so
        // each unpayable row gets a day of its own, all still due.
        const earlier = toDateString(addDays(START, 20 - index));
        const [stuckRequest] = await harness.database.db
          .insert(bookingRequests)
          .values({
            ...requestColumns,
            vendorId: stuckVendor!.id,
            stripePaymentIntentId: null,
            eventDate: earlier,
          })
          .returning({ id: bookingRequests.id });

        await harness.database.db.insert(bookings).values({
          ...bookingColumns,
          requestId: stuckRequest!.id,
          vendorId: stuckVendor!.id,
          eventDate: earlier,
          stripePaymentIntentId: null,
        });
      }

      /*
       * The payable booking has failed a few times already (a transient Stripe
       * refusal), so ordering by attempts alone puts it behind every unpayable
       * row that has been tried fewer times.
       */
      await harness.database.db
        .update(bookings)
        .set({ payoutAttempts: 3 })
        .where(eq(bookings.id, payable.id));

      clockNow = AFTER_RELEASE;
      let released = 0;

      for (let run = 0; run < 2 && released === 0; run += 1) {
        released += (await sweep()).released;
      }

      const [row] = await harness.database.db
        .select()
        .from(bookings)
        .where(eq(bookings.id, payable.id));
      const attempts = await harness.database.db
        .select({ attempts: bookings.payoutAttempts })
        .from(bookings)
        .where(eq(bookings.vendorId, stuckVendor!.id));

      expect(Math.max(...attempts.map((entry) => entry.attempts))).toBeLessThanOrEqual(2);
      expect(row!.payoutReleasedAt).not.toBeNull();
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

    /* VEN-473: a transfer that was fully reversed is not a payout to the vendor. */
    it('makes a new transfer when the only one in the group was fully reversed', async () => {
      const paid = await paidBooking();
      clockNow = AFTER_RELEASE;
      const reversed = await harness.stripe.createTransfer({
        bookingId: 'a-manual-transfer-since-reversed',
        attempt: 0,
        amountCents: EXPECTED_PAYOUT_CENTS,
        destinationAccountId: VENDOR_ACCOUNT,
        transferGroup: `booking_${paid.requestId}`,
      });
      harness.stripe.transfers[0]!.reversedCents = EXPECTED_PAYOUT_CENTS;

      expect(await sweep()).toEqual({ released: 1, skipped: 0, failed: 0 });

      expect(harness.stripe.transfers).toHaveLength(2);
      const row = await currentBooking();
      expect(row.stripeTransferId).toBe(harness.stripe.transfers[1]!.transferId);
      expect(row.stripeTransferId).not.toBe(reversed.transferId);
    });

    /*
     * VEN-424 finding 2. The transfer landed but the sweep recorded a failure,
     * so the row carries no transfer id. Every unwind used to read the row.
     */
    async function orphanedTransfer(requestId: string): Promise<{ transferId: string }> {
      return harness.stripe.createTransfer({
        bookingId: 'a-run-whose-commit-was-lost',
        attempt: 0,
        amountCents: EXPECTED_PAYOUT_CENTS,
        destinationAccountId: VENDOR_ACCOUNT,
        transferGroup: `booking_${requestId}`,
      });
    }

    it('reverses a transfer the row never recorded when a dispute is upheld', async () => {
      const paid = await paidBooking();
      const orphan = await orphanedTransfer(paid.requestId);
      clockNow = JUST_AFTER_EVENT;
      await report(paid.id, CUSTOMER);
      await signInAsAdmin();

      const resolved = await inject('PUT', `/v1/admin/bookings/${paid.id}/dispute`, ADMIN, {
        outcome: 'customer',
      });

      expect(resolved.statusCode).toBe(200);
      expect(harness.stripe.reversals).toHaveLength(1);
      expect(harness.stripe.reversals[0]).toMatchObject({
        transferId: orphan.transferId,
        amountCents: EXPECTED_PAYOUT_CENTS,
      });
      expect((await currentBooking()).vendorPayoutCents).toBe(0);
    });

    it('reverses the refunded half of an unrecorded transfer at the 50% tier, leaving the vendor the retained half', async () => {
      const paid = await paidBooking();
      const orphan = await orphanedTransfer(paid.requestId);
      clockNow = addDays(START, 28);

      const cancelled = await inject(
        'PUT',
        `/v1/customer/bookings/${paid.id}/cancel`,
        CUSTOMER,
        {},
      );
      expect(cancelled.statusCode).toBe(200);
      clockNow = AFTER_RELEASE;

      expect(await sweep()).toEqual({ released: 1, skipped: 0, failed: 0 });

      const retained = EXPECTED_PAYOUT_CENTS / 2;
      expect((await currentBooking()).vendorPayoutCents).toBe(retained);
      expect(harness.stripe.transfers).toHaveLength(1);
      expect(harness.stripe.transfers[0]).toMatchObject({
        transferId: orphan.transferId,
        amountCents: EXPECTED_PAYOUT_CENTS,
        reversedCents: retained,
      });
      expect((await currentBooking()).stripeTransferId).toBe(orphan.transferId);
    });

    it('reverses the surplus when the sweep finds a full-share transfer for a half-share obligation', async () => {
      const paid = await paidBooking();
      const orphan = await orphanedTransfer(paid.requestId);
      const retained = EXPECTED_PAYOUT_CENTS / 2;
      await harness.database.db
        .update(bookings)
        .set({ status: 'cancelled', vendorPayoutCents: retained })
        .where(eq(bookings.id, paid.id));
      clockNow = AFTER_RELEASE;

      expect(await sweep()).toEqual({ released: 1, skipped: 0, failed: 0 });

      expect(harness.stripe.reversals).toHaveLength(1);
      expect(harness.stripe.reversals[0]).toMatchObject({
        transferId: orphan.transferId,
        amountCents: retained,
      });
      const [transfer] = harness.stripe.transfers;
      expect(transfer!.amountCents - transfer!.reversedCents).toBe(retained);
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
      await inject('PUT', `/v1/customer/bookings/${paid.id}/cancel`, CUSTOMER, {});
      clockNow = AFTER_RELEASE;

      expect(await sweep()).toEqual({ released: 0, skipped: 0, failed: 0 });
      expect(harness.stripe.transfers).toEqual([]);
    });
  });

  /**
   * VEN-569. A ban or closure must not change what is owed for an event that
   * already happened — only a still-future booking is refunded (VEN-424,
   * VEN-477), and that is a date bound the sweep already enforces on every row
   * it considers, banned owner or not.
   */
  describe('a vendor banned or closed after their event (VEN-569)', () => {
    /**
     * Bans or closes the vendor who owns `vendorId`, with the matching
     * timestamp column set exactly as `setBanned`/the closure route would —
     * `unfinishedUnwindExpr` reads `banned_at`/`deleted_at` against the
     * booking's event date, so a fixture that skips it is not the state
     * production ever reaches.
     */
    async function changeVendorOwner(
      vendorId: string,
      change: { isBanned: true; at: Date } | { deletedAt: Date },
    ): Promise<void> {
      const [profile] = await harness.database.db
        .select({ userId: vendorProfiles.userId })
        .from(vendorProfiles)
        .where(eq(vendorProfiles.id, vendorId));
      const write =
        'isBanned' in change
          ? { isBanned: true, bannedAt: change.at }
          : { deletedAt: change.deletedAt };
      await harness.database.db.update(users).set(write).where(eq(users.id, profile!.userId));
    }

    it.each([
      ['banned', { isBanned: true, at: JUST_AFTER_EVENT } as const],
      ['closed', { deletedAt: JUST_AFTER_EVENT } as const],
    ])(
      'releases the payout once for a %s vendor whose event had already passed when they were %s',
      async (_name, change) => {
        const paid = await paidBooking();
        /* The event happens first, and only then is the vendor banned or closed. */
        clockNow = JUST_AFTER_EVENT;
        await changeVendorOwner(paid.vendorId, change);
        clockNow = AFTER_RELEASE;

        expect(await sweep()).toEqual({ released: 1, skipped: 0, failed: 0 });
        expect(harness.stripe.transfers).toHaveLength(1);

        const released = await currentBooking();
        expect(released.payoutReleasedAt).not.toBeNull();
        expect(released.stripeTransferId).toBe(harness.stripe.transfers[0]!.transferId);

        /* A second sweep sends nothing more (#423 acceptance 5, on this row). */
        expect(await sweep()).toEqual({ released: 0, skipped: 0, failed: 0 });
        expect(harness.stripe.transfers).toHaveLength(1);
      },
    );

    it('never pays a banned vendor for a booking whose event is still ahead', async () => {
      const paid = await paidBooking();
      await changeVendorOwner(paid.vendorId, { isBanned: true, at: clockNow });
      /* clockNow is still START: EVENT_DATE is 30 days out and not due. */

      expect(await sweep()).toEqual({ released: 0, skipped: 0, failed: 0 });
      expect(harness.stripe.transfers).toEqual([]);
      expect((await currentBooking()).payoutReleasedAt).toBeNull();
    });

    it('no longer answers "busy" when the admin retries a banned vendor’s due payout', async () => {
      const paid = await paidBooking();
      clockNow = JUST_AFTER_EVENT;
      await changeVendorOwner(paid.vendorId, { isBanned: true, at: clockNow });
      clockNow = AFTER_RELEASE;

      const result = await retryPayoutRelease(
        { db: harness.database.db, stripe: harness.stripe, log: harness.app.log },
        paid.id,
        clockNow,
      );

      expect(result.outcome).toBe('released');
      expect(result.payoutStatus).toBe('released');
    });

    /**
     * The one case a ban still leaves stuck: nowhere left to send the money.
     * The sweep keeps trying and recording why, and alerts the admin
     * through the same threshold every other stuck payout does (VEN-405) —
     * no new alert type, because this is not a new kind of failure.
     */
    it('holds the payout and alerts the admin for a closed vendor with no connected account', async () => {
      const paid = await paidBooking();
      clockNow = JUST_AFTER_EVENT;
      await changeVendorOwner(paid.vendorId, { deletedAt: clockNow });
      await harness.database.db
        .update(vendorProfiles)
        .set({ stripeOnboarded: false, stripeAccountId: null })
        .where(eq(vendorProfiles.id, paid.vendorId));
      clockNow = AFTER_RELEASE;

      const dispatched: unknown[] = [];
      const context = {
        db: harness.database.db,
        stripe: harness.stripe,
        log: harness.app.log,
        alerts: {
          dispatch: (alert: unknown) => {
            dispatched.push(alert);
          },
        },
      };

      for (let attempt = 0; attempt < 3; attempt += 1) {
        expect(await releaseDuePayouts(context, clockNow)).toEqual({
          released: 0,
          skipped: 0,
          failed: 1,
        });
      }

      expect(harness.stripe.transfers).toEqual([]);
      const held = await currentBooking();
      expect(held.payoutReleasedAt).toBeNull();
      expect(held.payoutAttempts).toBe(3);
      expect(dispatched).toEqual([
        expect.objectContaining({ kind: 'payout_failed', subjectId: paid.id }),
      ]);
    });

    /**
     * The blocker both reviewers found: a ban's own unwind only targets a
     * still-future booking, and its Stripe refund can fail — `account-unwind.ts`
     * then leaves the row `confirmed` and fully owed, with nothing durable on
     * it besides a transient alert. That row must stay unpaid even once its
     * event date passes and it would otherwise look due, because nothing on it
     * says the customer was ever refunded or received the service.
     */
    it('never pays a booking the ban left the unwind unable to refund', async () => {
      const paid = await paidBooking();
      /* The vendor is banned while the event is still ahead — the unwind's own
       * target — and its refund fails, exactly as `account-unwind.ts` leaves it:
       * the booking is untouched, still `confirmed` and fully owed. */
      await changeVendorOwner(paid.vendorId, { isBanned: true, at: clockNow });
      clockNow = AFTER_RELEASE;

      expect(await sweep()).toEqual({ released: 0, skipped: 0, failed: 0 });
      expect(harness.stripe.transfers).toEqual([]);
      const untouched = await currentBooking();
      expect(untouched.payoutReleasedAt).toBeNull();
      expect(untouched.payoutAttempts).toBe(0);

      /* The admin retry refuses it too, rather than paying it by hand. */
      const result = await retryPayoutRelease(
        { db: harness.database.db, stripe: harness.stripe, log: harness.app.log },
        paid.id,
        clockNow,
      );
      expect(result.outcome).toBe('busy');
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
      const resolved = await inject('PUT', `/v1/admin/bookings/${paid.id}/dispute`, ADMIN, {
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
      await inject('PUT', `/v1/vendor/bookings/${paid.id}/complete`, VENDOR);
      await report(paid.id, CUSTOMER);

      await signInAsAdmin();
      const resolved = await inject('PUT', `/v1/admin/bookings/${paid.id}/dispute`, ADMIN, {
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
      const resolved = await inject('PUT', `/v1/admin/bookings/${paid.id}/dispute`, ADMIN, {
        outcome: 'customer',
      });

      expect(resolved.statusCode).toBe(200);
      expect(resolved.json().status).toBe('cancelled');
      /*
       * In full, not on D3's tiers. Those price a customer changing their mind
       * against how much notice they gave; this is an admin's ruling that
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
      const response = await inject('PUT', `/v1/admin/bookings/${paid.id}/dispute`, ADMIN, {
        outcome: 'vendor',
      });

      expect(response.statusCode).toBe(409);
      expect(response.json().message).toBe('That booking has no open report to resolve');
      // #434: a refused call records nothing. There was no ruling to record.
      expect(await harness.database.db.select().from(adminActions)).toHaveLength(0);
    });

    /**
     * #434 — the sixth mutating route, recorded here rather than in
     * `admin.activity.routes.test.ts` because a disputed, paid booking is this
     * file's fixture and rebuilding it beside the log would be a second copy of
     * two hundred lines.
     *
     * The ruling is the thing worth recording: it decides who keeps the money,
     * and until now `resolveDispute` was never told which admin made it.
     */
    it('records which admin ruled, and the money the ruling moved', async () => {
      const paid = await paidBooking();
      clockNow = JUST_AFTER_EVENT;
      await report(paid.id, CUSTOMER);
      clockNow = AFTER_RELEASE;

      const actorId = await signInAsAdmin();
      const resolved = await inject('PUT', `/v1/admin/bookings/${paid.id}/dispute`, ADMIN, {
        outcome: 'customer',
      });

      expect(resolved.statusCode).toBe(200);
      const rows = await harness.database.db.select().from(adminActions);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        actorId,
        action: 'dispute_resolved',
        subjectType: 'booking',
        subjectId: paid.id,
      });
      /*
       * The full refund, as a figure rather than as prose. "Was this one
       * refunded, and how much" is the question an admin brings back to the
       * log months later, and the booking row it would otherwise be read from
       * is the one a later closure may take away.
       */
      expect(rows[0]?.detail).toEqual({
        outcome: 'customer',
        status: 'cancelled',
        refundAmountCents: PRICE_CENTS,
      });
    });

    /** The vendor's side records the same way, with no money moved. */
    it('records a ruling in the vendor favour as the lift it is', async () => {
      const paid = await paidBooking();
      clockNow = JUST_AFTER_EVENT;
      await report(paid.id, CUSTOMER);

      await signInAsAdmin();
      const resolved = await inject('PUT', `/v1/admin/bookings/${paid.id}/dispute`, ADMIN, {
        outcome: 'vendor',
      });

      expect(resolved.statusCode).toBe(200);
      const rows = await harness.database.db.select().from(adminActions);
      expect(rows).toHaveLength(1);
      expect(rows[0]?.detail).toEqual({
        outcome: 'vendor',
        status: 'confirmed',
        refundAmountCents: null,
      });
    });

    /**
     * #423 acceptance 11, and the ruling it asked for: **refused**.
     *
     * Routing it into the post-release refund path would let a self-serve
     * button claw a third party's balance negative on one party's say-so, which
     * is an admin's judgement rather than a customer's. Support can still
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

      const response = await inject('PUT', `/v1/vendor/bookings/${paid.id}/complete`, VENDOR);

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
     * an admin resolves that complaint, the customer files a second report
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

      /* The admin settles it, and the customer reports again. */
      expect(
        (await inject('PUT', `/v1/admin/bookings/${paid.id}/dispute`, ADMIN, { outcome: 'vendor' }))
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

      const response = await inject('POST', '/v1/support/messages', null, {
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

        const response = await inject('GET', `/v1/customer/bookings/${paid.id}`, CUSTOMER);

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

        const response = await inject('GET', `/v1/customer/bookings/${released.id}`, CUSTOMER);

        expect(response.statusCode).toBe(200);
        expect(response.json().payoutReleasedAt).not.toBeNull();
      });

      it.each([
        ['the vendor on the booking', () => VENDOR],
        ['another customer', () => OUTSIDER],
      ])('answers 404 to %s', async (_who, actor) => {
        const paid = await paidBooking();

        expect((await inject('GET', `/v1/customer/bookings/${paid.id}`, actor())).statusCode).toBe(
          404,
        );
      });

      it('answers 401 to a signed-out visitor', async () => {
        const paid = await paidBooking();

        expect((await inject('GET', `/v1/customer/bookings/${paid.id}`, null)).statusCode).toBe(
          401,
        );
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
    /*
     * #423 acceptance 13 answered "reverse the transfer". VEN-439 answers it by
     * never getting there: once the sweep has paid the vendor, a customer's
     * cancellation used to refund half and claw it back out of their connected
     * account. Nothing moves now — the customer is sent to the report path.
     */
    it('refuses to cancel a released booking, moving no money', async () => {
      const released = await releasedBooking();

      const response = await inject(
        'PUT',
        `/v1/customer/bookings/${released.id}/cancel`,
        CUSTOMER,
        {},
      );

      expect(response.statusCode).toBe(409);
      expect(response.json().message).toContain('already been paid out');
      expect(harness.stripe.refunds).toEqual([]);
      expect(harness.stripe.reversals).toEqual([]);
      expect((await currentBooking()).status).toBe('confirmed');
    });

    /* #423 acceptance 12, stated against the reversal list rather than a flag. */
    it('reverses nothing when an unreleased booking is cancelled', async () => {
      const paid = await paidBooking();

      expect(
        (await inject('PUT', `/v1/customer/bookings/${paid.id}/cancel`, CUSTOMER, {})).statusCode,
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
      // Inside the cutoff (36 hours out) and still future in every zone.
      clockNow = addDays(new Date(`${EVENT_DATE}T12:00:00Z`), -2);

      const response = await inject('PUT', `/v1/customer/bookings/${paid.id}/cancel`, CUSTOMER, {});

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

      await inject('PUT', `/v1/customer/bookings/${paid.id}/cancel`, CUSTOMER, {});

      expect((await currentBooking()).vendorPayoutCents).toBe(0);

      clockNow = AFTER_RELEASE;
      expect(await sweep()).toEqual({ released: 0, skipped: 0, failed: 0 });
      expect(harness.stripe.transfers).toEqual([]);
    });

    /* #423 acceptance 14 — `refundAmountCents` records what actually moved. */
    it('records the amount that moved on the late-cancellation tier', async () => {
      const paid = await paidBooking();
      clockNow = addDays(new Date(`${EVENT_DATE}T12:00:00Z`), -2);
      await inject('PUT', `/v1/customer/bookings/${paid.id}/cancel`, CUSTOMER, {});

      expect((await currentBooking()).refundAmountCents).toBe(PRICE_CENTS / 2);
    });

    /**
     * The vendor is told the truth about their own balance: a booking that was
     * never paid out has no reversal to name, so the notice must not claim one.
     */
    it('does not name a reversal to the vendor for a booking never paid out', async () => {
      const paid = await paidBooking();
      await inject('PUT', `/v1/customer/bookings/${paid.id}/cancel`, CUSTOMER, {});

      const rows = await harness.database.db
        .select()
        .from(notifications)
        .where(eq(notifications.type, 'booking_cancelled'));

      expect(rows).toHaveLength(1);
      expect(rows[0]?.body).toBe(
        'The date is free again on your calendar. This booking had not been paid out yet, so ' +
          'nothing is taken back out of your Stripe balance.',
      );
    });
  });

  describe('what the vendor dashboard can read', () => {
    /* #423 acceptance 15. */
    it('names the stored amount and the release date the sweep will pay on', async () => {
      await paidBooking();

      const response = await inject('GET', '/v1/vendor/dashboard', VENDOR);

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

      const { payouts } = (await inject('GET', '/v1/vendor/dashboard', VENDOR)).json();

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
      await inject('PUT', `/v1/vendor/bookings/${paid.id}/complete`, VENDOR);

      expect((await inject('GET', '/v1/vendor/dashboard', VENDOR)).json().payouts).toMatchObject({
        pendingCents: EXPECTED_PAYOUT_CENTS,
        pendingCount: 1,
        heldCents: 0,
      });
    });

    it('names nothing once the payout has gone out', async () => {
      await releasedBooking();

      const { payouts } = (await inject('GET', '/v1/vendor/dashboard', VENDOR)).json();
      expect(payouts.next).toBeNull();
      expect(payouts.pendingCents).toBe(0);
    });
  });

  /**
   * VEN-543. A late cancellation leaves the vendor a residual, and `cancelled`
   * is a status neither hold can move, so a refund made outside the platform or
   * an open chargeback used to be skipped once and paid on the next tick.
   */
  describe('a cancelled booking whose residual is contested', () => {
    const RETAINED_CENTS = EXPECTED_PAYOUT_CENTS / 2;
    const FOREIGN_REFUND_CENTS = 30_000;

    async function lateCancelledBooking(): Promise<typeof bookings.$inferSelect> {
      const paid = await paidBooking();
      clockNow = addDays(new Date(`${EVENT_DATE}T12:00:00Z`), -2);
      expect(
        (await inject('PUT', `/v1/customer/bookings/${paid.id}/cancel`, CUSTOMER, {})).statusCode,
      ).toBe(200);
      clockNow = AFTER_RELEASE;

      const cancelled = await currentBooking();
      expect(cancelled.vendorPayoutCents).toBe(RETAINED_CENTS);

      return cancelled;
    }

    async function openChargebackCase(
      bookingId: string,
      networkOutcome: string | null = null,
    ): Promise<string> {
      const [booking] = await harness.database.db
        .select({ customerId: bookings.customerId })
        .from(bookings)
        .where(eq(bookings.id, bookingId));
      const [row] = await harness.database.db
        .insert(supportCases)
        .values({
          reference: 'ORL-TEST-54',
          origin: 'chargeback',
          message: 'The card network opened a chargeback.',
          bookingId,
          senderUserId: booking?.customerId,
          networkOutcome,
        })
        .returning({ id: supportCases.id });

      return row!.id;
    }

    it('makes no transfer on two consecutive sweeps after a foreign refund is recorded', async () => {
      const cancelled = await lateCancelledBooking();
      harness.stripe.refundExternally(cancelled.stripePaymentIntentId!, FOREIGN_REFUND_CENTS);

      // The first run finds and records the refund; the second used to pay.
      expect(await sweep()).toEqual({ released: 0, skipped: 1, failed: 0 });
      expect((await currentBooking()).externalRefundCents).toBe(FOREIGN_REFUND_CENTS);
      expect(await sweep()).toEqual({ released: 0, skipped: 0, failed: 0 });
      expect(harness.stripe.transfers).toEqual([]);
    });

    it('holds while a chargeback case is open, and pays the residual once it is resolved', async () => {
      const cancelled = await lateCancelledBooking();
      const caseId = await openChargebackCase(cancelled.id);

      expect(await sweep()).toEqual({ released: 0, skipped: 0, failed: 0 });
      expect(harness.stripe.transfers).toEqual([]);

      await harness.database.db
        .update(supportCases)
        .set({ status: 'resolved' })
        .where(eq(supportCases.id, caseId));

      expect(await sweep()).toEqual({ released: 1, skipped: 0, failed: 0 });
      expect(harness.stripe.transfers).toHaveLength(1);
      expect(harness.stripe.transfers[0]?.amountCents).toBe(RETAINED_CENTS);
    });

    it.each([null, 'needs_response', 'lost'])(
      'refuses to close a chargeback case whose outcome is %s, so the residual stays held (VEN-683)',
      async (outcome) => {
        const cancelled = await lateCancelledBooking();
        const caseId = await openChargebackCase(cancelled.id, outcome);

        await signInAsAdmin();
        await signInAsAdmin();
        const resolved = await inject('PUT', `/v1/admin/cases/${caseId}/resolve`, ADMIN);

        expect(resolved.statusCode).toBe(409);
        const [row] = await harness.database.db
          .select({ status: supportCases.status })
          .from(supportCases)
          .where(eq(supportCases.id, caseId));
        expect(row?.status).toBe('open');
        expect(await sweep()).toEqual({ released: 0, skipped: 0, failed: 0 });
        expect(harness.stripe.transfers).toEqual([]);
      },
    );

    it('closes a won chargeback case and releases the residual exactly once (VEN-683)', async () => {
      const cancelled = await lateCancelledBooking();
      const caseId = await openChargebackCase(cancelled.id, 'won');

      await signInAsAdmin();
      const resolved = await inject('PUT', `/v1/admin/cases/${caseId}/resolve`, ADMIN);
      expect(resolved.statusCode).toBe(200);

      expect(await sweep()).toEqual({ released: 1, skipped: 0, failed: 0 });
      expect(await sweep()).toEqual({ released: 0, skipped: 0, failed: 0 });
      expect(harness.stripe.transfers).toHaveLength(1);
      expect(harness.stripe.transfers[0]?.amountCents).toBe(RETAINED_CENTS);
    });

    it('reports the row as held on the vendor dashboard while the sweep leaves it', async () => {
      const cancelled = await lateCancelledBooking();
      await openChargebackCase(cancelled.id);

      const { payouts } = (await inject('GET', '/v1/vendor/dashboard', VENDOR)).json();

      expect(payouts.heldCents).toBe(RETAINED_CENTS);
      expect(payouts.heldCount).toBe(1);
      expect(payouts.pendingCents).toBe(0);
      expect(payouts.next).toBeNull();
    });

    it('still pays an uncontested cancelled residual and reports it pending', async () => {
      await lateCancelledBooking();

      const { payouts } = (await inject('GET', '/v1/vendor/dashboard', VENDOR)).json();
      expect(payouts.pendingCents).toBe(RETAINED_CENTS);
      expect(payouts.heldCents).toBe(0);
    });
  });

  /* VEN-525 acceptance 1 and 4. */
  describe('the vendor is told a payout went out', () => {
    /** The payout-side types only: the booking flow writes its own notices to both parties. */
    const PAYOUT_TYPES = ['payout_sent', 'stripe_onboarding_complete', 'payouts_paused'];

    async function noticesOf(authUserId: string): Promise<{ type: string; title: string }[]> {
      const rows = await harness.database.db
        .select({ type: notifications.type, title: notifications.title })
        .from(notifications)
        .innerJoin(users, eq(users.id, notifications.userId))
        .where(eq(users.authUserId, authUserId));

      return rows.filter((row) => PAYOUT_TYPES.includes(row.type));
    }

    it('writes exactly one payout_sent for the vendor and none for the customer', async () => {
      await paidBooking();
      clockNow = AFTER_RELEASE;
      expect(await sweep()).toEqual({ released: 1, skipped: 0, failed: 0 });

      expect(await noticesOf(VENDOR)).toEqual([
        { type: 'payout_sent', title: 'A payout is on its way' },
      ]);
      expect(await noticesOf(CUSTOMER)).toEqual([]);
    });

    it('does not notify again when the sweep runs a second time', async () => {
      await paidBooking();
      clockNow = AFTER_RELEASE;
      await sweep();
      expect(await sweep()).toEqual({ released: 0, skipped: 0, failed: 0 });

      expect(await noticesOf(VENDOR)).toHaveLength(1);
    });

    it('says nothing while the transfer is failing', async () => {
      const booking = await paidBooking();
      harness.stripe.transfersToRefuse.add(booking.id);
      clockNow = AFTER_RELEASE;
      expect((await sweep()).failed).toBe(1);

      expect(booking.stripeTransferId).toBeNull();
      expect(await noticesOf(VENDOR)).toEqual([]);
    });

    it('emails the vendor alone, with a link to their dashboard', async () => {
      await paidBooking();
      harness.email.sent.length = 0;
      clockNow = AFTER_RELEASE;
      await sweep();
      await harness.app.background.drain();

      expect(harness.email.sent.map((message) => message.to)).toEqual(['grace@example.com']);
      expect(harness.email.sent[0]?.text).toContain('https://web.test/vendor/dashboard');
    });
  });

  describe('recovering a chargeback lost after the vendor was paid (VEN-658)', () => {
    const LATER_EVENT_DATE = toDateString(addDays(START, 40));
    /** Past the second event's own release window. */
    const AFTER_LATER_RELEASE = addDays(START, 44);

    /** A released booking that owes `owedCents`, and a second one waiting to be paid on the same vendor. */
    async function vendorOwing(owedCents: number): Promise<{
      lost: typeof bookings.$inferSelect;
      next: typeof bookings.$inferSelect;
    }> {
      const { vendorId, packageId } = await createVendor();
      const lost = await paidBookingFor(vendorId, packageId, EVENT_DATE);
      const next = await paidBookingFor(vendorId, packageId, LATER_EVENT_DATE);

      clockNow = AFTER_RELEASE;
      expect(await sweep()).toEqual({ released: 1, skipped: 0, failed: 0 });
      await harness.database.db
        .update(bookings)
        .set({ vendorOwedCents: owedCents })
        .where(eq(bookings.id, lost.id));

      return { lost, next };
    }

    async function moneyOf(bookingId: string): Promise<{
      vendorOwedRecoveredCents: number;
      debtNettedCents: number;
      stripeTransferId: string | null;
      released: boolean;
    }> {
      const [row] = await harness.database.db
        .select({
          vendorOwedRecoveredCents: bookings.vendorOwedRecoveredCents,
          debtNettedCents: bookings.debtNettedCents,
          stripeTransferId: bookings.stripeTransferId,
          releasedAt: bookings.payoutReleasedAt,
        })
        .from(bookings)
        .where(eq(bookings.id, bookingId));

      return {
        vendorOwedRecoveredCents: row!.vendorOwedRecoveredCents,
        debtNettedCents: row!.debtNettedCents,
        stripeTransferId: row!.stripeTransferId,
        released: row!.releasedAt !== null,
      };
    }

    it('reduces the next transfer by what the vendor owes, once, however often the sweep runs', async () => {
      const { lost, next } = await vendorOwing(30_000);
      clockNow = AFTER_LATER_RELEASE;

      expect(await sweep()).toEqual({ released: 1, skipped: 0, failed: 0 });
      expect(await sweep()).toEqual({ released: 0, skipped: 0, failed: 0 });

      expect(harness.stripe.transfers.map((transfer) => transfer.amountCents)).toEqual([
        EXPECTED_PAYOUT_CENTS,
        EXPECTED_PAYOUT_CENTS - 30_000,
      ]);
      expect(await moneyOf(next.id)).toMatchObject({ debtNettedCents: 30_000, released: true });
      expect(await moneyOf(lost.id)).toMatchObject({ vendorOwedRecoveredCents: 30_000 });
    });

    it('carries a debt larger than the next payout over to the one after, and sends no transfer for a payout it consumed', async () => {
      const { lost, next } = await vendorOwing(200_000);
      clockNow = AFTER_LATER_RELEASE;

      expect(await sweep()).toEqual({ released: 1, skipped: 0, failed: 0 });

      expect(harness.stripe.transfers).toHaveLength(1);
      expect(await moneyOf(next.id)).toEqual({
        vendorOwedRecoveredCents: 0,
        debtNettedCents: EXPECTED_PAYOUT_CENTS,
        stripeTransferId: null,
        released: true,
      });
      expect(await moneyOf(lost.id)).toMatchObject({
        vendorOwedRecoveredCents: EXPECTED_PAYOUT_CENTS,
      });

      const { payouts } = (await inject('GET', '/v1/vendor/dashboard', VENDOR)).json();
      expect(payouts).toMatchObject({
        debtOutstandingCents: 200_000 - EXPECTED_PAYOUT_CENTS,
        debtRecoveredCents: EXPECTED_PAYOUT_CENTS,
      });
    });

    it('recovers nothing when the transfer fails, and recovers it on the retry', async () => {
      const { lost, next } = await vendorOwing(30_000);
      clockNow = AFTER_LATER_RELEASE;
      harness.stripe.transfersToRefuse.add(next.id);

      expect(await sweep()).toEqual({ released: 0, skipped: 0, failed: 1 });
      expect(await moneyOf(lost.id)).toMatchObject({ vendorOwedRecoveredCents: 0 });
      expect(await moneyOf(next.id)).toMatchObject({ debtNettedCents: 0, released: false });

      harness.stripe.transfersToRefuse.clear();
      expect(await sweep()).toEqual({ released: 1, skipped: 0, failed: 0 });
      expect(await moneyOf(lost.id)).toMatchObject({ vendorOwedRecoveredCents: 30_000 });
    });

    it('reverses only what a partly netted transfer holds on a refund, and owes the netted part again', async () => {
      const paid = await paidBooking();
      const netted = 30_000;
      const transfer = await harness.stripe.createTransfer({
        bookingId: paid.id,
        attempt: 0,
        amountCents: EXPECTED_PAYOUT_CENTS - netted,
        destinationAccountId: VENDOR_ACCOUNT,
        transferGroup: `booking_${paid.requestId}`,
      });
      /* A state the product reaches only through a hold on a released payout, so it is written directly. */
      await harness.database.db
        .update(bookings)
        .set({
          status: 'disputed',
          disputeReason: REPORT,
          payoutReleasedAt: AFTER_RELEASE,
          stripeTransferId: transfer.transferId,
          debtNettedCents: netted,
        })
        .where(eq(bookings.id, paid.id));
      clockNow = AFTER_RELEASE;
      await signInAsAdmin();

      const resolved = await inject('PUT', `/v1/admin/bookings/${paid.id}/dispute`, ADMIN, {
        outcome: 'customer',
      });

      expect(resolved.statusCode).toBe(200);
      expect(harness.stripe.reversals).toHaveLength(1);
      expect(harness.stripe.reversals[0]).toMatchObject({
        transferId: transfer.transferId,
        amountCents: EXPECTED_PAYOUT_CENTS - netted,
      });
      expect((await currentBooking()).vendorOwedCents).toBe(netted);
    });

    it('owes the netted part again when a fully netted payout, which has no transfer, is refunded', async () => {
      const paid = await paidBooking();
      await harness.database.db
        .update(bookings)
        .set({
          status: 'disputed',
          disputeReason: REPORT,
          payoutReleasedAt: AFTER_RELEASE,
          stripeTransferId: null,
          debtNettedCents: EXPECTED_PAYOUT_CENTS,
        })
        .where(eq(bookings.id, paid.id));
      clockNow = AFTER_RELEASE;
      await signInAsAdmin();

      const resolved = await inject('PUT', `/v1/admin/bookings/${paid.id}/dispute`, ADMIN, {
        outcome: 'customer',
      });

      expect(resolved.statusCode).toBe(200);
      expect(harness.stripe.reversals).toEqual([]);
      expect((await currentBooking()).vendorOwedCents).toBe(EXPECTED_PAYOUT_CENTS);
    });

    it('recovers a chargeback the network ruled lost after the payout, from a webhook to the next transfer', async () => {
      const { vendorId, packageId } = await createVendor();
      const lost = await paidBookingFor(vendorId, packageId, EVENT_DATE);
      const next = await paidBookingFor(vendorId, packageId, LATER_EVENT_DATE);
      clockNow = AFTER_RELEASE;
      expect(await sweep()).toEqual({ released: 1, skipped: 0, failed: 0 });

      const dispute = {
        id: 'dp_lost_after_payout',
        reason: 'fraudulent',
        amountCents: PRICE_CENTS,
        paymentIntentId: lost.stripePaymentIntentId!,
      };
      for (const [type, status] of [
        ['charge.dispute.created', 'needs_response'],
        ['charge.dispute.closed', 'lost'],
      ] as const) {
        harness.stripe.disputes.set(dispute.id, {
          ...dispute,
          status,
        });
        harness.stripe.nextEvent = { type, accountId: dispute.id, objectId: dispute.id };
        const delivered = await harness.app.inject({
          method: 'POST',
          url: '/webhooks/stripe',
          headers: { 'stripe-signature': 'valid-signature', 'content-type': 'application/json' },
          payload: JSON.stringify({ id: 'evt_dispute', object: 'event' }),
        });
        expect(delivered.statusCode).toBe(200);
      }

      /* The vendor's share plus Stripe's $15 dispute fee. */
      const owed = EXPECTED_PAYOUT_CENTS + 1_500;
      const [row] = await harness.database.db
        .select({ owed: bookings.vendorOwedCents })
        .from(bookings)
        .where(eq(bookings.id, lost.id));
      expect(row?.owed).toBe(owed);

      clockNow = AFTER_LATER_RELEASE;
      expect(await sweep()).toEqual({ released: 1, skipped: 0, failed: 0 });

      expect(harness.stripe.transfers).toHaveLength(1);
      expect(await moneyOf(next.id)).toMatchObject({ debtNettedCents: EXPECTED_PAYOUT_CENTS });
      const { payouts } = (await inject('GET', '/v1/vendor/dashboard', VENDOR)).json();
      expect(payouts).toMatchObject({ debtOutstandingCents: 1_500, debtRecoveredCents: 127_600 });
    });

    it('records what a found transfer already withheld instead of planning it again', async () => {
      const { lost, next } = await vendorOwing(30_000);
      await harness.stripe.createTransfer({
        bookingId: next.id,
        attempt: 0,
        amountCents: EXPECTED_PAYOUT_CENTS - 30_000,
        destinationAccountId: VENDOR_ACCOUNT,
        transferGroup: `booking_${next.requestId}`,
      });
      /* The debt was settled elsewhere between the lost commit and this run. */
      await harness.database.db
        .update(bookings)
        .set({ vendorOwedCents: 0 })
        .where(eq(bookings.id, lost.id));
      clockNow = AFTER_LATER_RELEASE;

      expect(await sweep()).toEqual({ released: 1, skipped: 0, failed: 0 });

      expect(harness.stripe.transfers).toHaveLength(2);
      expect(await moneyOf(next.id)).toMatchObject({ debtNettedCents: 30_000 });
    });

    it('shows the admin what the vendor still owes', async () => {
      const { lost } = await vendorOwing(30_000);
      await signInAsAdmin();

      const detail = await inject('GET', `/v1/admin/vendors/${lost.vendorId}`, ADMIN);

      expect(detail.statusCode).toBe(200);
      expect(detail.json().vendor.debtOutstandingCents).toBe(30_000);
    });

    it('shows a vendor with no debt nothing to repay', async () => {
      await vendorOwing(0);

      const { payouts } = (await inject('GET', '/v1/vendor/dashboard', VENDOR)).json();
      expect(payouts).toMatchObject({ debtOutstandingCents: 0, debtRecoveredCents: 0 });
    });
  });

  /* VEN-723 (D49): the sweep withholds the statutory rate while an admin has it switched on. */
  describe('backup withholding (VEN-723)', () => {
    const LATER_EVENT_DATE = toDateString(addDays(START, 40));
    const AFTER_LATER_RELEASE = addDays(START, 44);
    const SHARE_CENTS = 100_000;
    const WITHHELD_CENTS = 24_000;

    async function switchOn(vendorId: string): Promise<void> {
      await signInAsAdmin();
      const response = await inject(
        'PUT',
        `/v1/admin/vendors/${vendorId}/backup-withholding`,
        ADMIN,
        {
          withholding: true,
          reason: 'irs_notice',
          noticeDate: '2026-05-20',
        },
      );

      expect(response.statusCode).toBe(200);
    }

    async function clear(vendorId: string): Promise<void> {
      const response = await inject(
        'PUT',
        `/v1/admin/vendors/${vendorId}/backup-withholding`,
        ADMIN,
        {
          withholding: false,
          receivedDate: '2026-05-25',
        },
      );

      expect(response.statusCode).toBe(200);
    }

    async function setShare(bookingId: string, cents: number): Promise<void> {
      await harness.database.db
        .update(bookings)
        .set({ vendorPayoutCents: cents })
        .where(eq(bookings.id, bookingId));
    }

    async function moneyOf(bookingId: string) {
      const [row] = await harness.database.db
        .select({
          backupWithheldCents: bookings.backupWithheldCents,
          debtNettedCents: bookings.debtNettedCents,
          released: bookings.payoutReleasedAt,
        })
        .from(bookings)
        .where(eq(bookings.id, bookingId));

      return { ...row!, released: row!.released !== null };
    }

    async function withheldRows() {
      return harness.database.db
        .select()
        .from(adminActions)
        .where(eq(adminActions.action, 'backup_withholding_withheld'));
    }

    async function yearTotals(): Promise<{ year: number; cents: number }[]> {
      return (await inject('GET', '/v1/admin/tax/years', ADMIN)).json().backupWithheld;
    }

    it('transfers $760 of a $1,000 share, records 24000 cents withheld and raises the year total by exactly that', async () => {
      const booking = await paidBooking();
      await setShare(booking.id, SHARE_CENTS);
      await switchOn(booking.vendorId);
      expect(await yearTotals()).toEqual([]);
      clockNow = AFTER_RELEASE;

      expect(await sweep()).toEqual({ released: 1, skipped: 0, failed: 0 });

      expect(harness.stripe.transfers.map((transfer) => transfer.amountCents)).toEqual([76_000]);
      expect(await moneyOf(booking.id)).toEqual({
        backupWithheldCents: WITHHELD_CENTS,
        debtNettedCents: 0,
        released: true,
      });
      expect(await yearTotals()).toEqual([{ year: 2026, cents: WITHHELD_CENTS }]);

      const adminId = await signInAsAdmin();
      const rows = await withheldRows();

      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        actorId: adminId,
        subjectType: 'booking',
        subjectId: booking.id,
        detail: { vendorId: booking.vendorId, cents: WITHHELD_CENTS, rateBps: 2400 },
      });
    });

    it('withholds once however often the sweep runs', async () => {
      const booking = await paidBooking();
      await setShare(booking.id, SHARE_CENTS);
      await switchOn(booking.vendorId);
      clockNow = AFTER_RELEASE;

      await sweep();
      expect(await sweep()).toEqual({ released: 0, skipped: 0, failed: 0 });

      expect(harness.stripe.transfers).toHaveLength(1);
      expect(await withheldRows()).toHaveLength(1);
      expect(await yearTotals()).toEqual([{ year: 2026, cents: WITHHELD_CENTS }]);
    });

    it('transfers the full share again on the next release once it is cleared', async () => {
      const { vendorId, packageId } = await createVendor();
      const first = await paidBookingFor(vendorId, packageId, EVENT_DATE);
      const second = await paidBookingFor(vendorId, packageId, LATER_EVENT_DATE);
      await setShare(first.id, SHARE_CENTS);
      await switchOn(vendorId);
      clockNow = AFTER_RELEASE;
      expect(await sweep()).toEqual({ released: 1, skipped: 0, failed: 0 });

      await clear(vendorId);
      clockNow = AFTER_LATER_RELEASE;
      expect(await sweep()).toEqual({ released: 1, skipped: 0, failed: 0 });

      expect(harness.stripe.transfers.map((transfer) => transfer.amountCents)).toEqual([
        76_000,
        EXPECTED_PAYOUT_CENTS,
      ]);
      expect(await moneyOf(second.id)).toMatchObject({ backupWithheldCents: 0 });
      expect(await withheldRows()).toHaveLength(1);
    });

    it('transfers a vendor with no withholding exactly vendor_payout_cents less debt_netted_cents, and records none', async () => {
      const booking = await paidBooking();
      clockNow = AFTER_RELEASE;

      expect(await sweep()).toEqual({ released: 1, skipped: 0, failed: 0 });

      const after = await moneyOf(booking.id);

      expect(harness.stripe.transfers.map((transfer) => transfer.amountCents)).toEqual([
        booking.vendorPayoutCents - after.debtNettedCents,
      ]);
      expect(harness.stripe.transfers[0]?.amountCents).toBe(EXPECTED_PAYOUT_CENTS);
      expect(after).toEqual({ backupWithheldCents: 0, debtNettedCents: 0, released: true });
      expect(await withheldRows()).toHaveLength(0);
    });

    it('keeps debt back from what is left after the withholding, never from the withheld money', async () => {
      const { vendorId, packageId } = await createVendor();
      const lost = await paidBookingFor(vendorId, packageId, EVENT_DATE);
      const next = await paidBookingFor(vendorId, packageId, LATER_EVENT_DATE);
      clockNow = AFTER_RELEASE;
      expect(await sweep()).toEqual({ released: 1, skipped: 0, failed: 0 });
      await harness.database.db
        .update(bookings)
        .set({ vendorOwedCents: 30_000 })
        .where(eq(bookings.id, lost.id));
      await switchOn(vendorId);
      clockNow = AFTER_LATER_RELEASE;

      expect(await sweep()).toEqual({ released: 1, skipped: 0, failed: 0 });

      const withheld = Math.round((EXPECTED_PAYOUT_CENTS * 2400) / 10_000);

      expect(harness.stripe.transfers.map((transfer) => transfer.amountCents)).toEqual([
        EXPECTED_PAYOUT_CENTS,
        EXPECTED_PAYOUT_CENTS - withheld - 30_000,
      ]);
      expect(await moneyOf(next.id)).toEqual({
        backupWithheldCents: withheld,
        debtNettedCents: 30_000,
        released: true,
      });
    });

    it('records nothing while the transfer fails, and withholds on the retry', async () => {
      const booking = await paidBooking();
      await setShare(booking.id, SHARE_CENTS);
      await switchOn(booking.vendorId);
      clockNow = AFTER_RELEASE;
      harness.stripe.transfersToRefuse.add(booking.id);

      expect(await sweep()).toEqual({ released: 0, skipped: 0, failed: 1 });
      expect(await moneyOf(booking.id)).toMatchObject({ backupWithheldCents: 0, released: false });
      expect(await withheldRows()).toHaveLength(0);

      harness.stripe.transfersToRefuse.clear();
      expect(await sweep()).toEqual({ released: 1, skipped: 0, failed: 0 });
      expect(await moneyOf(booking.id)).toMatchObject({ backupWithheldCents: WITHHELD_CENTS });
      expect(await withheldRows()).toHaveLength(1);
    });

    it('moves no money for a withholding no admin action accounts for', async () => {
      const booking = await paidBooking();
      await setShare(booking.id, SHARE_CENTS);
      await harness.database.db
        .update(vendorProfiles)
        .set({ backupWithholdingReason: 'irs_notice', backupWithholdingNoticeDate: '2026-05-20' })
        .where(eq(vendorProfiles.id, booking.vendorId));
      clockNow = AFTER_RELEASE;

      expect(await sweep()).toEqual({ released: 0, skipped: 0, failed: 1 });

      expect(harness.stripe.transfers).toEqual([]);
      expect(await moneyOf(booking.id)).toMatchObject({ backupWithheldCents: 0, released: false });
    });

    it('names the withholding on the vendor dashboard while it is on, and stops when it is cleared', async () => {
      const booking = await paidBooking();

      expect((await inject('GET', '/v1/vendor/dashboard', VENDOR)).json().payouts).toMatchObject({
        backupWithholding: false,
      });

      await switchOn(booking.vendorId);
      expect((await inject('GET', '/v1/vendor/dashboard', VENDOR)).json().payouts).toMatchObject({
        backupWithholding: true,
      });

      await clear(booking.vendorId);
      expect((await inject('GET', '/v1/vendor/dashboard', VENDOR)).json().payouts).toMatchObject({
        backupWithholding: false,
      });
    });

    /*
     * A transfer found under the group was made by an earlier attempt whose commit
     * did not land, and the retry records what that attempt withheld: the stamp on
     * the transfer, never today's setting.
     */
    describe('a transfer found from an earlier attempt', () => {
      async function withPlantedTransfer(stamped: number, amountCents: number) {
        const booking = await paidBooking();
        await setShare(booking.id, SHARE_CENTS);
        await harness.stripe.createTransfer({
          bookingId: booking.id,
          attempt: 0,
          amountCents,
          destinationAccountId: VENDOR_ACCOUNT,
          transferGroup: `booking_${booking.requestId}`,
          ...(stamped > 0 ? { backupWithheldCents: stamped } : {}),
        });
        clockNow = AFTER_RELEASE;

        return booking;
      }

      it('records the withholding it made, once, with no second transfer and no reversal', async () => {
        const booking = await withPlantedTransfer(WITHHELD_CENTS, 76_000);
        await switchOn(booking.vendorId);

        expect(await sweep()).toEqual({ released: 1, skipped: 0, failed: 0 });

        expect(harness.stripe.transfers).toHaveLength(1);
        expect(harness.stripe.reversals).toEqual([]);
        expect(await moneyOf(booking.id)).toEqual({
          backupWithheldCents: WITHHELD_CENTS,
          debtNettedCents: 0,
          released: true,
        });
        expect(await withheldRows()).toHaveLength(1);
      });

      it('still records it when the admin cleared withholding after that attempt', async () => {
        const booking = await withPlantedTransfer(WITHHELD_CENTS, 76_000);
        await switchOn(booking.vendorId);
        await clear(booking.vendorId);

        expect(await sweep()).toEqual({ released: 1, skipped: 0, failed: 0 });

        expect(harness.stripe.reversals).toEqual([]);
        expect(await moneyOf(booking.id)).toEqual({
          backupWithheldCents: WITHHELD_CENTS,
          debtNettedCents: 0,
          released: true,
        });
        expect(await withheldRows()).toHaveLength(1);
      });

      it('does not withhold retroactively from a full transfer made before it was switched on', async () => {
        const booking = await withPlantedTransfer(0, SHARE_CENTS);
        await switchOn(booking.vendorId);

        expect(await sweep()).toEqual({ released: 1, skipped: 0, failed: 0 });

        expect(harness.stripe.reversals).toEqual([]);
        expect(await moneyOf(booking.id)).toEqual({
          backupWithheldCents: 0,
          debtNettedCents: 0,
          released: true,
        });
        expect(await withheldRows()).toHaveLength(0);
      });
    });

    describe('after the payout has gone out', () => {
      async function releasedWithheld() {
        const booking = await paidBooking();
        await switchOn(booking.vendorId);
        clockNow = AFTER_RELEASE;
        expect(await sweep()).toEqual({ released: 1, skipped: 0, failed: 0 });

        return booking;
      }

      const WITHHELD_OF_PAYOUT = Math.round((EXPECTED_PAYOUT_CENTS * 2400) / 10_000);

      it('stops counting the withholding a full refund spent, and reports the year as nothing withheld', async () => {
        const booking = await releasedWithheld();
        expect(await yearTotals()).toEqual([{ year: 2026, cents: WITHHELD_OF_PAYOUT }]);
        await harness.database.db
          .update(bookings)
          .set({ status: 'disputed', disputeReason: REPORT })
          .where(eq(bookings.id, booking.id));

        const resolved = await inject('PUT', `/v1/admin/bookings/${booking.id}/dispute`, ADMIN, {
          outcome: 'customer',
        });

        expect(resolved.statusCode).toBe(200);
        // The transfer held the share less the withholding, so that is all that can come back.
        expect(harness.stripe.reversals.map((reversal) => reversal.amountCents)).toEqual([
          EXPECTED_PAYOUT_CENTS - WITHHELD_OF_PAYOUT,
        ]);
        expect(await moneyOf(booking.id)).toMatchObject({ backupWithheldCents: 0 });
        expect(await yearTotals()).toEqual([]);
        // The vendor owes nothing more: they never held the withheld part.
        expect((await currentBooking()).vendorOwedCents).toBe(0);
      });

      it('lowers the withholding once when the unwind is repeated', async () => {
        const booking = await releasedWithheld();
        await harness.database.db
          .update(bookings)
          .set({ status: 'disputed', disputeReason: REPORT })
          .where(eq(bookings.id, booking.id));

        await inject('PUT', `/v1/admin/bookings/${booking.id}/dispute`, ADMIN, {
          outcome: 'customer',
        });
        await inject('PUT', `/v1/admin/bookings/${booking.id}/dispute`, ADMIN, {
          outcome: 'customer',
        });

        expect(await moneyOf(booking.id)).toMatchObject({ backupWithheldCents: 0 });
        expect(harness.stripe.reversals).toHaveLength(1);
      });

      it('bills a lost chargeback only what reached the vendor, and stops counting what the platform kept', async () => {
        const booking = await releasedWithheld();
        const dispute = {
          id: 'dp_lost_withheld',
          reason: 'fraudulent',
          amountCents: PRICE_CENTS,
          paymentIntentId: booking.stripePaymentIntentId!,
        };

        for (const [type, status] of [
          ['charge.dispute.created', 'needs_response'],
          ['charge.dispute.closed', 'lost'],
        ] as const) {
          harness.stripe.disputes.set(dispute.id, { ...dispute, status });
          harness.stripe.nextEvent = { type, accountId: dispute.id, objectId: dispute.id };
          const delivered = await harness.app.inject({
            method: 'POST',
            url: '/webhooks/stripe',
            headers: { 'stripe-signature': 'valid-signature', 'content-type': 'application/json' },
            payload: JSON.stringify({ id: 'evt_dispute', object: 'event' }),
          });

          expect(delivered.statusCode).toBe(200);
        }

        const row = await currentBooking();

        /* What reached them (share less withholding) plus Stripe's $15 dispute fee. */
        expect(row.vendorOwedCents).toBe(EXPECTED_PAYOUT_CENTS - WITHHELD_OF_PAYOUT + 1_500);
        expect(row.backupWithheldCents).toBe(0);
        expect(await yearTotals()).toEqual([]);
      });
    });

    it('does not read the withheld share as a reversal when Stripe echoes the transfer', async () => {
      const booking = await paidBooking();
      await harness.database.db
        .update(bookings)
        .set({
          vendorPayoutCents: SHARE_CENTS,
          stripeTransferId: 'tr_withheld',
          payoutReleasedAt: AFTER_RELEASE,
          backupWithheldCents: WITHHELD_CENTS,
        })
        .where(eq(bookings.id, booking.id));

      expect(
        await lowerReleasedVendorPayout(harness.database.db, 'tr_withheld', 76_000),
      ).toBeNull();
      expect((await currentBooking()).vendorPayoutCents).toBe(SHARE_CENTS);

      expect(await lowerReleasedVendorPayout(harness.database.db, 'tr_withheld', 70_000)).toBe(
        booking.id,
      );
      expect((await currentBooking()).vendorPayoutCents).toBe(94_000);
    });
  });
});
