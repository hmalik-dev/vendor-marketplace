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
 * Filter state lives in the URL, so a search is shareable and the back button
 * works. `nuqs` keeps the params and the React state in one place; the defaults
 * here are what "no filter" looks like, and a param at its default is omitted
 * from the URL rather than written out.
 */
export const searchParsers = {
  q: parseAsString.withDefault(''),
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
  q: string;
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

export interface UseSearchState {
  state: SearchState;
  /** Applies a patch. Any change but paging returns to page 1. */
  setState: (patch: SearchPatch) => void;
  clearAll: () => void;
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
    clearAll: () => {
      void setQuery({
        q: null,
        category: null,
        city: null,
        state: null,
        minPriceCents: null,
        maxPriceCents: null,
        date: null,
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

  if (state.q) params.set('q', state.q);
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

/** How many filters are actually narrowing the results right now. */
export function activeFilterCount(state: SearchState): number {
  return [
    state.q !== '',
    state.category !== '',
    state.city !== '',
    state.state !== '',
    state.minPriceCents !== null || state.maxPriceCents !== null,
    state.date !== '',
    state.minRating !== null,
    state.tags.length > 0,
  ].filter(Boolean).length;
}
