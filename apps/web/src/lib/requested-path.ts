import { headers } from 'next/headers';
import { REQUEST_PATH_HEADER, safeReturnPath, signInPathReturningTo } from './return-path';

/**
 * Where the visitor was actually going, for the auth redirects that cannot be
 * told. Server Components and route handlers only — it reads request headers.
 *
 * Returns `null` rather than throwing when the header is absent, which is the
 * case in unit tests and for any request the middleware matcher skips. A
 * missing destination costs the return trip, never the redirect itself.
 */
export async function requestedPath(): Promise<string | null> {
  try {
    return safeReturnPath((await headers()).get(REQUEST_PATH_HEADER));
  } catch {
    /*
     * `headers()` throws outside a request scope. A data helper that runs
     * without one still has to be able to redirect, so this degrades to "no
     * destination" instead of replacing an auth redirect with a 500.
     */
    return null;
  }
}

/**
 * `/sign-in` carrying wherever the caller currently is. The single spelling of
 * "you need to be signed in for this" for every read that has no explicit
 * destination of its own to pass.
 */
export async function signInPathReturningHere(): Promise<string> {
  return signInPathReturningTo(await requestedPath());
}
