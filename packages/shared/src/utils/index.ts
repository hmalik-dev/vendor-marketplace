import {
  BOOKING_PAYMENT_WINDOW_DAYS,
  BOOKING_REQUEST_EXPIRY_DAYS,
  BPS_PER_UNIT,
  DEFAULT_PLATFORM_FEE_RATE,
  EXPIRABLE_BOOKING_REQUEST_STATUSES,
  HELD_PAYOUT_STATUSES,
  MAX_EVENT_DATE_MONTHS_AHEAD,
  MAX_SLUG_LENGTH,
  PAYOUT_RELEASE_HOURS,
  type BookingRequestStatus,
  type BookingStatus,
  type PayoutModel,
  type PayoutStatus,
  type RefundTerms,
} from '../constants/index.js';
import { trimTrailingSlashes } from './trim-slashes.js';

export { trimTrailingSlashes };

const SLUG_FALLBACK = 'vendor';
const CALENDAR_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MS_PER_HOUR = 60 * 60 * 1000;
const MS_PER_DAY = 24 * MS_PER_HOUR;

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

  if (expiresAt.getTime() <= now.getTime()) {
    return 'expired';
  }

  /*
   * Whole calendar days in the reader's own zone, not elapsed 24-hour blocks:
   * viewed at 22:00 with a deadline at 18:00 the next day, the deadline is 20
   * hours away and still tomorrow. `Math.round` absorbs a DST day's 23 or 25
   * hours, since both operands are local midnights.
   */
  const days = Math.round((localMidnight(expiresAt) - localMidnight(now)) / MS_PER_DAY);

  return days === 0 ? 'expires today' : `expires in ${days}d`;
}

function localMidnight(instant: Date): number {
  return new Date(instant.getFullYear(), instant.getMonth(), instant.getDate()).getTime();
}

/**
 * The status a request reads as at `now`, lazy expiry applied.
 *
 * Expiry is never swept, so the stored `status` is the value as last written: a
 * `pending` or `quoted` request whose window has closed is `expired` to every
 * reader before anything writes it. The participant's read ages the row on this
 * answer and the console reports it without writing (VEN-399) — one predicate,
 * so the two cannot disagree about the same row.
 */
export function requestStatusAsRead(
  request: { status: BookingRequestStatus; expiresAt: Date | null },
  now: Date,
): BookingRequestStatus {
  const expirable = (EXPIRABLE_BOOKING_REQUEST_STATUSES as readonly string[]).includes(
    request.status,
  );

  return expirable && request.expiresAt !== null && request.expiresAt.getTime() <= now.getTime()
    ? 'expired'
    : request.status;
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
 * arithmetic and not policy lookup: at or beyond `terms.fullRefundCutoffHours`
 * the customer gets everything back, inside it they get
 * `terms.lateRefundRateBps` of it.
 *
 * **`terms` are the booking's own**, stored when it was sold (VEN-647): a later
 * change to `FULL_REFUND_CUTOFF_HOURS` or `LATE_CANCELLATION_REFUND_RATE` must
 * not re-price a booking already paid for. Only a caller with no booking yet —
 * checkout, a quote — passes `CURRENT_REFUND_TERMS`.
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
  terms: RefundTerms,
  now: Date = new Date(),
): RefundQuote {
  if (!Number.isInteger(totalCents) || totalCents < 0) {
    throw new Error('calculateRefund: totalCents must be a non-negative integer');
  }

  const eventStart = new Date(`${eventDate}T00:00:00Z`);

  if (Number.isNaN(eventStart.getTime())) {
    throw new Error(`calculateRefund: eventDate is not a calendar date: ${eventDate}`);
  }

  const hoursUntilEvent = Math.max((eventStart.getTime() - now.getTime()) / MS_PER_HOUR, 0);
  const isFullRefund = hoursUntilEvent >= terms.fullRefundCutoffHours;

  return {
    refundCents: isFullRefund
      ? totalCents
      : Math.round((totalCents * terms.lateRefundRateBps) / BPS_PER_UNIT),
    isFullRefund,
    hoursUntilEvent,
  };
}

