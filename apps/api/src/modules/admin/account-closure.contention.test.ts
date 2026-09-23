import { bookingRequests, bookings, categories, users } from '@vendor-marketplace/db/schema';
import { eq, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  createPostgresTestDatabase,
  type PostgresTestDatabase,
} from '@vendor-marketplace/db/testing/postgres';
import {
  bearer,
  createTestHarness,
  signInAs,
  type TestHarness,
} from '../../testing/test-server.js';

/**
 * A booking confirmed between the blocker read and the retirement (VEN-483).
 *
 * `closeAccount` used to read `closeBlockers`, then retire in a separate
 * statement; a payment confirming a booking in the gap was left standing with a
 * closed customer. The retirement now locks the user row and reads the blockers
 * under it. A booking insert holds `FOR KEY SHARE` on that row until it
 * commits, so the closure must wait for it, then see it and answer 409.
 *
 * PGlite is one connection and cannot interleave, so this runs on a real
 * Postgres, and holds the confirming transaction open by hand.
 */
describe('closing an account while a payment confirms its booking', () => {
  const ADMIN = 'user_closure_race_admin';
  const CUSTOMER = 'user_closure_race_customer';
  const VENDOR = 'user_closure_race_vendor';
  const EVENT_DATE = '2099-06-01';

  let database: PostgresTestDatabase | undefined;
  let harness: TestHarness<PostgresTestDatabase> | undefined;
  let customerId: string;
  let vendorProfileId: string;

  /** Resolves once exactly one statement in this database is waiting on a lock. */
  async function lockWaiter(): Promise<'waiting'> {
    const deadline = Date.now() + 10_000;

    while (Date.now() < deadline) {
      const rows = await harness!.database.db.execute<{ pid: number }>(
        sql`select pid from pg_stat_activity
            where datname = current_database() and wait_event_type = 'Lock'`,
      );

      if (rows.length === 1) {
        return 'waiting';
      }

      await new Promise((resolve) => setTimeout(resolve, 20));
    }

    throw new Error('The closure never blocked on the uncommitted booking');
  }

  /** The `confirmBooking` insert, held open until `release`. */
  function holdConfirmation() {
    let release!: () => void;
    const released = new Promise<void>((resolve) => (release = resolve));
    let inserted!: () => void;
    const written = new Promise<void>((resolve) => (inserted = resolve));

    const settled = harness!.database.db.transaction(async (tx) => {
      const [request] = await tx
        .insert(bookingRequests)
        .values({
          customerId,
          vendorId: vendorProfileId,
          eventDate: EVENT_DATE,
          eventLocation: '4 Nueces St, Austin',
          status: 'accepted',
          finalPriceCents: 120_000,
        })
        .returning({ id: bookingRequests.id });

      await tx.insert(bookings).values({
        requestId: request!.id,
        customerId,
        vendorId: vendorProfileId,
        eventDate: EVENT_DATE,
        eventLocation: '4 Nueces St, Austin',
        totalAmountCents: 120_000,
        platformFeeCents: 14_400,
        vendorPayoutCents: 105_600,
        status: 'confirmed',
        stripePaymentIntentId: 'pi_closure_race',
        paidAt: new Date(),
      });
      inserted();
      await released;
    });

    return { written, release, settled };
  }

  beforeAll(async () => {
    database = await createPostgresTestDatabase({ poolSize: 4 });
    harness = await createTestHarness({ database });

    for (const [authUserId, role] of [
      [ADMIN, 'customer'],
      [CUSTOMER, 'customer'],
      [VENDOR, 'vendor'],
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

    await signInAs(harness, ADMIN, true);
    customerId = await signInAs(harness, CUSTOMER);
    await signInAs(harness, VENDOR);

    const [photography] = await harness.database.db
      .select({ id: categories.id })
      .from(categories)
      .where(eq(categories.slug, 'photography'))
      .limit(1);
    const profile = await harness.app.inject({
      method: 'POST',
      url: '/v1/vendor/profile',
      headers: bearer(VENDOR),
      payload: {
        businessName: 'Sunlit Studio',
        categoryIds: [photography!.id],
        city: 'Austin',
        state: 'TX',
        bio: 'Documentary wedding photography for people who hate posing.',
      },
    });
    expect(profile.statusCode).toBe(201);
    vendorProfileId = profile.json().id;
  });

  afterAll(async () => {
    await harness?.close();
    await database?.close();
  });

  it('waits for the confirming booking, then refuses with 409 and leaves the user active', async () => {
    const confirmation = holdConfirmation();
    await confirmation.written;

    const closing = harness!.app.inject({
      method: 'POST',
      url: `/v1/admin/users/${customerId}/close`,
      headers: bearer(ADMIN),
    });

    // A closure that finishes before the booking commits did not take the lock.
    const raced = await Promise.race([closing.then(() => 'finished' as const), lockWaiter()]);
    expect(raced).toBe('waiting');

    confirmation.release();
    await confirmation.settled;

    const response = await closing;
    expect(response.statusCode).toBe(409);
    expect(response.json().message).toContain('1 upcoming confirmed booking');
    expect(response.json().details.bookings).toEqual([
      expect.objectContaining({ eventDate: EVENT_DATE, counterpartyName: 'Sunlit Studio' }),
    ]);

    const [account] = await harness!.database.db
      .select({ deletedAt: users.deletedAt })
      .from(users)
      .where(eq(users.id, customerId));
    expect(account?.deletedAt).toBeNull();
  });
});
