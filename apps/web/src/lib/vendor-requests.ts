import { getServerSession } from './auth/server';
import { redirect } from 'next/navigation';
import { ApiClientError, apiRequest } from './api-client';
import { isNavigationSignal } from './navigation-signal';
import { signInPathReturningHere } from './requested-path';
import { readEveryPage } from './read-every-page';
import { redirectIfTermsRequired } from './terms-gate';
import { wireBookingRequestListSchema, type WireBookingRequest } from './wire-schemas';

/**
 * The vendor's own request queue. Server Components only.
 *
 * The endpoint scopes to the caller's own vendor profile — there is no
 * parameter naming whose queue to read, so a vendor cannot ask for another's.
 * `allPages` walks the whole history instead of the newest page, for the list
 * whose subject is every accepted date (VEN-433).
 */
export async function getOwnBookingRequests(
  options: { onFailure?: 'empty' | 'throw'; allPages?: boolean } = {},
): Promise<WireBookingRequest[]> {
  const token = (await getServerSession())?.token ?? null;

  if (!token) {
    redirect(await signInPathReturningHere());
  }

  try {
    const read = (query: string): Promise<WireBookingRequest[]> =>
      apiRequest(`/booking-requests${query}`, { schema: wireBookingRequestListSchema, token });

    return options.allPages ? await readEveryPage(read) : await read('');
  } catch (error) {
    if (isNavigationSignal(error)) {
      throw error;
    }

    /*
     * A lapsed session is not an empty queue. Before any degrading, a 401
     * sends the vendor to sign in — otherwise the dashboard reassures them
     * that nothing is waiting when the app simply could not read it, which is
     * the one claim an empty state must never make on a failure's behalf.
     * `customer-data.ts` already drew this line; this module did not.
     */
    if (error instanceof ApiClientError && error.statusCode === 401) {
      redirect(await signInPathReturningHere());
    }

    /*
     * Nor is an un-accepted account an empty queue. The acceptance gate (#429)
     * answers every read 403 `TERMS_REQUIRED` until the box is ticked, and
     * degrading that to `[]` would make this surface say nothing is waiting
     * when the reader is simply not through the gate yet — the same claim the
     * 401 branch above exists to stop it making.
     */
    await redirectIfTermsRequired(error);

    /*
     * The dashboard's subject is the request queue, but its stats and its
     * checklist are separate reads — one failing list costs the list, not the
     * page, and the empty state it falls back to is a designed surface.
     *
     * `/vendor/bookings` is the opposite case and passes `throw`: the list is
     * the entire page, and "you have no bookings" is a specific, alarming claim
     * to make at a vendor who has four. There, a failed read has to reach the
     * error boundary and say so.
     */
    if (options.onFailure === 'throw') {
      throw error;
    }

    return [];
  }
}
