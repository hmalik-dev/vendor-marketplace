import { eq, sql, type SQL } from 'drizzle-orm';
import { vendorProfiles } from '@vendor-marketplace/db/schema';

/**
 * The owner of this storefront still has an account (#433).
 *
 * `users.deleted_at` was written by the `user.deleted` webhook and read by
 * nothing: no vendor visibility predicate joined it, so a vendor who deleted
 * their Clerk identity kept a published, searchable, bookable profile. The
 * deletion path now retires the profile itself, and this is the belt to that
 * pair of braces — a profile whose retirement failed still cannot be reached.
 *
 * A correlated `NOT EXISTS` rather than a join, because the queries that need it
 * select from `vendor_profiles` alone and compose a list of conditions —
 * `vendor-search.dao.ts` feeds one such list to three statements — so a join
 * would mean editing every one of their `FROM` clauses to carry a predicate
 * that belongs with the others. It is **not** that a join would change the
 * result: `vendor_profiles.user_id` is `NOT NULL` and references `users.id`, so
 * an inner join is strictly 1:1 and can neither duplicate nor drop a row. Both
 * forms probe the same index; the choice here is about where the predicate
 * lives, not about what it returns.
 *
 * `users_deleted_at_idx` is what makes it cheap — a partial index over the
 * retired accounts alone. Without it Postgres has no way to find just those
 * rows and builds the anti-join's hash side by reading the whole of `users`, on
 * every public read. See the index's own note in `packages/db/src/schema/users.ts`.
 *
 * **Every name here is written literally, and that is deliberate.** Drizzle
 * renders a column reference inside a `sql` template unqualified, which inside
 * a correlated subquery resolves to the *inner* table and silently matches
 * nothing — the trap `vendor-search.dao.ts` documents at length. Nothing here
 * is user input, so there is no parameter to bind.
 */
export const OWNER_NOT_DELETED = sql`NOT EXISTS (
  SELECT 1 FROM users
  WHERE users.id = vendor_profiles.user_id
    AND users.deleted_at IS NOT NULL
)`;

/**
 * A storefront the public may see: published, not retired, and owned by an
 * account that still exists.
 *
 * Defined once and imported. It used to be three identical copies plus a fourth
 * spelling in `messaging.dao.ts`, which is how the fourth one comes to be missed
 * the next time the definition of "visible" changes.
 *
 * A `sql` template rather than `and()`, so the type is `SQL` and not
 * `SQL | undefined`: every caller pushes this into a conditions array or
 * combines it, and an optional type made each of them carry a guard that could
 * never be false.
 */
export const VENDOR_VISIBLE: SQL = sql`${eq(vendorProfiles.isPublished, true)}
  AND ${eq(vendorProfiles.isDeleted, false)}
  AND ${OWNER_NOT_DELETED}`;
