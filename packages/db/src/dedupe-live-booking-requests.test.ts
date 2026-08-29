import { readFileSync } from 'node:fs';
import path from 'node:path';
import { eq, sql } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { bookingRequests, conversations, notifications } from './schema/index.js';
import { seedBookingActors } from './testing/booking-actors.js';
import { createTestDatabase, MIGRATIONS_FOLDER, type TestDatabase } from './testing/test-db.js';

/**
 * The repair half of #67, exercised against the SQL that actually ships.
 *
 * Migrations run in order against an empty database, so the dedupe never meets
 * a duplicate there. Here the indexes it clears the way for are dropped, the
 * duplicates the old endpoint produced are recreated, and the migration file
 * is read off disk and run — which is the only way to learn whether it works
 * before it meets the developer's database.
 */
const MIGRATION = path.join(MIGRATIONS_FOLDER, '0008_dedupe_live_booking_requests.sql');

const STATEMENTS = readFileSync(MIGRATION, 'utf8')
  .split('--> statement-breakpoint')
  .map((statement) => statement.trim())
  .filter((statement) => statement.length > 0);

const EVENT_DATE = '2027-03-14';

let testDb: TestDatabase;
let customerId: string;
let vendorId: string;
let packageId: string;

async function runDedupe(): Promise<void> {
  for (const statement of STATEMENTS) {
    await testDb.db.execute(sql.raw(statement));
  }
}

/** Three identical pending requests, as three clicks in one tick produced. */
async function sendThreeIdentical(): Promise<string[]> {
  const rows = await testDb.db
    .insert(bookingRequests)
    .values(
      [0, 1, 2].map((minute) => ({
        customerId,
        vendorId,
        packageId,
        eventDate: EVENT_DATE,
        status: 'pending' as const,
        createdAt: new Date(Date.UTC(2026, 7, 28, 12, minute)),
      })),
    )
    .returning({ id: bookingRequests.id });

  return rows.map((row) => row.id);
}

beforeAll(async () => {
  testDb = await createTestDatabase();
  await testDb.runMigrations();

  ({ customerId, vendorId, packageId } = await seedBookingActors(testDb.db, 'repair'));
});

beforeEach(async () => {
  await testDb.db.delete(conversations);
  await testDb.db.delete(notifications);
  await testDb.db.delete(bookingRequests);

  // The duplicates predate the indexes, so they cannot be inserted while the
  // indexes are in place. The last assertion puts them back.
  await testDb.db.execute(sql`DROP INDEX IF EXISTS booking_requests_live_package_key`);
  await testDb.db.execute(sql`DROP INDEX IF EXISTS booking_requests_live_custom_key`);
});

afterAll(async () => {
  await testDb.close();
});

describe('0008_dedupe_live_booking_requests', () => {
  it('keeps the oldest of three identical live requests and removes the rest', async () => {
    const [oldest] = await sendThreeIdentical();

    await runDedupe();

    const rows = await testDb.db.select({ id: bookingRequests.id }).from(bookingRequests);
    expect(rows.map((row) => row.id)).toEqual([oldest]);
  });

  it('moves the conversation context link onto the request that survives', async () => {
    const [oldest, , newest] = await sendThreeIdentical();
    await testDb.db
      .insert(conversations)
      .values({ customerId, vendorId, bookingRequestId: newest! });

    await runDedupe();

    const [thread] = await testDb.db
      .select({ bookingRequestId: conversations.bookingRequestId })
      .from(conversations);
    // Repointed, not nulled: the thread is the same thread.
    expect(thread?.bookingRequestId).toBe(oldest);
  });

  it('removes the vendor notifications that pointed at the duplicates', async () => {
    const [oldest, second, third] = await sendThreeIdentical();

    for (const requestId of [oldest!, second!, third!]) {
      await testDb.db.insert(notifications).values({
        userId: customerId,
        type: 'new_request',
        title: 'New booking request',
        data: { bookingRequestId: requestId, vendorId },
      });
    }

    await runDedupe();

    const rows = await testDb.db.select({ data: notifications.data }).from(notifications);
    expect(rows.map((row) => row.data?.bookingRequestId)).toEqual([oldest]);
  });

  it('leaves a request that is no longer live alone, however identical it is', async () => {
    const [oldest, second] = await sendThreeIdentical();
    await testDb.db
      .update(bookingRequests)
      .set({ status: 'declined' })
      .where(eq(bookingRequests.id, second!));

    await runDedupe();

    const rows = await testDb.db
      .select({ id: bookingRequests.id })
      .from(bookingRequests)
      .orderBy(bookingRequests.createdAt);
    expect(rows.map((row) => row.id)).toEqual([oldest, second]);
  });

  it('leaves the unique indexes creatable, which is the whole point of it', async () => {
    await sendThreeIdentical();

    await runDedupe();

    await expect(
      testDb.db.execute(
        sql`CREATE UNIQUE INDEX booking_requests_live_package_key
              ON booking_requests (customer_id, vendor_id, event_date, package_id)
            WHERE status = 'pending' AND package_id IS NOT NULL`,
      ),
    ).resolves.toBeDefined();
  });
});
