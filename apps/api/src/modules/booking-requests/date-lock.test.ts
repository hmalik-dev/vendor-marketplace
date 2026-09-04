import { availability } from '@vendor-marketplace/db';
import { createTestDatabase, type TestDatabase } from '@vendor-marketplace/db/testing';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { hasRivalAcceptanceOn, lockHeldDate } from './booking-requests.dao.js';

/**
 * #399 — the two accepts that could both win.
 *
 * **What the suite can and cannot prove, stated plainly.** The route test
 * fires two accepts with `Promise.all`, but PGlite holds a single connection
 * and runs each `db.transaction` callback to completion before the next
 * begins, so no two transactions in this repository's suite ever overlap. That
 * test therefore exercises the in-transaction re-read and *not* the lock:
 * deleting `lockHeldDate` from the service leaves it green. Measured against
 * the Docker Postgres during review, the same statement sequence without the
 * lock produces two accepted requests on one date.
 *
 * So the lock is pinned here by what it does rather than by a race: it must be
 * an upsert on the unique key — the thing that takes the row — and it must
 * leave the stored status alone, because the caller decides that afterwards. A
 * true contention test needs two real connections, and #399 records it as
 * still owed.
 */
describe('the date lock an accept takes', () => {
  let database: TestDatabase;
  const VENDOR = '11111111-1111-4111-8111-111111111111';

  beforeAll(async () => {
    database = await createTestDatabase();
    await database.runMigrations();
    // The FK the lock's insert has to satisfy. Raw SQL rather than the seed
    // helper, because this suite needs a vendor id and nothing else about one.
    await database.client.exec(`
      insert into users (id, clerk_user_id, email, first_name, last_name, role)
        values ('00000000-0000-4000-8000-000000000001', 'user_lock', 'lock@example.com', 'Lock', 'Studio', 'vendor');
      insert into vendor_profiles (id, user_id, business_name, slug)
        values ('${VENDOR}', '00000000-0000-4000-8000-000000000001', 'Lock Studio', 'lock-studio');
    `);
  });

  afterAll(async () => {
    await database.close();
  });

  it('creates a row to lock when the date has none, and is safe to repeat', async () => {
    await lockHeldDate(database.db, VENDOR, '2027-06-14');
    // The second call takes the `ON CONFLICT` path, which is the one that
    // locks an existing row.
    await lockHeldDate(database.db, VENDOR, '2027-06-14');

    const rows = await database.db
      .select()
      .from(availability)
      .where(eq(availability.date, '2027-06-14'));

    expect(rows).toHaveLength(1);
    expect(rows[0]?.vendorId).toBe(VENDOR);
  });

  it('never overwrites a status the vendor set', async () => {
    await database.db
      .insert(availability)
      .values({ vendorId: VENDOR, date: '2027-07-04', status: 'blocked' });

    await lockHeldDate(database.db, VENDOR, '2027-07-04');

    const [row] = await database.db
      .select()
      .from(availability)
      .where(eq(availability.date, '2027-07-04'));

    expect(row?.status).toBe('blocked');
  });

  it('asks only about other requests, so a repeat accept is not read as a rival', async () => {
    // No rows at all: the question is the predicate, and a repeat accept of the
    // same request must not answer it true. That case belongs to
    // `applyTransition`'s status guard, which reports it as an invalid
    // transition rather than as somebody else taking the date.
    expect(
      await hasRivalAcceptanceOn(
        database.db,
        VENDOR,
        '2027-06-14',
        '99999999-9999-4999-8999-999999999999',
      ),
    ).toBe(false);
  });
});
