import {
  BOOKING_REQUEST_EXPIRY_DAYS,
  DEFAULT_PLATFORM_FEE_RATE,
  FULL_REFUND_CUTOFF_HOURS,
  LATE_CANCELLATION_REFUND_RATE,
  MAX_EVENT_DATE_MONTHS_AHEAD,
  MAX_SLUG_LENGTH,
} from '../constants/index.js';

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

/**
 * The countdown to a stored deadline, in one voice.
 *
 * There were two implementations of this under the same name, and they
 * disagreed on the same row: the vendor's queue counted in hours below 48
 * ("expires in 60h") where the customer's card counted whole days ("expires in
 * 3d"), and only one of them had a same-day case. Two people comparing notes
 * saw two different deadlines.
 *
 * Days, everywhere, because the deadline is a week and an hour count implies a
 * precision the vendor cannot act on. `null` when there is no deadline, so a
 * caller renders nothing rather than inventing "no deadline".
 */
export function expiryCountdown(expiresAt: Date | null, now: Date = new Date()): string | null {
  if (expiresAt === null) {
    return null;
  }

  const days = Math.ceil((expiresAt.getTime() - now.getTime()) / MS_PER_DAY);

  if (days <= 0) {
    return 'expired';
  }

  return days === 1 ? 'expires today' : `expires in ${days}d`;
}

/**
 * How long ago something happened, in the shortest form a list can carry —
 * `2h`, `1d`, `14m`. Frames `07` and `16` both draw it beside a message.
 *
 * Shared rather than copied for the reason `expiryCountdown` above records: two
 * implementations of one time format is how a customer and a vendor come to see
 * different answers for the same row. This one was local to `messages-screen`
 * until the bookings rail needed the same string.
 *
 * Floors at `1m` rather than counting seconds — a message sent nine seconds ago
 * reads as "now" to a person, and "0m" reads as a bug. Empty string for a null
 * date, so a caller renders nothing rather than the word "never".
 */
export function shortTimeAgo(date: Date | null, now: number = Date.now()): string {
  if (!date) {
    return '';
  }

  const minutes = Math.floor((now - date.getTime()) / 60_000);

  if (minutes < 60) {
    return `${Math.max(minutes, 1)}m`;
  }
  if (minutes < 1_440) {
    return `${Math.floor(minutes / 60)}h`;
  }

  return `${Math.floor(minutes / 1_440)}d`;
}

/** What cancelling right now returns, and which side of the cutoff it falls. */
export interface RefundQuote {
  refundCents: number;
  /** True at or beyond the cutoff — the customer gets everything back. */
  isFullRefund: boolean;
  /** Hours between now and the start of the event day, floored at 0. */
  hoursUntilEvent: number;
}

/**
 * What a cancellation returns, decided in one place for both sides.
 *
 * D3 fixed these tiers platform-wide rather than per vendor, so this is
 * arithmetic and not policy lookup: at or beyond `FULL_REFUND_CUTOFF_HOURS`
 * the customer gets everything back, inside it they get
 * `LATE_CANCELLATION_REFUND_RATE` of it.
 *
 * **The comparison is against the start of the event day in UTC.** `eventDate`
 * is a `DATE` column and carries no time, so "48 hours before the event" has to
 * mean 48 hours before *something* — and the only choice that does not move
 * with the reader's timezone is midnight UTC on that date. Reading it in local
 * time would give a customer in Auckland and a customer in Honolulu different
 * refunds for the same cancellation on the same booking.
 *
 * The rate is applied to the total and rounded once, so the refund and the
 * amount retained always sum back to the total exactly.
 */
