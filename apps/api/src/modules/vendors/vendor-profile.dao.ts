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

/** Active packages only: an inactive one is a draft the vendor took down. */
export async function findActivePackages(db: AppDatabase, vendorId: string) {
  return db
    .select()
    .from(servicePackages)
    .where(and(eq(servicePackages.vendorId, vendorId), eq(servicePackages.isActive, true)))
    .orderBy(asc(servicePackages.displayOrder), asc(servicePackages.createdAt));
}

export async function findPortfolio(db: AppDatabase, vendorId: string) {
  return db
    .select()
    .from(portfolioItems)
    .where(eq(portfolioItems.vendorId, vendorId))
    .orderBy(asc(portfolioItems.displayOrder), asc(portfolioItems.createdAt));
}
