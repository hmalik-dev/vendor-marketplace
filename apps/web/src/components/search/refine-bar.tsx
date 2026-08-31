'use client';

import {
  formatPrice,
  TAG_CATEGORIES,
  VENDOR_SORT_OPTIONS,
  type CategoryFacet,
  type TagCategory,
  type VendorSortOption,
} from '@vendor-marketplace/shared';
import { useState } from 'react';
import { TAG_CATEGORY_CHIP_LABELS, TAG_CATEGORY_LABELS } from '@/components/tags/tag-display';
import { RangeDropdown, type RangePreset } from '@/components/ui/dropdown-range';
import { MultiSelectDropdown, SingleSelectDropdown } from '@/components/ui/dropdown-select';
import type { WireTag } from '@/lib/wire-schemas';
import { cn } from '@/lib/utils';
import type { SearchPatch, SearchState } from './search-state';

/**
 * One horizontal bar of dropdown chips, in place of the 280px filter rail.
 *
 * The rail held a permanent column of the viewport for controls touched once or
 * twice a session and capped results at three across; the bar returns that
 * width to what the page is for — eight vendors instead of three. This is the
 * one place the "a persistent rail beats a modal" law yields, because search
 * filters are set and then left alone rather than referred back to. Decision D7
 * and design/design-plan/11-search.md.
 *
 * **The Refine bar holds refinements only.** Vendor type, city and date belong
 * to the search bar above it; echoing any of them here would be a second
 * control for one value, which is the defect this redesign removed.
 */

/** The rating steps the design offers, in the order it draws them. */
const RATING_STEPS = [
  { label: '4★ & up', value: 4 },
  { label: '4.5★ & up', value: 4.5 },
  { label: 'Any rating', value: null },
] as const;

/**
 * Price bounds the range spans, in cents.
 *
 * No step any more: the bounds are typed, not dragged, so there is nothing to
 * quantise. The slider that needed one is a readout now (#167).
 */
const PRICE_FLOOR_CENTS = 0;
const PRICE_CEILING_CENTS = 1_000_000;

const SORT_LABELS: Record<VendorSortOption, string> = {
  relevance: 'Most relevant',
  rating: 'Top rated',
  price_asc: 'Price: low to high',
  price_desc: 'Price: high to low',
  newest: 'Newest',
};

/**
 * The three chip states the design distinguishes:
 *
 * - `resting` — no value, `stone-0` fill. The frames draw a `▾` here;
 *   D25 removed it from every trigger, and `chipWrapper`'s `open` argument is
 *   what replaced the open-state signal it was carrying.
 * - `valued` — carries a live value that isn't narrowing anything on its own
 *   (the price range), `stone-150` fill.
 * - `active` — genuinely excluding vendors, `clay-100` fill / `clay-600` text,
 *   and an `✕` that clears it. This is what replaces the separate
 *   active-filter pill row: one chip, one state, one place to undo it.
 */
type ChipTone = 'resting' | 'valued' | 'active';

const CHIP_TONES: Record<ChipTone, string> = {
  resting: 'border-stone-300 bg-stone-0 text-stone-900 hover:bg-stone-150',
  valued: 'border-stone-300 bg-stone-150 text-stone-900 hover:bg-stone-200',
  active: 'border-clay-200 bg-clay-100 text-clay-600',
};

/**
 * The chip is frame `02`'s and is unchanged. **What hangs off it is not.**
 *
 * Every panel on this bar used to be its own thing: two applied on click, two
 * applied on nothing at all, and the Languages one grew to 719px and could not
 * be reached at 1024 or 390. They are now the four bodies of the one dropdown
 * (#167), so the chip keeps only its own geometry and lets each filter pick a
 * body.
 */
/**
 * `open` darkens the chip's own edge to clay.
 *
 * The open state used to be carried by the caret turning `text-clay-400`, and
 * D25 removed the caret — which left every chip on this bar rendering
 * byte-identically open and closed. `aria-expanded` still flipped, so the state
 * was announced to a screen reader and drawn for nobody. Found in the browser,
 * not in review: the class strings were unchanged, so nothing in the diff
 * looked wrong.
 *
 * The border rather than the fill, because the fill is already the tone's job —
 * `active` is `clay-100` and `valued` is `stone-150`, so an open cue on the fill
 * would either collide with those or have to vary by tone. It is also the
 * app's own idiom for a bordered control: `03-components.md` puts focus on a
 * standalone bordered field as `border-clay-400`, on the reasoning that an
 * element with an edge signals through that edge.
 */
