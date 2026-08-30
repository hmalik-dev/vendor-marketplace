import { and, desc, eq, sql } from 'drizzle-orm';
import {
  bookingRequests,
  bookings,
  reviews,
  users,
  vendorProfiles,
  type NewReviewRow,
  type ReviewRow,
} from '@vendor-marketplace/db/schema';
import type { AppDatabase } from '../../lib/database.js';

/** What deciding who may review a booking, and as whom, needs to know. */
export interface BookingForReview {
  id: string;
  customerId: string;
  vendorId: string;
  status: string;
  /** The vendor's own user id — who is "the vendor" for this booking. */
  vendorUserId: string;
}

export async function findBookingForReview(
  db: AppDatabase,
  bookingId: string,
): Promise<BookingForReview | null> {
  const rows = await db
    .select({
      id: bookings.id,
      customerId: bookings.customerId,
      vendorId: bookings.vendorId,
      status: bookings.status,
      vendorUserId: vendorProfiles.userId,
    })
    .from(bookings)
    .innerJoin(vendorProfiles, eq(bookings.vendorId, vendorProfiles.id))
    .where(eq(bookings.id, bookingId))
    .limit(1);

  return rows?.[0] ?? null;
}

/** Whether `value` carries Postgres's `code` field set to `code`. */
function hasPgCode(value: unknown, code: string): boolean {
  return (
    typeof value === 'object' &&
    value !== null &&
    'code' in value &&
    (value as { code: unknown }).code === code
  );
}

/**
 * Postgres's unique-violation code. Drizzle wraps the driver's error in its
 * own `DrizzleQueryError`, which carries no `.code` of its own — the
 * underlying `postgres-js` (production) or PGlite (the test engine) error
 * sits one level down, on `.cause`. This checks both, so this recognises a
 * duplicate `(booking_id, reviewer_id)` insert under either driver.
 */
export function isUniqueViolation(error: unknown): boolean {
  if (hasPgCode(error, '23505')) {
    return true;
  }

  const cause = error instanceof Error ? error.cause : undefined;
  return hasPgCode(cause, '23505');
}

/** Inserts one review row. Throws on a duplicate `(booking_id, reviewer_id)`. */
export async function insertReview(db: AppDatabase, values: NewReviewRow): Promise<ReviewRow> {
  const [row] = await db.insert(reviews).values(values).returning();

  if (!row) {
    throw new Error('Review insert returned no row');
  }

  return row;
}

/**
 * Derives `vendor_profiles.avg_rating` and `review_count` from the
 * `customer_to_vendor` rows that actually exist, rather than incrementing —
 * see `.claude/rules/api-layering.md`. `COALESCE(..., 0)` is what makes this
 * correct at zero reviews as well as one: an `AVG` over no rows is `NULL`, and
 * writing that into a `NOT NULL` decimal column would fail the update outright
 * rather than settle on the empty state.
 */
export async function recomputeVendorRating(db: AppDatabase, vendorId: string): Promise<void> {
  await db
    .update(vendorProfiles)
    .set({
      avgRating: sql`COALESCE((
        SELECT AVG(rating) FROM reviews
        WHERE vendor_id = ${vendorId} AND type = 'customer_to_vendor'
      ), 0)`,
      reviewCount: sql`(
        SELECT COUNT(*)::int FROM reviews
        WHERE vendor_id = ${vendorId} AND type = 'customer_to_vendor'
      )`,
      updatedAt: new Date(),
    })
    .where(eq(vendorProfiles.id, vendorId));
}

/**
 * The same derivation for `users.avg_customer_rating` / `customer_review_count`.
 *
 * A review carries no `customer_id` column of its own — the reviewee for a
 * `vendor_to_customer` review is reached through the booking it is about — so
 * the subquery joins `bookings` rather than filtering on `reviews` alone.
 */
export async function recomputeCustomerRating(db: AppDatabase, customerId: string): Promise<void> {
  await db
    .update(users)
    .set({
      avgCustomerRating: sql`COALESCE((
        SELECT AVG(r.rating) FROM reviews r
        JOIN bookings b ON r.booking_id = b.id
        WHERE b.customer_id = ${customerId} AND r.type = 'vendor_to_customer'
      ), 0)`,
      customerReviewCount: sql`(
        SELECT COUNT(*)::int FROM reviews r
        JOIN bookings b ON r.booking_id = b.id
        WHERE b.customer_id = ${customerId} AND r.type = 'vendor_to_customer'
      )`,
      updatedAt: new Date(),
    })
    .where(eq(users.id, customerId));
}

/** Every review left on one booking — at most two, one per side. */
export async function findReviewsForBooking(
  db: AppDatabase,
  bookingId: string,
): Promise<ReviewRow[]> {
  return db.select().from(reviews).where(eq(reviews.bookingId, bookingId));
}

/** One row of the vendor profile's Reviews tab. */
export interface VendorReviewRow {
  id: string;
  rating: number;
  title: string | null;
  content: string;
  reviewerFirstName: string;
  reviewerLastName: string;
  eventType: string | null;
  createdAt: Date;
}

/**
 * Public `customer_to_vendor` reviews, newest first — the only type this ever
 * returns. A `vendor_to_customer` review is never public; #16 owns that tier
 * and this query does not widen it.
 */
export async function findVendorReviews(
  db: AppDatabase,
  vendorId: string,
  limit: number,
  offset: number,
): Promise<VendorReviewRow[]> {
  return db
    .select({
      id: reviews.id,
      rating: reviews.rating,
      title: reviews.title,
      content: reviews.content,
      reviewerFirstName: users.firstName,
      reviewerLastName: users.lastName,
      eventType: bookingRequests.eventType,
      createdAt: reviews.createdAt,
    })
    .from(reviews)
    .innerJoin(users, eq(reviews.reviewerId, users.id))
    .innerJoin(bookings, eq(reviews.bookingId, bookings.id))
    .leftJoin(bookingRequests, eq(bookings.requestId, bookingRequests.id))
    .where(and(eq(reviews.vendorId, vendorId), eq(reviews.type, 'customer_to_vendor')))
    .orderBy(desc(reviews.createdAt))
    .limit(limit)
    .offset(offset);
}

export async function countVendorReviews(db: AppDatabase, vendorId: string): Promise<number> {
  const rows = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(reviews)
    .where(and(eq(reviews.vendorId, vendorId), eq(reviews.type, 'customer_to_vendor')));

  return rows?.[0]?.total ?? 0;
}

/** `{ 1: count, ..., 5: count }` — every bucket present, even at zero. */
export async function findVendorRatingDistribution(
  db: AppDatabase,
  vendorId: string,
): Promise<Record<1 | 2 | 3 | 4 | 5, number>> {
  const rows = await db
    .select({ rating: reviews.rating, total: sql<number>`count(*)::int` })
    .from(reviews)
    .where(and(eq(reviews.vendorId, vendorId), eq(reviews.type, 'customer_to_vendor')))
    .groupBy(reviews.rating);

  const byRating = new Map(rows.map((row) => [row.rating, row.total]));

  return {
    1: byRating.get(1) ?? 0,
    2: byRating.get(2) ?? 0,
    3: byRating.get(3) ?? 0,
    4: byRating.get(4) ?? 0,
    5: byRating.get(5) ?? 0,
  };
}
