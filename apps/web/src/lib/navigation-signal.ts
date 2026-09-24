/**
 * The `digest` prefixes Next gives the errors it throws for control flow:
 * `redirect()`, `notFound()` and its siblings (`NEXT_HTTP_ERROR_FALLBACK;404`),
 * and the two that make a render dynamic or client-only.
 * `DYNAMIC_SERVER_USAGE` has to stay in this list: swallowing it breaks static
 * rendering the way swallowing a redirect strands a visitor.
 */
const NEXT_CONTROL_FLOW_DIGESTS = [
  'NEXT_REDIRECT',
  'NEXT_NOT_FOUND',
  'NEXT_HTTP_ERROR_FALLBACK',
  'DYNAMIC_SERVER_USAGE',
  'BAILOUT_TO_CLIENT_SIDE_RENDERING',
] as const;

/**
 * Next signals `redirect()` and `notFound()` by **throwing**, marking the error
 * with a `digest` string rather than using a distinct class.
 *
 * Any `catch` that degrades a failure has to let these through. Swallowing one
 * strands the visitor on the page that was trying to leave — a suspended user
 * would stay on the page instead of reaching `/suspended`, and a missing vendor
 * would render an empty profile instead of the 404.
 *
 * **Not "has a string digest".** That was the check until VEN-690, and it was
 * true of Next's signals only by accident: `ApiClientError` now carries the
 * request id as its `digest`, so the loose check read every API failure as a
 * redirect and rethrew it past the catch that should have degraded it.
 */
export function isNavigationSignal(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) {
    return false;
  }
  const { digest } = error as { digest?: unknown };

  return (
    typeof digest === 'string' &&
    NEXT_CONTROL_FLOW_DIGESTS.some((prefix) => digest.startsWith(prefix))
  );
}
