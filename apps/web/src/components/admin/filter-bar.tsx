'use client';

import { useRef, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface FilterOption {
  value: string;
  label: string;
}

export interface FilterSelectProps {
  name: string;
  /** The word on the trigger when nothing is chosen — `Category`, `City`, `Payouts`. */
  label: string;
  options: readonly FilterOption[];
  value: string;
}

/**
 * One trigger in the Refine bar.
 *
 * A **native** `<select>`, styled to the frame's trigger. The bar is a plain
 * GET form, so the filters survive a reload, are linkable, and need no client
 * state at all — and a native control is keyboard- and screen-reader-correct
 * without reimplementing either. The caret is the frame's `▾`, drawn as
 * decoration behind the control rather than as text inside it.
 */
export function FilterSelect({
  name,
  label,
  options,
  value,
}: FilterSelectProps): React.ReactElement {
  return (
    <span className="relative inline-flex items-center">
      <select
        name={name}
        defaultValue={value}
        aria-label={label}
        onChange={(event) => event.currentTarget.form?.requestSubmit()}
        className={cn(
          'appearance-none rounded-lg border border-stone-300 bg-stone-0 py-2 pr-7 pl-3.5 text-meta font-semibold text-stone-900',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay-400',
        )}
      >
        <option value="">{label}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <span
        aria-hidden="true"
        className="pointer-events-none absolute right-3 text-meta text-stone-900"
      >
        ▾
      </span>
    </span>
  );
}

export interface FilterBarProps {
  /** Where the form submits — the surface's own path, so filters stay in the URL. */
  action: string;
  /** Placeholder for the search field. Omitted where a surface has no search. */
  searchPlaceholder?: string;
  searchValue?: string;
  /** The saved filter and the dropdowns, in the order frame `13` draws them. */
  children?: ReactNode;
  /** Right-aligned ghost link — `Export CSV` where the surface has one. */
  trailing?: ReactNode;
}

/**
 * The Refine bar, above the table and never a modal.
 *
 * `method="get"`, so every filter is a URL the operator can paste into a
 * support thread and the server can render without a round trip. Changing a
 * dropdown submits the form; the search field submits on Enter.
 */
export function FilterBar({
  action,
  searchPlaceholder,
  searchValue,
  children,
  trailing,
}: FilterBarProps): React.ReactElement {
  const form = useRef<HTMLFormElement>(null);

  return (
    <form ref={form} action={action} method="get" className="flex items-center gap-2">
      {searchPlaceholder ? (
        <input
          type="search"
          name="q"
          defaultValue={searchValue ?? ''}
          placeholder={searchPlaceholder}
          aria-label={searchPlaceholder}
          className="w-full max-w-70 flex-1 rounded-lg border border-stone-300 bg-stone-0 px-3 py-2 text-base text-stone-900 placeholder:text-stone-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay-400"
        />
      ) : null}
      {children}
      {/*
        Submits on Enter in the search field without a visible button, which the
        frame does not draw — but a form with no submit control is unreachable
        to a keyboard user who has tabbed past the field, so it is present and
        visually hidden rather than absent.
      */}
      <button type="submit" className="sr-only">
        Apply filters
      </button>
      {trailing ? <span className="ml-auto">{trailing}</span> : null}
    </form>
  );
}
