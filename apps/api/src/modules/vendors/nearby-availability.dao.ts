import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import { categories, vendorCategories, vendorProfiles } from '@vendor-marketplace/db/schema';
import type { NearbyAvailabilityQuery, NearbyVendor } from '@vendor-marketplace/shared';
import type { AppDatabase } from '../../lib/database.js';

/**
 * "Free on a nearby date instead" — the band that closes frame `18`.
 *
 * A customer whose date came back empty is at a dead end, and the one thing
 * that reliably unsticks them is knowing who could do the week either side.
 *
 * **One date per vendor, not a calendar.** The card renders a single date and
 * #7's blocked-date suggestion renders two, so returning every free day in the
 * window would be more data than either consumer has anywhere to put.
 *
 * The correlated subqueries below name their tables and columns literally, for
 * the reason `vendor-search.dao.ts` documents at length: Drizzle renders a
 * column reference inside a `sql` template unqualified, which inside a
 * correlated subquery resolves to the *inner* table and silently matches
 * nothing. Every value that varies is still a bound parameter.
 */

const VISIBLE = and(eq(vendorProfiles.isPublished, true), eq(vendorProfiles.isDeleted, false));

/**
 * The nearest day this vendor is free, as `YYYY-MM-DD`, or null.
 *
 * Two rules are enforced here rather than in the caller, because both are
 * about what the *database* considers a candidate day:
 *
 * - **Never the past.** The window's lower bound is the later of the window
 *   start and today, so a search anchored on today can only ever look forward.
 *   `11-search.md` rules out offering a date nobody can book.
 * - **Never the wanted date.** A vendor free on it would have been in the main
 *   results; offering them here as an alternative to themselves is noise.
 *
 * "Nearest" is by distance from the wanted date, not the earliest in the
 * window, so a customer is offered the smallest move. Ties break earlier,
 * because the sooner of two equally-distant days is the one still bookable.
 */
function nearestAvailableDate(target: string, windowDays: number) {
  /*
   * `candidate.day` is cast to `date` at every use. `generate_series` over an
   * interval yields **timestamps**, and a timestamp minus a date is an
   * interval, which `abs()` has no overload for — the whole query fails with
   * "no function matches" rather than returning a wrong answer.
   */
  return sql<string | null>`(
    SELECT to_char(candidate.day::date, 'YYYY-MM-DD')
    FROM generate_series(
      GREATEST(${target}::date - ${windowDays}::int, CURRENT_DATE),
      ${target}::date + ${windowDays}::int,
      interval '1 day'
    ) AS candidate(day)
    WHERE candidate.day::date <> ${target}::date
      AND NOT EXISTS (
        SELECT 1 FROM availability a
        WHERE a.vendor_id = vendor_profiles.id
          AND a.date = candidate.day::date
          AND a.status <> 'available'
      )
    ORDER BY abs(candidate.day::date - ${target}::date), candidate.day
    LIMIT 1
  )`;
}

/** The vendor is taken on the wanted date — which is why they are being offered. */
const UNAVAILABLE_ON_TARGET = (target: string) => sql`EXISTS (
  SELECT 1 FROM availability a
  WHERE a.vendor_id = vendor_profiles.id
    AND a.date = ${target}
    AND a.status <> 'available'
)`;

const STARTING_PRICE_CENTS = sql<number | null>`(
  SELECT MIN(sp.price_cents) FROM service_packages sp
  WHERE sp.vendor_id = vendor_profiles.id AND sp.is_active = true
)`;

export interface NearbyAvailabilityPage {
  items: NearbyVendor[];
  total: number;
}

