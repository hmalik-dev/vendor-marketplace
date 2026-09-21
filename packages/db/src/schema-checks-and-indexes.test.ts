import { sql } from 'drizzle-orm';
import { MAX_PACKAGE_PRICE_CENTS, MIN_BOOKING_AMOUNT_CENTS } from '@vendor-marketplace/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestDatabase, refusalOf, type TestDatabase } from './testing/test-db.js';

/**
 * VEN-508: the package price band and the guest-count order are enforced by
 * the engine, proved by attempting the writes, and the foreign keys the
 * user-delete and package-delete paths scan are indexed.
 */
const VENDOR_USER = '11111111-1111-4111-8111-111111111111';
const VENDOR = '22222222-2222-4222-8222-222222222222';

const PRICE_CONSTRAINT = 'service_packages_price_cents_range';
const GUEST_CONSTRAINT = 'users_typical_guest_count_order';

const ADDED_INDEXES = [
  'booking_requests_package_idx',
  'messages_sender_idx',
  'review_tombstones_reviewer_idx',
  'reviews_reviewer_idx',
  'support_cases_sender_user_idx',
  'support_cases_resolved_by_idx',
];

let testDb: TestDatabase;
let userSeq = 0;

function insertPackage(priceCents: number): string {
  return `INSERT INTO service_packages (vendor_id, name, description, price_cents)
          VALUES ('${VENDOR}', 'Package', 'Coverage', ${priceCents})`;
}

function insertUser(min: number | null, max: number | null): string {
  userSeq += 1;

  return `INSERT INTO users (auth_user_id, email, role, first_name, last_name, typical_guest_count_min, typical_guest_count_max)
          VALUES ('auth_${userSeq}', 'guest${userSeq}@example.com', 'customer', 'Ada', 'Reyes', ${min ?? 'NULL'}, ${max ?? 'NULL'})`;
}

beforeAll(async () => {
  testDb = await createTestDatabase();
  await testDb.runMigrations();
  await testDb.db.execute(
    sql.raw(`INSERT INTO users (id, auth_user_id, email, role, first_name, last_name)
             VALUES ('${VENDOR_USER}', 'auth_vendor', 'vendor@example.com', 'vendor', 'June', 'Harlow')`),
  );
  await testDb.db.execute(
    sql.raw(`INSERT INTO vendor_profiles (id, user_id, business_name, slug)
             VALUES ('${VENDOR}', '${VENDOR_USER}', 'June Harlow Photography', 'june-harlow')`),
  );
});

afterAll(async () => {
  await testDb.close();
});

describe('service_packages.price_cents', () => {
  it.each([
    ['below the minimum', MIN_BOOKING_AMOUNT_CENTS - 1],
    ['zero', 0],
    ['negative', -100],
    ['above the maximum', MAX_PACKAGE_PRICE_CENTS + 1],
  ])('refuses a price %s, naming the constraint', async (_label, price) => {
    expect(await refusalOf(testDb.db, insertPackage(price))).toContain(PRICE_CONSTRAINT);
  });

  it.each([MIN_BOOKING_AMOUNT_CENTS, MAX_PACKAGE_PRICE_CENTS])(
    'accepts the inclusive bound %i',
    async (price) => {
      await testDb.db.execute(sql.raw(insertPackage(price)));
    },
  );
});

describe('users typical guest count', () => {
  it('refuses a minimum above the maximum, naming the constraint', async () => {
    expect(await refusalOf(testDb.db, insertUser(50, 10))).toContain(GUEST_CONSTRAINT);
  });

  it.each([
    ['equal bounds', 20, 20],
    ['ordered bounds', 10, 50],
    ['a minimum alone', 10, null],
    ['a maximum alone', null, 50],
    ['neither bound', null, null],
  ])('accepts %s', async (_label, min, max) => {
    await testDb.db.execute(sql.raw(insertUser(min, max)));
  });
});

describe('foreign key indexes', () => {
  it('creates every index the migration adds', async () => {
    const result = await testDb.db.execute(
      sql.raw(`SELECT indexname FROM pg_indexes WHERE schemaname = 'public' ORDER BY indexname`),
    );
    const names = (result.rows as unknown as { indexname: string }[]).map((r) => r.indexname);

    expect(names.filter((name) => ADDED_INDEXES.includes(name))).toEqual([...ADDED_INDEXES].sort());
  });
});
