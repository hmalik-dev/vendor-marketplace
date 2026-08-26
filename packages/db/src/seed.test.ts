import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  CATEGORY_SEEDS,
  CATEGORY_SLUG_SUCCESSORS,
  TAG_CATEGORIES,
  TAG_SEEDS,
} from '@vendor-marketplace/shared';
import { asc, eq } from 'drizzle-orm';
import { categories, tags } from './schema/index.js';
import { seedCategories, seedReferenceData, seedTags } from './seed.js';
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

  it('is idempotent — a second run does not duplicate tags', async () => {
    await seedTags(testDb.db);
    await seedTags(testDb.db);

    const rows = await testDb.db.select().from(tags);
    expect(rows).toHaveLength(TAG_SEEDS.length);
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
});
