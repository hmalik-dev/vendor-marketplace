'use client';

import type { Category } from '@vendor-marketplace/shared';
import { useEffect, useId, useState } from 'react';
import { cn } from '@/lib/utils';
import { CategorySelect } from './category-select';

/**
 * The query, and the whole of it: **vendor type, city, event date**.
 *
 * Nobody arrives knowing a vendor's name — they arrive knowing what kind of
 * vendor, where, and when. All three are constrained, so a search can only ever
 * resolve to something the platform recognises. The free-text box that used to
 * sit in the first segment is gone; name search is a separate, deliberately
 * smaller affordance beside the bar (decision D6).
 *
 * Used compact in the search header and full-size on the landing hero, which is
 * why the segments and their flex weights live here rather than in either page.
 * See design/design-plan/11-search.md and `10-landing.md`.
 */
export interface SearchBarValues {
  /** A category slug, or `''` for "any vendor type". Never free text. */
  category: string;
  city: string;
  date: string;
}

export interface SearchBarProps {
  categories: readonly Category[];
  value: SearchBarValues;
  onSubmit: (value: SearchBarValues) => void;
  /** `compact` is the header variant; `hero` is the landing one. */
  size?: 'compact' | 'hero';
  className?: string;
}

export function SearchBar({
  categories,
  value,
  onSubmit,
  size = 'compact',
  className,
}: SearchBarProps): React.ReactElement {
  const [draft, setDraft] = useState<SearchBarValues>(value);
  const fieldId = useId();

  // The URL is the source of truth: a back-navigation has to be reflected here,
  // not overwritten by a stale draft.
  useEffect(() => {
    setDraft(value);
  }, [value]);

  const isHero = size === 'hero';

  const label = cn(
    'font-semibold tracking-[.05em] text-stone-600 uppercase',
    isHero ? 'text-[10.5px]' : 'text-[9.5px]',
  );
  const field = cn(
    'min-w-0 bg-transparent text-stone-900 outline-none placeholder:text-stone-600',
    isHero ? 'mt-0.5 text-md' : 'text-[13.5px]',
  );
  /*
   * Below `sm` the three segments stack into a three-row card. They are the
   * query, not a refinement, so they never collapse into the filter sheet — but
   * three flex segments across 390px squeezes each to a few characters, which
   * is worse than a taller control. See design/design-plan/30-responsive.md.
   */
  const divider = cn(
    'shrink-0 bg-stone-200 max-sm:h-px max-sm:w-full sm:w-px sm:bg-stone-300',
    isHero ? 'sm:h-8' : 'sm:h-6.5 sm:bg-stone-200',
  );
  const segment = 'flex min-w-0 flex-col max-sm:w-full max-sm:px-0 max-sm:py-1.5';

  return (
    <form
      role="search"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(draft);
      }}
      className={cn(
        'flex bg-stone-0 max-sm:flex-col max-sm:items-stretch max-sm:rounded-2xl max-sm:px-4 max-sm:py-3 sm:flex-row sm:items-center sm:rounded-full',
        isHero
          ? 'shadow-lg sm:py-1.75 sm:pr-1.75 sm:pl-6'
          : 'border border-stone-300 shadow-sm sm:py-1 sm:pr-1 sm:pl-4',
        className,
      )}
    >
      <CategorySelect
        categories={categories}
        value={draft.category}
        onChange={(category) => setDraft((previous) => ({ ...previous, category }))}
        size={size}
        id={`${fieldId}-type`}
      />

      <span aria-hidden="true" className={divider} />

      <label className={cn(segment, isHero ? 'sm:flex-1 sm:pl-4.5' : 'sm:flex-[0.9] sm:pl-3.5')}>
        <span className={label}>City</span>
        <input
          value={draft.city}
          onChange={(event) => setDraft((previous) => ({ ...previous, city: event.target.value }))}
          placeholder="Anywhere"
          className={field}
        />
      </label>

      <span aria-hidden="true" className={divider} />

      <label
        className={cn(segment, isHero ? 'sm:flex-[0.8] sm:pl-4.5' : 'sm:flex-[0.85] sm:pl-3.5')}
      >
        <span className={label}>Event date</span>
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
          'shrink-0 rounded-full bg-clay-400 font-semibold text-stone-0 transition-colors duration-(--duration-fast) hover:bg-clay-500 max-sm:mt-3 max-sm:w-full max-sm:py-2.75',
          isHero
            ? 'sm:ml-2 sm:px-6 sm:py-2.75 sm:text-base'
            : 'sm:ml-1.5 sm:px-5 sm:py-2.5 sm:text-[12.5px]',
        )}
      >
        Search
      </button>
    </form>
  );
}
