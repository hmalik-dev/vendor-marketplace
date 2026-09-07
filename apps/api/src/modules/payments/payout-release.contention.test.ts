import { bookings, categories, vendorProfiles } from '@vendor-marketplace/db/schema';
import { addDays, payoutDueThroughDate, toDateString } from '@vendor-marketplace/shared';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  createPostgresTestDatabase,
  type PostgresTestDatabase,
} from '@vendor-marketplace/db/testing/postgres';
import { bearer, createTestHarness, type TestHarness } from '../../testing/test-server.js';
import { releaseDuePayouts } from './payouts.service.js';
import { claimReleasableBooking } from './payouts.dao.js';

/**
 * #423, the idempotency acceptance — the debt the PGlite suite cannot pay.
 *
 * `releaseDuePayouts` claims each booking with `FOR UPDATE SKIP LOCKED` and
 * sends the transfer **inside** that transaction, so a second sweep reaching
 * the same booking skips it and issues no transfer at all. The route suite runs
 * the sweep twice in sequence and passes either way: PGlite is one connection,
 * so its second transaction starts only after the first has finished, and the
 * lock is never load-bearing. Deleting `skipLocked` — or dropping the lock
 * entirely — leaves that test green.
 *
 * This one fires two sweeps with `Promise.all` against a pooled Postgres, where
 * they really do overlap. The failure it catches is the worst one this path
 * has: **two transfers of the same payout**, the vendor paid twice out of
 * Orla's balance, with one booking row that cannot say it happened.
 *
 * The count assertion is the point, not the row state. A second sweep that
 * no-ops because the row already changed and one that never issues the transfer
 * look identical on the booking.
 */
