import { readFileSync } from 'node:fs';
import path from 'node:path';
import { eq, sql } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { bookingRequests } from './schema/index.js';
import { seedBookingActors } from './testing/booking-actors.js';
import { createTestDatabase, MIGRATIONS_FOLDER, type TestDatabase } from './testing/test-db.js';

/**
 * The repair half of #401, exercised against the SQL that actually ships.
 *
 * `createBookingRequest` now caps a request's reply window at its event date,
 * but that is a write-time fix and the acceptance is a property of the data:
 * every row created before it keeps a flat seven days from creation, so a
 * request for an event three days out stays live for four days *after* it —
 * the vendor still shown `Accept` on a date nobody can work, the customer's
 * history still reading "awaiting reply".
 *
 * Migrations run in order against an empty database, so this one never meets a
 * legacy row there. The rows it exists for have to be recreated by hand, which
 * is the only way to learn whether it works before it meets a real database.
 */
const TAG = '0022_cap_reply_window_at_event';

/*
 * Resolved **through the journal**, not by filename. Drizzle's runner applies
 * what the journal lists; a migration file with no entry, or an entry naming a
 * tag that does not exist, is silently never applied — and a test that read the
 * `.sql` directly would stay green while every real database kept the old
 * deadlines. `drop-style-tags.test.ts` reads its migrations the same way.
 */
const JOURNAL = path.join(MIGRATIONS_FOLDER, 'meta', '_journal.json');

const ENTRIES: readonly { readonly tag: string }[] = (
  JSON.parse(readFileSync(JOURNAL, 'utf8')) as { entries: { tag: string }[] }
).entries;

const STATEMENTS = readFileSync(path.join(MIGRATIONS_FOLDER, `${TAG}.sql`), 'utf8')
  .split('--> statement-breakpoint')
  .map((statement) => statement.trim())
  .filter((statement) => statement.length > 0);

/** The cap: the event date's UTC midnight, plus the two-day timezone tail. */
function cappedAt(eventDate: string): string {
  const parsed = new Date(`${eventDate}T00:00:00.000Z`);
  parsed.setUTCDate(parsed.getUTCDate() + 2);

  return parsed.toISOString();
}

const SOON = '2027-03-14';
const FAR = '2027-09-20';

let testDb: TestDatabase;
let customerId: string;
let vendorId: string;
let packageId: string;

async function runBackfill(): Promise<void> {
  for (const statement of STATEMENTS) {
    await testDb.db.execute(sql.raw(statement));
  }
}

/** A row as the old flat-week writer left it: created seven days before it expires. */
async function legacyRequest(
  eventDate: string,
  status: 'pending' | 'quoted' | 'accepted' | 'declined',
  expiresAt: Date,
): Promise<string> {
  const rows = await testDb.db
    .insert(bookingRequests)
    .values({ customerId, vendorId, packageId, eventDate, status, expiresAt })
    .returning({ id: bookingRequests.id });

  return rows[0]!.id;
}

async function deadlineOf(id: string): Promise<string | null> {
  const rows = await testDb.db
    .select({ expiresAt: bookingRequests.expiresAt })
    .from(bookingRequests)
    .where(eq(bookingRequests.id, id));

  return rows[0]?.expiresAt?.toISOString() ?? null;
}

beforeAll(async () => {
  testDb = await createTestDatabase();
  await testDb.runMigrations();

  ({ customerId, vendorId, packageId } = await seedBookingActors(testDb.db, 'reply-window'));
});

beforeEach(async () => {
  await testDb.db.delete(bookingRequests);
});

afterAll(async () => {
  await testDb.close();
});

describe('0022_cap_reply_window_at_event', () => {
  it('is listed in the journal, so drizzle actually runs it', () => {
    expect(ENTRIES.map((entry) => entry.tag)).toContain(TAG);
    expect(STATEMENTS.length).toBeGreaterThan(0);
  });

  it('pulls a live request’s deadline back to its event', async () => {
    // The reported row: a week from creation lands four days past the event.
    const id = await legacyRequest(SOON, 'pending', new Date('2027-03-18T09:00:00.000Z'));

    await runBackfill();

    expect(await deadlineOf(id)).toBe(cappedAt(SOON));
  });

  it('caps a quoted request too, since it is still awaiting an answer', async () => {
    const id = await legacyRequest(SOON, 'quoted', new Date('2027-03-18T09:00:00.000Z'));

    await runBackfill();

    expect(await deadlineOf(id)).toBe(cappedAt(SOON));
  });

  it('leaves a deadline that already falls before the event alone', async () => {
    const before = new Date('2027-09-01T09:00:00.000Z');
    const id = await legacyRequest(FAR, 'pending', before);

    await runBackfill();

    expect(await deadlineOf(id)).toBe(before.toISOString());
  });

  /*
   * A settled row's deadline is history. Rewriting it would not free anything —
   * nothing reads `expires_at` on a row that can no longer expire — and it
   * would falsify the window the decision was actually made under.
   */
  it('does not rewrite the history of a settled request', async () => {
    const stale = new Date('2027-03-18T09:00:00.000Z');
    const accepted = await legacyRequest(SOON, 'accepted', stale);
    const declined = await legacyRequest(SOON, 'declined', stale);

    await runBackfill();

    expect(await deadlineOf(accepted)).toBe(stale.toISOString());
    expect(await deadlineOf(declined)).toBe(stale.toISOString());
  });

  it('is idempotent, so a re-run cannot walk the deadline backwards', async () => {
    const id = await legacyRequest(SOON, 'pending', new Date('2027-03-18T09:00:00.000Z'));

    await runBackfill();
    await runBackfill();

    expect(await deadlineOf(id)).toBe(cappedAt(SOON));
  });
});
