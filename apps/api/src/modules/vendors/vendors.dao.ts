import { and, asc, eq, inArray, isNull, sql } from 'drizzle-orm';
import {
  categories,
  tags,
  vendorCategories,
  vendorProfiles,
  vendorSlugAliases,
  vendorTags,
  type NewVendorProfileRow,
  type TagRow,
  type VendorProfileRow,
} from '@vendor-marketplace/db/schema';
import type { AppDatabase } from '../../lib/database.js';
import { updatedAtIs } from '../../lib/edit-version.js';
import { OWNER_NOT_BANNED } from './vendor-visibility.js';

/** A soft-deleted profile is invisible to every read path. */
const live = eq(vendorProfiles.isDeleted, false);

export async function findVendorProfileByUserId(
  db: AppDatabase,
  userId: string,
): Promise<VendorProfileRow | null> {
  if (!userId) {
    return null;
  }

  const rows = await db
    .select()
    .from(vendorProfiles)
    .where(and(eq(vendorProfiles.userId, userId), live))
    .limit(1);

  return rows?.[0] ?? null;
}

/**
 * Slug uniqueness check. Includes soft-deleted rows on purpose: the unique
 * index covers them too, so ignoring them would produce a constraint violation
 * instead of a validation message.
 *
 * A slug another vendor gave up is taken too (VEN-648): its old links still
 * lead to that vendor, and handing it on would send them to a different
 * business. The vendor who gave it up may take it back.
 */
export async function slugExists(
  db: AppDatabase,
  slug: string,
  exceptVendorId?: string,
): Promise<boolean> {
  if (!slug) {
    return false;
  }

  const [current, aliases] = await Promise.all([
    db
      .select({ id: vendorProfiles.id })
      .from(vendorProfiles)
      .where(eq(vendorProfiles.slug, slug))
      .limit(2),
    db
      .select({ id: vendorSlugAliases.vendorId })
      .from(vendorSlugAliases)
      .where(eq(vendorSlugAliases.slug, slug))
      .limit(1),
  ]);

  return [...current, ...aliases].some((row) => row.id !== exceptVendorId);
}

/**
 * Records a slug change so the old address keeps leading to this vendor: the
 * slug given up becomes an alias, and one this vendor is taking back stops
 * being one. Run inside the transaction that writes the new slug.
 */
export async function recordSlugChange(
  db: AppDatabase,
  vendorId: string,
  from: string,
  to: string,
): Promise<void> {
  await db
    .delete(vendorSlugAliases)
    .where(and(eq(vendorSlugAliases.slug, to), eq(vendorSlugAliases.vendorId, vendorId)));
  await db.insert(vendorSlugAliases).values({ slug: from, vendorId }).onConflictDoNothing();
}

export async function insertVendorProfile(
  db: AppDatabase,
  values: NewVendorProfileRow,
): Promise<VendorProfileRow> {
  const inserted = await db.insert(vendorProfiles).values(values).returning();
  const row = inserted?.[0];

  if (!row) {
    throw new Error('Vendor profile insert returned no row');
  }

  return row;
}

export async function updateVendorProfileById(
  db: AppDatabase,
  id: string,
  patch: Partial<NewVendorProfileRow>,
  /**
   * `requireUnheld` puts the moderation hold **in the `WHERE`**, so the write
   * is a compare-and-set rather than a write behind an earlier read (#457).
   *
   * The vendor's editor reads their row, decides, then writes several round
   * trips later, and it takes no lock — so an operator's takedown committing in
   * that window was overwritten by a publish that had already passed the check.
   * The row then carried `is_published = true` with `moderation_hold = true`:
   * back on search, labelled `Held` in the console, and the operator's own
   * republish answering 409. Checking the column in the statement that writes
   * it is what makes that unrepresentable rather than unlikely.
   *
   * It also carries the owner's suspension (VEN-431): a publish that passed the
   * auth hook before a ban committed must not set `is_published` after the
   * ban's unpublish. Same statement, same reason.
   *
   * Off by default because the console's own writer must be able to set
   * `is_published` on a row it is holding.
   */
  options: { requireUnheld?: boolean } = {},
): Promise<VendorProfileRow | null> {
  if (!id || Object.keys(patch).length === 0) {
    return null;
  }

  const updated = await db
    .update(vendorProfiles)
    .set({ ...patch, updatedAt: sql`now()` })
    .where(
      and(
        eq(vendorProfiles.id, id),
        live,
        options.requireUnheld === true
          ? and(eq(vendorProfiles.moderationHold, false), OWNER_NOT_BANNED)
          : undefined,
      ),
    )
    .returning();

  return updated?.[0] ?? null;
}

