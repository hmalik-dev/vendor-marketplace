import { NextResponse } from 'next/server';
import { ApiClientError } from '@/lib/api-client';
import { getCurrentUser } from '@/lib/current-user';
import { RETURN_PATH_PARAM } from '@/lib/return-path';
import { postSignInPath } from '@/lib/role-routes';

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
   * back on the booking rather than the home page — but only when the role they
   * turned out to have can render it. `postSignInPath` re-validates the value
   * (this is the handler that actually performs the redirect, so it cannot
   * assume an earlier screen looked at it) and exchanges a destination that
   * role would only be bounced out of for that role's own start.
   *
   * Bouncing it here rather than letting the destination do it is the fix for
   * #410. The bounce inside a page or layout is an RSC `redirect()`, and the
   * navigation that follows sign-in is a client-side one, where the App Router
   * cannot reconcile a redirect that crosses layout segments: a vendor sent to
   * `/customer/profile` was left on a blank page still wearing the signed-out
   * header. This handler's redirect is a real HTTP one, which the router
   * follows either way — so the answer is to only ever send it somewhere that
   * will render.
   */
  const returnTo = new URL(request.url).searchParams.get(RETURN_PATH_PARAM);

  try {
    const user = await getCurrentUser();
    target = user ? postSignInPath(user.role, returnTo) : '/sign-in';
  } catch (error) {
    if (error instanceof ApiClientError && error.statusCode === 403) {
      target = '/suspended';
    } else {
      throw error;
    }
  }

  return NextResponse.redirect(new URL(target, request.url));
}
