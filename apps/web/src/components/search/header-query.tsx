'use client';

import type { Category, VendorCity } from '@vendor-marketplace/shared';
import { usePathname } from 'next/navigation';
import { NameSearch } from './name-search';
import { SearchBar } from './search-bar';
import { useSearchState } from './search-state';

export interface HeaderQueryProps {
  categories: readonly Category[];
  /** The cities that have vendors, so City can only ask a real question. */
  cities: readonly VendorCity[];
}

/**
 * The query bar where frame `02` draws it: inside the 64px header, between the
 * wordmark and the account actions, with "Search by name" beside it.
 *
 * It only exists on `/search`, and only from `lg` up. Frame `14` shows the
 * tablet and mobile adaptation putting the query in its own row below the
 * header instead, because a 64px bar cannot hold three segments at 768 and
 * cannot hold the stacked three-row card at 390 — `SearchShell` renders that
 * row, hidden from `lg`. The two never show at once.
 *
 * There is no shared React state between the two: both read and write the same
 * `nuqs` params, so the URL is the single source and they cannot disagree.
 */
export function HeaderQuery({ categories, cities }: HeaderQueryProps): React.ReactElement | null {
  const pathname = usePathname();
  const { state, setState } = useSearchState();

  if (pathname !== '/search') {
    return null;
  }

  return (
    <div className="hidden min-w-0 flex-1 items-center gap-4 lg:flex">
      {/* 560px is the frame's cap; the bar grows to it and then stops. */}
      <SearchBar
        categories={categories}
        cities={cities}
        value={{
          category: state.category,
          city: state.city,
          state: state.state,
          date: state.date,
        }}
        onSubmit={(next) => setState(next)}
        /*
          The one legitimate circle. This bar is a strip inside the 64px
          header, not the page's primary object, and the word "Search" here
          costs the date field the width it needs to read as a date.
        */
        action="icon"
        className="min-w-0 flex-1 max-w-140"
      />
      <NameSearch value={state.name} onSubmit={(name) => setState({ name })} />
    </div>
  );
}
