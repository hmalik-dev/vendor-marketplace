import { and, desc, eq } from 'drizzle-orm';
import {
  bookingRequests,
  bookings,
  reviews,
  users,
  vendorProfiles,
  type UserRow,
} from '@vendor-marketplace/db/schema';
import type { AppDatabase } from '../../lib/database.js';

/** Booking-request statuses that mean the vendor agreed to the work. */
const ACCEPTED_REQUEST_STATUSES = ['accepted'] as const;

/** Booking statuses that mean the vendor agreed to the work. */
const ACCEPTED_BOOKING_STATUSES = ['confirmed', 'completed', 'disputed'] as const;

export async function findCustomerById(
  db: AppDatabase,
  customerId: string,
): Promise<UserRow | null> {
  if (!customerId) {
    return null;
  }

  const rows = await db.select().from(users).where(eq(users.id, customerId)).limit(1);

  return rows?.[0] ?? null;
}

/**
 * Whether this vendor has any relationship with this customer at all, and
 * whether it has reached acceptance.
 *
 * Both tables are consulted because acceptance is recorded in two places over
 * a booking's life: the request is accepted first, and a booking row appears
 * only once payment succeeds. A vendor who has accepted but not yet been paid
 * still has to be able to reach the customer.
 */
export async function findRelationship(
  db: AppDatabase,
  vendorId: string,
  customerId: string,
): Promise<{ exists: boolean; accepted: boolean }> {
  if (!vendorId || !customerId) {
    return { exists: false, accepted: false };
  }

  const [requestRows, bookingRows] = await Promise.all([
    db
      .select({ status: bookingRequests.status })
      .from(bookingRequests)
      .where(
        and(eq(bookingRequests.vendorId, vendorId), eq(bookingRequests.customerId, customerId)),
      ),
    db
      .select({ status: bookings.status })
      .from(bookings)
      .where(and(eq(bookings.vendorId, vendorId), eq(bookings.customerId, customerId))),
  ]);

  const accepted =
    requestRows.some((row) =>
      (ACCEPTED_REQUEST_STATUSES as readonly string[]).includes(row.status),
    ) ||
    bookingRows.some((row) =>
      (ACCEPTED_BOOKING_STATUSES as readonly string[]).includes(row.status),
    );

  return { exists: requestRows.length > 0 || bookingRows.length > 0, accepted };
}

export interface CustomerReviewRow {
  id: string;
  rating: number;
  title: string | null;
  content: string;
  vendorBusinessName: string;
  createdAt: Date;
}

/**
 * Public vendor-to-customer reviews, newest first.
 *
 * `is_public = false` is a vendor's private note on a customer and is never
 * shown to another vendor, which is the whole reason the column exists.
 */
export async function findCustomerReviews(
  db: AppDatabase,
  customerId: string,
  limit?: number,
): Promise<CustomerReviewRow[]> {
  if (!customerId) {
    return [];
  }

  /*
   * The review points at the booking, not the customer, so the customer is
   * reached through it — `reviews.reviewer_id` is the vendor's user here, and
   * filtering on it would return reviews *by* this person instead.
   */
  const query = db
    .select({
      id: reviews.id,
      rating: reviews.rating,
      title: reviews.title,
      content: reviews.content,
      vendorBusinessName: vendorProfiles.businessName,
      createdAt: reviews.createdAt,
    })
    .from(reviews)
    .innerJoin(bookings, eq(reviews.bookingId, bookings.id))
    .innerJoin(vendorProfiles, eq(reviews.vendorId, vendorProfiles.id))
    .where(
      and(
        eq(bookings.customerId, customerId),
        eq(reviews.type, 'vendor_to_customer'),
        eq(reviews.isPublic, true),
      ),
    )
    .orderBy(desc(reviews.createdAt));

  return limit === undefined ? query : query.limit(limit);
}

/** The vendor profile this user owns, for scoping a vendor's own reads. */
export async function findVendorIdForUser(db: AppDatabase, userId: string): Promise<string | null> {
  const rows = await db
    .select({ id: vendorProfiles.id })
    .from(vendorProfiles)
    .where(eq(vendorProfiles.userId, userId))
    .limit(1);

  return rows?.[0]?.id ?? null;
}
