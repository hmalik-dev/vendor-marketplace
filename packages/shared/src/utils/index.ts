import { DEFAULT_PLATFORM_FEE_RATE, MAX_SLUG_LENGTH } from '../constants/index.js';

const SLUG_FALLBACK = 'vendor';
const CALENDAR_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Builds a URL-safe slug from arbitrary user input. Accented Latin characters
 * are transliterated via NFD decomposition; scripts with no ASCII equivalent
 * (CJK, emoji) are dropped, so callers must treat the fallback as a collision
 * candidate and disambiguate against the unique `vendor_profiles.slug` index.
 */
export function generateSlug(input: string): string {
  const slug = input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    // Elide apostrophes so "Bella's" slugs to "bellas", not "bella-s".
    .replace(/['\u2018\u2019]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/-+$/g, '');

  return slug.length > 0 ? slug : SLUG_FALLBACK;
}

/** Converts a dollar amount to integer cents, rounding to the nearest cent. */
export function dollarsToCents(dollars: number): number {
  return Math.round(dollars * 100);
}

/** Converts integer cents to a dollar amount with two decimal places. */
export function centsToDollars(cents: number): number {
  return Math.round(cents) / 100;
}

const USD_FORMATTER = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
});

/** Renders integer cents as a display price, e.g. `123456` -> `$1,234.56`. */
export function formatPrice(cents: number): string {
  return USD_FORMATTER.format(centsToDollars(cents));
}

export interface FeeBreakdown {
  totalCents: number;
  platformFeeCents: number;
  vendorPayoutCents: number;
}

/**
 * Splits a booking total into the platform commission and the vendor payout.
 * The payout is the remainder rather than a second rounded product, so the two
 * parts always sum back to the total exactly.
 */
export function calculateFees(
  totalCents: number,
  rate: number = DEFAULT_PLATFORM_FEE_RATE,
): FeeBreakdown {
  if (!Number.isInteger(totalCents)) {
    throw new Error('calculateFees: totalCents must be an integer number of cents');
  }
  if (totalCents < 0) {
    throw new Error('calculateFees: totalCents must not be negative');
  }
  if (!Number.isFinite(rate) || rate < 0 || rate >= 1) {
    throw new Error('calculateFees: rate must be a fraction in [0, 1)');
  }

  const platformFeeCents = Math.round(totalCents * rate);
  return {
    totalCents,
    platformFeeCents,
    vendorPayoutCents: totalCents - platformFeeCents,
  };
}

/**
 * Formats a Date as a `YYYY-MM-DD` calendar date in UTC. Event dates are stored
 * as Postgres `DATE` values with no timezone conversion, so every conversion in
 * the codebase goes through UTC to avoid off-by-one-day drift.
 */
/** Exact statute miles in a kilometre. */
const KM_PER_MILE = 1.609344;

/**
 * Service areas are stored in kilometres and shown in miles, the same way money
 * is stored in cents and shown in dollars — one canonical unit in the database,
 * converted at the display boundary.
 *
 * Both directions round to a whole number, so a value that survives a
 * round-trip through the UI lands back within a mile of where it started.
 */
export function kmToMiles(km: number): number {
  return Math.round(km / KM_PER_MILE);
}

export function milesToKm(miles: number): number {
  return Math.round(miles * KM_PER_MILE);
}

export function toDateString(date: Date): string {
  const isoDate = date.toISOString().slice(0, 10);
  return isoDate;
}

/**
 * Parses a `YYYY-MM-DD` calendar date into a UTC-midnight Date. Returns null
 * for malformed input and for impossible dates such as `2026-02-30`, which
 * `Date.parse` would otherwise roll forward silently.
 */
export function parseDateString(value: string): Date | null {
  if (!CALENDAR_DATE_PATTERN.test(value)) {
    return null;
  }

  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  // Reject rolled-over dates (e.g. 2026-02-30 -> 2026-03-02).
  return toDateString(parsed) === value ? parsed : null;
}

/** Returns a new Date `days` later. The input is never mutated. */
export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * MS_PER_DAY);
}

/**
 * True when a calendar date falls strictly after the current UTC day. Today is
 * not a future date — bookings and availability edits require a later day.
 */
export function isFutureDate(value: string, now: Date = new Date()): boolean {
  const parsed = parseDateString(value);
  if (parsed === null) {
    return false;
  }

  const today = parseDateString(toDateString(now));
  return today !== null && parsed.getTime() > today.getTime();
}
