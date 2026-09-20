import { readFileSync } from 'node:fs';
import path from 'node:path';
import { eq, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { bookingRequests, vendorProfiles } from './schema/index.js';
import { createTestDatabase, MIGRATIONS_FOLDER, type TestDatabase } from './testing/test-db.js';

/**
 * `0052` against accepted requests that already exist (VEN-433).
 *
 * `expires_at` on an accepted request changed meaning from "reply by" to "pay
 * by". The rows written before the change still hold the reply deadline, so
 * without the backfill the first expiry sweep released every one of them with
 * no payment window. The migration is data-only, so the head schema is valid
 * for the rows written here.
 */
const THIS_MIGRATION = '0052_accepted_payment_deadline';

const STALE_REPLY_DEADLINE = new Date('2026-01-08T00:00:00.000Z');

let testDb: TestDatabase;

async function applyMigration(tag: string): Promise<void> {
  const body = readFileSync(path.join(MIGRATIONS_FOLDER, `${tag}.sql`), 'utf8');

  for (const statement of body.split('--> statement-breakpoint')) {
    if (statement.trim().length > 0) {
      await testDb.db.execute(sql.raw(statement));
    }
  }
}

async function acceptedRequest(
  customerId: string,
  vendorId: string,
  eventDate: string,
): Promise<string> {
  const [row] = await testDb.db
    .insert(bookingRequests)
    .values({
      customerId,
      vendorId,
      eventDate,
      status: 'accepted',
      acceptedAt: new Date('2026-01-02T00:00:00.000Z'),
      expiresAt: STALE_REPLY_DEADLINE,
    })
    .returning({ id: bookingRequests.id });

  return row!.id;
}

beforeAll(async () => {
  testDb = await createTestDatabase();
  await testDb.migrateUpTo(THIS_MIGRATION);
});

afterAll(async () => {
  await testDb.close();
});

describe('0052 against accepted requests written before it', () => {
  it('clears the deadline on a paid one and gives an unpaid one a fresh, capped window', async () => {
    // Raw SQL: the ORM's `users` insert names every column of today's schema,
    // and this database is only migrated as far as 0052.
    const inserted = await testDb.db.execute<{ id: string }>(
      sql`INSERT INTO users (auth_user_id, email, role, first_name, last_name) VALUES
        ('user_backfill_customer', 'backfill-customer@example.com', 'customer', 'Back', 'Fill'),
        ('user_backfill_vendor', 'backfill-vendor@example.com', 'vendor', 'Back', 'Vendor')
        RETURNING id`,
    );
    const [customer, vendorUser] = inserted.rows;
    const [vendor] = await testDb.db
      .insert(vendorProfiles)
      .values({
        userId: vendorUser!.id,
        businessName: 'Backfill Studio',
        slug: 'backfill-studio',
        city: 'Austin',
        state: 'TX',
      })
      .returning({ id: vendorProfiles.id });

    const paid = await acceptedRequest(customer!.id, vendor!.id, '2026-02-01');
    const farEvent = await acceptedRequest(customer!.id, vendor!.id, '2099-06-01');
    const nearEvent = await acceptedRequest(customer!.id, vendor!.id, '2026-02-02');
    // Raw SQL for the same reason: the ORM insert names columns added after 0052.
    await testDb.db.execute(
      sql`INSERT INTO bookings (request_id, customer_id, vendor_id, event_date, total_amount_cents, platform_fee_cents, vendor_payout_cents)
        VALUES (${paid}, ${customer!.id}, ${vendor!.id}, '2026-02-01', 145000, 17400, 127600)`,
    );

    const before = Date.now();
    await applyMigration(THIS_MIGRATION);
    const after = Date.now();

    const read = async (id: string): Promise<Date | null> => {
      const [row] = await testDb.db
        .select({ expiresAt: bookingRequests.expiresAt })
        .from(bookingRequests)
        .where(eq(bookingRequests.id, id));

      return row!.expiresAt;
    };

    expect(await read(paid)).toBeNull();

    const week = 7 * 24 * 60 * 60 * 1000;
    const fresh = (await read(farEvent))!.getTime();
    expect(fresh).toBeGreaterThanOrEqual(before + week - 1_000);
    expect(fresh).toBeLessThanOrEqual(after + week + 1_000);

    expect((await read(nearEvent))!.toISOString()).toBe('2026-02-04T00:00:00.000Z');
  });
});
