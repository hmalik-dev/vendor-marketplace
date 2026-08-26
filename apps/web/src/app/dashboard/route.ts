import { NextResponse } from 'next/server';
import { ApiClientError } from '@/lib/api-client';
import { DASHBOARD_PATH_BY_ROLE, getCurrentUser } from '@/lib/current-user';

/**
 * Neutral landing spot after sign-in and sign-up. Clerk redirects here without
 * knowing the user's role, so the role is resolved from the local record and
 * the request is forwarded to the matching dashboard.
 *
 * This is a route handler rather than a page that calls `redirect()`. Clerk
 * lands here with a client-side navigation, and an RSC redirect that crosses
 * into a different layout segment leaves the App Router unable to reconcile
 * the tree — the user is left on a blank `/dashboard`. A route handler answers
 * with a real HTTP redirect, which the router follows on soft and hard
 * navigations alike.
 */
export async function GET(request: Request): Promise<NextResponse> {
  let target: string;

  try {
    const user = await getCurrentUser();
    target = user ? DASHBOARD_PATH_BY_ROLE[user.role] : '/sign-in';
  } catch (error) {
    if (error instanceof ApiClientError && error.statusCode === 403) {
      target = '/suspended';
    } else {
      throw error;
    }
  }

  return NextResponse.redirect(new URL(target, request.url));
}
