'use client';

import {
  vendorNounFor,
  vendorSearchResultSchema,
  type Category,
  type VendorSearchResult,
} from '@vendor-marketplace/shared';
import { SlidersHorizontal, SearchX } from 'lucide-react';
import { useEffect, useState } from 'react';
import { ApiClientError, apiRequest } from '@/lib/api-client';
import type { WireTag } from '@/lib/wire-schemas';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { VendorCardSkeleton } from '@/components/ui/skeleton';
import { VendorCard } from '@/components/vendors/vendor-card';
import { NameSearch } from './name-search';
import { RefineBar } from './refine-bar';
import { SearchBar } from './search-bar';
import { activeRefineCount, toSearchQuery, useSearchState, type SearchState } from './search-state';

/**
 * How many skeletons stand in for a loading grid — two full rows of four, the
 * same number of cards the frame shows above the fold.
 */
const SKELETON_COUNT = 8;

/** Four across at the reference viewport; the grid gains columns, not margins. */
const GRID_COLUMNS =
  'grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 min-[90rem]:grid-cols-4 min-[108rem]:grid-cols-5';

/** "free on Sun, Jun 14" — the weekday is what makes a date legible at a glance. */
const AVAILABILITY_DATE_FORMATTER = new Intl.DateTimeFormat('en-US', {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
});

export interface SearchShellProps {
  categories: readonly Category[];
  tags: readonly WireTag[];
}

/**
 * The two refinements most worth loosening, named explicitly rather than as a
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
  if (state.name) {
    return 'try checking the spelling, or search by vendor type instead';
  }
  return 'try a different vendor type or city';
}

function SearchScreen({ categories, tags }: SearchShellProps): React.ReactElement {
  const { state, setState, clearRefinements } = useSearchState();
  const [result, setResult] = useState<VendorSearchResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  /** Below `lg` the Refine chips collapse into a sheet. The query never does. */
  const [isRefineSheetOpen, setIsRefineSheetOpen] = useState(false);

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

  const refineCount = activeRefineCount(state);
  const total = result?.total ?? 0;
  // "24 photographers in Austin" — the count is about the vendors, not about
  // the category they sell under.
  const heading = `${total} ${vendorNounFor(state.category, total)}${
    state.city ? ` in ${state.city}` : ''
  }`;

  return (
    <div data-app-shell className="flex w-full min-w-0 flex-col lg:app-shell">
      {/*
        The tablet and mobile home for the query — frame `14`. From `lg` the
        bar lives in the header instead (frame `02`), so this row is hidden
        rather than duplicated; both read the same `nuqs` params, so whichever
        one is on screen is showing the same query.
      */}
      <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-stone-200 px-5 py-3 sm:px-6.5 lg:hidden">
        <SearchBar
          categories={categories}
          value={{ category: state.category, city: state.city, date: state.date }}
          onSubmit={(next) => setState(next)}
          className="w-full min-w-0 sm:flex-1 sm:max-w-140"
        />
        <NameSearch value={state.name} onSubmit={(name) => setState({ name })} />
      </div>

      {/*
        One control per value: refinements only. Vendor type, city and date are
        owned by the bar above and never appear here — the date not at any
        width. Below `lg` the chips move into a sheet behind the sticky trigger.
      */}
      {/* Backdrop — bottom sheets on mobile, never a full-screen takeover. */}
      {isRefineSheetOpen ? (
        <button
          type="button"
          aria-label="Close filters"
          onClick={() => setIsRefineSheetOpen(false)}
          className="fixed inset-0 z-(--z-drawer) bg-stone-900/40 lg:hidden"
        />
      ) : null}

      <div
        className={cn(
          'bg-stone-0',
          'max-lg:fixed max-lg:inset-x-0 max-lg:bottom-0 max-lg:z-(--z-drawer) max-lg:max-h-[85vh] max-lg:overflow-y-auto max-lg:rounded-t-2xl max-lg:px-4 max-lg:pt-2 max-lg:pb-4',
          !isRefineSheetOpen && 'max-lg:hidden',
        )}
      >
        {/* Drag handle — the affordance that says this panel came from below. */}
        <div
          aria-hidden="true"
          className="mx-auto mb-3 h-1 w-9 rounded-full bg-stone-300 lg:hidden"
        />

        <RefineBar
          state={state}
          setState={setState}
          clearRefinements={clearRefinements}
          tags={tags}
          facets={result?.facets.categories ?? []}
          className="w-full max-lg:border-b-0 max-lg:px-0 max-lg:py-0"
        />

        <button
          type="button"
          onClick={() => setIsRefineSheetOpen(false)}
          className="mt-4 min-h-11 w-full rounded-lg bg-stone-900 text-base font-semibold text-stone-50 lg:hidden"
        >
          Show {total} results
        </button>
      </div>

      {/* Neither the query bar nor the Refine bar scrolls; only the grid does. */}
      <div className="flex shrink-0 flex-wrap items-baseline justify-between gap-x-6 gap-y-1 px-5 pt-3.75 pb-2.75 sm:px-6.5">
        <h1 className="font-display text-[22px] text-stone-900">
          {isLoading && result === null ? 'Finding vendors…' : heading}
          {state.date ? (
            <span className="ml-2.5 font-sans text-[13px] text-stone-600">
              free on {AVAILABILITY_DATE_FORMATTER.format(new Date(`${state.date}T00:00:00Z`))}
            </span>
          ) : null}
        </h1>

        {/*
          Not a statistic — a statement about how the marketplace works, which
          is true on day one. See design/design-plan/98-post-mvp.md.
        */}
        <p className="text-[12.5px] text-stone-600">
          Prices are what they charge — no quotes needed
        </p>
      </div>

      <div className="app-pane px-5 pb-20 sm:px-6.5 lg:pb-4">
        {error !== null ? (
          <EmptyState icon={<SearchX />} headline="Something went wrong" description={error} />
        ) : isLoading ? (
          // Skeletons swap into the live grid; the bars stay put, and there is
          // never a full-page spinner beside them.
          <div className={GRID_COLUMNS}>
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
              refineCount > 0 ? (
                <button
                  type="button"
                  onClick={clearRefinements}
                  className="text-base font-semibold text-clay-500 underline underline-offset-4 hover:text-clay-600"
                >
                  Clear every refinement
                </button>
              ) : undefined
            }
          />
        ) : (
          <div className={GRID_COLUMNS}>
            {result?.items.map((vendor) => (
              <VendorCard
                key={vendor.id}
                vendor={vendor}
                density="compact"
                {...(state.date ? { searchedDate: state.date } : {})}
              />
            ))}
          </div>
        )}
      </div>

      {/* The primary action of this screen on a phone: refine. */}
      <div className="fixed inset-x-0 bottom-0 z-(--z-sticky) flex items-center gap-3 border-t border-stone-300 bg-stone-0 px-5 py-3 lg:hidden">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          // Touch targets are ≥44px at 768 and 390 — see 30-responsive.md.
          className="min-h-11 flex-1"
          onClick={() => setIsRefineSheetOpen(true)}
        >
          <SlidersHorizontal aria-hidden="true" />
          Filters{refineCount > 0 ? ` · ${refineCount}` : ''}
        </Button>
      </div>
    </div>
  );
}

/**
 * The adapter `nuqs` needs lives in the root layout, because the header's copy
 * of the query bar reads the same params from outside this tree.
 */
export function SearchShell(props: SearchShellProps): React.ReactElement {
  return <SearchScreen {...props} />;
}
