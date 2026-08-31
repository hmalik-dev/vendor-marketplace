import { and, asc, desc, eq, gte, inArray, sql, type SQL } from 'drizzle-orm';
import { categories, vendorCategories, vendorProfiles } from '@vendor-marketplace/db/schema';
import type { CategoryFacet, VendorCard, VendorSearchQuery } from '@vendor-marketplace/shared';
import type { AppDatabase } from '../../lib/database.js';
import { escapeLikePattern } from '../../lib/like-pattern.js';

/*
 * The correlated subqueries below are written with literal, fully qualified
 * table and column names rather than with Drizzle's column references.
 *
 * Drizzle renders a column inside a `sql` template unqualified — `"vendor_id"`,
 * not `"service_packages"."vendor_id"` — which inside a correlated subquery
 * silently resolves to the *inner* table. `WHERE vendor_id = id` then compares
 * two columns of the same table, matches nothing, and every from-price comes
 * back null. The names here are constants, never user input; every value that
 * is interpolated still goes through a bound parameter.
 */

/**
 * The public search query.
 *
 * Every filter is optional and they are AND-combined: a customer who narrows by
 * category, date and price is asking for all three at once, and returning the
 * union would bury the matches they actually asked for.
 *
 * Only published, non-deleted vendors are ever visible here.
 */
const VISIBLE = and(eq(vendorProfiles.isPublished, true), eq(vendorProfiles.isDeleted, false));

/**
 * The cheapest active package, as a correlated subquery.
 *
 * It is both the card's "From" price and the column `price_asc` sorts on, so it
 * is defined once. A vendor with no active package yields `null` and is shown
 * with "Contact for pricing" rather than being hidden.
 */
function startingPriceCents(): SQL<number | null> {
  return sql<number | null>`(
    SELECT MIN(sp.price_cents)
    FROM service_packages sp
    WHERE sp.vendor_id = vendor_profiles.id
      AND sp.is_active = true
  )`;
}

/**
 * Builds the WHERE fragments common to the result page, the total, and the
 * facet counts, so all three describe the same set. `exceptCategory` drops the
 * category filter, which is what makes a facet count answer "how many would I
 * get if I picked this one instead".
 */
function filters(query: VendorSearchQuery, exceptCategory = false): SQL[] {
  const conditions: SQL[] = [];
  const visible = VISIBLE;

  if (visible) {
    conditions.push(visible);
  }

  /*
   * Name search is the referral affordance, not a general text query: it
   * matches the business name and nothing else. Searching the bio too would
   * quietly restore the free-text main path that decision D6 removed, and it
   * would return vendors whose name the customer never typed.
   */
  if (query.name) {
    conditions.push(
      sql`lower(${vendorProfiles.businessName}) LIKE ${`%${escapeLikePattern(query.name.toLowerCase())}%`} ESCAPE '\\'`,
    );
  }

  if (query.city) {
    conditions.push(sql`lower(${vendorProfiles.city}) = ${query.city.toLowerCase()}`);
  }
  if (query.state) {
    conditions.push(sql`lower(${vendorProfiles.state}) = ${query.state.toLowerCase()}`);
  }

  if (!exceptCategory && query.category) {
    conditions.push(sql`EXISTS (
      SELECT 1 FROM vendor_categories vc
      JOIN categories c ON c.id = vc.category_id
      WHERE vc.vendor_id = vendor_profiles.id
        AND c.slug = ${query.category}
    )`);
  }

  /*
   * Price matches when ANY active package falls in the range, not just the
   * cheapest: a vendor whose entry-level package is under budget but whose
   * mid-tier is the one being searched for is still a real answer.
   */
  if (query.minPriceCents !== undefined || query.maxPriceCents !== undefined) {
    const bounds: SQL[] = [];
    if (query.minPriceCents !== undefined) {
      bounds.push(sql`sp.price_cents >= ${query.minPriceCents}`);
    }
    if (query.maxPriceCents !== undefined) {
      bounds.push(sql`sp.price_cents <= ${query.maxPriceCents}`);
    }

    conditions.push(sql`EXISTS (
      SELECT 1 FROM service_packages sp
      WHERE sp.vendor_id = vendor_profiles.id
        AND sp.is_active = true
        AND ${sql.join(bounds, sql` AND `)}
    )`);
  }

  if (query.minRating !== undefined) {
    conditions.push(gte(vendorProfiles.avgRating, String(query.minRating)));
  }

  /*
   * A date filter asks "who can actually do this day", so it excludes anyone
   * whose calendar says otherwise. A date with no row is available, which is
   * why this is a NOT EXISTS rather than a join.
   */
  if (query.date) {
    conditions.push(sql`NOT EXISTS (
      SELECT 1 FROM availability a
      WHERE a.vendor_id = vendor_profiles.id
        AND a.date = ${query.date}
        AND a.status <> 'available'
    )`);
  }

  /*
   * Tags are AND-combined: the vendor must carry every one selected. Counting
   * distinct matches against the number asked for is what enforces that.
   */
  if (query.tags && query.tags.length > 0) {
    conditions.push(sql`(
      SELECT COUNT(DISTINCT vt.tag_id)
      FROM vendor_tags vt
      WHERE vt.vendor_id = vendor_profiles.id
        AND vt.tag_id IN ${query.tags}
    ) = ${query.tags.length}`);
  }

  return conditions;
}

