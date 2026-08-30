import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import {
  categories,
  tagSuggestions,
  tags,
  vendorTags,
  type NewTagSuggestionRow,
  type TagRow,
  type TagSuggestionRow,
} from '@vendor-marketplace/db/schema';
import type { TagCategory } from '@vendor-marketplace/shared';
import type { AppDatabase } from '../../lib/database.js';

/**
 * A tag plus the slug of the vendor category it is scoped to, which is `null`
 * for every group except `style`.
 */
export type ScopedTagRow = TagRow & { vendorCategorySlug: string | null };

/**
 * The one projection every tag read uses, so the scope cannot be present on one
 * surface and missing on another.
 *
 * The join is a **left** one: the three global groups have no scope, and an
 * inner join would drop every language, culture and dietary tag from the
 * picker — a bug that would look like an empty section rather than a bad query.
 */
const SCOPED_TAG_COLUMNS = {
  id: tags.id,
  name: tags.name,
  slug: tags.slug,
  category: tags.category,
  vendorCategoryId: tags.vendorCategoryId,
  displayOrder: tags.displayOrder,
  isActive: tags.isActive,
  createdAt: tags.createdAt,
  vendorCategorySlug: categories.slug,
} as const;

export async function findActiveTags(db: AppDatabase): Promise<ScopedTagRow[]> {
  return db
    .select(SCOPED_TAG_COLUMNS)
    .from(tags)
    .leftJoin(categories, eq(tags.vendorCategoryId, categories.id))
    .where(eq(tags.isActive, true))
    .orderBy(asc(tags.category), asc(tags.displayOrder), asc(tags.name));
}

/** Only active tags resolve — a deactivated tag must not become selectable. */
export async function findActiveTagsByIds(
  db: AppDatabase,
  tagIds: readonly string[],
): Promise<ScopedTagRow[]> {
  if (tagIds.length === 0) {
    return [];
  }

  return db
    .select(SCOPED_TAG_COLUMNS)
    .from(tags)
    .leftJoin(categories, eq(tags.vendorCategoryId, categories.id))
    .where(and(inArray(tags.id, [...tagIds]), eq(tags.isActive, true)));
}

/**
 * Case-insensitive lookup within one category. Names are unique per category,
 * not globally — "Korean" is both a language and a culture.
 */
export async function findActiveTagByCategoryAndName(
  db: AppDatabase,
  category: TagCategory,
  normalizedName: string,
): Promise<ScopedTagRow | null> {
  if (!normalizedName) {
    return null;
  }

  const rows = await db
    .select(SCOPED_TAG_COLUMNS)
    .from(tags)
    .leftJoin(categories, eq(tags.vendorCategoryId, categories.id))
    .where(
      and(
        eq(tags.category, category),
        eq(tags.isActive, true),
        sql`lower(${tags.name}) = ${normalizedName}`,
      ),
    )
    .limit(1);

  return rows?.[0] ?? null;
}

/** An identical suggestion already awaiting admin review, from anyone. */
export async function findPendingSuggestion(
  db: AppDatabase,
  category: TagCategory,
  normalizedName: string,
): Promise<TagSuggestionRow | null> {
  if (!normalizedName) {
    return null;
  }

  const rows = await db
    .select()
    .from(tagSuggestions)
    .where(
      and(
        eq(tagSuggestions.category, category),
        eq(tagSuggestions.status, 'pending'),
        sql`lower(${tagSuggestions.suggestedName}) = ${normalizedName}`,
      ),
    )
    .limit(1);

  return rows?.[0] ?? null;
}

export async function insertTagSuggestion(
  db: AppDatabase,
  values: NewTagSuggestionRow,
): Promise<TagSuggestionRow> {
  const inserted = await db.insert(tagSuggestions).values(values).returning();
  const row = inserted?.[0];

  if (!row) {
    throw new Error('Tag suggestion insert returned no row');
  }

  return row;
}

/**
 * Replaces the vendor's tag selection wholesale, in one transaction so a
 * failed insert cannot leave the vendor with an empty selection.
 */
export async function replaceVendorTags(
  db: AppDatabase,
  vendorId: string,
  tagIds: readonly string[],
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.delete(vendorTags).where(eq(vendorTags.vendorId, vendorId));

    if (tagIds.length > 0) {
      await tx.insert(vendorTags).values(tagIds.map((tagId) => ({ vendorId, tagId })));
    }
  });
}
