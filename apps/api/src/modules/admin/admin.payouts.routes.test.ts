import {
  adminActions,
  bookingRequests,
  bookings,
  categories,
  users,
  vendorCategories,
  vendorProfiles,
} from '@vendor-marketplace/db/schema';
import type { AdminActionRow } from '@vendor-marketplace/db/schema';
import { eq } from 'drizzle-orm';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { bearer, createTestHarness, type TestHarness } from '../../testing/test-server.js';

/**
 * Payout health on the operations console — #432.
 *
 * Its own file rather than another block in `admin.routes.test.ts`, for the
 * reason `admin.activity.routes.test.ts` gives: that file is 1,500 lines and
 * three lanes are appending to it this week. The subject here is also
 * orthogonal to what it asserts — not "does the list paginate" but "does the
 * console tell an operator that money stopped moving, and can they do anything
 * about it".
 *
 * The payout columns are written directly rather than driven through checkout
 * and the sweep. That path is already asserted end to end in
 * `payouts.routes.test.ts`; what is under test here is the console's reading of
 * the row it leaves behind, and reaching those states through the real flow
 * would make each case a fifty-line fixture that proves the same thing twice.
 * The one exception is the retry, which goes through the real gateway double so
 * the D36 key is a genuine assertion rather than a restated one.
 */
const ADMIN = 'user_payouts_admin';
const VENDOR = 'user_payouts_vendor';
const CUSTOMER = 'user_payouts_customer';

const VENDOR_ACCOUNT = 'acct_test_payout_vendor';

/** Pinned, because every predicate here is about which side of a date a row is on. */
const NOW = new Date('2026-06-30T12:00:00Z');
/** Comfortably past `PAYOUT_RELEASE_HOURS` before `NOW`, so a payout is due. */
const DUE_EVENT_DATE = '2026-06-01';
/** After `NOW`, so the payout window has not opened. */
const FUTURE_EVENT_DATE = '2026-09-01';

const TOTAL_CENTS = 145_000;
const FEE_CENTS = 17_400;
const PAYOUT_CENTS = 127_600;

