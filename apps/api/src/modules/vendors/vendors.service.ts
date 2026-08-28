import {
  generateSlug,
  vendorSearchResultSchema,
  type CreateVendorProfileInput,
  type PublishBlockerKey,
  type Tag,
  type VendorSearchQuery,
  type VendorSearchResult,
  type UpdateVendorProfileInput,
  type VendorProfileDetail,
} from '@vendor-marketplace/shared';
import type { NewVendorProfileRow, TagRow, VendorProfileRow } from '@vendor-marketplace/db/schema';
import type { AppDatabase } from '../../lib/database.js';
import { categoryFacets, searchVendors } from './vendor-search.dao.js';
import { conflict, notFound, validationFailed } from '../../lib/errors.js';
import { countActivePackages } from '../packages/packages.dao.js';
import {
  findActiveCategoryIds,
  findVendorCategoryIds,
  findVendorProfileByUserId,
  findVendorTags,
  insertVendorProfile,
  replaceVendorCategories,
  slugExists,
  updateVendorProfileById,
} from './vendors.dao.js';

/** How many `-2`, `-3`, … suffixes to try before giving up on a slug. */
const MAX_SLUG_ATTEMPTS = 50;

/**
 * An optional free-text field submitted empty means "clear this". The columns
 * are nullable, so an empty string would otherwise be stored as a distinct —
 * and meaningless — second kind of empty.
 */
function blankToNull(value: string): string | null {
  return value.trim() === '' ? null : value;
}

