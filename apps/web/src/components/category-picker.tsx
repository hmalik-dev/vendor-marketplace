'use client';

import type { Category } from '@vendorhub/shared';
import { Check, ChevronsUpDown, X } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
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

/** Mirrors the ceiling `createVendorProfileSchema` enforces server-side. */
export const MAX_CATEGORIES = 5;

export interface CategoryPickerProps {
  categories: readonly Category[];
  selectedCategoryIds: readonly string[];
  onChange: (categoryIds: string[]) => void;
  disabled?: boolean;
}

/** Searchable multi-select for the services a vendor offers. */
export function CategoryPicker({
  categories,
  selectedCategoryIds,
  onChange,
  disabled = false,
}: CategoryPickerProps): React.ReactElement {
  const [isOpen, setIsOpen] = useState(false);

  const selectedIds = new Set(selectedCategoryIds);
  const selected = categories.filter((category) => selectedIds.has(category.id));
  const atLimit = selected.length >= MAX_CATEGORIES;

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
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="lg"
            role="combobox"
            aria-expanded={isOpen}
            aria-label="Choose your service categories"
            disabled={disabled}
            className="h-11 w-full justify-between font-normal sm:h-9"
          >
            {selected.length > 0 ? `${selected.length} selected` : 'Choose your categories'}
            <ChevronsUpDown aria-hidden="true" className="opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
          <Command>
            <CommandInput placeholder="Search categories…" />
            <CommandList>
              <CommandEmpty>No matching category.</CommandEmpty>
              <CommandGroup>
                {categories.map((category) => {
                  const isSelected = selectedIds.has(category.id);
                  return (
                    <CommandItem
                      key={category.id}
                      value={category.name}
                      disabled={!isSelected && atLimit}
                      onSelect={() => toggle(category.id)}
                    >
                      <Check
                        aria-hidden="true"
                        className={cn('mr-2', isSelected ? 'opacity-100' : 'opacity-0')}
                      />
                      {category.name}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {selected.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {selected.map((category) => (
            <li key={category.id}>
              <span className="inline-flex items-center gap-1 rounded-full bg-gold-100 py-1 pr-1 pl-3 text-sm text-stone-800">
                {category.name}
                <button
                  type="button"
                  onClick={() => toggle(category.id)}
                  disabled={disabled}
                  aria-label={`Remove ${category.name}`}
                  className="relative inline-flex size-5 items-center justify-center rounded-full transition-colors after:absolute after:-inset-3 after:content-[''] hover:bg-stone-900/10 disabled:opacity-50 sm:after:hidden"
                >
                  <X aria-hidden="true" className="size-3.5" />
                </button>
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
