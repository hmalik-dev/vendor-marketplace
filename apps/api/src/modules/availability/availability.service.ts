import {
  AVAILABILITY_MONTHS_AHEAD,
  isPastDate,
  toDateString,
  type Availability,
  type AvailabilityBulkUpdateInput,
} from '@vendor-marketplace/shared';
import type { AvailabilityRow, NewAvailabilityRow } from '@vendor-marketplace/db/schema';
import type { AppDatabase } from '../../lib/database.js';
import { conflict } from '../../lib/errors.js';
import { requireOwnVendorProfile } from '../vendors/vendors.service.js';
import {
  applyAvailability,
  findAvailabilityInRange,
  findAvailabilityOnDates,
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

export async function listOwnAvailability(
  db: AppDatabase,
  userId: string,
  now: Date = new Date(),
): Promise<Availability[]> {
  const vendor = await requireOwnVendorProfile(db, userId);
  const { from, to } = availabilityWindow(now);
  const rows = await findAvailabilityInRange(db, vendor.id, from, to);

  return rows.map(toAvailability);
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
