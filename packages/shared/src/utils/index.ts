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

/** Whole-dollar amounts drop the `.00` rather than padding it. */
const USD_WHOLE_FORMATTER = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

/**
 * Renders integer cents as a display price: `123456` -> `$1,234.56`, but
 * `145000` -> `$1,450`.
 *
 * Vendor prices are almost always whole dollars, and a column of `$1,450.00`
 * spends two characters per row saying nothing. The cents appear exactly when
 * they carry information — see the display-boundary table in
 * design/design-plan/01-foundations.md.
 */
export function formatPrice(cents: number): string {
  const rounded = Math.round(cents);
  const dollars = centsToDollars(rounded);

  return rounded % 100 === 0 ? USD_WHOLE_FORMATTER.format(dollars) : USD_FORMATTER.format(dollars);
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
 * The current calendar date **in the caller's own timezone**, as `YYYY-MM-DD`.
 *
 * Deliberately local rather than UTC. Everywhere else in the product a calendar
 * date is a timezone-free string and `toDateString` reads it off the UTC clock,
 * which is right for stored dates. "Today" is not one of those: it is the day on
 * the person's own wall, and in UTC+13 or UTC-11 the UTC day is a different one.
 * Using UTC here would grey out a customer's actual today, or leave yesterday
 * selectable.
 *
 * Because of that, it is only ever meaningful on the client. The server has no
 * way to know a visitor's day, so nothing server-side compares against it.
 */
export function todayDateString(now: Date = new Date()): string {
  const year = String(now.getFullYear()).padStart(4, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

/**
 * True when a calendar date falls before `today`. Today itself is not past —
 * an event happening today is still bookable.
 *
 * Both arguments are `YYYY-MM-DD`, which sorts lexicographically in calendar
 * order, so this compares strings and never builds a `Date`. A malformed value
 * is not past; it is invalid, and that is a different answer with a different
 * message.
 */
export function isPastDate(value: string, today: string): boolean {
  return parseDateString(value) !== null && value < today;
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

/**
 * True when a calendar date is in the past **for every visitor on Earth**, and
 * so may be rejected by a server that does not know the caller's timezone.
 *
 * `todayDateString` is deliberately local and therefore client-only, but the
 * API still has to refuse `?date=2020-01-01`. The widest wall-clock spread in
 * use is UTC-12 to UTC+14, so the day before the server's UTC day is the last
 * one that could still be somebody's today. Anything earlier is past
 * everywhere, which is the only claim a server can make without guessing.
 */
export function isUniversallyPastDate(value: string, now: Date = new Date()): boolean {
  const parsed = parseDateString(value);
  if (parsed === null) {
    return false;
  }

  return parsed.getTime() < addDays(now, -1).setUTCHours(0, 0, 0, 0);
}

// --- Image URLs ------------------------------------------------------------

/**
 * Turns a stored image value into a URL a browser can fetch.
 *
 * **The database stores an object key, never a host.** An absolute URL in a
 * column couples every row to the CDN it was uploaded under, so moving the CDN
 * stops being a config change and becomes a migration plus a window where the
 * data is split across two hosts. Storing the key and resolving here removes
 * that coupling permanently: changing `S3_PUBLIC_URL` repoints every image with
 * no data change at all.
 *
 * Two kinds of value are deliberately passed through rather than prefixed,
 * because neither is ours to host:
 *
 * - an **absolute URL** — a Clerk avatar, or a row written before this change;
 * - a **site-relative path** — the seeded marketing imagery under `/marketing`,
 *   which the web app serves itself.
 *
 * This is the only place resolution happens. A second one would be a second
 * source of truth, which is the thing the ticket exists to remove.
 */
export function resolveImageUrl(
  publicBaseUrl: string | undefined,
  stored: string | null | undefined,
): string | null {
  const value = stored?.trim();

  if (!value) {
    return null;
  }

  if (/^https?:\/\//i.test(value) || value.startsWith('/')) {
    return value;
  }

  const base = publicBaseUrl?.replace(/\/+$/, '');

  // Without a base there is no URL to build. A bare key would 404, and a bare
  // host would render the bucket root, so the honest answer is "no image".
  return base ? `${base}/${value.replace(/^\/+/, '')}` : null;
}

/**
 * The inverse, for migrating rows written before keys were stored: strips a
 * known base so an absolute URL becomes the key it was always describing.
 * Anything not under that base is left exactly as it is.
 */
export function toObjectKey(publicBaseUrl: string, stored: string): string {
  const base = publicBaseUrl.replace(/\/+$/, '');

  return stored.startsWith(`${base}/`) ? stored.slice(base.length + 1) : stored;
}