/**
 * Locks the profile row and says whether it is still at the version a form was
 * opened on (VEN-481). The lock is what makes the answer hold until the
 * transaction ends, so the write that follows cannot land on a row that moved.
 */
export async function lockVendorProfileAtVersion(
  db: AppDatabase,
  id: string,
  expectedUpdatedAt: Date,
): Promise<boolean> {
  const rows = await db
    .select({ id: vendorProfiles.id })
    .from(vendorProfiles)
    .where(
      and(
        eq(vendorProfiles.id, id),
        live,
        updatedAtIs(vendorProfiles.updatedAt, expectedUpdatedAt),
      ),
    )
    .for('no key update')
    .limit(1);

  return rows.length > 0;
}

/**
 * Moves `updated_at` without changing a column, for a versioned save that only
 * replaced the category or tag rows: those live in other tables, and a save that
 * left the version where it was would let a second one from the same version
 * through (VEN-481).
 */
export async function touchVendorProfile(
  db: AppDatabase,
  id: string,
): Promise<VendorProfileRow | null> {
  const updated = await db
    .update(vendorProfiles)
    .set({ updatedAt: sql`now()` })
    .where(and(eq(vendorProfiles.id, id), live))
    .returning();

  return updated?.[0] ?? null;
}

/** Ids of the categories that actually exist and are still selectable. */
export async function findActiveCategoryIds(
  db: AppDatabase,
  categoryIds: readonly string[],
): Promise<string[]> {
  if (categoryIds.length === 0) {
    return [];
  }

  const rows = await db
    .select({ id: categories.id })
    .from(categories)
    .where(and(inArray(categories.id, [...categoryIds]), eq(categories.isActive, true)));

  return rows.map((row) => row.id);
}

export async function findVendorCategoryIds(db: AppDatabase, vendorId: string): Promise<string[]> {
  if (!vendorId) {
    return [];
  }

  const rows = await db
    .select({ categoryId: vendorCategories.categoryId })
    .from(vendorCategories)
    .innerJoin(categories, eq(categories.id, vendorCategories.categoryId))
    .where(eq(vendorCategories.vendorId, vendorId))
    .orderBy(asc(categories.displayOrder));

  return rows.map((row) => row.categoryId);
}

/**
 * Replaces the vendor's category selection wholesale.
 *
 * **Must be called inside a transaction**, which is what makes the delete and
 * the insert one unit — a failed insert would otherwise leave the vendor with
 * none at all. It used to open its own, but every caller now runs inside the
 * profile save's transaction (#405), so that only added a `SAVEPOINT` /
 * `RELEASE` pair per call and held the row locks two round trips longer.
 */
export async function replaceVendorCategories(
  db: AppDatabase,
  vendorId: string,
  categoryIds: readonly string[],
): Promise<void> {
  await db.delete(vendorCategories).where(eq(vendorCategories.vendorId, vendorId));

  if (categoryIds.length > 0) {
    await db
      .insert(vendorCategories)
      .values(categoryIds.map((categoryId) => ({ vendorId, categoryId })));
  }
}

/** A vendor's tags, in the picker's own order: group first, then display order. */
export async function findVendorTags(db: AppDatabase, vendorId: string): Promise<TagRow[]> {
  if (!vendorId) {
    return [];
  }

  return db
    .select({
      id: tags.id,
      name: tags.name,
      slug: tags.slug,
      category: tags.category,
      displayOrder: tags.displayOrder,
      isActive: tags.isActive,
      createdAt: tags.createdAt,
    })
    .from(vendorTags)
    .innerJoin(tags, eq(tags.id, vendorTags.tagId))
    .where(eq(vendorTags.vendorId, vendorId))
    .orderBy(asc(tags.category), asc(tags.displayOrder));
}

