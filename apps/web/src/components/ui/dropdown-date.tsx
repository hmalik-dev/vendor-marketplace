'use client';

import {
  addDays,
  isPastDate,
  parseDateString,
  toDateString,
  type AvailabilityStatus,
} from '@vendor-marketplace/shared';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  CELL_AVAILABLE,
  CELL_HATCH,
  CELL_HELD,
  CELL_PAST,
  CELL_SELECTED,
  CELL_TODAY,
  CELL_UNAVAILABLE,
} from '@/components/availability/cell-marks';
import { buildMonth, describeCell, WEEKDAY_LABELS } from '@/lib/calendar';
import { cn } from '@/lib/utils';
import { Dropdown, type DropdownWidth } from './dropdown';

/**
 * Body 4 of `42-dropdowns.md`: a single-month date picker.
 *
 * It **inherits the vendor calendar's cell marks exactly** — see
 * `availability/cell-marks.ts` — because a date means the same thing on both
 * sides of the product and should not be drawn twice.
 *
 * Single month, not the vendor calendar's three: a customer is choosing one
 * day they already have in mind, and three months of scrolling is the vendor's
 * problem, not theirs.
 */

/** How a day reads to a customer choosing one. */
type DayState = 'available' | 'unavailable' | 'held' | 'past';

/**
 * The vendor's five states, collapsed to what a customer can act on.
 *
 * `booked`, `blocked` and `completed` are all "you cannot have this day"; only
 * `pending` is different, because it is the one a customer might still win.
 */
function dayStateOf(status: AvailabilityStatus | undefined): DayState {
  switch (status) {
    case 'pending':
      return 'held';
    case 'booked':
    case 'blocked':
    case 'completed':
      return 'unavailable';
    default:
      return 'available';
  }
}

const DAY_STYLES: Record<DayState, string> = {
  available: CELL_AVAILABLE,
  unavailable: CELL_UNAVAILABLE,
  held: CELL_HELD,
  past: CELL_PAST,
};

const DAY_LABELS: Record<DayState, string> = {
  available: 'available',
  unavailable: 'unavailable',
  held: 'held — someone else has asked',
  past: 'in the past',
};

export interface DateDropdownProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger: ReactNode;
  label: string;
  /** The chosen day as `YYYY-MM-DD`, or `null`. */
  value: string | null;
  onChange: (value: string | null) => void;
  /** Today, as `YYYY-MM-DD` — the viewer's own day, from `useViewerToday`. */
  today: string;
  /**
   * The vendor's calendar, keyed by date. Empty on surfaces with no vendor in
   * scope — the hero search has none, and every day there is simply choosable.
   */
  calendar?: Readonly<Record<string, AvailabilityStatus>>;
  /** How far ahead a date may be chosen. */
  monthsAhead?: number;
  width?: DropdownWidth;
  scrim?: boolean;
}

/** A year of months is as far as any of these surfaces looks. */
const DEFAULT_MONTHS_AHEAD = 12;

interface Cursor {
  year: number;
  /** Zero-based, matching `Date.getUTCMonth()`. */
  month: number;
}

/** The month a `YYYY-MM-DD` falls in, or `null` if it is not one. */
function monthOf(date: string | null | undefined): Cursor | null {
  const parsed = date == null ? null : parseDateString(date);

  return parsed === null ? null : { year: parsed.getUTCFullYear(), month: parsed.getUTCMonth() };
}

/** The last resort, when neither the value nor `today` parses. */
function currentMonth(): Cursor {
  const now = new Date();

  return { year: now.getUTCFullYear(), month: now.getUTCMonth() };
}

/** `date` moved by `days`, or `null` if it was never a calendar date. */
function shift(date: string, days: number): string | null {
  const parsed = parseDateString(date);

  return parsed === null ? null : toDateString(addDays(parsed, days));
}

/**
 * `date` moved by whole months, clamped to the target month's length.
 *
 * `Date.UTC` overflows rather than clamping — 31 January plus a month is 3
 * March — which would step PageDown past February entirely.
 */
function shiftMonths(date: string, months: number): string | null {
  const parsed = parseDateString(date);
  if (parsed === null) {
    return null;
  }

  const year = parsed.getUTCFullYear();
  const month = parsed.getUTCMonth() + months;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();

  return toDateString(new Date(Date.UTC(year, month, Math.min(parsed.getUTCDate(), lastDay))));
}