function chipWrapper(tone: ChipTone, open: boolean): string {
  return cn(
    'flex items-center rounded-md border text-[12.5px] font-semibold transition-colors duration-(--duration-fast)',
    CHIP_TONES[tone],
    open && 'border-clay-400',
  );
}

/**
 * The trigger half. An active chip's trigger ends flush with its label, and the
 * 6px that used to sit here moves to the clear button's `pl` instead: the paint
 * is identical — the gap is the same 10px either way — but the width now
 * belongs to the box that needs it, for the hit area below.
 */
function chipTrigger(hasClear: boolean): string {
  return cn('flex items-center gap-1.5 py-1.75 pl-3.25', hasClear ? 'pr-0' : 'pr-3.25');
}

/** The `✕` that clears an active chip. */
function ChipClear({ label, onClear }: { label: string; onClear: () => void }): React.ReactElement {
  return (
    <button
      type="button"
      onClick={onClear}
      className={cn(
        'relative py-1.75 pr-2.75 pl-2.5 hover:text-clay-500',
        /*
          `04-laws.md`: an icon-only control carries a 44x44 hit area. Its only
          visible content is the glyph — the name is `sr-only` — so the rule
          applies, and the paint measured 24.5 x 29 (#245).

          The target grows past the paint rather than the paint growing: the
          chip's own geometry is the frame's (`padding:7px 13px`), so widening
          the *chip* would fail the Style axis to pass the Access one. What can
          move without repainting anything is where the 6px between the label
          and the glyph is charged — see `chipTrigger` above.

          Anchored to the **right**, not centred, because that side is free: the
          chip row is `gap-2`, so the target reaches 8px into the gutter and
          stops ~2px short of the next chip. Budget, measured in Chromium at
          1440: 30.5px button + 8px gutter = 38.5, so **5.5px falls left onto
          the trigger**.

          That 5.5px is a real overlap, not a claim of clearance: a click there
          clears the filter instead of opening the panel. It is the floor, not a
          choice — 44 is wider than the chip's whole right side — and it is what
          the padding shift bought, down from the 11.47px measured before it.
          Centring instead would put 19.5px there. The only ways to reach zero
          are a taller chip or a 44px-wide glyph button, and both repaint a
          control the frame draws exactly; that is a frame question, filed
          rather than guessed.
        */
        "after:absolute after:top-1/2 after:-right-2 after:size-11 after:-translate-y-1/2 after:content-['']",
      )}
    >
      <span aria-hidden="true">✕</span>
      <span className="sr-only">Clear {label}</span>
    </button>
  );
}

/** Cents per dollar. Named, so neither direction below reads as a magic 100. */
const CENTS_PER_DOLLAR = 100;

/**
 * What the reader typed, as cents. `$1,800` and `1800` both mean 180,000.
 *
 * Digits only: a stray `$`, comma or space is what someone pasting a price
 * writes, and refusing it would be pedantry. A decimal is dropped with them —
 * nobody filters a vendor's starting rate to the cent, and a half-typed `1.` is
 * a state the field would otherwise have to render as an error.
 */
function dollarsToCents(raw: string): number | null {
  const digits = raw.replace(/[^\d]/g, '');

  return digits === '' ? null : Number.parseInt(digits, 10) * CENTS_PER_DOLLAR;
}

/** The stored cents back to the dollars the reader would have typed. */
function centsToDollars(cents: number): string {
  return String(Math.round(cents / CENTS_PER_DOLLAR));
}

/**
 * The price presets frame `28` draws, in cents.
 *
 * Presets first because they are the common case — "under a thousand" is one
 * press, where the same answer typed is eight keystrokes and a decision about
 * whether to include the comma.
 */
const PRICE_PRESETS: readonly RangePreset[] = [
  { label: 'Under $1k', min: null, max: 100_000 },
  { label: '$1–2k', min: 100_000, max: 200_000 },
  { label: '$2–4k', min: 200_000, max: 400_000 },
  { label: '$4k+', min: 400_000, max: null },
];

export interface RefineBarProps {
  state: SearchState;
  setState: (patch: SearchPatch) => void;
  clearRefinements: () => void;
  tags: readonly WireTag[];
  /** Per-option counts, shown inside the popover beside the option. */
  facets: readonly CategoryFacet[];
  className?: string;
}

