'use client';

import { MAX_TAGS_PER_CATEGORY, TAG_CATEGORIES } from '@vendor-marketplace/shared';
import { useCallback } from 'react';
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
  const categoryOf = useCallback(
    (tagId: string) => allTags.find((tag) => tag.id === tagId)?.category,
    [allTags],
  );

  const toggle = useCallback(
    (tagId: string) => {
      if (selectedTagIds.includes(tagId)) {
        onTagsChange(selectedTagIds.filter((id) => id !== tagId));
        return;
      }

      const category = categoryOf(tagId);
      const inCategory = selectedTagIds.filter((id) => categoryOf(id) === category).length;

      if (inCategory >= MAX_TAGS_PER_CATEGORY) {
        toast.error(
          `You can choose at most ${MAX_TAGS_PER_CATEGORY} ${
            category ? TAG_CATEGORY_LABELS[category].toLowerCase() : 'tags'
          }.`,
        );
        return;
      }

      onTagsChange([...selectedTagIds, tagId]);
    },
    [categoryOf, onTagsChange, selectedTagIds],
  );

  /** Idempotent add, for a suggestion that resolved to an existing tag. */
  const select = useCallback(
    (tagId: string) => {
      if (!selectedTagIds.includes(tagId)) {
        toggle(tagId);
      }
    },
    [selectedTagIds, toggle],
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
          allTags={allTags}
          selectedTagIds={selectedTagIds}
          onToggle={toggle}
          onSelect={select}
          disabled={disabled}
        />
      ))}
    </div>
  );
}
