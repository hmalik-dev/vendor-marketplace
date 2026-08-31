'use client';

import { CATEGORY_SEEDS, type Category } from '@vendor-marketplace/shared';
import { ComboboxDropdown } from '@/components/ui/dropdown-combobox';
import type { DropdownOption } from '@/components/ui/dropdown';
import { filterOptions } from '@/lib/option-filter';
import { cn } from '@/lib/utils';

/**
 * The vendor-type picker: a **filtering combobox** over the seeded categories
 * that still **cannot hold an unrecognised value**. The field resolves to a
 * category slug or it stays empty.
 *
 * That constraint is the whole point of the control and is untouched by #375 —
 * a query can then only ever ask a question the platform can answer, and the
 * result-count sentence can always name the category truthfully. See decision
 * D6 and `design/design-plan/11-search.md`.
 *
 * **The trigger is now the text input (#375, on the user's instruction).** What
 * this replaced was a `button` whose only text affordance was type-ahead
 * jump-to-first-letter. Two things are worth keeping straight about that
 * change, because the file used to say the opposite:
 *
 * - **The filtering is not the override.** `42-dropdowns.md:45` has specified
 *   "typing narrows the list in place (not a jump-to-first-letter)" since the
 *   2026-08-30 import, and D14 recorded that the code was still on the
 *   behaviour that import reversed. `11-search.md:19` specifies this control as
 *   a combobox. #375 closes that gap.
 * - **The override is narrow**: D13 ruling 1 and `42-dropdowns.md` say a
 *   single-select has no search field, on the reasoning that eleven categories
 *   fit one screen and an autofocused box inside the panel is friction with a
 *   permanent focus ring. There is no second field here — the customer types
 *   into the one they already tabbed to — so that reasoning is answered rather
 *   than overruled. Recorded as **D28**.
 *
 * The "did you mean" recovery is still gone (#167) and #375 does not bring it
 * back: `11-search.md` offers "the three closest categories" on no match, which
 * needs a distance metric this ticket's non-goals exclude. A no-match panel
 * naming what was typed is what ships.
 */

/** The label the field shows, and the row that empties it. */
const ANY_TYPE_LABEL = 'Any vendor type';

/**
 * Short descriptions, by slug, read from the seed constant rather than an API
 * column — the taxonomy is seeded, so the copy travels with it.
 */
const SHORT_DESCRIPTIONS = new Map(
  CATEGORY_SEEDS.map((seed) => [seed.slug, seed.shortDescription]),
);

/** How many rows clear the 360px cap, for the panel's "N more" note. */
const VISIBLE_ROWS = 7;

export interface CategorySelectProps {
  categories: readonly Category[];
  /** A category slug, or `''` for "any vendor type". */
  value: string;
  onChange: (slug: string) => void;
  /** Matches the two search-bar densities the frames draw. */
  size: 'compact' | 'hero';
  id: string;
}