describe('two payout sweeps racing one booking, on two real connections', () => {
  const VENDOR = 'user_vendor';
  const CUSTOMER = 'user_customer';
  const VENDOR_ACCOUNT = 'acct_test_vendor';
  const PRICE_CENTS = 145_000;
  const EXPECTED_PAYOUT_CENTS = 127_600;

  const START = new Date('2026-06-01T12:00:00Z');
  const EVENT_DATE = toDateString(addDays(START, 30));
  /** Past `payoutReleaseAt(EVENT_DATE)` — 72 hours on from the event day (D32). */
  const AFTER_RELEASE = addDays(START, 34);

  let clockNow = START;

  /*
   * Held here rather than inside `beforeAll`, because the harness is what
   * closes it and the harness may not exist: anything that throws between
   * creating the database and building the server would otherwise strand a
   * fully migrated database on the server for good.
   */
  let database: PostgresTestDatabase | undefined;
  let harness: TestHarness<PostgresTestDatabase> | undefined;
  let bookingId: string;

  async function inject(
    method: 'GET' | 'POST' | 'PUT',
    url: string,
    actor: string,
    payload?: Record<string, unknown>,
  ): Promise<Awaited<ReturnType<TestHarness['app']['inject']>>> {
    return harness!.app.inject({
      method,
      url,
      headers: bearer(actor),
      ...(payload ? { payload } : {}),
    });
  }

  function sweep(): ReturnType<typeof releaseDuePayouts> {
    return releaseDuePayouts(
      { db: harness!.database.db, stripe: harness!.stripe, log: harness!.app.log },
      clockNow,
    );
  }

  beforeAll(async () => {
    /*
     * Two is the whole point — one connection per sweep. Four leaves room for
     * the assertions this suite makes while nothing is blocked.
     */
    database = await createPostgresTestDatabase({ poolSize: 4 });
    harness = await createTestHarness({ database, clock: () => clockNow });

    for (const [clerkUserId, role, email] of [
      [VENDOR, 'vendor', 'grace@example.com'],
      [CUSTOMER, 'customer', 'alan@example.com'],
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

    harness.stripe.accountStatuses.set(VENDOR_ACCOUNT, {
      transfersActive: true,
      payoutsActive: true,
    });

    const [photography] = await harness.database.db
      .select({ id: categories.id })
      .from(categories)
      .where(eq(categories.slug, 'photography'))
      .limit(1);

    const profile = await inject('POST', '/vendor/profile', VENDOR, {
      businessName: 'Sunlit Studio',
      categoryIds: [photography!.id],
      city: 'Austin',
      state: 'TX',
      bio: 'Documentary wedding photography for people who hate posing.',
    });
    expect(profile.statusCode).toBe(201);
    const vendorId: string = profile.json().id;

    const servicePackage = await inject('POST', '/vendor/packages', VENDOR, {
      name: 'Full day coverage',
      description: 'Six hours of coverage with two photographers on site.',
      priceCents: PRICE_CENTS,
      priceType: 'fixed',
      inclusions: ['6 hours', '2 photographers'],
    });
    expect(servicePackage.statusCode).toBe(201);

    await harness.database.db
      .update(vendorProfiles)
      .set({ isPublished: true, stripeOnboarded: true, stripeAccountId: VENDOR_ACCOUNT })
      .where(eq(vendorProfiles.id, vendorId));

    const request = await inject('POST', '/booking-requests', CUSTOMER, {
      vendorId,
      packageId: servicePackage.json().id,
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

    const [booking] = await harness.database.db.select().from(bookings);
    bookingId = booking!.id;
    expect(booking!.payoutReleasedAt).toBeNull();

    clockNow = AFTER_RELEASE;
  });

  afterAll(async () => {
    // `afterAll` still runs when `beforeAll` threw, so both halves are guarded
    // — and the database is closed directly when no harness ever took it.
    if (harness) {
      await harness.close();
    } else {
      await database?.close();
    }
  });

  /**
   * The lock's own tripwire, and the reason it is a separate test from the
   * sweep race below.
   *
   * Racing two whole sweeps does **not** reliably reach the lock: when the
   * winner commits before the loser's id scan runs, the loser finds nothing
   * due and never reaches the claim, so deleting `FOR UPDATE SKIP LOCKED`
   * leaves that race green about half the time. Measured, not assumed — six
   * runs with the lock removed came back 3 red, 3 green. A guard that catches
   * a deleted lock half the time is not a guard.
   *
   * So this holds the two claims open against each other instead. The first
   * transaction takes the row and does not commit until the second has tried,
   * which is the state a real sweep is in while its Stripe call is in flight.
   * Both failure modes are then distinguishable:
   *
   * - **no lock at all** — the second claim returns the row, and the assertion
   *   that exactly one of them got it goes red;
   * - **`FOR UPDATE` without `SKIP LOCKED`** — the second claim blocks behind
   *   the first instead of moving on, which is why it is raced against a timer
   *   and asserted to have *answered* rather than merely to have answered
   *   `null`. That distinction is the whole point of `SKIP LOCKED`: a sweep
   *   must never queue behind a transaction holding a network call open.
   */
  it('hands one concurrent claim the row and the other nothing, without blocking it', async () => {
    const dueThroughDate = payoutDueThroughDate(clockNow);
    let releaseFirst: () => void = () => undefined;
    const firstMayCommit = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    /*
     * The second claim is not started until the first has actually taken the
     * row. Both transactions merely being *open* is not enough — they would
     * race to issue their SELECT, and the "first" one lost that race often
     * enough to make this test flaky on its own first draft.
     */
    let firstHasClaimed: () => void = () => undefined;
    const claimed = new Promise<void>((resolve) => {
      firstHasClaimed = resolve;
    });

    const first = harness!.database.db.transaction(async (tx) => {
      const row = await claimReleasableBooking(tx, bookingId, dueThroughDate);
      firstHasClaimed();
      await firstMayCommit;

      return row;
    });

    await claimed;

    /*
     * Long enough that a claim which merely had to wait its turn on the network
     * would have answered, short enough that a *blocked* one cannot. The first
     * transaction is holding its lock and doing nothing else, so a `SKIP
     * LOCKED` claim returns immediately and only a queued one can time out.
     */
    const BLOCKED = Symbol('blocked');
    const second = await Promise.race([
      harness!.database.db.transaction(async (tx) =>
        claimReleasableBooking(tx, bookingId, dueThroughDate),
      ),
      new Promise<typeof BLOCKED>((resolve) => setTimeout(() => resolve(BLOCKED), 2_000)),
    ]);

    releaseFirst();
    const winner = await first;

    expect(second, 'the second claim queued behind the first instead of skipping it').not.toBe(
      BLOCKED,
    );
    expect(winner?.id).toBe(bookingId);
    expect(second).toBeNull();
  });

  it('transfers exactly once, and the loser issues no transfer at all', async () => {
    const [first, second] = await Promise.all([sweep(), sweep()]);

    /*
     * **Exactly one release between the two sweeps.** Both reporting `released`
     * is what a missing row lock produces, and it is the assertion that goes
     * red when `FOR UPDATE SKIP LOCKED` is deleted from `claimReleasableBooking`
     * — verified by deleting it.
     *
     * The *loser's* shape is deliberately not asserted, and that was a real bug
     * in this test's first draft. It required the loser to report `skipped`,
     * which assumes it got as far as the claim; when the winner commits before
     * the loser's id scan runs, the loser finds nothing due and reports all
     * zeroes instead. Both are correct and which one happens is a timing
     * detail, so pinning it made a green suite depend on the losing connection
     * being slow — a flake on the money path, which is the one place a retry
     * budget is not an answer.
     */
    expect(first.released + second.released).toBe(1);
    expect(first.failed + second.failed).toBe(0);

    /*
     * The assertion the acceptance is written against. Stripe's idempotency key
     * would dedupe a second call, so a suite that only checked the booking row
     * or the transfer *ids* could not tell a sweep that skipped from one that
     * asked twice and was refused. The loser never asked.
     */
    expect(harness!.stripe.transfers).toHaveLength(1);
    expect(harness!.stripe.transfers[0]).toMatchObject({
      bookingId,
      amountCents: EXPECTED_PAYOUT_CENTS,
      destinationAccountId: VENDOR_ACCOUNT,
    });
  });

  it('leaves one released booking carrying the transfer that was made', async () => {
    const [row] = await harness!.database.db
      .select()
      .from(bookings)
      .where(eq(bookings.id, bookingId));

    expect(row?.payoutReleasedAt).not.toBeNull();
    expect(row?.stripeTransferId).toBe(harness!.stripe.transfers[0]!.transferId);
    // A skip is not a failure, and must not be recorded as one.
    expect(row?.payoutAttempts).toBe(0);
    expect(row?.payoutFailureReason).toBeNull();
  });

  /* A third sweep, after the race, still issues nothing. */
  it('stays at one transfer on every later run', async () => {
    await sweep();

    expect(harness!.stripe.transfers).toHaveLength(1);
  });
});