/**
 * Claims a Stripe connected account for a vendor, but **only if they do not
 * already have one**. Returns the row as it stands afterwards, so the caller
 * can tell whether it won.
 *
 * Conditional rather than a plain `SET`, because the read-then-write it
 * replaces is a race a vendor can lose real money to: two tabs pressing "Set up
 * payouts" inside one Stripe round trip both see `null`, both create an
 * account, and the second write wins. The vendor then completes onboarding
 * against the account the row no longer names, every webhook for it finds no
 * vendor, and they stay blocked at the payment gate forever with nothing in the
 * logs to say why.
 */
export async function claimStripeAccountId(
  db: AppDatabase,
  vendorId: string,
  stripeAccountId: string,
): Promise<VendorProfileRow | null> {
  if (!vendorId || !stripeAccountId) {
    return null;
  }

  const claimed = await db
    .update(vendorProfiles)
    .set({ stripeAccountId, updatedAt: sql`now()` })
    .where(and(eq(vendorProfiles.id, vendorId), isNull(vendorProfiles.stripeAccountId), live))
    .returning();

  // No row means another request claimed it first; read back the winner.
  return claimed?.[0] ?? (await findVendorProfileById(db, vendorId));
}

/**
 * Records that Stripe refused the account creation made at `observed` refusals
 * (VEN-526). A compare-and-set, like `recordRefundRefusal`: two presses refused
 * under the same key both pass the same `observed`, and exactly one increment
 * lands, so the key moves once and a late caller cannot move it out from under
 * one still using it.
 */
export async function recordAccountRefusal(
  db: AppDatabase,
  vendorId: string,
  observed: number,
): Promise<void> {
  await db
    .update(vendorProfiles)
    .set({ stripeAccountAttempts: observed + 1 })
    .where(
      and(eq(vendorProfiles.id, vendorId), eq(vendorProfiles.stripeAccountAttempts, observed)),
    );
}

/** A vendor profile by its own id, used to re-read after a lost claim. */
export async function findVendorProfileById(
  db: AppDatabase,
  id: string,
): Promise<VendorProfileRow | null> {
  if (!id) {
    return null;
  }

  const rows = await db
    .select()
    .from(vendorProfiles)
    .where(and(eq(vendorProfiles.id, id), live))
    .limit(1);

  return rows?.[0] ?? null;
}

/**
 * The webhook's only way back to a vendor: a Stripe notification names the
 * connected account, never the Orla row. Soft-deleted profiles are excluded
 * like everywhere else, so a closed account's late events land on nothing
 * rather than resurrecting a deleted vendor.
 */
export async function findVendorProfileByStripeAccountId(
  db: AppDatabase,
  stripeAccountId: string,
): Promise<VendorProfileRow | null> {
  if (!stripeAccountId) {
    return null;
  }

  const rows = await db
    .select()
    .from(vendorProfiles)
    .where(and(eq(vendorProfiles.stripeAccountId, stripeAccountId), live))
    .limit(1);

  return rows?.[0] ?? null;
}

/**
 * Writes a Stripe status derived from `seen`, only if the row still says what
 * `seen` said — a compare-and-set on the three columns the webhook owns.
 *
 * The handler reads the row, reads Stripe, and writes several round trips
 * later with no lock, and Stripe does not order its events. Without the
 * predicate a handler whose Stripe read was older but whose write landed last
 * put the older answer over the newer one. `null` means the row moved: the
 * caller re-reads rather than writing.
 */
export async function updateVendorStripeStatusIfUnchanged(
  db: AppDatabase,
  seen: VendorProfileRow,
  patch: Pick<
    NewVendorProfileRow,
    'stripeOnboarded' | 'stripeDisabledReason' | 'stripeRequirementsDue'
  >,
): Promise<VendorProfileRow | null> {
  const updated = await db
    .update(vendorProfiles)
    .set({ ...patch, updatedAt: sql`now()` })
    .where(
      and(
        eq(vendorProfiles.id, seen.id),
        live,
        eq(vendorProfiles.stripeOnboarded, seen.stripeOnboarded),
        sql`${vendorProfiles.stripeDisabledReason} IS NOT DISTINCT FROM ${seen.stripeDisabledReason}`,
        sql`${vendorProfiles.stripeRequirementsDue} = ${JSON.stringify(seen.stripeRequirementsDue)}::jsonb`,
      ),
    )
    .returning();

  return updated?.[0] ?? null;
}
