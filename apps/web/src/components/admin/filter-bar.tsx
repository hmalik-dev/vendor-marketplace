'use client';

import { MAX_NAME_LENGTH } from '@vendor-marketplace/shared';
import { useRouter } from 'next/navigation';
import {
  createContext,
  useCallback,
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

/** One push, tracked for the self-heal below, tagged with the attempt that started it. */
interface PendingNavigation {
  from: string;
  to: string;
  attempt: number;
}

/**
 * The self-heal's shared state for one `FilterBar` (VEN-591).
 *
 * `FilterSelect` used to track this per instance, which is only safe for a
 * bar with exactly one dropdown. `/admin/activity` and `/admin/vendors` both
 * have several, and an admin who chooses two before the first round trip
 * finishes is the ordinary case, not an edge case — the Refine bar exists so
 * a choice takes one click. Sharing one `latest` ref and one timer across
 * every `FilterSelect` in the bar means a newer choice always invalidates an
 * older one's heal, from whichever `FilterSelect` made it: `attempt` is
 * bumped and `latest` overwritten the instant a push starts, so a heal that
 * fires for an `attempt` that is no longer `latest.current?.attempt` — because
 * a sibling has since pushed — is a no-op instead of a hard navigation back
 * over the admin's later choice.
 */
interface FilterNavigation {
  latest: { current: PendingNavigation | null };
  timer: { current: ReturnType<typeof setTimeout> | null };
  nextAttempt: () => number;
}

const FilterNav = createContext<FilterNavigation | null>(null);

/** Dropped from every navigation, so a narrower filter never lands past the last page. */
const PAGE_PARAM = 'page';

/**
 * How long a pushed navigation gets before the self-heal fires off the back of
 * a timer rather than `useTransition`'s own settle (VEN-591).
 *
 * `pending` is Next's own signal for "this transition is still in flight", and
 * it is usually enough — but it is Next's signal, not ours, and nothing
 * guarantees it toggles back to `false` for every way a push can go missing.
 * A concurrent unrelated navigation on the same page (a prefetched `Link`
 * committing, a sibling write's `router.refresh()`) can resolve the
 * transition Next is tracking without ever landing *this* push's URL, and
 * `pending` settles as if nothing were wrong. 3s is generous next to the
 * lane's RSC round trip — generous enough that a merely slow-but-succeeding
 * navigation is not forced into a redundant hard reload on top of its own
 * soft landing — and still short enough that an admin who really is stuck
 * is not left looking at a dead control.
 */
const HEAL_TIMEOUT_MS = 3000;

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
 * the admin on a page that no longer exists.
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
  const params = useContext(FilterParams);
  const nav = useContext(FilterNav);
  /** The attempt *this* push started, so its own settle only ever acts on its own push. */
  const myAttempt = useRef<number | null>(null);
  const chosen = options.find((option) => option.value === value);

  if (params === null || nav === null) {
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
   * the admin's later choice away in favour of the earlier one.
   *
   * `heal` runs from two independent triggers (VEN-591): this effect, keyed to
   * `pending`, and a bounded timer started alongside the push — `pending` is
   * Next's signal, not ours, and nothing guarantees it settles `false` for
   * every way a push can go missing. Both triggers, from every `FilterSelect`
   * in the bar, call the *same* `heal` against the *shared* `nav.latest`
   * (VEN-591): only the push that is still `nav.latest.current` when its own
   * trigger fires ever does anything, because starting a new push overwrites
   * `nav.latest` and bumps the attempt immediately — an older push's settle or
   * timer, whichever fires, finds `nav.latest.current` already pointing at (or
   * cleared by) something newer and no-ops instead of hard-navigating back
   * over it. That is the same clobber VEN-576's `from` comparison already
   * guarded against for two transitions settling in one commit, now closed for
   * every ordering, not only that one.
   */
  const heal = useCallback(
    (attempt: number) => {
      const current = nav.latest.current;
      if (current === null || current.attempt !== attempt) return;
      nav.latest.current = null;
      if (nav.timer.current !== null) {
        clearTimeout(nav.timer.current);
        nav.timer.current = null;
      }
      const here = window.location.pathname + window.location.search;
      if (here === current.from && here !== current.to) {
        window.location.assign(current.to);
      }
    },
    [nav],
  );

  useEffect(() => {
    if (pending || myAttempt.current === null) return;
    heal(myAttempt.current);
  }, [pending, heal]);

  // Cancels the shared heal timer if this trigger unmounts mid-navigation, own attempt only.
  useEffect(() => {
    return () => {
      if (myAttempt.current !== null && nav.latest.current?.attempt === myAttempt.current) {
        if (nav.timer.current !== null) clearTimeout(nav.timer.current);
        nav.timer.current = null;
        nav.latest.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- cleanup reads refs only, not props/state
  }, []);

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
        const attempt = nav.nextAttempt();
        myAttempt.current = attempt;
        nav.latest.current = {
          from: window.location.pathname + window.location.search,
          to: url,
          attempt,
        };
        if (nav.timer.current !== null) clearTimeout(nav.timer.current);
        nav.timer.current = setTimeout(() => heal(attempt), HEAL_TIMEOUT_MS);
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
 * `method="get"`, so every filter is a URL the admin can paste into a
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
  /*
   * One `FilterNavigation` per bar, stable for its lifetime (VEN-591): every
   * `FilterSelect` inside reads and writes the *same* `latest`/`timer`, which
   * is what lets a newer choice invalidate an older one's heal regardless of
   * which dropdown made either. `useRef` rather than `useState` because
   * nothing here should ever cause the bar to re-render.
   */
  const filterNav = useRef<FilterNavigation>(null);
  filterNav.current ??= {
    latest: { current: null },
    timer: { current: null },
    nextAttempt: (() => {
      let attempt = 0;
      return () => ++attempt;
    })(),
  };

  return (
    <FilterParams.Provider value={params}>
      <FilterNav.Provider value={filterNav.current}>
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
      </FilterNav.Provider>
    </FilterParams.Provider>
  );
}
