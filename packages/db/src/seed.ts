import { CATEGORY_SEEDS } from '@vendorhub/shared';
import { sql } from 'drizzle-orm';
import type { TablesRelationalConfig } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { categories } from './schema/index.js';

export interface SeedResult {
  categoriesUpserted: number;
}

/**
 * Accepts any Drizzle Postgres database — the pooled `postgres-js` client in
 * production, or the in-process PGlite driver used by the test suite.
 *
 * Inserts the launch categories. Idempotent: re-running updates the existing
 * row in place on the unique `slug` index rather than inserting a duplicate,
 * so edits to `CATEGORY_SEEDS` propagate on the next run.
 */
export async function seedCategories<
  TQueryResult extends PgQueryResultHKT,
  TFullSchema extends Record<string, unknown>,
  TSchema extends TablesRelationalConfig,
>(db: PgDatabase<TQueryResult, TFullSchema, TSchema>): Promise<SeedResult> {
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

  return { categoriesUpserted: inserted.length };
}