export function calculateRefund(
  totalCents: number,
  eventDate: string,
  now: Date = new Date(),
): RefundQuote {
  if (!Number.isInteger(totalCents) || totalCents < 0) {
    throw new Error('calculateRefund: totalCents must be a non-negative integer');
  }

  const eventStart = new Date(`${eventDate}T00:00:00Z`);

  if (Number.isNaN(eventStart.getTime())) {
    throw new Error(`calculateRefund: eventDate is not a calendar date: ${eventDate}`);
  }

  const hoursUntilEvent = Math.max((eventStart.getTime() - now.getTime()) / 3_600_000, 0);
  const isFullRefund = hoursUntilEvent >= FULL_REFUND_CUTOFF_HOURS;

  return {
    refundCents: isFullRefund ? totalCents : Math.round(totalCents * LATE_CANCELLATION_REFUND_RATE),
    isFullRefund,
    hoursUntilEvent,
  };
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

/**
 * The first instant at which `isUniversallyPastDate(value)` becomes true — the
 * moment the date stops being anybody's today, anywhere.
 *
 * Derived from that predicate's own arithmetic rather than stated separately,
 * so the two cannot drift: a caller that needs "when does this date stop
 * counting" gets exactly the answer the caller that asks "has it stopped"
 * would give. `null` for a date string the parser rejects, matching every
 * other helper here.
 */
export function universallyPastFrom(value: string): Date | null {
  const parsed = parseDateString(value);

  /*
   * `isUniversallyPastDate` fires when the UTC day *before* `now` has passed
   * the date, so the first `now` that satisfies it is two days on: one for
   * the UTC-12 tail the predicate allows, one because the comparison is
   * strict.
   */
  return parsed === null ? null : addDays(parsed, 2);
}

/**
 * When a booking request stops awaiting a reply: a week from when it was sent,
 * or the moment its event date is past everywhere, whichever comes first.
 *
 * The cap is the fix for #401. The window used to be a flat seven days, so a
 * request for an event three days out stayed "awaiting reply · expires in 4d"
 * four days *after* the event had come and gone — the vendor was still offered
 * `Accept` and `Send quote` on a date nobody could work, and the customer's
 * history showed a live negotiation over something already missed.
 *
 * The cap is the same instant `accept` starts refusing rather than a rounder
 * one, so a request is never live while unacceptable. That is also why the
 * bound is not the event date's own midnight: a request sent for today is
 * legitimate, and midnight-today has already passed, so that bound would make
 * it dead on arrival.
 *
 * **There is deliberately no floor.** `createBookingRequest` accepts a date up
 * to one UTC day back — it cannot know the caller's timezone, and that day may
 * still be their today — so a request sent at the very edge of its date is born
 * with hours to live. That is the honest answer rather than a defect: the
 * window is short because the date is nearly gone. A floor would have to invent
 * a minimum this product has not decided on, and it would have to grant it past
 * the point `accept` refuses, which is the one thing this cap exists to
 * prevent.
 */
export function replyDeadline(createdAt: Date, eventDate: string): Date {
  const week = addDays(createdAt, BOOKING_REQUEST_EXPIRY_DAYS);
  const cap = universallyPastFrom(eventDate);

  return cap !== null && cap.getTime() < week.getTime() ? cap : week;
}

/**
 * True when a calendar date is further ahead than the product will accept.
 *
 * The mirror of `isUniversallyPastDate`, and the bound that was missing: the
 * floor was enforced and the ceiling was not, so `9999-12-31` was a valid event
 * date. Counted in months rather than days so it lands on the same day of the
 * month regardless of month length, the way `availabilityWindow` does.
 */
export function isBeyondBookingHorizon(value: string, now: Date = new Date()): boolean {
  const parsed = parseDateString(value);
  if (parsed === null) {
    return false;
  }

  const horizon = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth() + MAX_EVENT_DATE_MONTHS_AHEAD,
      now.getUTCDate(),
      23,
      59,
      59,
      999,
    ),
  );

  return parsed.getTime() > horizon.getTime();
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

/**
 * A JSON-LD payload, serialised so it cannot end the `<script>` element that
 * carries it.
 *
 * `JSON.stringify` escapes what JSON needs and nothing HTML needs, so a vendor
 * whose business name contains `</script><script>alert(1)</script>` closed the
 * element and got a second one — stored XSS on the most-visited public page in
 * the product, found by the 2026-09-04 sweep (#398). React's escaping does not
 * apply here: the string reaches the DOM through `dangerouslySetInnerHTML`,
 * which is the only way to put JSON-LD on a page.
 *
 * Escaped, in order: `<` and `>` so no tag can be closed or opened, `&` so the
 * first two cannot be smuggled back in as entities, and U+2028/U+2029, which
 * are legal in JSON strings and illegal in JavaScript source. The `\uXXXX`
 * forms are still valid JSON, so a crawler parses exactly the object handed in.
 */
export function serialiseJsonLd(payload: unknown): string {
  return JSON.stringify(payload)
    .replace(/&/g, '\\u0026')
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

/**
 * The Unicode bidirectional formatting characters, which reorder the text
 * around them without being visible themselves.
 *
 * U+202A–U+202E are the legacy embedding and override codes; U+2066–U+2069 are
 * the isolates that replaced them. An override in a venue name reverses the
 * sentence it sits in, so a booking for `Barr Mansion` can be made to read as
 * one for somewhere else on the vendor's screen while the stored value says
 * otherwise — the same trick as a filename that appears to end in `.txt`.
 *
 * Stripped rather than escaped, and stripped on the way in rather than at each
 * of the dozen places text is rendered: no legitimate business name, venue or
 * message needs one, every surface is a different escaping context, and the
 * database is what a dispute is read out of. Ordinary right-to-left text is
 * untouched — the letters carry their own direction, and only these eight
 * codepoints override it.
 */
const BIDI_CONTROLS = /[\u202a-\u202e\u2066-\u2069]/g;

export function stripBidiControls(value: string): string {
  return value.replace(BIDI_CONTROLS, '');
}
