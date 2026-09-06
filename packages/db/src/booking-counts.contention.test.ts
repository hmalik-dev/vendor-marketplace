import { bookingRequests, bookings, users, vendorProfiles } from './schema/index.js';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  createPostgresTestDatabase,
  type PostgresTestDatabase,
} from './testing/postgres-test-db.js';
import { refreshCustomerBookingCounts } from './seed-support.js';

/**
 * #408, the half the PGlite suite cannot pay for.
 *
 * `refreshCustomerBookingCounts` recomputes three counters from the `bookings`
 * rows in the `SET` clause of one `UPDATE users`, and every caller runs it
 * inside the transaction that just wrote a booking. Under READ COMMITTED the
 * second transaction blocks on the `users` row, then re-evaluates its `SET`
 * subqueries against **its own** statement snapshot — taken before the first
 * committed — so two bookings confirmed at once both write `1` and the
 * customer's total is permanently short by one until some *other* booking of
 * theirs moves.
 *
 * The `SELECT … FOR NO KEY UPDATE` at the top of the function is what closes
 * it: taking the lock as its own statement means the aggregate that follows
 * runs on a snapshot taken *after* the other transaction committed.
 *
 * The API suite cannot express this. PGlite holds one connection, so the second
 * `db.transaction` callback does not begin until the first has finished and the
 * two never overlap — deleting the lock leaves every one of those tests green.
 * This runs the same function on two real connections; deleting the lock turns
 * it red with `total: 1` against two bookings, which is the fail-before
 * evidence.
 */
describe('two bookings recomputing one customer’s counters at once', () => {
  let database: PostgresTestDatabase | undefined;
  let customerId: string;
  let vendorId: string;

  beforeAll(async () => {
    // Two connections is the whole point; the spare is for the assertions.
    database = await createPostgresTestDatabase({ poolSize: 4 });

    const [customer] = await database.db
      .insert(users)
      .values({
        clerkUserId: 'user_counts_customer',
        email: 'counts-customer@example.test',
        role: 'customer',
        firstName: 'Ada',
        lastName: 'Lovelace',
      })
      .returning({ id: users.id });
    customerId = customer!.id;

    const [vendorUser] = await database.db
      .insert(users)
      .values({
        clerkUserId: 'user_counts_vendor',
        email: 'counts-vendor@example.test',
        role: 'vendor',
        firstName: 'Grace',
        lastName: 'Hopper',
      })
      .returning({ id: users.id });

    const [vendor] = await database.db
      .insert(vendorProfiles)
      .values({
        userId: vendorUser!.id,
        businessName: 'Sunlit Studio',
        slug: 'sunlit-studio-counts',
        city: 'Austin',
        state: 'TX',
      })
      .returning({ id: vendorProfiles.id });
    vendorId = vendor!.id;
  });

  afterAll(async () => {
    await database?.close();
  });

  const wait = (ms: number): Promise<void> =>
    new Promise((resolve) => {
      setTimeout(resolve, ms);
    });

  /**
   * One booking plus the recompute, in a transaction, as the DAO does it.
   *
   * **The interleaving is the test.** Two transactions merely started together
   * do not reproduce anything: whichever recomputes second takes its statement
   * snapshot after the first has committed and reads the right number either
   * way — a first draft of this test passed with the lock deleted for exactly
   * that reason. The bug needs the *second* transaction to have its recompute
   * statement already underway, and therefore its snapshot already taken, while
   * the first still holds the row. `startAfterMs` puts B's recompute behind A's
   * lock; `holdMs` keeps A holding it until B is waiting.
   */
  async function confirmBooking(
    eventDate: string,
    { startAfterMs, holdMs }: { startAfterMs: number; holdMs: number },
  ): Promise<void> {
    await wait(startAfterMs);

    const [request] = await database!.db
      .insert(bookingRequests)
      .values({
        customerId,
        vendorId,
        eventDate,
        eventLocation: 'Barr Mansion, Austin, TX',
        status: 'accepted',
        customDetails: 'Full-day documentary coverage.',
      })
      .returning({ id: bookingRequests.id });

    await database!.db.transaction(async (tx) => {
      await tx.insert(bookings).values({
        requestId: request!.id,
        customerId,
        vendorId,
        eventDate,
        eventLocation: 'Barr Mansion, Austin, TX',
        totalAmountCents: 145_000,
        platformFeeCents: 14_500,
        vendorPayoutCents: 130_500,
        status: 'confirmed',
        paidAt: new Date(),
      });

      await refreshCustomerBookingCounts(tx, customerId);

      // Still holding the `users` row, so the other transaction is queued on it.
      await wait(holdMs);
    });
  }

  it('counts both, rather than the second overwriting the first with one', async () => {
    await Promise.all([
      confirmBooking('2027-05-01', { startAfterMs: 0, holdMs: 400 }),
      confirmBooking('2027-06-01', { startAfterMs: 150, holdMs: 0 }),
    ]);

    const [stored] = await database!.db
      .select({
        total: users.totalBookingsCount,
        completed: users.completedBookingsCount,
        cancelled: users.cancelledBookingsCount,
      })
      .from(users)
      .where(eq(users.id, customerId));

    const written = await database!.db
      .select({ id: bookings.id })
      .from(bookings)
      .where(eq(bookings.customerId, customerId));

    expect(written).toHaveLength(2);
    expect(stored).toEqual({ total: 2, completed: 0, cancelled: 0 });
  });
});
