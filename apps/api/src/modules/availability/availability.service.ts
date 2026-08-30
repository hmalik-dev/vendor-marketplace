import {
  AVAILABILITY_MONTHS_AHEAD,
  isPastDate,
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
 * The window the calendar covers: today through `AVAILABILITY_MONTHS_AHEAD`
 * months out. Built by month arithmetic on the UTC components rather than by
 * adding days, so it lands on the same day-of-month regardless of month length.
 */
export function availabilityWindow(now: Date = new Date()): { from: string; to: string } {
  const from = toDateString(now);
  const end = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + AVAILABILITY_MONTHS_AHEAD, now.getUTCDate()),
  );

  return { from, to: toDateString(end) };
}

/**
 * The vendor's own calendar.
 *
 * Two sources, on purpose. Stored rows carry what someone decided — `blocked`
 * by the vendor, `booked` by their own acceptance. Live requests are overlaid
 * at read time as `pending`, because a request is not yet a commitment: storing
 * it would drop the vendor out of every date-filtered search over a message
 * they have not answered.
 *
 * The overlay never covers a stored row. A date the vendor blocked reads
 * `blocked` even with a request sitting on it — that is the vendor's own
 * decision and it outranks somebody else's hope — and an accepted date already
 * reads `booked`.
 */
export async function listOwnAvailability(
  db: AppDatabase,
  userId: string,
  now: Date = new Date(),
): Promise<Availability[]> {
  const vendor = await requireOwnVendorProfile(db, userId);
  const { from, to } = availabilityWindow(now);
  const [rows, liveDates] = await Promise.all([
    findAvailabilityInRange(db, vendor.id, from, to),
    findLiveRequestDates(db, vendor.id, from, to),
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
      vendorId: vendor.id,
      date,
      status: 'pending' as const,
      note: null,
    }));

  return [...rows.map(toAvailability), ...pending].sort((left, right) =>
    left.date.localeCompare(right.date),
  );
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
 * The floor is the server's UTC day, which is the same day the calendar page
 * builds its window and its "today" ring from, so this guard and the client
 * agree by construction and the client never sends a date this drops.
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
      .filter((entry) => !isPastDate(entry.date, toDateString(now)))
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

  const { from, to } = availabilityWindow(now);
  const rows = await findAvailabilityInRange(db, vendor.id, from, to);

  return rows.map(toAvailability);
}
