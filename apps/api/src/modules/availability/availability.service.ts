import {
  addDays,
  AVAILABILITY_MONTHS_AHEAD,
  isUniversallyPastDate,
  toDateString,
  type Availability,
  type AvailabilityBulkUpdateInput,
} from '@vendor-marketplace/shared';
import { randomUUID } from 'node:crypto';
import type { AvailabilityRow, NewAvailabilityRow } from '@vendor-marketplace/db/schema';
import type { AppDatabase } from '../../lib/database.js';
import { conflict } from '../../lib/errors.js';
import { requireOwnVendorProfile } from '../vendors/vendors.service.js';
import {
  applyAvailability,
  findAvailabilityInRange,
  findAvailabilityOnDates,
  findLiveRequestDates,
} from './availability.dao.js';

export function toAvailability(row: AvailabilityRow): Availability {
  return row;
}

/**
 * The window the calendar covers: the **first of the month yesterday falls in**
 * through `AVAILABILITY_MONTHS_AHEAD` months out. Built by month arithmetic on the UTC
 * components rather than by adding days, so it lands on the same day-of-month
 * regardless of month length.
 *
 * It starts at the month rather than at today because the calendar renders
 * whole months, and the days already behind us in this one are not blank: a
 * `booked` date that has passed is a **completed event**, and the frame keeps
 * it on screen rather than letting delivered work vanish. Starting at today
 * put those cells outside the read, so `completed` could never appear and its
 * counter could only ever read zero.
 *
 * **A day of slack at each end, because the viewer is not on this clock** (#409).
 * The near edge is the first of **yesterday's** month: a viewer west of UTC is a
 * day behind this process, so on the 1st their own today is the previous month's
 * last day, which anchoring on the server's month left outside the read
 * entirely. The far edge counts from **tomorrow**: the calendar renders
 * `AVAILABILITY_MONTHS_AHEAD + 1` months from the *viewer's* day, so a viewer
 * east of UTC on the last day of a month reached a final month that began after
 * this bound and drew every cell in it as available. Both edges land on the same
 * day as before on every day but those two.
 *
 * Only the read widens. `setOwnAvailability` still refuses to write a date that
 * is past everywhere, and that guard is `isUniversallyPastDate`, not this floor.
 */
export function availabilityWindow(now: Date = new Date()): { from: string; to: string } {
  const yesterday = addDays(now, -1);
  const tomorrow = addDays(now, 1);
  const from = toDateString(
    new Date(Date.UTC(yesterday.getUTCFullYear(), yesterday.getUTCMonth(), 1)),
  );
  const end = new Date(
    Date.UTC(
      tomorrow.getUTCFullYear(),
      tomorrow.getUTCMonth() + AVAILABILITY_MONTHS_AHEAD,
      tomorrow.getUTCDate(),
    ),
  );

  return { from, to: toDateString(end) };
}

/**
 * The vendor's own calendar, from the two sources it has.
 *
 * Stored rows carry what someone decided — `blocked` by the vendor, `booked` by
 * their own acceptance. Live requests are overlaid here at read time as
 * `pending`, because a request is not yet a commitment: storing it would drop
 * the vendor out of every date-filtered search over a message they have not
 * answered.
 *
 * The overlay never covers a stored row. A date the vendor blocked reads
 * `blocked` even with a request sitting on it — that is the vendor's own
 * decision and it outranks somebody else's hope — and an accepted date already
 * reads `booked`.
 *
 * **Both** the GET and the PUT return through here, and that is the point of
 * extracting it. When only the GET overlaid, blocking any single date returned
 * a calendar with no overlay at all, and the client stores that response as the
 * whole calendar — so one unrelated edit turned every pending cell on screen
 * white and clickable until a reload.
 */
async function readCalendar(db: AppDatabase, vendorId: string, now: Date): Promise<Availability[]> {
  const { from, to } = availabilityWindow(now);
  const [rows, liveDates] = await Promise.all([
    findAvailabilityInRange(db, vendorId, from, to),
    findLiveRequestDates(db, vendorId, from, to, now),
  ]);

  const stored = new Set(rows.map((row) => row.date));

  const pending: Availability[] = liveDates
    .filter((date) => !stored.has(date))
    .map((date) => ({
      /*
       * A derived row has no stored id to carry. The calendar keys on `date`
       * and never sends one of these back — the bulk update only accepts
       * vendor-settable statuses — so a fresh id satisfies the contract
       * without inventing a reference to a row that does not exist.
       */
      id: randomUUID(),
      vendorId,
      date,
      status: 'pending' as const,
      note: null,
    }));

  return [...rows.map(toCalendarRow(now)), ...pending].sort((left, right) =>
    left.date.localeCompare(right.date),
  );
}

