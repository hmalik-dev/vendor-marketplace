import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { bookingRequests, users, vendorProfiles } from './schema/index.js';
import {
  createPostgresTestDatabase,
  type PostgresTestDatabase,
} from './testing/postgres-test-db.js';

/**
 * VEN-482 — the backstop under `lockHeldDate`, on two real connections.
 *
 * The accept path serialises on the availability row, so the API's own
 * contention suite never reaches the index: the loser is turned away by
 * `hasRivalAcceptanceOn` first. This suite is the writer that skips the lock —
 * two transactions that each mark a different request `accepted` for one
 * vendor date — and asks the database alone to leave exactly one.
 */
describe('two writers accepting different requests for one vendor date', () => {
  let database: PostgresTestDatabase | undefined;
  let vendorId: string;
  let firstId: string;
  let secondId: string;

  beforeAll(async () => {
    database = await createPostgresTestDatabase({ poolSize: 4 });

    const [vendorUser] = await database.db
      .insert(users)
      .values({
        authUserId: 'user_date_vendor',
        email: 'date-vendor@example.test',
        role: 'vendor',
        firstName: 'Grace',
        lastName: 'Hopper',
      })
      .returning({ id: users.id });
    const [vendor] = await database.db
      .insert(vendorProfiles)
      .values({ userId: vendorUser!.id, businessName: 'Date Studio', slug: 'date-studio' })
      .returning({ id: vendorProfiles.id });
    vendorId = vendor!.id;

    const ids: string[] = [];
    for (const name of ['one', 'two']) {
      const [customer] = await database.db
        .insert(users)
        .values({
          authUserId: `user_date_customer_${name}`,
          email: `date-customer-${name}@example.test`,
          role: 'customer',
          firstName: 'Ada',
          lastName: name,
        })
        .returning({ id: users.id });
      const [row] = await database.db
        .insert(bookingRequests)
        .values({ customerId: customer!.id, vendorId, eventDate: '2027-06-14' })
        .returning({ id: bookingRequests.id });
      ids.push(row!.id);
    }
    [firstId, secondId] = ids as [string, string];
  });

  afterAll(async () => {
    await database?.close();
  });

  it('leaves exactly one accepted, and refuses the other by the index', async () => {
    const db = database!.db;
    const accept = (id: string) =>
      db.transaction(async (tx) => {
        await tx
          .update(bookingRequests)
          .set({ status: 'accepted' })
          .where(eq(bookingRequests.id, id));
      });

    const outcomes = await Promise.allSettled([accept(firstId), accept(secondId)]);

    expect(outcomes.map((outcome) => outcome.status).sort()).toEqual(['fulfilled', 'rejected']);

    const rows = await db
      .select({ status: bookingRequests.status })
      .from(bookingRequests)
      .where(eq(bookingRequests.vendorId, vendorId));

    expect(rows.map((row) => row.status).sort()).toEqual(['accepted', 'pending']);
  });
});
