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
