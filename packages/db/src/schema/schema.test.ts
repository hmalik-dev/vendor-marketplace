import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CATEGORY_SEEDS, USER_ROLES } from '@vendorhub/shared';
import { sql } from 'drizzle-orm';
import { createTestDatabase, type TestDatabase } from '../testing/test-db.js';
import { categories, users, vendorProfiles } from './index.js';

const EXPECTED_TABLES = [
  'availability',
  'booking_requests',
  'bookings',
  'categories',
  'conversations',
  'messages',
  'notifications',
  'portfolio_items',
  'reviews',
  'service_packages',
  'users',
  'vendor_categories',
  'vendor_profiles',
];

let testDb: TestDatabase;

beforeAll(async () => {
  testDb = await createTestDatabase();
  await testDb.runMigrations();
});

afterAll(async () => {
  await testDb.close();
});

describe('migrations', () => {
  it('creates all 13 tables from the data model', async () => {
    const result = await testDb.db.execute<{ table_name: string }>(
      sql`SELECT table_name FROM information_schema.tables
          WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
          ORDER BY table_name`,
    );
    expect(result.rows.map((row) => row.table_name)).toEqual(EXPECTED_TABLES);
  });

  it('is re-runnable against an already migrated database', async () => {
    await expect(testDb.runMigrations()).resolves.not.toThrow();

    const result = await testDb.db.execute<{ count: string }>(
      sql`SELECT count(*)::text AS count FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = 'users'`,
    );
    expect(result.rows[0]?.count).toBe('1');
  });

  it('declares the user_role enum with exactly the shared role values', async () => {
    const result = await testDb.db.execute<{ label: string }>(
      sql`SELECT e.enumlabel AS label FROM pg_enum e
          JOIN pg_type t ON t.oid = e.enumtypid
          WHERE t.typname = 'user_role'
          ORDER BY e.enumsortorder`,
    );
    expect(result.rows.map((row) => row.label)).toEqual([...USER_ROLES]);
  });
});

describe('constraints', () => {
  it('rejects a duplicate clerk_user_id', async () => {
    const row = {
      clerkUserId: 'user_dupe',
      email: 'first@example.com',
      role: 'customer' as const,
      firstName: 'First',
      lastName: 'User',
    };
    await testDb.db.insert(users).values(row);

    await expect(
      testDb.db.insert(users).values({ ...row, email: 'second@example.com' }),
    ).rejects.toThrow();
  });

  it('rejects a rating outside 1-5 via the check constraint', async () => {
    await expect(
      testDb.db.execute(
        sql`INSERT INTO reviews (booking_id, reviewer_id, vendor_id, type, rating, content)
            VALUES (gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), 'customer_to_vendor', 6, 'x')`,
      ),
    ).rejects.toThrow();
  });

  it('rejects a vendor profile whose user_id does not exist', async () => {
    await expect(
      testDb.db.insert(vendorProfiles).values({
        userId: '11111111-1111-4111-8111-111111111111',
        businessName: 'Orphan Co',
        slug: 'orphan-co',
      }),
    ).rejects.toThrow();
  });

  it('applies column defaults for a newly created vendor profile', async () => {
    const [owner] = await testDb.db
      .insert(users)
      .values({
        clerkUserId: 'user_defaults',
        email: 'defaults@example.com',
        role: 'vendor',
        firstName: 'Vera',
        lastName: 'Vendor',
      })
      .returning({ id: users.id });
    expect(owner).toBeDefined();

    const [profile] = await testDb.db
      .insert(vendorProfiles)
      .values({ userId: owner!.id, businessName: 'Default Co', slug: 'default-co' })
      .returning();
    expect(profile).toBeDefined();
    expect(profile!.isPublished).toBe(false);
    expect(profile!.isDeleted).toBe(false);
    expect(profile!.stripeOnboarded).toBe(false);
    expect(profile!.reviewCount).toBe(0);
    expect(Number(profile!.avgRating)).toBe(0);
    expect(profile!.serviceRadiusKm).toBe(50);
  });

  it('stores a category slug uniquely', async () => {
    const seed = CATEGORY_SEEDS[0];
    expect(seed).toBeDefined();
    await testDb.db.insert(categories).values({ name: 'Temp One', slug: 'temp-unique-slug' });

    await expect(
      testDb.db.insert(categories).values({ name: 'Temp Two', slug: 'temp-unique-slug' }),
    ).rejects.toThrow();
  });
});
