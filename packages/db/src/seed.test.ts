import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  CATEGORY_SEEDS,
  CATEGORY_SLUG_SUCCESSORS,
  TAG_CATEGORIES,
  TAG_SEEDS,
} from '@vendor-marketplace/shared';
import { asc, eq } from 'drizzle-orm';
import {
  categories,
  tags,
  usCities,
  users,
  vendorCategories,
  vendorProfiles,
} from './schema/index.js';
import { seedCategories, seedReferenceData, seedTags, seedUsCities } from './seed.js';
import { createTestDatabase, type TestDatabase } from './testing/test-db.js';

let testDb: TestDatabase;

beforeAll(async () => {
  testDb = await createTestDatabase();
  await testDb.runMigrations();
});

afterAll(async () => {
  await testDb.close();
});

describe('seedCategories', () => {
  it('inserts every launch category on a fresh database', async () => {
    const upserted = await seedCategories(testDb.db);
    expect(upserted).toBe(CATEGORY_SEEDS.length);

    const rows = await testDb.db.select().from(categories).orderBy(asc(categories.displayOrder));

    expect(rows).toHaveLength(CATEGORY_SEEDS.length);
    expect(rows.map((row) => row.slug)).toEqual(CATEGORY_SEEDS.map((seed) => seed.slug));
    expect(rows.every((row) => row.isActive)).toBe(true);
  });

  it('is idempotent — a second run does not duplicate categories', async () => {
    await seedCategories(testDb.db);
    await seedCategories(testDb.db);

    const rows = await testDb.db.select().from(categories);
    expect(rows).toHaveLength(CATEGORY_SEEDS.length);
  });

  it('preserves category ids across runs so foreign keys stay valid', async () => {
    const before = await testDb.db.select().from(categories).orderBy(asc(categories.slug));
    await seedCategories(testDb.db);
    const after = await testDb.db.select().from(categories).orderBy(asc(categories.slug));

    expect(after.map((row) => row.id)).toEqual(before.map((row) => row.id));
  });

  it('repairs a drifted category row in place', async () => {
    const seed = CATEGORY_SEEDS[0];
    expect(seed).toBeDefined();

    await testDb.db
      .update(categories)
      .set({ name: 'Wrong Name', isActive: false, displayOrder: 99 })
      .where(eq(categories.slug, seed!.slug));

    await seedCategories(testDb.db);

    const [row] = await testDb.db.select().from(categories).where(eq(categories.slug, seed!.slug));
    expect(row).toBeDefined();
    expect(row!.name).toBe(seed!.name);
    expect(row!.isActive).toBe(true);
    expect(row!.displayOrder).toBe(seed!.displayOrder);
  });
});

