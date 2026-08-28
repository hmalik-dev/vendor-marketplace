import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import {
  availability,
  bookingRequests,
  bookings,
  conversations,
  notifications,
  servicePackages,
  users,
  vendorProfiles,
  type AvailabilityRow,
  type BookingRequestRow,
  type NewBookingRequestRow,
  type NewNotificationRow,
  type ServicePackageRow,
  type VendorProfileRow,
} from '@vendor-marketplace/db/schema';
import type { BookingRequestStatus } from '@vendor-marketplace/shared';
import type { AppDatabase } from '../../lib/database.js';

/** Newest first — both hubs read a request queue, and the queue is a stack. */
const newestFirst = [desc(bookingRequests.createdAt)];

export async function findRequestById(
  db: AppDatabase,
  requestId: string,
): Promise<BookingRequestRow | null> {
  if (!requestId) {
    return null;
  }

  const rows = await db
    .select()
    .from(bookingRequests)
    .where(eq(bookingRequests.id, requestId))
    .limit(1);

  return rows?.[0] ?? null;
}

export interface RequestListFilter {
  customerId?: string;
  vendorId?: string;
  status?: BookingRequestStatus;
}

export async function findRequests(
  db: AppDatabase,
  filter: RequestListFilter,
): Promise<BookingRequestRow[]> {
  const conditions = [
    filter.customerId ? eq(bookingRequests.customerId, filter.customerId) : undefined,
    filter.vendorId ? eq(bookingRequests.vendorId, filter.vendorId) : undefined,
    filter.status ? eq(bookingRequests.status, filter.status) : undefined,
  ].filter((condition) => condition !== undefined);

  if (conditions.length === 0) {
    return [];
  }

  return db
    .select()
    .from(bookingRequests)
    .where(and(...conditions))
    .orderBy(...newestFirst);
}

export async function insertRequest(
  db: AppDatabase,
  values: NewBookingRequestRow,
): Promise<BookingRequestRow> {
  const inserted = await db.insert(bookingRequests).values(values).returning();
  const row = inserted?.[0];

  if (!row) {
    throw new Error('Booking request insert returned no row');
  }

  return row;
}

/**
 * Applies a transition, but only from the status the caller read.
 *
 * The `status` predicate is the concurrency guard: two vendors' tabs, or a
 * decline racing the lazy expiry sweep, both read `pending` and both try to
 * write. The second update matches no row and returns `null`, which the
 * service reports as an invalid transition rather than silently overwriting a
 * decision that was already made.
 */
export async function applyTransition(
  db: AppDatabase,
  requestId: string,
  from: BookingRequestStatus,
  patch: Partial<NewBookingRequestRow>,
): Promise<BookingRequestRow | null> {
  const updated = await db
    .update(bookingRequests)
    .set({ ...patch, updatedAt: sql`now()` })
    .where(and(eq(bookingRequests.id, requestId), eq(bookingRequests.status, from)))
    .returning();

  return updated?.[0] ?? null;
}

/** The vendor profile a request points at, whatever its publication state. */
export async function findVendorById(
  db: AppDatabase,
  vendorId: string,
): Promise<VendorProfileRow | null> {
  if (!vendorId) {
    return null;
  }

  const rows = await db
    .select()
    .from(vendorProfiles)
    .where(eq(vendorProfiles.id, vendorId))
    .limit(1);

  return rows?.[0] ?? null;
}

export async function findVendorsByIds(
  db: AppDatabase,
  vendorIds: readonly string[],
): Promise<VendorProfileRow[]> {
  if (vendorIds.length === 0) {
    return [];
  }

  return db
    .select()
    .from(vendorProfiles)
    .where(inArray(vendorProfiles.id, [...vendorIds]));
}

/** The vendor profile owned by this user, for scoping a vendor's own queue. */
export async function findVendorByUserId(
  db: AppDatabase,
  userId: string,
): Promise<VendorProfileRow | null> {
  if (!userId) {
    return null;
  }

  const rows = await db
    .select()
    .from(vendorProfiles)
    .where(eq(vendorProfiles.userId, userId))
    .limit(1);

  return rows?.[0] ?? null;
}

export async function findActivePackage(
  db: AppDatabase,
  vendorId: string,
  packageId: string,
): Promise<ServicePackageRow | null> {
  if (!vendorId || !packageId) {
    return null;
  }

  const rows = await db
    .select()
    .from(servicePackages)
    .where(
      and(
        eq(servicePackages.id, packageId),
        eq(servicePackages.vendorId, vendorId),
        eq(servicePackages.isActive, true),
      ),
    )
    .limit(1);

  return rows?.[0] ?? null;
}

