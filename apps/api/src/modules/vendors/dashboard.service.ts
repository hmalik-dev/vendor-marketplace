import {
  BOOKING_WEEK_WINDOW_DAYS,
  addDays,
  parseDateString,
  toDateString,
  type AvailabilityStatus,
  type VendorDashboard,
} from '@vendor-marketplace/shared';
import type { AppDatabase } from '../../lib/database.js';
import { countActivePackages } from '../packages/packages.dao.js';
import {
  countBookingsBetween,
  countPendingRequests,
  countResponses,
  findCalendarBetween,
  findCategoryIds,
  findNextPayout,
  sumPayoutsBetween,
} from './dashboard.dao.js';
import { publishBlockers, requireOwnVendorProfile } from './vendors.service.js';

/** The window the response rate is measured over, as the frame labels it. */
const RESPONSE_WINDOW_DAYS = 30;

/** `YYYY-MM-01` for the month `date` falls in, and for the one before it. */
function monthBounds(date: string): { start: string; next: string; previous: string } {
  const [year, month] = date.split('-').map(Number);
  const pad = (value: number): string => String(value).padStart(2, '0');

  const startYear = year ?? 1970;
  const startMonth = month ?? 1;

  const nextMonth = startMonth === 12 ? 1 : startMonth + 1;
  const nextYear = startMonth === 12 ? startYear + 1 : startYear;
  const previousMonth = startMonth === 1 ? 12 : startMonth - 1;
  const previousYear = startMonth === 1 ? startYear - 1 : startYear;

  return {
    start: `${startYear}-${pad(startMonth)}-01`,
    next: `${nextYear}-${pad(nextMonth)}-01`,
    previous: `${previousYear}-${pad(previousMonth)}-01`,
  };
}

/**
 * The dates the `This week` strip can cover, and the exclusive bound to read to.
 *
 * **Nine days from yesterday, not seven from today.** The strip shows seven, but
 * which seven depends on the viewer's own day, and a server cannot know it: west
 * of UTC the vendor is a day behind this process, east of UTC a day ahead. So it
 * sends the union — the day before the UTC day through the day after the week —
 * and `WeekStrip` slices its seven from whichever day the browser is on. Before
 * this the rail's "This week" simply began tomorrow for any vendor in a US
 * evening, and did not contain the day they were living in. #409.
 *
 * Stepped with the shared `addDays`/`toDateString` pair rather than by adding to
 * the day-of-month, so a window crossing a month or year boundary is the
 * calendar's problem and not this function's, and no date round-trips through a
 * local-time `Date`.
 */
function windowFrom(today: string): { days: string[]; end: string } {
  // `today` reaches here from `toDateString`, so it always parses; the
  // fallback exists because `parseDateString` is honest about malformed input
  // rather than because this caller can produce any.
  const utcDay = parseDateString(today) ?? new Date(`${today}T00:00:00.000Z`);
  const start = addDays(utcDay, -1);
  const days = Array.from({ length: BOOKING_WEEK_WINDOW_DAYS }, (_, offset) =>
    toDateString(addDays(start, offset)),
  );

  return { days, end: toDateString(addDays(start, BOOKING_WEEK_WINDOW_DAYS)) };
}

/**
 * The vendor's own dashboard figures.
 *
 * Every number is recomputed from source rows on read — none is a counter
 * something else increments, which is the rule that keeps a derived figure from
 * drifting away from the rows it claims to describe.
 *
 * `publishBlockers` is the **same function the publish gate uses**, not a
 * parallel list: a checklist that disagrees with the gate is worse than none,
 * because it tells the vendor they are ready when the gate will refuse them.
 */
export async function getVendorDashboard(
  db: AppDatabase,
  userId: string,
  now: Date = new Date(),
): Promise<VendorDashboard> {
  const vendor = await requireOwnVendorProfile(db, userId);
  /*
   * The UTC day, not the server's local one. #391.
   *
   * `todayDateString` was used here, and its own contract forbids it: it is the
   * day on the *caller's* wall, "only ever meaningful on the client", and the
   * server has no way to know a visitor's day. Every bound derived below is
   * either compared against a `date` column or pinned to `T00:00:00.000Z` and
   * compared against a `timestamptz` — both of which are UTC — so anchoring on
   * a local day produced a **local month with UTC edges**, wrong by the
   * server's offset at each end. In `America/Chicago` a vendor's
   * `earningsThisMonthCents` silently dropped every payment taken after 19:00
   * on the last day of the month; east of UTC it claimed the previous month's.
   * Nothing errored — the figure was simply short, on the one screen where a
   * vendor checks what they are owed.
   *
   * This is the same collapse `dao-clock-guard.test.ts` already polices in the
   * DAOs: an instant becoming a day is the step that consults a clock, and the
   * only clock a server may consult is UTC.
   */
  const today = toDateString(now);
  const { start, next, previous } = monthBounds(today);

  const since = new Date(now.getTime() - RESPONSE_WINDOW_DAYS * 86_400_000);
  // `[today - 1, today + 8)` — `end` is exclusive, so the tenth day never
  // leaks in. Nine days, because the seven the strip draws start on the
  // viewer's day and not on this one.
  const { days: windowDays, end: windowEnd } = windowFrom(today);

  const [
    newRequestCount,
    bookingsThisMonth,
    bookingsLastMonth,
    responses,
    earningsThisMonthCents,
    calendar,
    nextPayout,
    categoryIds,
    activePackageCount,
  ] = await Promise.all([
    countPendingRequests(db, vendor.id),
    countBookingsBetween(db, vendor.id, start, next),
    countBookingsBetween(db, vendor.id, previous, start),
    countResponses(db, vendor.id, since),
    sumPayoutsBetween(
      db,
      vendor.id,
      new Date(`${start}T00:00:00.000Z`),
      new Date(`${next}T00:00:00.000Z`),
    ),
    findCalendarBetween(db, vendor.id, windowDays[0] ?? today, windowEnd),
    findNextPayout(db, vendor.id, today),
    findCategoryIds(db, vendor.id),
    countActivePackages(db, vendor.id),
  ]);

  const rating = Number.parseFloat(vendor.avgRating);
  const byDate = new Map(calendar.map((row) => [row.date, row.status]));

  return {
    newRequestCount,
    bookingsThisMonth,
    bookingsLastMonth,
    // `null`, not 0 — a vendor nobody has asked has no rate to report.
    responseRate: responses.offered === 0 ? null : responses.answered / responses.offered,
    avgRating: Number.isFinite(rating) ? rating : 0,
    reviewCount: vendor.reviewCount,
    earningsThisMonthCents,
    isPublished: vendor.isPublished,
    publishBlockers: publishBlockers(vendor, categoryIds, activePackageCount),
    stripeOnboarded: vendor.stripeOnboarded,
    /*
     * Every day in the window, in order — not only the ones with a row. The
     * calendar is sparse, so an absent row is the vendor's default state and
     * has to be filled in here rather than left as a hole the strip would have
     * to guess at.
     */
    bookingWindow: windowDays.map((date) => ({
      date,
      status: byDate.get(date) ?? ('available' as AvailabilityStatus),
    })),
    nextPayout,
  };
}
