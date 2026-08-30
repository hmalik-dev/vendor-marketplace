import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import {
  REVIEW_RATINGS,
  type CreateReviewInput,
  type PublicReview,
  type ReviewSummary,
  type ReviewType,
} from '@vendor-marketplace/shared';
import {
  bookingRequests,
  bookings,
  notifications,
  reviews,
  users,
  vendorProfiles,
  type NotificationRow,
  type ReviewRow,
} from '@vendor-marketplace/db/schema';
import type { AppDatabase } from '../../lib/database.js';

/**
 * A booking, seen from the question "may this person review it?".
 *
 * The facts the eligibility rule needs and nothing else — who owns it, which
 * vendor it is against, whether it is finished, and what to call each party —
 * so the service can both decide and address its notification without a second
 * read.
 */
export interface ReviewableBooking {
  id: string;
  customerId: string;
  vendorId: string;
  vendorUserId: string;
  status: string;
  /** Both parties' display names, so the notification needs no second read. */
  customerFirstName: string;
  vendorBusinessName: string;
  /** Where a public review becomes readable — the notification's destination. */
  vendorSlug: string;
}

/** The booking a review would be filed against, with both parties resolved. */
export async function findReviewableBooking(
  db: AppDatabase,
  bookingId: string,
): Promise<ReviewableBooking | null> {
  if (!bookingId) {
    return null;
  }

  const rows = await db
    .select({
      id: bookings.id,
      customerId: bookings.customerId,
      vendorId: bookings.vendorId,
      /*
       * The vendor's *user*, not the profile. Authorization compares the caller
       * against a `users.id`, and a vendor profile id is not one — comparing
       * the two silently denies every vendor.
       */
      vendorUserId: vendorProfiles.userId,
      status: bookings.status,
      customerFirstName: users.firstName,
      vendorBusinessName: vendorProfiles.businessName,
      vendorSlug: vendorProfiles.slug,
    })
    .from(bookings)
    .innerJoin(vendorProfiles, eq(vendorProfiles.id, bookings.vendorId))
    .innerJoin(users, eq(users.id, bookings.customerId))
    .where(eq(bookings.id, bookingId))
    .limit(1);

  return rows[0] ?? null;
}

/** Whether this reviewer has already used up their one review of a booking. */
export async function findReviewByBookingAndReviewer(
  db: AppDatabase,
  bookingId: string,
  reviewerId: string,
): Promise<ReviewRow | null> {
  if (!bookingId || !reviewerId) {
    return null;
  }

  const rows = await db
    .select()
    .from(reviews)
    .where(and(eq(reviews.bookingId, bookingId), eq(reviews.reviewerId, reviewerId)))
    .limit(1);

  return rows[0] ?? null;
}

/**
 * The oldest completed booking with this vendor that the customer has not
 * reviewed, or `null`.
 *
 * Oldest rather than newest on purpose: it is the one closest to being
 * forgotten, and a customer with two finished bookings should be asked about
 * the earlier one first.
 *
 * The unreviewed test is a `LEFT JOIN ... IS NULL` against **this reviewer's**
 * row, not a `NOT EXISTS` over the booking — a booking the *vendor* has already
 * reviewed is still open for the customer to review, and the two are separate
 * rows by design.
 */
export async function findUnreviewedCompletedBooking(
  db: AppDatabase,
  vendorId: string,
  customerId: string,
): Promise<{ id: string } | null> {
  if (!vendorId || !customerId) {
    return null;
  }

  const rows = await db
    .select({ id: bookings.id })
    .from(bookings)
    .leftJoin(reviews, and(eq(reviews.bookingId, bookings.id), eq(reviews.reviewerId, customerId)))
    .where(
      and(
        eq(bookings.vendorId, vendorId),
        eq(bookings.customerId, customerId),
        eq(bookings.status, 'completed'),
        isNull(reviews.id),
      ),
    )
    .orderBy(bookings.completedAt)
    .limit(1);

  return rows[0] ?? null;
}

/**
 * Reviewer identity as the public card shows it: first name and last initial.
 *
 * Built in SQL rather than in the service because the full surname must not
 * leave the database — a route that selects it and trims it later is one
 * refactor away from returning it. A missing surname yields the first name
 * alone rather than a trailing full stop.
 */
const reviewerDisplayName = sql<string>`
  trim(
    ${users.firstName} || ' ' ||
    case
      when ${users.lastName} is null or ${users.lastName} = '' then ''
      else left(${users.lastName}, 1) || '.'
    end
  )
`;

