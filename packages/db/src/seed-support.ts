import { eq, inArray, sql, type SQL } from 'drizzle-orm';
import type { TablesRelationalConfig } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';

import { bookings, users, vendorProfiles } from './schema/index.js';

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
 * Rewrites a customer's three derived booking counters from the bookings
 * themselves.
 *
 * `users.total/completed/cancelled_bookings_count` were documented as derived
 * and had **no writer anywhere**, so every customer read as a permanent
 * 0-booking "New member": their own profile said so, `/admin/customers` listed
 * zero for everyone, and `GET /customers/:id/profile` told every vendor the
 * person they were about to work with had never booked anything and had a null
 * completion rate (#408).
 *
 * Recomputed rather than incremented, exactly as `recomputeVendorRatings` below
 * is and for the same reason: a counter that is added to drifts the first time
 * a write is retried, and a counter derived from the rows it counts cannot.
 *
 * **It lives beside the seed helpers rather than in the API's DAO because the
 * seeds write `bookings` rows too.** `seed-demo` and `seed-marketing` bypass
 * the API entirely, so a writer only the API could reach left every freshly
 * seeded database showing the exact symptom the ticket exists to remove — and
 * `apps -> packages` is one-way, so the shared derivation has to be this side
 * of it. The API's three booking writers call it from their transactions.
 */
export async function refreshCustomerBookingCounts<
  TQueryResult extends PgQueryResultHKT,
  TFullSchema extends Record<string, unknown>,
  TSchema extends TablesRelationalConfig,
>(db: AnyPgDatabase<TQueryResult, TFullSchema, TSchema>, customerId: string): Promise<void> {
  /*
   * The `users` row first, and this is not belt-and-braces.
   *
   * Under READ COMMITTED a second transaction blocks on this row, then
   * re-evaluates the `SET` subqueries against **its own** statement snapshot —
   * taken before the first one committed — so two bookings confirmed
   * concurrently both write "1" and the customer's total is short by one until
   * some other booking of theirs moves. Reproduced on the Docker Postgres.
   * Taking the lock before the aggregate is what serialises the two readers;
   * `no key update` because nothing here touches the primary key, so an
   * unrelated foreign-key check against this user is not made to wait. Same
   * mechanism as `lockForRecompute` in the API's review DAO.
   */
  await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, customerId))
    .for('no key update')
    .limit(1);

  const countOf = (predicate: SQL): SQL<number> =>
    sql`(select count(*)::int from ${bookings}
         where ${bookings.customerId} = ${customerId} and ${predicate})`;

  await db
    .update(users)
    .set({
      totalBookingsCount: countOf(sql`true`),
      completedBookingsCount: countOf(sql`${bookings.status} = 'completed'`),
      cancelledBookingsCount: countOf(sql`${bookings.status} = 'cancelled'`),
      updatedAt: sql`now()`,
    })
    .where(eq(users.id, customerId));
}

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
