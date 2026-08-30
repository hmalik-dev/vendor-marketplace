import {
  reviewSchema,
  vendorReviewsPageSchema,
  type CreateReviewInput,
  type Review,
  type ReviewType,
  type VendorReviewsPage,
  type VendorReviewsQuery,
} from '@vendor-marketplace/shared';
import type { NotificationRow, ReviewRow } from '@vendor-marketplace/db/schema';
import type { AppDatabase } from '../../lib/database.js';
import type { EventHub } from '../../lib/event-stream.js';
import { conflict, notFound, validationFailed } from '../../lib/errors.js';
import { containsProfanity } from '../../lib/profanity.js';
import type { AuthenticatedUser } from '../../plugins/clerk-auth.js';
import { insertNotification } from '../messaging/messaging.dao.js';
import { findPublicVendorBySlug } from '../vendors/vendor-profile.dao.js';
import {
  countVendorReviews,
  findBookingForReview,
  findReviewsForBooking,
  findVendorRatingDistribution,
  findVendorReviews,
  insertReview,
  isUniqueViolation,
  recomputeCustomerRating,
  recomputeVendorRating,
  type BookingForReview,
} from './reviews.dao.js';

function toReview(row: ReviewRow): Review {
  return reviewSchema.parse(row);
}

/**
 * Who the caller is on this booking, and which review type that makes them —
 * the one place the two are decided, so the type sent to the database can
 * never be the client's to choose.
 */
function reviewerRole(booking: BookingForReview, user: AuthenticatedUser): ReviewType | null {
  if (booking.customerId === user.id) {
    return 'customer_to_vendor';
  }

  if (booking.vendorUserId === user.id) {
    return 'vendor_to_customer';
  }

  return null;
}

/**
 * Notifies the reviewed party, inside the same transaction as the review row
 * and the recompute it triggers — see `.claude/rules/db-schema.md` on
 * multi-statement mutations running in one transaction. `hub` is deliberately
 * unused here: the live push happens after commit, the way
 * `booking-requests.service.ts` splits `recordNotification` from
 * `publishNotification`, so a bell never rings for a row a rollback erased.
 */
async function recordReviewNotification(
  db: AppDatabase,
  booking: BookingForReview,
  type: ReviewType,
): Promise<{ recipientId: string; stored: NotificationRow | null }> {
  const forVendor = type === 'customer_to_vendor';
  const recipientId = forVendor ? booking.vendorUserId : booking.customerId;

  const stored = await insertNotification(db, {
    userId: recipientId,
    type: 'new_review',
    title: forVendor ? 'New review' : 'New review from a vendor',
    body: forVendor
      ? 'A customer left a review after your booking together.'
      : 'A vendor left a review after your booking together.',
    data: { bookingId: booking.id, forVendor },
  });

  return { recipientId, stored };
}

function publishReviewNotification(
  hub: EventHub,
  recipientId: string,
  stored: NotificationRow,
): void {
  hub.publish(recipientId, {
    type: 'new_notification',
    notification: {
      id: stored.id,
      type: stored.type,
      title: stored.title,
      body: stored.body,
      // Neither `/bookings` nor `/vendor/dashboard` needs a query param to
      // find this: both hubs already read the booking's own review state, and
      // a deep link that outlives a later review would be the stale one.
      href: stored.data && stored.data.forVendor === true ? '/vendor/dashboard' : '/bookings',
      readAt: stored.readAt,
      createdAt: stored.createdAt,
    },
  });
}

/**
 * `POST /reviews`. Only a participant in a **completed** booking may review
 * it, once each — the unique index on `(booking_id, reviewer_id)` is the
 * final word on the second half, and a race between two identical submissions
 * is settled there rather than by a read-then-write check here.
 */
export async function createReview(
  db: AppDatabase,
  hub: EventHub,
  user: AuthenticatedUser,
  input: CreateReviewInput,
): Promise<Review> {
  const booking = await findBookingForReview(db, input.bookingId);

  if (!booking) {
    // Deliberately 404 rather than 403: a stranger probing booking ids learns
    // nothing about which of them exist — the same reasoning
    // `booking-requests.service.ts` applies to its own participant check.
    throw notFound('That booking does not exist');
  }

  const type = reviewerRole(booking, user);

  if (!type) {
    throw notFound('That booking does not exist');
  }

  if (booking.status !== 'completed') {
    throw validationFailed('Only a completed booking can be reviewed');
  }

  if (containsProfanity(input.title, input.content)) {
    throw validationFailed('Review contains inappropriate language');
  }

  let result: { row: ReviewRow; recipientId: string; stored: NotificationRow | null };

  try {
    result = await db.transaction(async (tx) => {
      const row = await insertReview(tx, {
        bookingId: booking.id,
        reviewerId: user.id,
        vendorId: booking.vendorId,
        type,
        rating: input.rating,
        title: input.title ?? null,
        content: input.content,
      });

      // Derived from source rows, never incremented — see
      // `.claude/rules/api-layering.md`.
      if (type === 'customer_to_vendor') {
        await recomputeVendorRating(tx, booking.vendorId);
      } else {
        await recomputeCustomerRating(tx, booking.customerId);
      }

      const { recipientId, stored } = await recordReviewNotification(tx, booking, type);

      return { row, recipientId, stored };
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw conflict('You already reviewed this booking');
    }
    throw error;
  }

  // After the commit, so the bell never rings for a row that was rolled back.
  if (result.stored) {
    publishReviewNotification(hub, result.recipientId, result.stored);
  }

  return toReview(result.row);
}

/**
 * `GET /bookings/:bookingId/reviews`. Both sides of a booking may read both
 * reviews on it — this is their own shared event, and the tiered-visibility
 * rule #16 owns is about strangers, not the two participants.
 */
export async function getBookingReviews(
  db: AppDatabase,
  user: AuthenticatedUser,
  bookingId: string,
): Promise<Review[]> {
  const booking = await findBookingForReview(db, bookingId);

  if (!booking) {
    throw notFound('That booking does not exist');
  }

  if (booking.customerId !== user.id && booking.vendorUserId !== user.id) {
    throw notFound('That booking does not exist');
  }

  const rows = await findReviewsForBooking(db, bookingId);
  return rows.map(toReview);
}

/**
 * `GET /vendors/:slug/reviews`. Public and unauthenticated, like the profile
 * it fills — only `customer_to_vendor` reviews are ever returned here.
 */
export async function getVendorReviews(
  db: AppDatabase,
  slug: string,
  query: VendorReviewsQuery,
): Promise<VendorReviewsPage> {
  const vendor = await findPublicVendorBySlug(db, slug);

  if (!vendor) {
    throw notFound('That vendor page is not available');
  }

  const offset = (query.page - 1) * query.limit;

  const [rows, total, distribution] = await Promise.all([
    findVendorReviews(db, vendor.id, query.limit, offset),
    countVendorReviews(db, vendor.id),
    findVendorRatingDistribution(db, vendor.id),
  ]);

  return vendorReviewsPageSchema.parse({
    items: rows.map((row) => ({
      id: row.id,
      rating: row.rating,
      title: row.title,
      content: row.content,
      reviewerFirstName: row.reviewerFirstName,
      reviewerLastInitial: row.reviewerLastName.trim().slice(0, 1).toUpperCase(),
      eventType: row.eventType,
      createdAt: row.createdAt,
    })),
    total,
    page: query.page,
    limit: query.limit,
    distribution,
  });
}
