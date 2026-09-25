import {
  addDays,
  ADMIN_CUSTOMER_DETAIL_LIST_LIMIT,
  ADMIN_DETAIL_NOTIFICATION_LIMIT,
  isPayoutFailing,
  isPayoutStranded,
  LIVE_BOOKING_REQUEST_STATUSES,
  pageWindow,
  payoutStatusOf,
  requestStatusAsRead,
  toDateString,
  type AdminAvailabilityLock,
  type AdminBookingDetail,
  type AdminCustomerDetail,
  type AdminNotifications,
  type AdminLockHolder,
  type AdminRequestPage,
  type AdminRequestQuery,
  type AdminVendorDetail,
  type BookingRequestStatus,
  type TaxIdState,
} from '@vendor-marketplace/shared';
import type { AppDatabase } from '../../lib/database.js';
import { notFound } from '../../lib/errors.js';
import type { StripeConnectGateway } from '../../lib/stripe.js';
import { availabilityWindow } from '../availability/availability.service.js';
import {
  countAdminRequests,
  countNotificationsForAdmin,
  countRequestWidenings,
  findAdminBookingDetail,
  findAdminCustomerDetail,
  findCustomerBookingsForAdmin,
  findCustomerReviewsForAdmin,
  findAdminRequests,
  findAdminVendorDetail,
  findBookingsHoldingDates,
  findLiveRequestsHoldingDates,
  findRecentNotificationsForAdmin,
  findStoredCalendarRows,
  findVendorPackagesForAdmin,
  findVendorPortfolioForAdmin,
  notificationsAboutBooking,
  notificationsSentTo,
  type AdminNotificationRow,
  type NotificationScope,
  type AdminRequestListRow,
  type DateRange,
  type LockBookingRow,
  type LockRequestRow,
  type StoredLockRow,
} from './admin-detail.dao.js';
import { findVendorDebtTotals } from '../payments/payouts.dao.js';
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
 * A stored `blocked`, `booked` or `pending` row wins its date, exactly as
 * `readCalendar` overlays. An `available` one — what a cancelled booking leaves
 * — is not a lock and is not listed, and a live request on its date still reads
 * `pending`, as on the vendor's calendar.
 *
 * A held date lists what stands on it — bookings for `booked`, live requests
 * for a stored `pending` (`lockHeldDate` writes one) — and **an empty list is
 * the finding**: the calendar refuses the date while nothing holds it, which is
 * the stale lock an admin arrives asking about.
 */
export function composeLocks(
  stored: readonly StoredLockRow[],
  requests: readonly LockRequestRow[],
  heldBookings: readonly LockBookingRow[],
): AdminAvailabilityLock[] {
  const requestsByDate = groupByDate(requests);
  const bookingsByDate = groupByDate(heldBookings);
  const storedDates = new Set(
    stored.filter((row) => row.status !== 'available').map((row) => row.date),
  );

  const bookingHolders = (date: string): AdminLockHolder[] =>
    (bookingsByDate.get(date) ?? []).map((booking) => ({
      kind: 'booking' as const,
      id: booking.id,
      customerName: fullName(booking.firstName, booking.lastName),
      status: booking.status,
    }));
  const requestHolders = (date: string): AdminLockHolder[] =>
    (requestsByDate.get(date) ?? []).map((request) => ({
      kind: 'request' as const,
      id: request.id,
      customerName: fullName(request.firstName, request.lastName),
      status: request.status,
      expiresAt: request.expiresAt,
    }));

  const storedLocks: AdminAvailabilityLock[] = stored.flatMap((row) => {
    if (row.status !== 'booked' && row.status !== 'pending' && row.status !== 'blocked') {
      return [];
    }

    return [
      {
        date: row.date,
        status: row.status,
        note: row.note,
        holders:
          row.status === 'booked'
            ? bookingHolders(row.date)
            : row.status === 'pending'
              ? requestHolders(row.date)
              : [],
      },
    ];
  });

  const pendingLocks: AdminAvailabilityLock[] = [...requestsByDate.keys()]
    .filter((date) => !storedDates.has(date))
    .map((date) => ({
      date,
      status: 'pending' as const,
      note: null,
      holders: requestHolders(date),
    }));

  return [...storedLocks, ...pendingLocks].sort((left, right) =>
    left.date.localeCompare(right.date),
  );
}

