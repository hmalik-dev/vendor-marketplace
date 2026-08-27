'use client';

import {
  formatPrice,
  TAG_CATEGORIES,
  type Category,
  type CategoryFacet,
} from '@vendor-marketplace/shared';
import { ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { TAG_CATEGORY_LABELS } from '@/components/tags/tag-display';
import type { WireTag } from '@/lib/wire-schemas';
import { cn } from '@/lib/utils';
import type { SearchPatch, SearchState } from './search-state';

/** The rating steps the design offers, in the order it draws them. */
const RATING_STEPS = [
  { label: '4★+', value: 4 },
  { label: '4.5★+', value: 4.5 },
  { label: 'Any', value: null },
] as const;

/** Price bounds the slider spans, in cents. */
const PRICE_FLOOR_CENTS = 0;
const PRICE_CEILING_CENTS = 1_000_000;
const PRICE_STEP_CENTS = 10_000;

/**
 * Groups open by default. Languages, cultural and dietary are long and rarely
 * used, so they start collapsed — see design/design-plan/11-search.md.
 */
const OPEN_BY_DEFAULT = new Set(['category', 'price', 'rating']);

interface FilterGroupProps {
  id: string;
  title: string;
  /** Shown in the header when the group is collapsed. */
  summary?: string;
  children: React.ReactNode;
}

function FilterGroup({ id, title, summary, children }: FilterGroupProps): React.ReactElement {
  const [isOpen, setIsOpen] = useState(OPEN_BY_DEFAULT.has(id));

  return (
    <div className="border-b border-stone-200 py-3.5 last:border-b-0">
      <button
        type="button"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((previous) => !previous)}
        className="flex w-full items-center justify-between gap-2 text-left"
      >
        <span className="text-sm font-semibold text-stone-900">{title}</span>
        <span className="flex items-center gap-2">
          {/* A collapsed group still says what it is doing to the results. */}
          {!isOpen && summary ? <span className="text-xs text-stone-600">{summary}</span> : null}
          <ChevronDown
            aria-hidden="true"
            className={cn(
              'size-4 shrink-0 text-stone-600 transition-transform duration-(--duration-fast)',
              isOpen && 'rotate-180',
            )}
          />
        </span>
      </button>

      {isOpen ? <div className="mt-2.5">{children}</div> : null}
    </div>
  );
}

export interface SearchFilterRailProps {
  /** Below `lg` the rail is a sheet, so it needs a way to close itself. */
  onClose?: () => void;
  state: SearchState;
  setState: (patch: SearchPatch) => void;
  clearAll: () => void;
  categories: readonly Category[];
  tags: readonly WireTag[];
  facets: readonly CategoryFacet[];
  activePills: ReadonlyArray<{ key: string; label: string; clear: SearchPatch }>;
}