export async function findPackagesByIds(
  db: AppDatabase,
  packageIds: readonly string[],
): Promise<ServicePackageRow[]> {
  if (packageIds.length === 0) {
    return [];
  }

  return db
    .select()
    .from(servicePackages)
    .where(inArray(servicePackages.id, [...packageIds]));
}

/**
 * The calendar row for one date, or `null` when there is none — and the
 * calendar's convention is that no row means free.
 */
export async function findAvailabilityOn(
  db: AppDatabase,
  vendorId: string,
  date: string,
): Promise<AvailabilityRow | null> {
  if (!vendorId || !date) {
    return null;
  }

  const rows = await db
    .select()
    .from(availability)
    .where(and(eq(availability.vendorId, vendorId), eq(availability.date, date)))
    .limit(1);

  return rows?.[0] ?? null;
}

/**
 * Holds the date while the accepted request waits for payment.
 *
 * `pending` is the request lifecycle's own status — `available` and `blocked`
 * are the vendor's to set, `booked` belongs to #10 — so an accept never
 * overwrites a `booked` row it did not create.
 */
export async function holdDate(db: AppDatabase, vendorId: string, date: string): Promise<void> {
  await db
    .insert(availability)
    .values({ vendorId, date, status: 'pending' })
    .onConflictDoUpdate({
      target: [availability.vendorId, availability.date],
      set: { status: 'pending' },
      where: sql`${availability.status} <> 'booked'`,
    });
}

/**
 * The one conversation per customer/vendor pair, created by the first request.
 * Idempotent: a second request from the same customer reuses the thread rather
 * than opening a duplicate one beside it.
 */
export async function ensureConversation(
  db: AppDatabase,
  values: { customerId: string; vendorId: string; bookingRequestId: string },
): Promise<void> {
  await db
    .insert(conversations)
    .values(values)
    .onConflictDoNothing({
      target: [conversations.customerId, conversations.vendorId],
    });
}

export async function insertNotification(
  db: AppDatabase,
  values: NewNotificationRow,
): Promise<void> {
  await db.insert(notifications).values(values);
}

/** The `users.id` behind a vendor profile — notifications address people. */
export async function findVendorUserId(db: AppDatabase, vendorId: string): Promise<string | null> {
  const rows = await db
    .select({ userId: vendorProfiles.userId })
    .from(vendorProfiles)
    .where(eq(vendorProfiles.id, vendorId))
    .limit(1);

  return rows?.[0]?.userId ?? null;
}

export interface BookingWithContextRow {
  booking: typeof bookings.$inferSelect;
  eventType: string | null;
}

/**
 * Bookings with the occasion the hub renders beside them. `event_type` lives on
 * the request, not the booking, so the join is what makes
 * "Photography · Wedding" possible without a second round trip per row.
 */
export async function findBookings(
  db: AppDatabase,
  filter: { customerId?: string; vendorId?: string },
): Promise<BookingWithContextRow[]> {
  const conditions = [
    filter.customerId ? eq(bookings.customerId, filter.customerId) : undefined,
    filter.vendorId ? eq(bookings.vendorId, filter.vendorId) : undefined,
  ].filter((condition) => condition !== undefined);

  if (conditions.length === 0) {
    return [];
  }

  return db
    .select({ booking: bookings, eventType: bookingRequests.eventType })
    .from(bookings)
    .innerJoin(bookingRequests, eq(bookings.requestId, bookingRequests.id))
    .where(and(...conditions))
    .orderBy(desc(bookings.eventDate));
}

/** The sender's name, for the vendor's request queue. */
export async function findCustomerNames(
  db: AppDatabase,
  customerIds: readonly string[],
): Promise<{ id: string; firstName: string; lastName: string }[]> {
  if (customerIds.length === 0) {
    return [];
  }

  return db
    .select({ id: users.id, firstName: users.firstName, lastName: users.lastName })
    .from(users)
    .where(inArray(users.id, [...customerIds]));
}

/** Whether a user row exists — guards a notification insert against a stale id. */
export async function userExists(db: AppDatabase, userId: string): Promise<boolean> {
  const rows = await db.select({ id: users.id }).from(users).where(eq(users.id, userId)).limit(1);

  return rows.length > 0;
}
