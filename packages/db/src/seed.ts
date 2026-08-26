import { CATEGORY_SEEDS, TAG_SEEDS } from '@vendorhub/shared';
import { sql } from 'drizzle-orm';
import type { TablesRelationalConfig } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { categories, tags } from './schema/index.js';

export interface SeedResult {
  categoriesUpserted: number;
  tagsUpserted: number;
}

/**
 * Any Drizzle Postgres database — the pooled `postgres-js` client in
 * production, or the in-process PGlite driver used by the test suite.
 */
type AnyPgDatabase<
  TQueryResult extends PgQueryResultHKT,
  TFullSchema extends Record<string, unknown>,
  TSchema extends TablesRelationalConfig,
> = PgDatabase<TQueryResult, TFullSchema, TSchema>;

/**
 * Inserts the launch categories. Idempotent: re-running updates the existing
 * row in place on the unique `slug` index rather than inserting a duplicate,
 * so edits to `CATEGORY_SEEDS` propagate on the next run.
 */
export async function seedCategories<
  TQueryResult extends PgQueryResultHKT,
  TFullSchema extends Record<string, unknown>,
  TSchema extends TablesRelationalConfig,
>(db: AnyPgDatabase<TQueryResult, TFullSchema, TSchema>): Promise<number> {
  const rows = CATEGORY_SEEDS.map((category) => ({
    name: category.name,
    slug: category.slug,
    description: category.description,
    icon: category.icon,
    displayOrder: category.displayOrder,
    isActive: true,
  }));

  const inserted = await db
    .insert(categories)
    .values(rows)
    .onConflictDoUpdate({
      target: categories.slug,
      set: {
        name: sql`excluded.name`,
        description: sql`excluded.description`,
        icon: sql`excluded.icon`,
        displayOrder: sql`excluded.display_order`,
        isActive: sql`excluded.is_active`,
      },
    })
    .returning({ id: categories.id });

  return inserted.length;
}

/**
 * Inserts the launch tags (languages, cultural specialties, dietary
 * preferences). Idempotent on the unique `slug` index in the same way as
 * `seedCategories`, so edits to `TAG_SEEDS` propagate without orphaning the
 * `vendor_tags` rows that point at existing tag ids.
 */
export async function seedTags<
  TQueryResult extends PgQueryResultHKT,
  TFullSchema extends Record<string, unknown>,
  TSchema extends TablesRelationalConfig,
>(db: AnyPgDatabase<TQueryResult, TFullSchema, TSchema>): Promise<number> {
  const rows = TAG_SEEDS.map((tag) => ({
    name: tag.name,
    slug: tag.slug,
    category: tag.category,
    displayOrder: tag.displayOrder,
    isActive: true,
  }));

  const inserted = await db
    .insert(tags)
    .values(rows)
    .onConflictDoUpdate({
      target: tags.slug,
      set: {
        name: sql`excluded.name`,
        category: sql`excluded.category`,
        displayOrder: sql`excluded.display_order`,
        isActive: sql`excluded.is_active`,
      },
    })
    .returning({ id: tags.id });

  return inserted.length;
}

/** Populates every reference table. Safe to run repeatedly. */
export async function seedReferenceData<
  TQueryResult extends PgQueryResultHKT,
  TFullSchema extends Record<string, unknown>,
  TSchema extends TablesRelationalConfig,
>(db: AnyPgDatabase<TQueryResult, TFullSchema, TSchema>): Promise<SeedResult> {
  return {
    categoriesUpserted: await seedCategories(db),
    tagsUpserted: await seedTags(db),
  };
}
