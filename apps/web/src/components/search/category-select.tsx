'use client';

import { CATEGORY_SEEDS, type Category } from '@vendor-marketplace/shared';
import { useState } from 'react';
import { SingleSelectDropdown } from '@/components/ui/dropdown-select';
import type { DropdownOption } from '@/components/ui/dropdown';
import { cn } from '@/lib/utils';

/**
 * The vendor-type picker: a select over the seeded categories that **cannot
 * hold an unrecognised value**. The field resolves to a category slug or it
 * stays empty.
 *
 * That constraint is the whole point of the control — a query can then only
 * ever ask a question the platform can answer, and the result-count sentence
 * can always name the category truthfully. See decision D6 and
 * design/design-plan/11-search.md.
 *
 * **The filter field is gone (#167).** `42-dropdowns.md` deletes it and says
 * why: eleven categories fit on one screen, and a filter box on a list that
 * short is friction rather than help. The "did you mean" recovery went with it
 * — it existed only to answer a typo in a field that no longer accepts typing,
 * and type-ahead in the list now does the same job in one keystroke.
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

/**
 * The one-line description the frame prints under each name — "Photo & film",
 * "DJs, bands, hosts".
 *
 * Read from `CATEGORY_SEEDS` rather than the API row, because the column does
 * not exist: the taxonomy is fixed reference data seeded from this same
 * constant, so the two cannot disagree, and adding a column to carry a string
 * that already has a home would be a migration for nothing.
 */
const SHORT_DESCRIPTIONS = new Map(
  CATEGORY_SEEDS.map((seed) => [seed.slug, seed.shortDescription]),
);

/** How many rows clear the 360px cap, for the panel's "N more" note. */
const VISIBLE_ROWS = 7;

export function CategorySelect({
  categories,
  value,
  onChange,
  size,
  id,
}: CategorySelectProps): React.ReactElement {
  const [isOpen, setIsOpen] = useState(false);

  const isHero = size === 'hero';
  const selected = categories.find((category) => category.slug === value);

  /*
   * "Any vendor type" leads, because it is how the field is emptied and a
   * customer looking for it is looking for the top of the list. It carries no
   * hint: there is nothing to describe about the absence of a filter.
   */
  const options: DropdownOption[] = [
    { value: '', label: ANY_TYPE_LABEL },
    ...categories.map((category) => ({
      value: category.slug,
      label: category.name,
      ...(SHORT_DESCRIPTIONS.has(category.slug)
        ? { hint: SHORT_DESCRIPTIONS.get(category.slug) }
        : {}),
    })),
  ];

  return (
    <SingleSelectDropdown
      open={isOpen}
      onOpenChange={setIsOpen}
      label="Vendor type"
      countNoun="categories"
      options={options}
      value={value}
      onChange={onChange}
      width={isHero ? 'hero' : 'compact'}
      density={isHero ? 'default' : 'compact'}
      // The hero is the page's subject and dims behind its panel; the compact
      // bar sits over results that have to stay readable.
      scrim={isHero}
      visibleCount={VISIBLE_ROWS}
      emptyMessage="No vendor types are available right now."
      trigger={
        <button
          type="button"
          id={id}
          aria-label="Vendor type"
          aria-haspopup="listbox"
          aria-expanded={isOpen}
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
                /*
                  Open state. It used to differ between the two bars: in the
                  compact bar the open segment is the only clay element on the
                  bar so the value itself turns, and in the hero the value
                  stayed ink because *the caret alone carried it*.
                  D25 removed the caret, which left the hero segment rendering
                  byte-identically open and closed — `aria-expanded` was the
                  only signal, so the state was announced and not drawn. Both
                  bars now turn the value, which is the treatment the frames
                  already specify for one of them.
                */
                isOpen
                  ? 'font-semibold text-clay-600'
                  : selected
                    ? 'text-stone-900'
                    : 'text-stone-600',
              )}
            >
              {selected?.name ?? ANY_TYPE_LABEL}
            </span>
          </span>
        </button>
      }
    />
  );
}
