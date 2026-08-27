'use client';

import {
  vendorNounFor,
  vendorSearchResultSchema,
  VENDOR_SORT_OPTIONS,
  type Category,
  type VendorSearchResult,
  type VendorSortOption,
} from '@vendor-marketplace/shared';
import { SlidersHorizontal, SearchX } from 'lucide-react';
import { NuqsAdapter } from 'nuqs/adapters/next/app';
import { useEffect, useState } from 'react';
import { ApiClientError, apiRequest } from '@/lib/api-client';
import type { WireTag } from '@/lib/wire-schemas';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { VendorCardSkeleton } from '@/components/ui/skeleton';
import { VendorCard } from '@/components/vendors/vendor-card';
import { SearchBar } from './search-bar';
import { SearchFilterRail } from './search-filter-rail';
import {
  activeFilterCount,
  toSearchQuery,
  useSearchState,
  type SearchPatch,
  type SearchState,
} from './search-state';

const SORT_LABELS: Record<VendorSortOption, string> = {
  relevance: 'Most relevant',
  rating: 'Top rated',
  price_asc: 'Price: low to high',
  price_desc: 'Price: high to low',
  newest: 'Newest',
};

/** How many skeletons stand in for a loading grid. */
const SKELETON_COUNT = 6;

const DATE_FORMATTER = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  day: 'numeric',
  timeZone: 'UTC',
});

export interface SearchShellProps {
  categories: readonly Category[];
  tags: readonly WireTag[];
}

/**
 * The two filters most worth loosening, named explicitly rather than as a
 * generic "adjust your filters" — the point is to say which one is costing them
 * results. Ordered by how much each typically narrows a set.
 */
function loosenSuggestion(state: SearchState): string {
  if (state.date && (state.minPriceCents !== null || state.maxPriceCents !== null)) {
    return 'try widening the price range or clearing the date';
  }
  if (state.date) {
    return 'try clearing the date';
  }
  if (state.minPriceCents !== null || state.maxPriceCents !== null) {
    return 'try widening the price range';
  }
  if (state.minRating !== null) {
    return 'try lowering the minimum rating';
  }
  if (state.tags.length > 0) {
    return 'try removing a tag';
  }
  return 'try a different category or city';
}

