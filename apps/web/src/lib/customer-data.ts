import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { ApiClientError, ApiTimeoutError, apiRequest } from './api-client';
import { isNavigationSignal } from './navigation-signal';
import { signInPathReturningHere } from './requested-path';
import {
  wireBookingListSchema,
  wireBookingRequestListSchema,
  wireBookingRequestSchema,
  wireBookingSchema,
  wireCheckoutIntentSchema,
  wireCustomerReviewListSchema,
  type WireBooking,
  type WireBookingRequest,
  type WireCheckoutIntent,
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
    /*
     * 400 as well as 404. `web-route-boundaries.md` puts "a 400 caused by an
     * identifier that cannot exist" in the `notFound()` column, not the error
     * boundary — an id the API refuses to parse is a request that cannot exist,
     * and answering it with a 500 page turns a pasteable URL into a crash. The
     * page validates the id before calling, so this is the second line rather
     * than the first.
     */
    if (error instanceof ApiClientError && (error.statusCode === 404 || error.statusCode === 400)) {
      return null;
    }

    throw error;
  }
}

/**
 * Why a checkout could not be opened.
 *
 * Four outcomes rather than one nullable intent, because #387: the page folded
 * every failure into `null` and turned all of them into `notFound()`, so a
 * Stripe misconfiguration told the customer *"this page isn't here. The link
 * may be old, or a vendor may have taken their listing down"* — three claims,
 * all false, about a live booking on a published vendor. What Stripe cannot do
 * and what does not exist are different answers and get different screens.
 */
export type CheckoutOutcome =
  /** The intent exists and the card form can render. */
  | { state: 'ready'; checkout: WireCheckoutIntent }
  /**
   * There is nothing here to pay for: no such request, or not this customer's.
   *
   * **402 is deliberately folded in with them.** The vendor has not finished
   * connecting payouts, the booking may well become payable later, and there is
   * nothing the customer can do about it from here — naming the vendor's Stripe
   * status to their customer is not information they are owed.
   */
  | { state: 'not-found' }
  /** The request left `accepted` underneath the customer — 409. */
  | { state: 'not-payable' }
  /**
   * Payment could not be started, and the booking is untouched.
   *
   * 400 or 422 from the API, and also the 8s deadline #390 put on every
   * server-side call. This is a POST issued from a Server Component — the
   * intent has to exist before the card form can render — so it carries that
   * deadline, and a timeout would otherwise reach the generic 500 boundary.
   * Retrying is safe because the endpoint is idempotent on
   * `pay_<requestId>`: a retry after a lost response reaches the same intent
   * rather than minting a second one.
   */
  | { state: 'failed' };

/**
 * Opens checkout for one accepted request.
 *
 * A POST from a Server Component, which is unusual and is the right call here:
 * the intent must exist before the page can render the card form at all, and
 * the alternative — render, then create the intent from the browser — shows the
 * customer a payment form that is not yet backed by a charge, and turns every
 * checkout into two round trips. It is safe to repeat because the endpoint is
 * idempotent, so a refresh reaches the same intent rather than a second one.
 */
export async function openCheckout(requestId: string): Promise<CheckoutOutcome> {
  const token = await customerToken();

  try {
    return {
      state: 'ready',
      checkout: await apiRequest(`/customer/booking-requests/${requestId}/checkout`, {
        method: 'POST',
        schema: wireCheckoutIntentSchema,
        token,
      }),
    };
  } catch (error) {
    if (isNavigationSignal(error)) {
      throw error;
    }
    if (error instanceof ApiTimeoutError) {
      return { state: 'failed' };
    }
    if (!(error instanceof ApiClientError)) {
      throw error;
    }
    if (error.statusCode === 401) {
      redirect(await signInPathReturningHere());
    }
    if (error.statusCode === 404 || error.statusCode === 402) {
      return { state: 'not-found' };
    }
    if (error.statusCode === 409) {
      return { state: 'not-payable' };
    }
    if (error.statusCode === 400 || error.statusCode === 422) {
      return { state: 'failed' };
    }

    throw error;
  }
}

/**
 * The booking a request produced, or `null` while the charge has not settled.
 *
 * This is also the reconciliation trigger: the API asks Stripe directly when no
 * webhook ever arrived, so a customer who paid and then watched the confirmed
 * screen fail to appear gets their booking by reloading it.
 */
export async function getBookingForRequest(requestId: string): Promise<WireBooking | null> {
  const token = await customerToken();

  try {
    return await apiRequest(`/customer/booking-requests/${requestId}/booking`, {
      schema: wireBookingSchema,
      token,
    });
  } catch (error) {
    if (isNavigationSignal(error)) {
      throw error;
    }
    if (error instanceof ApiClientError && error.statusCode === 401) {
      redirect(await signInPathReturningHere());
    }
    if (error instanceof ApiClientError && (error.statusCode === 404 || error.statusCode === 400)) {
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
