import { NextResponse } from 'next/server';
import { ApiClientError } from '@/lib/api-client';
import { DASHBOARD_PATH_BY_ROLE, getCurrentUser } from '@/lib/current-user';
import { signInPathReturningTo } from '@/lib/return-path';

/**
 * "Take me to my dashboard" — the header's signed-in link, which cannot know
 * the caller's role without a round trip of its own. The role is resolved from
 * the local record and the request is forwarded to the matching dashboard.
 * Where a user *starts* after authenticating is a different question, answered
 * by `/after-sign-in`.
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
    /*
     * A signed-out caller comes back to `/dashboard` rather than to a role's
     * dashboard directly: this handler is the thing that knows how to resolve
     * a role, and it has not been able to do that yet.
     */
    target = user ? DASHBOARD_PATH_BY_ROLE[user.role] : signInPathReturningTo('/dashboard');
  } catch (error) {
    if (error instanceof ApiClientError && error.statusCode === 403) {
      target = '/suspended';
    } else {
      throw error;
    }
  }

  return NextResponse.redirect(new URL(target, request.url));
}
