import {
  CATEGORY_SEEDS,
  CATEGORY_SLUG_SUCCESSORS,
  CATEGORY_SLUGS,
  TAG_SEEDS,
} from '@vendor-marketplace/shared';
import { eq, inArray, not, sql } from 'drizzle-orm';
import type { TablesRelationalConfig } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { categories, tags, usCities, vendorCategories } from './schema/index.js';
import type { NewUsCityRow } from './schema/us-cities.js';
import { usCityRows } from './us-cities.js';

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
 * Inserts the launch tags: languages, cultural specialties and dietary
 * preferences. Idempotent on the unique `slug` index in the same way as
 * `seedCategories`, so edits to `TAG_SEEDS` propagate without orphaning the
 * `vendor_tags` rows that point at existing tag ids.
 *
 * Every group is global, so unlike `seedCategories` this needs nothing read
 * back first. It did until #329: the `style` group scoped each tag to one
 * vendor category, so the seed had to resolve that category's id rather than
 * assume an order.
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

/**
 * How many `us_cities` rows go in one statement.
 *
 * The dataset is ~35,600 places and Postgres caps a statement at 65,535 bound
 * parameters; four columns puts the ceiling at 16,383 rows, so this is a third
 * of the limit and not a guess about performance. One statement per chunk, no
 * transaction: the insert is idempotent per row, so a torn run is repaired by
 * running it again rather than by rolling anything back.
 */
const CITY_CHUNK = 5_000;

/**
 * The US places the `City` typeahead suggests (#384).
 *
 * Reference data in the same sense the taxonomy is: owned by the seed, changed
 * by a data refresh rather than by anything a user does, and **independent of
 * `vendor_profiles`**. Before #384 the field was fed by the inventory itself,
 * which is what made a place with nobody in it unpickable; the user's
 * instruction was that any US city must be searchable, so the source of truth
 * moved here.
 *
 * Upserts rather than replaces. A refresh that emptied the table first would
 * leave a window in which the search bar suggests nothing, and it would do it
 * on every `pnpm db:seed` — including the one `lane:up` runs.
 */
export async function seedUsCities<
  TQueryResult extends PgQueryResultHKT,
  TFullSchema extends Record<string, unknown>,
  TSchema extends TablesRelationalConfig,
>(
  db: AnyPgDatabase<TQueryResult, TFullSchema, TSchema>,
  /*
   * The committed dataset by default; a handful of rows in a test that is about
   * matching rather than about the data. Inserting all 35,618 to prove `Austin`
   * outranks `Austin, MN` costs ~3s and proves nothing extra.
   *
   * Resolved inside the function rather than as a default expression, because
   * `usCityRows` loads the 612KB dataset with a dynamic import — a caller that
   * passes its own rows must not pay for it, which is the whole reason that
   * import is dynamic.
   */
  given?: readonly NewUsCityRow[],
): Promise<number> {
  const rows = given ?? (await usCityRows());

  for (let at = 0; at < rows.length; at += CITY_CHUNK) {
    await db
      .insert(usCities)
      .values(rows.slice(at, at + CITY_CHUNK))
      .onConflictDoUpdate({
        target: [usCities.name, usCities.state],
        set: {
          population: sql`excluded.population`,
          searchName: sql`excluded.search_name`,
        },
      });
  }

  return rows.length;
}

/**
 * Populates the reference tables **every surface needs to render**. Safe to run
 * repeatedly.
 *
 * `seedUsCities` is deliberately not in here, and the reason is measured: the
 * places dataset is 35,618 rows and takes ~3s to insert into PGlite, which
 * every API test suite would pay once for a table almost none of them reads.
 * `pnpm db:seed` runs both — see `scripts/seed.ts` — so a lane and a developer
 * still get a complete database from one command, and a test that needs places
 * inserts the handful it is about.
 */
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
