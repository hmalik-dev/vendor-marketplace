'use client';

import { MAX_TAGS_PER_CATEGORY, type TagCategory } from '@vendor-marketplace/shared';
import { Check, ChevronsUpDown, X } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import type { WireTag } from '@/lib/wire-schemas';
import { TAG_CATEGORY_HINTS, TAG_CATEGORY_LABELS, TAG_PILL_CLASSES } from './tag-display';
import { TagSuggestionForm } from './tag-suggestion-form';

export interface TagCategorySectionProps {
  category: TagCategory;
  /** Every active tag, of every category; this section filters to its own. */
  allTags: readonly WireTag[];
  selectedTagIds: readonly string[];
  onToggle: (tagId: string) => void;
  onSelect: (tagId: string) => void;
  disabled?: boolean;
}

/**
 * One searchable multi-select group in the tag picker, with its selection
 * rendered as removable pills below. At the per-category ceiling the remaining
 * options are disabled rather than hidden, so the limit is visible rather than
 * mysterious.
 */
export function TagCategorySection({
  category,
  allTags,
  selectedTagIds,
  onToggle,
  onSelect,
  disabled = false,
}: TagCategorySectionProps): React.ReactElement {
  const [isOpen, setIsOpen] = useState(false);

  const options = allTags.filter((tag) => tag.category === category);
  const selectedIds = new Set(selectedTagIds);
  const selected = options.filter((tag) => selectedIds.has(tag.id));
  const atLimit = selected.length >= MAX_TAGS_PER_CATEGORY;
  const label = TAG_CATEGORY_LABELS[category];

  return (
    /*
     * Five explicit rows shared with the sibling sections via subgrid: the
     * hints are different lengths, so a plain stack drops the middle column's
     * trigger a line below its neighbours. Subgrid keeps every row — heading,
     * hint, trigger, pills, suggestion — on one line across all three columns.
     */
    <section className="grid content-start gap-3 lg:row-span-4 lg:grid-rows-subgrid">
      {/* Heading, count, and hint are one unit, so they bind tightly and the
          12px rhythm below separates the three real controls. */}
      <div>
        <div className="flex flex-wrap items-baseline justify-between gap-x-3">
          <h3 className="text-sm font-medium text-stone-800">{label}</h3>
          <p className="text-xs text-stone-600">
            {selected.length} of {MAX_TAGS_PER_CATEGORY}
            {atLimit ? ' (limit reached)' : ''}
          </p>
        </div>
        <p className="mt-1 text-xs text-stone-600">{TAG_CATEGORY_HINTS[category]}</p>
      </div>

      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="secondary"
            size="lg"
            role="combobox"
            aria-expanded={isOpen}
            aria-label={`Choose ${label.toLowerCase()}`}
            disabled={disabled}
            className="h-11 w-full justify-between font-normal sm:h-9"
          >
            {selected.length > 0 ? `${selected.length} selected` : `Choose ${label.toLowerCase()}`}
            <ChevronsUpDown aria-hidden="true" className="opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
          <Command>
            <CommandInput placeholder={`Search ${label.toLowerCase()}…`} />
            <CommandList>
              <CommandEmpty>No match. Suggest it below instead.</CommandEmpty>
              <CommandGroup>
                {options.map((tag) => {
                  const isSelected = selectedIds.has(tag.id);
                  return (
                    <CommandItem
                      key={tag.id}
                      value={tag.name}
                      disabled={!isSelected && atLimit}
                      onSelect={() => onToggle(tag.id)}
                    >
                      <Check
                        aria-hidden="true"
                        className={cn('mr-2', isSelected ? 'opacity-100' : 'opacity-0')}
                      />
                      {tag.name}
                      {!isSelected && atLimit ? (
                        <span className="ml-auto text-xs text-stone-600">(limit reached)</span>
                      ) : null}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      <ul className="flex flex-wrap gap-2 empty:hidden lg:empty:block">
        {selected.map((tag) => (
          <li key={tag.id}>
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded-full py-1 pr-1 pl-3 text-sm',
                TAG_PILL_CLASSES[category],
              )}
            >
              {tag.name}
              <button
                type="button"
                onClick={() => onToggle(tag.id)}
                disabled={disabled}
                aria-label={`Remove ${tag.name}`}
                className="relative inline-flex size-5 items-center justify-center rounded-full transition-colors after:absolute after:-inset-3 after:content-[''] hover:bg-stone-900/10 disabled:opacity-50 sm:after:hidden"
              >
                <X aria-hidden="true" className="size-3.5" />
              </button>
            </span>
          </li>
        ))}
      </ul>

      <TagSuggestionForm
        category={category}
        allTags={allTags}
        onTagResolved={(tag) => onSelect(tag.id)}
      />
    </section>
  );
}
