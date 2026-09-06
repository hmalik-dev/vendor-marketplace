'use client';

import { CATEGORY_SEEDS, type Category } from '@vendor-marketplace/shared';
import { ComboboxDropdown } from '@/components/ui/dropdown-combobox';
import type { DropdownOption } from '@/components/ui/dropdown';
import { filterOptions } from '@/lib/option-filter';
import { SEGMENT_FOCUS } from '@/lib/focus';
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
        /*
          `max-sm:rounded-sm`, matching `search-bar.tsx`'s `segment` and for the
          reason recorded there: below `sm` this segment is a stacked row with
          no left padding, so a `rounded-full` cap on a 41px box curves 20.5px
          across a label that starts at inset 0. `rounded-sm` is 6px and
          `max-sm:py-1.5` puts the label at y=6, so the arc ends exactly where
          the glyphs begin. Measured at 390 on both surfaces: intrusion 0.00px.
        */
        'flex min-w-0 flex-col max-sm:rounded-sm sm:rounded-full',
        'text-left',
        /*
          The segment treatment, and the same one `search-bar.tsx`'s `segment`
          applies to City and Event date: a `stone-200` fill and a clay label,
          no border, edge or outline. `has-[:focus-visible]` rather than
          `focus-visible`, because the focus lands on the `<input>` **inside**
          this box rather than on the box itself.

          It carried an inset ring and a `clay-400/10` tint until #383; the
          comment in `search-bar.tsx` records why one fill replaced four
          overlapping indicators.
        */
        'group/segment transition-colors duration-(--duration-fast)',
        SEGMENT_FOCUS,
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
        /*
          **The left padding is the focus fill's geometry, not spacing** (#417
          item 1b).

          This is the bar's first segment, so it used to take its inset from the
          bar's own `padding-left` and carry none itself. The fill is
          `rounded-full`, so its corner radius is **half the segment's height**
          — and with `padding-left: 0` the cap curved inward across exactly the
          characters it was meant to contain. Measured on `/search` at 1440: the
          glyphs of `Vendor type` began at inset 0.0px from the segment's left
          edge, taken with a `Range` rather than off the element box.

          Each step's padding is that step's radius, so the label clears the cap
          at **every** y rather than at the one that happened to be sampled.
          Segment heights measured in Chromium: 27px compact at every width;
          hero 29 at 768, 28 at 1024 and 1280, 34 at 1440. Hence 14 / 15 / 14 /
          18. The hero at 1440 is the one that makes this a ladder rather than a
          single value — a flat 14px there left the label 3px inside a 17px cap.

          **The bar's total left inset is unchanged.** Every pixel added here
          comes off the form's `padding-left` in `search-bar.tsx`, step for step
          (18 = 4 + 14 compact; 20/18/24 = 5/4/6 + 15/14/18 hero), so no flex
          weight, divider or segment boundary moves at any width in
          `30-responsive.md`. `search-bar-inset.test.tsx` fails if the two halves
          stop summing, or if either stops clearing its cap.

          The `min-w` floors grow with it for the same reason: they are
          border-box floors under a 0 `flex-basis`, so leaving them would have
          spent the new padding out of the space "Any vendor type" needs and
          truncated it at 1024, which is the failure the floors exist for. The
          hero floor grows by the **largest** of its three paddings (15), not by
          each step's own — a floor one pixel generous at 1024 costs nothing,
          and a second `min-w` declaration to shave it would be arithmetic
          nobody can check against a frame.
        */
        isHero
          ? 'sm:min-w-39.75 sm:flex-[1.2] sm:pr-3.5 sm:pl-3.75 lg:flex-[1.3] lg:pr-0 lg:pl-3.5 min-[90rem]:pl-4.5'
          : 'sm:min-w-36.5 sm:flex-[1.15] sm:pl-3.5',
      )}
      labelClassName={cn(
        'font-semibold tracking-label text-stone-600 uppercase',
        // "…and a clay label", the other half of the segment treatment.
        'transition-colors duration-(--duration-fast) group-has-[:focus-visible]/segment:text-clay-600 group-focus-visible/segment:text-clay-600',
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
