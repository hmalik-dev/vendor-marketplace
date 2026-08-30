import { and, asc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import {
  categories,
  tags,
  vendorCategories,
  vendorProfiles,
  vendorTags,
  type NewVendorProfileRow,
  type TagRow,
  type VendorProfileRow,
} from '@vendor-marketplace/db/schema';
import type { AppDatabase } from '../../lib/database.js';
import type { ScopedTagRow } from '../tags/tags.dao.js';

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
 */
export async function slugExists(
  db: AppDatabase,
  slug: string,
  exceptVendorId?: string,
): Promise<boolean> {
  if (!slug) {
    return false;
  }

  const rows = await db
    .select({ id: vendorProfiles.id })
    .from(vendorProfiles)
    .where(eq(vendorProfiles.slug, slug))
    .limit(2);

  return rows.some((row) => row.id !== exceptVendorId);
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
): Promise<VendorProfileRow | null> {
  if (!id || Object.keys(patch).length === 0) {
    return null;
  }

  const updated = await db
    .update(vendorProfiles)
    .set({ ...patch, updatedAt: sql`now()` })
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
 * Replaces the vendor's category selection wholesale. Delete and insert run in
 * one transaction so a failed insert cannot leave the vendor with no
 * categories at all.
 */
export async function replaceVendorCategories(
  db: AppDatabase,
  vendorId: string,
  categoryIds: readonly string[],
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.delete(vendorCategories).where(eq(vendorCategories.vendorId, vendorId));

    if (categoryIds.length > 0) {
      await tx
        .insert(vendorCategories)
        .values(categoryIds.map((categoryId) => ({ vendorId, categoryId })));
    }
  });
}

/**
 * A vendor's tags, each carrying the vendor category it is scoped to — which is
 * null for every group but `style`.
 *
 * The scope join is a **left** one and the tag join stays inner: a tag always
 * has a row, a scope does not. `categories` is aliased because this query
 * already reaches it through `vendor_categories` elsewhere in the module, and
 * an unaliased second reference would resolve to the wrong one.
 */
export async function findVendorTags(db: AppDatabase, vendorId: string): Promise<ScopedTagRow[]> {
  if (!vendorId) {
    return [];
  }

  const tagScope = alias(categories, 'tag_scope');

  return db
    .select({
      id: tags.id,
      name: tags.name,
      slug: tags.slug,
      category: tags.category,
      vendorCategoryId: tags.vendorCategoryId,
      displayOrder: tags.displayOrder,
      isActive: tags.isActive,
      createdAt: tags.createdAt,
      vendorCategorySlug: tagScope.slug,
    })
    .from(vendorTags)
    .innerJoin(tags, eq(tags.id, vendorTags.tagId))
    .leftJoin(tagScope, eq(tags.vendorCategoryId, tagScope.id))
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