/** One appended page of a vendor's public reviews, newest first. */
export async function findPublicVendorReviews(
  db: AppDatabase,
  vendorId: string,
  limit: number,
  offset: number,
): Promise<PublicReview[]> {
  if (!vendorId) {
    return [];
  }

  const rows = await db
    .select({
      id: reviews.id,
      rating: reviews.rating,
      title: reviews.title,
      content: reviews.content,
      reviewerName: reviewerDisplayName,
      /*
       * The event type lives on the *request*, not the booking — bookings carry
       * the date and the money, the request carries what the event was. Left
       * joined so a booking whose request was pruned still renders its review.
       */
      eventType: bookingRequests.eventType,
      createdAt: reviews.createdAt,
    })
    .from(reviews)
    .innerJoin(users, eq(users.id, reviews.reviewerId))
    .leftJoin(bookings, eq(bookings.id, reviews.bookingId))
    .leftJoin(bookingRequests, eq(bookingRequests.id, bookings.requestId))
    .where(and(eq(reviews.vendorId, vendorId), eq(reviews.type, 'customer_to_vendor')))
    .orderBy(desc(reviews.createdAt), desc(reviews.id))
    .limit(limit)
    .offset(offset);

  return rows;
}

/**
 * The average and the five-bar distribution, from one grouped read.
 *
 * Counted from the rows rather than read off `vendor_profiles.avg_rating`: the
 * chart needs the per-rating counts anyway, and deriving the average from the
 * same GROUP BY means the number above the list can never disagree with the
 * list under it.
 */
export async function findVendorReviewSummary(
  db: AppDatabase,
  vendorId: string,
): Promise<ReviewSummary> {
  const empty: ReviewSummary = {
    avgRating: null,
    reviewCount: 0,
    distribution: REVIEW_RATINGS.map(() => 0),
  };

  if (!vendorId) {
    return empty;
  }

  const rows = await db
    .select({ rating: reviews.rating, count: sql<number>`count(*)::int` })
    .from(reviews)
    .where(and(eq(reviews.vendorId, vendorId), eq(reviews.type, 'customer_to_vendor')))
    .groupBy(reviews.rating);

  if (rows.length === 0) {
    return empty;
  }

  const counts = new Map(rows.map((row) => [row.rating, row.count]));
  const distribution = REVIEW_RATINGS.map((rating) => counts.get(rating) ?? 0);
  const reviewCount = distribution.reduce((total, count) => total + count, 0);
  const weighted = REVIEW_RATINGS.reduce(
    (total, rating, index) => total + rating * (distribution[index] as number),
    0,
  );

  return {
    // Guarded rather than assumed: a vendor whose only rows are
    // vendor_to_customer reaches here with every bucket at zero.
    avgRating: reviewCount === 0 ? null : weighted / reviewCount,
    reviewCount,
    distribution,
  };
}

/**
 * Serialises two concurrent recomputes of the same row against each other.
 *
 * **Recomputing instead of incrementing is necessary but not sufficient**, and
 * the first version of this code got that wrong. Putting the aggregate in the
 * `UPDATE`'s own `SET` clause looks atomic and is not: under READ COMMITTED a
 * second writer that blocks on the row lock re-checks the `WHERE` against the
 * new tuple but evaluates the `SET` subplans against the snapshot it took
 * *before* the first writer committed. It then persists a total that omits the
 * other review, and nothing ever corrects it — the wrong number survives until
 * the next review recomputes. Reproduced five times out of five against
 * `postgres:18-alpine` with the lock held for 5ms.
 *
 * Taking the lock as its own statement first is what fixes it: the aggregate
 * that follows is a *new* statement, so it takes a fresh snapshot — one that
 * includes whatever the writer ahead of it committed while this one waited.
 *
 * **`FOR NO KEY UPDATE`, not `FOR UPDATE`.** Inserting the `reviews` row has
 * already taken `FOR KEY SHARE` on this same parent row for the foreign key, in
 * both transactions. `FOR UPDATE` conflicts with that, so two reviewers would
 * deadlock rather than queue; `FOR NO KEY UPDATE` conflicts only with itself,
 * which is exactly the pair that must not overlap.
 */
async function lockForRecompute(
  tx: AppDatabase,
  table: typeof vendorProfiles | typeof users,
  id: string,
): Promise<void> {
  await tx
    .select({ id: table.id })
    .from(table)
    .where(eq(table.id, id))
    .for('no key update')
    .limit(1);
}

/**
 * Re-derives a vendor's public rating from the `reviews` rows themselves.
 *
 * A `SELECT AVG/COUNT` over the source rows, never an increment — which is what
 * makes it idempotent, and what lets an insert and a deletion share one
 * derivation rather than keeping two that can drift. Correctness under
 * concurrent writes comes from the lock above, not from the recompute alone.
 *
 * Zero remaining reviews leaves `0`, not `NULL`: both columns are `NOT NULL`,
 * and every surface reads `review_count` to tell an absent score from a bad one.
 */
