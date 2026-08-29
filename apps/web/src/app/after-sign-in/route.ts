import { NextResponse } from 'next/server';
import { ApiClientError } from '@/lib/api-client';
import { getCurrentUser, POST_SIGN_IN_PATH_BY_ROLE } from '@/lib/current-user';
import { RETURN_PATH_PARAM, safeReturnPath } from '@/lib/return-path';

/**
 * Neutral landing spot after sign-in and sign-up. Clerk redirects here without
 * knowing the user's role, so the role is resolved from the local record and
 * the request is forwarded to wherever that role starts — a vendor's own
 * dashboard, or the marketplace home for everyone else.
 *
 * A route handler rather than a page that calls `redirect()`: Clerk lands here
 * with a client-side navigation, and an RSC redirect that crosses into a
 * different layout segment leaves the App Router unable to reconcile the tree.
 * A route handler answers with a real HTTP redirect, which the router follows
 * on soft and hard navigations alike.
 */
export async function GET(request: Request): Promise<NextResponse> {
  let target: string;

  /*
   * A destination carried through the sign-in round trip wins over the role's
   * default start, so a customer who was asked to sign in mid-booking lands
   * back on the booking rather than the home page. Still untrusted here — this
   * is the handler that actually performs the redirect — so it is re-validated
   * rather than assumed safe because an earlier screen looked at it.
   */
  const returnTo = safeReturnPath(new URL(request.url).searchParams.get(RETURN_PATH_PARAM));

  try {
    const user = await getCurrentUser();
    target = user ? (returnTo ?? POST_SIGN_IN_PATH_BY_ROLE[user.role]) : '/sign-in';
  } catch (error) {
    if (error instanceof ApiClientError && error.statusCode === 403) {
      target = '/suspended';
    } else {
      throw error;
    }
  }

  return NextResponse.redirect(new URL(target, request.url));
}
