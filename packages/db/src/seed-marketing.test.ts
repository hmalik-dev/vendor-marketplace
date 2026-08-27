import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { and, eq, inArray } from 'drizzle-orm';
import { generateSlug } from '@vendor-marketplace/shared';
import { MARKETING_CUSTOMERS, MARKETING_VENDORS } from './marketing-seed-data.js';
import {
  availability,
  bookingRequests,
  bookings,
  reviews,
  servicePackages,
  users,
  vendorCategories,
  vendorProfiles,
} from './schema/index.js';
import { seedReferenceData } from './seed.js';
import {
  MARKETING_SEED_PREFIX,
  buildRatings,
  clearMarketingData,
  seedMarketingData,
} from './seed-marketing.js';
import { createTestDatabase, type TestDatabase } from './testing/test-db.js';

let testDb: TestDatabase;

/** Pinned so date assertions do not drift with the wall clock. */
const NOW = new Date('2026-06-15T00:00:00.000Z');

beforeAll(async () => {
  testDb = await createTestDatabase();
  await testDb.runMigrations();
  await seedReferenceData(testDb.db);
}, 120_000);

afterAll(async () => {
  await testDb.close();
});

describe('buildRatings', () => {
  it('returns no ratings for an unreviewed vendor', () => {
    expect(buildRatings(0, 0)).toEqual([]);
  });

  it('produces an average that rounds to the target at two decimal places', () => {
    for (const [target, count] of [
      [4.9, 127],
      [4.8, 64],
      [5, 18],
      [4.7, 92],
      [4.5, 70],
      [4.6, 43],
    ] as const) {
      const ratings = buildRatings(target, count);
      const mean = ratings.reduce((sum, value) => sum + value, 0) / ratings.length;

      expect(ratings).toHaveLength(count);
      expect(Number(mean.toFixed(2))).toBe(target);
    }
  });

  it('keeps every rating inside the 1-5 range the check constraint allows', () => {
    const ratings = buildRatings(4.5, 70);

    expect(Math.min(...ratings)).toBeGreaterThanOrEqual(1);
    expect(Math.max(...ratings)).toBeLessThanOrEqual(5);
  });

  it('gives a five-star vendor nothing but five-star reviews', () => {
    expect(buildRatings(5, 18)).toEqual(Array.from({ length: 18 }, () => 5));
  });

  it('is deterministic — the same target and count give the same ratings', () => {
    expect(buildRatings(4.7, 92)).toEqual(buildRatings(4.7, 92));
  });

  /*
   * Not every (rating, count) pair is reachable with whole-star reviews: 4.5
   * across 71 reviews needs a total of 319.5, and the two neighbouring
   * integers average to 4.49 and 4.51. A card would then advertise a number
   * the profile page could never show, so the data is checked rather than
   * trusted.
   */
  it('every seeded vendor asks for an average whole-star reviews can actually produce', () => {
    const unreachable = MARKETING_VENDORS.filter((vendor) => {
      if (vendor.reviewCount === 0) {
        return false;
      }
      const ratings = buildRatings(vendor.rating, vendor.reviewCount);
      const mean = ratings.reduce((sum, value) => sum + value, 0) / ratings.length;
      return Number(mean.toFixed(2)) !== vendor.rating;
    });

    expect(
      unreachable.map((vendor) => `${vendor.slug} ${vendor.rating}/${vendor.reviewCount}`),
    ).toEqual([]);
  });
});

