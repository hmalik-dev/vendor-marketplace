'use client';

import { useState } from 'react';
import { CATEGORY_SEEDS, type Category } from '@vendor-marketplace/shared';
import { Dropdown, DropdownList, type DropdownOption } from '@/components/ui/dropdown';
import { SEGMENT_FOCUS } from '@/lib/focus';
import { cn } from '@/lib/utils';

/**
 * The vendor-type picker: a **plain single-select** over the seeded
 * categories. The field resolves to a category slug or it stays empty.
 *
 * That constraint is the whole point of the control and is untouched by this
 * revision — a query can then only ever ask a question the platform can
 * answer, and the result-count sentence can always name the category
 * truthfully. See decision D6 and `design/design-plan/11-search.md`.
 *
 * **The trigger is a button again, not a text input (VEN-603, on the account
 * holder's instruction).** #375/D28 had made it a typing combobox so "typing
 * narrows the list in place" — but on mobile that meant tapping the trigger
 * summoned the OS keyboard before anyone had asked to type, covering most of
 * an eleven-row list. The account holder's ruling superseded #375 for *this*
 * control specifically, on different grounds: eleven categories fit one
 * screen, so type-to-filter was never load-bearing here the way it is for
 * `City`'s open-ended set of US places — `CitySelect` is untouched and keeps
 * its typing combobox. D13 ruling 1's original reasoning (an autofocused
 * search field inside an eleven-row panel is friction, not help) is restored
 * rather than re-litigated; `DropdownList`'s own keyboard model — arrows,
 * `Enter`, jump-to-first-letter on a typed key — replaces the typing filter.
 *
 * The "did you mean" recovery stays gone (#167): there is no way to mistype
 * into a button, so the no-match panel this used to need does not apply here
 * either.
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
  const [open, setOpen] = useState(false);
  const isHero = size === 'hero';
  const selected = categories.find((category) => category.slug === value);
  const displayLabel = selected?.name ?? ANY_TYPE_LABEL;

  /*
   * `Any vendor type` leads the list and carries no hint — it is how the
   * field is emptied, not a category, and a description under it would read
   * as one.
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
    <Dropdown
      open={open}
      onOpenChange={setOpen}
      label="Vendor type"
      /*
       * `categories.length`, not `options.length`: the count is the real
       * taxonomy, and `options` carries one extra row for "Any vendor type",
       * which is not a category.
       */
      caption={`Vendor type · ${categories.length} categories`}
      width={isHero ? 'hero' : 'compact'}
      density={isHero ? 'default' : 'compact'}
      scrim={isHero}
      trigger={
        <button
          type="button"
          id={id}
          /*
           * Static, matching `DateDropdown`'s identically-shaped trigger in
           * `search-bar.tsx` — a deliberate choice, not an oversight: an
           * `aria-label` overrides a button's own text content entirely, so
           * a value-carrying label would have to be built and kept in sync
           * with the visible one rather than read off it, and neither
           * sibling trigger on this bar does that today.
           */
          aria-label="Vendor type"
          aria-haspopup="listbox"
          aria-expanded={open}
          /*
           * The segment fill is this button's whole focus indicator —
           * `data-focus-fill` marks that for `e2e/focus-indicator.spec.ts`,
           * and `data-focus-own` tells the base unbordered rule in
           * `globals.css` to step aside. See `lib/focus.ts`.
           */
          data-focus-own
          data-focus-fill
          className={cn(
            'flex min-w-0 flex-col text-left max-sm:rounded-sm sm:rounded-full',
            'group/segment transition-colors duration-(--duration-fast)',
            SEGMENT_FOCUS,
            /*
             * `has-[:focus-visible]` in `SEGMENT_FOCUS` targets a focusable
             * *child* — the shape `CitySelect` has, and the shape this
             * control itself had before VEN-603 (an `<input>` inside the
             * segment). This button is its own focusable element, so it
             * needs the direct variants too: the fill (VEN-603) and, since
             * the old input-child shape carried it and losing it would be a
             * VEN-541 regression (a fill alone is 1.19:1, short of the 3:1
             * floor), the inset ring the fill is backed by.
             */
            'focus-visible:bg-stone-200 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-clay-400',
            'max-sm:w-full max-sm:py-1.5',
            isHero
              ? 'sm:min-w-39.75 sm:flex-[1.2] sm:pr-3.5 sm:pl-3.75 lg:flex-[1.3] lg:pr-0 lg:pl-3.5 min-[90rem]:pl-4.5'
              : 'sm:min-w-36.5 sm:flex-[1.15] sm:pl-3.5',
          )}
        >
          <span
            className={cn(
              'font-semibold tracking-label text-stone-600 uppercase',
              'transition-colors duration-(--duration-fast) group-has-[:focus-visible]/segment:text-clay-600 group-focus-visible/segment:text-clay-600',
              isHero ? 'text-[9.5px] min-[90rem]:text-label' : 'text-[9.5px]',
            )}
          >
            Vendor type
          </span>
          <span
            className={cn(
              'flex min-w-0 items-center justify-between',
              isHero ? 'gap-2 pr-2.5 min-[90rem]:gap-2.5 min-[90rem]:pr-3.5' : 'gap-1.5 pr-2.5',
            )}
          >
            <span
              data-slot="category-value"
              className={cn(
                'min-w-0 truncate',
                isHero ? 'text-[14px] lg:text-[13.5px] min-[90rem]:text-md' : 'text-[13.5px]',
                isHero && 'lg:mt-0.25 min-[90rem]:mt-0.5',
                open
                  ? 'font-semibold text-clay-600'
                  : cn(
                      isHero && 'font-medium lg:font-normal',
                      selected ? 'text-stone-900' : 'text-stone-600',
                    ),
              )}
            >
              {displayLabel}
            </span>
            <DisclosureCaret open={open} size={isHero ? 'hero' : 'compact'} />
          </span>
        </button>
      }
    >
      <DropdownList
        label="Vendor type"
        options={options}
        selected={value === '' ? [] : [value]}
        visibleCount={VISIBLE_ROWS}
        emptyMessage="No vendor types are available right now."
        onSelect={(next) => {
          onChange(next);
          // Commits and closes: a single-select has nothing left to say.
          setOpen(false);
        }}
      />
    </Dropdown>
  );
}

