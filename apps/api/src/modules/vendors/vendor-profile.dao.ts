import { and, asc, eq, sql } from 'drizzle-orm';
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

/*
 * **`findVendorCities` used to live here, and #384 removed it.** Its docstring
 * argued the case for the `City` field being fed by the inventory — *"a picker
 * offering somewhere with nobody in it is a picker that guarantees an empty
 * result"* — and that argument was not wrong; it was **overruled**, by the user,
 * in as many words: *"i currently want the city dropdown to function the way
 * airbnb's 'where' input functions. Do not preload and indicate how many
 * vendors are in each city.. users should be able to search for any city and
 * see the results."*
 *
 * The record is here rather than deleted so the next reader does not re-derive
 * the old answer and re-add the endpoint. What the old design protected is now
 * answered elsewhere: a place with nobody in it commits and lands on the frame
 * `18` no-results state with relaxations, and the pair is still *chosen* rather
 * than typed. Suggestions come from `us_cities`, which is US reference data and
 * touches no vendor row — see `GET /places` and D32.
 */
export async function findPortfolio(db: AppDatabase, vendorId: string) {
  return db
    .select()
    .from(portfolioItems)
    .where(eq(portfolioItems.vendorId, vendorId))
    .orderBy(asc(portfolioItems.displayOrder), asc(portfolioItems.createdAt));
}
