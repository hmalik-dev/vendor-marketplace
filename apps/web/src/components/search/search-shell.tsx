'use client';

import {
  isPastDate,
  todayDateString,
  vendorNounFor,
  type Category,
  type VendorSearchResult,
} from '@vendor-marketplace/shared';
import { wireVendorSearchResultSchema } from '@/lib/wire-schemas';
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
import { NearbyDatesBand } from './nearby-dates-band';
import { useSearchStatus } from './search-status';
import { noResultsDiagnosis, noResultsHeadline, relaxations } from './relaxations';
import { activeRefineCount, toSearchQuery, useSearchState, type SearchState } from './search-state';

/**
 * How many skeletons stand in for a loading grid — two full rows of four, the
 * same number of cards the frame shows above the fold.
 */
const SKELETON_COUNT = 8;

/**
 * The grid gains columns, not margins.
 *
 * **Three across from `lg`**, which is the `25 Search results — 1024` frame:
 * 1024 is a 13" laptop, and it gets the desktop composition with a column
 * removed rather than the two-column tablet one. The gap follows the frames —
 * 14px at 1024, 16px at 1440.
 */
const GRID_COLUMNS =
  'grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3 min-[90rem]:grid-cols-4 min-[90rem]:gap-4 min-[108rem]:grid-cols-5';

/**
 * Two full rows of skeletons, which is `columns × 2` — 8 at 1440 and 6 at 1024,
 * as the two loading frames draw them. The count is fixed and the surplus is
 * hidden in CSS, because the column count is a media query and this component
 * renders on the server where there is no viewport to read.
 */
const SKELETONS_BEYOND_TWO_ROWS_AT_1024 = 'max-[90rem]:hidden';

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
 * The count line while a search is in flight — frame `17`.
 *
 * Never a stale number and never an invented one: the previous result set's
 * count is about a query the customer has already changed, and "0 vendors"
 * before the answer arrives reads as an empty market. It says what is
 * happening instead, and names the query where the query is known.
 */
function searchingLine(state: SearchState): string {
  const noun = state.category === '' ? '' : vendorNounFor(state.category, 0);
  const where = state.city === '' ? '' : ` in ${state.city}`;

  if (noun === '' && where === '') {
    return 'Searching…';
  }

  return `Searching ${noun === '' ? 'vendors' : noun}${where}…`;
}

