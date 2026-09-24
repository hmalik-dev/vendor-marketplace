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

**VEN-628 sign-out bound (audited 2026-09-23):** the sign-out proxy reads the
caller's id off this cache (`mintedUserIdForCaller`, same key, sound) or a live
`getSession`, then bumps a **per-user** `users.sessions_invalidated_at` via
`POST /internal/session-generation` (WEB_TIER_KEY-gated, constant 200 — sound).
The API compares it to the token's `iat` after `verify()` on the same string —
sound. The failure is scope: other devices keep a live Neon session while their
JWTs are refused, and every other instance's cache keeps serving the refused JWT
until it lapses; `iat` is whole seconds, so a re-mint in the sign-out's own
second is refused and then cached. Pair a per-user bump with `revoke-sessions`.

**VEN-699 cross-tab sign-out (audited 2026-09-24, PASS):** the focus probe
reads `/api/session/token`, so it inherits this cache's revocation lag — an
other-device sign-out shows up only after the entry lapses (correctness, not a
leak). The `BroadcastChannel` message is a constant string and is same-origin
and storage-partitioned. Forging it only makes the tab clear its cached token
and reload. The server still sees the cookie, so the reload is not a logout.
The `endSession()` destinations are constants or `signInPathReturningTo`. The
reload uses `location.pathname`, and Next 308s `//` paths before it renders.

**VEN-717 `x-refused-token` re-mint (audited 2026-09-24, PASS):** the header
drops every entry whose token equals it (needs the victim's JWT, a bearer
anyway), then mints only for the caller's own cookie through `getSession` —
same gate as a cache miss. The early return ignores the marker but serves only
the caller's own cookie's entry, which a plain GET already hands out. Sentry's
`CREDENTIAL_HEADER` `token` substring redacts it. Forcing a mint costs 2
upstream calls per request with no web-side limit, but a bogus cookie already
costs 1, so it is not new exposure. Every in-route API 401 fires before a side
effect (reports, support, terms), so the one write replay is safe. The SDK dist
is deny-listed, so whether `getSession`/`/token` trust `session_data` for 5 min
after a revoke is unverified. That gap predates this change (any miss mints).

**How to apply:** any future cache in front of a session read is judged on its
key, not its TTL — ask what a caller can put in the key and who else can hold
the same one. Related: [[neon-auth-cutover-boundaries]],
[[identity-read-is-cached-and-route-dynamism-is-inherited]].
