'use client';

import { Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

/**
 * The three questions a customer actually arrives with: what, where, and when.
 *
 * Used compact in the search header and full-size on the landing hero, which is
 * why the segments and their flex weights live here rather than in either page.
 * See design/design-plan/11-search.md and `10-landing.md`.
 */
export interface SearchBarValues {
  q: string;
  city: string;
  date: string;
}

export interface SearchBarProps {
  value: SearchBarValues;
  onSubmit: (value: SearchBarValues) => void;
  /** `compact` is the header variant; `hero` is the landing one. */
  size?: 'compact' | 'hero';
  className?: string;
}

export function SearchBar({
  value,
  onSubmit,
  size = 'compact',
  className,
}: SearchBarProps): React.ReactElement {
  const [draft, setDraft] = useState<SearchBarValues>(value);

  // The URL is the source of truth: a back-navigation or a pill removed from
  // the rail has to be reflected here, not overwritten by a stale draft.
  useEffect(() => {
    setDraft(value);
  }, [value]);

  const isHero = size === 'hero';
  const field = cn(
    'min-w-0 bg-transparent text-stone-900 outline-none placeholder:text-stone-600',
    isHero ? 'text-md' : 'text-base',
  );

  return (
    <form
      role="search"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(draft);
      }}
      className={cn(
        'flex items-center rounded-full border border-stone-300',
        isHero ? 'bg-stone-0 py-2 pr-2 pl-6 shadow-lg' : 'bg-stone-150 py-1.25 pr-1.25 pl-4.5',
        className,
      )}
    >
      <label className="flex min-w-0 flex-[1.2] flex-col">
        <span className="sr-only">What kind of vendor are you looking for?</span>
        <input
          value={draft.q}
          onChange={(event) => setDraft((previous) => ({ ...previous, q: event.target.value }))}
          placeholder="What kind of vendor are you looking for?"
          className={field}
        />
      </label>

      <span aria-hidden="true" className="h-5.5 w-px shrink-0 bg-stone-300" />

      <label className="flex min-w-0 flex-[0.8] flex-col pl-3.5">
        <span className="sr-only">Where</span>
        <input
          value={draft.city}
          onChange={(event) => setDraft((previous) => ({ ...previous, city: event.target.value }))}
          placeholder="Where"
          className={field}
        />
      </label>

      <span aria-hidden="true" className="h-5.5 w-px shrink-0 bg-stone-300" />

      <label className="flex min-w-0 flex-[0.6] flex-col pl-3.5">
        <span className="sr-only">Event date</span>
        <input
          type="date"
          value={draft.date}
          onChange={(event) => setDraft((previous) => ({ ...previous, date: event.target.value }))}
          // An empty date reads "Add a date", never a grey placeholder that
          // looks disabled — see design/design-plan/10-landing.md.
          className={cn(field, draft.date === '' && 'text-stone-600')}
        />
      </label>

      <button
        type="submit"
        className={cn(
          'ml-2 flex shrink-0 items-center gap-1.5 rounded-full bg-clay-400 font-semibold text-stone-0 transition-colors duration-(--duration-fast) hover:bg-clay-500',
          isHero ? 'px-6 py-2.5 text-base' : 'px-5 py-2 text-sm',
        )}
      >
        <Search aria-hidden="true" className="size-3.5" />
        Search
      </button>
    </form>
  );
}
