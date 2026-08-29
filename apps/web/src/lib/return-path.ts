/**
 * The query parameter that carries "where the customer was going" through the
 * sign-in round trip. Named to match what Clerk itself uses, so the two never
 * disagree about which key holds the destination.
 */
export const RETURN_PATH_PARAM = 'redirect_url';

/** Paths that must never be a destination, because landing on one loops. */
const LOOPING_PREFIXES = ['/sign-in', '/sign-up', '/after-sign-in'] as const;

/**
 * Narrows an untrusted return path to a same-origin one, or rejects it.
 *
 * This is an **open-redirect boundary**. The value arrives in a query string
 * that anyone can write and is then handed to a redirect, so a permissive
 * check here turns the sign-in page into a way to bounce a customer onto an
 * attacker's origin from a link that legitimately carries our own domain.
 *
 * Only a path is ever accepted — never a URL, not even one that happens to be
 * on our own origin — because a path cannot express an origin at all. That
 * rules out `https://evil.test`, the scheme-relative `//evil.test`, and the
 * backslash and encoded-slash variants browsers have historically normalised
 * into an origin. A destination that loops back into the auth flow is dropped
 * too: not a security failure, but it strands the customer.
 */
export function safeReturnPath(value: string | null | undefined): string | null {
  if (typeof value !== 'string' || value.length === 0 || value.length > 512) {
    return null;
  }

  /*
   * A browser may hand back a value that is still encoded, and `%2f%2f` is
   * `//`. One decode is enough to see through that; a value that is not valid
   * encoding at all is rejected rather than guessed at.
   */
  let candidate: string;
  try {
    candidate = decodeURIComponent(value);
  } catch {
    return null;
  }

  // Control characters, including the newline a header-splitting attempt uses.
  if (/[\u0000-\u001f\u007f]/.test(candidate)) {
    return null;
  }

  // A path, and only a path: one leading slash, and no backslash anywhere.
  if (!candidate.startsWith('/') || candidate.startsWith('//') || candidate.includes('\\')) {
    return null;
  }

  const [pathname] = candidate.split(/[?#]/);

  if (
    LOOPING_PREFIXES.some((prefix) => pathname === prefix || pathname?.startsWith(`${prefix}/`))
  ) {
    return null;
  }

  return candidate;
}

/** `/sign-in` carrying the destination, when there is a safe one to carry. */
export function signInPathReturningTo(returnTo: string | null | undefined): string {
  const safe = safeReturnPath(returnTo);

  return safe ? `/sign-in?${RETURN_PATH_PARAM}=${encodeURIComponent(safe)}` : '/sign-in';
}
