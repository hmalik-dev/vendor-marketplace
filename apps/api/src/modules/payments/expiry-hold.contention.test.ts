import { bookingRequests, users, vendorProfiles } from '@vendor-marketplace/db/schema';
import {
  createPostgresTestDatabase,
  type PostgresTestDatabase,
} from '@vendor-marketplace/db/testing/postgres';
import {
  addDays,
  EXPIRY_SWEEP_INTERVAL_MS,
  paymentDeadline,
  toDateString,
} from '@vendor-marketplace/shared';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestHarness, type TestHarness } from '../../testing/test-server.js';
import { expireLapsedRequests } from '../booking-requests/booking-requests.service.js';
import { bookingContextFor, expiryGuardFor } from './payments.service.js';

/**
 * VEN-551: a hundred accepted requests whose payment intents Stripe will never
 * return must not keep every later lapsed request out of the sweep.
 *
 * The sweep takes 100 rows a tick, oldest first, and an unreadable intent holds
 * its request, so the same hundred were the oldest on every tick. Held rows now
 * sort after the ones never tried; 101 of them plus one readable request means
 * the readable one is reached on the second tick.
 */
describe('the expiry sweep with more unreadable intents than one batch', () => {
  const STUCK = 101;
  const START = new Date('2026-06-01T12:00:00Z');
  const LAPSED = addDays(START, 10);

  let database: PostgresTestDatabase | undefined;
  let harness: TestHarness<PostgresTestDatabase> | undefined;

  const sweep = (tick: number): Promise<number> => {
    const context = {
      ...bookingContextFor(harness!.app, harness!.app.log, 'https://web.test'),
      platformFeeRate: 0.12,
    };

    return expireLapsedRequests(
      harness!.database.db,
      new Date(LAPSED.getTime() + tick * EXPIRY_SWEEP_INTERVAL_MS),
      context.mail,
      expiryGuardFor(context),
    );
  };

  beforeAll(async () => {
    database = await createPostgresTestDatabase({ poolSize: 6 });
    harness = await createTestHarness({ database, clock: () => START });
    const db = harness.database.db;

    const [owner] = await db
      .insert(users)
      .values({
        authUserId: 'user_owner',
        email: 'grace@example.com',
        role: 'vendor',
        firstName: 'Grace',
        lastName: 'Hopper',
      })
      .returning({ id: users.id });
    const [customer] = await db
      .insert(users)
      .values({
        authUserId: 'user_customer',
        email: 'alan@example.com',
        role: 'customer',
        firstName: 'Alan',
        lastName: 'Turing',
      })
      .returning({ id: users.id });
    const [vendor] = await db
      .insert(vendorProfiles)
      .values({
        userId: owner!.id,
        businessName: 'Sunlit Studio',
        slug: 'sunlit-studio',
        city: 'Austin',
        state: 'TX',
        bio: 'Documentary wedding photography for people who hate posing.',
      })
      .returning({ id: vendorProfiles.id });

    const readable = await harness.stripe.createPaymentIntent({
      requestId: 'readable',
      replacements: 0,
      amountCents: 145_000,
      customerId: 'cus_test',
      vendorId: 'ven_test',
    });
    const acceptedAt = addDays(START, 1);
    const rows = Array.from({ length: STUCK + 1 }, (_, index) => {
      const eventDate = toDateString(addDays(START, 40 + index));
      return {
        customerId: customer!.id,
        vendorId: vendor!.id,
        eventDate,
        eventType: 'wedding' as const,
        status: 'accepted' as const,
        acceptedAt,
        // The unreadable ones lapsed first; the readable one is the newest.
        expiresAt: new Date(paymentDeadline(acceptedAt, eventDate).getTime() + index * 1_000),
        stripePaymentIntentId: index < STUCK ? `pi_missing_${index}` : readable.id,
      };
    });
    await db.insert(bookingRequests).values(rows);
  });

  afterAll(async () => {
    if (harness) {
      await harness.close();
    } else {
      await database?.close();
    }
  });

  it('expires the readable request within two ticks', async () => {
    expect(await sweep(0)).toBe(0);
    expect(await sweep(1)).toBe(1);

    const expired = await harness!.database.db
      .select({ intent: bookingRequests.stripePaymentIntentId })
      .from(bookingRequests)
      .where(eq(bookingRequests.status, 'expired'));
    expect(expired).toHaveLength(1);
    expect(expired[0]?.intent).not.toMatch(/^pi_missing_/);
    expect(harness!.stripe.refunds).toEqual([]);
  });
});
