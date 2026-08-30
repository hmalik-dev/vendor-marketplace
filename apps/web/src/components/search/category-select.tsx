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
            /*
              No *outward* ring: on this trigger alone it would be a rounded
              box breaking out past the pill's edge. The bar draws the halo
              that says the bar has focus, and this tints while it is the
              focused segment (#89) — without which a keyboard user cannot tell
              `Vendor type` from `City`.

              The inset ring is #73 law 2, and it has to be spelled out here
              rather than inherited: this trigger is its own segment and is not
              wrapped in `search-bar.tsx`'s `segment` class, so when City and
              Event date gained the ring, measurement showed this one still
              carrying the tint alone — a materially weaker indicator on the
              first tab stop into the bar.
            */
            'focus-visible:ring-0 focus-visible:ring-offset-0',
            'focus-visible:inset-ring-2 focus-visible:inset-ring-clay-400/30',
            'transition-colors duration-(--duration-fast) focus-visible:bg-clay-400/10',
            // Stacks to a full-width row below `sm`, with the bar itself.
            'max-sm:w-full max-sm:py-1.5',
            /*
              A flex share alone let this segment fall below its own longest
              label at 1024, where the hero column is narrowest — "Any vendor
              type" truncated to "Any vendor ty…". `30-responsive.md` says the
              widths change rather than the content, so the segment carries a
              floor wide enough for its longest value, and the space comes from
              City, whose "Anywhere" needs a quarter of what it is given.
            */
            /* 1.2 at 768, 1.3 from 1024 — `14 Landing tablet` widens the
               two fields either side of it instead. */
            /*
              `padding-right:14px` at 768, where the frame gives this segment a
              border rather than a divider beside it. `flex-basis` is 0, so the
              missing 14px was redistributed and every boundary in the bar
              moved — the vendor-type segment came out 9.6px narrow and both
              hairlines sat left of where the frame draws them.
            */
            isHero
              ? 'sm:min-w-36 sm:flex-[1.2] sm:pr-3.5 lg:flex-[1.3] lg:pr-0'
              : 'sm:min-w-33 sm:flex-[1.15]',
          )}
        >
          <span
            className={cn(
              'font-semibold tracking-label text-stone-600 uppercase',
              /* `.lbl` is 10.5px and only `01 Landing` takes it unmodified. */
              isHero ? 'text-[9.5px] min-[90rem]:text-label' : 'text-[9.5px]',
            )}
          >
            Vendor type
          </span>
          <span
            className={cn(
              'flex items-center justify-between',
              isHero
                ? 'gap-2 pr-2.5 lg:mt-0.25 min-[90rem]:mt-0.5 min-[90rem]:gap-2.5 min-[90rem]:pr-3.5'
                : 'gap-1.5 pr-2.5',
            )}
          >
            <span
              className={cn(
                'truncate',
                /* Matches `SearchBar`'s own ladder — the two must agree, they
                 sit side by side in the same pill. */
                isHero
                  ? 'text-[14px] font-medium lg:text-[13.5px] lg:font-normal min-[90rem]:text-md'
                  : 'text-[13.5px]',
                selected ? 'text-stone-900' : 'text-stone-600',
              )}
            >
              {selected?.name ?? ANY_TYPE_LABEL}
            </span>
            <span
              aria-hidden="true"
              className={cn(
                'shrink-0 text-stone-600',
                isHero ? 'text-[9px] lg:text-[10px] min-[90rem]:text-[11px]' : 'text-[9px]',
              )}
            >
              ▾
            </span>
          </span>
        </button>
      </PopoverTrigger>

      {/*
        Always below, never flipped above the bar, and never wider than the
        segment it belongs to.

        `side="bottom"` with collisions off pins the direction: Radix flips to
        `top` when the unconstrained list is taller than the space beneath, so
        the picker would open upward on a short window or once the page has
        scrolled — over the headline the visitor is reading. The height cap is
        what makes that safe: the list scrolls inside the available space
        instead of overflowing off-screen.

        The width tracks the trigger so the panel sits under its own segment.
        A fixed 280px panel starting at the segment's left edge ran under the
        Search button and hid it. See design/design-plan/11-search.md.
      */}
      <PopoverContent
        align="start"
        side="bottom"
        avoidCollisions={false}
        className="w-(--radix-popover-trigger-width) max-h-(--radix-popover-content-available-height) min-w-56 overflow-hidden p-0"
      >
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
                    <p className="mt-1 text-sm leading-normal text-stone-600">Did you mean</p>
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
                  <p className="mt-1 text-sm leading-normal text-stone-600">
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
