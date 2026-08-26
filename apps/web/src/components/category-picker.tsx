'use client';

import type { Category } from '@vendor-marketplace/shared';
import { toast } from 'sonner';
import { CategoryIconBadge } from '@/components/category-icon';
import { cn } from '@/lib/utils';

/** Mirrors the ceiling `createVendorProfileSchema` enforces server-side. */
export const MAX_CATEGORIES = 5;

export interface CategoryPickerProps {
  categories: readonly Category[];
  selectedCategoryIds: readonly string[];
  onChange: (categoryIds: string[]) => void;
  disabled?: boolean;
}

/**
 * The services a vendor offers, as toggleable icon chips.
 *
 * A combobox would hide ten options behind a popover and render them as bare
 * text. Category identity is visual everywhere else in the product, and this is
 * where a vendor first meets it — so the marks are on the page, and choosing is
 * one click rather than open-search-select-close.
 */
export function CategoryPicker({
  categories,
  selectedCategoryIds,
  onChange,
  disabled = false,
}: CategoryPickerProps): React.ReactElement {
  const selectedIds = new Set(selectedCategoryIds);
  const atLimit = selectedIds.size >= MAX_CATEGORIES;

  const toggle = (categoryId: string): void => {
    if (selectedIds.has(categoryId)) {
      onChange(selectedCategoryIds.filter((id) => id !== categoryId));
      return;
    }
    if (atLimit) {
      toast.error(`Choose at most ${MAX_CATEGORIES} categories.`);
      return;
    }
    onChange([...selectedCategoryIds, categoryId]);
  };

  return (
    <div className="space-y-2">
      <ul className="flex flex-wrap gap-2">
        {categories.map((category) => {
          const isSelected = selectedIds.has(category.id);

          return (
            <li key={category.id}>
              <button
                type="button"
                aria-pressed={isSelected}
                disabled={disabled || (!isSelected && atLimit)}
                onClick={() => toggle(category.id)}
                className={cn(
                  'inline-flex min-h-11 items-center gap-2 rounded-full border py-1.5 pr-4 pl-1.5 text-sm font-medium transition-colors duration-(--duration-fast) sm:min-h-0',
                  'focus-visible:ring-2 focus-visible:ring-primary-100 focus-visible:outline-none',
                  isSelected
                    ? 'border-primary-400 bg-primary-50 text-stone-800'
                    : 'border-stone-200 bg-stone-0 text-stone-700 hover:border-stone-300 hover:bg-stone-50',
                  'disabled:cursor-not-allowed disabled:opacity-50',
                )}
              >
                <CategoryIconBadge icon={category.icon} />
                {category.name}
              </button>
            </li>
          );
        })}
      </ul>
      <p className="text-xs text-stone-500">
        {selectedIds.size} of {MAX_CATEGORIES} chosen.
      </p>
    </div>
  );
}
