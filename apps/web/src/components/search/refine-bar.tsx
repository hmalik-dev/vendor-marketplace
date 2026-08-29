'use client';

import {
  formatPrice,
  TAG_CATEGORIES,
  VENDOR_SORT_OPTIONS,
  type CategoryFacet,
  type TagCategory,
  type VendorSortOption,
} from '@vendor-marketplace/shared';
import { TAG_CATEGORY_CHIP_LABELS, TAG_CATEGORY_LABELS } from '@/components/tags/tag-display';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
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

/** Price bounds the range spans, in cents. */
const PRICE_FLOOR_CENTS = 0;
const PRICE_CEILING_CENTS = 1_000_000;
const PRICE_STEP_CENTS = 10_000;

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
 * - `resting` — no value, `stone-0` fill, `▾`.
 * - `valued` — carries a live value that isn't narrowing anything on its own
 *   (the price range), `stone-150` fill, still `▾`.
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

interface ChipProps {
  label: string;
  tone?: ChipTone;
  /** Present only on an `active` chip; renders the `✕` that clears it. */
  onClear?: () => void;
  children: React.ReactNode;
}

function Chip({ label, tone = 'resting', onClear, children }: ChipProps): React.ReactElement {
  return (
    <span
      className={cn(
        'flex items-center rounded-md border text-[12.5px] font-semibold transition-colors duration-(--duration-fast)',
        CHIP_TONES[tone],
      )}
    >
      <Popover>
        <PopoverTrigger
          className={cn(
            'flex items-center gap-1.5 py-1.75 pl-3.25',
            onClear ? 'pr-1.5' : 'pr-3.25',
          )}
        >
          {label}
          {onClear ? null : <span aria-hidden="true">▾</span>}
        </PopoverTrigger>
        <PopoverContent align="start" className="w-70">
          {children}
        </PopoverContent>
      </Popover>

      {onClear ? (
        <button
          type="button"
          onClick={onClear}
          className="py-1.75 pr-2.75 pl-1 hover:text-clay-500"
        >
          <span aria-hidden="true">✕</span>
          <span className="sr-only">Clear {label}</span>
        </button>
      ) : null}
    </span>
  );
}

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

  const toggleTag = (tagId: string): void => {
    setState({
      tags: state.tags.includes(tagId)
        ? state.tags.filter((id) => id !== tagId)
        : [...state.tags, tagId],
    });
  };

  const tagChip = (tagCategory: TagCategory): React.ReactElement | null => {
    // Seed `displayOrder`, never alphabetical — the order is the design.
    const options = tags.filter((tag) => tag.category === tagCategory);
    if (options.length === 0) {
      return null;
    }

    const chosen = options.filter((tag) => state.tags.includes(tag.id));
    // The chip carries the short label the frame draws; the popover heading
    // keeps the full one, where there is room to be precise.
    const base = TAG_CATEGORY_CHIP_LABELS[tagCategory];

    return (
      <Chip
        key={tagCategory}
        label={chosen.length === 0 ? base : `${base} · ${chosen.length}`}
        tone={chosen.length > 0 ? 'active' : 'resting'}
        {...(chosen.length > 0
          ? {
              onClear: () =>
                setState({
                  tags: state.tags.filter((id) => !options.some((tag) => tag.id === id)),
                }),
            }
          : {})}
      >
        <fieldset>
          <legend className="text-sm font-semibold text-stone-900">
            {TAG_CATEGORY_LABELS[tagCategory]}
          </legend>
          <ul className="mt-2 flex flex-col gap-2">
            {options.map((tag) => (
              <li key={tag.id}>
                <label className="flex cursor-pointer items-center gap-2.5 text-base text-stone-700">
                  <input
                    type="checkbox"
                    checked={state.tags.includes(tag.id)}
                    onChange={() => toggleTag(tag.id)}
                    className="size-3.75 shrink-0 rounded-[4px] border-[1.4px] border-stone-400 accent-clay-400"
                  />
                  {tag.name}
                </label>
              </li>
            ))}
          </ul>
        </fieldset>
      </Chip>
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
        <Chip label={priceLabel} tone={hasPrice ? 'valued' : 'resting'}>
          <fieldset>
            <legend className="text-sm font-semibold text-stone-900">Price range</legend>
            <div className="mt-2 flex flex-col gap-2">
              <label className="text-xs text-stone-600" htmlFor="minPrice">
                Minimum
              </label>
              <input
                id="minPrice"
                type="range"
                min={PRICE_FLOOR_CENTS}
                max={PRICE_CEILING_CENTS}
                step={PRICE_STEP_CENTS}
                value={state.minPriceCents ?? PRICE_FLOOR_CENTS}
                onChange={(event) =>
                  setState({ minPriceCents: Number(event.target.value) || null })
                }
                className="h-5 w-full accent-clay-400"
              />
              <label className="text-xs text-stone-600" htmlFor="maxPrice">
                Maximum
              </label>
              <input
                id="maxPrice"
                type="range"
                min={PRICE_FLOOR_CENTS}
                max={PRICE_CEILING_CENTS}
                step={PRICE_STEP_CENTS}
                value={state.maxPriceCents ?? PRICE_CEILING_CENTS}
                onChange={(event) =>
                  setState({
                    maxPriceCents:
                      Number(event.target.value) === PRICE_CEILING_CENTS
                        ? null
                        : Number(event.target.value),
                  })
                }
                className="h-5 w-full accent-clay-400"
              />
              <div className="flex justify-between text-xs text-stone-600">
                <span>{formatPrice(state.minPriceCents ?? PRICE_FLOOR_CENTS)}</span>
                <span>
                  {state.maxPriceCents === null
                    ? `${formatPrice(PRICE_CEILING_CENTS)}+`
                    : formatPrice(state.maxPriceCents)}
                </span>
              </div>
            </div>
          </fieldset>
        </Chip>

        <Chip
          label={ratingLabel}
          tone={state.minRating !== null ? 'active' : 'resting'}
          {...(state.minRating !== null ? { onClear: () => setState({ minRating: null }) } : {})}
        >
          <fieldset>
            <legend className="text-sm font-semibold text-stone-900">Minimum rating</legend>
            <div className="mt-2 flex flex-col gap-1.5">
              {RATING_STEPS.map((step) => (
                <button
                  key={step.label}
                  type="button"
                  aria-pressed={state.minRating === step.value}
                  onClick={() => setState({ minRating: step.value })}
                  className={cn(
                    'rounded-md py-1.75 text-center text-xs font-semibold transition-colors duration-(--duration-fast)',
                    state.minRating === step.value
                      ? 'bg-clay-400 text-stone-0'
                      : 'bg-stone-150 text-stone-700 hover:bg-stone-200',
                  )}
                >
                  {step.label}
                </button>
              ))}
            </div>
          </fieldset>
        </Chip>

        {TAG_CATEGORIES.map(tagChip)}

        {/*
        Frame `02` also draws a `Style ▾` chip — category-specific tags whose
        option set changes with the selected vendor type (documentary,
        editorial, …). There is no `style` tag category in the data model and no
        link from a tag to a vendor category, so the chip has nothing to offer
        yet. Seeding a style taxonomy for eleven categories is a product
        decision, not a rendering one, so it is a ticket of its own (#25) rather
        than invented here. Recorded as a named deviation from the frame.
      */}

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

      <label className="flex shrink-0 items-center gap-2 text-[12.5px] text-stone-600">
        Sort
        <select
          value={state.sort}
          onChange={(event) => setState({ sort: event.target.value as VendorSortOption })}
          className="rounded-md border border-stone-300 bg-stone-0 px-3.25 py-1.75 text-[12.5px] font-semibold text-stone-900"
        >
          {VENDOR_SORT_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {SORT_LABELS[option]}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
