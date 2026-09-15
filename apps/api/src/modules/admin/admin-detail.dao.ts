import { and, asc, desc, eq, gt, gte, inArray, isNull, lte, ne, or, sql } from 'drizzle-orm';
import {
  availability,
  bookingRequests,
  bookings,
  notifications,
  portfolioItems,
  servicePackages,
  users,
  vendorProfiles,
} from '@vendor-marketplace/db/schema';
import {
  LIVE_BOOKING_REQUEST_STATUSES,
  type AdminVendorNotification,
  type AdminVendorPackage,
  type AdminVendorPortfolioItem,
  type BookingRequestStatus,
  type BookingStatus,
} from '@vendor-marketplace/shared';
import type { AppDatabase } from '../../lib/database.js';
import { adminVendorSelection, type AdminVendorProjection } from './admin.dao.js';

/**
 * The reads behind the console's detail views (VEN-380). Policy — what counts
 * as a lock, what a missing vendor answers — lives in `admin-detail.service.ts`;
 * this file only asks Postgres.
 */

export interface AdminVendorDetailProjection extends AdminVendorProjection {
  email: string;
  firstName: string;
  lastName: string;
  responseTimeHours: number | null;
  serviceRadiusKm: number | null;
  travelsBeyondRadius: boolean;
  payoutHold: boolean;
}

/** An inclusive `YYYY-MM-DD` range. */
export interface DateRange {
  from: string;
  to: string;
}

export interface StoredLockRow {
  date: string;
  status: 'booked' | 'blocked';
  note: string | null;
}

export interface LockRequestRow {
  id: string;
  eventDate: string;
  status: BookingRequestStatus;
  expiresAt: Date | null;
  firstName: string;
  lastName: string;
}

export interface LockBookingRow {
  id: string;
  eventDate: string;
  status: BookingStatus;
  firstName: string;
  lastName: string;
}

/**
 * One vendor with the Vendors table's projection and the columns only the
 * detail shows. Retired vendors are read too: the detail is where an operator
 * learns what happened to one.
 */
export async function findAdminVendorDetail(
  db: AppDatabase,
  vendorId: string,
): Promise<AdminVendorDetailProjection | null> {
  const rows = await db
    .select({
      ...adminVendorSelection(),
      email: users.email,
      firstName: users.firstName,
      lastName: users.lastName,
      responseTimeHours: vendorProfiles.responseTimeHours,
      serviceRadiusKm: vendorProfiles.serviceRadiusKm,
      travelsBeyondRadius: vendorProfiles.travelsBeyondRadius,
      payoutHold: vendorProfiles.payoutHold,
    })
    .from(vendorProfiles)
    .innerJoin(users, eq(users.id, vendorProfiles.userId))
    .where(eq(vendorProfiles.id, vendorId))
    .limit(1);

  return rows[0] ?? null;
}

/** Every package, active or not, in the order the storefront shows them. */
export async function findVendorPackagesForAdmin(
  db: AppDatabase,
  vendorId: string,
): Promise<AdminVendorPackage[]> {
  return db
    .select({
      id: servicePackages.id,
      name: servicePackages.name,
      priceCents: servicePackages.priceCents,
      priceType: servicePackages.priceType,
      isActive: servicePackages.isActive,
      moderationHold: servicePackages.moderationHold,
    })
    .from(servicePackages)
    .where(eq(servicePackages.vendorId, vendorId))
    .orderBy(asc(servicePackages.displayOrder), asc(servicePackages.createdAt));
}

/** Every portfolio photo, cover first. */
export async function findVendorPortfolioForAdmin(
  db: AppDatabase,
  vendorId: string,
): Promise<AdminVendorPortfolioItem[]> {
  return db
    .select({
      id: portfolioItems.id,
      imageUrl: portfolioItems.imageUrl,
      thumbnailUrl: portfolioItems.thumbnailUrl,
      caption: portfolioItems.caption,
      displayOrder: portfolioItems.displayOrder,
    })
    .from(portfolioItems)
    .where(eq(portfolioItems.vendorId, vendorId))
    .orderBy(asc(portfolioItems.displayOrder), asc(portfolioItems.createdAt));
}