async function recalculateVendorRating(tx: AppDatabase, vendorId: string): Promise<void> {
  await lockForRecompute(tx, vendorProfiles, vendorId);

  const totals = await tx
    .select({
      avgRating: sql<string>`coalesce(round(avg(${reviews.rating})::numeric, 2), 0)`,
      reviewCount: sql<number>`count(*)::int`,
    })
    .from(reviews)
    .where(and(eq(reviews.vendorId, vendorId), eq(reviews.type, 'customer_to_vendor')));

  await tx
    .update(vendorProfiles)
    .set({
      avgRating: totals[0]?.avgRating ?? '0',
      reviewCount: totals[0]?.reviewCount ?? 0,
    })
    .where(eq(vendorProfiles.id, vendorId));
}

/** The same derivation, and the same lock, for the private direction. */
async function recalculateCustomerRating(tx: AppDatabase, customerId: string): Promise<void> {
  await lockForRecompute(tx, users, customerId);

  const totals = await tx
    .select({
      avgRating: sql<string>`coalesce(round(avg(${reviews.rating})::numeric, 2), 0)`,
      reviewCount: sql<number>`count(*)::int`,
    })
    .from(reviews)
    .innerJoin(bookings, eq(bookings.id, reviews.bookingId))
    .where(and(eq(reviews.type, 'vendor_to_customer'), eq(bookings.customerId, customerId)));

  await tx
    .update(users)
    .set({
      avgCustomerRating: totals[0]?.avgRating ?? '0',
      customerReviewCount: totals[0]?.reviewCount ?? 0,
    })
    .where(eq(users.id, customerId));
}

/** What a review write needs from the service: the row, and who it is about. */
export interface ReviewWrite extends CreateReviewInput {
  bookingId: string;
  reviewerId: string;
  vendorId: string;
  type: ReviewType;
  /** Who the review is *about* — the party whose derived rating moves. */
  reviewedUserId: string;
  /** The notification that party gets, written in the same transaction. */
  notification: { title: string; body: string; data: Record<string, unknown> };
}

/** A review and the notification it produced, both already committed. */
export interface WrittenReview {
  review: ReviewRow;
  notification: NotificationRow | null;
}

/**
 * Writes the review, notifies the reviewed party, and re-derives their rating —
 * all in one transaction.
 *
 * All three or none. A rating that moved with no row behind it cannot be
 * explained, and a notification about a review that failed to insert points at
 * nothing; both are states a post-commit second write can leave behind.
 */
export async function insertReviewAndRecalculate(
  db: AppDatabase,
  review: ReviewWrite,
): Promise<WrittenReview> {
  return db.transaction(async (tx) => {
    const inserted = await tx
      .insert(reviews)
      .values({
        bookingId: review.bookingId,
        reviewerId: review.reviewerId,
        vendorId: review.vendorId,
        type: review.type,
        rating: review.rating,
        title: review.title ?? null,
        content: review.content,
      })
      .returning();

    const row = inserted[0];

    if (!row) {
      throw new Error('Review insert returned no row');
    }

    if (review.type === 'customer_to_vendor') {
      await recalculateVendorRating(tx, review.vendorId);
    } else {
      await recalculateCustomerRating(tx, review.reviewedUserId);
    }

    const notified = await tx
      .insert(notifications)
      .values({
        userId: review.reviewedUserId,
        type: 'new_review',
        title: review.notification.title,
        body: review.notification.body,
        data: review.notification.data,
      })
      .returning();

    return { review: row, notification: notified[0] ?? null };
  });
}

/**
 * Removes a review and re-derives whichever rating it was counted in.
 *
 * Moderation (#15) owns *who* may call this and *why*. The recompute lives here
 * because it is the same derivation the insert uses, and running it from two
 * places is how the two would eventually disagree. Deleting the last review
 * leaves `avg_rating = 0, review_count = 0`.
 *
 * Returns `false` for a review that is already gone, so a repeated deletion is
 * a no-op rather than an error.
 */
export async function deleteReviewAndRecalculate(
  db: AppDatabase,
  reviewId: string,
): Promise<boolean> {
  if (!reviewId) {
    return false;
  }

  return db.transaction(async (tx) => {
    const deleted = await tx.delete(reviews).where(eq(reviews.id, reviewId)).returning();
    const row = deleted[0];

    if (!row) {
      return false;
    }

    if (row.type === 'customer_to_vendor') {
      await recalculateVendorRating(tx, row.vendorId);

      return true;
    }

    /*
     * The customer is reached through the booking — a `vendor_to_customer` row
     * records who it is about only by which booking it belongs to.
     */
    const owner = await tx
      .select({ customerId: bookings.customerId })
      .from(bookings)
      .where(eq(bookings.id, row.bookingId))
      .limit(1);
    const customerId = owner[0]?.customerId;

    if (customerId) {
      await recalculateCustomerRating(tx, customerId);
    }

    return true;
  });
}
