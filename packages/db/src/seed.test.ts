import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CATEGORY_SEEDS, TAG_CATEGORIES, TAG_SEEDS } from '@vendorhub/shared';
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