export function CategorySelect({
  categories,
  value,
  onChange,
  size,
  id,
}: CategorySelectProps): React.ReactElement {
  const isHero = size === 'hero';
  const selected = categories.find((category) => category.slug === value);

  /*
   * `Any vendor type` leads the unfiltered list and carries no hint — it is how
   * the field is emptied, not a category, and a description under it would read
   * as one. It is filtered like any other row, so a customer who types "any"
   * still finds it.
   */
  const options: DropdownOption[] = [
    { value: '', label: ANY_TYPE_LABEL },
    ...categories.map((category) => {
      const hint = SHORT_DESCRIPTIONS.get(category.slug);

      return {
        value: category.slug,
        label: category.name,
        ...(hint === undefined ? {} : { hint }),
      };
    }),
  ];

  return (
    <ComboboxDropdown
      options={options}
      value={value}
      onCommit={onChange}
      /*
       * Empty is empty. `Any vendor type` is the **placeholder**, not the
       * value — an input holding those words as text would have the customer's
       * first keystroke append to them, and the filter would then match the
       * literal string "Any vendor typef".
       */
      committedLabel={selected?.name ?? ''}
      filter={filterOptions}
      /*
       * Opens on the **full** list. Eleven categories are a taxonomy worth
       * seeing, and D6's "it teaches the taxonomy on first use" is why the
       * select existed at all. This is the difference from `City`.
       */
      openOnFocus
      label="Vendor type"
      id={id}
      placeholder={ANY_TYPE_LABEL}
      emptyMessage="No vendor types are available right now."
      noMatchMessage={(query) => `No vendor type matches “${query}”.`}
      caption={`Vendor type · ${categories.length} categories`}
      visibleCount={VISIBLE_ROWS}
      width={isHero ? 'hero' : 'compact'}
      density={isHero ? 'default' : 'compact'}
      scrim={isHero}
      className={cn(
        'flex min-w-0 flex-col rounded-full text-left',
        /*
          No *outward* ring: on this trigger alone it would be a rounded box
          breaking out past the pill's edge. The bar draws the halo that says
          the bar has focus, and this tints while it is the focused segment
          (#89) — without which a keyboard user cannot tell `Vendor type` from
          `City`.

          `has-[:focus-visible]` rather than `focus-visible`, because the focus
          now lands on the input **inside** this box rather than on the box
          itself. Same treatment, one level out; `search-bar.tsx`'s `segment`
          does it the same way for City and Event date.
        */
        'transition-colors duration-(--duration-fast) has-[:focus-visible]:bg-clay-400/10',
        'has-[:focus-visible]:inset-ring-2 has-[:focus-visible]:inset-ring-clay-400/30',
        // Stacks to a full-width row below `sm`, with the bar itself.
        'max-sm:w-full max-sm:py-1.5',
        /*
          A flex share alone let this segment fall below its own longest label
          at 1024, where the hero column is narrowest — "Any vendor type"
          truncated to "Any vendor ty…". `30-responsive.md` says the widths
          change rather than the content, so the segment carries a floor wide
          enough for its longest value, and the space comes from City, whose
          "Anywhere" needs a quarter of what it is given.

          1.2 at 768, 1.3 from 1024. `padding-right:14px` at 768, where the
          frame gives this segment a border rather than a divider beside it:
          `flex-basis` is 0, so a missing 14px is redistributed and every
          boundary in the bar moves.
        */
        isHero
          ? 'sm:min-w-36 sm:flex-[1.2] sm:pr-3.5 lg:flex-[1.3] lg:pr-0'
          : 'sm:min-w-33 sm:flex-[1.15]',
      )}
      labelClassName={cn(
        'cursor-text font-semibold tracking-label text-stone-600 uppercase',
        /* `.lbl` is 10.5px and only `01 Landing` takes it unmodified. */
        isHero ? 'text-[9.5px] min-[90rem]:text-label' : 'text-[9.5px]',
      )}
      inputClassName={(open) =>
        cn(
          'w-full min-w-0 truncate bg-transparent outline-none placeholder:text-stone-600',
          /* Matches `SearchBar`'s own ladder — the two must agree, they sit
             side by side in the same pill. */
          isHero ? 'text-[14px] lg:text-[13.5px] min-[90rem]:text-md' : 'text-[13.5px]',
          isHero ? 'gap-2 pr-2.5 lg:mt-0.25 min-[90rem]:mt-0.5 min-[90rem]:pr-3.5' : 'pr-2.5',
          /*
            Open state, resolved here in JS rather than layered as classes.
            D25 removed the caret that used to carry it, and #373 then found
            that a `font-semibold` sitting beside the ladder's `lg:font-normal`
            lost on source order at 1440 — the browser painted 400 while the
            class list read semibold. One branch, one weight.
          */
          open
            ? 'font-semibold text-clay-600'
            : cn(
                isHero && 'font-medium lg:font-normal',
                selected ? 'text-stone-900' : 'text-stone-600',
              ),
        )
      }
    />
  );
}
