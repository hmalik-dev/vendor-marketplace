'use client';

import {
  isPastDate,
  parseDateString,
  toDateString,
  type AvailabilityStatus,
} from '@vendor-marketplace/shared';
import { useState, type ReactNode } from 'react';
import {
  CELL_AVAILABLE,
  CELL_HATCH,
  CELL_HELD,
  CELL_PAST,
  CELL_SELECTED,
  CELL_TODAY,
  CELL_UNAVAILABLE,
} from '@/components/availability/cell-marks';
import { buildMonth, WEEKDAY_LABELS } from '@/lib/calendar';
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

      <div
        role="grid"
        aria-label={label}
        className="grid grid-cols-7 gap-1 text-center text-[11.5px]"
      >
        {month.weeks.flat().map((date, index) => {
          if (date === null) {
            return <span key={`pad-${index}`} aria-hidden="true" />;
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
              disabled={!choosable}
              aria-current={isToday ? 'date' : undefined}
              /* `aria-selected`, not `aria-pressed`: a gridcell supports the
                 first and not the second, and this is a cell, not a toggle. */
              aria-selected={selected}
              aria-label={`${date} — ${selected ? 'selected' : DAY_LABELS[state]}`}
              onClick={() => {
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
