import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  BOOKING_REQUEST_STATUSES,
  BUDGET_TIERS,
  CATEGORY_SEEDS,
  LIVE_BOOKING_REQUEST_STATUSES,
  TAG_CATEGORIES,
  USER_ROLES,
} from '@vendor-marketplace/shared';
import { eq, sql } from 'drizzle-orm';
import { seedBookingActors } from '../testing/booking-actors.js';
import { createTestDatabase, type TestDatabase } from '../testing/test-db.js';
import {
  bookingRequests,
  categories,
  tagSuggestions,
  tags,
  users,
  vendorProfiles,
  vendorTags,
} from './index.js';

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
  'tag_suggestions',
  'tags',
  'users',
  'vendor_categories',
  'vendor_profiles',
  'vendor_tags',
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
  it('creates all 16 tables from the data model', async () => {
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

  it('declares the budget_tier and tag_category enums with the shared values', async () => {
    const labelsFor = async (typeName: string): Promise<string[]> => {
      const result = await testDb.db.execute<{ label: string }>(
        sql`SELECT e.enumlabel AS label FROM pg_enum e
            JOIN pg_type t ON t.oid = e.enumtypid
            WHERE t.typname = ${typeName}
            ORDER BY e.enumsortorder`,
      );
      return result.rows.map((row) => row.label);
    };

    expect(await labelsFor('budget_tier')).toEqual([...BUDGET_TIERS]);
    expect(await labelsFor('tag_category')).toEqual([...TAG_CATEGORIES]);
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

  it('applies customer profile defaults for a newly created user', async () => {
    const [row] = await testDb.db
      .insert(users)
      .values({
        clerkUserId: 'user_customer_defaults',
        email: 'customer-defaults@example.com',
        role: 'customer',
        firstName: 'Cara',
        lastName: 'Customer',
      })
      .returning();

    expect(row).toBeDefined();
    expect(row!.bio).toBeNull();
    expect(row!.budgetTier).toBeNull();
    expect(row!.typicalGuestCountMin).toBeNull();
    expect(Number(row!.avgCustomerRating)).toBe(0);
    expect(row!.customerReviewCount).toBe(0);
    expect(row!.totalBookingsCount).toBe(0);
    expect(row!.completedBookingsCount).toBe(0);
    expect(row!.cancelledBookingsCount).toBe(0);
  });

  it('stores a populated customer profile', async () => {
    const [row] = await testDb.db
      .insert(users)
      .values({
        clerkUserId: 'user_customer_profile',
        email: 'customer-profile@example.com',
        role: 'customer',
        firstName: 'Pia',
        lastName: 'Planner',
        bio: 'Planning my wedding!',
        city: 'Austin',
        state: 'TX',
        budgetTier: 'premium',
        typicalGuestCountMin: 50,
        typicalGuestCountMax: 150,
      })
      .returning();

    expect(row).toBeDefined();
    expect(row!.budgetTier).toBe('premium');
    expect(row!.typicalGuestCountMax).toBe(150);
  });

  it('rejects a budget tier outside the enum', async () => {
    await expect(
      testDb.db.execute(
        sql`INSERT INTO users (clerk_user_id, email, role, first_name, last_name, budget_tier)
            VALUES ('user_bad_tier', 'bad-tier@example.com', 'customer', 'Bad', 'Tier', 'champagne')`,
      ),
    ).rejects.toThrow();
  });

  it('defaults a review to public', async () => {
    const result = await testDb.db.execute<{ column_default: string | null }>(
      sql`SELECT column_default FROM information_schema.columns
          WHERE table_name = 'reviews' AND column_name = 'is_public'`,
    );
    expect(result.rows[0]?.column_default).toBe('true');
  });

  it('allows the same tag name in two different categories', async () => {
    const [language] = await testDb.db
      .insert(tags)
      .values({ name: 'Korean', slug: 'language-korean', category: 'language', displayOrder: 1 })
      .returning();
    const [cultural] = await testDb.db
      .insert(tags)
      .values({ name: 'Korean', slug: 'cultural-korean', category: 'cultural', displayOrder: 1 })
      .returning();

    expect(language).toBeDefined();
    expect(cultural).toBeDefined();
    expect(language!.id).not.toBe(cultural!.id);
    expect(language!.isActive).toBe(true);
  });

  it('rejects a duplicate tag name within one category', async () => {
    await testDb.db
      .insert(tags)
      .values({ name: 'Twice', slug: 'language-twice', category: 'language' });

    await expect(
      testDb.db
        .insert(tags)
        .values({ name: 'Twice', slug: 'language-twice-again', category: 'language' }),
    ).rejects.toThrow();
  });

  it('rejects a duplicate tag slug', async () => {
    await testDb.db
      .insert(tags)
      .values({ name: 'Slug One', slug: 'language-shared-slug', category: 'language' });

    await expect(
      testDb.db
        .insert(tags)
        .values({ name: 'Slug Two', slug: 'language-shared-slug', category: 'cultural' }),
    ).rejects.toThrow();
  });

  it('rejects a vendor_tags row pointing at a tag that does not exist', async () => {
    const [owner] = await testDb.db
      .insert(users)
      .values({
        clerkUserId: 'user_tag_fk',
        email: 'tag-fk@example.com',
        role: 'vendor',
        firstName: 'Tag',
        lastName: 'Vendor',
      })
      .returning({ id: users.id });
    expect(owner).toBeDefined();

    const [profile] = await testDb.db
      .insert(vendorProfiles)
      .values({ userId: owner!.id, businessName: 'Tag Co', slug: 'tag-co' })
      .returning({ id: vendorProfiles.id });
    expect(profile).toBeDefined();

    await expect(
      testDb.db.insert(vendorTags).values({
        vendorId: profile!.id,
        tagId: '22222222-2222-4222-8222-222222222222',
      }),
    ).rejects.toThrow();
  });

  it('rejects the same tag claimed twice by one vendor', async () => {
    const [owner] = await testDb.db
      .insert(users)
      .values({
        clerkUserId: 'user_tag_pk',
        email: 'tag-pk@example.com',
        role: 'vendor',
        firstName: 'Dupe',
        lastName: 'Vendor',
      })
      .returning({ id: users.id });
    const [profile] = await testDb.db
      .insert(vendorProfiles)
      .values({ userId: owner!.id, businessName: 'Dupe Co', slug: 'dupe-co' })
      .returning({ id: vendorProfiles.id });
    const [tag] = await testDb.db
      .insert(tags)
      .values({ name: 'Claimed', slug: 'language-claimed', category: 'language' })
      .returning({ id: tags.id });

    expect(profile).toBeDefined();
    expect(tag).toBeDefined();
    await testDb.db.insert(vendorTags).values({ vendorId: profile!.id, tagId: tag!.id });

    await expect(
      testDb.db.insert(vendorTags).values({ vendorId: profile!.id, tagId: tag!.id }),
    ).rejects.toThrow();
  });

  it('applies tag suggestion defaults and survives its resolved tag being deleted', async () => {
    const [suggester] = await testDb.db
      .insert(users)
      .values({
        clerkUserId: 'user_suggester',
        email: 'suggester@example.com',
        role: 'vendor',
        firstName: 'Sam',
        lastName: 'Suggester',
      })
      .returning({ id: users.id });
    const [tag] = await testDb.db
      .insert(tags)
      .values({ name: 'Amharic', slug: 'language-amharic', category: 'language' })
      .returning({ id: tags.id });
    expect(suggester).toBeDefined();
    expect(tag).toBeDefined();

    const [suggestion] = await testDb.db
      .insert(tagSuggestions)
      .values({ vendorId: suggester!.id, suggestedName: 'Amharic', category: 'language' })
      .returning();
    expect(suggestion).toBeDefined();
    expect(suggestion!.status).toBe('pending');
    expect(suggestion!.resolvedTagId).toBeNull();
    expect(suggestion!.resolvedAt).toBeNull();

    await testDb.db
      .update(tagSuggestions)
      .set({ status: 'approved', resolvedTagId: tag!.id })
      .where(eq(tagSuggestions.id, suggestion!.id));

    await testDb.db.delete(tags).where(eq(tags.id, tag!.id));

    const [after] = await testDb.db
      .select()
      .from(tagSuggestions)
      .where(eq(tagSuggestions.id, suggestion!.id));
    expect(after).toBeDefined();
    expect(after!.resolvedTagId).toBeNull();
    expect(after!.status).toBe('approved');
  });
});

describe('the live booking request indexes', () => {
  let customerId: string;
  let vendorId: string;
  let packageId: string;
  let counter = 0;

  beforeAll(async () => {
    ({ customerId, vendorId, packageId } = await seedBookingActors(testDb.db, 'dedupe'));
  });

  /** A distinct date per test, so the cases cannot collide with each other. */
  function nextDate(): string {
    counter += 1;
    return `2027-03-${String(counter).padStart(2, '0')}`;
  }

  async function send(eventDate: string, withPackage: boolean): Promise<string> {
    const [row] = await testDb.db
      .insert(bookingRequests)
      .values({
        customerId,
        vendorId,
        packageId: withPackage ? packageId : null,
        eventDate,
        status: 'pending',
      })
      .returning({ id: bookingRequests.id });

    return row!.id;
  }

  it('rejects a second live request for the same customer, vendor, date and package', async () => {
    const eventDate = nextDate();
    await send(eventDate, true);

    await expect(send(eventDate, true)).rejects.toThrow();
  });

  it('rejects a second live custom request, where the package is null on both', async () => {
    const eventDate = nextDate();
    await send(eventDate, false);

    // Postgres treats NULLs as distinct, so this is the case a single combined
    // index would let through.
    await expect(send(eventDate, false)).rejects.toThrow();
  });

  it('admits a custom request alongside a package request on the same date', async () => {
    const eventDate = nextDate();
    await send(eventDate, true);

    await expect(send(eventDate, false)).resolves.toEqual(expect.any(String));
  });

  it('covers only live requests, so the same date can be asked for again after a cancellation', async () => {
    const eventDate = nextDate();
    const first = await send(eventDate, true);

    await testDb.db
      .update(bookingRequests)
      .set({ status: 'cancelled' })
      .where(eq(bookingRequests.id, first));

    const second = await send(eventDate, true);
    expect(second).not.toBe(first);
  });

  it('does not constrain a different date for the same customer, vendor and package', async () => {
    await send(nextDate(), true);

    await expect(send(nextDate(), true)).resolves.toEqual(expect.any(String));
  });

  it('still covers a request the vendor has quoted, which is awaiting a decision', async () => {
    const eventDate = nextDate();
    const first = await send(eventDate, false);

    await testDb.db
      .update(bookingRequests)
      .set({ status: 'quoted' })
      .where(eq(bookingRequests.id, first));

    // A quote moves the request out of `pending` without settling it. Covering
    // only `pending` would let the customer's next submission open a second
    // live thread for the same date.
    await expect(send(eventDate, false)).rejects.toThrow();
  });

  it('is predicated on exactly the statuses the shared constant calls live', async () => {
    // The SQL cannot import the constant, so this is what keeps the two from
    // drifting when the lifecycle gains or loses a non-terminal status.
    const result = await testDb.db.execute<{ indexname: string; indexdef: string }>(
      sql`SELECT indexname, indexdef FROM pg_indexes
          WHERE tablename = 'booking_requests' AND indexname LIKE 'booking_requests_live_%'
          ORDER BY indexname`,
    );

    expect(result.rows).toHaveLength(2);

    for (const row of result.rows) {
      const mentioned = [...new Set(BOOKING_REQUEST_STATUSES)].filter((status) =>
        row.indexdef.includes(`'${status}'`),
      );
      expect(mentioned.sort(), row.indexname).toEqual([...LIVE_BOOKING_REQUEST_STATUSES].sort());
    }
  });
});