/** Postgres NUMERIC columns arrive as strings from the driver. */
function parseDecimal(value: string | null): number | null {
  if (value === null) {
    return null;
  }

  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseRating(value: string): number {
  return parseDecimal(value) ?? 0;
}

export function toVendorProfileDetail(
  row: VendorProfileRow,
  categoryIds: string[],
  tagRows: TagRow[],
  activePackageCount: number,
): VendorProfileDetail {
  return {
    ...row,
    latitude: parseDecimal(row.latitude),
    longitude: parseDecimal(row.longitude),
    avgRating: parseRating(row.avgRating),
    categoryIds,
    tags: tagRows satisfies Tag[],
    publishBlockers: publishBlockers(row, categoryIds, activePackageCount),
  };
}

/**
 * Everything still standing between this profile and a public listing. Returned
 * rather than thrown so the dashboard can show the list before the vendor tries
 * to publish.
 */
export function publishBlockers(
  row: VendorProfileRow,
  categoryIds: readonly string[],
  activePackageCount: number,
): PublishBlockerKey[] {
  const blockers: PublishBlockerKey[] = [];

  if (!row.businessName.trim()) {
    blockers.push('businessName');
  }
  if (!row.city?.trim() || !row.state?.trim()) {
    blockers.push('location');
  }
  if (categoryIds.length === 0) {
    blockers.push('categories');
  }
  if (!row.bio?.trim()) {
    blockers.push('bio');
  }
  /*
   * A customer deciding between two vendors reads the reply window before they
   * read the bio, so an unanswered one keeps the profile back the same way a
   * missing category does.
   */
  if (row.responseTimeHours === null || row.responseTimeHours === undefined) {
    blockers.push('responseTime');
  }
  if (activePackageCount === 0) {
    blockers.push('packages');
  }

  return blockers;
}

/**
 * Finds a free slug near `desired`. The unique index is still the authority —
 * a concurrent insert can win between the check and the write — but resolving
 * it here keeps the common case a clean, readable slug rather than a UUID.
 */
async function resolveSlug(
  db: AppDatabase,
  desired: string,
  exceptVendorId?: string,
): Promise<string> {
  const base = generateSlug(desired);

  for (let attempt = 1; attempt <= MAX_SLUG_ATTEMPTS; attempt += 1) {
    const candidate = attempt === 1 ? base : `${base}-${attempt}`;
    if (!(await slugExists(db, candidate, exceptVendorId))) {
      return candidate;
    }
  }

  throw conflict('That business name is already taken. Try a different one.');
}

/** Rejects category ids that do not exist or are no longer selectable. */
async function assertCategoriesSelectable(
  db: AppDatabase,
  categoryIds: readonly string[],
): Promise<string[]> {
  const unique = [...new Set(categoryIds)];
  const found = await findActiveCategoryIds(db, unique);

  if (found.length !== unique.length) {
    throw validationFailed('One or more selected categories are unavailable.');
  }

  // Preserve the caller's order; `findActiveCategoryIds` returns table order.
  return unique;
}

async function loadDetail(db: AppDatabase, row: VendorProfileRow): Promise<VendorProfileDetail> {
  const [categoryIds, tagRows, activePackageCount] = await Promise.all([
    findVendorCategoryIds(db, row.id),
    findVendorTags(db, row.id),
    countActivePackages(db, row.id),
  ]);

  return toVendorProfileDetail(row, categoryIds, tagRows, activePackageCount);
}

/**
 * The signed-in vendor's own profile row, for the surfaces that hang off it —
 * packages, portfolio, availability. They all need the vendor id and none of
 * them can do anything useful before the profile exists.
 */
export async function requireOwnVendorProfile(
  db: AppDatabase,
  userId: string,
): Promise<VendorProfileRow> {
  const row = await findVendorProfileByUserId(db, userId);
  if (!row) {
    throw notFound('Create your business profile before setting up your services');
  }

  return row;
}

/**
 * Takes a published profile back off the marketplace once its last bookable
 * package goes away. Publishing requires a package, so continuing to list a
 * vendor with none would send customers to a profile they cannot book.
 */
export async function unpublishForMissingPackages(
  db: AppDatabase,
  vendor: VendorProfileRow,
): Promise<boolean> {
  if (!vendor.isPublished) {
    return false;
  }

  if ((await countActivePackages(db, vendor.id)) > 0) {
    return false;
  }

  await updateVendorProfileById(db, vendor.id, { isPublished: false });
  return true;
}

/** The signed-in vendor's own profile. */
export async function getOwnVendorProfile(
  db: AppDatabase,
  userId: string,
): Promise<VendorProfileDetail> {
  const row = await findVendorProfileByUserId(db, userId);
  if (!row) {
    throw notFound('You have not created a vendor profile yet');
  }

  return loadDetail(db, row);
}

/** `null` rather than a throw, for callers deciding whether to onboard. */
export async function findOwnVendorProfile(
  db: AppDatabase,
  userId: string,
): Promise<VendorProfileDetail | null> {
  const row = await findVendorProfileByUserId(db, userId);
  return row ? loadDetail(db, row) : null;
}

export async function createVendorProfile(
  db: AppDatabase,
  userId: string,
  input: CreateVendorProfileInput,
): Promise<VendorProfileDetail> {
  const existing = await findVendorProfileByUserId(db, userId);
  if (existing) {
    throw conflict('You already have a vendor profile');
  }

  const categoryIds = await assertCategoriesSelectable(db, input.categoryIds);
  const slug = await resolveSlug(db, input.slug ?? input.businessName);

  const values: NewVendorProfileRow = {
    userId,
    businessName: input.businessName,
    slug,
    bio: blankToNull(input.bio ?? ''),
    tagline: blankToNull(input.tagline ?? ''),
    yearsInBusiness: input.yearsInBusiness ?? null,
    address: blankToNull(input.address ?? ''),
    city: input.city,
    state: input.state,
    latitude: input.latitude?.toString() ?? null,
    longitude: input.longitude?.toString() ?? null,
    serviceRadiusKm: input.serviceRadiusKm ?? null,
    responseTimeHours: input.responseTimeHours ?? null,
    profileImageUrl: input.profileImageUrl ?? null,
    coverImageUrl: input.coverImageUrl ?? null,
  };

  const row = await insertVendorProfile(db, values);
  await replaceVendorCategories(db, row.id, categoryIds);

  return loadDetail(db, row);
}

/**
 * Applies a profile edit. Only the fields present in the request are touched,
 * so a form that submits one section cannot blank out another. Publishing is
 * refused while any prerequisite is outstanding.
 */
export async function updateVendorProfile(
  db: AppDatabase,
  userId: string,
  input: UpdateVendorProfileInput,
): Promise<VendorProfileDetail> {
  const existing = await findVendorProfileByUserId(db, userId);
  if (!existing) {
    throw notFound('You have not created a vendor profile yet');
  }

  const patch: Partial<NewVendorProfileRow> = {};

  if (input.businessName !== undefined) {
    patch.businessName = input.businessName;
  }
  if (input.slug !== undefined) {
    patch.slug = await resolveSlug(db, input.slug, existing.id);
  } else if (input.businessName !== undefined && !existing.isPublished) {
    // Before the profile is public nobody has the old link, so the slug keeps
    // tracking the business name. Once published the slug is frozen unless the
    // vendor edits it deliberately.
    patch.slug = await resolveSlug(db, input.businessName, existing.id);
  }
  if (input.bio !== undefined) {
    patch.bio = blankToNull(input.bio);
  }
  if (input.tagline !== undefined) {
    // Blanking the field removes the pull-quote rather than storing an empty
    // string, which would render as an empty quote on the About tab.
    patch.tagline = blankToNull(input.tagline);
  }
  if (input.yearsInBusiness !== undefined) {
    patch.yearsInBusiness = input.yearsInBusiness;
  }
  if (input.address !== undefined) {
    patch.address = blankToNull(input.address);
  }
  if (input.city !== undefined) {
    patch.city = input.city;
  }
  if (input.state !== undefined) {
    patch.state = input.state;
  }
  if (input.latitude !== undefined) {
    patch.latitude = input.latitude.toString();
  }
  if (input.longitude !== undefined) {
    patch.longitude = input.longitude.toString();
  }
  if (input.serviceRadiusKm !== undefined) {
    patch.serviceRadiusKm = input.serviceRadiusKm;
  }
  if (input.responseTimeHours !== undefined) {
    patch.responseTimeHours = input.responseTimeHours;
  }
  if (input.profileImageUrl !== undefined) {
    patch.profileImageUrl = input.profileImageUrl;
  }
  if (input.coverImageUrl !== undefined) {
    patch.coverImageUrl = input.coverImageUrl;
  }

  const categoryIds =
    input.categoryIds === undefined
      ? undefined
      : await assertCategoriesSelectable(db, input.categoryIds);

  if (input.isPublished !== undefined) {
    if (input.isPublished) {
      const [effectiveCategories, activePackageCount] = await Promise.all([
        categoryIds === undefined ? findVendorCategoryIds(db, existing.id) : categoryIds,
        countActivePackages(db, existing.id),
      ]);
      const blockers = publishBlockers(
        { ...existing, ...patch } as VendorProfileRow,
        effectiveCategories,
        activePackageCount,
      );

      if (blockers.length > 0) {
        throw validationFailed('Complete your profile before publishing it.', { blockers });
      }
    }

    patch.isPublished = input.isPublished;
  }

  if (categoryIds !== undefined) {
    await replaceVendorCategories(db, existing.id, categoryIds);
  }

  const row =
    Object.keys(patch).length > 0
      ? await updateVendorProfileById(db, existing.id, patch)
      : existing;

  if (!row) {
    throw notFound('You have not created a vendor profile yet');
  }

  return loadDetail(db, row);
}

/**
 * The public search.
 *
 * The page and the facet counts are fetched together because the rail's counts
 * have to describe the same set the grid does — two round trips could disagree
 * with each other across a write, and a category offering "12" that returns
 * eight is worse than no count at all.
 */
export async function searchPublishedVendors(
  db: AppDatabase,
  query: VendorSearchQuery,
): Promise<VendorSearchResult> {
  const [page, facets] = await Promise.all([searchVendors(db, query), categoryFacets(db, query)]);

  return vendorSearchResultSchema.parse({
    items: page.items,
    total: page.total,
    page: query.page,
    pageSize: query.pageSize,
    facets: { categories: facets },
  });
}