function SearchScreen({ categories, tags }: SearchShellProps): React.ReactElement {
  const { state, setState, clearRefinements } = useSearchState();
  const [result, setResult] = useState<VendorSearchResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  /** Below `lg` the Refine chips collapse into a sheet. The query never does. */
  const [isRefineSheetOpen, setIsRefineSheetOpen] = useState(false);
  /*
   * Published so the compact bar in the header can show the wait in its own
   * control — frames `17` and `25 — loading`. The results own the fetch; the
   * bar is a sibling on the far side of the layout.
   */
  const { setSearching } = useSearchStatus();

  const query = toSearchQuery(state);

  useEffect(() => {
    // An in-flight search for filters the user has already moved past is worse
    // than no search: it would land last and overwrite the current results.
    const controller = new AbortController();

    setIsLoading(true);
    setSearching(true);
    setError(null);

    apiRequest(`/vendors?${query}`, {
      schema: wireVendorSearchResultSchema,
      token: null,
      signal: controller.signal,
    })
      .then((body) => {
        setResult(body);
        setIsLoading(false);
        setSearching(false);
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) {
          return;
        }
        setError(
          cause instanceof ApiClientError ? cause.message : 'Could not load vendors just now.',
        );
        setIsLoading(false);
        setSearching(false);
      });

    return () => controller.abort();
    // `setSearching` is stable — `useState`'s setter — so it is safe to leave
    // out; including it would not change when this runs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  /*
   * A shared or bookmarked link can carry a date that has since passed —
   * `?date=` is just a string in a URL, and a link sent in March is opened in
   * July. Availability is only recorded forward, so such a query asks about a
   * day the calendar has nothing to say about and answers it with an empty
   * grid that looks like "no vendors".
   *
   * The date is dropped and the customer is told, rather than the search being
   * refused: the category and city they asked for are still a good question.
   * Only the client can judge this — "today" is the viewer's local day, which
   * the server has no way to know, so the API validates the date's shape and
   * nothing more.
   */
  const [droppedPastDate, setDroppedPastDate] = useState<string | null>(null);

  useEffect(() => {
    if (state.date !== '' && isPastDate(state.date, todayDateString())) {
      setDroppedPastDate(state.date);
      setState({ date: '' });
    }
    // `setState` is a fresh closure each render; the date is what this watches.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.date]);

  const refineCount = activeRefineCount(state);
  const diagnosis = noResultsDiagnosis(state);
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
      <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-stone-200 px-5 py-3 min-[90rem]:px-6.5 lg:hidden">
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
      <div className="flex shrink-0 flex-wrap items-baseline justify-between gap-x-6 gap-y-1 px-5 pt-3.75 pb-2.75 min-[90rem]:px-6.5">
        <h1 className="font-display text-[22px] text-stone-900">
          {isLoading ? searchingLine(state) : heading}
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

        {droppedPastDate !== null ? (
          <p role="status" className="w-full text-[12.5px] text-stone-700">
            {AVAILABILITY_DATE_FORMATTER.format(new Date(`${droppedPastDate}T00:00:00Z`))} has
            already passed, so the date was cleared — pick a new one to check availability.
          </p>
        ) : null}
      </div>

      <div className="app-pane px-5 pb-20 min-[90rem]:px-6.5 lg:pb-4">
        {error !== null ? (
          <EmptyState icon={<SearchX />} headline="Something went wrong" description={error} />
        ) : isLoading ? (
          // Skeletons swap into the live grid; the bars stay put, and there is
          // never a full-page spinner beside them.
          <div className={GRID_COLUMNS}>
            {Array.from({ length: SKELETON_COUNT }, (_unused, index) => (
              <VendorCardSkeleton
                key={index}
                {...(index >= 6 ? { className: SKELETONS_BEYOND_TWO_ROWS_AT_1024 } : {})}
              />
            ))}
          </div>
        ) : total === 0 ? (
          /*
            Frame `18`. It never dead-ends: the headline counts the filters the
            customer actually set, the sentence names the narrowest one, and
            each button loosens exactly one thing so they can see what changed.
          */
          <>
            <EmptyState
              icon={<SearchX />}
              headline={noResultsHeadline(state)}
              description={
                // With nothing filtered there is no culprit to name, so it says
                // where to go next instead of inventing a diagnosis.
                diagnosis ?? 'Try a different vendor type or city.'
              }
              action={
                <div className="flex flex-wrap items-center justify-center gap-2.5">
                  {relaxations(state).map((relaxation, index) => (
                    <button
                      key={relaxation.label}
                      type="button"
                      onClick={() => setState(relaxation.patch)}
                      className={cn(
                        'min-h-11 rounded-full px-4.5 text-sm font-semibold lg:min-h-9',
                        // The first is the one most likely to bring results back,
                        // so it is the primary action rather than one of a row.
                        index === 0
                          ? 'bg-clay-500 text-stone-0 hover:bg-clay-600'
                          : 'border border-stone-300 bg-stone-0 text-stone-800 hover:bg-stone-100',
                      )}
                    >
                      {relaxation.label}
                    </button>
                  ))}
                  {refineCount > 0 ? (
                    <button
                      type="button"
                      onClick={clearRefinements}
                      className="text-sm font-semibold text-clay-500 underline underline-offset-4 hover:text-clay-600"
                    >
                      Clear all
                    </button>
                  ) : null}
                </div>
              }
            />
            {/*
              Only with a date to be near. Without one the customer has not
              asked a date question, and the band would be answering something
              nobody said.
            */}
            <NearbyDatesBand date={state.date} category={state.category} city={state.city} />
          </>
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
