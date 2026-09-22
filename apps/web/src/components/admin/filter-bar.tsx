'use client';

import { MAX_NAME_LENGTH } from '@vendor-marketplace/shared';
import { useRouter } from 'next/navigation';
import {
  createContext,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from 'react';
import { SingleSelectDropdown } from '@/components/ui/dropdown-select';
import { adminQueryString } from '@/lib/admin-params';
import { FIELD_FOCUS } from '@/lib/focus';
import { cn } from '@/lib/utils';

type FilterParamValues = Record<string, string | undefined>;

/** The bar's narrowed `params`, which every `FilterSelect` inside it carries. */
const FilterParams = createContext<FilterParamValues | null>(null);

/** Dropped from every navigation, so a narrower filter never lands past the last page. */
const PAGE_PARAM = 'page';

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
 *
 * **The other filters come from the enclosing `FilterBar`'s `params`**, never
 * from the call site (VEN-395). Each call site used to list its siblings by
 * hand, so adding a filter meant editing every sibling, and the seven surfaces
 * had already drifted — one carried nothing, one carried `page`.
 */
export function FilterSelect({
  name,
  label,
  options,
  value,
  action,
  allowAny = true,
}: FilterSelectProps): React.ReactElement {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  /** The navigation a push was started for, cleared once its transition settles. */
  const navigation = useRef<{ from: string; to: string } | null>(null);
  const params = useContext(FilterParams);
  const chosen = options.find((option) => option.value === value);

  if (params === null) {
    throw new Error(`FilterSelect "${name}" must be rendered inside a FilterBar`);
  }

  /*
   * A soft navigation that never commits (VEN-576): CI saw the URL sit on the
   * pre-choice value for a whole 30s timeout while nothing about the choice
   * itself failed. `startTransition` is how Next's own docs recommend tracking
   * a `router.push`'s completion; once it settles, a URL that still sits where
   * it did when the push was made did not land, and a full navigation is the
   * one thing that cannot be dropped the same way.
   *
   * The comparison is against `from`, not merely "does it match `to`" — two
   * `FilterSelect`s in the same bar chosen back to back can settle their
   * transitions in the same commit, and the second choice's URL is a perfectly
   * good landing for the first's push. Falling back there would hard-navigate
   * the operator's later choice away in favour of the earlier one.
   */
  useEffect(() => {
    if (pending || navigation.current === null) return;
    const { from, to } = navigation.current;
    navigation.current = null;
    const here = window.location.pathname + window.location.search;
    if (here === from && here !== to) {
      window.location.assign(to);
    }
  }, [pending]);

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
        const url = `${action}${adminQueryString({ ...params, [name]: next, [PAGE_PARAM]: undefined })}`;
        navigation.current = { from: window.location.pathname + window.location.search, to: url };
        startTransition(() => {
          router.push(url);
        });
      }}
      trigger={
        <button
          type="button"
          aria-haspopup="listbox"
          aria-expanded={open}
          className={cn(
            /*
              `px-3.5` both sides, frame `13`'s `padding:8px 14px` (VEN-388).
              The right side was 12px, a vestige of the caret D25 removed —
              the gap the glyph used to fill. Symmetric padding is the fix;
              the caret stays absent (`dropdown-caret.test.ts`).
            */
            'flex items-center gap-1.5 rounded-md border border-stone-300 bg-stone-0 px-3.5 py-2 text-sm font-semibold whitespace-nowrap',
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
   * The filters this bar refines, **narrowed** — the object the surface hands
   * its `Pager`, never raw `searchParams`. Each non-empty entry is submitted as
   * a hidden field, which is the only reason `Apply filters` applies anything
   * (VEN-383): the dropdowns navigate on change and are not form controls, so
   * without these the GET form had no successful controls and landed on the
   * bare path. The bar owns the fields rather than each `FilterSelect` because
   * `/admin/activity`'s `actor` and `subject` have no control of their own.
   * It is also what every `FilterSelect` inside the bar carries when it
   * navigates, so a surface lists its filters here once (VEN-395).
   *
   * `page` must stay absent, so a narrower filter lands on page 1. Omitted only
   * where a surface still writes its own hidden fields.
   */
  params?: Record<string, string | undefined>;
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
 * navigates on change; the search field submits on Enter, and `Apply filters`
 * submits whatever `params` holds.
 */
export function FilterBar({
  action,
  params = {},
  searchPlaceholder,
  searchValue,
  children,
  trailing,
}: FilterBarProps): React.ReactElement {
  const searchId = useId();

  return (
    <FilterParams.Provider value={params}>
      {/* `relative` anchors the visually-hidden submit's offsets below. */}
      <form action={action} method="get" className="relative flex items-center gap-2">
        {/*
        `q` is skipped where the search field exists — that input already
        carries the name, and two would submit `?q=a&q=b`. Empty values are
        omitted, matching `adminQueryString`: `?type=` is not the URL the
        dropdown's change handler would build.
      */}
        {Object.entries(params).map(([key, value]) =>
          value && !(searchPlaceholder && key === 'q') ? (
            <input key={key} type="hidden" name={key} value={value} />
          ) : null,
        )}
        {searchPlaceholder ? (
          <>
            {/*
            A visible `<label>`, not only an `aria-label` (VEN-395). The
            placeholder was the one sighted cue for what the field does, and it
            disappears on the first keystroke — `04-laws.md` asks for a label
            that stays.
          */}
            <label htmlFor={searchId} className="text-meta font-semibold text-stone-600">
              Search
            </label>
            <input
              id={searchId}
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
          </>
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

          `bottom-0 left-0 translate-y-full` while hidden (VEN-383): `sr-only` is
          `position:absolute` with no offsets, so the 1px box resolved to the
          flex container's content start and sat on top of the first control —
          `elementFromPoint` at its centre returned the `Direction` combobox.
          The offsets park it just below the bar, over nothing. Focused,
          `not-sr-only` returns it to the flow; `focus-visible:translate-y-0`
          undoes the transform, which `not-sr-only` does not reset.
        */
          className="sr-only bottom-0 left-0 translate-y-full focus-visible:not-sr-only focus-visible:translate-y-0 focus-visible:rounded-md focus-visible:border focus-visible:border-stone-300 focus-visible:bg-stone-0 focus-visible:px-3.5 focus-visible:py-2 focus-visible:text-sm focus-visible:font-semibold focus-visible:text-stone-900"
        >
          Apply filters
        </button>
        {trailing ? <span className="ml-auto">{trailing}</span> : null}
      </form>
    </FilterParams.Provider>
  );
}
