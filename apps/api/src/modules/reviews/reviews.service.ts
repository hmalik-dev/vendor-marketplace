import {
  REVIEW_PAGE_SIZE,
  type CreateReviewInput,
  type Review,
  type ReviewViewer,
  type VendorReviewsPage,
} from '@vendor-marketplace/shared';
import type { AppDatabase } from '../../lib/database.js';
import type { EventHub } from '../../lib/event-stream.js';
import { conflict, notFound, validationFailed } from '../../lib/errors.js';
import { toNotification } from '../messaging/messaging.service.js';
/*
 * The public lookup, not `vendors.dao`'s: it carries the published-and-not-
 * deleted filter, so an unpublished vendor's reviews are as unreachable as the
 * profile they belong to. Reaching for the unfiltered one would have made this
 * route the way to read a withdrawn vendor's reviews.
 */
import { findPublicVendorBySlug } from '../vendors/vendor-profile.dao.js';
import {
  findPublicVendorReviews,
  findReviewByBookingAndReviewer,
  findReviewableBooking,
  findUnreviewedCompletedBooking,
  findVendorReviewSummary,
  insertReviewAndRecalculate,
} from './reviews.dao.js';

/**
 * Words that will not be published, lowercased.
 *
 * **This is a floor, not a moderation system**, and it is written down here so
 * nobody mistakes it for one. It catches the handful of slurs and obscenities
 * that would be actively harmful sitting on a public vendor profile between the
 * moment they are posted and the moment a human sees them. It will not catch
 * misspellings, spacing tricks, or anything targeted.
 *
 * The ticket asks for reviews to be "profanity filtered" and nothing existed.
 * Real moderation is a queue with a human at the end of it, and there is
 * nowhere to queue to until **#15** builds admin — so the only behaviour
 * available today is refusing the submission and telling the author why.
 *
 * **Every inflection is written out, and nothing is matched by prefix.** The
 * first version suffixed each stem with `\w*`, which on a marketplace of
 * caterers and florists refused *spicy*, *spice*, *shitake* and *retardant* —
 * ordinary review vocabulary, rejected with an accusation and no appeal. A
 * filter that is a floor may miss words; it may not call a caterer's review
 * obscene for describing food. `niggle`, `niggardly`, `assessment`, `classic`
 * and `Scunthorpe` are the same failure and are why the list is exhaustive
 * rather than clever.
 */
const BLOCKED_WORDS = [
  'fuck',
  'fucks',
  'fucked',
  'fucker',
  'fuckers',
  'fucking',
  'motherfucker',
  'motherfuckers',
  'motherfucking',
  'shit',
  'shits',
  'shite',
  'shitty',
  'shithead',
  'shitshow',
  'shitshows',
  'bullshit',
  'cunt',
  'cunts',
  'bitch',
  'bitches',
  'bastard',
  'bastards',
  'asshole',
  'assholes',
  'dickhead',
  'dickheads',
  'wanker',
  'wankers',
  'slut',
  'sluts',
  'slutty',
  'whore',
  'whores',
  'retard',
  'retards',
  'retarded',
  'faggot',
  'faggots',
  'nigger',
  'niggers',
  'nigga',
  'niggas',
  'kike',
  'kikes',
  'spic',
  'spics',
  'chink',
  'chinks',
  'tranny',
  'trannies',
] as const;

const BLOCKED_PATTERN = new RegExp(`\\b(?:${BLOCKED_WORDS.join('|')})\\b`, 'iu');

/** Whether any field of a review carries a word that will not be published. */
function containsBlockedWord(...fields: readonly (string | undefined | null)[]): boolean {
  return fields.some((field) => typeof field === 'string' && BLOCKED_PATTERN.test(field));
}

/**
 * Files a review against a completed booking.
 *
 * Who may write what is decided here, from the booking, not from a role claim:
 * the customer on the booking writes the public `customer_to_vendor` review,
 * and the vendor's own user writes the private `vendor_to_customer` one. A
 * third party gets 403 whatever role they hold.
 */
