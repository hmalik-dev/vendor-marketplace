import { redirect } from 'next/navigation';
import { ApiClientError } from './api-client';
import { requestedPath } from './requested-path';
import { isGateExemptPath, isTermsRequired, termsAcceptancePath } from './terms-gate-paths';

/**
 * The first-sign-in acceptance gate, on the server.
 *
 * The API is where the gate is *enforced* — every guarded route answers a
 * session whose account has not accepted the current Terms with
 * `TERMS_REQUIRED`, so nothing here can be worked around by asking for a URL
 * directly. What this does is turn that refusal into the screen the reader is
 * owed, in the places a protected read is performed.
 *
 * **It is deliberately not middleware.** `middleware.ts` says why: Clerk
 * deprecated path-matcher guards because a matcher can diverge from how Next
 * actually routes a request and leave a protected resource reachable. A gate
 * that lives in the API and surfaces here through the reads every protected
 * screen already performs cannot diverge from anything.
 *
 * The pure half is `terms-gate-paths.ts` and is re-exported below, so a Server
 * Component still imports one module. It is a separate file because this one
 * reads request headers and therefore cannot be pulled into a client bundle,
 * and `useApi` needs two of those helpers in the browser.
 */
export { isGateExemptPath, isTermsRequired, termsAcceptancePath } from './terms-gate-paths';

/**
 * Sends the reader to the interstitial when the API says they must accept,
 * and returns otherwise so the caller can handle its own errors.
 *
 * `redirect()` throws, so this either navigates or falls through — there is no
 * boolean to forget to check.
 *
 * **The destination is resolved here rather than passed in.** Five of the six
 * server call sites had nothing to hand it, so they were sending readers to a
 * bare `/accept-terms` and dropping them on their role's default afterwards —
 * while the 401 branch one line above each of them carried
 * `signInPathReturningHere()`. Doing it here is what makes every read behave
 * the way the gate's own tests say it does.
 */
export async function redirectIfTermsRequired(
  error: unknown,
  returnTo?: string | null,
): Promise<void> {
  if (!isTermsRequired(error)) {
    return;
  }

  const here = returnTo ?? (await requestedPath());

  /*
   * The same exemption the client funnel carries, for the same reason and one
   * more. A protected read added to `/terms` or `/support` would otherwise
   * bounce a gated reader off the document the gate is asking them to accept —
   * and on the interstitial itself `requestedPath()` resolves to the gate, so
   * the redirect would be to the page already rendering it.
   */
  if (here !== null && isGateExemptPath(here.split(/[?#]/, 1)[0] ?? here)) {
    return;
  }

  redirect(termsAcceptancePath(here));
}

/**
 * Where a **signed-in** caller goes when a read refuses them, or `null` when
 * the error is not one of the two refusals a session can meet.
 *
 * The ordering is the point and is why this is one function rather than a
 * comment repeated at each site: `TERMS_REQUIRED` has to be tested **before**
 * the plain 403, because both are 403 and only the code separates a gate the
 * reader clears in one click from a suspension that is terminal.
 *
 * For the two Route Handlers, which build a `NextResponse.redirect` and need a
 * string rather than a thrown navigation.
 */
export function signedInFailurePath(error: unknown, returnTo?: string | null): string | null {
  if (isTermsRequired(error)) {
    return termsAcceptancePath(returnTo);
  }

  return error instanceof ApiClientError && error.statusCode === 403 ? '/suspended' : null;
}
