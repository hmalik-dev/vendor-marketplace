import { addDays, parseDateString, toDateString } from '@vendor-marketplace/shared';

/**
 * Calendar-grid maths for the availability surface.
 *
 * Every value here is a `YYYY-MM-DD` string handled in UTC, exactly as the
 * Postgres `DATE` columns are. Nothing round-trips through a local-time `Date`,
 * so a vendor west of UTC cannot block the day before the one they clicked.
 */

const DAYS_PER_WEEK = 7;

export interface CalendarMonth {
  year: number;
  /** Zero-based, matching `Date.getUTCMonth()`. */
  month: number;
  label: string;
  /** Week rows of calendar dates; `null` pads the leading and trailing gaps. */
  weeks: (string | null)[][];
}

const MONTH_FORMATTER = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

/** Weekday initials for the grid header, Sunday first. */
export const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'] as const;

/**
 * The same seven columns, spelled out — Sunday first, matching
 * `WEEKDAY_LABELS` index for index.
 *
 * The initials are drawn for the eye and are ambiguous to the ear: `S`, `T`
 * and `S` again name two different pairs of days. Every calendar in the
 * product therefore hides the initial from assistive technology and gives the
 * column its full name instead, so a header cell has an accessible name at all.
 */
export const WEEKDAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

const ACCESSIBLE_DATE_FORMATTER = new Intl.DateTimeFormat('en-US', {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
});

/**
 * A `YYYY-MM-DD` as a person would say it — "Tuesday, October 20, 2026".
 *
 * Every calendar cell used to carry its raw ISO string as its accessible name,
 * which a screen reader reads out as a run of digits and dashes. The date is
 * the whole content of the cell, so this is the one string a non-sighted user
 * has to identify it by.
 *
 * Returns the input unchanged when it is not a calendar date — the pickers take
 * `value` straight from the URL, and `web-route-boundaries.md` forbids letting
 * an unparseable one reach `Intl`, which throws `RangeError` on it.
 */
export function formatAccessibleDate(date: string): string {
  const parsed = parseDateString(date);

  return parsed === null ? date : ACCESSIBLE_DATE_FORMATTER.format(parsed);
}

/**
 * A day cell's accessible name: the date it holds, and what it says about it.
 *
 * All three calendars in the product — the vendor's editor, the public
 * read-only pane and the customer's picker — need this, and each had its own
 * concatenation. They keep their own status vocabularies, which are genuinely
 * different (the vendor's five statuses, the picker's four customer-facing
 * states, the pane's free/not-available/past), but the shape a reader hears is
 * one thing and belongs in one place.
 */
export function describeCell(date: string, state: string): string {
  return `${formatAccessibleDate(date)} — ${state}`;
}

/** The `count` months beginning with the one `from` falls in. */
export function monthsFrom(from: string, count: number): { year: number; month: number }[] {
  const start = parseDateString(from);
  if (start === null || count <= 0) {
    return [];
  }

  return Array.from({ length: count }, (_unused, offset) => {
    const moved = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + offset, 1));
    return { year: moved.getUTCFullYear(), month: moved.getUTCMonth() };
  });
}

/** One month laid out as week rows, padded so every row holds seven cells. */
export function buildMonth(year: number, month: number): CalendarMonth {
  const first = new Date(Date.UTC(year, month, 1));
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();

  const cells: (string | null)[] = Array.from<null>({ length: first.getUTCDay() }).fill(null);
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(toDateString(new Date(Date.UTC(year, month, day))));
  }
  while (cells.length % DAYS_PER_WEEK !== 0) {
    cells.push(null);
  }

  const weeks: (string | null)[][] = [];
  for (let index = 0; index < cells.length; index += DAYS_PER_WEEK) {
    weeks.push(cells.slice(index, index + DAYS_PER_WEEK));
  }

  return { year, month, label: MONTH_FORMATTER.format(first), weeks };
}

/**
 * Every calendar date from `a` to `b` inclusive, in ascending order. The two
 * ends may arrive in either order — a drag can run backwards.
 */
export function datesBetween(a: string, b: string): string[] {
  const start = parseDateString(a);
  const end = parseDateString(b);

  if (start === null || end === null) {
    return [];
  }

  const [from, to] = start.getTime() <= end.getTime() ? [start, end] : [end, start];
  const dates: string[] = [];

  for (let cursor = from; cursor.getTime() <= to.getTime(); cursor = addDays(cursor, 1)) {
    dates.push(toDateString(cursor));
  }

  return dates;
}
