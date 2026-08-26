import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import type { UserRole } from '@vendorhub/shared';
import { ApiClientError, apiRequest } from './api-client';
import { wireUserSchema, type WireUser } from './wire-schemas';

/** Where a signed-in user of each role belongs after authentication. */
export const DASHBOARD_PATH_BY_ROLE: Record<UserRole, string> = {
  customer: '/customer/dashboard',
  vendor: '/vendor/dashboard',
  admin: '/customer/dashboard',
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
 *
 * A suspended account is a distinct case from a signed-out one: the API
 * answers it with 403, and letting that error reach the render turns every
 * protected page into a raw 500.
 */
export async function requireCurrentUser(): Promise<WireUser> {
  let user: WireUser | null;

  try {
    user = await getCurrentUser();
  } catch (error) {
    if (error instanceof ApiClientError && error.statusCode === 403) {
      redirect('/suspended');
    }
    throw error;
  }

  if (!user) {
    redirect('/sign-in');
  }

  return user;
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