/** The day at the start of `date`'s week, or `null` if it is not a date. */
function weekStart(date: string): string | null {
  const weekday = parseDateString(date)?.getUTCDay();

  return weekday === undefined ? null : shift(date, -weekday);
}

/**
 * Every key the grid answers to, and where it puts the roving cell.
 *
 * One table rather than a map of arrow deltas beside a switch for the other
 * four: they are the same question — "which day does this key move to?" — and
 * splitting them by *how* the answer is computed put the model in two places.
 */
const KEY_MOVES: Readonly<Record<string, (from: string) => string | null>> = {
  ArrowLeft: (from) => shift(from, -1),
  ArrowRight: (from) => shift(from, 1),
  ArrowUp: (from) => shift(from, -7),
  ArrowDown: (from) => shift(from, 7),
  // Home and End mean the ends of the row, which in a calendar is the week.
  Home: (from) => weekStart(from),
  End: (from) => {
    const start = weekStart(from);

    return start === null ? null : shift(start, 6);
  },
  PageUp: (from) => shiftMonths(from, -1),
  PageDown: (from) => shiftMonths(from, 1),
};

export function DateDropdown({
  open,
  onOpenChange,
  trigger,
  label,
  value,
  onChange,
  today,
  calendar = {},
  monthsAhead = DEFAULT_MONTHS_AHEAD,
  width = 'field',
  scrim = false,
}: DateDropdownProps): React.ReactElement {
  /*
   * The month the grid opens on, and **every input to it is guarded**.
   *
   * `value` is whatever the URL carried. `?date=not-a-date` reached
   * `Number(...)` as `NaN`, `buildMonth(NaN, NaN)` built a month out of it, and
   * `Intl` threw `RangeError: Invalid time value` — a 500 for a string anyone
   * can paste into Slack, which is the defect `web-route-boundaries.md` names.
   * An unusable date opens on today instead, which is where a picker with
   * nothing to show belongs anyway.
   */
  const [cursor, setCursor] = useState(() => monthOf(value) ?? monthOf(today) ?? currentMonth());

  /*
   * Whether this picker has a vendor behind it.
   *
   * With one, the grid carries that vendor's marks and the legend explains
   * them. Without one — the landing hero, the search bar — the question is just
   * "what day?", and every future day is choosable because there is nobody it
   * could be unavailable from.
   */
  const hasMarks = Object.keys(calendar).length > 0;

  /*
   * The month the arrows may not step behind. The fallback is load-bearing, not
   * defensive: the search bar deliberately passes `''` until the viewer's day
   * resolves after mount (#409), so for the first paint there is no floor to
   * read and the current UTC month is the honest stand-in.
   */
  const floor = monthOf(today) ?? currentMonth();
  const month = buildMonth(cursor.year, cursor.month);
  const firstOfMonth = toDateString(new Date(Date.UTC(cursor.year, cursor.month, 1)));
  const firstAllowed = toDateString(new Date(Date.UTC(floor.year, floor.month, 1)));
  const lastAllowed = toDateString(new Date(Date.UTC(floor.year, floor.month + monthsAhead, 1)));

  // The arrows stop rather than wrapping: a month before today holds nothing
  // choosable, and a month past the horizon holds nothing at all.
  const canGoBack = firstOfMonth > firstAllowed;
  const canGoForward = firstOfMonth < lastAllowed;

  function step(delta: number): void {
    setCursor((current) => {
      const moved = new Date(Date.UTC(current.year, current.month + delta, 1));
      return { year: moved.getUTCFullYear(), month: moved.getUTCMonth() };
    });
  }

  /*
   * The roving tab stop — the grid keyboard model `role="grid"` was promising
   * and not implementing.
   *
   * Before this, all 42 day buttons were tab stops: reaching the control after
   * the picker meant pressing Tab forty-two times, while the arrow keys the
   * role advertises did nothing at all. A grid is one tab stop; the arrows move
   * within it.
   *
   * `null` until a key is pressed, so the stop is *derived* from what the
   * viewer is looking at — the chosen day, else today, else the first of the
   * month — and follows the month chevrons without any state to keep in sync.
   */
  const [rovingDate, setRovingDate] = useState<string | null>(null);
  const grid = useRef<HTMLDivElement>(null);
  // Set only by a key that moves the stop, so a re-render for any other reason
  // never steals focus back into the grid.
  const takeFocus = useRef(false);

  const inMonth = (date: string | null | undefined): date is string => {
    const of = monthOf(date);

    return of !== null && of.year === cursor.year && of.month === cursor.month;
  };

  /*
   * The order is what the viewer is most likely looking at: the day they chose,
   * else today, else the first of the month they are on.
   */
  const roving = [rovingDate, value, today].find(inMonth) ?? firstOfMonth;

  /*
   * The keyboard's reach, which is wider than the pointer's: the arrows cross
   * month boundaries, and the last navigable day is the last day of the last
   * month the chevrons can reach — not the first, which is what `lastAllowed`
   * marks.
   */
  const lastNavigable = toDateString(
    new Date(Date.UTC(floor.year, floor.month + monthsAhead + 1, 0)),
  );

  function moveRovingTo(target: string | null): void {
    if (target === null || target < firstAllowed || target > lastNavigable) {
      return;
    }

    /*
     * A key that does not move is not a move.
     *
     * `Home` on a Sunday and `End` on a Saturday both return where they
     * started. Arming `takeFocus` for them left the flag set with nothing to
     * clear it — the effect below is keyed on `roving`, which did not change —
     * so the *next* thing to move the roving cell stole focus into the grid.
     * Pressing `Home`, tabbing back to a month chevron and clicking it moved
     * the month and then yanked focus off the chevron, making a second month
     * step impossible without tabbing back in.
     */
    if (target === roving) {
      return;
    }

    // Only when the arrows actually crossed a boundary: a new `Cursor` object
    // holding the same two numbers is still a state change to React, and every
    // arrow press within one month would re-render the whole grid for nothing.
    const targetMonth = monthOf(target);
    if (targetMonth !== null && !inMonth(target)) {
      setCursor(targetMonth);
    }
    setRovingDate(target);
    takeFocus.current = true;
  }

  function onGridKeyDown(event: React.KeyboardEvent<HTMLDivElement>): void {
    const move = KEY_MOVES[event.key];
    if (move === undefined) {
      return;
    }

    event.preventDefault();
    moveRovingTo(move(roving));
  }

  useEffect(() => {
    if (!takeFocus.current) {
      return;
    }

    takeFocus.current = false;
    grid.current?.querySelector<HTMLButtonElement>(`[data-date="${roving}"]`)?.focus();
  }, [roving]);

  return (
    <Dropdown
      open={open}
      onOpenChange={onOpenChange}
      trigger={trigger}
      label={label}
      width={width}
      padding="form"
      scrim={scrim}
    >
      <div className="mb-2.5 flex items-center justify-between">
        <button
          type="button"
          disabled={!canGoBack}
          onClick={() => step(-1)}
          aria-label="Previous month"
          className="px-1 text-stone-600 disabled:opacity-40"
        >
          ‹
        </button>
        <span aria-live="polite" className="font-display text-[17px] text-stone-900">
          {month.label}
        </span>
        <button
          type="button"
          disabled={!canGoForward}
          onClick={() => step(1)}
          aria-label="Next month"
          className="px-1 text-stone-600 disabled:opacity-40"
        >
          ›
        </button>
      </div>

      <div
        aria-hidden="true"
        className="mb-[5px] grid grid-cols-7 gap-1 text-center text-[9.5px] font-semibold text-stone-600"
      >
        {WEEKDAY_LABELS.map((day, index) => (
          <span key={`${day}-${index}`}>{day}</span>
        ))}
      </div>

      {/*
        A grid with rows in it.

        `role="grid"` over a flat run of `gridcell`s is a malformed grid: the
        role owes rows, and a reader given cells with no row structure cannot
        say which week or which column a day is in. The week rows carry the
        column gap and the outer column carries the row gap, so the geometry is
        the single `grid-cols-7 gap-1` this replaces, to the pixel.
      */}
      <div
        ref={grid}
        role="grid"
        aria-label={label}
        onKeyDown={onGridKeyDown}
        className="flex flex-col gap-1 text-center text-[11.5px]"
      >
        {month.weeks.map((week, weekIndex) => (
          <div
            // A week is identified by the days in it; the leading and trailing
            // rows are all-padding only in the degenerate case of an empty
            // month, which `buildMonth` cannot produce.
            key={week.find((date) => date !== null) ?? `pad-week-${weekIndex}`}
            role="row"
            className="grid grid-cols-7 gap-1"
          >
            {week.map((date, index) => {
              if (date === null) {
                return <span key={`pad-${index}`} role="gridcell" aria-hidden="true" />;
              }

              const past = isPastDate(date, today);
              const state: DayState = past ? 'past' : dayStateOf(calendar[date]);
              const selected = date === value;
              const isToday = date === today;
              const choosable = state === 'available' || state === 'held';

              return (
                <button
                  key={date}
                  type="button"
                  role="gridcell"
                  data-date={date}
                  /*
                   * `aria-disabled`, not `disabled`.
                   *
                   * A `disabled` button is out of the tab order *and* skipped
                   * by the arrow keys, so a day that cannot be booked could not
                   * be reached to find out why: the grid silently jumped over
                   * every past, booked and blocked day and told nobody. It
                   * announces its state instead, and the click is refused here.
                   */
                  aria-disabled={!choosable}
                  aria-current={isToday ? 'date' : undefined}
                  /* `aria-selected`, not `aria-pressed`: a gridcell supports the
                     first and not the second, and this is a cell, not a toggle. */
                  aria-selected={selected}
                  /*
                   * The grid's one tab stop. Everything else is reachable with
                   * the arrows, which is what the `grid` role promises.
                   */
                  tabIndex={date === roving ? 0 : -1}
                  /*
                   * The stop follows focus wherever it actually lands, rather
                   * than only where the arrows put it. Without this the two can
                   * disagree — the browser restoring focus, or assistive
                   * technology moving it — and the next arrow press would then
                   * jump relative to a cell the viewer is no longer on.
                   */
                  onFocus={() => setRovingDate(date)}
                  aria-label={describeCell(date, selected ? 'selected' : DAY_LABELS[state])}
                  onClick={() => {
                    if (!choosable) {
                      return;
                    }
                    onChange(date);
                    onOpenChange(false);
                  }}
                  className={cn(
                    'rounded-md',
                    // The outlined states carry 1.5px of border, so they lose it
                    // from their padding rather than growing the row.
                    selected || isToday || state === 'held' ? 'py-[4.5px]' : 'py-1.5',
                    selected ? CELL_SELECTED : DAY_STYLES[state],
                    !selected && isToday ? CELL_TODAY : '',
                    choosable && !selected ? 'hover:bg-clay-50' : '',
                    choosable ? '' : 'cursor-not-allowed',
                  )}
                >
                  {Number(date.slice(8, 10))}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/*
        The legend explains the marks, so it appears only where there are marks
        to explain — **when a vendor is in scope**.

        The search bar and the landing hero ask "what day is your event?" with
        no vendor chosen yet: nothing there can be unavailable or held, because
        there is nobody for it to be unavailable *from*. A legend naming two
        states the grid cannot show is worse than none — it implies the picker
        knows something about those days that it does not.

        Where it does appear it draws the actual marks, not flat colour chips: a
        key of swatches cannot explain a grid whose states are told apart by
        shape.
      */}
      <div className="mt-[11px] flex items-center gap-3 border-t border-stone-200 pt-2.5 text-[11px] text-stone-600">
        {hasMarks ? (
          <>
            <span className="flex items-center gap-[5px]">
              <span aria-hidden="true" className={cn('size-3 rounded-[3px]', CELL_HATCH)} />
              Unavailable
            </span>
            <span className="flex items-center gap-[5px]">
              <span
                aria-hidden="true"
                className="box-border size-3 rounded-[3px] border-[1.2px] border-dashed border-gold-400 bg-gold-50"
              />
              Held
            </span>
          </>
        ) : null}
        <button
          type="button"
          onClick={() => {
            onChange(null);
            onOpenChange(false);
          }}
          className="ml-auto font-semibold text-clay-500"
        >
          Clear
        </button>
      </div>
    </Dropdown>
  );
}
