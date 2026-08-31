'use client';

import { MAX_NAME_LENGTH } from '@vendor-marketplace/shared';
import { useRouter } from 'next/navigation';
import { useRef, useState, type ReactNode } from 'react';
import { SingleSelectDropdown } from '@/components/ui/dropdown-select';
import { adminQueryString } from '@/lib/admin-params';
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
  /** The surface's own path — the choice is applied by navigating to it. */
  action: string;
  /** The filters already applied, so choosing one does not clear the others. */
  carried: Record<string, string | undefined>;
}

/**
 * One trigger in the Refine bar.
 *
 * **Not a native `<select>`.** `03-components.md` forbids one outright — "they
 * bring their own selection colour and OS glyphs — three palettes in one field"
 * — and the native version also sized itself to its widest option, so `Payouts`
 * rendered 153px against the frame's 93px and pushed the whole bar out of
 * composition. This is the app's own `SingleSelectDropdown`, which is what every
 * other filter in the product uses.
 *
 * Choosing navigates rather than submitting a form: the filters live in the URL,
 * so a choice *is* a URL, and `page` is dropped so a narrower filter cannot land
 * the operator on a page that no longer exists.
 */
export function FilterSelect({
  name,
  label,
  options,
  value,
  action,
  carried,
}: FilterSelectProps): React.ReactElement {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const chosen = options.find((option) => option.value === value);

  return (
    <SingleSelectDropdown
      open={open}
      onOpenChange={setOpen}
      label={label}
      options={[{ value: '', label: `Any ${label.toLowerCase()}` }, ...options]}
      value={value || null}
      onChange={(next) => {
        setOpen(false);
        router.push(`${action}${adminQueryString({ ...carried, [name]: next })}`);
      }}
      trigger={
        <button
          type="button"
          aria-haspopup="listbox"
          aria-expanded={open}
          className={cn(
            'flex items-center gap-1.5 rounded-md border border-stone-300 bg-stone-0 py-2 pr-3 pl-3.5 text-sm font-semibold whitespace-nowrap',
            chosen ? 'text-clay-600' : 'text-stone-900',
          )}
        >
          {chosen ? chosen.label : label}
        </button>
      }
    />
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
          /*
            The same cap the API enforces. Without it a long paste becomes a
            user-visible error that validation should have prevented — the
            "bound the input in the UI too" half of the boundary rule.
          */
          maxLength={MAX_NAME_LENGTH}
          placeholder={searchPlaceholder}
          aria-label={searchPlaceholder}
          /*
            `box-content`, like every measurement in the frame file. The frame's
            `max-width:280px` is a **content** max in a content-box document, so
            it renders 306px outer — 280 plus 24px of padding and 2px of border.
            Border-box read the same number as the footprint and came out 26px
            narrow, which pushed every control after it left.
          */
          /*
            The bordered-field focus treatment, not the unbordered one.
            `03-components.md` names three mechanisms and forbids mixing them: a
            field that already has an edge darkens that edge, because a detached
            ring on top of a border reads as browser chrome. With no override
            this fell through to the global `:focus-visible` and painted the
            unbordered control's offset ring. The class string is the one the
            booking and customer-profile fields already use.
          */
          className="box-content w-full max-w-70 flex-1 rounded-md border border-stone-300 bg-stone-0 px-3 py-2 text-action text-stone-900 placeholder:text-stone-600 focus-visible:border-clay-400 focus-visible:ring-3 focus-visible:ring-clay-400/15"
        />
      ) : null}
      {children}
      {/*
        Submits on Enter in the search field without a visible button, which the
        frame does not draw — but a form with no submit control is unreachable
        to a keyboard user who has tabbed past the field, so it is present and
        visually hidden rather than absent.

        The dropdowns are *outside* the form's submit path since they became
        real listboxes: each navigates on choice, carrying the filters it did
        not change. The form is the search field and the hidden fields alone.
      */}
      <button
        type="submit"
        /*
          `focus-visible:not-sr-only`, the skip link's idiom. `sr-only` alone
          left a keyboard stop between `Payouts` and `Export CSV` that painted
          nothing at all — a focus ring on a 1px clipped box — which is the same
          defect class as a clipped ring, arrived at from the other direction.
        */
        className="sr-only focus-visible:not-sr-only focus-visible:rounded-md focus-visible:border focus-visible:border-stone-300 focus-visible:bg-stone-0 focus-visible:px-3.5 focus-visible:py-2 focus-visible:text-sm focus-visible:font-semibold focus-visible:text-stone-900"
      >
        Apply filters
      </button>
      {trailing ? <span className="ml-auto">{trailing}</span> : null}
    </form>
  );
}
