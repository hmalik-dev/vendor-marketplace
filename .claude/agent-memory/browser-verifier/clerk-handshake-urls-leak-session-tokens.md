---
name: clerk-handshake-urls-leak-session-tokens
description: Logging full request/response URLs while driving a browser with a live .auth/*.json storage state prints live Clerk session and refresh JWTs into the transcript
metadata:
  type: feedback
---

When a Playwright script authenticated via `storageState: '.auth/<role>.json'` needs
a session refresh (token stale, or first use after a while), Clerk's dev instance
performs a "handshake" redirect dance: `.../v1/client/handshake?...&__session=<JWT>`
and `<url>?__clerk_handshake=<base64 JWT>`. That base64 payload decodes to literal
`Set-Cookie` headers for `__session`, `__refresh_*` (observed with a ~1 year
expiry) and `__clerk_db_jwt`. On lane 307, a diagnostic script that logged
`page.on('response', r => console.log(r.url()))` printed these in full to Bash
tool output — a real credential exposure, not just noise, because the refresh
cookie is long-lived enough to mint new sessions.

The same thing happens passively even without a custom listener: general
console-message dumps on an authenticated page pick up the app's own
`EventSource`/SSE reconnect URLs (e.g. `/events/stream?token=<JWT>`), which also
embed a live access token and get repeated on every reconnect attempt.

**Why:** the project's own credential policy is "a credential that reached a
command line or a config file is already exposed: rotate it" — printing a
session/refresh JWT into a transcript is the same failure mode as an inline
secret in a Bash command, just via a different vector (network URLs, not
argv). See [[credentials-env-files-only]] in the user's global memory.

**How to apply:** When writing a throwaway Playwright script to drive a stored
identity (e.g. loading `.auth/customer.json` to check role-based denial), never
log `response.url()`/`request.url()` wholesale, and don't dump `all: true`
console messages on an authenticated page without filtering. Log only
`status()`, the final `page.url()` path, and `page.title()` — that's enough to
prove a redirect/403 without touching the query string. If a raw handshake or
SSE-token URL does get printed, treat the session as exposed: re-run `pnpm
e2e:auth <role>` to mint a fresh one before that stored state is reused, per
[[vendor-marketplace-e2e-credentials]].
