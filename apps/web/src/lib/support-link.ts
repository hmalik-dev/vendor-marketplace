import { SUPPORT_PATH } from '@vendor-marketplace/shared';

/**
 * The one place a link into `/support` is built, and the one place its query
 * is named.
 *
 * The 500 screen writes these and the support page reads them, and the two
 * live in different halves of the app — so a rename that touched only one
 * would silently stop attaching the reference, and the screen would look
 * exactly as it does for a visitor arriving from the footer. Nothing would
 * fail; the support inbox would just quietly go back to receiving reports it
 * cannot look up.
 */
export const SUPPORT_ERROR_DIGEST_PARAM = 'digest';
export const SUPPORT_ERROR_ROUTE_PARAM = 'from';
export const SUPPORT_ERROR_AT_PARAM = 'at';

export interface SupportLinkContext {
  /** Next's `error.digest`. Absent for an error thrown while rendering. */
  digest?: string;
  /** The path the visitor was on. */
  route: string;
  /** When it happened, as an ISO instant. */
  occurredAt: string;
}

/**
 * Query parameters that never travel to support.
 *
 * The route the visitor was on is genuinely useful — `/search?category=x` says
 * what broke — but it is copied off `window.location`, and not every parameter
 * in a URL is the app's. Clerk puts `__clerk_ticket` on the auth routes, which
 * is a single-use sign-in credential; a crash on exactly that URL would have
 * emailed it to the support inbox and stored it on the message.
 *
 * A denylist rather than an allowlist, deliberately: the app's own parameters
 * are spread across the search state, the bookings hub and the vendor screens,
 * and a list that has to enumerate them goes stale the first time somebody adds
 * one — silently dropping the context this link exists to carry. What has to be
 * complete is the *secret* side, and that side has a shape: framework
 * parameters are `__`-prefixed by convention, and the rest name themselves.
 *
 * Nothing legitimate is caught. `state=TX` survives (the search filter);
 * `date`, `category`, `city`, `tab`, `sort` and `page` all survive.
 */
const SECRET_PARAM = /^__|token|secret|password|signature|credential|ticket|jwt|apikey|api_key/i;

/**
 * The visitor's route, with anything credential-shaped taken out of its query.
 *
 * Exported for `support-link.test.ts`, which is where the shape above is
 * pinned — a regex nobody tests is a comment.
 */
export function scrubbedRoute(pathname: string, search: string): string {
  const query = new URLSearchParams(search);

  for (const key of [...query.keys()]) {
    if (SECRET_PARAM.test(key)) {
      query.delete(key);
    }
  }

  const remaining = query.toString();

  return remaining === '' ? pathname : `${pathname}?${remaining}`;
}

/**
 * `/support`, carrying the error context when there is one to carry.
 *
 * Without a digest there is nothing to attach — an error thrown on the client
 * was never written to the server log — so the link is the bare path and the
 * screen renders its signed-in or signed-out state instead of pretending to a
 * reference nobody can look up.
 */
export function supportLink(context?: SupportLinkContext): string {
  if (context?.digest === undefined) {
    return SUPPORT_PATH;
  }

  const query = new URLSearchParams({
    [SUPPORT_ERROR_DIGEST_PARAM]: context.digest,
    [SUPPORT_ERROR_ROUTE_PARAM]: context.route,
    [SUPPORT_ERROR_AT_PARAM]: context.occurredAt,
  });

  return `${SUPPORT_PATH}?${query.toString()}`;
}
