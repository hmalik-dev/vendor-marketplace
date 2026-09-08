import {
  VENDOR_PROFILE_MODERATION_HOLD_MESSAGE,
  MAX_SLUG_LENGTH,
  generateSlug,
  vendorSearchResultSchema,
  type CreateVendorProfileInput,
  type PublishBlockerKey,
  type Tag,
  type VendorSearchQuery,
  type VendorSearchResult,
  type UpdateVendorProfileInput,
  type VendorProfileDetail,
  type FieldErrorDetails,
} from '@vendor-marketplace/shared';
import type { NewVendorProfileRow, TagRow, VendorProfileRow } from '@vendor-marketplace/db/schema';
import type { AppDatabase } from '../../lib/database.js';
import { categoryFacets, searchVendors } from './vendor-search.dao.js';
import { conflict, forbidden, notFound, validationFailed } from '../../lib/errors.js';
import { assertOwnedImageRefs, thumbnailKeyFor, type ObjectStorage } from '../../lib/storage.js';
import { reapObjects } from '../portfolio/portfolio.service.js';
import { replaceVendorTags } from '../tags/tags.dao.js';
import { resolveVendorTagSelection } from '../tags/tags.service.js';
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
 * `base` with a collision suffix, trimmed so the result still fits the column.
 *
 * `generateSlug` caps the base at `MAX_SLUG_LENGTH`, which is also the width of
 * `vendor_profiles.slug` — so appending `-2` to a business name at its own
 * 200-character limit produced a 202-character candidate. `slugExists` compared
 * it happily and the insert then threw `value too long for type character
 * varying(200)`: an opaque 500 rather than the 409 this loop is written to
 * produce, and a candidate the response schema could not have serialised
 * either. The suffix is what has to survive — it is the part that makes the
 * slug unique — so the base yields the room (#408).
 *
 * The trailing-hyphen strip matters: cutting a base mid-separator would leave
 * `studio--2`, which is not the slug shape the rest of the product reads.
 */
function withSuffix(base: string, attempt: number): string {
  const suffix = `-${attempt}`;
  const room = MAX_SLUG_LENGTH - suffix.length;

  return `${base.length <= room ? base : base.slice(0, room).replace(/-+$/, '')}${suffix}`;
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
    const candidate = attempt === 1 ? base : withSuffix(base, attempt);
    if (!(await slugExists(db, candidate, exceptVendorId))) {
      return candidate;
    }
  }

  throw conflict('That business name is already taken. Try a different one.');
}

/**
 * `Promise.all` with a deterministic failure: every input is awaited, and the
 * **first one in argument order** that rejected is what throws.
 *
 * `Promise.all` reports whichever rejected soonest, which for independent
 * database reads is a race. The checks these callers run refuse for different
 * reasons and with different statuses, so the vendor would be told to fix
 * whichever field the database happened to answer about first — and could be
 * told something different on an identical retry (#405).
 */
async function firstRejection<T extends readonly unknown[]>(
  work: readonly [...{ [K in keyof T]: T[K] | Promise<T[K]> }],
): Promise<T> {
  const settled = await Promise.allSettled(work);

  for (const outcome of settled) {
    if (outcome.status === 'rejected') {
      throw outcome.reason;
    }
  }

  return settled.map(
    (outcome) => (outcome as PromiseFulfilledResult<unknown>).value,
  ) as unknown as T;
}

