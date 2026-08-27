'use client';

import {
  DEFAULT_PAGE_SIZE,
  VENDOR_SORT_OPTIONS,
  type VendorSortOption,
} from '@vendor-marketplace/shared';
import {
  parseAsArrayOf,
  parseAsFloat,
  parseAsInteger,
  parseAsString,
  parseAsStringLiteral,
  useQueryStates,
} from 'nuqs';

/**
 * Search state lives in the URL, so a search is shareable and the back button
 * works. `nuqs` keeps the params and the React state in one place; the defaults
 * here are what "no value" looks like, and a param at its default is omitted
 * from the URL rather than written out.
 *
 * Two kinds of value live here and they are not interchangeable:
 *
 * - **The query** — `category`, `city`, `date`. Three enumerable values owned
 *   by the search bar. There is no free-text query on the main path; the
 *   retired `q` param is gone (decision D6).
 * - **Refinements** — price, rating, tags. Owned by the Refine bar.
 *
 * `name` is neither: it is the referral affordance behind "Search by name",
 * matched against the business name alone.
 *
 * See design/design-plan/11-search.md.
 */
export const searchParsers = {
  name: parseAsString.withDefault(''),
  category: parseAsString.withDefault(''),
  city: parseAsString.withDefault(''),
  state: parseAsString.withDefault(''),
  minPriceCents: parseAsInteger,
  maxPriceCents: parseAsInteger,
  date: parseAsString.withDefault(''),
  minRating: parseAsFloat,
  tags: parseAsArrayOf(parseAsString).withDefault([]),
  sort: parseAsStringLiteral(VENDOR_SORT_OPTIONS).withDefault('relevance'),
  page: parseAsInteger.withDefault(1),
} as const;

export interface SearchState {
  name: string;
  category: string;
  city: string;
  state: string;
  minPriceCents: number | null;
  maxPriceCents: number | null;
  date: string;
  minRating: number | null;
  tags: string[];
  sort: VendorSortOption;
  page: number;
}

export type SearchPatch = Partial<SearchState>;

/** The three values the search bar owns. Never rendered as Refine chips. */
export type SearchQueryValues = Pick<SearchState, 'category' | 'city' | 'date'>;

export interface UseSearchState {
  state: SearchState;
  /** Applies a patch. Any change but paging returns to page 1. */
  setState: (patch: SearchPatch) => void;
  /** Clears the Refine bar only — the query stays, because it is the question. */
  clearRefinements: () => void;
}

export function useSearchState(): UseSearchState {
  const [state, setQuery] = useQueryStates(searchParsers, { history: 'push' });

  return {
    state: state as SearchState,
    setState: (patch) => {
      /*
       * Changing a filter while on page 3 would otherwise ask for the third
       * page of a result set that may only have one — the user sees an empty
       * grid and reads it as "no matches".
       */
      const resetsPage = Object.keys(patch).some((key) => key !== 'page');
      void setQuery(resetsPage ? { ...patch, page: null } : patch);
    },
    /*
     * "Clear" sits in the Refine bar and clears the Refine bar. Wiping the
     * category and city too would throw away the question the results answer
     * and drop the customer back to an unfiltered grid they never asked for.
     */
    clearRefinements: () => {
      void setQuery({
        minPriceCents: null,
        maxPriceCents: null,
        minRating: null,
        tags: null,
        page: null,
      });
    },
  };
}

/** Turns the current state into the querystring the API expects. */
export function toSearchQuery(state: SearchState): string {
  const params = new URLSearchParams();

  if (state.name) params.set('name', state.name);
  if (state.category) params.set('category', state.category);
  if (state.city) params.set('city', state.city);
  if (state.state) params.set('state', state.state);
  if (state.minPriceCents !== null) params.set('minPriceCents', String(state.minPriceCents));
  if (state.maxPriceCents !== null) params.set('maxPriceCents', String(state.maxPriceCents));
  if (state.date) params.set('date', state.date);
  if (state.minRating !== null) params.set('minRating', String(state.minRating));
  for (const tag of state.tags) {
    params.append('tags', tag);
  }
  params.set('sort', state.sort);
  params.set('page', String(state.page));
  params.set('pageSize', String(DEFAULT_PAGE_SIZE));

  return params.toString();
}

/**
 * How many Refine chips are narrowing the results right now — the number the
 * mobile "Filters · N" trigger carries.
 *
 * The query (category, city, date) is deliberately excluded: it is shown by the
 * search bar, which owns it. Counting it here would be a second representation
 * of one state, and the date must never read as a filter at any width.
 */
export function activeRefineCount(state: SearchState): number {
  return [
    state.minPriceCents !== null || state.maxPriceCents !== null,
    state.minRating !== null,
    state.tags.length > 0,
  ].filter(Boolean).length;
}

/** Whether the customer has actually asked something yet. */
export function hasQuery(state: SearchState): boolean {
  return state.category !== '' || state.city !== '' || state.date !== '' || state.name !== '';
}
