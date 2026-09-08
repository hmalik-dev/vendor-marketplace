import Link from 'next/link';
import type { FilterWidening } from '@vendor-marketplace/shared';
import { EmptyState } from '@/components/ui/empty-state';
import { adminQueryString } from '@/lib/admin-params';
import { cn } from '@/lib/utils';

/**
 * One active filter, as a URL can drop it.
 *
 * `key` is the query parameter — it is what the API counted against, and how a
 * widening is matched back to the filter it drops. `widening` is the words on
 * the button, which the surface owns: "Open cases instead" is copy and `status`
 * is a parameter name.
 *
 * The filter's words *inside the heading* are deliberately not here. They are a
 * different sentence — *"No **resolved chargeback** cases for 'kessler'"* reads
 * one way and *"Open cases instead"* reads another — and the surface builds the
 * whole heading rather than handing over fragments for a generic join.
 */
export interface ActiveFilter {
  key: string;
  /** What the button that drops it says — "Open cases instead", "Any origin". */
  widening: string;
  /** Every *other* filter's parameters, so the link drops exactly this one. */
  carried: Record<string, string | number | undefined>;
}

export interface FilteredEmptyProps {
  /**
   * The heading, with the active filters recited in it.
   *
   * Built by the surface rather than assembled here from `phrase` fragments: a
   * generic join produces "No resolved chargeback cases for 'kessler' and in
   * the last 7 days", and the sentence is the part of this state that has to
   * read as though a person wrote it.
   */
  headline: string;
  /** The surface's own path, which both the widenings and the escape are built on. */
  path: string;
  /** The filters currently narrowing the view, in the order the bar shows them. */
  filters: readonly ActiveFilter[];
  /** What the API counted: how many rows dropping each single filter would reveal. */
  widenings: readonly FilterWidening[];
}

/**
 * The filtered-empty state, with a **counted** way out per filter (#454).
 *
 * Drawn by Pattern A of the admin delta, and it closes #443's sixth finding —
 * *"the filtered empty state offers no way out where every other console empty
 * state does"*. The counted routes are the whole point: an operator picks the
 * widening that **pays** instead of clearing everything and rebuilding the
 * query from scratch.
 *
 * Four requirements, and each one is a line below rather than a paragraph here:
 *
 * 1. The heading recites the active filters in the operator's own words.
 * 2. One line saying how many filters are narrowing the view.
 * 3. One button per filter, each dropping exactly that filter and carrying the
 *    count it would reveal. Highest count is primary.
 *    **A route that would reveal zero is never offered as a button.**
 * 4. `Clear all filters` last, as a ghost link — the escape, not the suggestion.
 *
 * **This is not the true-empty state and must not be used as one.** A list that
 * is empty because the platform has no rows gets `EmptyState` with no button:
 * nothing an operator does creates a case or an activity row, so a control
 * there would offer an action that cannot help, and the copy's whole job is to
 * say where rows come from so the silence reads as calm rather than broken.
 */
export function FilteredEmpty({
  headline,
  path,
  filters,
  widenings,
}: FilteredEmptyProps): React.ReactElement {
  /*
   * Joined on `key`, and the API is what decided which routes exist.
   *
   * A zero-count route never reaches here — `countWidenings` drops it server
   * side — so this is a lookup rather than a second filter, and the count that
   * decided a button exists is the same number the button prints. Sorted
   * descending because the delta makes the highest count the primary: it is the
   * widening most likely to be worth taking.
   */
  const routes = filters
    .map((filter) => ({
      filter,
      count: widenings.find((widening) => widening.key === filter.key)?.count ?? 0,
    }))
    .filter((route) => route.count > 0)
    .sort((first, second) => second.count - first.count);

  const narrowing =
    filters.length === 1
      ? 'One filter is narrowing this.'
      : `${filters.length} filters are narrowing this.`;

  return (
    <EmptyState
      headline={headline}
      /*
       * The second line, and it is two sentences that have to stay honest
       * together. "Widening any one of them finds something" is a claim about
       * the routes below it — so when every widening reveals zero it is not
       * said, and the state says the opposite instead. A fixed sentence would
       * promise rows that are not there on exactly the run where an operator
       * most needs the truth.
       */
      description={
        routes.length > 0
          ? `${narrowing} Widening any one of them finds something:`
          : `${narrowing} Widening any single one of them still finds nothing.`
      }
      action={
        <div className="flex flex-wrap items-center justify-center gap-2">
          {routes.map((route, index) => (
            <Link
              key={route.filter.key}
              href={`${path}${adminQueryString(route.filter.carried)}`}
              className={cn(
                'inline-flex items-center rounded-lg border px-4 py-2 text-base font-semibold transition-colors duration-(--duration-fast)',
                // Highest count is the primary. Exactly one, and it is first
                // because the list is sorted.
                index === 0
                  ? 'border-transparent bg-clay-400 text-stone-0 hover:bg-clay-500'
                  : 'border-stone-300 bg-stone-0 text-stone-900 hover:bg-stone-150',
              )}
            >
              {route.filter.widening} ({route.count})
            </Link>
          ))}
          {/*
            Last, and a ghost link rather than a button: it is the escape, not
            the suggestion. An operator who clears everything has thrown away
            the query they built, which is the outcome the counted routes exist
            to save them from — so it is offered without being recommended.
          */}
          <Link
            href={path}
            className="px-1.5 text-base font-semibold text-clay-500 underline-offset-4 hover:text-clay-600 hover:underline"
          >
            Clear all filters
          </Link>
        </div>
      }
    />
  );
}