/** Rejects category ids that do not exist or are no longer selectable. */
async function assertCategoriesSelectable(
  db: AppDatabase,
  categoryIds: readonly string[],
): Promise<string[]> {
  const unique = [...new Set(categoryIds)];
  const found = await findActiveCategoryIds(db, unique);

  if (found.length !== unique.length) {
    /*
     * `field` is what lets the storefront editor put this on the category
     * picker instead of a toast: matching the prose to a control is not
     * something a client should have to do. `40-states.md` also requires the
     * message to say how to fix it, and the only fix for an id the vendor
     * cannot see is to re-read the list.
     */
    throw validationFailed(
      'One or more selected categories are unavailable. Reload the page and choose from the current list.',
      { field: 'categoryIds' } satisfies FieldErrorDetails,
    );
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
  assertOwnedImageRefs([input.profileImageUrl, input.coverImageUrl], userId);

  const existing = await findVendorProfileByUserId(db, userId);
  if (existing) {
    throw conflict('You already have a vendor profile');
  }

  /*
   * Every check the write depends on, resolved **before** the write and
   * concurrently with each other. Before, never after: a refused tag list must
   * not leave a profile row behind that the vendor's next attempt then 409s on
   * (#405). Concurrently because they ask three unrelated questions of three
   * tables, and awaiting them in a row spends three round trips to learn what
   * one buys.
   *
   * `firstRejection` rather than `Promise.all` so the *answer* stays in
   * declaration order even though the queries do not. These three do not fail
   * alike — the slug throws a 409 and the other two a 400 naming their own
   * control — and letting whichever query returned first decide would make a
   * body that is wrong in two ways answer differently between identical runs.
   */
  const [categoryIds, tags, slug] = await firstRejection([
    assertCategoriesSelectable(db, input.categoryIds),
    input.tagIds === undefined ? undefined : resolveVendorTagSelection(db, input.tagIds),
    resolveSlug(db, input.slug ?? input.businessName),
  ] as const);

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

  const row = await db.transaction(async (tx) => {
    const inserted = await insertVendorProfile(tx, values);
    await replaceVendorCategories(tx, inserted.id, categoryIds);
    if (tags !== undefined) {
      await replaceVendorTags(tx, inserted.id, tags.tagIds);
    }

    return inserted;
  });

  return loadDetail(db, row);
}

/**
 * Applies a profile edit. Only the fields present in the request are touched,
 * so a form that submits one section cannot blank out another. Publishing is
 * refused while any prerequisite is outstanding.
 */
export async function updateVendorProfile(
  db: AppDatabase,
  storage: ObjectStorage,
  userId: string,
  input: UpdateVendorProfileInput,
  log?: { warn: (details: unknown, message: string) => void },
): Promise<VendorProfileDetail> {
  assertOwnedImageRefs([input.profileImageUrl, input.coverImageUrl], userId);

  const existing = await findVendorProfileByUserId(db, userId);
  if (!existing) {
    throw notFound('You have not created a vendor profile yet');
  }

  /*
   * `moderationHold` is excluded from the patch **type**, not merely left out of
   * it (#457). The DAO takes a general `Partial<NewVendorProfileRow>` because
   * the console's own writer legitimately sets that column, so nothing below the
   * service can tell a vendor's save from an operator's — which left "no
   * vendor-facing write may touch it" resting on whoever edits this function
   * next remembering the rule. Now `patch.moderationHold = …` does not compile
   * here, and the compiler is the one reader that never forgets.
   */
  const patch: Omit<Partial<NewVendorProfileRow>, 'moderationHold'> = {};

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

  // Resolved before anything is written, and concurrently — see
  // `createVendorProfile`.
  const [categoryIds, tags] = await firstRejection([
    input.categoryIds === undefined ? undefined : assertCategoriesSelectable(db, input.categoryIds),
    input.tagIds === undefined ? undefined : resolveVendorTagSelection(db, input.tagIds),
  ] as const);

  if (input.isPublished !== undefined) {
    if (input.isPublished) {
      /*
       * Checked before the blockers, because it is not one (#457). A blocker is
       * a list of things the vendor can go and finish; this is a refusal they
       * cannot clear at all, and reporting it as a fourth incomplete field
       * would send them round the editor looking for it.
       */
      if (existing.moderationHold) {
        throw forbidden(VENDOR_PROFILE_MODERATION_HOLD_MESSAGE);
      }
      // The hold can still land between here and the write; see the transaction.

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

  /*
   * One transaction over all three writes, so a failure part-way through takes
   * the whole save with it rather than leaving the row edited and its
   * selections not (#405).
   */
  const row = await db.transaction(async (tx) => {
    if (categoryIds !== undefined) {
      await replaceVendorCategories(tx, existing.id, categoryIds);
    }
    if (tags !== undefined) {
      await replaceVendorTags(tx, existing.id, tags.tagIds);
    }

    if (Object.keys(patch).length === 0) {
      return existing;
    }

    /*
     * The hold is re-checked **in the statement that publishes** (#457).
     *
     * `existing` was read before `resolveSlug`, the category and tag
     * resolution and two counts, and nothing here locks the row — so the guard
     * above is a fast refusal, not the guarantee. An operator's takedown
     * committing inside that window would otherwise be overwritten by a publish
     * that had already passed the check, leaving `is_published = true` beside
     * `moderation_hold = true`: on search, `Held` in the console, and the
     * operator's own republish answering 409 with no lever left but a ban.
     */
    const updated = await updateVendorProfileById(tx, existing.id, patch, {
      requireUnheld: patch.isPublished === true,
    });

    if (!updated && patch.isPublished === true) {
      /*
       * Re-read to say which of the two things happened, rather than reporting
       * a hold as a missing profile or the reverse. Only on this path, so the
       * ordinary save still costs one statement.
       */
      const current = await findVendorProfileByUserId(tx, userId);

      if (current?.moderationHold) {
        throw forbidden(VENDOR_PROFILE_MODERATION_HOLD_MESSAGE);
      }
    }

    return updated;
  });

  if (!row) {
    throw notFound('You have not created a vendor profile yet');
  }

  /*
   * The images the vendor just replaced. Reaped after the row commits and
   * never on the way to it: the profile has already changed, and failing this
   * request because the bucket blinked would undo a save the vendor watched
   * succeed. Without it, every photo change left two objects — the WebP and its
   * thumbnail — in the bucket for the life of the account.
   */
  await reapObjects(
    db,
    storage,
    userId,
    [
      ...withThumbnail(replacedKey(existing.profileImageUrl, row.profileImageUrl)),
      /*
       * The cover is a designation on an existing portfolio tile, not an
       * upload of its own — `syncCoverFromPortfolio` copies a tile's key here.
       * `reapObjects` refuses to remove a key another row still references, so
       * passing it is safe; it only ever reaps a cover that was genuinely
       * uploaded as one and is now referenced by nothing.
       */
      ...withThumbnail(replacedKey(existing.coverImageUrl, row.coverImageUrl)),
    ],
    log,
  );

  return loadDetail(db, row);
}

/** The old key, when a write actually replaced it with a different one. */
function replacedKey(before: string | null, after: string | null): string | null {
  return before !== null && before !== after ? before : null;
}

/**
 * A replaced key and the thumbnail written beside it.
 *
 * `vendor_profiles` has no thumbnail column, so the sibling every upload
 * creates is referenced by nothing on this table and was previously orphaned by
 * every single profile-photo change. Deriving it is safe because `reapObjects`
 * puts it through the same ownership and reference checks as the key itself —
 * and a cover copied from a portfolio tile has its sibling in that tile's
 * `thumbnail_url`, which is precisely the reference check that saves it.
 */
function withThumbnail(key: string | null): string[] {
  return key === null ? [] : [key, thumbnailKeyFor(key)];
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
  now: Date,
): Promise<VendorSearchResult> {
  const [page, facets] = await Promise.all([
    searchVendors(db, query, now),
    categoryFacets(db, query),
  ]);

  return vendorSearchResultSchema.parse({
    items: page.items,
    total: page.total,
    page: query.page,
    pageSize: query.pageSize,
    facets: { categories: facets },
  });
}
