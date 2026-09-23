import { bookings, categories, supportCases, vendorProfiles } from '@vendor-marketplace/db/schema';
import {
  addDays,
  CURRENT_VENDOR_AGREEMENT_VERSION,
  toDateString,
} from '@vendor-marketplace/shared';
import { eq, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  createPostgresTestDatabase,
  type PostgresTestDatabase,
} from '@vendor-marketplace/db/testing/postgres';
import type { AuthenticatedUser } from '../../plugins/neon-auth.js';
import { bearer, createTestHarness, type TestHarness } from '../../testing/test-server.js';
import { placeDisputeHold, resolveDispute, type BookingContext } from './payments.service.js';
import { releaseDuePayouts } from './payouts.service.js';

/**
 * VEN-545, on a real Postgres: two operators ruling on one dispute at once.
 *
 * The customer ruling refunds through Stripe and only then writes the row. A
 * vendor ruling that lifted the hold in between left a booking refunded in full
 * and `confirmed` with its payout intact, which the sweep then paid. PGlite is
 * one connection, so only two connections show the interleaving.
 *
 * The customer ruling is parked at its first Stripe call, so the vendor ruling
 * is issued while the customer one is mid-refund — the interleaving itself, not
 * a hope that two requests happen to overlap.
 */
describe('a customer ruling racing a vendor ruling on one disputed booking', () => {
  const VENDOR = 'user_vendor';
  const CUSTOMER = 'user_customer';
  const PRICE_CENTS = 145_000;

  const START = new Date('2026-06-01T12:00:00Z');
  const EVENT_DATE = toDateString(addDays(START, 30));
  const AFTER_EVENT = addDays(START, 31);

  let clockNow = START;
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

  function context(): BookingContext {
    return {
      db: harness!.database.db,
      stripe: harness!.stripe,
      hub: harness!.app.events,
      log: harness!.app.log,
      mail: {
        db: harness!.database.db,
        email: harness!.email,
        log: harness!.app.log,
        webOrigin: 'http://localhost:3000',
        background: harness!.app.background,
      },
    };
  }

  function customer(customerId: string): AuthenticatedUser {
    return { id: customerId, authUserId: CUSTOMER, role: 'customer' };
  }

  async function currentBooking(): Promise<typeof bookings.$inferSelect> {
    const [row] = await harness!.database.db.select().from(bookings);

    return row!;
  }

  /** True once a backend of *this* database is queued behind another's row lock. */
  async function someoneWaitsOnALock(): Promise<boolean> {
    const result = await harness!.database.db.execute(
      sql`select 1 from pg_stat_activity where datname = current_database() and wait_event_type = 'Lock'`,
    );

    return Array.from(result as Iterable<unknown>).length > 0;
  }

  const tick = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 10));

  /** Holds the booking if it is not held already. */
  async function ensureHeld(): Promise<void> {
    if ((await currentBooking()).status === 'disputed') {
      return;
    }

    await placeDisputeHold(
      context(),
      customer((await currentBooking()).customerId),
      bookingId,
      'The photographer never arrived.',
      clockNow,
      'customer',
    );
  }

  beforeAll(async () => {
    database = await createPostgresTestDatabase({ poolSize: 4 });
    harness = await createTestHarness({ database, clock: () => clockNow });

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

    const servicePackage = await inject('POST', '/v1/vendor/packages', VENDOR, {
      name: 'Full day coverage',
      description: 'Six hours of coverage with two photographers on site.',
      priceCents: PRICE_CENTS,
      priceType: 'fixed',
      inclusions: ['6 hours', '2 photographers'],
    });
    expect(servicePackage.statusCode).toBe(201);

    await harness.database.db
      .update(vendorProfiles)
      .set({ isPublished: true, stripeOnboarded: true, stripeAccountId: 'acct_test_vendor' })
      .where(eq(vendorProfiles.id, profile.json().id));

    expect(
      (
        await inject('POST', '/v1/vendor/agreement/accept', VENDOR, {
          version: CURRENT_VENDOR_AGREEMENT_VERSION,
        })
      ).statusCode,
    ).toBe(200);

    const request = await inject('POST', '/v1/booking-requests', CUSTOMER, {
      vendorId: profile.json().id,
      packageId: servicePackage.json().id,
      eventDate: EVENT_DATE,
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

    expect(
      (
        await harness.app.inject({
          method: 'POST',
          url: '/webhooks/stripe',
          headers: { 'stripe-signature': 'valid-signature', 'content-type': 'application/json' },
          payload: { id: 'evt_test', type: 'payment_intent.succeeded' },
        })
      ).statusCode,
    ).toBe(200);

    bookingId = (await currentBooking()).id;
    clockNow = AFTER_EVENT;
  });

  afterAll(async () => {
    if (harness) {
      await harness.close();
    } else {
      await database?.close();
    }
  });

  /*
   * A chargeback does not move `status`, so the lock's own re-check cannot see
   * one arrive. The ruling queues behind a held lock, a case opens while it
   * waits, and it must refuse rather than refund a charge under network dispute.
   */
  it('refuses a customer ruling when a chargeback opens while it waits for the lock', async () => {
    const stripe = harness!.stripe;
    await ensureHeld();

    let ruling: Promise<{ ok: boolean }> | undefined;

    await harness!.database.db.transaction(async (tx) => {
      await tx.select().from(bookings).where(eq(bookings.id, bookingId)).for('update');

      ruling = resolveDispute(context(), bookingId, 'customer', clockNow).then(
        () => ({ ok: true }),
        () => ({ ok: false }),
      );

      let queued = false;
      for (let attempt = 0; attempt < 500 && !queued; attempt += 1) {
        queued = await someoneWaitsOnALock();
        if (!queued) {
          await tick();
        }
      }
      expect(queued).toBe(true);

      // On `tx`: the foreign key wants a share lock the held row lock would refuse anyone else.
      await tx.insert(supportCases).values({
        reference: 'ORL-TEST-CB',
        origin: 'chargeback',
        message: 'The card network opened a chargeback.',
        bookingId,
        stripeDisputeId: 'dp_test_race',
      });
    });

    expect(await ruling).toEqual({ ok: false });
    expect(stripe.refunds).toHaveLength(0);
    expect((await currentBooking()).status).toBe('disputed');

    await harness!.database.db.delete(supportCases).where(eq(supportCases.bookingId, bookingId));
  });

  it('lets exactly one win, refunds the total once and leaves the vendor nothing to be paid', async () => {
    const stripe = harness!.stripe;
    await ensureHeld();
    expect((await currentBooking()).status).toBe('disputed');

    /* Park the customer ruling at its first Stripe call. */
    const realFindRefund = stripe.findRefund;
    let parked!: () => void;
    const reachedStripe = new Promise<void>((resolve) => {
      parked = resolve;
    });
    let release!: () => void;
    const released = new Promise<void>((resolve) => {
      release = resolve;
    });
    stripe.findRefund = async (paymentIntentId) => {
      parked();
      await released;

      return realFindRefund(paymentIntentId);
    };

    try {
      const customerRuling = resolveDispute(context(), bookingId, 'customer', clockNow).then(
        (value) => ({ ok: true as const, value }),
        (error: unknown) => ({ ok: false as const, error }),
      );
      await reachedStripe;

      const vendorRuling = resolveDispute(context(), bookingId, 'vendor', clockNow).then(
        (value) => ({ ok: true as const, value }),
        (error: unknown) => ({ ok: false as const, error }),
      );

      /*
       * The vendor ruling either finishes (nothing stops it, the bug) or queues
       * behind the customer's row lock (the fix). Either way it is settled
       * before the customer ruling is let through Stripe.
       */
      let vendorSettled = false;
      void vendorRuling.then(() => {
        vendorSettled = true;
      });
      let queued = false;
      for (let attempt = 0; attempt < 500 && !vendorSettled && !queued; attempt += 1) {
        queued = await someoneWaitsOnALock();
        if (!queued) {
          await tick();
        }
      }
      expect(vendorSettled || queued).toBe(true);

      release();
      const [customerResult, vendorResult] = await Promise.all([customerRuling, vendorRuling]);

      expect(customerResult.ok).toBe(true);
      expect(vendorResult.ok).toBe(false);
    } finally {
      stripe.findRefund = realFindRefund;
    }

    const row = await currentBooking();
    expect(row).toMatchObject({
      status: 'cancelled',
      cancelledBy: 'admin',
      refundAmountCents: PRICE_CENTS,
      vendorPayoutCents: 0,
    });
    expect(stripe.refunds.map((refund) => refund.amountCents)).toEqual([PRICE_CENTS]);

    /* The sweep, well past the release window: a cancelled booking owes nothing. */
    await releaseDuePayouts(
      { db: harness!.database.db, stripe, log: harness!.app.log },
      addDays(clockNow, 30),
    );
    expect(stripe.transfers).toHaveLength(0);
  });
});