/**
 * The Notifications card's read (VEN-400): both counts over every matching
 * row, and the most recent `ADMIN_DETAIL_NOTIFICATION_LIMIT` of them.
 */
async function readNotifications(
  db: AppDatabase,
  where: NotificationScope,
): Promise<{ total: number; unread: number; items: AdminNotificationRow[] }> {
  const [items, counts] = await Promise.all([
    findRecentNotificationsForAdmin(db, where, ADMIN_DETAIL_NOTIFICATION_LIMIT),
    countNotificationsForAdmin(db, where),
  ]);

  return { ...counts, items };
}

/** One account's own feed, without the recipient every row shares. */
function withoutRecipient(read: Awaited<ReturnType<typeof readNotifications>>): AdminNotifications {
  return { ...read, items: read.items.map(({ userId: _userId, ...item }) => item) };
}

/** What the detail needs from Stripe: the tax-ID state, which is read live and never stored. */
export interface VendorDetailStripe {
  stripe: Pick<StripeConnectGateway, 'readTaxIdState'>;
  log: { warn: (details: Record<string, unknown>, message: string) => void };
}

/**
 * Stripe's word for where the vendor's tax ID stands. A read that fails is
 * `null`, never a guess: the page still renders and says it could not tell.
 */
async function readTaxIdState(
  deps: VendorDetailStripe,
  vendorId: string,
  stripeAccountId: string | null,
): Promise<TaxIdState | null> {
  if (!stripeAccountId) {
    return null;
  }

  try {
    return await deps.stripe.readTaxIdState(stripeAccountId);
  } catch (error) {
    deps.log.warn({ vendorId, err: error }, 'Could not read the vendor tax ID state from Stripe');

    return null;
  }
}

/** `GET /admin/vendors/:vendorId`. */
export async function readVendorDetail(
  db: AppDatabase,
  vendorId: string,
  now: Date,
  deps: VendorDetailStripe,
): Promise<AdminVendorDetail> {
  const vendor = await findAdminVendorDetail(db, vendorId);

  if (!vendor) {
    throw notFound('No vendor with that id');
  }

  const range = lockRange(now);
  const [packages, portfolio, stored, requests, heldBookings, notifications, debt, taxIdState] =
    await Promise.all([
      findVendorPackagesForAdmin(db, vendorId),
      findVendorPortfolioForAdmin(db, vendorId),
      findStoredCalendarRows(db, vendorId, range),
      findLiveRequestsHoldingDates(db, vendorId, range, now),
      findBookingsHoldingDates(db, vendorId, range),
      readNotifications(db, notificationsSentTo(vendor.userId)),
      findVendorDebtTotals(db, vendorId),
      readTaxIdState(deps, vendorId, vendor.stripeAccountId),
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
      backupWithholding:
        vendor.backupWithholdingReason && vendor.backupWithholdingNoticeDate
          ? {
              reason: vendor.backupWithholdingReason,
              noticeDate: vendor.backupWithholdingNoticeDate,
            }
          : null,
      taxIdState,
      debtOutstandingCents: debt.outstandingCents,
    },
    packages,
    portfolio,
    locks: composeLocks(stored, requests, heldBookings),
    notifications: withoutRecipient(notifications),
  };
}

