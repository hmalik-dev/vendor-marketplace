'use client';

import { MAX_NAME_LENGTH } from '@vendor-marketplace/shared';
import { useRouter } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { SingleSelectDropdown } from '@/components/ui/dropdown-select';
import { adminQueryString } from '@/lib/admin-params';
import { FIELD_FOCUS } from '@/lib/focus';
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
  /**
   * Whether to offer the `Any <label>` choice that clears this filter. Defaults
   * to `true`, which is right for every filter whose absence means "no filter".
   *
   * `/admin/cases` is the exception and needed one: its `status` is the only
   * admin query with a **server-side default** (`open`, because the queue exists
   * to show what is waiting), so clearing the parameter does not widen the list
   * — it lands back on open. The option was therefore a control that read as a
   * reset and did nothing. Suppressing it is honest; removing the default would
   * mean a bare `/admin/cases`, which is what the rail links to, listing every
   * case ever filed.
   */
  allowAny?: boolean;
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
  allowAny = true,
}: FilterSelectProps): React.ReactElement {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const chosen = options.find((option) => option.value === value);

  return (
    <SingleSelectDropdown
      open={open}
      onOpenChange={setOpen}
      label={label}
      options={
        allowAny ? [{ value: '', label: `Any ${label.toLowerCase()}` }, ...options] : options
      }
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
  /**
   * **The filters this bar is refining, narrowed** — the same object the
   * surface hands its `Pager`.
   *
   * Every one of them travels with the submit as a hidden field, which is the
   * only reason activating `Apply filters` applies anything (#455). Without it
   * the form had **no successful controls at all** on five of the six console
   * surfaces that carry a dropdown: the triggers are `<button>`s in a listbox
   * and navigate on change, so they are not form controls, and `/admin/reviews`
   * — one dropdown and nothing else — submitted to the bare path and discarded
   * the filter the control is named for.
   *
   * It takes the whole set rather than letting each `FilterSelect` write its
   * own field, because **not every filter has a dropdown**: `/admin/activity`
   * filters on `actor` and `subject`, two uuids that arrive from a row and are
   * deliberately drawn as dismiss chips rather than as a list of every operator
   * on the platform. A per-control field would have left that surface with
   * exactly the defect this fixes, and no future filter-without-a-control could
   * be added safely either.
   *
   * `page` is absent from every caller's object and must stay absent: a
   * narrower filter has to land on page 1, not on a page that no longer exists.
   *
   * **Required, and that is the guard.** Optional, it was a prop six of the
   * seven surfaces could quietly omit — the compiler, the linter, the unit
   * suite and the end-to-end suite would all have stayed green while that one
   * bar went back to discarding its filters, because nothing else reads a
   * page's JSX. A surface with nothing to carry passes `{}` and says so.
   */
  params: Record<string, string | undefined>;
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
 * support thread and the server can render without a round trip. A dropdown
 * navigates on change rather than submitting; the search field submits on
 * Enter, and `Apply filters` submits whatever `params` holds.
 */
export function FilterBar({
  action,
  params,
  searchPlaceholder,
  searchValue,
  children,
  trailing,
}: FilterBarProps): React.ReactElement {
  return (
    /*
      `relative` so the visually-hidden submit below has something to anchor to.
      It changes no painting: the bar has no positioned descendant that was
      resolving against an ancestor, and the dropdown panels are `fixed`.
    */
    <form action={action} method="get" className="relative flex items-center gap-2">
      {/*
        The filters, as fields the form actually submits.

        `q` is skipped where the search field exists, because that input already
        carries the name — two controls under one name submit `?q=a&q=b`, which
        `admin-params.ts` reads as one intent but is a URL nobody meant. Empty
        values are omitted rather than sent blank, matching `adminQueryString`:
        `?type=` is a different URL from no `type` at all, and the dropdown's
        change handler never produces one.

        **That last rule holds for these fields and not for the search input,
        which is a limit of GET forms rather than a choice.** A text input is a
        successful control whether or not it has a value, so submitting an empty
        search box appends a bare `q=` — visible on `/admin/vendors` and
        `/admin/customers`, and true of pressing Enter in that box long before
        `Apply filters` worked. Suppressing it would take a submit handler, and
        a submit that needs JavaScript is the one thing this control must not
        be. `boundedText` reads `''` as no filter, so the results are identical
        and the cost is a meaningless parameter in a pasted URL.

        `input[type=hidden]` is `display:none`, so these are flex children that
        take no space and add no gap.
      */}
      {Object.entries(params).map(([key, value]) =>
        value && !(searchPlaceholder && key === 'q') ? (
          <input key={key} type="hidden" name={key} value={value} />
        ) : null,
      )}
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
          // A bordered field owns its indicator; see `@/lib/focus`.
          data-focus-own
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
          className={cn(
            'box-content w-full max-w-70 flex-1 rounded-md border border-stone-300 bg-stone-0 px-3 py-2 text-action text-stone-900 placeholder:text-stone-600',
            FIELD_FOCUS,
          )}
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

          **`bottom-0 left-0 translate-y-full` while hidden (#455).** `sr-only`
          is `position:absolute` with no offsets, so the box resolved to its
          *static* position — the flex container's content start — and every
          console surface ended up with a 1px control sitting on top of the
          first one in the bar. Measured at 1440x900 on all seven Refine bars:
          `elementFromPoint` at the submit's own centre returned the `Direction`
          combobox on `/admin/reviews`, `Status` on `/admin/bookings`, the
          search field on `/admin/vendors`, and so on — which is the report that
          "no pointer can reach it", and why every sighted mouse test passed.

          The offsets move that box to just below the bar, where it covers
          nothing. It stays unreachable to a pointer *while hidden*, which is
          what `sr-only` means; the state a user can reach it in is the focused
          one, and `not-sr-only` returns it to the flow there — hit-testable at
          its centre and clickable with a real mouse, which is what
          `admin-filters.spec.ts` asserts. `focus-visible:translate-y-0` undoes
          the transform, since `not-sr-only` resets `position` but a transform
          is not an offset and survives it.
        */
        className="sr-only bottom-0 left-0 translate-y-full focus-visible:not-sr-only focus-visible:translate-y-0 focus-visible:rounded-md focus-visible:border focus-visible:border-stone-300 focus-visible:bg-stone-0 focus-visible:px-3.5 focus-visible:py-2 focus-visible:text-sm focus-visible:font-semibold focus-visible:text-stone-900"
      >
        Apply filters
      </button>
      {trailing ? <span className="ml-auto">{trailing}</span> : null}
    </form>
  );
}