/** The stored holds in range — `booked` by an acceptance, `blocked` by the vendor. */
export async function findStoredLocks(
  db: AppDatabase,
  vendorId: string,
  range: DateRange,
): Promise<StoredLockRow[]> {
  const rows = await db
    .select({ date: availability.date, status: availability.status, note: availability.note })
    .from(availability)
    .where(
      and(
        eq(availability.vendorId, vendorId),
        gte(availability.date, range.from),
        lte(availability.date, range.to),
        inArray(availability.status, ['booked', 'blocked']),
      ),
    )
    .orderBy(asc(availability.date));

  return rows.flatMap((row) =>
    row.status === 'booked' || row.status === 'blocked' ? [{ ...row, status: row.status }] : [],
  );
}

/**
 * The live requests in range, with the customer who sent each.
 *
 * The same liveness `findLiveRequestDates` applies to the vendor's calendar,
 * lazy expiry included, so the console names exactly the requests that hold a
 * cell there and never one the customer gave up on.
 */
export async function findLiveRequestsHoldingDates(
  db: AppDatabase,
  vendorId: string,
  range: DateRange,
  now: Date,
): Promise<LockRequestRow[]> {
  return db
    .select({
      id: bookingRequests.id,
      eventDate: bookingRequests.eventDate,
      status: bookingRequests.status,
      expiresAt: bookingRequests.expiresAt,
      firstName: users.firstName,
      lastName: users.lastName,
    })
    .from(bookingRequests)
    .innerJoin(users, eq(users.id, bookingRequests.customerId))
    .where(
      and(
        eq(bookingRequests.vendorId, vendorId),
        gte(bookingRequests.eventDate, range.from),
        lte(bookingRequests.eventDate, range.to),
        inArray(bookingRequests.status, [...LIVE_BOOKING_REQUEST_STATUSES]),
        or(isNull(bookingRequests.expiresAt), gt(bookingRequests.expiresAt, now)),
      ),
    )
    .orderBy(asc(bookingRequests.eventDate), asc(bookingRequests.createdAt));
}

/** Bookings in range that still hold their date — anything but cancelled. */
export async function findBookingsHoldingDates(
  db: AppDatabase,
  vendorId: string,
  range: DateRange,
): Promise<LockBookingRow[]> {
  return db
    .select({
      id: bookings.id,
      eventDate: bookings.eventDate,
      status: bookings.status,
      firstName: users.firstName,
      lastName: users.lastName,
    })
    .from(bookings)
    .innerJoin(users, eq(users.id, bookings.customerId))
    .where(
      and(
        eq(bookings.vendorId, vendorId),
        gte(bookings.eventDate, range.from),
        lte(bookings.eventDate, range.to),
        ne(bookings.status, 'cancelled'),
      ),
    )
    .orderBy(asc(bookings.eventDate), asc(bookings.createdAt));
}

/** The most recent notifications sent to one account, newest first. */
export async function findRecentNotificationsForAdmin(
  db: AppDatabase,
  userId: string,
  limit: number,
): Promise<AdminVendorNotification[]> {
  return db
    .select({
      id: notifications.id,
      type: notifications.type,
      title: notifications.title,
      createdAt: notifications.createdAt,
      readAt: notifications.readAt,
    })
    .from(notifications)
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt), desc(notifications.id))
    .limit(limit);
}

/** Both counts in the Notifications card's band, from one scan. */
export async function countNotificationsForAdmin(
  db: AppDatabase,
  userId: string,
): Promise<{ total: number; unread: number }> {
  const rows = await db
    .select({
      total: sql<number>`count(*)::int`,
      unread: sql<number>`(count(*) filter (where ${notifications.readAt} is null))::int`,
    })
    .from(notifications)
    .where(eq(notifications.userId, userId));

  return rows[0] ?? { total: 0, unread: 0 };
}