export async function findVendorsFreeNearby(
  db: AppDatabase,
  query: NearbyAvailabilityQuery,
): Promise<NearbyAvailabilityPage> {
  const conditions = [VISIBLE, UNAVAILABLE_ON_TARGET(query.date)];

  if (query.city) {
    conditions.push(sql`lower(${vendorProfiles.city}) = ${query.city.toLowerCase()}`);
  }
  if (query.state) {
    conditions.push(sql`lower(${vendorProfiles.state}) = ${query.state.toLowerCase()}`);
  }
  if (query.category) {
    conditions.push(sql`EXISTS (
      SELECT 1 FROM vendor_categories vc
      JOIN categories c ON c.id = vc.category_id
      WHERE vc.vendor_id = vendor_profiles.id AND c.slug = ${query.category}
    )`);
  }

  const nearest = nearestAvailableDate(query.date, query.windowDays);

  /*
   * The nearest-date expression is repeated in the WHERE rather than aliased,
   * because Postgres does not allow a SELECT alias in a WHERE clause. Both
   * copies come from the same builder, so they cannot drift apart.
   */
  const where = and(...conditions, sql`${nearest} IS NOT NULL`);

  const rows = await db
    .select({
      id: vendorProfiles.id,
      businessName: vendorProfiles.businessName,
      slug: vendorProfiles.slug,
      city: vendorProfiles.city,
      state: vendorProfiles.state,
      profileImageUrl: vendorProfiles.profileImageUrl,
      coverImageUrl: vendorProfiles.coverImageUrl,
      avgRating: vendorProfiles.avgRating,
      reviewCount: vendorProfiles.reviewCount,
      startingPriceCents: STARTING_PRICE_CENTS,
      nearestAvailableDate: nearest,
    })
    .from(vendorProfiles)
    .where(where)
    /*
     * Closest date first — the whole question is "how little do I have to
     * move" — then the search's own tie-breaks, so two vendors free on the
     * same day are ordered by standing rather than arbitrarily.
     */
    .orderBy(
      sql`abs((${nearest})::date - ${query.date}::date)`,
      sql`${vendorProfiles.avgRating} DESC`,
      sql`${vendorProfiles.reviewCount} DESC`,
      asc(vendorProfiles.id),
    )
    .limit(query.limit);

  /*
   * Counted over the same predicate, not over the returned page: this is what
   * "See all N in the region" says, and a count of the three cards on screen
   * would make that link a lie.
   */
  const [counted] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(vendorProfiles)
    .where(where);

  const vendorIds = rows.map((row) => row.id);
  const categoryRows =
    vendorIds.length === 0
      ? []
      : await db
          .select({
            vendorId: vendorCategories.vendorId,
            id: categories.id,
            name: categories.name,
            slug: categories.slug,
          })
          .from(vendorCategories)
          .innerJoin(categories, eq(categories.id, vendorCategories.categoryId))
          .where(inArray(vendorCategories.vendorId, vendorIds))
          .orderBy(asc(categories.displayOrder));

  const categoriesByVendor = new Map<string, NearbyVendor['categories']>();
  for (const row of categoryRows) {
    const list = categoriesByVendor.get(row.vendorId) ?? [];
    list.push({ id: row.id, name: row.name, slug: row.slug });
    categoriesByVendor.set(row.vendorId, list);
  }

  return {
    items: rows.flatMap((row) => {
      // `IS NOT NULL` in the predicate already guarantees this; the guard is
      // what lets the type stay non-nullable rather than being asserted away.
      if (row.nearestAvailableDate === null) {
        return [];
      }

      return [
        {
          id: row.id,
          businessName: row.businessName,
          slug: row.slug,
          city: row.city,
          state: row.state,
          profileImageUrl: row.profileImageUrl,
          coverImageUrl: row.coverImageUrl,
          avgRating: Number(row.avgRating),
          reviewCount: row.reviewCount,
          startingPriceCents:
            row.startingPriceCents === null ? null : Number(row.startingPriceCents),
          categories: categoriesByVendor.get(row.id) ?? [],
          // The vendor is, by construction, not free on the wanted date.
          availableOnDate: false,
          nearestAvailableDate: row.nearestAvailableDate,
        },
      ];
    }),
    total: counted?.total ?? 0,
  };
}
