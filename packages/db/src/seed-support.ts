import { inArray, sql } from 'drizzle-orm';
import type { TablesRelationalConfig } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';

import { vendorProfiles } from './schema/index.js';

/**
 * Database helpers shared by the fabricating seeds.
 *
 * These lived in `seed-marketing.ts` until `seed-demo.ts` needed them, at which
 * point one peer dataset was importing from another — `seed-marketing.ts` could
 * not be renamed or narrowed without breaking `db:seed:demo`, while still
 * reading like a standalone fixture. They belong to neither seed, so they live
 * here. The pure deterministic primitives are in `deterministic.ts`; this file
 * is the half that touches the database.
 */

/**
 * Any Drizzle Postgres database — the pooled `postgres-js` client in
 * production, or the in-process PGlite driver used by the test suite.
 *
 * Declared once: it is the parameter type of every exported seed function in
 * the package, and a Drizzle major that changes the generic arity should be a
 * one-file edit rather than a four-file one.
 */
export type AnyPgDatabase<
  TQueryResult extends PgQueryResultHKT,
  TFullSchema extends Record<string, unknown>,
  TSchema extends TablesRelationalConfig,
> = PgDatabase<TQueryResult, TFullSchema, TSchema>;

/**
 * Recomputes `avg_rating` and `review_count` from the rows that actually exist.
 *
 * Both are derived columns and no seed may write them directly: a seeded
 * average that is merely asserted drifts from the reviews under it the first
 * time a review is added, removed or unpublished. Only public
 * customer-to-vendor reviews count toward a storefront's rating — the private
 * vendor-to-customer direction is deliberately excluded.
 */
export async function recomputeVendorRatings<
  TQueryResult extends PgQueryResultHKT,
  TFullSchema extends Record<string, unknown>,
  TSchema extends TablesRelationalConfig,
>(db: AnyPgDatabase<TQueryResult, TFullSchema, TSchema>, vendorIds: string[]): Promise<void> {
  if (vendorIds.length === 0) {
    return;
  }

  await db
    .update(vendorProfiles)
    .set({
      avgRating: sql`COALESCE((
        SELECT ROUND(AVG(r.rating)::numeric, 2)
        FROM reviews r
        WHERE r.vendor_id = ${vendorProfiles.id}
          AND r.type = 'customer_to_vendor'
          AND r.is_public = true
      ), 0)`,
      reviewCount: sql`(
        SELECT COUNT(*)
        FROM reviews r
        WHERE r.vendor_id = ${vendorProfiles.id}
          AND r.type = 'customer_to_vendor'
          AND r.is_public = true
      )`,
      updatedAt: sql`now()`,
    })
    .where(inArray(vendorProfiles.id, vendorIds));
}
