'use client';

import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

/**
 * Whether a search is in flight, shared between the results and the header.
 *
 * Frames `17` and `25 — loading` both put a spinner in the compact bar's
 * submit control while a search runs, and those two live on opposite sides of
 * a component boundary: `SearchShell` owns the fetch, and `HeaderQuery` is
 * rendered by the site header. Nothing carried the flag across, so the bar
 * kept its magnifier through every wait.
 *
 * A context rather than a prop, because the two are siblings under the root
 * layout with the whole page between them. It is deliberately the smallest
 * thing that closes that gap — one boolean, no search state — so it cannot
 * quietly become a second source of truth for the query itself, which lives
 * in the URL.
 */

interface SearchStatus {
  isSearching: boolean;
  setSearching: (searching: boolean) => void;
}

/*
 * Defaults to "not searching" with a no-op setter, so a `SearchBar` rendered
 * outside the provider — the landing hero — works untouched rather than
 * needing to know this exists.
 */
const SearchStatusContext = createContext<SearchStatus>({
  isSearching: false,
  setSearching: () => undefined,
});

export function SearchStatusProvider({ children }: { children: ReactNode }): React.ReactElement {
  const [isSearching, setSearching] = useState(false);
  const value = useMemo(() => ({ isSearching, setSearching }), [isSearching]);

  return <SearchStatusContext.Provider value={value}>{children}</SearchStatusContext.Provider>;
}

export function useSearchStatus(): SearchStatus {
  return useContext(SearchStatusContext);
}
