/**
 * Next signals `redirect()` and `notFound()` by **throwing**, marking the error
 * with a `digest` string rather than using a distinct class.
 *
 * Any `catch` that degrades a failure has to let these through. Swallowing one
 * strands the visitor on the page that was trying to leave — a suspended user
 * would stay on the page instead of reaching `/suspended`, and a missing vendor
 * would render an empty profile instead of the 404.
 */
export function isNavigationSignal(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    typeof (error as { digest?: unknown }).digest === 'string'
  );
}