/** `GET /admin/bookings/:bookingId` (VEN-399). */
export async function readBookingDetail(
  db: AppDatabase,
  bookingId: string,
): Promise<AdminBookingDetail> {
  const row = await findAdminBookingDetail(db, bookingId);

  if (!row) {
    throw notFound('No booking with that id');
  }

  const {
    vendorId,
    vendorName,
    vendorPayoutHold,
    vendorUserId,
    vendorUnpayable,
    customerId,
    customerFirstName,
    customerLastName,
    customerEmail,
    ...booking
  } = row;
  const notifications = await readNotifications(
    db,
    notificationsAboutBooking({
      id: booking.id,
      requestId: booking.requestId,
      customerId,
      vendorUserId,
    }),
  );

  return {
    ...booking,
    payoutStatus: payoutStatusOf(booking),
    payoutFailing: isPayoutFailing(booking) && !vendorUnpayable,
    payoutStranded: isPayoutStranded({ ...booking, vendorUnpayable }),
    vendor: { id: vendorId, businessName: vendorName, payoutHold: vendorPayoutHold },
    customer: {
      id: customerId,
      name: fullName(customerFirstName, customerLastName),
      email: customerEmail,
    },
    notifications: {
      ...notifications,
      items: notifications.items.map(({ userId, ...item }) => ({
        ...item,
        recipient: userId === customerId ? ('customer' as const) : ('vendor' as const),
      })),
    },
  };
}

/** `GET /admin/customers/:userId` (VEN-400). */
export async function readCustomerDetail(
  db: AppDatabase,
  userId: string,
): Promise<AdminCustomerDetail> {
  const row = await findAdminCustomerDetail(db, userId);

  if (!row) {
    throw notFound('No customer with that id');
  }

  const [bookings, written, received, notifications] = await Promise.all([
    findCustomerBookingsForAdmin(db, userId, ADMIN_CUSTOMER_DETAIL_LIST_LIMIT),
    findCustomerReviewsForAdmin(db, userId, 'written', ADMIN_CUSTOMER_DETAIL_LIST_LIMIT),
    findCustomerReviewsForAdmin(db, userId, 'received', ADMIN_CUSTOMER_DETAIL_LIST_LIMIT),
    readNotifications(db, notificationsSentTo(userId)),
  ]);
  const { firstName, lastName, ...customer } = row;

  return {
    customer: { ...customer, name: fullName(firstName, lastName) },
    bookings,
    reviews: { written, received },
    notifications: withoutRecipient(notifications),
  };
}

/**
 * When a request stopped being live, for the Expires column's resolution date.
 * `updated_at` moves on every status write, so it is the decision's time for
 * a decline or a withdrawal; acceptance and expiry have their own instants.
 */
function resolvedAt(row: AdminRequestListRow, status: BookingRequestStatus): Date | null {
  if (LIVE_BOOKING_REQUEST_STATUSES.includes(status)) {
    return null;
  }

  if (status === 'accepted') {
    return row.acceptedAt ?? row.updatedAt;
  }

  return status === 'expired' ? (row.expiresAt ?? row.updatedAt) : row.updatedAt;
}

/**
 * `GET /admin/requests` — the pre-payment funnel, every status (VEN-399).
 *
 * **A read, and only a read.** The participant's read ages a lapsed row as it
 * returns it; this one reports the same answer from the same predicate and
 * writes nothing, so an admin browsing the funnel never sends a customer
 * a `request_expired` notification.
 */
export async function listRequests(
  db: AppDatabase,
  query: AdminRequestQuery,
  now: Date,
): Promise<AdminRequestPage> {
  const filters = { group: query.group, status: query.status, now };
  const window = pageWindow(query);
  const [rows, total] = await Promise.all([
    findAdminRequests(db, filters, window.limit, window.offset),
    countAdminRequests(db, filters),
  ]);

  // Only an empty first page earns the widening scan, as on every console list (#454).
  const widenings =
    rows.length === 0 && query.page === 1 ? await countRequestWidenings(db, filters) : [];

  return {
    widenings,
    items: rows.map((row) => {
      const status = requestStatusAsRead(row, now);

      return {
        id: row.id,
        status,
        eventDate: row.eventDate,
        vendorId: row.vendorId,
        vendorName: row.vendorName,
        customerName: fullName(row.customerFirstName, row.customerLastName),
        quotedPriceCents: row.quotedPriceCents,
        expiresAt: row.expiresAt,
        resolvedAt: resolvedAt(row, status),
        createdAt: row.createdAt,
      };
    }),
    total,
    page: query.page,
    pageSize: query.pageSize,
  };
}
