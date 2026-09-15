import {
  addDays,
  ADMIN_VENDOR_DETAIL_NOTIFICATION_LIMIT,
  toDateString,
  type AdminAvailabilityLock,
  type AdminVendorDetail,
} from '@vendor-marketplace/shared';
import type { AppDatabase } from '../../lib/database.js';
import { notFound } from '../../lib/errors.js';
import { availabilityWindow } from '../availability/availability.service.js';
import {
  countNotificationsForAdmin,
  findAdminVendorDetail,
  findBookingsHoldingDates,
  findLiveRequestsHoldingDates,
  findRecentNotificationsForAdmin,
  findStoredLocks,
  findVendorPackagesForAdmin,
  findVendorPortfolioForAdmin,
  type DateRange,
  type LockBookingRow,
  type LockRequestRow,
  type StoredLockRow,
} from './admin-detail.dao.js';
import { fullName, toVendorRow } from './admin.service.js';

/**
 * The console's detail reads (VEN-380): one record and everything hanging off
 * it, each a query at request time. Nothing is cached and nothing is counted
 * client-side, so every number the detail prints is a result, not an estimate.
 */

/**
 * The dates a lock read covers.
 *
 * From **yesterday** rather than today, for the reason `availabilityWindow`
 * gives: a viewer west of UTC is a day behind this process, and their today's
 * booking must not fall off the list. Through the calendar's own horizon, which
 * is as far as a vendor can hold a date.
 */
function lockRange(now: Date): DateRange {
  return { from: toDateString(addDays(now, -1)), to: availabilityWindow(now).to };
}

function groupByDate<T extends { eventDate: string }>(rows: readonly T[]): Map<string, T[]> {
  const grouped = new Map<string, T[]>();

  for (const row of rows) {
    grouped.set(row.eventDate, [...(grouped.get(row.eventDate) ?? []), row]);
  }

  return grouped;
}

/**
 * What holds each date, composed the way the vendor's calendar composes it.
 *
 * A stored row wins its date, exactly as `readCalendar` overlays: `blocked` is
 * the vendor's own decision and `booked` their acceptance. A live request makes
 * a date `pending` only where nothing is stored.
 *
 * A `booked` date lists the bookings standing on it, and **an empty list is the
 * finding**: the calendar refuses the date while nothing holds it, which is the
 * stale lock an operator arrives asking about.
 */
export function composeLocks(
  stored: readonly StoredLockRow[],
  requests: readonly LockRequestRow[],
  heldBookings: readonly LockBookingRow[],
): AdminAvailabilityLock[] {
  const requestsByDate = groupByDate(requests);
  const bookingsByDate = groupByDate(heldBookings);
  const storedDates = new Set(stored.map((row) => row.date));

  const storedLocks: AdminAvailabilityLock[] = stored.map((row) => ({
    date: row.date,
    status: row.status,
    note: row.note,
    holders:
      row.status === 'booked'
        ? (bookingsByDate.get(row.date) ?? []).map((booking) => ({
            kind: 'booking' as const,
            id: booking.id,
            customerName: fullName(booking.firstName, booking.lastName),
            status: booking.status,
          }))
        : [],
  }));

  const pendingLocks: AdminAvailabilityLock[] = [...requestsByDate]
    .filter(([date]) => !storedDates.has(date))
    .map(([date, held]) => ({
      date,
      status: 'pending' as const,
      note: null,
      holders: held.map((request) => ({
        kind: 'request' as const,
        id: request.id,
        customerName: fullName(request.firstName, request.lastName),
        status: request.status,
        expiresAt: request.expiresAt,
      })),
    }));

  return [...storedLocks, ...pendingLocks].sort((left, right) =>
    left.date.localeCompare(right.date),
  );
}

/** `GET /admin/vendors/:vendorId`. */
export async function readVendorDetail(
  db: AppDatabase,
  vendorId: string,
  now: Date,
): Promise<AdminVendorDetail> {
  const vendor = await findAdminVendorDetail(db, vendorId);

  if (!vendor) {
    throw notFound('No vendor with that id');
  }

  const range = lockRange(now);
  const [packages, portfolio, stored, requests, heldBookings, recent, counts] = await Promise.all([
    findVendorPackagesForAdmin(db, vendorId),
    findVendorPortfolioForAdmin(db, vendorId),
    findStoredLocks(db, vendorId, range),
    findLiveRequestsHoldingDates(db, vendorId, range, now),
    findBookingsHoldingDates(db, vendorId, range),
    findRecentNotificationsForAdmin(db, vendor.userId, ADMIN_VENDOR_DETAIL_NOTIFICATION_LIMIT),
    countNotificationsForAdmin(db, vendor.userId),
  ]);

  return {
    vendor: {
      ...toVendorRow(vendor),
      email: vendor.email,
      ownerName: fullName(vendor.firstName, vendor.lastName),
      responseTimeHours: vendor.responseTimeHours,
      serviceRadiusKm: vendor.serviceRadiusKm,
      travelsBeyondRadius: vendor.travelsBeyondRadius,
      isPublished: vendor.isPublished,
      moderationHold: vendor.moderationHold,
      payoutHold: vendor.payoutHold,
    },
    packages,
    portfolio,
    locks: composeLocks(stored, requests, heldBookings),
    notifications: { ...counts, items: recent },
  };
}
