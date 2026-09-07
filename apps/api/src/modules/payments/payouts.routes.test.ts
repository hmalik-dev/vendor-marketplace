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
import { addDays, payoutReleaseAt, toDateString } from '@vendor-marketplace/shared';
import { eq } from 'drizzle-orm';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { bearer, createTestHarness, type TestHarness } from '../../testing/test-server.js';
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

      const response = await inject('PUT', `/customer/bookings/${paid.id}/dispute`, CUSTOMER, {
        reason: 'The photographer never arrived.',
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().status).toBe('disputed');

      const row = await currentBooking();
      expect(row.status).toBe('disputed');
      expect(row.disputeReason).toBe('The photographer never arrived.');
    });

    it('refuses a report before the event, where cancelling is the right move', async () => {
      const paid = await paidBooking();

      const response = await inject('PUT', `/customer/bookings/${paid.id}/dispute`, CUSTOMER, {});

      expect(response.statusCode).toBe(409);
      expect(response.json().message).toBe(
        'That event has not happened yet — cancel the booking instead',
      );
    });

    it('refuses the vendor reporting a problem with their own booking', async () => {
      const paid = await paidBooking();
      clockNow = JUST_AFTER_EVENT;

      expect(
        (await inject('PUT', `/customer/bookings/${paid.id}/dispute`, VENDOR, {})).statusCode,
      ).toBe(403);
    });

    /* A stranger walking ids learns nothing about which of them exist. */
    it('answers 404 to somebody who is not a party to the booking', async () => {
      const paid = await paidBooking();
      clockNow = JUST_AFTER_EVENT;

      expect(
        (await inject('PUT', `/customer/bookings/${paid.id}/dispute`, OUTSIDER, {})).statusCode,
      ).toBe(404);
    });

    /* #423 acceptance 9 — and with no time limit that would release it. */
    it('skips a disputed booking for as long as it is disputed', async () => {
      const paid = await paidBooking();
      clockNow = JUST_AFTER_EVENT;
      await inject('PUT', `/customer/bookings/${paid.id}/dispute`, CUSTOMER, {});

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
      await inject('PUT', `/customer/bookings/${paid.id}/dispute`, CUSTOMER, {});
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
      await inject('PUT', `/customer/bookings/${paid.id}/dispute`, CUSTOMER, {});

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
      await inject('PUT', `/customer/bookings/${paid.id}/dispute`, CUSTOMER, {});
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

      const response = await inject(
        'PUT',
        `/customer/bookings/${released.id}/dispute`,
        CUSTOMER,
        {},
      );

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
      await inject('PUT', `/customer/bookings/${paid.id}/dispute`, CUSTOMER, {});

      const response = await inject('PUT', `/customer/bookings/${paid.id}/dispute`, CUSTOMER, {});

      expect(response.statusCode).toBe(409);
      expect(response.json().message).toBe('You have already reported a problem with this booking');
    });

    /* The hold is real on the vendor's side too: they cannot complete out of it. */
    it('tells the vendor a disputed booking is on hold rather than calling it cancelled', async () => {
      const paid = await paidBooking();
      clockNow = JUST_AFTER_EVENT;
      await inject('PUT', `/customer/bookings/${paid.id}/dispute`, CUSTOMER, {});

      const response = await inject('PUT', `/vendor/bookings/${paid.id}/complete`, VENDOR);

      expect(response.statusCode).toBe(409);
      expect(response.json().message).toBe(
        'The customer has raised a problem with this booking, so it is on hold until that is resolved',
      );
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
      const paid = await paidBooking();

      const response = await inject('GET', '/vendor/dashboard', VENDOR);

      expect(response.statusCode).toBe(200);
      const payout = response.json().nextPayout;
      expect(payout).toMatchObject({
        bookingId: paid.id,
        eventDate: EVENT_DATE,
        // The stored figure, not a recomputed fee.
        vendorPayoutCents: EXPECTED_PAYOUT_CENTS,
        status: 'pending',
      });
      /*
       * The same helper the sweep pays on, so the date a vendor is shown and
       * the date they are paid cannot drift. The suite derives it rather than
       * hard-coding a day, because a hard-coded one would keep passing if the
       * two ever came apart.
       */
      expect(new Date(payout.releaseAt as string).toISOString()).toBe(
        payoutReleaseAt(EVENT_DATE)!.toISOString(),
      );
    });

    /* #423 acceptance 16 — held is distinguishable from pending, in the data. */
    it('says a payout is held rather than pending while a report is open', async () => {
      const paid = await paidBooking();
      clockNow = JUST_AFTER_EVENT;
      await inject('PUT', `/customer/bookings/${paid.id}/dispute`, CUSTOMER, {});

      const response = await inject('GET', '/vendor/dashboard', VENDOR);

      expect(response.json().nextPayout).toMatchObject({
        bookingId: paid.id,
        vendorPayoutCents: EXPECTED_PAYOUT_CENTS,
        status: 'held',
      });
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

      expect((await inject('GET', '/vendor/dashboard', VENDOR)).json().nextPayout).toMatchObject({
        bookingId: paid.id,
        status: 'pending',
      });
    });

    it('names nothing once the payout has gone out', async () => {
      await releasedBooking();

      expect((await inject('GET', '/vendor/dashboard', VENDOR)).json().nextPayout).toBeNull();
    });
  });
});
