import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import type { UserRole } from '@vendorhub/shared';
import { ApiClientError, apiRequest } from './api-client';
import { wireUserSchema, type WireUser } from './wire-schemas';

/** Where each role's own dashboard lives. */
export const DASHBOARD_PATH_BY_ROLE: Record<UserRole, string> = {
  customer: '/customer/dashboard',
  vendor: '/vendor/dashboard',
  admin: '/customer/dashboard',
};

/**
 * Where each role *starts* after authenticating, which is not the same question
 * as where its dashboard lives. A customer's first move is to browse vendors,
 * so sign-in drops them on the marketplace home rather than a dashboard they
 * did not ask for; a vendor has no use for a catalogue of other vendors, so
 * they start on their own.
 */
export const POST_SIGN_IN_PATH_BY_ROLE: Record<UserRole, string> = {
  customer: '/',
  vendor: DASHBOARD_PATH_BY_ROLE.vendor,
  admin: '/',
};

/**
 * Loads the caller's profile from the API. Server Components only — it reads
 * the Clerk session on the server and never ships a token to the browser.
 * Returns `null` when nobody is signed in or the session no longer resolves to
 * an account, which is the caller's cue to send them to sign-in.
 */
export async function getCurrentUser(): Promise<WireUser | null> {
  const { getToken } = await auth();
  const token = await getToken();

  if (!token) {
    return null;
  }

  try {
    return await apiRequest('/users/me', { schema: wireUserSchema, token });
  } catch (error) {
    if (error instanceof ApiClientError && (error.statusCode === 401 || error.statusCode === 404)) {
      return null;
    }
    throw error;
  }
}

/**
 * Loads the caller and sends them somewhere sensible when there is no usable
 * session. Role is read from the local database record, never from Clerk
 * metadata.
 */
export async function requireCurrentUser(): Promise<WireUser> {
  const user = await getCurrentUserOrSuspend();

  if (!user) {
    redirect('/sign-in');
  }

  return user;
}

/**
 * `getCurrentUser` with the suspended-account case turned into a redirect.
 * A suspended account is a distinct case from a signed-out one: the API answers
 * it with 403, and letting that error reach the render turns the page into a
 * raw 500.
 */
async function getCurrentUserOrSuspend(): Promise<WireUser | null> {
  try {
    return await getCurrentUser();
  } catch (error) {
    if (error instanceof ApiClientError && error.statusCode === 403) {
      redirect('/suspended');
    }
    throw error;
  }
}

/**
 * Loads the caller and bounces them to their own dashboard if they hold a
 * different role, so `/vendor/*` and `/customer/*` stay separated.
 */
export async function requireRole(role: UserRole): Promise<WireUser> {
  const user = await requireCurrentUser();

  if (user.role !== role) {
    redirect(DASHBOARD_PATH_BY_ROLE[user.role]);
  }

  return user;
}

/**
 * Guards the authentication pages. Somebody who already holds a session has
 * nothing to do on sign-in or sign-up, so send them to `/after-sign-in`, which
 * resolves the role from the local record and forwards on.
 */
export async function redirectIfSignedIn(): Promise<void> {
  const { userId } = await auth();

  if (userId) {
    redirect('/after-sign-in');
  }
}

/**
 * Guards the root page. `/` is the customer-facing browse surface, and a vendor
 * has no use for a catalogue of other vendors — their home is their own
 * dashboard. Signed-out visitors and customers fall through and see the page.
 */
export async function redirectVendorToDashboard(): Promise<void> {
  const user = await getCurrentUserOrSuspend();

  if (user?.role === 'vendor') {
    redirect(DASHBOARD_PATH_BY_ROLE.vendor);
  }
}
