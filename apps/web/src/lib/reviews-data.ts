import { auth } from '@clerk/nextjs/server';
import { ApiClientError, apiRequest } from './api-client';
import { getCurrentUser } from './current-user';
import { isNavigationSignal } from './navigation-signal';
import {
  wireBookingListSchema,
  wireReviewListSchema,
  wireVendorReviewsPageSchema,
  type WireVendorReviewsPage,
} from './wire-schemas';

/**
 * Server-side reads for the Reviews tab on a vendor's public profile. Unlike
 * `customer-data.ts`'s reads, none of these may redirect a signed-out visitor
 * — the profile they sit on is public, and a stranger asking to see it is the
 * ordinary case, not a session failure.
 */

const DEFAULT_REVIEW_PAGE_SIZE = 10;

export interface GetVendorReviewsOptions {
  page?: number;
  limit?: number;
}

/** `GET /vendors/:slug/reviews` — public, unauthenticated, like the profile itself. */
export async function getVendorReviews(
  slug: string,
  options: GetVendorReviewsOptions = {},
): Promise<WireVendorReviewsPage> {
  const query = new URLSearchParams();
  query.set('page', String(options.page ?? 1));
  query.set('limit', String(options.limit ?? DEFAULT_REVIEW_PAGE_SIZE));

  return apiRequest(`/vendors/${encodeURIComponent(slug)}/reviews?${query.toString()}`, {
    schema: wireVendorReviewsPageSchema,
  });
}

export interface ReviewEligibility {
  eligible: boolean;
  /** The completed, not-yet-reviewed booking to submit the review against. */
  bookingId: string | null;
}

const NOT_ELIGIBLE: ReviewEligibility = { eligible: false, bookingId: null };

/**
 * Whether the reader may write a review of this vendor — a completed booking
 * with them that this reader has not already reviewed. `40-states.md`'s "Write
 * a review" affordance reads this, and every branch here fails closed: a
 * signed-out visitor, a vendor, and an upstream failure all resolve to "no",
 * never to an error that would take the rest of the tab down with it.
 */
export async function getReviewEligibility(vendorId: string): Promise<ReviewEligibility> {
  const user = await getCurrentUser();

  if (!user || user.role !== 'customer') {
    return NOT_ELIGIBLE;
  }

  const { getToken } = await auth();
  const token = await getToken();

  if (!token) {
    return NOT_ELIGIBLE;
  }

  let ownBookings;
  try {
    ownBookings = await apiRequest('/bookings', { schema: wireBookingListSchema, token });
  } catch (error) {
    if (isNavigationSignal(error)) {
      throw error;
    }
    return NOT_ELIGIBLE;
  }

  const completed = ownBookings.filter(
    (booking) => booking.vendorId === vendorId && booking.status === 'completed',
  );

  for (const booking of completed) {
    try {
      const bookingReviews = await apiRequest(`/bookings/${booking.id}/reviews`, {
        schema: wireReviewListSchema,
        token,
      });

      if (!bookingReviews.some((review) => review.reviewerId === user.id)) {
        return { eligible: true, bookingId: booking.id };
      }
    } catch (error) {
      if (isNavigationSignal(error)) {
        throw error;
      }
      if (error instanceof ApiClientError) {
        continue;
      }
      throw error;
    }
  }

  return NOT_ELIGIBLE;
}
