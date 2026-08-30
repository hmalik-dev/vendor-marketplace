import { readFileSync } from 'node:fs';
import path from 'node:path';
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { availability, bookingRequests } from './schema/index.js';
import { seedBookingActors } from './testing/booking-actors.js';
import { createTestDatabase, MIGRATIONS_FOLDER, type TestDatabase } from './testing/test-db.js';

/**
 * The repair half of #307, exercised against the SQL that actually ships.
 *
 * Accepting a request used to write `availability.status = 'pending'`; it now
 * writes `'booked'`. Migrations run in order against an empty database, so this
 * one never meets a legacy row there — the rows it exists for have to be
 * recreated by hand, which is the only way to learn whether it works before it
 * meets the developer's database.
 *
 * What makes it load-bearing rather than cosmetic: `accepted` is terminal, so
 * nothing ever revisits one of these dates, and all three double-booking guards
 * compare against the literal `'booked'` with no constraint behind them. A
 * missed row is a date that will take a second booking.
 */
const MIGRATION = path.join(MIGRATIONS_FOLDER, '0010_book_accepted_dates.sql');

const STATEMENTS = readFileSync(MIGRATION, 'utf8')
  .split('--> statement-breakpoint')
  .map((statement) => statement.trim())
  .filter((statement) => statement.length > 0);

const ACCEPTED_DATE = '2027-03-14';
const DECLINED_DATE = '2027-04-18';
const BLOCKED_DATE = '2027-05-22';

let testDb: TestDatabase;
let customerId: string;
let vendorId: string;
let packageId: string;

async function runBackfill(): Promise<void> {
  for (const statement of STATEMENTS) {
    await testDb.db.execute(sql.raw(statement));
  }
}

/** A request in `status` on `date`, as the old accept path left things. */
async function legacyRequest(date: string, status: 'accepted' | 'declined'): Promise<void> {
  await testDb.db
    .insert(bookingRequests)
    .values({ customerId, vendorId, packageId, eventDate: date, status });
  await testDb.db.insert(availability).values({ vendorId, date, status: 'pending' });
}

async function calendar(): Promise<{ date: string; status: string }[]> {
  const rows = await testDb.db
    .select({ date: availability.date, status: availability.status })
    .from(availability);

  return rows.sort((left, right) => left.date.localeCompare(right.date));
}

beforeAll(async () => {
  testDb = await createTestDatabase();
  await testDb.runMigrations();

  ({ customerId, vendorId, packageId } = await seedBookingActors(testDb.db, 'backfill'));
});

beforeEach(async () => {
  await testDb.db.delete(availability);
  await testDb.db.delete(bookingRequests);
});

afterAll(async () => {
  await testDb.close();
});

describe('0010_book_accepted_dates', () => {
  it('promotes the date of an accepted request from pending to booked', async () => {
    await legacyRequest(ACCEPTED_DATE, 'accepted');

    await runBackfill();

    expect(await calendar()).toEqual([{ date: ACCEPTED_DATE, status: 'booked' }]);
  });

  /*
   * The same old path held a date for a request that was later declined. The
   * vendor is free on it, and the row is holding them out of search.
   */
  it('frees a date whose request never reached accepted', async () => {
    await legacyRequest(DECLINED_DATE, 'declined');

    await runBackfill();

    expect(await calendar()).toEqual([]);
  });

  it('leaves the vendor’s own blocked dates untouched', async () => {
    await testDb.db
      .insert(availability)
      .values({ vendorId, date: BLOCKED_DATE, status: 'blocked' });

    await runBackfill();

    expect(await calendar()).toEqual([{ date: BLOCKED_DATE, status: 'blocked' }]);
  });

  it('sorts all three cases out in one pass', async () => {
    await legacyRequest(ACCEPTED_DATE, 'accepted');
    await legacyRequest(DECLINED_DATE, 'declined');
    await testDb.db
      .insert(availability)
      .values({ vendorId, date: BLOCKED_DATE, status: 'blocked' });

    await runBackfill();

    expect(await calendar()).toEqual([
      { date: ACCEPTED_DATE, status: 'booked' },
      { date: BLOCKED_DATE, status: 'blocked' },
    ]);
  });

  /* Re-running a migration must not be destructive; this one is idempotent. */
  it('is safe to run twice', async () => {
    await legacyRequest(ACCEPTED_DATE, 'accepted');

    await runBackfill();
    await runBackfill();

    expect(await calendar()).toEqual([{ date: ACCEPTED_DATE, status: 'booked' }]);
  });

  /*
   * The guard the whole migration exists to re-arm: after it runs, a legacy
   * accepted date reads `booked`, which is the literal every double-booking
   * check in the API compares against.
   */
  it('leaves no accepted date in a status the double-booking guards ignore', async () => {
    await legacyRequest(ACCEPTED_DATE, 'accepted');

    await runBackfill();

    const missed = await testDb.db.execute(sql`
      select a.date
        from ${availability} a
        join ${bookingRequests} r
          on r.vendor_id = a.vendor_id and r.event_date = a.date
       where r.status = 'accepted' and a.status <> 'booked'
    `);

    expect(missed.rows).toEqual([]);
  });
});
