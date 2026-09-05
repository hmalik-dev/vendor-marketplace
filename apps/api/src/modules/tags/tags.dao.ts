import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import {
  tagSuggestions,
  tags,
  vendorTags,
  type NewTagSuggestionRow,
  type TagRow,
  type TagSuggestionRow,
} from '@vendor-marketplace/db/schema';
import type { TagCategory } from '@vendor-marketplace/shared';
import type { AppDatabase } from '../../lib/database.js';

export async function findActiveTags(db: AppDatabase): Promise<TagRow[]> {
  return db
    .select()
    .from(tags)
    .where(eq(tags.isActive, true))
    .orderBy(asc(tags.category), asc(tags.displayOrder), asc(tags.name));
}

/** Only active tags resolve — a deactivated tag must not become selectable. */
export async function findActiveTagsByIds(
  db: AppDatabase,
  tagIds: readonly string[],
): Promise<TagRow[]> {
  if (tagIds.length === 0) {
    return [];
  }

  return db
    .select()
    .from(tags)
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
): Promise<TagRow | null> {
  if (!normalizedName) {
    return null;
  }

  const rows = await db
    .select()
    .from(tags)
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

/**
 * Files a suggestion, or `null` when an identical pending one already exists.
 *
 * `null` rather than a throw, because losing this race is not an error: it
 * means somebody asked for the same tag a moment earlier, and the caller's
 * answer is the `already_suggested` it would have given had its own read seen
 * the row. `tag_suggestions_pending_key` is what decides, so the read above the
 * caller is a courtesy — it produces a friendlier path in the common case and
 * is not what keeps the queue clean (#399).
 *
 * `onConflictDoNothing` carries no target: the index is a partial one over an
 * expression (`lower(suggested_name)` where the row is pending), which cannot
 * be named as a column list. That is safe **for every caller that exists**,
 * which all let the id default to a generated uuid — but the untargeted form
 * absorbs a primary-key collision too, so a future seed or backfill that
 * supplies its own `id` would read an id clash as `already_suggested`. It does
 * not absorb a foreign-key violation: a bad `vendor_id` or `resolved_tag_id`
 * still raises.
 */
export async function insertTagSuggestion(
  db: AppDatabase,
  values: NewTagSuggestionRow,
): Promise<TagSuggestionRow | null> {
  const inserted = await db.insert(tagSuggestions).values(values).onConflictDoNothing().returning();

  return inserted?.[0] ?? null;
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
