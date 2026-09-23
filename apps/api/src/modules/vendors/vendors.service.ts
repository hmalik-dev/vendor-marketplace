import {
  VENDOR_PROFILE_MODERATION_HOLD_MESSAGE,
  MAX_SLUG_LENGTH,
  RESERVED_VENDOR_SLUGS,
  generateSlug,
  isVendorApplicationComplete,
  uuidSchema,
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
import type {
  NewVendorProfileRow,
  TagRow,
  VendorApplicationRow,
  VendorProfileRow,
} from '@vendor-marketplace/db/schema';
import type { NeonAuthDirectory } from '@vendor-marketplace/db';
import type { AppDatabase } from '../../lib/database.js';
import { findApplicationForDraftProfile } from '../vendor-invites/vendor-invites.dao.js';
import { categoryFacets, searchVendors } from './vendor-search.dao.js';
import { violatesUniqueConstraint } from '../../lib/constraint-violation.js';
import {
  accountSuspended,
  conflict,
  forbidden,
  notFound,
  validationFailed,
} from '../../lib/errors.js';
import {
  assertOwnedImageRefs,
  assertStorageOriginRefs,
  storedImageRef,
  thumbnailKeyFor,
  type ObjectStorage,
} from '../../lib/storage.js';
import { reapObjects } from '../portfolio/portfolio.service.js';
import { replaceVendorTags } from '../tags/tags.dao.js';
import { resolveVendorTagSelection } from '../tags/tags.service.js';
import { lockVendorProfile } from '../admin/admin.dao.js';
import { countActivePackages } from '../packages/packages.dao.js';
import { findUserById, updateUserById } from '../users/users.dao.js';
import { syncAuthDisplayName } from '../users/users.service.js';
import { holdsCurrentAgreement } from './legal-agreement.service.js';
import {
  findActiveCategoryIds,
  findVendorCategoryIds,
  findVendorProfileById,
  findVendorProfileByUserId,
  findVendorTags,
  insertVendorProfile,
  lockVendorProfileAtVersion,
  recordSlugChange,
  replaceVendorCategories,
  slugExists,
  touchVendorProfile,
  updateVendorProfileById,
} from './vendors.dao.js';

const SUSPENDED_ACCOUNT_MESSAGE = 'This account has been suspended';

const PROFILE_CHANGED_MESSAGE =
  'Your profile changed since you opened it. Review the current values, then save again.';

/** Thrown inside the edit transaction so it rolls back; turned into the 409 outside it. */
class StaleProfileEdit extends Error {}

const PROFILE_USER_UNIQUE = 'vendor_profiles_user_id_key';
const PROFILE_SLUG_UNIQUE = 'vendor_profiles_slug_key';

/**
 * A lost race on either unique index — the slug, or one profile per user — is
 * the caller's conflict to resolve, not a server fault. Anything else is left
 * for the caller to rethrow untouched.
 */
function asProfileConflict(error: unknown): ReturnType<typeof conflict> | null {
  if (violatesUniqueConstraint(error, PROFILE_USER_UNIQUE)) {
    return conflict('You already have a vendor profile');
  }
  if (violatesUniqueConstraint(error, PROFILE_SLUG_UNIQUE)) {
    return conflict('That web address was just taken. Choose another.');
  }

  return null;
}

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
  holdsAgreement: boolean,
  hasPersonalName: boolean,
): VendorProfileDetail {
  return {
    ...row,
    latitude: parseDecimal(row.latitude),
    longitude: parseDecimal(row.longitude),
    avgRating: parseRating(row.avgRating),
    categoryIds,
    tags: tagRows satisfies Tag[],
    publishBlockers: publishBlockers(
      row,
      categoryIds,
      activePackageCount,
      holdsAgreement,
      hasPersonalName,
    ),
  };
}

/** What a vendor calls each blocker, for the refusal of an edit to a live storefront. */
const LIVE_EDIT_FIELD_LABELS: Record<PublishBlockerKey, string> = {
  businessName: 'the business name',
  location: 'the location',
  categories: 'the categories',
  bio: 'the bio',
  personalName: 'your name',
  responseTime: 'the reply window',
  packages: 'the packages',
  agreement: 'the agreement',
};

