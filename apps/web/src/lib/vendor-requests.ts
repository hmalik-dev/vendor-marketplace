import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { apiRequest } from './api-client';
import { isNavigationSignal } from './navigation-signal';
import { signInPathReturningHere } from './requested-path';
import { wireBookingRequestListSchema, type WireBookingRequest } from './wire-schemas';

/**
 * The vendor's own request queue. Server Components only.
 *
 * The endpoint scopes to the caller's own vendor profile — there is no
 * parameter naming whose queue to read, so a vendor cannot ask for another's.
 */
export async function getOwnBookingRequests(): Promise<WireBookingRequest[]> {
  const { getToken } = await auth();
  const token = await getToken();

  if (!token) {
    redirect(await signInPathReturningHere());
  }

  try {
    return await apiRequest('/booking-requests', {
      schema: wireBookingRequestListSchema,
      token,
    });
  } catch (error) {
    if (isNavigationSignal(error)) {
      throw error;
    }

    /*
     * The dashboard's subject is the request queue, but its stats and its
     * checklist are separate reads — one failing list costs the list, not the
     * page, and the empty state it falls back to is a designed surface.
     */
    return [];
  }
}
