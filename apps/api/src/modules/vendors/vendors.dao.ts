import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import {
  categories,
  tags,
  vendorCategories,
  vendorProfiles,
  vendorTags,
  type NewVendorProfileRow,
  type TagRow,
  type VendorProfileRow,
} from '@vendorhub/db/schema';
import type { AppDatabase } from '../../lib/database.js';

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

export async function findVendorTags(db: AppDatabase, vendorId: string): Promise<TagRow[]> {
  if (!vendorId) {
    return [];
  }

  const rows = await db
    .select({ tag: tags })
    .from(vendorTags)
    .innerJoin(tags, eq(tags.id, vendorTags.tagId))
    .where(eq(vendorTags.vendorId, vendorId))
    .orderBy(asc(tags.category), asc(tags.displayOrder));

  return rows.map((row) => row.tag);
}
