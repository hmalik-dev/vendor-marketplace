import { and, asc, eq, isNotNull, ne, sql } from 'drizzle-orm';
import {
  categories,
  portfolioItems,
  servicePackages,
  tags,
  vendorCategories,
  vendorProfiles,
  vendorTags,
} from '@vendor-marketplace/db/schema';
import type { AppDatabase } from '../../lib/database.js';

/**
 * The public read of one vendor, by slug.
 *
 * Only published, non-deleted vendors are ever visible — the same predicate the
 * search DAO uses, and for the same reason: an unpublished profile is a draft,
 * and a deleted one is gone. A visitor asking for either gets a 404, never a
 * partially rendered page.
 */
const VISIBLE = and(eq(vendorProfiles.isPublished, true), eq(vendorProfiles.isDeleted, false));

/*
 * The two correlated subqueries below name their tables and columns literally,
 * for the reason `vendor-search.dao.ts` documents at length: Drizzle renders a
 * column reference inside a `sql` template unqualified, which inside a
 * correlated subquery resolves to the *inner* table and silently matches
 * nothing. These names are constants; the slug is still a bound parameter.
 */

/** The cheapest active package — the rail's "From" price. */
const STARTING_PRICE_CENTS = sql<number | null>`(
  SELECT MIN(sp.price_cents)
  FROM service_packages sp
  WHERE sp.vendor_id = vendor_profiles.id
    AND sp.is_active = true
)`;

/**
 * Completed bookings. The only "events" figure on the page that is not
 * self-declared, which is why it is the one shown — see ticket #41.
 */
const COMPLETED_EVENT_COUNT = sql<number>`(
  SELECT COUNT(*)::int
  FROM bookings b
  WHERE b.vendor_id = vendor_profiles.id
    AND b.status = 'completed'
)`;

export interface PublicVendorRow {
  id: string;
  businessName: string;
  slug: string;
  bio: string | null;
  tagline: string | null;
  yearsInBusiness: number | null;
  profileImageUrl: string | null;
  coverImageUrl: string | null;
  city: string | null;
  state: string | null;
  serviceRadiusKm: number | null;
  responseTimeHours: number | null;
  avgRating: string | number;
  reviewCount: number;
  completedEventCount: number;
  startingPriceCents: number | null;
}

export async function findPublicVendorBySlug(
  db: AppDatabase,
  slug: string,
): Promise<PublicVendorRow | null> {
  const [row] = await db
    .select({
      id: vendorProfiles.id,
      businessName: vendorProfiles.businessName,
      slug: vendorProfiles.slug,
      bio: vendorProfiles.bio,
      tagline: vendorProfiles.tagline,
      yearsInBusiness: vendorProfiles.yearsInBusiness,
      profileImageUrl: vendorProfiles.profileImageUrl,
      coverImageUrl: vendorProfiles.coverImageUrl,
      city: vendorProfiles.city,
      state: vendorProfiles.state,
      serviceRadiusKm: vendorProfiles.serviceRadiusKm,
      responseTimeHours: vendorProfiles.responseTimeHours,
      avgRating: vendorProfiles.avgRating,
      reviewCount: vendorProfiles.reviewCount,
      completedEventCount: COMPLETED_EVENT_COUNT,
      startingPriceCents: STARTING_PRICE_CENTS,
    })
    .from(vendorProfiles)
    .where(and(VISIBLE, eq(vendorProfiles.slug, slug)))
    .limit(1);

  return row ?? null;
}

export async function findVendorCategories(
  db: AppDatabase,
  vendorId: string,
): Promise<Array<{ id: string; name: string; slug: string }>> {
  return db
    .select({ id: categories.id, name: categories.name, slug: categories.slug })
    .from(vendorCategories)
    .innerJoin(categories, eq(categories.id, vendorCategories.categoryId))
    .where(and(eq(vendorCategories.vendorId, vendorId), eq(categories.isActive, true)))
    .orderBy(asc(categories.displayOrder));
}

export async function findPublicVendorTags(db: AppDatabase, vendorId: string) {
  return db
    .select({
      id: tags.id,
      name: tags.name,
      slug: tags.slug,
      category: tags.category,
      isActive: tags.isActive,
      createdAt: tags.createdAt,
    })
    .from(vendorTags)
    .innerJoin(tags, eq(tags.id, vendorTags.tagId))
    .where(and(eq(vendorTags.vendorId, vendorId), eq(tags.isActive, true)))
    .orderBy(asc(tags.name));
}

/**
 * Active packages only: an inactive one is a draft the vendor took down.
 *
 * `durationHours` is a `decimal` column, and the driver hands those back as
 * strings while the shared contract declares a number — the same mismatch the
 * profile already corrects for `avgRating`. It is coerced here rather than in
 * the service so every caller gets the contract's type, and because the defect
 * is invisible until a row actually carries a duration: every seeded package
 * had `null`, which satisfies the nullable schema, so `/vendors/:slug` answered
 * 200 right up until the column was populated and then answered 500 for every
 * vendor with a package.
 */
export async function findActivePackages(db: AppDatabase, vendorId: string) {
  const rows = await db
    .select()
    .from(servicePackages)
    .where(and(eq(servicePackages.vendorId, vendorId), eq(servicePackages.isActive, true)))
    .orderBy(asc(servicePackages.displayOrder), asc(servicePackages.createdAt));

  return rows.map((row) => ({
    ...row,
    durationHours: row.durationHours === null ? null : Number(row.durationHours),
  }));
}

export async function findPortfolio(db: AppDatabase, vendorId: string) {
  return db
    .select()
    .from(portfolioItems)
    .where(eq(portfolioItems.vendorId, vendorId))
    .orderBy(asc(portfolioItems.displayOrder), asc(portfolioItems.createdAt));
}

/**
 * Every city a customer can actually search, with how many vendors are in it.
 *
 * Derived from the published profiles themselves rather than from a list of US
 * cities: a picker offering somewhere with nobody in it is a picker that
 * guarantees an empty result, and the point of making City a select at all is
 * that it can only ask questions the platform can answer — the same rule the
 * vendor-type field already follows.
 *
 * City **and** state, always. "Springfield" names a place in thirty-odd states,
 * and a customer who picks the wrong Portland has been misled by the control
 * rather than by their own typing. Rows missing either half are dropped: half a
 * location cannot be matched against, and it is not a place a customer could
 * mean on purpose.
 */
export async function findVendorCities(db: AppDatabase) {
  const rows = await db
    .select({
      city: vendorProfiles.city,
      state: vendorProfiles.state,
      vendorCount: sql<number>`count(*)::int`,
    })
    .from(vendorProfiles)
    .where(
      and(
        VISIBLE,
        isNotNull(vendorProfiles.city),
        isNotNull(vendorProfiles.state),
        /*
         * City is free text and can still be blank. State cannot: since #332 it
         * is the `us_state` enum, so `''` is not a value the column can hold and
         * the guard that used to sit here is unrepresentable rather than merely
         * redundant — TypeScript rejects it outright.
         */
        ne(vendorProfiles.city, ''),
      ),
    )
    .groupBy(vendorProfiles.city, vendorProfiles.state)
    .orderBy(asc(vendorProfiles.city), asc(vendorProfiles.state));

  /*
   * The `NOT NULL` guard is in the query; this narrows the *type*, which
   * Drizzle cannot do from a `where` clause. A cast would have been shorter and
   * would also have been a lie the next reader had to check.
   */
  return rows.flatMap((row) =>
    row.city === null || row.state === null
      ? []
      : [{ city: row.city, state: row.state, vendorCount: row.vendorCount }],
  );
}
