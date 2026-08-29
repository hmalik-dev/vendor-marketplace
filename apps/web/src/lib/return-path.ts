/**
 * The query parameter carrying "where the customer was going" through the
 * sign-in round trip.
 *
 * **Deliberately not `redirect_url`.** That is Clerk's own reserved key:
 * clerk-js reads it off `window.location` and prefers it over the
 * `fallbackRedirectUrl` prop (`@clerk/shared`, `RedirectUrls#getRedirectUrl`),
 * so a destination carried under that name is consumed by Clerk and
 * `/after-sign-in` is skipped — taking the role resolution, the suspended-account
 * branch and this module's own re-validation with it. An app-owned key keeps
 * the destination on the app's own path through the flow.
 */
export const RETURN_PATH_PARAM = 'returnTo';

/**
 * Request header carrying the path the visitor actually asked for.
 *
 * Set by `middleware.ts` on every matched request, overwriting anything the
 * client sent under the same name. It exists for the redirects a *layout* has
 * to perform — `/customer` and `/vendor` gate their whole subtree, and a layout
 * renders above the page, so it is never told which child URL it is guarding.
 * A page that knows its own destination passes it explicitly instead.
 *
 * Reading it is still an untrusted read: `safeReturnPath` runs on the value
 * before it reaches a redirect, exactly as it does for a query parameter.
 */
export const REQUEST_PATH_HEADER = 'x-orla-request-path';

/** Paths that must never be a destination, because landing on one loops. */
const LOOPING_PREFIXES = ['/sign-in', '/sign-up', '/after-sign-in'] as const;

/** Origin used only to parse a path; never emitted, never compared against. */
const PARSE_ORIGIN = 'https://return-path.invalid';

/**
 * Narrows an untrusted return path to a same-origin one, or rejects it.
 *
 * This is an **open-redirect boundary**. The value is attacker-writable and
 * ends up in a redirect, so a permissive check turns sign-in into a way to
 * bounce a customer onto another origin from a link carrying our own domain.
 *
 * Only a path is ever accepted — never a URL, not even one on our own origin —
 * because a path cannot express an origin at all. The leading checks reject
 * what the URL parser would read as an origin (`https://`, `//host`, and the
 * backslash forms browsers normalise into `//`), and control characters, which
 * are how a redirect header gets split.
 *
 * **The value returned is the value validated.** An earlier revision checked
 * the raw string and returned a decoded one, which let dot segments walk past
 * the loop guard (`/x/../sign-in`) and promoted encoded `&` and `=` into
 * structural delimiters once decoded. Parsing and re-serialising means the
 * string handed back is exactly what a later `new URL(value, origin)` will
 * resolve to — including the re-check that normalisation has not produced a
 * scheme-relative path, which `/x/..//evil.test` otherwise does.
 */
export function safeReturnPath(value: string | null | undefined): string | null {
  if (typeof value !== 'string' || value.length === 0 || value.length > 512) {
    return null;
  }

  // Control characters, including the newline a header-splitting attempt uses.
  if (/[\u0000-\u001f\u007f]/.test(value)) {
    return null;
  }

  // A path, and only a path: one leading slash, and no backslash anywhere.
  if (!value.startsWith('/') || value.startsWith('//') || value.includes('\\')) {
    return null;
  }

  let url: URL;
  try {
    url = new URL(value, PARSE_ORIGIN);
  } catch {
    return null;
  }

  // A value that reached any other origin was a URL, not a path.
  if (url.origin !== PARSE_ORIGIN) {
    return null;
  }

  const normalized = `${url.pathname}${url.search}${url.hash}`;

  /*
   * Re-checked AFTER normalisation, not only before it: `/x/..//evil.test`
   * passes the leading test as written and resolves to `//evil.test`, which
   * the next `new URL` would read as a foreign origin.
   */
  if (!normalized.startsWith('/') || normalized.startsWith('//')) {
    return null;
  }

  // The loop guard runs on the resolved path, so dot segments cannot evade it.
  if (
    LOOPING_PREFIXES.some(
      (prefix) => url.pathname === prefix || url.pathname.startsWith(`${prefix}/`),
    )
  ) {
    return null;
  }

  return normalized;
}

/** `/sign-in` carrying the destination, when there is a safe one to carry. */
export function signInPathReturningTo(returnTo: string | null | undefined): string {
  const safe = safeReturnPath(returnTo);

  return safe ? `/sign-in?${RETURN_PATH_PARAM}=${encodeURIComponent(safe)}` : '/sign-in';
}