function SearchScreen({ categories, tags }: SearchShellProps): React.ReactElement {
  const { state, setState, clearAll } = useSearchState();
  const [result, setResult] = useState<VendorSearchResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  /** Below `lg` the rail is a sheet rather than a column beside the results. */
  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false);

  const query = toSearchQuery(state);

  useEffect(() => {
    // An in-flight search for filters the user has already moved past is worse
    // than no search: it would land last and overwrite the current results.
    const controller = new AbortController();

    setIsLoading(true);
    setError(null);

    apiRequest(`/vendors?${query}`, {
      schema: vendorSearchResultSchema,
      token: null,
      signal: controller.signal,
    })
      .then((body) => {
        setResult(body);
        setIsLoading(false);
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) {
          return;
        }
        setError(
          cause instanceof ApiClientError ? cause.message : 'Could not load vendors just now.',
        );
        setIsLoading(false);
      });

    return () => controller.abort();
  }, [query]);

  const selectedCategory = categories.find((category) => category.slug === state.category);
  const tagsById = new Map(tags.map((tag) => [tag.id, tag]));

  /** Every narrowing filter, as a pill that removes itself. */
  const activePills: Array<{ key: string; label: string; clear: SearchPatch }> = [];
  if (state.q) {
    activePills.push({ key: 'q', label: state.q, clear: { q: '' } });
  }
  if (selectedCategory) {
    activePills.push({
      key: 'category',
      label: selectedCategory.name,
      clear: { category: '' },
    });
  }
  if (state.city) {
    activePills.push({ key: 'city', label: state.city, clear: { city: '' } });
  }
  if (state.date) {
    activePills.push({
      key: 'date',
      label: DATE_FORMATTER.format(new Date(`${state.date}T00:00:00Z`)),
      clear: { date: '' },
    });
  }
  if (state.minRating !== null) {
    activePills.push({
      key: 'rating',
      label: `${state.minRating}★+`,
      clear: { minRating: null },
    });
  }
  for (const tagId of state.tags) {
    const tag = tagsById.get(tagId);
    if (tag) {
      activePills.push({
        key: tagId,
        label: tag.name,
        clear: { tags: state.tags.filter((id) => id !== tagId) },
      });
    }
  }

  const filterCount = activeFilterCount(state);
  const total = result?.total ?? 0;
  // "24 photographers in Austin" — the count is about the vendors, not about
  // the category they sell under.
  const heading = `${total} ${vendorNounFor(state.category, total)}${
    state.city ? ` in ${state.city}` : ''
  }`;

  return (
    <div data-app-shell className="flex w-full flex-col lg:app-shell lg:flex-row">
      {/*
        The rail is never behind a button at desktop — filtering is the primary
        activity there. Below `lg` there is no width for a permanent column, so
        it becomes a sheet reached from the sticky bar at the foot of the
        screen: the degradation table calls for that rather than for the rail
        stacking on top of the results and pushing them off-screen.
      */}
      <div
        className={cn(
          'fixed inset-0 z-(--z-drawer) flex flex-col bg-stone-0 lg:static lg:z-auto lg:flex lg:bg-transparent',
          !isFilterSheetOpen && 'hidden',
        )}
      >
        <SearchFilterRail
          state={state}
          setState={setState}
          clearAll={clearAll}
          categories={categories}
          tags={tags}
          facets={result?.facets.categories ?? []}
          activePills={activePills}
          onClose={() => setIsFilterSheetOpen(false)}
        />
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        {/*
          The bar restates the query the results answer, so a customer can
          change their mind without going back to the landing page.
        */}
        <div className="shrink-0 border-b border-stone-200 px-5 py-3 sm:px-8">
          <SearchBar
            value={{ q: state.q, city: state.city, date: state.date }}
            onSubmit={(next) => setState(next)}
            className="max-w-150"
          />
        </div>

        {/* Neither the header nor the rail scrolls; only the grid does. */}
        <div className="flex shrink-0 flex-wrap items-baseline justify-between gap-3 border-b border-stone-300 px-5 py-4 sm:px-8">
          <h1 className="font-display text-[22px] text-stone-900">
            {isLoading && result === null ? 'Finding vendors…' : heading}
            {state.date ? (
              <span className="ml-2.5 font-sans text-base text-stone-600">
                available {DATE_FORMATTER.format(new Date(`${state.date}T00:00:00Z`))}
              </span>
            ) : null}
          </h1>

          <label className="flex items-center gap-2 text-sm text-stone-600">
            Sort
            <select
              value={state.sort}
              onChange={(event) => setState({ sort: event.target.value as VendorSortOption })}
              className="rounded-md border border-stone-300 bg-stone-0 px-3 py-1.75 text-base font-semibold text-stone-900"
            >
              {VENDOR_SORT_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {SORT_LABELS[option]}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="app-pane px-5 py-5 pb-20 sm:px-8 lg:pb-5">
          {error !== null ? (
            <EmptyState icon={<SearchX />} headline="Something went wrong" description={error} />
          ) : isLoading ? (
            // Skeletons swap into the live grid; the rail and header stay put,
            // and there is never a full-page spinner beside them.
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3 min-[100rem]:grid-cols-4">
              {Array.from({ length: SKELETON_COUNT }, (_unused, index) => (
                <VendorCardSkeleton key={index} />
              ))}
            </div>
          ) : total === 0 ? (
            <EmptyState
              icon={<SearchX />}
              headline="No vendors match your search"
              description={`Nothing here yet — ${loosenSuggestion(state)}.`}
              action={
                activeFilterCount(state) > 0 ? (
                  <button
                    type="button"
                    onClick={clearAll}
                    className="text-base font-semibold text-clay-500 underline underline-offset-4 hover:text-clay-600"
                  >
                    Clear every filter
                  </button>
                ) : undefined
              }
            />
          ) : (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3 min-[100rem]:grid-cols-4">
              {result?.items.map((vendor) => (
                <VendorCard
                  key={vendor.id}
                  vendor={vendor}
                  {...(state.date ? { searchedDate: state.date } : {})}
                />
              ))}
            </div>
          )}
        </div>

        {/* The primary action of this screen on a phone: change the filters. */}
        <div className="fixed inset-x-0 bottom-0 z-(--z-sticky) flex items-center gap-3 border-t border-stone-300 bg-stone-0 px-5 py-3 lg:hidden">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="flex-1"
            onClick={() => setIsFilterSheetOpen(true)}
          >
            <SlidersHorizontal aria-hidden="true" />
            Filters{filterCount > 0 ? ` · ${filterCount}` : ''}
          </Button>
        </div>
      </div>
    </div>
  );
}

/** `nuqs` needs its adapter above any component reading query state. */
export function SearchShell(props: SearchShellProps): React.ReactElement {
  return (
    <NuqsAdapter>
      <SearchScreen {...props} />
    </NuqsAdapter>
  );
}
