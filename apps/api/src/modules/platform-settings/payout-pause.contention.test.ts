import { bookings, categories, users, vendorProfiles } from '@vendor-marketplace/db/schema';
import {
  addDays,
  CURRENT_VENDOR_AGREEMENT_VERSION,
  toDateString,
} from '@vendor-marketplace/shared';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  createPostgresTestDatabase,
  type PostgresTestDatabase,
} from '@vendor-marketplace/db/testing/postgres';
import { bearer, createTestHarness, type TestHarness } from '../../testing/test-server.js';
import { releaseDuePayouts } from '../payments/payouts.service.js';

/**
 * VEN-404, acceptance 3's contention half: flipping `payoutReleasePaused` while
 * sweeps are running never transfers one payout twice.
 *
 * The pause is re-read before every booking, so a flip lands between claims of
 * a sweep that is already under way. The row lock is what keeps two sweeps from
 * paying the same booking; this proves the switch does not open a way around
 * it — on a pooled Postgres, where the sweeps and the flips really overlap.
 */
describe('flipping the payout pause during overlapping sweeps, on real connections', () => {
  const ADMIN = 'user_admin';
  const VENDOR = 'user_vendor';
  const CUSTOMER = 'user_customer';
  const VENDOR_ACCOUNT = 'acct_test_vendor';
  const PRICE_CENTS = 145_000;
  const BOOKING_COUNT = 4;

  const START = new Date('2026-06-01T12:00:00Z');
  /** Past `payoutReleaseAt` for every event below, which fall on days 30–33. */
  const AFTER_RELEASE = addDays(START, 40);

  let clockNow = START;
  let database: PostgresTestDatabase | undefined;
  let harness: TestHarness<PostgresTestDatabase> | undefined;
  let bookingIds: string[] = [];

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

  async function setPaused(payoutReleasePaused: boolean): Promise<number> {
    return (await inject('PUT', '/admin/settings', ADMIN, { payoutReleasePaused })).statusCode;
  }

  beforeAll(async () => {
    database = await createPostgresTestDatabase({ poolSize: 8 });
    harness = await createTestHarness({ database, clock: () => clockNow });

    for (const [authUserId, role] of [
      [ADMIN, 'customer'],
      [VENDOR, 'vendor'],
      [CUSTOMER, 'customer'],
    ] as const) {
      harness.authUsers.set(authUserId, {
        authUserId,
        email: `${authUserId}@example.com`,
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

    expect((await inject('GET', '/users/me', ADMIN)).statusCode).toBe(200);
    await harness.database.db
      .update(users)
      .set({ role: 'admin' })
      .where(eq(users.authUserId, ADMIN));

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
    });
    expect(profile.statusCode).toBe(201);
    const vendorId: string = profile.json().id;

    const servicePackage = await inject('POST', '/vendor/packages', VENDOR, {
      name: 'Full day coverage',
      description: 'Six hours of coverage with two photographers on site.',
      priceCents: PRICE_CENTS,
      priceType: 'fixed',
      inclusions: ['6 hours'],
    });
    expect(servicePackage.statusCode).toBe(201);

    await harness.database.db
      .update(vendorProfiles)
      .set({ isPublished: true, stripeOnboarded: true, stripeAccountId: VENDOR_ACCOUNT })
      .where(eq(vendorProfiles.id, vendorId));

    expect(
      (
        await inject('POST', '/vendor/agreement/accept', VENDOR, {
          version: CURRENT_VENDOR_AGREEMENT_VERSION,
        })
      ).statusCode,
    ).toBe(200);

    for (let index = 0; index < BOOKING_COUNT; index += 1) {
      const request = await inject('POST', '/booking-requests', CUSTOMER, {
        vendorId,
        packageId: servicePackage.json().id,
        eventDate: toDateString(addDays(START, 30 + index)),
        eventType: 'wedding',
      });
      expect(request.statusCode).toBe(201);
      const requestId: string = request.json().id;

      expect(
        (await inject('POST', `/booking-requests/${requestId}/accept`, VENDOR)).statusCode,
      ).toBe(200);

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
        payload: { id: `evt_${intentId}`, type: 'payment_intent.succeeded' },
      });
      expect(webhook.statusCode).toBe(200);
    }

    bookingIds = (await harness.database.db.select({ id: bookings.id }).from(bookings)).map(
      (row) => row.id,
    );
    expect(bookingIds).toHaveLength(BOOKING_COUNT);

    clockNow = AFTER_RELEASE;
  });

  afterAll(async () => {
    if (harness) {
      await harness.close();
    } else {
      await database?.close();
    }
  });

  it('never transfers a payout twice while the pause flips under running sweeps', async () => {
    /* The flips are ordered against each other and raced against the sweeps. */
    const flips = (async (): Promise<number[]> => [
      await setPaused(true),
      await setPaused(false),
    ])();
    const [flipped] = await Promise.all([flips, sweep(), sweep(), sweep(), sweep()]);

    expect(flipped).toEqual([200, 200]);

    const transferred = harness!.stripe.transfers.map((transfer) => transfer.bookingId);
    expect(new Set(transferred).size).toBe(transferred.length);

    /* Whatever the race left, the switch is off now, so one more sweep settles every payout. */
    await sweep();

    const settled = harness!.stripe.transfers.map((transfer) => transfer.bookingId);
    expect(settled).toHaveLength(BOOKING_COUNT);
    expect([...settled].sort()).toEqual([...bookingIds].sort());
  });
});