/**
 * A stored row as the calendar reads it, with `completed` derived.
 *
 * A `booked` date the vendor has already worked is a **delivered event**, and
 * the frame keeps it on the calendar rather than letting finished work vanish.
 * That is derived from the date rather than stored, because storing it needs a
 * writer that runs at midnight — and until it ran, the status would be lying.
 *
 * Derived here rather than in the component so the `Completed` counter is a
 * query result and not a number the UI invented. Only `booked` becomes
 * `completed`: a past date the vendor merely blocked was never work.
 *
 * The boundary is `isUniversallyPastDate`, not the server's UTC day (#409).
 * `completed` is a locked status, so calling it a day early told a vendor at
 * UTC-5 that this evening's booking was already delivered and took the cell
 * out of their hands. A day is only over once it is over everywhere.
 */
function toCalendarRow(now: Date): (row: AvailabilityRow) => Availability {
  return (row) =>
    row.status === 'booked' && isUniversallyPastDate(row.date, now)
      ? { ...toAvailability(row), status: 'completed' as const }
      : toAvailability(row);
}

export async function listOwnAvailability(
  db: AppDatabase,
  userId: string,
  now: Date = new Date(),
): Promise<Availability[]> {
  const vendor = await requireOwnVendorProfile(db, userId);

  return readCalendar(db, vendor.id, now);
}

/**
 * Applies a bulk calendar edit.
 *
 * Past dates are dropped silently rather than rejected: a drag across a month
 * that starts before today is an ordinary gesture, and failing the whole
 * request over it would lose the part the vendor meant. A date already held by
 * a confirmed booking is different — that is a real conflict the vendor has to
 * see, so it fails the request instead.
 *
 * **Today is not past.** A vendor blocking off the day they are standing in is
 * the most time-critical edit the calendar supports, so the floor is today
 * rather than tomorrow. What lies behind that floor is history — the status a
 * date actually had — and is never rewritten from here.
 *
 * **Whose today, though.** The floor used to be the server's UTC day, on the
 * reasoning that the calendar page built its "today" ring from the same clock
 * so the two agreed by construction. They agreed on the wrong day: a vendor at
 * UTC-5 blocking off their own evening sent a date the UTC clock had already
 * passed, and this filter dropped it — the request answered 200 and wrote
 * nothing (#409). The client now anchors on the viewer's day, and a server
 * cannot know it, so the floor here is the widest honest one:
 * `isUniversallyPastDate`, the same rule `POST /booking-requests` already
 * applies. A date is refused only once it is behind *every* visitor on Earth.
 */
export async function setOwnAvailability(
  db: AppDatabase,
  userId: string,
  input: AvailabilityBulkUpdateInput,
  now: Date = new Date(),
): Promise<Availability[]> {
  const vendor = await requireOwnVendorProfile(db, userId);

  // Last entry wins, so a range drag that overlaps itself is not ambiguous.
  const byDate = new Map(
    input.entries
      .filter((entry) => !isUniversallyPastDate(entry.date, now))
      .map((entry) => [entry.date, entry]),
  );

  if (byDate.size > 0) {
    const existing = await findAvailabilityOnDates(db, vendor.id, [...byDate.keys()]);
    const booked = existing.filter((row) => row.status === 'booked').map((row) => row.date);

    if (booked.length > 0) {
      throw conflict(
        booked.length === 1
          ? `${booked[0]} is already booked, so it cannot be changed here.`
          : `${booked.length} of those dates are already booked, so they cannot be changed here.`,
        { bookedDates: booked.sort() },
      );
    }

    const clearedDates: string[] = [];
    const blocked: NewAvailabilityRow[] = [];

    for (const entry of byDate.values()) {
      if (entry.status === 'available') {
        clearedDates.push(entry.date);
      } else {
        blocked.push({
          vendorId: vendor.id,
          date: entry.date,
          status: entry.status,
          note: entry.note ?? null,
        });
      }
    }

    await applyAvailability(db, vendor.id, clearedDates, blocked);
  }

  return readCalendar(db, vendor.id, now);
}
