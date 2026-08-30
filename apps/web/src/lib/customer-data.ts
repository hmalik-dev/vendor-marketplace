import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { ApiClientError, apiRequest } from './api-client';
import { isNavigationSignal } from './navigation-signal';
import { signInPathReturningHere } from './requested-path';
import {
  wireBookingListSchema,
  wireBookingRequestListSchema,
  wireBookingRequestSchema,
  wireCustomerReviewListSchema,
  type WireBooking,
  type WireBookingRequest,
  type WireCustomerReview,
} from './wire-schemas';

/**
 * Server-side reads for the customer's own surfaces. Server Components only —
 * the Clerk session is resolved on the server, so no token reaches the browser.
 */

async function customerToken(): Promise<string> {
  const { getToken } = await auth();
  const token = await getToken();

  if (!token) {
    redirect(await signInPathReturningHere());
  }

  return token;
}

/**
 * The customer's own history is supporting content on a page whose subject is
 * their profile: one section failing costs that section, not the page. The
 * profile read itself is the one that must propagate, and it comes from
 * `requireCurrentUser`.
 */
async function degradeToEmpty<T>(read: () => Promise<T[]>): Promise<T[]> {
  try {
    return await read();
  } catch (error) {
    if (isNavigationSignal(error)) {
      throw error;
    }
    if (error instanceof ApiClientError && error.statusCode === 401) {
      redirect(await signInPathReturningHere());
    }

    return [];
  }
}

/** Every request this customer has sent, newest first. */
export async function getOwnBookingRequests(): Promise<WireBookingRequest[]> {
  const token = await customerToken();

  return degradeToEmpty(() =>
    apiRequest('/booking-requests', { schema: wireBookingRequestListSchema, token }),
  );
}

/**
 * One request this customer sent, or `null` when it is not theirs.
 *
 * The API answers another customer's request with a 404 rather than a 403 —
 * whether a row exists is not something a stranger gets to learn — so both
 * cases arrive here identically and the caller renders the same not-found page.
 * Deliberately not routed through `degradeToEmpty`: an empty list is a
 * reasonable degraded read for a hub, but a missing request is not a reasonable
 * degraded read for a page that is only about that request.
 */
export async function getOwnBookingRequest(requestId: string): Promise<WireBookingRequest | null> {
  const token = await customerToken();

  try {
    return await apiRequest(`/booking-requests/${requestId}`, {
      schema: wireBookingRequestSchema,
      token,
    });
  } catch (error) {
    if (isNavigationSignal(error)) {
      throw error;
    }
    if (error instanceof ApiClientError && error.statusCode === 401) {
      redirect(await signInPathReturningHere());
    }
    if (error instanceof ApiClientError && error.statusCode === 404) {
      return null;
    }

    throw error;
  }
}

/** Bookings that reached payment, carrying their occasion and venue. */
export async function getOwnBookings(): Promise<WireBooking[]> {
  const token = await customerToken();

  return degradeToEmpty(() => apiRequest('/bookings', { schema: wireBookingListSchema, token }));
}

/** What vendors have said about working with this customer. */
export async function getOwnCustomerReviews(): Promise<WireCustomerReview[]> {
  const token = await customerToken();

  return degradeToEmpty(() =>
    apiRequest('/customers/me/reviews', { schema: wireCustomerReviewListSchema, token }),
  );
}