export async function createReview(
  db: AppDatabase,
  hub: EventHub,
  reviewerId: string,
  bookingId: string,
  input: CreateReviewInput,
): Promise<Review> {
  const booking = await findReviewableBooking(db, bookingId);

  /*
   * 404, not 403, for a booking that is not the caller's. Distinguishing "no
   * such booking" from "not yours" tells an attacker which ids exist, and a
   * booking id is guessable in exactly the way a slug is not.
   */
  if (!booking || (booking.customerId !== reviewerId && booking.vendorUserId !== reviewerId)) {
    throw notFound('That booking could not be found');
  }

  if (booking.status !== 'completed') {
    throw validationFailed('A booking can only be reviewed once the event has happened');
  }

  if (containsBlockedWord(input.title, input.content)) {
    throw validationFailed('That review contains language we cannot publish');
  }

  /*
   * Checked before the insert for the message, and enforced by
   * `UNIQUE(booking_id, reviewer_id)` for the truth. Two submissions racing
   * both pass this read; the index is what stops the second one landing, and
   * the conflict below is what turns its error into a sentence.
   */
  const existing = await findReviewByBookingAndReviewer(db, bookingId, reviewerId);

  if (existing) {
    throw conflict('You have already reviewed this booking');
  }

  const isCustomer = booking.customerId === reviewerId;
  const reviewedUserId = isCustomer ? booking.vendorUserId : booking.customerId;

  try {
    const written = await insertReviewAndRecalculate(db, {
      ...input,
      bookingId,
      reviewerId,
      vendorId: booking.vendorId,
      type: isCustomer ? 'customer_to_vendor' : 'vendor_to_customer',
      // Who the review is *about* — the party whose derived rating moves.
      reviewedUserId,
      notification: {
        title: 'New review',
        /*
         * Names the other party, because "you have a new review" gives a vendor
         * with four finished events no way to tell which one it is about. The
         * rating is in the sentence for the same reason: it is the fact the
         * recipient wants before deciding whether to open anything.
         */
        body: `${isCustomer ? booking.customerFirstName : booking.vendorBusinessName} left you a ${input.rating}-star review.`,
        /*
         * The slug only on the public direction. It is what `notificationHref`
         * reads to send a vendor to the tab their new review is on; a private
         * `vendor_to_customer` review has no public page, so omitting it is
         * what routes the customer to their own profile instead.
         */
        data: isCustomer ? { bookingId, vendorSlug: booking.vendorSlug } : { bookingId },
      },
    });

    /*
     * After the commit, and never able to fail it: a recipient with no tab open
     * simply has nothing to push to, and the row is already durable.
     */
    if (written.notification) {
      hub.publish(reviewedUserId, {
        type: 'new_notification',
        notification: toNotification(written.notification),
      });
    }

    return written.review;
  } catch (error) {
    // The race the read above cannot close.
    if (error instanceof Error && /reviews_booking_reviewer_key/.test(error.message)) {
      throw conflict('You have already reviewed this booking');
    }

    throw error;
  }
}

/**
 * One appended page of a vendor's public reviews, plus everything drawn above
 * the list.
 *
 * `viewerId` is optional because the tab is public — a signed-out reader gets
 * the same reviews and a `viewer` that permits nothing.
 */
export async function getVendorReviews(
  db: AppDatabase,
  slug: string,
  page: number,
  viewerId: string | null,
): Promise<VendorReviewsPage> {
  const vendor = await findPublicVendorBySlug(db, slug);

  if (!vendor) {
    throw notFound('That vendor could not be found');
  }

  const pageSize = REVIEW_PAGE_SIZE;
  /*
   * One more than the page, so `hasMore` is a fact rather than a comparison
   * against a total that a concurrent insert could have moved. "Show more
   * reviews" appends, so the only question is whether another press returns
   * anything.
   */
  const rows = await findPublicVendorReviews(db, vendor.id, pageSize + 1, (page - 1) * pageSize);
  const summary = await findVendorReviewSummary(db, vendor.id);

  return {
    items: rows.slice(0, pageSize),
    summary,
    viewer: await resolveViewer(db, vendor.id, viewerId),
    page,
    pageSize,
    hasMore: rows.length > pageSize,
  };
}

/**
 * What this viewer may do on this vendor's Reviews tab.
 *
 * A vendor reading their own profile cannot review themselves, and nobody
 * signed out can review anything — both fall out of there being no completed
 * booking between the viewer and the vendor, so neither needs its own branch.
 */
async function resolveViewer(
  db: AppDatabase,
  vendorId: string,
  viewerId: string | null,
): Promise<ReviewViewer> {
  if (!viewerId) {
    return { canReview: false, bookingId: null };
  }

  const booking = await findUnreviewedCompletedBooking(db, vendorId, viewerId);

  return { canReview: booking !== null, bookingId: booking?.id ?? null };
}