/**
 * ORDER BY, chosen from an allowlist rather than built from the query string —
 * a sort key is user input reaching SQL, and the enum is what keeps it safe.
 */
function ordering(sort: VendorSearchQuery['sort']): SQL[] {
  switch (sort) {
    case 'rating':
      return [desc(vendorProfiles.avgRating), desc(vendorProfiles.reviewCount)];
    case 'price_asc':
      // NULLS LAST: a vendor with no price yet is not the cheapest, they are
      // unpriced, and leading the cheapest-first list with them is a lie.
      return [sql`${startingPriceCents()} ASC NULLS LAST`];
    case 'price_desc':
      return [sql`${startingPriceCents()} DESC NULLS LAST`];
    case 'newest':
      return [desc(vendorProfiles.createdAt)];
    case 'relevance':
    default:
      // Reviewed vendors first, then by rating: an unreviewed 5.0 is one
      // opinion, and ranking it above a 4.8 with two hundred is noise.
      return [desc(vendorProfiles.reviewCount), desc(vendorProfiles.avgRating)];
  }
}

export interface VendorSearchPage {
  items: VendorCard[];
  total: number;
}

export async function searchVendors(
  db: AppDatabase,
  query: VendorSearchQuery,
): Promise<VendorSearchPage> {
  const where = and(...filters(query));
  const offset = (query.page - 1) * query.pageSize;

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
      startingPriceCents: startingPriceCents(),
    })
    .from(vendorProfiles)
    .where(where)
    /*
     * The id is the last tiebreaker, not the only one: it is a random UUID, so
     * on its own it would order two equally-rated vendors arbitrarily. Newest
     * first is a defensible answer to a tie; the id after it is what keeps
     * pagination stable, so no vendor is skipped or repeated across pages.
     */
    .orderBy(...ordering(query.sort), desc(vendorProfiles.createdAt), asc(vendorProfiles.id))
    .limit(query.pageSize)
    .offset(offset);

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
            displayOrder: categories.displayOrder,
          })
          .from(vendorCategories)
          .innerJoin(categories, eq(categories.id, vendorCategories.categoryId))
          .where(inArray(vendorCategories.vendorId, vendorIds))
          .orderBy(asc(categories.displayOrder));

  const categoriesByVendor = new Map<string, VendorCard['categories']>();
  for (const row of categoryRows) {
    const list = categoriesByVendor.get(row.vendorId) ?? [];
    list.push({ id: row.id, name: row.name, slug: row.slug });
    categoriesByVendor.set(row.vendorId, list);
  }

  return {
    items: rows.map((row) => ({
      id: row.id,
      businessName: row.businessName,
      slug: row.slug,
      city: row.city,
      state: row.state,
      profileImageUrl: row.profileImageUrl,
      coverImageUrl: row.coverImageUrl,
      avgRating: Number(row.avgRating),
      reviewCount: row.reviewCount,
      startingPriceCents: row.startingPriceCents === null ? null : Number(row.startingPriceCents),
      categories: categoriesByVendor.get(row.id) ?? [],
      // The filter already excluded anyone unavailable, so every row that
      // survives a dated query is available on that date.
      ...(query.date ? { availableOnDate: true } : {}),
    })),
    total: counted?.total ?? 0,
  };
}

/**
 * How many vendors each category would return under the *other* current
 * filters. The category filter itself is dropped, so the numbers answer "what
 * would I get if I picked this instead" rather than "how many of my current
 * results are in this category", which would be the selected one and zeroes.
 */
export async function categoryFacets(
  db: AppDatabase,
  query: VendorSearchQuery,
): Promise<CategoryFacet[]> {
  const rows = await db
    .select({
      categoryId: vendorCategories.categoryId,
      count: sql<number>`count(DISTINCT ${vendorProfiles.id})::int`,
    })
    .from(vendorProfiles)
    .innerJoin(vendorCategories, eq(vendorCategories.vendorId, vendorProfiles.id))
    .where(and(...filters(query, true)))
    .groupBy(vendorCategories.categoryId);

  return rows.map((row) => ({ categoryId: row.categoryId, count: row.count }));
}