describe('admin payout health', () => {
  let harness: TestHarness;
  let photographyId: string;
  let vendorProfileId: string;
  let customerId: string;
  let adminId: string;

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

  /** A published vendor whose connected account Stripe will accept a transfer to. */
  async function createVendorProfile(): Promise<string> {
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

    const profileId: string = created.json().id;
    await harness.database.db
      .update(vendorProfiles)
      .set({ isPublished: true, stripeOnboarded: true, stripeAccountId: VENDOR_ACCOUNT })
      .where(eq(vendorProfiles.id, profileId));

    return profileId;
  }

  interface BookingOverrides {
    status?: 'confirmed' | 'completed' | 'cancelled' | 'disputed';
    eventDate?: string;
    payoutAttempts?: number;
    payoutFailureReason?: string | null;
    payoutReleasedAt?: Date | null;
    stripeTransferId?: string | null;
    vendorPayoutCents?: number;
  }

  /**
   * A paid booking, in whatever payout state the case under test needs.
   *
   * The intent id is drawn from a counter rather than from `Math.random`:
   * `stripe_payment_intent_id` is unique, and a fixture that collides once in a
   * while is a flake with no root cause to find.
   */
  let intentSequence = 0;

  async function paidBooking(overrides: BookingOverrides = {}): Promise<string> {
    const eventDate = overrides.eventDate ?? DUE_EVENT_DATE;
    intentSequence += 1;

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

    const rows = await harness.database.db
      .insert(bookings)
      .values({
        requestId: requestRows[0]!.id,
        customerId,
        vendorId: vendorProfileId,
        eventDate,
        totalAmountCents: TOTAL_CENTS,
        platformFeeCents: FEE_CENTS,
        vendorPayoutCents: overrides.vendorPayoutCents ?? PAYOUT_CENTS,
        status: overrides.status ?? 'confirmed',
        payoutModel: 'separate',
        stripePaymentIntentId: `pi_test_${intentSequence}`,
        paidAt: new Date('2026-05-01T00:00:00Z'),
        payoutAttempts: overrides.payoutAttempts ?? 0,
        payoutFailureReason: overrides.payoutFailureReason ?? null,
        payoutReleasedAt: overrides.payoutReleasedAt ?? null,
        stripeTransferId: overrides.stripeTransferId ?? null,
      })
      .returning({ id: bookings.id });

    return rows[0]!.id;
  }

  async function payments(query = ''): Promise<Awaited<ReturnType<TestHarness['app']['inject']>>> {
    return harness.app.inject({
      method: 'GET',
      url: `/admin/payments${query}`,
      headers: bearer(ADMIN),
    });
  }

  async function retry(
    bookingId: string,
    actor: string = ADMIN,
  ): Promise<Awaited<ReturnType<TestHarness['app']['inject']>>> {
    return harness.app.inject({
      method: 'PUT',
      url: `/admin/bookings/${bookingId}/payout/retry`,
      headers: bearer(actor),
    });
  }

  async function actionRows(): Promise<AdminActionRow[]> {
    return harness.database.db.select().from(adminActions);
  }

  beforeAll(async () => {
    harness = await createTestHarness({ clock: () => NOW });

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

  beforeEach(async () => {
    /*
     * The double refuses a transfer to an account without `stripe_transfers`,
     * exactly as Stripe does — #387's failure, where a fixture account every
     * column-shaped check read as payment-capable was refused outright.
     */
    harness.stripe.accountStatuses.set(VENDOR_ACCOUNT, {
      transfersActive: true,
      payoutsActive: true,
    });

    adminId = await signIn(ADMIN, true);
    await signIn(VENDOR);
    customerId = await signIn(CUSTOMER);
    vendorProfileId = await createVendorProfile();
  });

  afterEach(async () => {
    harness.stripe.transfers.length = 0;
    harness.stripe.transfersToRefuse.clear();
    harness.stripe.failedTransferKeys.clear();
    harness.stripe.accountStatuses.clear();
    await harness.database.db.delete(bookings);
    await harness.database.db.delete(bookingRequests);
    await harness.database.db.delete(vendorCategories);
    await harness.database.db.delete(vendorProfiles);
    /*
     * `admin_actions` is append-only by trigger: it refuses a direct DELETE
     * while the operator it names still exists, and lets the `actor_id` cascade
     * through when the account itself is erased (#434). Deleting `users` is
     * therefore what clears it, and clearing it first would be the tampering
     * the trigger exists to refuse.
     */
    await harness.database.db.delete(users);
  });

  afterAll(async () => {
    await harness.close();
  });

  /* Acceptance 1 and 2. */
  describe('the payments row', () => {
    it('derives the payout state with the shared derivation', async () => {
      await paidBooking({
        payoutReleasedAt: new Date('2026-06-05T00:00:00Z'),
        stripeTransferId: 'tr_1',
      });

      const response = await payments();

      expect(response.statusCode).toBe(200);
      expect(response.json().items[0]).toMatchObject({
        payoutStatus: 'released',
        stripeTransferId: 'tr_1',
        payoutFailing: false,
      });
    });

    /*
     * `held` rather than `pending`, and derived from membership in
     * `HELD_PAYOUT_STATUSES` rather than from `status === 'disputed'` here —
     * that is the whole reason `payoutStatusOf` exists.
     */
    it('reports a disputed booking as held rather than pending', async () => {
      await paidBooking({ status: 'disputed' });

      const response = await payments();

      expect(response.json().items[0]).toMatchObject({ payoutStatus: 'held' });
    });

    it('reports a booking nobody has reached as pending and not failing', async () => {
      await paidBooking();

      expect((await payments()).json().items[0]).toMatchObject({
        payoutStatus: 'pending',
        payoutAttempts: 0,
        payoutFailureReason: null,
        payoutFailing: false,
      });
    });

    /**
     * The flag is on the row, not only inside the filter.
     *
     * The failure #415 fixed was precisely a state you had to already know
     * about in order to find it, so an operator scanning the unfiltered table
     * has to see this without knowing the filter exists.
     */
    it('flags a failing payout on the unfiltered list', async () => {
      await paidBooking({ payoutAttempts: 3, payoutFailureReason: 'Stripe said no' });

      expect((await payments()).json().items[0]).toMatchObject({
        payoutStatus: 'pending',
        payoutAttempts: 3,
        payoutFailureReason: 'Stripe said no',
        payoutFailing: true,
      });
    });

    it('finds only the failing payouts under the filter, and counts them the same way', async () => {
      const failing = await paidBooking({
        payoutAttempts: 2,
        payoutFailureReason: 'Stripe said no',
      });
      await paidBooking();
      await paidBooking({ payoutReleasedAt: new Date('2026-06-05T00:00:00Z') });

      const unfiltered = await payments();
      expect(unfiltered.json().total).toBe(3);

      const filtered = await payments('?flag=payout-failing');
      expect(filtered.statusCode).toBe(200);

      const body = filtered.json();
      expect(body.total).toBe(1);
      expect(body.items).toHaveLength(1);
      expect(body.items[0].bookingId).toBe(failing);
    });

    /**
     * A row the sweep will never work again is **finished, not failing**.
     *
     * A full refund rewrites `vendor_payout_cents` to `0` (D37) and leaves the
     * release null, so a flag reading `payout_attempts > 0 and not released`
     * would hold that row in the operator's failing list for ever — under an
     * alert promising that the scheduled release keeps trying, about a booking
     * it has permanently dropped, behind a Retry button answered 409.
     */
    it('does not flag a failed payout that was then fully refunded', async () => {
      await paidBooking({
        status: 'cancelled',
        payoutAttempts: 4,
        payoutFailureReason: 'Stripe said no',
        vendorPayoutCents: 0,
      });

      expect((await payments()).json().items[0]).toMatchObject({ payoutFailing: false });
      expect((await payments('?flag=payout-failing')).json().total).toBe(0);
    });

    /*
     * A dispute filed after a failed attempt is `held`, and saying "Transfer
     * failing" over it is the confusion `payoutStatusOf` exists to prevent.
     */
    it('reports a disputed booking with a failed attempt as held, not failing', async () => {
      await paidBooking({ status: 'disputed', payoutAttempts: 2, payoutFailureReason: 'nope' });

      expect((await payments()).json().items[0]).toMatchObject({
        payoutStatus: 'held',
        payoutFailing: false,
      });
      expect((await payments('?flag=payout-failing')).json().total).toBe(0);
    });

    /* A released payout with attempts behind it is settled, not failing. */
    it('does not flag a payout that failed and then landed', async () => {
      await paidBooking({
        payoutAttempts: 2,
        payoutReleasedAt: new Date('2026-06-05T00:00:00Z'),
        stripeTransferId: 'tr_2',
      });

      expect((await payments()).json().items[0]).toMatchObject({
        payoutStatus: 'released',
        payoutAttempts: 2,
        payoutFailing: false,
      });
    });
  });

  /* Acceptance 3. */
  describe('the retry', () => {
    /**
     * **The D36 assertion, driven rather than restated.**
     *
     * The first attempt is refused and the double caches that refusal under its
     * key, exactly as Stripe does for 24 hours. A retry that reused
     * `payout_<bookingId>_0` would be answered from that cache with the same
     * error, and the operator would press the button and learn nothing.
     */
    it('mints a key versioned by the attempt and releases the payout', async () => {
      const bookingId = await paidBooking({
        payoutAttempts: 1,
        payoutFailureReason: 'Stripe refused the transfer',
      });
      harness.stripe.failedTransferKeys.set(`payout_${bookingId}_0`, 'Stripe refused the transfer');

      const response = await retry(bookingId);

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        outcome: 'released',
        payoutStatus: 'released',
        payoutFailureReason: null,
        payoutFailing: false,
      });
      expect(harness.stripe.transfers).toHaveLength(1);
      expect(harness.stripe.transfers[0]?.idempotencyKey).toBe(`payout_${bookingId}_1`);
      expect(harness.stripe.transfers[0]?.amountCents).toBe(PAYOUT_CENTS);
    });

    it('counts the attempt and returns the new reason when it fails again', async () => {
      const bookingId = await paidBooking({ payoutAttempts: 1 });
      harness.stripe.transfersToRefuse.add(bookingId);

      const response = await retry(bookingId);

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        outcome: 'failed',
        payoutStatus: 'pending',
        payoutAttempts: 2,
        payoutFailing: true,
      });
      expect(response.json().payoutFailureReason).toContain('refused a transfer');
    });

    it('refuses a released payout, and says which', async () => {
      const bookingId = await paidBooking({
        payoutReleasedAt: new Date('2026-06-05T00:00:00Z'),
        stripeTransferId: 'tr_3',
      });

      const response = await retry(bookingId);

      expect(response.statusCode).toBe(409);
      expect(response.json().message).toBe(
        'This payout has already been released, so there is nothing to retry',
      );
      expect(harness.stripe.transfers).toEqual([]);
    });

    it('refuses a disputed payout, and says which', async () => {
      const response = await retry(await paidBooking({ status: 'disputed' }));

      expect(response.statusCode).toBe(409);
      expect(response.json().message).toBe(
        'This payout is on hold while the reported problem is being resolved',
      );
    });

    it('refuses a cancelled booking, and says which', async () => {
      const response = await retry(await paidBooking({ status: 'cancelled' }));

      expect(response.statusCode).toBe(409);
      expect(response.json().message).toContain('This booking was cancelled');
    });

    it('refuses a payout whose window has not closed, and says which', async () => {
      const response = await retry(await paidBooking({ eventDate: FUTURE_EVENT_DATE }));

      expect(response.statusCode).toBe(409);
      expect(response.json().message).toContain('This payout is not due yet');
    });

    it('answers 404 for a booking that does not exist', async () => {
      const response = await retry('00000000-0000-4000-8000-000000000000');

      expect(response.statusCode).toBe(404);
    });

    it('refuses a customer, who must not be able to move money', async () => {
      const bookingId = await paidBooking({ payoutAttempts: 1 });

      expect((await retry(bookingId, CUSTOMER)).statusCode).toBe(403);
      expect(harness.stripe.transfers).toEqual([]);
    });

    /* #434: every mutating console route names the operator who made it. */
    it('records which operator retried it, with the outcome and the attempt', async () => {
      const bookingId = await paidBooking({ payoutAttempts: 1 });

      expect((await retry(bookingId)).statusCode).toBe(200);

      const rows = await actionRows();
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        actorId: adminId,
        action: 'payout_retried',
        subjectType: 'booking',
        subjectId: bookingId,
        detail: { outcome: 'released', attempt: 1 },
      });
    });

    it('writes no action row for a retry it refused', async () => {
      await retry(await paidBooking({ status: 'disputed' }));

      expect(await actionRows()).toEqual([]);
    });
  });

  /* Acceptance 6 and 7 — every number a query result at request time. */
  describe('the overview count', () => {
    async function metrics(): Promise<{
      payoutsBlockedVendorsCount: number;
      payoutsFailingBookingsCount: number;
    }> {
      const response = await harness.app.inject({
        method: 'GET',
        url: '/admin/metrics',
        headers: bearer(ADMIN),
      });
      expect(response.statusCode).toBe(200);

      return response.json();
    }

    it('counts nothing when every payout is healthy', async () => {
      await paidBooking();
      await paidBooking({ payoutReleasedAt: new Date('2026-06-05T00:00:00Z') });

      expect(await metrics()).toMatchObject({
        payoutsBlockedVendorsCount: 0,
        payoutsFailingBookingsCount: 0,
      });
    });

    it('counts the failing transfers and the vendors they belong to', async () => {
      await paidBooking({ payoutAttempts: 1 });
      await paidBooking({ payoutAttempts: 4 });
      await paidBooking();

      expect(await metrics()).toMatchObject({
        // One vendor, however many of their transfers are failing.
        payoutsBlockedVendorsCount: 1,
        payoutsFailingBookingsCount: 2,
      });
    });

    /**
     * **The two numbers describe one set, and the link proves it.**
     *
     * The count used to be taken over a wider predicate than the list it points
     * at, which is a banner that lies by arithmetic: "1 vendor is owed money we
     * cannot send", clicked, and a list of everyone who never onboarded. This
     * asserts the identity rather than the arithmetic, so widening one without
     * the other goes red.
     */
    it('counts exactly the rows its link lands on', async () => {
      await paidBooking({ payoutAttempts: 1 });
      await paidBooking({ status: 'cancelled', payoutAttempts: 4, vendorPayoutCents: 0 });
      await paidBooking({ payoutReleasedAt: new Date('2026-06-05T00:00:00Z') });
      await paidBooking();

      const { payoutsFailingBookingsCount } = await metrics();
      const filtered = await payments('?flag=payout-failing');

      expect(payoutsFailingBookingsCount).toBe(1);
      expect(filtered.json().total).toBe(payoutsFailingBookingsCount);
    });

    /**
     * A vendor who is not onboarded and owed nothing is nobody's emergency.
     *
     * The count is "money we cannot send", not "accounts that have not finished
     * onboarding" — most of the latter have never taken a booking, and a card
     * that led an operator to them every morning would be noise.
     */
    it('ignores a blocked vendor with no outstanding payout', async () => {
      await paidBooking({ payoutReleasedAt: new Date('2026-06-05T00:00:00Z') });
      await harness.database.db
        .update(vendorProfiles)
        .set({ stripeOnboarded: false, stripeAccountId: null })
        .where(eq(vendorProfiles.id, vendorProfileId));

      expect(await metrics()).toMatchObject({
        payoutsBlockedVendorsCount: 0,
        payoutsFailingBookingsCount: 0,
      });
    });
  });

  /* Acceptance 4 and 5 — the reason, surfaced, and never written from here. */
  describe('the vendor row', () => {
    async function vendorRow(): Promise<Record<string, unknown>> {
      const response = await harness.app.inject({
        method: 'GET',
        url: '/admin/vendors',
        headers: bearer(ADMIN),
      });
      expect(response.statusCode).toBe(200);

      return response.json().items[0];
    }

    it('shows the disabled reason and the outstanding requirements Stripe reported', async () => {
      await harness.database.db
        .update(vendorProfiles)
        .set({
          stripeOnboarded: false,
          stripeDisabledReason: 'requirements_past_due',
          stripeRequirementsDue: ['individual.id_number'],
        })
        .where(eq(vendorProfiles.id, vendorProfileId));

      expect(await vendorRow()).toMatchObject({
        stripeOnboarded: false,
        stripeAccountId: VENDOR_ACCOUNT,
        stripeDisabledReason: 'requirements_past_due',
        stripeRequirementsDue: ['individual.id_number'],
      });
    });

    /*
     * The complaint #432 opens with: the console said "No payouts yet" for a
     * vendor who never connected and for one Stripe restricted this morning,
     * and a boolean cannot separate them. These three fields do.
     */
    it('reads differently for a vendor who never onboarded', async () => {
      await harness.database.db
        .update(vendorProfiles)
        .set({ stripeOnboarded: false, stripeAccountId: null })
        .where(eq(vendorProfiles.id, vendorProfileId));

      expect(await vendorRow()).toMatchObject({
        stripeOnboarded: false,
        stripeAccountId: null,
        stripeDisabledReason: null,
        stripeRequirementsDue: [],
      });
    });

    /**
     * Acceptance 5, asserted against the plugin source.
     *
     * A console that wrote `stripe_onboarded` would make the column a guess:
     * D29 constrains the pair, and the value is derived from Stripe's
     * capability read by the account webhook. There is no admin route to point
     * a request at, so the claim can only be "this module holds no writer for
     * it", and only the source can answer that.
     *
     * The needle is `.set({ … })` — Drizzle's **write** — rather than the
     * column name, which every file here mentions while reading it and
     * explaining at length why it does not write it. A grep for the name would
     * be a guard that cannot fail.
     */
    it('holds no writer for the Stripe state in the whole admin module', async () => {
      const { readFile } = await import('node:fs/promises');
      const files = ['./admin.routes.ts', './admin.service.ts', './admin.dao.ts'] as const;
      const derived = [
        'stripeOnboarded',
        'stripeAccountId',
        'stripeDisabledReason',
        'stripeRequirementsDue',
      ];

      for (const file of files) {
        const source = await readFile(new URL(file, import.meta.url).pathname, 'utf8');
        const updates = source.match(/\.set\(\{[\s\S]*?\}\)/g) ?? [];

        for (const update of updates) {
          for (const column of derived) {
            expect(update, `${file} writes ${column}`).not.toContain(column);
          }
        }
      }
    });

    /* The needle above finds a write when there is one — proof it can fail. */
    it('would catch such a writer if one were added', () => {
      const planted = `await db.update(vendorProfiles).set({ stripeOnboarded: true });`;
      const updates = planted.match(/\.set\(\{[\s\S]*?\}\)/g) ?? [];

      expect(updates).toHaveLength(1);
      expect(updates[0]).toContain('stripeOnboarded');
    });
  });
});