/**
 * The disclosure caret — **the one place in this app that draws it (#426)**.
 *
 * D25 took `▾` off fourteen triggers as a user override of the frames. #426 is
 * the account holder reversing that **for this control on these two surfaces**,
 * verbatim: *"lets add a caret to the vendor type per the design - both to
 * landing and browser - i removed it before but want it back."* The other twelve
 * sites keep the override, and `app/dropdown-caret.test.ts` still fails if the
 * glyph appears in any file but this one.
 *
 * So this is not a parity fix that got missed: on frames `01 Landing` and
 * `02 Search` it **restores** fidelity, and everywhere else D25 still stands.
 *
 * **It flips, and both signals stay.** `42-dropdowns.md` states the open state
 * in writing — *"the value turning clay and the caret flipping"* — and frame
 * `28 Dropdown open — hero` draws exactly that: `Photography` at 600 weight in
 * clay **and** `▴` beside it. So the `font-semibold text-clay-600` D25 gave the
 * value is kept rather than traded away; the two say different things. The
 * caret is the affordance (this opens a list, and here is which way), the clay
 * value is the state (it is open now). Dropping the clay would also have left
 * this segment and City — which draws no caret in any frame and is out of
 * #426's scope — signalling open in two different languages inside one bar.
 *
 * **Never part of an accessible name.** `aria-hidden`, and a sibling of the
 * field rather than text inside it. D25 found two chips whose glyph was in a
 * template literal *inside the button*, so a screen reader announced *"All
 * categories black down-pointing small triangle, button"*. The open state
 * reaches assistive technology through `aria-expanded`, which the field has
 * carried throughout.
 */
const CARETS = { closed: '▾', open: '▴' } as const;

function DisclosureCaret({
  open,
  size,
}: {
  open: boolean;
  size: 'hero' | 'compact';
}): React.ReactElement {
  return (
    <span
      aria-hidden="true"
      className={cn(
        /*
          `flex-none` per `27 Landing — 1024`, which is the one frame that says
          it — the caret must not be the thing that gives up width when "Any
          vendor type" is long. `leading-none` so an 11px glyph does not carry a
          20px line box and grow the row it is centred in.
        */
        'flex-none leading-none',
        /*
          Frame sizes, read at every width the bar is drawn at: hero 11px at 390
          (`14 Landing mobile`), 9px at 768, 10px at 1024, 11px at 1440; compact
          9px at 1440 (`02 Search`). Mobile-first, so the base step is the 390
          value and `sm:` starts the desktop ladder — a `max-sm:` override would
          be the same specificity as the `sm:` one and settle on source order.
        */
        size === 'hero'
          ? 'text-[11px] sm:text-[9px] lg:text-[10px] min-[90rem]:text-[11px]'
          : 'text-[9px]',
        /*
          `stone-600` closed, in every frame that draws it, whether the value
          beside it is placeholder `stone-600` or a chosen `stone-900`. Open, it
          takes the value's own colour.

          `clay-600` rather than the `#B4552F` frame `28` draws: `clay-400` is a
          fill and never text on cream — `01-foundations.md` — and the value it
          sits beside already resolved that the same way in D25's sweep. Two
          clays in one segment would be the drift, not the fidelity.
        */
        open ? 'text-clay-600' : 'text-stone-600',
      )}
    >
      {open ? CARETS.open : CARETS.closed}
    </span>
  );
}
