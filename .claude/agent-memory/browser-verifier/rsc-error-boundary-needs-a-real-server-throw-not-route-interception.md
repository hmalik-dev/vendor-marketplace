---
name: rsc-error-boundary-needs-a-real-server-throw-not-route-interception
description: Playwright page.route() forcing a raw 500 on a client-side RSC nav makes Next.js silently fall back to a full document reload instead of hitting error.tsx; a genuine Server Component throw (DB fixture) is required
metadata:
  type: project
---

On VEN-623 (2026-09-23), trying to reproduce an `error.tsx` boundary by
`page.route()`-intercepting the RSC fetch for a client-side navigation (link
click) and fulfilling it with a raw `500` text body did **not** trigger the
React error boundary. Next's client router detected the response didn't look
like a valid flight/RSC payload and silently fell back to a full browser
navigation, which then succeeded outright (since the destination page was
fine) — the whole exercise never exercised the retry path at all.

**Why:** Next only shows `error.tsx` for an error that occurs _inside_ the
React Server Component render pipeline, serialized into a real RSC payload
that the client picks apart. A raw non-RSC-shaped HTTP response from a browser
proxy is a different signal (network/parse failure) and Next's own resilience
code (fallback-to-MPA-nav) swallows it before it ever reaches a boundary.
Server-to-API fetches inside the Next.js Node process are also invisible to
Playwright's browser-level network interception entirely.

**How to apply:** to reliably drive a real `error.tsx`, make the actual
server-side data read throw — a DB fixture is the dependable route. Look for
the _cheapest, most local_ throw available rather than reaching for an
"unserialisable date": e.g. a `payableAmount`-style `amount === null` guard
that already throws a 500 `AppError` when a nullable price/required column is
null, on a row you created yourself, is much lower-risk than corrupting a
shared row's date to break `z.iso.date()`/JSON serialization — both work, but
null a column you control before you corrupt one you don't. See
[[ticket-setup-steps-can-authorize-scoped-db-writes]] for when this kind of
write is in-scope at all. Route interception remains useful for confirming
which request _does_ fire, after the real break (e.g. matching the retry's RSC
URL against the network log), just not for producing the break itself.
