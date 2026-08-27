'use client';

import type { Category } from '@vendor-marketplace/shared';
import { useState } from 'react';
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { closestCategories } from './closest-categories';

/**
 * The vendor-type picker: a select over the seeded categories that **cannot
 * hold an unrecognised value**. Typing filters the list; it never becomes the
 * value. The field resolves to a category slug or it stays empty.
 *
 * That constraint is the whole point of the control — a query can then only
 * ever ask a question the platform can answer, and the result-count sentence
 * can always name the category truthfully. See decision D6 and
 * design/design-plan/11-search.md.
 */
export interface CategorySelectProps {
  categories: readonly Category[];
  /** A category slug, or `''` for "any vendor type". */
  value: string;
  onChange: (slug: string) => void;
  /** Matches the two search-bar densities the frames draw. */
  size: 'compact' | 'hero';
  id: string;
}

const ANY_TYPE_LABEL = 'Any vendor type';

export function CategorySelect({
  categories,
  value,
  onChange,
  size,
  id,
}: CategorySelectProps): React.ReactElement {
  const [isOpen, setIsOpen] = useState(false);
  const [typed, setTyped] = useState('');

  const isHero = size === 'hero';
  const selected = categories.find((category) => category.slug === value);
  const needle = typed.trim().toLowerCase();

  // Plain substring, in seed order — the list is eleven items, and reordering
  // it by relevance would lose the `displayOrder` the taxonomy is designed in.
  const matches =
    needle === ''
      ? categories
      : categories.filter((category) => category.name.toLowerCase().includes(needle));

  const hasNoMatch = needle !== '' && matches.length === 0;
  const suggestions = hasNoMatch ? closestCategories(categories, typed) : [];

  const choose = (slug: string): void => {
    onChange(slug);
    setTyped('');
    setIsOpen(false);
  };

  return (
    <Popover
      open={isOpen}
      onOpenChange={(next) => {
        setIsOpen(next);
        // Abandoning the popover discards what was typed rather than leaving a
        // half-typed string looking like a pending value.
        if (!next) {
          setTyped('');
        }
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          id={id}
          aria-label="Vendor type"
          className={cn(
            'flex min-w-0 flex-col rounded-full text-left outline-none',
            'focus-visible:ring-3 focus-visible:ring-clay-400/15',
            // Stacks to a full-width row below `sm`, with the bar itself.
            'max-sm:w-full max-sm:py-1.5',
            isHero ? 'sm:flex-[1.3]' : 'sm:flex-[1.15]',
          )}
        >
          <span
            className={cn(
              'font-semibold tracking-[.05em] text-stone-600 uppercase',
              isHero ? 'text-[10.5px]' : 'text-[9.5px]',
            )}
          >
            Vendor type
          </span>
          <span
            className={cn(
              'flex items-center justify-between',
              isHero ? 'mt-0.5 gap-2.5 pr-3.5' : 'gap-1.5 pr-2.5',
            )}
          >
            <span
              className={cn(
                'truncate',
                isHero ? 'text-md' : 'text-[13.5px]',
                selected ? 'text-stone-900' : 'text-stone-600',
              )}
            >
              {selected?.name ?? ANY_TYPE_LABEL}
            </span>
            <span
              aria-hidden="true"
              className={cn('shrink-0 text-stone-600', isHero ? 'text-[11px]' : 'text-[9px]')}
            >
              ▾
            </span>
          </span>
        </button>
      </PopoverTrigger>

      <PopoverContent align="start" className="w-70 p-0">
        <Command
          // The list is short and already in seed order; cmdk's own fuzzy
          // ranking would reorder it and lose that.
          shouldFilter={false}
        >
          <CommandInput value={typed} onValueChange={setTyped} placeholder="Filter vendor types" />
          <CommandList>
            {/*
              The no-match state is rendered from `matches`, not from cmdk's
              `CommandEmpty`. "Any vendor type" is always in the list, so the
              list is never empty by cmdk's reckoning and `CommandEmpty` would
              never fire — a customer who typed a phrase would see a list
              holding nothing but "Any", which answers nothing.
            */}
            {hasNoMatch ? (
              <div className="px-3 py-4 text-left">
                <p className="text-base font-semibold text-stone-900">No matching type</p>
                {suggestions.length > 0 ? (
                  <>
                    <p className="mt-1 text-sm text-stone-600">Did you mean</p>
                    <ul className="mt-2 flex flex-col gap-1">
                      {suggestions.map((category) => (
                        <li key={category.id}>
                          <button
                            type="button"
                            onClick={() => choose(category.slug)}
                            className="w-full rounded-md px-2 py-1.5 text-left text-base font-semibold text-clay-500 hover:bg-clay-100 hover:text-clay-600"
                          >
                            {category.name}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </>
                ) : (
                  <p className="mt-1 text-sm text-stone-600">
                    Pick a vendor type from the list to search.
                  </p>
                )}
              </div>
            ) : (
              <CommandGroup>
                {/*
                  "Any vendor type" is how the field is emptied, so it belongs
                  with the unfiltered list — but it is not a candidate answer to
                  "which type did you mean?", so it drops out once the customer
                  starts narrowing.
                */}
                {typed.trim() === '' ? (
                  <CommandItem value="" onSelect={() => choose('')}>
                    {ANY_TYPE_LABEL}
                  </CommandItem>
                ) : null}
                {matches.map((category) => (
                  <CommandItem
                    key={category.id}
                    value={category.slug}
                    onSelect={() => choose(category.slug)}
                  >
                    {category.name}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
