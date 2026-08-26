import {
  CATEGORY_SEEDS,
  CATEGORY_SLUG_SUCCESSORS,
  CATEGORY_SLUGS,
  TAG_SEEDS,
} from '@vendorhub/shared';
import { eq, inArray, not, sql } from 'drizzle-orm';
import type { TablesRelationalConfig } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { categories, tags, vendorCategories } from './schema/index.js';

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
 * Folds every retired category slug into its successor before the upsert runs.
 *
 * A rename is applied to the row in place, so the category keeps its id and
 * every `vendor_categories` link. A merge — where the successor already exists
 * — copies the links across (ignoring vendors already in both) and drops the
 * retired row. Runs in one transaction: a half-applied merge would strand
 * vendors on a category the seeds no longer describe.
 */
async function applyCategorySuccessors<
  TQueryResult extends PgQueryResultHKT,
  TFullSchema extends Record<string, unknown>,
  TSchema extends TablesRelationalConfig,
>(db: AnyPgDatabase<TQueryResult, TFullSchema, TSchema>): Promise<void> {
  await db.transaction(async (tx) => {
    for (const [retiredSlug, successorSlug] of Object.entries(CATEGORY_SLUG_SUCCESSORS)) {
      const retired = await tx
        .select({ id: categories.id })
        .from(categories)
        .where(eq(categories.slug, retiredSlug));
      const retiredRow = retired?.[0];

      if (!retiredRow) {
        continue;
      }

      const successor = await tx
        .select({ id: categories.id })
        .from(categories)
        .where(eq(categories.slug, successorSlug));
      const successorRow = successor?.[0];

      if (!successorRow) {
        await tx
          .update(categories)
          .set({ slug: successorSlug })
          .where(eq(categories.id, retiredRow.id));
        continue;
      }

      const links = await tx
        .select({ vendorId: vendorCategories.vendorId })
        .from(vendorCategories)
        .where(eq(vendorCategories.categoryId, retiredRow.id));

      if (links.length > 0) {
        // `onConflictDoNothing` covers the vendor already listed under both,
        // which would otherwise collide on the composite primary key.
        await tx
          .insert(vendorCategories)
          .values(links.map((link) => ({ vendorId: link.vendorId, categoryId: successorRow.id })))
          .onConflictDoNothing();
      }

      // The retired row's own links go with it: `vendor_categories.category_id`
      // cascades on delete.
      await tx.delete(categories).where(eq(categories.id, retiredRow.id));
    }
  });
}

/**
 * Inserts the launch categories. Idempotent: re-running updates the existing
 * row in place on the unique `slug` index rather than inserting a duplicate,
 * so edits to `CATEGORY_SEEDS` propagate on the next run. Retired slugs are
 * folded into their successors first, and any category the seeds no longer
 * describe is deactivated rather than deleted — a hard delete would take its
 * `vendor_categories` rows with it.
 */
export async function seedCategories<
  TQueryResult extends PgQueryResultHKT,
  TFullSchema extends Record<string, unknown>,
  TSchema extends TablesRelationalConfig,
>(db: AnyPgDatabase<TQueryResult, TFullSchema, TSchema>): Promise<number> {
  await applyCategorySuccessors(db);

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

  await db
    .update(categories)
    .set({ isActive: false })
    .where(not(inArray(categories.slug, [...CATEGORY_SLUGS])));

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