describe('seedCategories — retired slugs', () => {
  it('renames a retired category in place, keeping its id and its vendors', async () => {
    await seedCategories(testDb.db);

    const [entertainment] = await testDb.db
      .select()
      .from(categories)
      .where(eq(categories.slug, 'entertainment'));
    expect(entertainment).toBeDefined();

    // Wind the row back to the slug the previous taxonomy shipped.
    await testDb.db
      .update(categories)
      .set({ slug: 'dj-music', name: 'DJ/Music' })
      .where(eq(categories.id, entertainment!.id));

    await seedCategories(testDb.db);

    const rows = await testDb.db.select().from(categories).where(eq(categories.slug, 'dj-music'));
    expect(rows).toHaveLength(0);

    const [renamed] = await testDb.db
      .select()
      .from(categories)
      .where(eq(categories.slug, 'entertainment'));
    expect(renamed).toBeDefined();
    // Same row, so every vendor_categories link survived the rename.
    expect(renamed!.id).toBe(entertainment!.id);
    expect(renamed!.name).toBe('Entertainment');
  });

  it('merges a retired category into an existing successor and drops the old row', async () => {
    await seedCategories(testDb.db);

    const [decor] = await testDb.db.select().from(categories).where(eq(categories.slug, 'decor'));
    expect(decor).toBeDefined();

    // `lighting` was folded into `decor`, so both rows can exist side by side.
    const [lighting] = await testDb.db
      .insert(categories)
      .values({
        name: 'Lighting',
        slug: 'lighting',
        description: 'Retired category.',
        icon: 'lightbulb',
        displayOrder: 99,
      })
      .returning();
    expect(lighting).toBeDefined();

    await seedCategories(testDb.db);

    const remaining = await testDb.db
      .select()
      .from(categories)
      .where(eq(categories.slug, 'lighting'));
    expect(remaining).toHaveLength(0);

    const [survivor] = await testDb.db
      .select()
      .from(categories)
      .where(eq(categories.slug, 'decor'));
    expect(survivor).toBeDefined();
    expect(survivor!.id).toBe(decor!.id);
  });

  /** The `florals` row as it stood before #419 dropped it from the seeds. */
  async function insertRetiredFlorals(): Promise<{ id: string }> {
    const [florals] = await testDb.db
      .insert(categories)
      .values({
        name: 'Florals',
        slug: 'florals',
        description: 'Bouquets, centerpieces, arches, and floral installations.',
        icon: 'flower',
        displayOrder: 99,
      })
      .returning();
    expect(florals).toBeDefined();

    return florals!;
  }

  /** A vendor listed under each of `categoryIds`, in that order. */
  async function insertVendorIn(
    name: string,
    categoryIds: readonly string[],
  ): Promise<{ id: string }> {
    const [user] = await testDb.db
      .insert(users)
      .values({
        clerkUserId: `user_${name}_419`,
        email: `${name}-419@example.com`,
        role: 'vendor',
        firstName: 'Saoirse',
        lastName: 'Kelleher',
      })
      .returning();
    const [vendor] = await testDb.db
      .insert(vendorProfiles)
      .values({ userId: user!.id, businessName: name, slug: `${name}-419` })
      .returning();
    await testDb.db
      .insert(vendorCategories)
      .values(categoryIds.map((categoryId) => ({ vendorId: vendor!.id, categoryId })));

    return vendor!;
  }

  /** The categories a vendor is listed under, by id. */
  async function categoryIdsOf(vendorId: string): Promise<string[]> {
    const links = await testDb.db
      .select({ categoryId: vendorCategories.categoryId })
      .from(vendorCategories)
      .where(eq(vendorCategories.vendorId, vendorId));

    return links.map((link) => link.categoryId);
  }

  /*
   * #419 — the acceptance criterion the ticket asked to be proven on data
   * rather than assumed: both categories were empty locally, so a re-point
   * that type-checks and silently drops rows would have looked identical to a
   * working one until staging ran it.
   *
   * The vendor is inserted by hand rather than through the demo seed so the
   * link exists *before* the fold runs, which is the only ordering that
   * exercises the merge branch.
   */
  it('carries a florists vendor across when florals folds into decor', async () => {
    await seedCategories(testDb.db);

    const [decor] = await testDb.db.select().from(categories).where(eq(categories.slug, 'decor'));
    expect(decor).toBeDefined();

    const florals = await insertRetiredFlorals();
    const vendor = await insertVendorIn('thistle', [florals.id]);

    await seedCategories(testDb.db);

    // The retired row is gone, not merely deactivated.
    expect(
      await testDb.db.select().from(categories).where(eq(categories.slug, 'florals')),
    ).toHaveLength(0);

    // And the vendor is listed under the survivor, on its original row.
    expect(await categoryIdsOf(vendor.id)).toEqual([decor!.id]);
  });

  /*
   * A vendor already selling under both is the collision the merge's
   * `onConflictDoNothing` exists for — without it the composite primary key
   * aborts the whole transaction and the fold never applies.
   */
  it('leaves a vendor listed under both with a single link, not a duplicate', async () => {
    await seedCategories(testDb.db);

    const [decor] = await testDb.db.select().from(categories).where(eq(categories.slug, 'decor'));
    const florals = await insertRetiredFlorals();
    const vendor = await insertVendorIn('wren', [florals.id, decor!.id]);

    await seedCategories(testDb.db);

    expect(await categoryIdsOf(vendor.id)).toEqual([decor!.id]);
  });

  it('deactivates a category the seeds no longer describe rather than deleting it', async () => {
    await seedCategories(testDb.db);

    await testDb.db.insert(categories).values({
      name: 'Petting Zoos',
      slug: 'petting-zoos',
      description: 'Never launched.',
      icon: 'shapes',
      displayOrder: 98,
    });

    await seedCategories(testDb.db);

    const [stale] = await testDb.db
      .select()
      .from(categories)
      .where(eq(categories.slug, 'petting-zoos'));
    // Still present: a hard delete would take its vendor_categories rows too.
    expect(stale).toBeDefined();
    expect(stale!.isActive).toBe(false);
  });

  it('leaves the seeded categories active while deactivating the stale one', async () => {
    await seedCategories(testDb.db);

    const rows = await testDb.db.select().from(categories);
    const seeded = rows.filter((row) => CATEGORY_SEEDS.some((seed) => seed.slug === row.slug));

    expect(seeded).toHaveLength(CATEGORY_SEEDS.length);
    expect(seeded.every((row) => row.isActive)).toBe(true);
    expect(Object.keys(CATEGORY_SLUG_SUCCESSORS)).not.toContain('photography');
  });
});

