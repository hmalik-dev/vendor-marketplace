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
