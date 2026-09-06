'use client';

import {
  MAX_TAGS_PER_CATEGORY,
  TAG_CATEGORIES,
  type TagCategory,
} from '@vendor-marketplace/shared';
import { useCallback, useMemo, useState } from 'react';
import { toast } from 'sonner';
import type { WireTag } from '@/lib/wire-schemas';
import { TagCategorySection } from './tag-category-section';
import { TAG_CATEGORY_LABELS } from './tag-display';

export interface TagPickerProps {
  allTags: readonly WireTag[];
  selectedTagIds: readonly string[];
  onTagsChange: (tagIds: string[]) => void;
  disabled?: boolean;
}

/**
 * The three grouped tag sections. Deliberately controlled: the profile form
 * owns the selection so it can be saved in the same action as the rest of the
 * form rather than as a separate side effect the vendor has to think about.
 */
export function TagPicker({
  allTags,
  selectedTagIds,
  onTagsChange,
  disabled = false,
}: TagPickerProps): React.ReactElement {
  /*
   * Tags this picker learned about after the page loaded — a suggestion the
   * server matched against a tag an admin approved since. Held here and merged
   * into the list below, because everything downstream resolves a *held* id
   * through that list: the per-category count, the "n of 5" line, and the pills
   * (#405).
   *
   * Without it such a tag was selected but invisible. It counted as zero, so
   * the vendor could go on to pick a full five more with no warning; it drew no
   * pill and therefore no Remove button; and since this ticket made the
   * storefront save one transaction, the resulting over-limit selection stopped
   * the *whole* save — bio, business name and all — against a tag they could
   * not see to remove. Every retry failed the same way until a reload threw the
   * edit away.
   */
  const [learned, setLearned] = useState<readonly WireTag[]>([]);

  const tags = useMemo(
    () => [...allTags, ...learned.filter((tag) => !allTags.some((known) => known.id === tag.id))],
    [allTags, learned],
  );

  const categoryOf = useCallback(
    (tagId: string) => tags.find((tag) => tag.id === tagId)?.category,
    [tags],
  );

  /**
   * Adds one tag, or refuses it at the per-category ceiling and says so.
   *
   * Takes the category rather than deriving it, because the one caller that
   * can hold a tag `allTags` has never seen — a suggestion the server matched
   * against a list added since this page loaded — would otherwise land in a
   * `categoryOf(...) === undefined` bucket of its own and slip past the limit
   * entirely (#405).
   *
   * Returns whether the tag ends up selected, so the caller can report the real
   * outcome instead of assuming one.
   */
  const add = useCallback(
    (tagId: string, category: TagCategory): boolean => {
      const inCategory = selectedTagIds.filter((id) => categoryOf(id) === category).length;

      if (inCategory >= MAX_TAGS_PER_CATEGORY) {
        toast.error(
          `You can choose at most ${MAX_TAGS_PER_CATEGORY} ${TAG_CATEGORY_LABELS[
            category
          ].toLowerCase()}.`,
        );
        return false;
      }

      onTagsChange([...selectedTagIds, tagId]);
      return true;
    },
    [categoryOf, onTagsChange, selectedTagIds],
  );

  /** Adds or removes, for the sections' own options. */
  const toggle = useCallback(
    (tag: WireTag): void => {
      if (selectedTagIds.includes(tag.id)) {
        onTagsChange(selectedTagIds.filter((id) => id !== tag.id));
        return;
      }

      add(tag.id, tag.category);
    },
    [add, onTagsChange, selectedTagIds],
  );

  /**
   * Idempotent add, for a suggestion that resolved to an existing tag.
   *
   * Returns whether the tag ends up selected, because the caller announces the
   * outcome (#405) — it used to say "we've selected X for you" over the top of
   * the limit refusal, two toasts contradicting each other.
   */
  const select = useCallback(
    (tag: WireTag): boolean => {
      if (selectedTagIds.includes(tag.id)) {
        return true;
      }

      if (!add(tag.id, tag.category)) {
        return false;
      }

      // Remembered only once it is actually held, so a refused suggestion does
      // not quietly grow the list the ceiling is counted against.
      if (!tags.some((known) => known.id === tag.id)) {
        setLearned((previous) => [...previous, tag]);
      }

      return true;
    },
    [add, selectedTagIds, tags],
  );

  return (
    /*
     * The three groups are peers, so they sit on one row from `lg` up. Stacking
     * them costs roughly a screen of height for no gain in comprehension.
     */
    <div className="grid gap-x-6 gap-y-6 lg:grid-cols-3 lg:grid-rows-[auto_auto_auto_auto]">
      {TAG_CATEGORIES.map((category) => (
        <TagCategorySection
          key={category}
          category={category}
          allTags={tags}
          selectedTagIds={selectedTagIds}
          onToggle={toggle}
          onSelect={select}
          disabled={disabled}
        />
      ))}
    </div>
  );
}