/**
 * Everything still standing between this profile and a public listing. Returned
 * rather than thrown so the dashboard can show the list before the vendor tries
 * to publish.
 */
export function publishBlockers(
  row: VendorProfileRow,
  categoryIds: readonly string[],
  activePackageCount: number,
  holdsAgreement: boolean,
  hasPersonalName: boolean,
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
   * `users.firstName`/`lastName`, not a `vendor_profiles` column (VEN-642):
   * the same personal-name gap the customer interstitial closes, applied to
   * vendors so neither role can publish or book forever under the synthetic
   * sign-up placeholder.
   */
  if (!hasPersonalName) {
    blockers.push('personalName');
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
  // The same definition of "accepted" the connect and payment gates use (VEN-509).
  if (!holdsAgreement) {
    blockers.push('agreement');
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

function isReservedVendorSlug(slug: string): boolean {
  return (RESERVED_VENDOR_SLUGS as readonly string[]).includes(slug);
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
    // A static route under `/vendors/` answers a reserved slug first (VEN-406).
    if (isReservedVendorSlug(candidate)) {
      continue;
    }
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

/**
 * Rejects category ids that do not exist or are no longer selectable.
 *
 * `heldIds` are the categories the vendor is already listed under. One an
 * operator has since deactivated stays acceptable (VEN-401): the editor cannot
 * draw a hidden category, so it sends the id back untouched on every save, and
 * refusing it would lock the vendor out of their own storefront.
 */
async function assertCategoriesSelectable(
  db: AppDatabase,
  categoryIds: readonly string[],
  heldIds: readonly string[] = [],
): Promise<string[]> {
  const unique = [...new Set(categoryIds)];
  const found = new Set(await findActiveCategoryIds(db, unique));
  const held = new Set(heldIds);

  if (unique.some((id) => !found.has(id) && !held.has(id))) {
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

/** What a personal-name write needs to also reach the Neon Auth identity (VEN-642). */
export interface AuthNameSync {
  authUserId: string;
  directory: NeonAuthDirectory | null;
  log?: { warn: (details: unknown, message: string) => void };
}

/** Whether both halves of a personal name are actually there, not just present as a key. */
export function isCompleteName(
  firstName: string | undefined,
  lastName: string | undefined,
): boolean {
  return Boolean(firstName?.trim()) && Boolean(lastName?.trim());
}

async function loadDetail(db: AppDatabase, row: VendorProfileRow): Promise<VendorProfileDetail> {
  const [categoryIds, tagRows, activePackageCount, holdsAgreement, owner] = await Promise.all([
    findVendorCategoryIds(db, row.id),
    findVendorTags(db, row.id),
    countActivePackages(db, row.id),
    holdsCurrentAgreement(db, row.userId),
    findUserById(db, row.userId),
  ]);

  return toVendorProfileDetail(
    row,
    categoryIds,
    tagRows,
    activePackageCount,
    holdsAgreement,
    isCompleteName(owner?.firstName, owner?.lastName),
  );
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
  /*
   * Re-read rather than trusting the caller's row: it was fetched before the
   * caller's own write, and a publish that committed in between would leave a
   * stale `isPublished: false` here and skip the unpublish.
   */
  const current = await findVendorProfileById(db, vendor.id);
  if (!current?.isPublished) {
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
  publicBaseUrl: string,
  authSync?: AuthNameSync,
): Promise<VendorProfileDetail> {
  assertOwnedImageRefs([input.profileImageUrl, input.coverImageUrl], userId);
  assertStorageOriginRefs([input.profileImageUrl, input.coverImageUrl], publicBaseUrl);

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
    profileImageUrl: storedImageRef(input.profileImageUrl ?? null, publicBaseUrl),
    coverImageUrl: storedImageRef(input.coverImageUrl ?? null, publicBaseUrl),
  };

  const row = await db
    .transaction(async (tx) => {
      const inserted = await insertVendorProfile(tx, values);
      await replaceVendorCategories(tx, inserted.id, categoryIds);
      if (tags !== undefined) {
        await replaceVendorTags(tx, inserted.id, tags.tagIds);
      }
      // Personal name onto `users`, not `vendor_profiles` (VEN-642) — optional,
      // like `bio`: a vendor may not have supplied it on this save.
      if (input.firstName !== undefined && input.lastName !== undefined) {
        await updateUserById(tx, userId, { firstName: input.firstName, lastName: input.lastName });
      }

      return inserted;
    })
    .catch((error: unknown) => {
      throw asProfileConflict(error) ?? error;
    });

  // Outside the transaction: a network call to Neon Auth, not a database write.
  if (authSync && input.firstName !== undefined && input.lastName !== undefined) {
    await syncAuthDisplayName(
      authSync.directory,
      authSync.authUserId,
      input.firstName,
      input.lastName,
      authSync.log,
    );
  }

  return loadDetail(db, row);
}

/**
 * Narrows a draft application to one that can actually build a profile:
 * {@link isVendorApplicationComplete}'s three fields present, and `category` a
 * category id rather than the free text a pre-VEN-512 row can still carry —
 * that shape predates the real category picker and was never eligible.
 */
function isDraftableApplication(
  application: Pick<VendorApplicationRow, 'businessName' | 'category' | 'city' | 'state'>,
): application is {
  businessName: string;
  category: string;
  city: string;
  state: VendorApplicationRow['state'];
} {
  return (
    isVendorApplicationComplete(application) && uuidSchema.safeParse(application.category).success
  );
}

/**
 * The draft profile a vendor's first terms acceptance builds from their
 * waitlist application (VEN-514), in the caller's transaction, so they land in
 * the editor with the business name, category and city they already gave
 * rather than retyping them. Unpublished; the vendor publishes it.
 *
 * **Silent on anything that cannot build one**: no application, an incomplete
 * one, a legacy free-text category, or a category since deactivated all leave
 * no profile and change nothing else — the vendor creates it by hand as today.
 * A failure inside the write itself (a slug race, an unexpected constraint) is
 * caught here rather than left to `tx`'s caller: it runs inside the same
 * transaction that creates the account, and this build must never be why that
 * account does not exist. The write itself runs in a savepoint (`tx.transaction`
 * nested), so a caught failure rolls back only the draft, not the account or
 * its acceptance.
 */
export async function createDraftVendorProfile(
  tx: AppDatabase,
  userId: string,
  email: string,
  log?: { warn: (details: unknown, message: string) => void },
): Promise<void> {
  if (await findVendorProfileByUserId(tx, userId)) {
    return;
  }

  const application = await findApplicationForDraftProfile(tx, email);

  if (!application || !isDraftableApplication(application)) {
    return;
  }

  try {
    // Shadows the outer `tx`: `replace-in-transaction-guard.test.ts` requires
    // every wholesale-replace writer's caller to be named `tx`, and this one
    // genuinely is one — the savepoint, not the outer transaction.
    await tx.transaction(async (tx) => {
      const categoryIds = await findActiveCategoryIds(tx, [application.category]);

      if (categoryIds.length === 0) {
        // The category the applicant chose was later deactivated or removed.
        return;
      }

      const slug = await resolveSlug(tx, application.businessName);
      const inserted = await insertVendorProfile(tx, {
        userId,
        businessName: application.businessName,
        slug,
        city: application.city,
        state: application.state,
        bio: null,
        tagline: null,
        yearsInBusiness: null,
        address: null,
        latitude: null,
        longitude: null,
        serviceRadiusKm: null,
        responseTimeHours: null,
        profileImageUrl: null,
        coverImageUrl: null,
      });

      await replaceVendorCategories(tx, inserted.id, categoryIds);
    });
  } catch (error) {
    log?.warn(
      { err: error, userId },
      'Could not build a draft vendor profile from the application',
    );
  }
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
  publicBaseUrl: string,
  log?: { warn: (details: unknown, message: string) => void },
  authSync?: AuthNameSync,
): Promise<VendorProfileDetail> {
  assertOwnedImageRefs([input.profileImageUrl, input.coverImageUrl], userId);
  assertStorageOriginRefs([input.profileImageUrl, input.coverImageUrl], publicBaseUrl);

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
    patch.profileImageUrl = keepStoredKey(
      existing.profileImageUrl,
      storedImageRef(input.profileImageUrl, publicBaseUrl),
    );
  }
  if (input.coverImageUrl !== undefined) {
    patch.coverImageUrl = keepStoredKey(
      existing.coverImageUrl,
      storedImageRef(input.coverImageUrl, publicBaseUrl),
    );
  }

  // Resolved before anything is written, and concurrently — see
  // `createVendorProfile`.
  const requestedCategoryIds = input.categoryIds;
  const [categoryIds, tags] = await firstRejection([
    requestedCategoryIds === undefined
      ? undefined
      : findVendorCategoryIds(db, existing.id).then((held) =>
          assertCategoriesSelectable(db, requestedCategoryIds, held),
        ),
    input.tagIds === undefined
      ? undefined
      : findVendorTags(db, existing.id).then((held) =>
          resolveVendorTagSelection(
            db,
            input.tagIds ?? [],
            held.map((tag) => tag.id),
          ),
        ),
  ] as const);

  const publishing = input.isPublished === true;

  if (publishing && existing.moderationHold) {
    /*
     * Checked before the blockers, because it is not one (#457). A blocker is
     * a list of things the vendor can go and finish; this is a refusal they
     * cannot clear at all, and reporting it as a fourth incomplete field
     * would send them round the editor looking for it.
     */
    throw forbidden(VENDOR_PROFILE_MODERATION_HOLD_MESSAGE);
  }
  // The hold can still land between here and the write; see the transaction.

  /*
   * A live storefront is held to the publish bar on every save (VEN-557), so a
   * vendor cannot blank the bio or the reply window and stay public and
   * searchable. An edit to a profile that stays live is refused only for a
   * blocker the stored profile did not already carry: a lapsed agreement or a
   * switched-off package is not this edit's doing and must not lock the vendor
   * out of fixing the rest.
   */
  const editingLive = existing.isPublished && input.isPublished !== false;
  // As this write will leave it — this request's own firstName/lastName when
  // it sends them, the same way `{ ...existing, ...patch }` reflects this
  // write's vendor_profiles columns below.
  let hasPersonalName = false;

  if (publishing || editingLive) {
    const [heldCategories, activePackageCount, holdsAgreement, owner] = await Promise.all([
      findVendorCategoryIds(db, existing.id),
      countActivePackages(db, existing.id),
      holdsCurrentAgreement(db, existing.userId),
      findUserById(db, existing.userId),
    ]);
    hasPersonalName = isCompleteName(
      input.firstName ?? owner?.firstName,
      input.lastName ?? owner?.lastName,
    );
    const blockers = publishBlockers(
      { ...existing, ...patch } as VendorProfileRow,
      categoryIds ?? heldCategories,
      activePackageCount,
      holdsAgreement,
      hasPersonalName,
    );
    const alreadyBlocked = publishing
      ? []
      : publishBlockers(
          existing,
          heldCategories,
          activePackageCount,
          holdsAgreement,
          isCompleteName(owner?.firstName, owner?.lastName),
        );
    const introduced = blockers.filter((key) => !alreadyBlocked.includes(key));

    if (introduced.length > 0) {
      throw validationFailed(
        publishing
          ? 'Complete your profile before publishing it.'
          : `Your storefront is live, so ${introduced.map((key) => LIVE_EDIT_FIELD_LABELS[key]).join(' and ')} cannot be left empty.`,
        { blockers: introduced },
      );
    }
  }

  if (input.isPublished !== undefined) {
    patch.isPublished = input.isPublished;
  }

  /*
   * One transaction over all three writes, so a failure part-way through takes
   * the whole save with it rather than leaving the row edited and its
   * selections not (#405).
   */
  const row = await db
    .transaction(async (tx) => {
      if (categoryIds !== undefined) {
        await replaceVendorCategories(tx, existing.id, categoryIds);
      }
      if (tags !== undefined) {
        await replaceVendorTags(tx, existing.id, tags.tagIds);
      }
      if (input.firstName !== undefined && input.lastName !== undefined) {
        // `users`, not `vendor_profiles` (VEN-642) — inside the same write so
        // the vendor's one Save is still one transaction (#405).
        await updateUserById(tx, existing.userId, {
          firstName: input.firstName,
          lastName: input.lastName,
        });
      }

      /*
       * After the child writes, for the lock order the publish path below gives.
       * A stale save is rolled back whole, categories and tags included.
       */
      if (
        input.updatedAt &&
        !(await lockVendorProfileAtVersion(tx, existing.id, input.updatedAt))
      ) {
        throw new StaleProfileEdit();
      }

      if (Object.keys(patch).length === 0) {
        return input.updatedAt ? touchVendorProfile(tx, existing.id) : existing;
      }

      if (patch.isPublished === true) {
        /*
         * Taken after the category and tag writes, so every save touches the child
         * rows before the profile row and two saves cannot deadlock on the order.
         * Serialises with a package deactivation, which takes the same lock before
         * it counts. The count that gated this publish was taken before the
         * transaction, so it is only a fast refusal: a last package switched off
         * since would otherwise go live with nothing bookable.
         */
        await lockVendorProfile(tx, existing.id);
        const lockedPackageCount = await countActivePackages(tx, existing.id);
        // Re-read here too: the acceptance the pre-check saw can be gone by now (VEN-509).
        const lockedHoldsAgreement = await holdsCurrentAgreement(tx, existing.userId);

        if (lockedPackageCount === 0 || !lockedHoldsAgreement) {
          throw validationFailed('Complete your profile before publishing it.', {
            blockers: publishBlockers(
              { ...existing, ...patch } as VendorProfileRow,
              categoryIds ?? (await findVendorCategoryIds(tx, existing.id)),
              lockedPackageCount,
              lockedHoldsAgreement,
              hasPersonalName,
            ),
          });
        }
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
      if (patch.slug !== undefined && patch.slug !== existing.slug) {
        await recordSlugChange(tx, existing.id, existing.slug, patch.slug);
      }

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

        // Neither a hold nor a missing profile: the owner was suspended meanwhile.
        if (current) {
          throw accountSuspended(SUSPENDED_ACCOUNT_MESSAGE);
        }
      }

      return updated;
    })
    .catch(async (error: unknown) => {
      if (error instanceof StaleProfileEdit) {
        const current = await findVendorProfileByUserId(db, userId);
        throw conflict(
          PROFILE_CHANGED_MESSAGE,
          current ? { current: await loadDetail(db, current) } : undefined,
        );
      }

      throw asProfileConflict(error) ?? error;
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
       * The cover may name a key a portfolio tile also holds.
       * `reapObjects` refuses to remove a key another row still references, so
       * passing it is safe; it only ever reaps a cover that was genuinely
       * uploaded as one and is now referenced by nothing.
       */
      ...withThumbnail(replacedKey(existing.coverImageUrl, row.coverImageUrl)),
    ],
    log,
  );

  // Outside the transaction: a network call to Neon Auth, not a database write.
  if (authSync && input.firstName !== undefined && input.lastName !== undefined) {
    await syncAuthDisplayName(
      authSync.directory,
      authSync.authUserId,
      input.firstName,
      input.lastName,
      authSync.log,
    );
  }

  return loadDetail(db, row);
}

/**
 * The editor holds each image as the resolved URL the API served and sends it
 * back on every save, so an untouched cover arrives as `<base>/<stored key>`.
 * Storing that would swap the key for a URL and read as a replacement, and the
 * reap would then delete the object the URL still points at. A submitted value
 * that is the stored key behind a base URL is the same image: keep the key.
 */
function keepStoredKey(stored: string | null, submitted: string | null): string | null {
  return stored !== null && submitted !== null && submitted.endsWith(`/${stored}`)
    ? stored
    : submitted;
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
