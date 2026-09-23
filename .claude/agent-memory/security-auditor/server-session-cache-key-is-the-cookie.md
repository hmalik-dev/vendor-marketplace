---
name: server-session-cache-key-is-the-cookie
description: VEN-460 put an in-process Map from the Neon Auth session cookie value to a minted JWT in front of getServerSession, so a cache hit replaces the SDK's signature/revocation check with a Map lookup on a client-supplied key
metadata:
  type: project
---

`apps/web/src/lib/auth/server.ts` keeps `mintedSessions: Map<cookieValue,
{userId, token, expiresAtMs}>` and, on a hit, returns the JWT **without calling
`auth.getSession()`** — so on that path nothing verifies the cookie's HMAC
(`NEON_AUTH_COOKIE_SECRET`) or asks Neon whether the session still exists. The
key is therefore the whole gate, and `/api/session/token` hands the hit's token
to the browser.

**The key must be unforgeable and unshareable.** The first version keyed on
`getAll().find((c) => c.name.endsWith('session_token'))?.value` — first match
wins, so any _second_ cookie with that suffix (a `document.cookie` write from
any script on the origin — CSP here carries `'unsafe-inline'` — or a sibling
subdomain on the launch domain) sets the key for the victim's session, and the
party that chose that value replays it alone for the victim's userId + JWT. A
**write-only** cookie primitive becomes account takeover. Key on every matching
cookie (`name=value`, sorted, joined) or on the SDK's exact names, and never on
an empty value.

**What the cache does not weaken:** authorization. Every read still sends the
token to the API, which re-verifies it and re-checks `isBanned`/`deletedAt` per
request, so a ban is still instant. The lag it does add is revocation: after
sign-out the entry survives, keyed by the cookie the proxy just revoked, for up
to the JWT's remaining life (~14 min). The `/api/auth/sign-out` proxy sees that
cookie and is the one place that can evict it.

**VEN-619 deadline (audited clean):** `withDeadline` folds a stalled
`getSession`/`token` into `{data:null}` → signed out, the 429 precedent; it
never reaches `remember()`, and every caller maps null to redirect/401/signed-out
chrome. The web never authorizes on this read; the API re-verifies the token.
The `[api-timeout]` line prints the path _with query_ (admin `?q=` holds a
customer name/email), but `ApiTimeoutError.message` already carried it — not new.

**How to apply:** any future cache in front of a session read is judged on its
key, not its TTL — ask what a caller can put in the key and who else can hold
the same one. Related: [[neon-auth-cutover-boundaries]],
[[identity-read-is-cached-and-route-dynamism-is-inherited]].