describe('the vendor cast', () => {
  /*
   * The slug is three things at once: the profile URL, the key the upsert
   * adopts an existing row on, and the cover image's filename. Deriving it by
   * hand is how "Atlas & Thorn" became `atlas-and-thorn` here while the
   * application's own `generateSlug` produced `atlas-thorn` — which stopped
   * the upsert colliding and seeded a duplicate vendor instead of adopting one.
   */
  it('slugs every vendor exactly as the application would', () => {
    const wrong = MARKETING_VENDORS.filter(
      (vendor) => vendor.slug !== generateSlug(vendor.businessName),
    );

    expect(
      wrong.map(
        (vendor) =>
          `${vendor.businessName}: ${vendor.slug} != ${generateSlug(vendor.businessName)}`,
      ),
    ).toEqual([]);
  });

  it('gives every vendor a unique slug', () => {
    const slugs = MARKETING_VENDORS.map((vendor) => vendor.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });
});

describe('seedMarketingData', () => {
  beforeEach(async () => {
    await clearMarketingData(testDb.db);
  });

  it('creates every vendor, published and pointed at its cover image', async () => {
    const result = await seedMarketingData(testDb.db, NOW);

    expect(result.vendorsUpserted).toBe(MARKETING_VENDORS.length);
    expect(result.customersUpserted).toBe(MARKETING_CUSTOMERS.length);

    const rows = await testDb.db.select().from(vendorProfiles);
    expect(rows).toHaveLength(MARKETING_VENDORS.length);

    for (const vendor of MARKETING_VENDORS) {
      const row = rows.find((candidate) => candidate.slug === vendor.slug);
      expect(row, `missing vendor ${vendor.slug}`).toBeDefined();
      expect(row?.businessName).toBe(vendor.businessName);
      expect(row?.coverImageUrl).toBe(`/marketing/vendors/${vendor.slug}.jpg`);
      expect(row?.isPublished).toBe(true);
      expect(row?.isDeleted).toBe(false);
    }
  }, 120_000);

  it('recomputes each rating from the reviews it wrote, not from the seed file', async () => {
    await seedMarketingData(testDb.db, NOW);

    const rows = await testDb.db.select().from(vendorProfiles);

    for (const vendor of MARKETING_VENDORS) {
      const row = rows.find((candidate) => candidate.slug === vendor.slug);

      expect(row?.reviewCount, `${vendor.slug} review count`).toBe(vendor.reviewCount);
      expect(Number(row?.avgRating), `${vendor.slug} average`).toBe(vendor.rating);

      const written = await testDb.db
        .select({ id: reviews.id })
        .from(reviews)
        .where(eq(reviews.vendorId, row!.id));
      expect(written, `${vendor.slug} review rows`).toHaveLength(vendor.reviewCount);
    }
  }, 120_000);

  it('backs every review with a completed booking, as the product requires', async () => {
    const result = await seedMarketingData(testDb.db, NOW);

    const totalReviews = MARKETING_VENDORS.reduce((sum, vendor) => sum + vendor.reviewCount, 0);
    expect(result.reviewsCreated).toBe(totalReviews);
    expect(result.bookingsCreated).toBe(totalReviews);

    const orphaned = await testDb.db
      .select({ id: reviews.id })
      .from(reviews)
      .leftJoin(bookings, eq(reviews.bookingId, bookings.id))
      .where(eq(bookings.status, 'completed'));
    expect(orphaned).toHaveLength(totalReviews);
  }, 120_000);

  it('never dates a completed booking in the future', async () => {
    await seedMarketingData(testDb.db, NOW);

    const rows = await testDb.db.select({ eventDate: bookings.eventDate }).from(bookings);
    const today = NOW.toISOString().slice(0, 10);

    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row.eventDate < today).toBe(true);
    }
  }, 120_000);

  it('leaves the deliberately unreviewed vendor at zero', async () => {
    await seedMarketingData(testDb.db, NOW);

    const [row] = await testDb.db
      .select()
      .from(vendorProfiles)
      .where(eq(vendorProfiles.slug, 'sunlit-studio'));

    expect(row?.reviewCount).toBe(0);
    expect(Number(row?.avgRating)).toBe(0);
  }, 120_000);

  it('prices the cheapest active package at the vendor’s advertised From price', async () => {
    await seedMarketingData(testDb.db, NOW);

    for (const vendor of MARKETING_VENDORS) {
      const [profile] = await testDb.db
        .select({ id: vendorProfiles.id })
        .from(vendorProfiles)
        .where(eq(vendorProfiles.slug, vendor.slug));

      const packages = await testDb.db
        .select({ priceCents: servicePackages.priceCents })
        .from(servicePackages)
        .where(and(eq(servicePackages.vendorId, profile!.id), eq(servicePackages.isActive, true)));

      const cheapest = Math.min(...packages.map((row) => row.priceCents));
      expect(cheapest, `${vendor.slug} from-price`).toBe(vendor.packages[0]!.priceCents);
    }
  }, 120_000);

  it('files every vendor under photography so category search finds them', async () => {
    await seedMarketingData(testDb.db, NOW);

    const links = await testDb.db.select().from(vendorCategories);
    expect(links).toHaveLength(MARKETING_VENDORS.length);
  }, 120_000);

  it('blocks only future dates on the calendar', async () => {
    await seedMarketingData(testDb.db, NOW);

    const rows = await testDb.db.select().from(availability);
    const today = NOW.toISOString().slice(0, 10);

    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row.date > today).toBe(true);
      expect(row.status === 'booked' || row.status === 'blocked').toBe(true);
    }
  }, 120_000);

  it('is idempotent — a second run does not duplicate a single row', async () => {
    const first = await seedMarketingData(testDb.db, NOW);
    const second = await seedMarketingData(testDb.db, NOW);

    expect(second).toEqual(first);

    const [profiles, reviewRows, bookingRows, requestRows, packageRows, userRows] =
      await Promise.all([
        testDb.db.select({ id: vendorProfiles.id }).from(vendorProfiles),
        testDb.db.select({ id: reviews.id }).from(reviews),
        testDb.db.select({ id: bookings.id }).from(bookings),
        testDb.db.select({ id: bookingRequests.id }).from(bookingRequests),
        testDb.db.select({ id: servicePackages.id }).from(servicePackages),
        testDb.db.select({ id: users.id }).from(users),
      ]);

    expect(profiles).toHaveLength(MARKETING_VENDORS.length);
    expect(reviewRows).toHaveLength(first.reviewsCreated);
    expect(bookingRows).toHaveLength(first.bookingsCreated);
    expect(requestRows).toHaveLength(first.bookingsCreated);
    expect(packageRows).toHaveLength(first.packagesUpserted);
    expect(userRows).toHaveLength(MARKETING_VENDORS.length + MARKETING_CUSTOMERS.length);
  }, 180_000);

  it('adopts a vendor that already exists under a different account', async () => {
    // Stand in for the hand-seeded rows already in the development database:
    // same business, same slug, no cover, owned by an unrelated user.
    const [existingUser] = await testDb.db
      .insert(users)
      .values({
        clerkUserId: 'legacy_hand_seeded_user',
        email: 'legacy@example.com',
        role: 'vendor',
        firstName: 'Legacy',
        lastName: 'Owner',
      })
      .returning({ id: users.id });

    const [legacyProfile] = await testDb.db
      .insert(vendorProfiles)
      .values({
        userId: existingUser!.id,
        businessName: 'June Harlow',
        slug: 'june-harlow',
        isPublished: false,
      })
      .returning({ id: vendorProfiles.id });

    await seedMarketingData(testDb.db, NOW);

    const rows = await testDb.db
      .select()
      .from(vendorProfiles)
      .where(eq(vendorProfiles.slug, 'june-harlow'));

    // Adopted in place: one row, same id, now carrying a cover and published.
    expect(rows).toHaveLength(1);
    expect(rows[0]?.id).toBe(legacyProfile!.id);
    expect(rows[0]?.coverImageUrl).toBe('/marketing/vendors/june-harlow.jpg');
    expect(rows[0]?.isPublished).toBe(true);

    await testDb.db.delete(users).where(eq(users.id, existingUser!.id));
  }, 120_000);
});