export function SearchFilterRail({
  state,
  setState,
  clearAll,
  categories,
  tags,
  facets,
  activePills,
  onClose,
}: SearchFilterRailProps): React.ReactElement {
  const facetByCategory = new Map(facets.map((facet) => [facet.categoryId, facet.count]));
  const selectedCategory = categories.find((category) => category.slug === state.category);

  const toggleTag = (tagId: string): void => {
    setState({
      tags: state.tags.includes(tagId)
        ? state.tags.filter((id) => id !== tagId)
        : [...state.tags, tagId],
    });
  };

  return (
    <aside className="flex min-h-0 flex-1 flex-col border-stone-300 bg-stone-0 lg:w-(--rail-filter) lg:flex-none lg:border-r">
      <div className="flex shrink-0 items-baseline justify-between gap-3 border-b border-stone-200 px-5 py-4">
        <h2 className="text-[14px] font-semibold text-stone-900">Filters</h2>
        <div className="flex items-baseline gap-4">
          {activePills.length > 0 ? (
            <button
              type="button"
              onClick={clearAll}
              className="text-sm font-semibold text-clay-500 underline-offset-4 hover:text-clay-600 hover:underline"
            >
              Clear all
            </button>
          ) : null}
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              className="text-sm font-semibold text-stone-700 lg:hidden"
            >
              Done
            </button>
          ) : null}
        </div>
      </div>

      <div className="app-pane px-5 py-4">
        {activePills.length > 0 ? (
          <ul className="mb-4 flex flex-wrap gap-1.5">
            {activePills.map((pill) => (
              <li key={pill.key}>
                <button
                  type="button"
                  onClick={() => setState(pill.clear)}
                  className="inline-flex items-center gap-1.5 rounded-md bg-clay-100 px-2.5 py-1.5 text-xs font-semibold text-clay-600 hover:bg-clay-200"
                >
                  {pill.label}
                  <span aria-hidden="true">✕</span>
                  <span className="sr-only">Remove this filter</span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        <FilterGroup
          id="category"
          title="Category"
          summary={selectedCategory ? '1 selected' : undefined}
        >
          <ul className="flex flex-col gap-2">
            {categories.map((category) => {
              const isChecked = state.category === category.slug;
              const count = facetByCategory.get(category.id) ?? 0;

              return (
                <li key={category.id}>
                  <label className="flex cursor-pointer items-center gap-2.5 text-base text-stone-700">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => setState({ category: isChecked ? '' : category.slug })}
                      className="size-3.75 shrink-0 rounded-[4px] border-[1.4px] border-stone-400 accent-clay-400"
                    />
                    {category.name}
                    {/* A query result, not marketing — see 98-post-mvp.md. */}
                    <span className="ml-auto text-xs text-stone-600">{count}</span>
                  </label>
                </li>
              );
            })}
          </ul>
        </FilterGroup>

        <FilterGroup
          id="price"
          title="Price range"
          summary={
            state.minPriceCents !== null || state.maxPriceCents !== null ? 'Narrowed' : undefined
          }
        >
          <div className="flex flex-col gap-2">
            <label className="sr-only" htmlFor="minPrice">
              Minimum price
            </label>
            <input
              id="minPrice"
              type="range"
              min={PRICE_FLOOR_CENTS}
              max={PRICE_CEILING_CENTS}
              step={PRICE_STEP_CENTS}
              value={state.minPriceCents ?? PRICE_FLOOR_CENTS}
              onChange={(event) => setState({ minPriceCents: Number(event.target.value) || null })}
              className="h-5 w-full accent-clay-400"
            />
            <label className="sr-only" htmlFor="maxPrice">
              Maximum price
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
        </FilterGroup>

        <FilterGroup
          id="rating"
          title="Minimum rating"
          summary={state.minRating !== null ? `${state.minRating}★+` : undefined}
        >
          <div className="flex gap-1.5">
            {RATING_STEPS.map((step) => {
              const isSelected = state.minRating === step.value;

              return (
                <button
                  key={step.label}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => setState({ minRating: step.value })}
                  className={cn(
                    'flex-1 rounded-md py-1.75 text-center text-xs font-semibold transition-colors duration-(--duration-fast)',
                    isSelected
                      ? 'bg-clay-400 text-stone-0'
                      : 'bg-stone-150 text-stone-700 hover:bg-stone-200',
                  )}
                >
                  {step.label}
                </button>
              );
            })}
          </div>
        </FilterGroup>

        {TAG_CATEGORIES.map((tagCategory) => {
          // Seed `displayOrder`, never alphabetical — the order is the design.
          const options = tags.filter((tag) => tag.category === tagCategory);
          if (options.length === 0) {
            return null;
          }

          const chosen = options.filter((tag) => state.tags.includes(tag.id)).length;

          return (
            <FilterGroup
              key={tagCategory}
              id={tagCategory}
              title={TAG_CATEGORY_LABELS[tagCategory]}
              summary={chosen > 0 ? `${chosen} selected` : undefined}
            >
              <ul className="flex flex-col gap-2">
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
            </FilterGroup>
          );
        })}
      </div>
    </aside>
  );
}
