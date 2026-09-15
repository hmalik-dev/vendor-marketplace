import {
  and,
  asc,
  desc,
  eq,
  gt,
  gte,
  inArray,
  isNull,
  lte,
  ne,
  or,
  sql,
  type SQL,
} from 'drizzle-orm';
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
  ADMIN_REQUEST_GROUP_STATUSES,
  LIVE_BOOKING_REQUEST_STATUSES,
  type AdminRequestGroup,
  type AdminVendorNotification,
  type AdminVendorPackage,
  type AdminVendorPortfolioItem,
  type AvailabilityStatus,
  type BookingCancelledBy,
  type BookingRequestStatus,
  type BookingStatus,
  type FilterWidening,
  type PayoutModel,
} from '@vendor-marketplace/shared';
import type { AppDatabase } from '../../lib/database.js';
import { readsAs } from '../booking-requests/booking-requests.dao.js';
import { adminVendorSelection, type AdminVendorProjection } from './admin.dao.js';
import { countWidenings } from './widenings.js';

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
  status: AvailabilityStatus;
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

/**
 * Every stored calendar row in range, whatever its status. An `available` row
 * (a cancelled booking leaves one) is not a lock, but it still wins its date
 * over the request overlay exactly as it does in `readCalendar`.
 */
export async function findStoredCalendarRows(
  db: AppDatabase,
  vendorId: string,
  range: DateRange,
): Promise<StoredLockRow[]> {
  return db
    .select({ date: availability.date, status: availability.status, note: availability.note })
    .from(availability)
    .where(
      and(
        eq(availability.vendorId, vendorId),
        gte(availability.date, range.from),
        lte(availability.date, range.to),
      ),
    )
    .orderBy(asc(availability.date));
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

export interface AdminBookingDetailRow {
  id: string;
  requestId: string;
  status: BookingStatus;
  eventDate: string;
  eventLocation: string | null;
  totalAmountCents: number;
  platformFeeCents: number;
  vendorPayoutCents: number;
  payoutModel: PayoutModel;
  payoutAttempts: number;
  payoutFailureReason: string | null;
  payoutReleasedAt: Date | null;
  stripePaymentIntentId: string | null;
  stripeTransferId: string | null;
  paidAt: Date | null;
  completedAt: Date | null;
  cancelledAt: Date | null;
  cancellationReason: string | null;
  cancelledBy: BookingCancelledBy | null;
  refundAmountCents: number | null;
  disputeReason: string | null;
  createdAt: Date;
  vendorId: string;
  vendorName: string;
  vendorPayoutHold: boolean;
  customerId: string;
  customerFirstName: string;
  customerLastName: string;
  customerEmail: string;
}

/** One booking with every money and lifecycle column, and both parties (VEN-399). */
export async function findAdminBookingDetail(
  db: AppDatabase,
  bookingId: string,
): Promise<AdminBookingDetailRow | null> {
  const rows = await db
    .select({
      id: bookings.id,
      requestId: bookings.requestId,
      status: bookings.status,
      eventDate: bookings.eventDate,
      eventLocation: bookings.eventLocation,
      totalAmountCents: bookings.totalAmountCents,
      platformFeeCents: bookings.platformFeeCents,
      vendorPayoutCents: bookings.vendorPayoutCents,
      payoutModel: bookings.payoutModel,
      payoutAttempts: bookings.payoutAttempts,
      payoutFailureReason: bookings.payoutFailureReason,
      payoutReleasedAt: bookings.payoutReleasedAt,
      stripePaymentIntentId: bookings.stripePaymentIntentId,
      stripeTransferId: bookings.stripeTransferId,
      paidAt: bookings.paidAt,
      completedAt: bookings.completedAt,
      cancelledAt: bookings.cancelledAt,
      cancellationReason: bookings.cancellationReason,
      cancelledBy: bookings.cancelledBy,
      refundAmountCents: bookings.refundAmountCents,
      disputeReason: bookings.disputeReason,
      createdAt: bookings.createdAt,
      vendorId: vendorProfiles.id,
      vendorName: vendorProfiles.businessName,
      vendorPayoutHold: vendorProfiles.payoutHold,
      customerId: users.id,
      customerFirstName: users.firstName,
      customerLastName: users.lastName,
      customerEmail: users.email,
    })
    .from(bookings)
    .innerJoin(users, eq(users.id, bookings.customerId))
    .innerJoin(vendorProfiles, eq(vendorProfiles.id, bookings.vendorId))
    .where(eq(bookings.id, bookingId))
    .limit(1);

  return rows[0] ?? null;
}

export interface AdminRequestListRow {
  id: string;
  status: BookingRequestStatus;
  eventDate: string;
  vendorId: string;
  vendorName: string;
  customerFirstName: string;
  customerLastName: string;
  quotedPriceCents: number | null;
  expiresAt: Date | null;
  acceptedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AdminRequestFilters {
  group?: AdminRequestGroup | undefined;
  status?: BookingRequestStatus | undefined;
  /** The instant read at, so lazy expiry decides which group a row is in. */
  now: Date;
}

/**
 * The list's predicate, every status compared **as read** through the
 * participant query's own `readsAs` — a lapsed `pending` row is found under
 * `expired` and `lapsed`, and not under `pending` or `live`.
 */
function requestFilterCondition(filters: AdminRequestFilters): SQL | undefined {
  return and(
    filters.group
      ? or(
          ...ADMIN_REQUEST_GROUP_STATUSES[filters.group].map((status) =>
            readsAs(status, filters.now),
          ),
        )
      : undefined,
    filters.status ? readsAs(filters.status, filters.now) : undefined,
  );
}

/** The two filters the requests table can be narrowed by. */
export const REQUEST_FILTER_KEYS = ['group', 'status'] as const;
export type RequestFilterKey = (typeof REQUEST_FILTER_KEYS)[number];

/** One page of every booking request, newest first. */
export async function findAdminRequests(
  db: AppDatabase,
  filters: AdminRequestFilters,
  limit: number,
  offset: number,
): Promise<AdminRequestListRow[]> {
  return db
    .select({
      id: bookingRequests.id,
      status: bookingRequests.status,
      eventDate: bookingRequests.eventDate,
      vendorId: vendorProfiles.id,
      vendorName: vendorProfiles.businessName,
      customerFirstName: users.firstName,
      customerLastName: users.lastName,
      quotedPriceCents: bookingRequests.quotedPriceCents,
      expiresAt: bookingRequests.expiresAt,
      acceptedAt: bookingRequests.acceptedAt,
      createdAt: bookingRequests.createdAt,
      updatedAt: bookingRequests.updatedAt,
    })
    .from(bookingRequests)
    .innerJoin(users, eq(users.id, bookingRequests.customerId))
    .innerJoin(vendorProfiles, eq(vendorProfiles.id, bookingRequests.vendorId))
    .where(requestFilterCondition(filters))
    .orderBy(desc(bookingRequests.createdAt), desc(bookingRequests.id))
    .limit(limit)
    .offset(offset);
}

/** Both foreign keys cascade, so the count needs no joins to agree with the page. */
export async function countAdminRequests(
  db: AppDatabase,
  filters: AdminRequestFilters,
): Promise<number> {
  const rows = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(bookingRequests)
    .where(requestFilterCondition(filters));

  return rows[0]?.total ?? 0;
}

/** How many requests each single widening would reveal, in one scan (#454). */
export async function countRequestWidenings(
  db: AppDatabase,
  filters: AdminRequestFilters,
): Promise<FilterWidening[]> {
  return countWidenings<RequestFilterKey>({
    active: REQUEST_FILTER_KEYS.filter((key) => filters[key] !== undefined),
    conditionWithout: (dropped) => requestFilterCondition({ ...filters, [dropped]: undefined }),
    scan: (selection) => db.select(selection).from(bookingRequests),
  });
}
