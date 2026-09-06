import {
  MAX_TAGS_PER_CATEGORY,
  type CreateTagSuggestionInput,
  type FieldErrorDetails,
  type Tag,
  type TagSuggestionResponse,
} from '@vendor-marketplace/shared';
import type { TagRow } from '@vendor-marketplace/db/schema';
import type { AppDatabase } from '../../lib/database.js';
import { validationFailed } from '../../lib/errors.js';
import {
  findActiveTagByCategoryAndName,
  findActiveTags,
  findActiveTagsByIds,
  findPendingSuggestion,
  insertTagSuggestion,
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

/** A tag selection that has been checked against the live list and the per-category ceiling. */
export interface VendorTagSelection {
  /** Deduplicated ids, in the order they arrived. */
  readonly tagIds: readonly string[];
  /** The resolved rows, in the order the picker renders them. */
  readonly tags: Tag[];
}

/**
 * Checks a tag selection **without writing anything**.
 *
 * Separated from the write so the storefront save can refuse a bad selection
 * before it touches the profile row (#405). Every realistic refusal here — a
 * tag an admin has since hidden, a selection over the per-category ceiling — is
 * knowable up front, so the vendor gets one failed save rather than a profile
 * edit that stands with no tags to go with it.
 */
export async function resolveVendorTagSelection(
  db: AppDatabase,
  tagIds: readonly string[],
): Promise<VendorTagSelection> {
  const unique = [...new Set(tagIds)];
  const resolved = await findActiveTagsByIds(db, unique);

  if (resolved.length !== unique.length) {
    // Attributed to the tag picker rather than left as a toast, for the reason
    // in `assertCategoriesSelectable`: the editor saves tags in the same submit.
    throw validationFailed(
      'One or more selected tags are unavailable. Reload the page and choose from the current list.',
      { field: 'tagIds' } satisfies FieldErrorDetails,
    );
  }

  const perCategory = new Map<string, number>();
  for (const tag of resolved) {
    const next = (perCategory.get(tag.category) ?? 0) + 1;
    if (next > MAX_TAGS_PER_CATEGORY) {
      throw validationFailed(`Choose at most ${MAX_TAGS_PER_CATEGORY} tags per category.`, {
        field: 'tagIds',
      } satisfies FieldErrorDetails);
    }
    perCategory.set(tag.category, next);
  }

  return { tagIds: unique, tags: sortForDisplay(resolved) };
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

  /*
   * The read above lost the race, and the database caught what it missed. The
   * answer is the same one that read would have given — this idea is already in
   * front of an admin — rather than a 500 for a request that did nothing wrong.
   */
  if (!suggestion) {
    return { status: 'already_suggested' };
  }

  return { status: 'submitted', suggestionId: suggestion.id };
}
