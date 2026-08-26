import {
  MAX_TAGS_PER_CATEGORY,
  type CreateTagSuggestionInput,
  type Tag,
  type TagSuggestionResponse,
} from '@vendor-marketplace/shared';
import type { TagRow } from '@vendor-marketplace/db/schema';
import type { AppDatabase } from '../../lib/database.js';
import { notFound, validationFailed } from '../../lib/errors.js';
import { findVendorProfileByUserId } from '../vendors/vendors.dao.js';
import {
  findActiveTagByCategoryAndName,
  findActiveTags,
  findActiveTagsByIds,
  findPendingSuggestion,
  insertTagSuggestion,
  replaceVendorTags,
} from './tags.dao.js';

/**
 * The comparison key for tag dedup: surrounding whitespace removed, internal
 * runs collapsed, lowercased. "  halal " and "Halal" have to collide, or the
 * tag list stops being a reliable search filter.
 */
export function normalizeTagName(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

export async function listActiveTags(db: AppDatabase): Promise<Tag[]> {
  return findActiveTags(db);
}

/**
 * Applies a vendor's full tag selection. Duplicate ids in the request are
 * collapsed rather than rejected — the client sending the same tag twice is
 * harmless, and the composite primary key would otherwise fail the insert.
 * An empty array is a valid selection and clears every tag.
 */
export async function setVendorTags(
  db: AppDatabase,
  userId: string,
  tagIds: readonly string[],
): Promise<Tag[]> {
  const profile = await findVendorProfileByUserId(db, userId);
  if (!profile) {
    throw notFound('You have not created a vendor profile yet');
  }

  const unique = [...new Set(tagIds)];
  const resolved = await findActiveTagsByIds(db, unique);

  if (resolved.length !== unique.length) {
    throw validationFailed('One or more selected tags are unavailable.');
  }

  const perCategory = new Map<string, number>();
  for (const tag of resolved) {
    const next = (perCategory.get(tag.category) ?? 0) + 1;
    if (next > MAX_TAGS_PER_CATEGORY) {
      throw validationFailed(`Choose at most ${MAX_TAGS_PER_CATEGORY} tags per category.`);
    }
    perCategory.set(tag.category, next);
  }

  await replaceVendorTags(db, profile.id, unique);

  return sortForDisplay(resolved);
}

/** Same ordering the picker renders: category group, then display order. */
function sortForDisplay(rows: TagRow[]): TagRow[] {
  return [...rows].sort(
    (a, b) =>
      a.category.localeCompare(b.category) ||
      a.displayOrder - b.displayOrder ||
      a.name.localeCompare(b.name),
  );
}

/**
 * The authoritative half of tag dedup. The client checks the already-loaded
 * list first for a responsive answer, but only this path can see tags the
 * client's list is stale for, and pending suggestions it never sees at all.
 */
export async function suggestTag(
  db: AppDatabase,
  userId: string,
  input: CreateTagSuggestionInput,
): Promise<TagSuggestionResponse> {
  const normalized = normalizeTagName(input.suggestedName);

  if (!normalized) {
    throw validationFailed('Enter a tag name.');
  }

  const existing = await findActiveTagByCategoryAndName(db, input.category, normalized);
  if (existing) {
    return { status: 'exists', tag: existing };
  }

  const pending = await findPendingSuggestion(db, input.category, normalized);
  if (pending) {
    return { status: 'already_suggested' };
  }

  const suggestion = await insertTagSuggestion(db, {
    vendorId: userId,
    // Stored as typed rather than as the comparison key, so an admin approving
    // it gets the vendor's own capitalisation.
    suggestedName: input.suggestedName.trim().replace(/\s+/g, ' '),
    category: input.category,
  });

  return { status: 'submitted', suggestionId: suggestion.id };
}
