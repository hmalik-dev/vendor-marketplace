'use client';

import type { Category } from '@vendor-marketplace/shared';
import { useRouter } from 'next/navigation';
import { SearchBar, type SearchBarValues } from '@/components/search/search-bar';

/** An untouched hero bar asks nothing yet — every segment starts empty. */
const EMPTY_QUERY: SearchBarValues = { category: '', city: '', date: '' };

export interface HeroSearchProps {
  categories: readonly Category[];
}

/**
 * The landing hero's copy of the category-first search bar.
 *
 * The bar itself is shared with the search header — the segments, their flex
 * weights and the two densities all live in `SearchBar`. What belongs to the
 * landing page is only where submitting goes: `/search`, carrying whichever of
 * the three values were filled in. An empty segment is left out of the URL
 * rather than written as an empty param, so a bare "Search" lands on the
 * unfiltered grid and the address bar says so.
 *
 * See design/design-plan/10-landing.md.
 */
export function HeroSearch({ categories }: HeroSearchProps): React.ReactElement {
  const router = useRouter();

  return (
    <SearchBar
      categories={categories}
      value={EMPTY_QUERY}
      size="hero"
      /* 18px at both narrow frames, 24 only at 1440. */
      className="mt-4.5 min-[90rem]:mt-6"
      onSubmit={(values) => {
        const params = new URLSearchParams();

        for (const [key, value] of Object.entries(values)) {
          if (value !== '') {
            params.set(key, value);
          }
        }

        const query = params.toString();
        router.push(query === '' ? '/search' : `/search?${query}`);
      }}
    />
  );
}