/** One window of the cancellation schedule, as the checkout block draws it. */
export interface RefundScheduleRow {
  /**
   * `full` and `late` are the two tiers `calculateRefund` implements; `closed`
   * is where the server stops taking a cancellation at all
   * (`isUniversallyFutureDate`); `release` is not a refund tier but the moment
   * the money stops being the platform's to refund, because it has been paid
   * out (D35); `vendor-cancels` is D31's rule, which no clock reaches.
   */
  kind: 'full' | 'late' | 'closed' | 'release' | 'vendor-cancels';
  /**
   * The first instant this row governs, inclusive — `null` for a row that is
   * not a window on the clock. Rows are contiguous and half-open: `from` up to
   * but excluding the next row's `from`.
   */
  from: Date | null;
  /**
   * The instant this row's window ends, as the customer is told it — `null`
   * for a row with no end. VEN-615: a row that states only where it starts
   * hid that the late tier ends a day before the event.
   */
  until: Date | null;
  /**
   * What a cancellation inside this window returns, or `null` where the row
   * makes no refund claim. **Never a rate and never a phrase** — the whole
   * point of the block is that the customer does not do the arithmetic.
   */
  refundCents: number | null;
}

/** The instants a booking's cancellation schedule turns on, as ISO strings. */
export interface RefundBoundaries {
  /** The last instant a cancellation is refunded in full (inclusive). */
  fullRefundEndsAt: string;
  /** The first instant the server refuses a cancellation, which ends the late tier. */
  onlineCancellationClosesAt: string;
  /** Midnight UTC on the event date — the zero point both are measured from. */
  eventStartsAt: string;
}

/**
 * The first instant at which `isUniversallyFutureDate(value)` stops holding —
 * when the server starts refusing a customer's cancellation. Derived from that
 * predicate's arithmetic, like `universallyPastFrom`, so the two cannot drift.
 */
function universallyFutureUntil(eventStart: Date): Date {
  return addDays(eventStart, -1);
}

/**
 * The full-refund end and the online-cancellation close for one booking
 * (VEN-615). `null` for a date string the parser rejects.
 *
 * When the terms' cutoff falls after the close — a cutoff under a day — the
 * full tier ends at the close, because nothing can be cancelled online after it.
 */
export function refundBoundaries(eventDate: string, terms: RefundTerms): RefundBoundaries | null {
  const eventStart = parseDateString(eventDate);

  if (eventStart === null) {
    return null;
  }

  const closes = universallyFutureUntil(eventStart);
  const cutoff = eventStart.getTime() - terms.fullRefundCutoffHours * MS_PER_HOUR;

  return {
    fullRefundEndsAt: new Date(Math.min(cutoff, closes.getTime())).toISOString(),
    onlineCancellationClosesAt: closes.toISOString(),
    eventStartsAt: eventStart.toISOString(),
  };
}

/**
 * The cancellation schedule for one booking, resolved into that booking's own
 * instants and amounts.
 *
 * **Every refund figure here comes back out of `calculateRefund`**, called at
 * an instant inside the window it labels, rather than being recomputed from
 * the rate. That is deliberate and it is acceptance 13 of #427: a block that
 * derives the tiers independently is a second implementation of the refund
 * policy, and when the two disagree the customer is holding the screenshot.
 * `refund-schedule.test.ts` samples every row against the function again.
 *
 * **There is no non-refundable tier**, because the code has none. The design
 * drew `30 days / 50% / non-refundable` and said in its own prompt that the
 * schedule was a guess; the constants are `FULL_REFUND_CUTOFF_HOURS` and
 * `LATE_CANCELLATION_REFUND_RATE`, and those are what ship. #374: "a policy
 * that promises something the code does not do is the one failure mode here
 * that creates a dispute the platform loses".
 *
 * **Online cancellation closes a day before the event** (VEN-615, ruling 1),
 * so the late tier is bounded by that instant and a `closed` row follows it:
 * a schedule that let the late tier run to the event promised a refund the
 * server refuses.
 *
 * `null` for a date string the parser rejects, matching `payoutReleaseAt`.
 */
