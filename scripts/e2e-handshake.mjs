/**
 * #321. Restoring a saved `storageState` renders the signed-out header on the
 * first document request, and no real user is ever in that state — a real
 * sign-in takes zero handshake hops. Every browser verification in this
 * repository restores a `storageState`, so every check that reads auth chrome
 * on first paint was reading a state the product does not have.
 *
 * Confirmed cause: `pnpm e2e:auth` captures the Clerk `__session` cookie — a
 * short-lived session JWT — at the moment it signs in. By the time a later
 * pass restores that `.auth/*.json`, the token has typically aged past its
 * TTL. A *development* Clerk instance has no first-party cookie domain shared
 * with the app (its Frontend API lives on a separate `*.accounts.dev` host),
 * so it cannot refresh an expired `__session` silently on the server: it has
 * to round-trip through `/v1/client/handshake` and an `__clerk_handshake`
 * callback leg before the app's own document reflects the real session.
 * Until that settles, the server's first render for the load reads
 * signed-out — a true reading of a stale harness, not of the product. A real
 * in-context sign-in never shows this, because the token is minted at the
 * moment of use and is nowhere near its TTL.
 *
 * This is a *timing* defect, not a missing-cookie one: the same `__session`
 * cookie is present in a restored context, it is just too old to use without
 * a refresh. Measured across three lanes now (153, 215, 313) — see
 * `.claude/agent-memory/browser-verifier/stored-auth-state-needs-marker-wait-not-fixed-sleep.md`
 * and `.claude/agent-memory/browser-verifier/clerk-handshake-urls-leak-session-tokens.md`,
 * which names the exact legs of the round trip these markers match.
 *
 * The fix is procedural, not code: `.claude/rules/e2e-auth.md` states that
 * first-paint auth chrome may not be asserted from a restored context's very
 * first navigation. This module is the mechanical check behind that rule —
 * something a verification pass can run against the document requests it
 * observed for one page load, rather than eyeballing the rendered header.
 */

const HANDSHAKE_MARKERS = ['/v1/client/handshake', '__clerk_handshake', '__clerk_synced'];

/** True when `url` is a leg of Clerk's handshake round trip, not the destination itself. */
export function isHandshakeHop(url) {
  return HANDSHAKE_MARKERS.some((marker) => url.includes(marker));
}

/**
 * Counts how many of an ordered list of document-request URLs — one page
 * load's navigation/redirect chain, in request order — are handshake legs
 * rather than the destination.
 *
 * Zero is the healthy case. A fresh sign-in, or a restored context whose
 * token is still inside its TTL, resolves the destination directly and never
 * enters the loop. Any count above zero means the render an agent is looking
 * at came before the handshake completed, so a first-paint assertion about
 * auth chrome on *that* render is not evidence of anything — it is the
 * harness, not the product.
 */
export function countHandshakeHops(urls) {
  return urls.filter(isHandshakeHop).length;
}

/**
 * What a verification pass should conclude once it knows the hop count for
 * the navigation it is about to assert against. Call this instead of reading
 * the rendered header as ground truth — the header is the symptom, and
 * asserting the symptom is what made #321 look like a product defect (#259)
 * for a day.
 */
export function handshakeVerdict(hopCount) {
  if (hopCount === 0) {
    return { safe: true, reason: 'no handshake hop — this render reflects the real session' };
  }
  return {
    safe: false,
    reason:
      `${hopCount} handshake hop(s) on this load — it predates the session settling. ` +
      'Warm the context with one throwaway navigation and assert auth chrome from the next one instead.',
  };
}
