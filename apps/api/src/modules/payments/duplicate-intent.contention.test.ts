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
import { eq, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  createPostgresTestDatabase,
  type PostgresTestDatabase,
} from '@vendor-marketplace/db/testing/postgres';
import { bearer, createTestHarness, type TestHarness } from '../../testing/test-server.js';
import { recordSuccessfulPayment, type PaymentContext } from './payments.service.js';
import { releaseDuePayouts } from './payouts.service.js';
import { reconcileRefundedIntent } from './refund-reconciliation.js';

/**
 * VEN-471: two paid intents for one request, delivered at the same moment.
 *
 * `recordSuccessfulPayment` asks "is there a booking already?" and only then
 * inserts, so two deliveries for two *different* intents can both see none. The
 * unique index on `request_id` lets one insert win; the loser used to read the
 * winner's row and answer 200 `already-booked` without asking whose intent made
 * it. Stripe never redelivers a 200, so the second charge stayed in the platform
 * balance with nothing pointing at it.
 *
 * PGlite is one connection and cannot interleave the two reads, so this needs a
 * real Postgres. The first test builds the interleaving exactly: it holds the
 * winner's insert uncommitted, so the loser reads no booking, reaches its own
 * insert and blocks on the unique index until the winner commits.
 */
describe('two payment intents succeeding for one request, on real connections', () => {
  const VENDOR = 'user_vendor';
  const CUSTOMER = 'user_customer';
  const PRICE_CENTS = 145_000;
  const PLATFORM_FEE_RATE = 0.12;
  const LOCK_WAIT_ATTEMPTS = 500;
  const RACE_ROUNDS = 40;

  const START = new Date('2026-06-01T12:00:00Z');

  let database: PostgresTestDatabase | undefined;
  let harness: TestHarness<PostgresTestDatabase> | undefined;
  let vendorProfileId: string;
  let packageId: string;
  let daysOut = 30;
  const dispatch = vi.fn();

  async function inject(
    method: 'POST',
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

  function context(): PaymentContext {
    const db = harness!.database.db;

    return {
      db,
      stripe: harness!.stripe,
      hub: harness!.app.events,
      log: harness!.app.log,
      mail: {
        db,
        email: harness!.email,
        log: harness!.app.log,
        webOrigin: 'http://localhost:3000',
        background: harness!.app.background,
      },
      alerts: { dispatch },
      platformFeeRate: PLATFORM_FEE_RATE,
    };
  }

  /** An accepted request on its own event date, and the intent its checkout opened. */
  async function checkedOutRequest(): Promise<{ requestId: string; firstIntentId: string }> {
    daysOut += 1;
    const request = await inject('POST', '/v1/booking-requests', CUSTOMER, {
      vendorId: vendorProfileId,
      packageId,
      eventDate: toDateString(addDays(START, daysOut)),
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

    return { requestId, firstIntentId: checkout.json().paymentIntentId };
  }

  /** A second intent for the same request, as a reopened checkout mints one. */
  async function secondIntent(requestId: string): Promise<string> {
    harness!.stripe.intentsByKey.clear();
    const stray = await harness!.stripe.createPaymentIntent({
      requestId,
      replacements: 0,
      amountCents: PRICE_CENTS,
      customerId: 'cus_test',
      vendorId: 'ven_test',
    });

    return stray.id;
  }

  async function bookingsFor(requestId: string): Promise<(typeof bookings.$inferSelect)[]> {
    return harness!.database.db.select().from(bookings).where(eq(bookings.requestId, requestId));
  }

  /** Holds until some other connection is parked waiting on a lock. */
  async function untilAConnectionWaitsOnALock(): Promise<void> {
    for (let attempt = 0; attempt < LOCK_WAIT_ATTEMPTS; attempt += 1) {
      const result = await harness!.database.db.execute(
        sql`select count(*)::int as waiting from pg_stat_activity where wait_event_type = 'Lock'`,
      );
      /* postgres-js answers the row array itself. */
      const rows = result as unknown as { waiting: number }[];

      if ((rows[0]?.waiting ?? 0) > 0) {
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 10));
    }

    throw new Error('No connection ever waited on the winner’s insert');
  }

  /** Holds until both deliveries are parked on an advisory lock in this database. */
  async function untilDeliveriesWaitOnTheRequestLock(): Promise<void> {
    for (let attempt = 0; attempt < LOCK_WAIT_ATTEMPTS; attempt += 1) {
      const result = await harness!.database.db.execute(
        sql`select count(*)::int as waiting from pg_stat_activity
            where wait_event = 'advisory' and datname = current_database()`,
      );
      const rows = result as unknown as { waiting: number }[];

      if ((rows[0]?.waiting ?? 0) >= 2) {
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 10));
    }

    throw new Error('Both deliveries never waited on the request lock');
  }

  beforeAll(async () => {
    database = await createPostgresTestDatabase({ poolSize: 6 });
    harness = await createTestHarness({ database, clock: () => START });

    for (const [authUserId, role, email] of [
      [VENDOR, 'vendor', 'grace@example.com'],
      [CUSTOMER, 'customer', 'alan@example.com'],
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

    harness.stripe.accountStatuses.set('acct_test_vendor', {
      transfersActive: true,
      payoutsActive: true,
    });

    const [photography] = await harness.database.db
      .select({ id: categories.id })
      .from(categories)
      .where(eq(categories.slug, 'photography'))
      .limit(1);

    const profile = await inject('POST', '/v1/vendor/profile', VENDOR, {
      businessName: 'Sunlit Studio',
      categoryIds: [photography!.id],
      city: 'Austin',
      state: 'TX',
      bio: 'Documentary wedding photography for people who hate posing.',
    });
    expect(profile.statusCode).toBe(201);
    vendorProfileId = profile.json().id;

    const servicePackage = await inject('POST', '/v1/vendor/packages', VENDOR, {
      name: 'Full day coverage',
      description: 'Six hours of coverage with two photographers on site.',
      priceCents: PRICE_CENTS,
      priceType: 'fixed',
      inclusions: ['6 hours', '2 photographers'],
    });
    expect(servicePackage.statusCode).toBe(201);
    packageId = servicePackage.json().id;

    await harness.database.db
      .update(vendorProfiles)
      .set({ isPublished: true, stripeOnboarded: true, stripeAccountId: 'acct_test_vendor' })
      .where(eq(vendorProfiles.id, vendorProfileId));

    expect(
      (
        await inject('POST', '/v1/vendor/agreement/accept', VENDOR, {
          version: CURRENT_VENDOR_AGREEMENT_VERSION,
        })
      ).statusCode,
    ).toBe(200);
  });

  afterAll(async () => {
    if (harness) {
      await harness.close();
    } else {
      await database?.close();
    }
  });

  it('refunds the losing intent when the winner commits between its read and its insert', async () => {
    const { requestId, firstIntentId } = await checkedOutRequest();
    const secondIntentId = await secondIntent(requestId);
    const winner = harness!.stripe.succeed(firstIntentId);
    const loser = harness!.stripe.succeed(secondIntentId);
    const [request] = await harness!.database.db
      .select()
      .from(bookingRequests)
      .where(eq(bookingRequests.id, requestId));
    dispatch.mockClear();

    let release!: () => void;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    let inserted!: () => void;
    const winnerInserted = new Promise<void>((resolve) => {
      inserted = resolve;
    });

    /* The winner's insert, uncommitted: invisible to the loser's read, in the way of its insert. */
    const winnerTransaction = harness!.database.db.transaction(async (tx) => {
      await tx.insert(bookings).values({
        requestId,
        customerId: request!.customerId,
        vendorId: request!.vendorId,
        eventDate: request!.eventDate,
        eventLocation: request!.eventLocation,
        totalAmountCents: PRICE_CENTS,
        platformFeeCents: 17_400,
        vendorPayoutCents: 127_600,
        status: 'confirmed',
        payoutModel: 'separate',
        stripePaymentIntentId: winner.id,
        paidAt: START,
      });
      inserted();
      await held;
    });
    await winnerInserted;

    const losingDelivery = recordSuccessfulPayment(context(), loser);
    try {
      await untilAConnectionWaitsOnALock();
    } finally {
      release();
    }
    await winnerTransaction;
    const result = await losingDelivery;

    expect(result.outcome).toBe('already-booked');
    expect(harness!.stripe.refunds).toHaveLength(1);
    expect(harness!.stripe.refunds[0]).toMatchObject({
      paymentIntentId: loser.id,
      amountCents: PRICE_CENTS,
    });
    expect(harness!.stripe.refunds[0]?.idempotencyKey).toMatch(
      new RegExp(`^${loser.id}_duplicate_intent_\\d+$`),
    );
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch.mock.calls[0]?.[0]).toMatchObject({
      kind: 'payment_refused',
      subjectId: `${requestId}:refunded`,
    });
    const rows = await bookingsFor(requestId);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.stripePaymentIntentId).toBe(winner.id);
  });

  /*
   * VEN-469 acceptance 1. The refund key used to embed the wall-clock hour, so
   * two deliveries either side of a boundary sent two keys and, with the
   * `findRefund` read lagging Stripe (both run before either refund exists),
   * two refunds. The key now comes from a persisted refusal count, which both
   * deliveries read alike.
   */
  it('refunds a second charge once when two deliveries straddle an hour boundary', async () => {
    const { requestId, firstIntentId } = await checkedOutRequest();
    const secondIntentId = await secondIntent(requestId);
    const winner = harness!.stripe.succeed(firstIntentId);
    const loser = harness!.stripe.succeed(secondIntentId);
    expect((await recordSuccessfulPayment(context(), winner)).outcome).toBe('booked');
    harness!.stripe.refunds.length = 0;
    harness!.stripe.duringNextRefund = undefined;

    const hour = 60 * 60_000;
    const base = Math.floor(START.getTime() / hour) * hour + hour - 1;
    let reads = 0;
    const clock = vi.spyOn(Date, 'now').mockImplementation(() => base + (reads++ % 2));

    /* Both deliveries read "no refund yet" before either refund exists: Stripe's list lags. */
    const findRefund = harness!.stripe.findRefund;
    let arrived = 0;
    let open!: () => void;
    const bothRead = new Promise<void>((resolve) => {
      open = resolve;
    });
    harness!.stripe.findRefund = async (paymentIntentId) => {
      const found = await findRefund(paymentIntentId);
      arrived += 1;
      if (arrived === 2) {
        open();
      }
      await bothRead;

      return found;
    };

    try {
      const results = await Promise.all([
        recordSuccessfulPayment(context(), loser),
        recordSuccessfulPayment(context(), loser),
      ]);

      expect(results.map((result) => result.outcome)).toEqual(['already-booked', 'already-booked']);
    } finally {
      clock.mockRestore();
      harness!.stripe.findRefund = findRefund;
    }

    expect(harness!.stripe.refunds).toHaveLength(1);
    expect(harness!.stripe.refunds[0]).toMatchObject({
      paymentIntentId: loser.id,
      amountCents: PRICE_CENTS,
      idempotencyKey: `${loser.id}_duplicate_intent_0`,
    });
  });

  /*
   * VEN-469: the `charge.refunded` reconciliation and the payout sweep both find
   * the same Dashboard refund and both write the row. Only the row lock in
   * `recordExternalRefund` lets exactly one of them hold and alert; PGlite runs
   * the two transactions serially and cannot tell it from its absence.
   */
  it('holds a Dashboard-refunded booking once when the webhook and the sweep find it together', async () => {
    const { requestId, firstIntentId } = await checkedOutRequest();
    const intent = harness!.stripe.succeed(firstIntentId);
    expect((await recordSuccessfulPayment(context(), intent)).outcome).toBe('booked');
    harness!.stripe.refundExternally(intent.id, 10_000);
    dispatch.mockClear();
    const [booked] = await bookingsFor(requestId);
    const due = addDays(new Date(`${booked!.eventDate}T00:00:00Z`), 4);

    await Promise.all([
      reconcileRefundedIntent(
        { db: harness!.database.db, stripe: harness!.stripe, alerts: { dispatch } },
        intent.id,
      ),
      releaseDuePayouts(
        {
          db: harness!.database.db,
          stripe: harness!.stripe,
          log: harness!.app.log,
          alerts: { dispatch },
        },
        due,
      ),
    ]);

    const [after] = await bookingsFor(requestId);
    expect(after).toMatchObject({ status: 'disputed', externalRefundCents: 10_000 });
    /* The sweep may pay other bookings this file made; this one it must not. */
    expect(harness!.stripe.transfers.filter((t) => t.bookingId === booked!.id)).toEqual([]);
    expect(dispatch).toHaveBeenCalledTimes(1);
  });

  /*
   * VEN-727: two intents for one request only meet in `bookings_confirmed_date_key`
   * when both pass the `ON CONFLICT (request_id)` pre-check before either row
   * exists, a window inside one statement that cannot be held open from outside
   * (one run in a hundred reached it). `confirmBooking` closes it by serialising
   * deliveries per request, and this test pins that directly: while another
   * connection holds the request's lock, both deliveries must be parked on it and
   * nothing may be booked. Deleting the lock fails it on every run.
   */
  it('parks both deliveries for one request behind a single lock until it is released', async () => {
    const { requestId, firstIntentId } = await checkedOutRequest();
    const secondIntentId = await secondIntent(requestId);
    const first = harness!.stripe.succeed(firstIntentId);
    const second = harness!.stripe.succeed(secondIntentId);
    harness!.stripe.refunds.length = 0;

    let release!: () => void;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    let locked!: () => void;
    const lockTaken = new Promise<void>((resolve) => {
      locked = resolve;
    });
    const holder = harness!.database.db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${requestId}, 0))`);
      locked();
      await held;
    });
    await lockTaken;

    const deliveries = Promise.allSettled([
      recordSuccessfulPayment(context(), first),
      recordSuccessfulPayment(context(), second),
    ]);
    try {
      await untilDeliveriesWaitOnTheRequestLock();
      expect(await bookingsFor(requestId)).toEqual([]);
    } finally {
      release();
    }
    await holder;
    const settled = await deliveries;

    expect(settled.map((result) => result.status)).toEqual(['fulfilled', 'fulfilled']);
    expect(await bookingsFor(requestId)).toHaveLength(1);
    expect(harness!.stripe.refunds).toHaveLength(1);
  });

  /* The end-to-end race, on fresh requests, in both delivery orders. */
  it.each([
    ['first then second', false],
    ['second then first', true],
  ])(
    'books one intent and refunds the other when both events arrive together, %s',
    async (_order, reversed) => {
      for (let round = 0; round < RACE_ROUNDS; round += 1) {
        const { requestId, firstIntentId } = await checkedOutRequest();
        const secondIntentId = await secondIntent(requestId);
        const first = harness!.stripe.succeed(firstIntentId);
        const second = harness!.stripe.succeed(secondIntentId);
        harness!.stripe.refunds.length = 0;
        dispatch.mockClear();

        const deliveries = reversed ? [second, first] : [first, second];
        const results = await Promise.all(
          deliveries.map((intent) => recordSuccessfulPayment(context(), intent)),
        );

        const rows = await bookingsFor(requestId);
        expect(rows).toHaveLength(1);
        const kept = rows[0]!.stripePaymentIntentId;
        const refundedIntent = kept === first.id ? second.id : first.id;
        expect(results.map((result) => result.outcome).sort()).toEqual([
          'already-booked',
          'booked',
        ]);
        expect(harness!.stripe.refunds).toHaveLength(1);
        expect(harness!.stripe.refunds[0]).toMatchObject({
          paymentIntentId: refundedIntent,
          amountCents: PRICE_CENTS,
        });
        expect(harness!.stripe.refunds[0]?.idempotencyKey).toMatch(
          new RegExp(`^${refundedIntent}_duplicate_intent_\\d+$`),
        );
        expect(dispatch).toHaveBeenCalledTimes(1);

        /* Both events arrive again afterwards: nothing changes, nothing more is refunded. */
        const redelivered = await Promise.all([
          recordSuccessfulPayment(context(), first),
          recordSuccessfulPayment(context(), second),
        ]);

        expect(redelivered.map((result) => result.outcome)).toEqual([
          'already-booked',
          'already-booked',
        ]);
        expect(harness!.stripe.refunds).toHaveLength(1);
        /* The refused intent's redelivery repeats its alert; the subject dedupes it downstream. */
        expect(new Set(dispatch.mock.calls.map((call) => call[0].subjectId))).toEqual(
          new Set([`${requestId}:refunded`]),
        );
        expect(await bookingsFor(requestId)).toHaveLength(1);
      }
    },
  );
});