describe('seedTags', () => {
  it('inserts every launch tag on a fresh database', async () => {
    const upserted = await seedTags(testDb.db);
    expect(upserted).toBe(TAG_SEEDS.length);

    const rows = await testDb.db.select().from(tags);
    expect(rows).toHaveLength(TAG_SEEDS.length);
    expect(rows.every((row) => row.isActive)).toBe(true);
  });

  it('seeds every tag category', async () => {
    await seedTags(testDb.db);

    for (const category of TAG_CATEGORIES) {
      const rows = await testDb.db.select().from(tags).where(eq(tags.category, category));
      expect(rows.length).toBe(TAG_SEEDS.filter((seed) => seed.category === category).length);
    }
  });

  it('stores the same tag name under two categories as distinct rows', async () => {
    await seedTags(testDb.db);

    const korean = await testDb.db.select().from(tags).where(eq(tags.name, 'Korean'));
    expect(korean).toHaveLength(2);
    expect(new Set(korean.map((row) => row.category)).size).toBe(2);
  });

  it('is idempotent — a second run does not duplicate tags or add a group', async () => {
    await seedTags(testDb.db);
    await seedTags(testDb.db);

    const rows = await testDb.db.select().from(tags);
    expect(rows).toHaveLength(TAG_SEEDS.length);
    /*
     * The group set by name, not its size. #329 removed `style`, and a count
     * alone would pass just as happily on three groups with the wrong one in
     * them — which is the shape the seed would take if `style` came back.
     */
    expect([...new Set(rows.map((row) => row.category))].sort()).toEqual([
      'cultural',
      'dietary',
      'language',
    ]);
  });

  it('preserves tag ids across runs so vendor_tags rows stay valid', async () => {
    const before = await testDb.db.select().from(tags).orderBy(asc(tags.slug));
    await seedTags(testDb.db);
    const after = await testDb.db.select().from(tags).orderBy(asc(tags.slug));

    expect(after.map((row) => row.id)).toEqual(before.map((row) => row.id));
  });

  it('repairs a drifted tag row in place', async () => {
    const seed = TAG_SEEDS[0];
    expect(seed).toBeDefined();

    await testDb.db
      .update(tags)
      .set({ name: 'Wrong Name', isActive: false, displayOrder: 99 })
      .where(eq(tags.slug, seed!.slug));

    await seedTags(testDb.db);

    const [row] = await testDb.db.select().from(tags).where(eq(tags.slug, seed!.slug));
    expect(row).toBeDefined();
    expect(row!.name).toBe(seed!.name);
    expect(row!.isActive).toBe(true);
    expect(row!.displayOrder).toBe(seed!.displayOrder);
  });
});

describe('seedReferenceData', () => {
  it('reports both reference tables in one run', async () => {
    const result = await seedReferenceData(testDb.db);

    expect(result).toEqual({
      categoriesUpserted: CATEGORY_SEEDS.length,
      tagsUpserted: TAG_SEEDS.length,
    });
  });

  /*
   * The places dataset is 35,618 rows and ~3s of PGlite, and every API test
   * suite calls `seedReferenceData` once. Keeping it out is a measured choice,
   * so it needs a test — otherwise the next person to tidy the two functions
   * together adds three seconds to fifty suites and nothing says so.
   */
  it('leaves the 35,618-row places dataset to `seedUsCities`', async () => {
    await seedReferenceData(testDb.db);

    expect(await testDb.db.select().from(usCities)).toEqual([]);
  });
});

describe('seedUsCities', () => {
  // One database for the whole file, so each case starts from a known table
  // rather than from whatever the previous one left.
  beforeEach(async () => {
    await testDb.db.delete(usCities);
  });

  const row = (name: string, state: 'TX' | 'MN', population: number) => ({
    name,
    state,
    population,
    searchName: name.toLowerCase(),
  });

  it('inserts the rows it is given, with the pair as the identity', async () => {
    const inserted = await seedUsCities(testDb.db, [
      row('Austin', 'TX', 993_588),
      row('Austin', 'MN', 26_690),
    ]);

    expect(inserted).toBe(2);

    const stored = await testDb.db.select().from(usCities).orderBy(asc(usCities.state));
    expect(stored.map((place) => `${place.name}, ${place.state}`)).toEqual([
      'Austin, MN',
      'Austin, TX',
    ]);
  });

  it('updates a place in place on a re-run rather than duplicating or emptying it', async () => {
    await seedUsCities(testDb.db, [row('Austin', 'TX', 900_000)]);
    await seedUsCities(testDb.db, [row('Austin', 'TX', 993_588)]);

    // Upsert, not replace: `pnpm db:seed` runs on every `lane:up`, and a
    // delete-then-insert would leave a window where the field suggests nothing.
    const stored = await testDb.db.select().from(usCities);
    expect(stored).toHaveLength(1);
    expect(stored[0]!.population).toBe(993_588);
  });
});