export function RefineBar({
  state,
  setState,
  clearRefinements,
  tags,
  className,
}: RefineBarProps): React.ReactElement {
  /*
   * One open chip at a time, held here rather than in each chip.
   *
   * Six panels over one results grid: opening a second while the first was
   * still up put two of them over the answer they had just changed. Radix
   * dismisses on an outside click, but a click on the *next chip* opens that
   * one in the same gesture, so the two were briefly both open.
   */
  const [openChip, setOpenChip] = useState<string | null>(null);

  /**
   * One chip's open/close, written so that closing cannot cancel an opening.
   *
   * Clicking chip B while chip A is open fires both: Radix dismisses A on the
   * pointer-down and B's trigger opens on the click, and if A's close lands
   * second it wipes B straight back out. The panel then took **two clicks** to
   * move between chips. A close only clears the shared state when the chip
   * closing is the one currently in it.
   */
  const chipOpen = (key: string) => (next: boolean) =>
    setOpenChip((current) => (next ? key : current === key ? null : current));

  const hasPrice = state.minPriceCents !== null || state.maxPriceCents !== null;
  const priceLabel = hasPrice
    ? `${formatPrice(state.minPriceCents ?? PRICE_FLOOR_CENTS)} – ${
        state.maxPriceCents === null
          ? `${formatPrice(PRICE_CEILING_CENTS)}+`
          : formatPrice(state.maxPriceCents)
      }`
    : 'Price';

  const ratingStep = RATING_STEPS.find((step) => step.value === state.minRating);
  const ratingLabel = state.minRating === null ? 'Rating' : (ratingStep?.label ?? 'Rating');

  const tagChip = (tagCategory: TagCategory): React.ReactElement | null => {
    /*
     * Seed `displayOrder`, never alphabetical — the order is the design.
     *
     * Every group is global, so the option set does not change with the selected
     * vendor type. `style` was the exception until #329 removed it; a chip with
     * nothing to offer still renders as absent rather than empty, which is what
     * an inactive group would otherwise look like.
     */
    const options = tags.filter((tag) => tag.category === tagCategory);
    if (options.length === 0) {
      return null;
    }

    const chosen = options.filter((tag) => state.tags.includes(tag.id));
    // The chip carries the short label the frame draws; the popover heading
    // keeps the full one, where there is room to be precise.
    const base = TAG_CATEGORY_CHIP_LABELS[tagCategory];

    const hasChosen = chosen.length > 0;
    const open = openChip === tagCategory;

    return (
      <span key={tagCategory} className={chipWrapper(hasChosen ? 'active' : 'resting', open)}>
        {/*
          Multi-select, and it **applies on Apply** rather than per tick. Three
          of these chips filter the same grid; ticking three languages used to
          re-query and re-sort three times, moving the list under the hand that
          was still choosing.
        */}
        <MultiSelectDropdown
          open={open}
          onOpenChange={chipOpen(tagCategory)}
          label={TAG_CATEGORY_LABELS[tagCategory]}
          density="compact"
          options={options.map((tag) => ({ value: tag.id, label: tag.name }))}
          value={chosen.map((tag) => tag.id)}
          onApply={(next) =>
            setState({
              // Only this group's ids are replaced; the other two chips'
              // selections are not this panel's to discard.
              tags: [...state.tags.filter((id) => !options.some((tag) => tag.id === id)), ...next],
            })
          }
          trigger={
            <button type="button" className={chipTrigger(hasChosen)}>
              {hasChosen ? `${base} · ${chosen.length}` : base}
            </button>
          }
        />
        {hasChosen ? (
          <ChipClear
            label={base}
            onClear={() =>
              setState({ tags: state.tags.filter((id) => !options.some((tag) => tag.id === id)) })
            }
          />
        ) : null}
      </span>
    );
  };

  const hasAnyRefinement = hasPrice || state.minRating !== null || state.tags.length > 0;

  return (
    /*
      Two groups, not one wrapping row. `30-responsive.md`: a wrapping row
      wraps for width, never for alignment — an item pushed right with an auto
      margin must not strand a sibling on a second row that had space for it.
      With `Sort` inside the wrap and carrying `ml-auto`, its own margin ate
      the line's free space, so the row's break point depended on where the
      right-aligned item wanted to sit rather than on how wide the chips were.

      The chips now wrap among themselves and `Sort` is a separate, unwrapping
      sibling held right by the group's `flex-1`. Below `lg` the bar is inside
      the filter sheet, where the two stack instead.
    */
    <div
      className={cn(
        'flex shrink-0 flex-col gap-3 border-b border-stone-300 bg-stone-0 px-6.5 py-2.75 lg:flex-row lg:items-center lg:gap-4',
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-2 lg:min-w-0 lg:flex-1">
        {/*
          `text-xs`, not `text-label`: frame `02` draws this one inline at 11px
          rather than through `.lbl`, and it is the 1440 parity target. The
          `.lbl`-based `Refine` at 10px belongs to `27 Small laptop — 1024`.
        */}
        <span className="mr-0.5 text-xs font-semibold tracking-label text-stone-600 uppercase">
          Refine
        </span>

        {/*
        The price chip's label always carries the live range and it keeps its
        caret — a range is a value you adjust, not a filter you tick off, so
        there is nothing an `✕` would mean here that dragging back to the ends
        doesn't already say.
      */}
        <span className={chipWrapper(hasPrice ? 'valued' : 'resting', openChip === 'price')}>
          {/*
            Presets, then typed bounds, then a slider that is only a readout.
            Two bare `input[type=range]` sliders stood here: a budget is a
            number someone already knows, and dragging a 0–$10,000 track in
            $100 steps to reach $1,800 is not how anyone says that.
          */}
          <RangeDropdown
            open={openChip === 'price'}
            onOpenChange={chipOpen('price')}
            label="Price"
            caption="starting rate"
            value={{ min: state.minPriceCents, max: state.maxPriceCents }}
            presets={PRICE_PRESETS}
            bounds={{ min: PRICE_FLOOR_CENTS, max: PRICE_CEILING_CENTS }}
            /*
              Money is integer cents everywhere and dollars only at the display
              boundary — `shared-contracts.md`. This is that boundary: the
              reader types dollars, the filter stores cents, and these three
              functions are the whole of the conversion.
            */
            format={formatPrice}
            parse={dollarsToCents}
            toEditable={centsToDollars}
            onApply={(next) => setState({ minPriceCents: next.min, maxPriceCents: next.max })}
            trigger={
              <button type="button" className={chipTrigger(false)}>
                {priceLabel}
              </button>
            }
          />
        </span>

        {/*
          Single-select, so the choice completes the panel and the panel closes
          — the same contract `Sort` already keeps. Left open, the 280x147 panel
          sat over the results heading and the first result card, hiding the
          answer to the question it had just been asked.
        */}
        <span
          className={chipWrapper(
            state.minRating !== null ? 'active' : 'resting',
            openChip === 'rating',
          )}
        >
          <SingleSelectDropdown
            open={openChip === 'rating'}
            onOpenChange={chipOpen('rating')}
            label="Minimum rating"

            density="compact"
            options={RATING_STEPS.map((step) => ({
              value: String(step.value),
              label: step.label,
            }))}
            value={String(state.minRating)}
            onChange={(next) => setState({ minRating: next === 'null' ? null : Number(next) })}
            trigger={
              <button type="button" className={chipTrigger(state.minRating !== null)}>
                {ratingLabel}
              </button>
            }
          />
          {state.minRating !== null ? (
            <ChipClear label={ratingLabel} onClear={() => setState({ minRating: null })} />
          ) : null}
        </span>

        {/*
          Five chips, in the frame's order: Price and Rating above, then
          Languages, Cultural and Dietary from `TAG_CATEGORIES`. A sixth,
          `Style ▾`, shipped in #281 and came out in #329 when Style was ruled
          out of the MVP — frames `02`, `17`, `27` and `28` draw five.
        */}
        {TAG_CATEGORIES.map(tagChip)}

        {hasAnyRefinement ? (
          <button
            type="button"
            onClick={clearRefinements}
            className="px-1.5 py-1.75 text-[12.5px] font-semibold text-clay-500 hover:text-clay-600 hover:underline"
          >
            Clear
          </button>
        ) : null}
      </div>

      {/*
        A chip, not a native `select`. Frame `02` draws the word `Sort` in
        `stone-600` beside a resting chip carrying the chosen option and a `▾`
        — the same object as every other control on this bar, which a native
        select cannot be: the platform sizes and positions it itself, so it
        rendered 148x33 where the frame draws 92x31 and sat 56px left of where
        the frame puts it.

        The name lives outside the chip, so the trigger is named explicitly
        rather than announcing a bare value.
      */}
      <div className="flex shrink-0 items-center gap-2 text-[12.5px] text-stone-600">
        Sort
        <span className={chipWrapper('resting', openChip === 'sort')}>
          <SingleSelectDropdown
            open={openChip === 'sort'}
            onOpenChange={chipOpen('sort')}
            label="Sort by"

            density="compact"
            options={VENDOR_SORT_OPTIONS.map((option) => ({
              value: option,
              label: SORT_LABELS[option],
            }))}
            value={state.sort}
            onChange={(next) => setState({ sort: next as VendorSortOption })}
            trigger={
              <button
                type="button"
                /* The name lives outside the chip, so the trigger would
                   otherwise announce a bare value. */
                aria-label={`Sort: ${SORT_LABELS[state.sort]}`}
                className={chipTrigger(false)}
              >
                {SORT_LABELS[state.sort]}
              </button>
            }
          />
        </span>
      </div>
    </div>
  );
}
