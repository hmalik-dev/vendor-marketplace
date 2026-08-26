import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CATEGORY_SEEDS } from '@vendorhub/shared';
import { asc, eq } from 'drizzle-orm';
import { categories } from './schema/index.js';
import { seedCategories } from './seed.js';
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
    const result = await seedCategories(testDb.db);
    expect(result.categoriesUpserted).toBe(CATEGORY_SEEDS.length);

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