describe('clearMarketingData', () => {
  it('removes every row the seed owns and leaves unrelated data alone', async () => {
    await seedMarketingData(testDb.db, NOW);

    const [outsider] = await testDb.db
      .insert(users)
      .values({
        clerkUserId: 'real_developer_account',
        email: 'dev@example.com',
        role: 'customer',
        firstName: 'Real',
        lastName: 'Developer',
      })
      .returning({ id: users.id });

    await clearMarketingData(testDb.db);

    const [profiles, reviewRows, bookingRows, requestRows, remaining] = await Promise.all([
      testDb.db.select({ id: vendorProfiles.id }).from(vendorProfiles),
      testDb.db.select({ id: reviews.id }).from(reviews),
      testDb.db.select({ id: bookings.id }).from(bookings),
      testDb.db.select({ id: bookingRequests.id }).from(bookingRequests),
      testDb.db.select({ id: users.id }).from(users),
    ]);

    expect(profiles).toHaveLength(0);
    expect(reviewRows).toHaveLength(0);
    expect(bookingRows).toHaveLength(0);
    expect(requestRows).toHaveLength(0);
    expect(remaining.map((row) => row.id)).toEqual([outsider!.id]);

    await testDb.db.delete(users).where(inArray(users.id, [outsider!.id]));
  }, 120_000);

  it('is safe to run when nothing has been seeded', async () => {
    await clearMarketingData(testDb.db);
    await expect(clearMarketingData(testDb.db)).resolves.toBeUndefined();
  });
});

describe('the seed prefix', () => {
  it('marks every identity the seed creates, which is what scopes the cleanup', async () => {
    await clearMarketingData(testDb.db);
    await seedMarketingData(testDb.db, NOW);

    const rows = await testDb.db.select({ clerkUserId: users.clerkUserId }).from(users);

    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((row) => row.clerkUserId.startsWith(MARKETING_SEED_PREFIX))).toBe(true);
  }, 120_000);
});
