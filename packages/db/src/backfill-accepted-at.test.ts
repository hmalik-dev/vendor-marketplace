import { readFileSync } from 'node:fs';
import path from 'node:path';
import { eq, sql } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { bookingRequests } from './schema/index.js';
import { seedBookingActors } from './testing/booking-actors.js';
import { createTestDatabase, MIGRATIONS_FOLDER, type TestDatabase } from './testing/test-db.js';

/**
 * The repair half of #10's `accepted_at`, exercised against the SQL that ships.
 *
 * Migrations run in order against an empty database, so this one never meets a
 * legacy row there — the rows it exists for have to be recreated by hand, which
 * is the only way to learn whether it works before it meets a real database.
 *
 * What makes it load-bearing rather than cosmetic: the value is recoverable at
 * exactly one moment. `accepted` is terminal, the expiry sweep returns early
 * for it, and the only new writer of `updated_at` on an accepted request ships
 * in the same change as this migration — so until it runs, `updated_at` *is*
 * the acceptance time, and afterwards it is not. Skip the backfill and every
 * request accepted before today renders checkout with its "…accepted your
 * request on May 2" clause silently dropped: nullable, merely worse rather than
 * invalid, so nothing fails and nobody notices.
 */
const MIGRATION = path.join(MIGRATIONS_FOLDER, '0014_backfill_accepted_at.sql');

const STATEMENTS = readFileSync(MIGRATION, 'utf8')
  .split('--> statement-breakpoint')
  .map((statement) => statement.trim())
  .filter((statement) => statement.length > 0);

const EVENT_DATE = '2027-03-14';
const ACCEPTED_ON = new Date('2026-11-02T15:30:00.000Z');

let testDb: TestDatabase;
let customerId: string;
let vendorId: string;
let packageId: string;

async function runBackfill(): Promise<void> {
  for (const statement of STATEMENTS) {
    await testDb.db.execute(sql.raw(statement));
  }
}

/** A request as the old accept path left it: no `accepted_at` at all. */
async function legacyRequest(
  status: 'accepted' | 'declined' | 'pending',
  updatedAt: Date,
): Promise<string> {
  const [row] = await testDb.db
    .insert(bookingRequests)
    .values({ customerId, vendorId, packageId, eventDate: EVENT_DATE, status, updatedAt })
    .returning({ id: bookingRequests.id });

  return row!.id;
}

async function acceptedAtOf(requestId: string): Promise<Date | null> {
  const rows = await testDb.db
    .select({ acceptedAt: bookingRequests.acceptedAt })
    .from(bookingRequests)
    .where(eq(bookingRequests.id, requestId));

  return rows[0]?.acceptedAt ?? null;
}

beforeAll(async () => {
  testDb = await createTestDatabase();
  await testDb.runMigrations();

  ({ customerId, vendorId, packageId } = await seedBookingActors(testDb.db, 'accepted-at'));
});

beforeEach(async () => {
  await testDb.db.delete(bookingRequests);
});

afterAll(async () => {
  await testDb.close();
});

describe('0014_backfill_accepted_at', () => {
  it('recovers the acceptance time from the last write to an accepted request', async () => {
    const requestId = await legacyRequest('accepted', ACCEPTED_ON);

    expect(await acceptedAtOf(requestId)).toBeNull();

    await runBackfill();

    expect((await acceptedAtOf(requestId))?.toISOString()).toBe(ACCEPTED_ON.toISOString());
  });

  /*
   * A request that was never accepted has no acceptance time, and giving it one
   * would invent a fact rather than recover one — the checkout line would then
   * claim a vendor said yes to something they declined.
   */
  it.each(['declined', 'pending'] as const)('leaves a %s request without one', async (status) => {
    const requestId = await legacyRequest(status, ACCEPTED_ON);

    await runBackfill();

    expect(await acceptedAtOf(requestId)).toBeNull();
  });

  /*
   * Safe to run twice, which matters because a re-run is how a half-applied
   * migration is repaired — and because the second run happens *after*
   * `recordPaymentIntent` may have moved `updated_at`, which is exactly the
   * value this must no longer copy.
   */
  it('does not overwrite a timestamp it already recovered', async () => {
    const requestId = await legacyRequest('accepted', ACCEPTED_ON);
    await runBackfill();

    await testDb.db
      .update(bookingRequests)
      .set({ updatedAt: new Date('2027-01-01T00:00:00.000Z') })
      .where(eq(bookingRequests.id, requestId));
    await runBackfill();

    expect((await acceptedAtOf(requestId))?.toISOString()).toBe(ACCEPTED_ON.toISOString());
  });

  /* Guards the guard: a migration file that stopped parsing would pass everything. */
  it('reads statements out of the migration that ships', () => {
    expect(STATEMENTS).toHaveLength(1);
    expect(STATEMENTS[0]).toMatch(/UPDATE booking_requests/);
  });
});