export function refundSchedule(
  totalCents: number,
  eventDate: string,
  terms: RefundTerms,
): readonly RefundScheduleRow[] | null {
  const boundaries = refundBoundaries(eventDate, terms);

  if (boundaries === null) {
    return null;
  }

  /*
   * `calculateRefund` is inclusive at the cutoff —
   * `hoursUntilEvent >= fullRefundCutoffHours` — so the late window opens one
   * millisecond later, and the rows below stay a partition of the timeline
   * rather than two intervals that overlap at a point.
   */
  const fullEnds = new Date(boundaries.fullRefundEndsAt);
  const lateFrom = new Date(fullEnds.getTime() + 1);
  const closes = new Date(boundaries.onlineCancellationClosesAt);
  const eventStart = new Date(boundaries.eventStartsAt);
  const releaseAt = new Date(eventStart.getTime() + PAYOUT_RELEASE_HOURS * MS_PER_HOUR);
  const hasLateWindow = lateFrom.getTime() < closes.getTime();

  return [
    {
      kind: 'full',
      from: null,
      until: fullEnds,
      refundCents: calculateRefund(totalCents, eventDate, terms, fullEnds).refundCents,
    },
    ...(hasLateWindow
      ? [
          {
            kind: 'late' as const,
            from: lateFrom,
            until: closes,
            refundCents: calculateRefund(totalCents, eventDate, terms, lateFrom).refundCents,
          },
        ]
      : []),
    /*
     * No refund claim: the server refuses the cancellation from here on, so
     * there is no figure to promise.
     */
    { kind: 'closed', from: closes, until: null, refundCents: null },
    /*
     * Not a refund claim either. It is where the customer's money goes: #423
     * holds the payment until the event and releases it `PAYOUT_RELEASE_HOURS`
     * later, so past this row a cancellation is an unwind an operator has to
     * drive rather than a refund (D31).
     */
    { kind: 'release', from: releaseAt, until: null, refundCents: null },
    { kind: 'vendor-cancels', from: null, until: null, refundCents: totalCents },
  ];
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

/** The UTC hour from which no timezone is still on the previous UTC date. */
const UNWIND_WEST_OF_UTC_CUTOFF_HOUR = 12;

/**
 * The event date an account unwind counts as "still ahead" is strictly later
 * than this. Before 12:00 UTC it is **yesterday**, because a viewer west of UTC
 * is still on the previous date and their tomorrow is already this process's
 * today. From 12:00 UTC no timezone is behind, so today's event is today-or-past
 * everywhere and stays out of the refund loop: `completed` is written only when
 * the vendor presses Mark complete, so an event delivered this morning is still
 * `confirmed` and must not be refunded in full.
 */
export function unwindFloorDate(now: Date): string {
  return toDateString(now.getUTCHours() < UNWIND_WEST_OF_UTC_CUTOFF_HOUR ? addDays(now, -1) : now);
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
 * True when a calendar date is still ahead **for every visitor on Earth**, and
 * so may be refused by a server asked to treat it as already happened.
 *
 * The mirror of `isUniversallyPastDate`, and here for the same reason: a server
 * cannot know the caller's day, so the only honest claim it can make is the one
 * that holds in every zone. UTC-12 to UTC+14 puts the caller's day within one
 * of the server's, so the day *after* the server's UTC day is the earliest that
 * is future everywhere.
 *
 * Added for `completeBooking` (#409). Refusing on the server's own day told a
 * vendor east of UTC that the event they had just finished "has not happened
 * yet", because their day was already the next one — and the client's own
 * guard, reading the browser's clock, had correctly offered them the button.
 */
export function isUniversallyFutureDate(value: string, now: Date = new Date()): boolean {
  const parsed = parseDateString(value);
  if (parsed === null) {
    return false;
  }

  return parsed.getTime() > addDays(now, 1).setUTCHours(0, 0, 0, 0);
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
 * When the vendor's share of a booking on `eventDate` becomes transferable —
 * `PAYOUT_RELEASE_HOURS` after the start of the event day in UTC (D35).
 *
 * **The release is keyed to the date and to nothing else** (#423). Not to the
 * vendor marking the booking complete — the vendor is the party who benefits
 * from pressing that button, so it evidences nothing about whether the event
 * happened, and a vendor who never presses it would strand the money with no
 * owner. Not to the customer confirming either. A date is the one input both
 * sides can check and neither can move.
 *
 * **The zero point is midnight UTC on the event date**, the same one
 * `calculateRefund` measures its 48-hour cutoff from, and for the same reason:
 * `eventDate` is a `DATE` column carrying no zone, so "72 hours after the
 * event" has to mean 72 hours after *something*, and midnight UTC is the only
 * choice that does not move with the reader's timezone. D35 is deliberate that
 * this stays plain calendar arithmetic — no business days, no end-of-day
 * correction, no second timezone rule to keep in step with the first. The
 * window is wide enough to absorb the spread: the latest an event day can end
 * anywhere on Earth is 36 hours after that midnight, which leaves a day and a
 * half in hand.
 *
 * Derived on every read rather than written onto the booking, so changing
 * `PAYOUT_RELEASE_HOURS` moves every unreleased payout and reprices none of
 * them — the amount is the stored `vendor_payout_cents` and this does not touch
 * it. `null` for a date string the parser rejects, matching the helpers above.
 */
export function payoutReleaseAt(eventDate: string): Date | null {
  const eventStart = parseDateString(eventDate);

  return eventStart === null
    ? null
    : new Date(eventStart.getTime() + PAYOUT_RELEASE_HOURS * MS_PER_HOUR);
}

/**
 * True once `payoutReleaseAt` has passed — the date half of the release
 * predicate, in the one place the sweep and every surface read it from.
 *
 * The status half (confirmed or completed, never disputed or cancelled) lives
 * with the sweep, because that is a question about the row rather than about
 * the calendar. `false` for an unparseable date: a booking whose event date
 * cannot be read must not have money moved against it.
 */
export function isPayoutDue(eventDate: string, now: Date = new Date()): boolean {
  const releaseAt = payoutReleaseAt(eventDate);

  return releaseAt !== null && now.getTime() >= releaseAt.getTime();
}

/**
 * The latest event date whose payout window has closed at `now` — the sweep's
 * cut-off, so its scan is an index range on `event_date` rather than a
 * predicate evaluated per row.
 *
 * `isPayoutDue` above is the specification and this is the inversion of it:
 * `midnight(d) + hours <= now` is `d <= dateString(now - hours)`. The two are
 * one subtraction apart and read the same constant, and **`payoutDueThroughDate
 * agrees with isPayoutDue` is asserted as a property over a range of dates**
 * rather than left to be noticed — because the pair that must never disagree is
 * the date the sweep pays on and the date a vendor was shown, and that is the
 * one disagreement a payout screen cannot have.
 *
 * This was a loop walking the predicate backwards a day at a time, which could
 * not drift but had a worse failure: bounded at 60 iterations, it fell through
 * to a cut-off *later* than the true one, and a too-late cut-off on this path
 * releases money early. A closed form has no fall-through to be wrong in.
 */
export function payoutDueThroughDate(now: Date = new Date()): string {
  return toDateString(new Date(now.getTime() - PAYOUT_RELEASE_HOURS * MS_PER_HOUR));
}

/** The columns a payout's state is decided from, and nothing else. */
export interface PayoutSubject {
  status: BookingStatus;
  payoutReleasedAt: Date | null;
  stripeTransferId: string | null;
}

/**
 * Which of the three payout states a booking is in — the **one** derivation,
 * so no surface has to infer "the money is stuck" from `BOOKING_STATUSES`.
 *
 * That inference is what #423 acceptance 16 forbids, and forbidding it in prose
 * is not enough: #424 renders the pending payout and #425 renders the report
 * that holds it, and each writing its own `status === 'disputed'` is exactly how
 * a screen comes to tell a vendor their money is on its way while it is frozen.
 * This is the function all three call.
 *
 * **`failed` is deliberately not one of the states.** The row distinguishes it —
 * `payout_attempts > 0` with no `payout_released_at` — because the sweep must
 * tell a transfer that failed from one nobody has reached (acceptance 7). But a
 * failed transfer is retried every quarter of an hour and self-heals, so
 * surfacing it to a vendor would alarm them about something already in hand.
 * From outside, a payout that has not arrived is `pending`, and the reason lives
 * in the log and in `payout_failure_reason`.
 */
/**
 * What `payoutStatusOf` needs, which is **less than `PayoutSubject`**.
 *
 * `PayoutSubject` names the transfer id because `isLegacyDestinationPayout`
 * beside it reads one. This function never does — and a caller that has to
 * supply a Stripe identifier to ask a question that does not look at one either
 * invents a value or ships the id to a screen with no use for it. #425's
 * customer surface is that caller: `bookingSchema` carries the release
 * timestamp and deliberately not the Stripe ids.
 *
 * The transfer id stays *permitted* so a caller holding a whole row can pass it
 * as written; it is simply not required.
 */
export type PayoutStatusSubject = Pick<PayoutSubject, 'status' | 'payoutReleasedAt'> &
  Partial<PayoutSubject> & {
    /**
     * When both are supplied, a payout the sweep will never send reads as
     * `not-owed` — the same two facts `payoutOwedClauses` selects on. Left out,
     * the caller is asking the status question only, as the dashboard does
     * after it has already selected owed rows.
     */
    payoutModel?: PayoutModel;
    vendorPayoutCents?: number;
    /** A cancelled residual frozen by a foreign refund or an open chargeback (VEN-543). */
    residualHeld?: boolean;
  };

export function payoutStatusOf(booking: PayoutStatusSubject): PayoutStatus {
  if (booking.payoutReleasedAt) {
    return 'released';
  }

  /*
   * Membership in `HELD_PAYOUT_STATUSES`, not `=== 'disputed'`. The list is
   * what the vendor dashboard selects on too, so a hold status added to one and
   * not the other cannot happen.
   */
  if (booking.residualHeld || HELD_PAYOUT_STATUSES.some((held) => held === booking.status)) {
    return 'held';
  }

  if (
    booking.payoutModel !== undefined &&
    booking.vendorPayoutCents !== undefined &&
    (booking.payoutModel !== 'separate' || booking.vendorPayoutCents <= 0)
  ) {
    return 'not-owed';
  }

  return 'pending';
}

/** What `isPayoutFailing` needs, and nothing else. */
export type PayoutFailureSubject = PayoutStatusSubject & {
  payoutAttempts: number;
  payoutModel: PayoutModel;
  vendorPayoutCents: number;
};

/**
 * A transfer the sweep still owes, and has already tried (#432).
 *
 * **Deliberately not a fourth `PayoutStatus`.** `payoutStatusOf` omits `failed`
 * on purpose: a failed transfer is retried every quarter of an hour and
 * self-heals, so surfacing it to a *vendor* would alarm them about something
 * already in hand. An operator is the one reader who has to know, and this is
 * the fact they need — beside the shared status rather than as a rival reading
 * of it.
 *
 * **"Still owed" is half the definition, and leaving it out is a bug that never
 * clears.** `payout_attempts > 0 and not released` looks like the whole answer
 * and is not: a booking whose transfer failed once and was then *fully
 * refunded* has `vendor_payout_cents` rewritten to `0` (D37), which drops it
 * out of the sweep's own predicate for ever — so it would sit in the operator's
 * failing list permanently, pinning an alert that says the scheduled release
 * keeps trying, about a row the scheduled release will never touch again. A
 * dispute filed after a failed attempt is the same shape: it is `held`, which
 * is a different thing to say and the reason `payoutStatusOf` exists.
 *
 * So this is `payoutOwedClauses` plus an attempt, and the SQL twin in
 * `payouts.dao.ts` composes exactly that. One rule, expressed once where it has
 * to be a predicate and once where it has to be a boolean.
 */
export function isPayoutFailing(booking: PayoutFailureSubject): boolean {
  return (
    booking.payoutAttempts > 0 &&
    payoutStatusOf(booking) === 'pending' &&
    booking.payoutModel === 'separate' &&
    booking.vendorPayoutCents > 0
  );
}

/** What `isPayoutStranded` needs: the payout facts plus whether the owner can still be paid. */
export type PayoutStrandedSubject = PayoutStatusSubject & {
  payoutModel: PayoutModel;
  vendorPayoutCents: number;
  /**
   * The vendor's owner is banned or closed **and** has no connected Stripe
   * account left to send the transfer to (VEN-569). A ban or closure alone no
   * longer sets this: the sweep keeps trying — and succeeds — for a banned or
   * closed vendor who still has a working account, because a ban must not
   * change money already earned for an event that happened.
   */
  vendorUnpayable: boolean;
};

/**
 * A payout that is still owed and that the sweep will never send, because
 * there is no account left to send it to (VEN-445, narrowed by VEN-569).
 *
 * The sweep still attempts and records failures for a merely-banned-or-closed
 * vendor's row, so this is not "the sweep leaves it out" any more — it is the
 * one case even the sweep's own retries cannot self-heal. It is a flag beside
 * the shared status for the same reason `isPayoutFailing` is: an operator's
 * fact, not a fourth state a vendor or customer surface should have to draw.
 */
export function isPayoutStranded(booking: PayoutStrandedSubject): boolean {
  return (
    booking.vendorUnpayable &&
    payoutStatusOf(booking) === 'pending' &&
    booking.payoutModel === 'separate' &&
    booking.vendorPayoutCents > 0
  );
}

/**
 * True for a booking paid by the **destination charge** this product used
 * before #423 — released, with no transfer object to show for it.
 *
 * Named rather than left as a shape to be re-derived at each point of use. The
 * pair means something specific: Stripe split that charge as the card
 * succeeded, so the vendor already holds their share and there is no transfer
 * to reverse. A refund issued as though it were a modern booking would return
 * the customer's money and claw back nothing.
 *
 * Every such row was written by `0028_hold_payouts_until_the_event`'s backfill
 * and the set can never grow — nothing creates a destination charge any more.
 * It is exported anyway because the alternative is each future reader (#424,
 * #425, a reconciliation report) independently rediscovering what that pair
 * means, on the money path.
 */
export function isLegacyDestinationPayout(booking: PayoutSubject): boolean {
  return booking.payoutReleasedAt !== null && booking.stripeTransferId === null;
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
 * When an accepted request stops awaiting payment: a week from acceptance, or
 * the moment its event date is past everywhere, whichever comes first — the
 * same cap `replyDeadline` uses, so a date is never held for an event that can
 * no longer happen (VEN-433).
 */
export function paymentDeadline(acceptedAt: Date, eventDate: string): Date {
  const week = addDays(acceptedAt, BOOKING_PAYMENT_WINDOW_DAYS);
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

const LEGACY_R2_HOST = /\.r2\.(dev|cloudflarestorage\.com)$/i;
/**
 * The namespaces uploaded objects live under. The API's `STORAGE_PREFIXES` is
 * this list, so the legacy-URL rewrite below and the write guard cannot drift.
 */
export const UPLOAD_PREFIXES = [
  'vendor-profile',
  'vendor-cover',
  'portfolio',
  'customer-profile',
] as const;

const LEGACY_R2_KEY = new RegExp(`^(?:[^/]+/)?((?:${UPLOAD_PREFIXES.join('|')})/.+)$`);

/**
 * The object key inside an absolute URL that points at the Cloudflare R2 host
 * uploads were served from before they moved to Neon Object Storage, or null
 * for any other URL. The bucket segment `r2.cloudflarestorage.com` adds is
 * skipped; the key must start with a known upload prefix.
 */
function legacyR2ObjectKey(absolute: string): string | null {
  let url: URL;

  try {
    url = new URL(absolute);
  } catch {
    return null;
  }

  if (!LEGACY_R2_HOST.test(url.hostname)) {
    return null;
  }

  const path = url.pathname.replace(/^\/+/, '');

  return LEGACY_R2_KEY.exec(path)?.[1] ?? null;
}

/**
 * Turns a stored image value into a URL a browser can fetch.
 *
 * **The database stores an object key, never a host.** An absolute URL in a
 * column couples every row to the CDN it was uploaded under, so moving the CDN
 * stops being a config change and becomes a migration plus a window where the
 * data is split across two hosts. Storing the key and resolving here removes
 * that coupling permanently: changing `STORAGE_PUBLIC_URL` repoints every image with
 * no data change at all.
 *
 * Two kinds of value are deliberately passed through rather than prefixed,
 * because neither is ours to host:
 *
 * - an **absolute URL** — an auth avatar, or a row written before this change;
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

  const base = publicBaseUrl ? trimTrailingSlashes(publicBaseUrl) : publicBaseUrl;

  if (/^https?:\/\//i.test(value)) {
    const legacyKey = base ? legacyR2ObjectKey(value) : null;

    return legacyKey ? `${base}/${legacyKey}` : value;
  }

  if (value.startsWith('/')) {
    return value;
  }

  // Without a base there is no URL to build. A bare key would 404, and a bare
  // host would render the bucket root, so the honest answer is "no image".
  return base ? `${base}/${value.replace(/^\/+/, '')}` : null;
}

/**
 * An image reference as a URL parser will read it, not as it was written.
 *
 * `\` is a path separator for an http(s) URL, and `%2e` decodes to `.` before
 * the path is resolved — so the string a guard reads and the object a browser
 * fetches are two different things unless this runs first.
 *
 * **Both readers of an image reference share it, because two copies is how they
 * come to disagree.** `imageRefSchema` uses it to decide whether a value
 * traverses or escapes to another host; the API's `assertOwnedImageRefs` uses it
 * to decide whose object a reference names (#407). The guard was written with
 * its own copy of half these rules and was bypassed by one backslash.
 *
 * The whole reference is percent-decoded, repeatedly, until it stops changing
 * (VEN-537). A host that decodes twice reads `%252e%252e` as a traversal and
 * `%70ortfolio` as a namespace, and neither shows in the spelling that was
 * stored. Every pass shortens the string, so the loop ends. Decoding also
 * folds `%2f` and `%5c` into separators, which object storage does when it
 * derives the key.
 *
 * Segment resolution is deliberately left to each caller: the schema asks only
 * whether a `..` is present, and the guard resolves them away.
 */
export function normalizeImageRefPath(value: string): string {
  let current = value;

  for (;;) {
    const next = decodeOnce(current);

    if (next === current) {
      return current.replace(/\\/g, '/');
    }

    current = next;
  }
}

/**
 * One layer of percent-decoding that never throws: a malformed escape
 * (`100%`) is data, not an error, so it falls back to decoding only the ASCII
 * escapes and leaving the rest as written.
 */
function decodeOnce(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value.replace(/%([0-7][0-9a-f])/gi, (_match, hex: string) =>
      String.fromCharCode(Number.parseInt(hex, 16)),
    );
  }
}

/**
 * The inverse, for migrating rows written before keys were stored: strips a
 * known base so an absolute URL becomes the key it was always describing.
 * Anything not under that base is left exactly as it is.
 */
export function toObjectKey(publicBaseUrl: string, stored: string): string {
  const base = trimTrailingSlashes(publicBaseUrl);

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

/**
 * What free text refuses rather than strips, so the stored value is the typed
 * value (VEN-544): C0 and C1 controls other than tab, line feed and carriage
 * return (U+0000 is a Postgres 22021, a 500 for the caller), the line and
 * paragraph separators, and the zero-width space, word joiner and byte-order
 * mark, which no one types on purpose.
 */
/* eslint-disable no-control-regex */
export const REFUSED_TEXT_CHARACTERS =
  /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u0080-\u009f\u200b\u2028\u2029\u2060\ufeff]/;

/* eslint-enable no-control-regex */

const REFUSED_TEXT_CHARACTERS_GLOBAL = new RegExp(REFUSED_TEXT_CHARACTERS.source, 'g');

/** Removes what `REFUSED_TEXT_CHARACTERS` refuses, for text that did not arrive on a request body. */
export function stripRefusedText(value: string): string {
  return value.replace(REFUSED_TEXT_CHARACTERS_GLOBAL, '');
}

/**
 * Joins a list the way a person would: `a`, `a and b`, `a, b and c`.
 *
 * The same sentence is spoken in four places — the publish bar's blockers, the
 * admin list's dropped filters, search's cleared fields and the booking
 * request's restore banner — and each of them reads as prose rather than as a
 * list widget. It was written out inline in every one of them until #404 was
 * about to make it five.
 *
 * `describeBlockers` in `../constants` cannot call it: this module already
 * imports from that one, and reaching back the other way would close a cycle.
 * The other two are in `apps/web` and can, whenever a ticket is in those files.
 */
export function joinWithAnd(items: readonly string[]): string {
  if (items.length <= 1) {
    return items[0] ?? '';
  }

  return `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`;
}

/**
 * A duration as the frames say it, standing alone: `6 hours`, `1 hour`,
 * `1.5 hours`.
 *
 * Written out per call site until frame `05`'s summary rail needed a fourth
 * copy, and they disagreed — `packages-pane` rendered a one-hour package as
 * "1 hours". The decimal is kept only when it is there: `durationHours` is a
 * NUMERIC column, so a whole number arrives as `6` and must not print as `6.0`.
 *
 * One deliberate holdout, so the next reader does not take "every call site" on
 * trust: `booking-rail.tsx` writes `· 6 hour coverage`, where the number is a
 * compound adjective on `coverage` and stays singular in English however many
 * hours it names. That is a different sentence, not a missed migration.
 */
export function formatDurationHours(hours: number): string {
  return `${hours} ${hours === 1 ? 'hour' : 'hours'}`;
}

/**
 * A duration read back out of the database, as a number.
 *
 * `duration_hours` is a NUMERIC column and the driver hands those back as
 * strings, so every read of one has to parse. This is the other half of
 * `formatDurationHours`: parse at the boundary, format at the display edge, and
 * neither written out per call site — it had been, three times, in shapes that
 * disagreed about what a non-numeric string should produce.
 */
export function parseDurationHours(value: string | null): number | null {
  if (value === null) {
    return null;
  }

  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/** A `LIMIT`/`OFFSET` pair — one page of a list, as the DAOs take it. */
export interface PageWindow {
  limit: number;
  offset: number;
}

/**
 * The page a `{ page, pageSize }` query names, as SQL takes it.
 *
 * One definition, because #408 closed four reads that had none at all and the
 * arithmetic is exactly the sort that gets written out a fifth time with the
 * `- 1` missing.
 */
export function pageWindow(query: { page: number; pageSize: number }): PageWindow {
  return { limit: query.pageSize, offset: (query.page - 1) * query.pageSize };
}

/**
 * Case- and diacritic-insensitive, whitespace-collapsed matching text.
 *
 * `NFD` splits an accented character into its base letter plus a combining
 * mark, and the range strips the marks — so `José` becomes `jose` and matches
 * a customer who typed either spelling. Both sides go through this, which is
 * what makes it symmetric: `San Jose` finds `San José` **and** the reverse.
 *
 * It lives here rather than in the web app because **three processes have to
 * agree on it** since #384: the browser's category filter, the seed that
 * writes `us_cities.search_name`, and the API that normalises the customer's
 * typed query before comparing the two. A second copy of this function is a
 * city the customer can see but not find.
 */
export function normaliseForMatch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}
