---
name: auth-proxy-parser-differential
description: Confirmed pattern in /api/auth/[...path] — a guard that re-parses the body to key a rate limit must fail closed, or an unparseable body skips the limit and is still forwarded
metadata:
  type: project
---

In `apps/web/src/app/api/auth/[...path]/route.ts` the proxy reads the request
body to key a per-address budget (`isAddressThrottled`). Any guard shaped
`const overBudget = email !== '' && isAddressThrottled(email, path)` **fails
open**: a body the proxy cannot parse (form-encoded, `content-encoding: gzip`,
anything the provider accepts and `JSON.parse` does not) skips the budget and is
forwarded anyway. The only cross-IP control on a six-digit OTP then disappears.

**Why:** the per-caller budget is keyed on `x-forwarded-for`, so the per-address
budget is the only limit an attacker cannot rotate around. Its bypass is total,
not partial.

**How to apply:** on any proxy path that re-derives a value from the body to
enforce a limit, refuse (400) when the value cannot be read, and rebuild the
upstream request without the caller's `content-length` / `content-encoding` —
the body has been re-encoded, so those headers no longer describe it. Check the
same shape whenever `request.text()` + `JSON.parse` appears before a guard.

**The sign-in budget is the shared E2E identities' lockout lever** (VEN-602
audit, 2026-09-22): `sign-in/email` charges only 401/403 against
`SIGN_IN_ADDRESS_LIMIT` (10 per 10 min, durable in the API DB when
`WEB_TIER_KEY` is set). Any tooling that retries a sign-in (`withRetry` in
`scripts/e2e-sign-in.mjs`) must not retry the fixed `signInFailed` refusal, or
a drifted `.env.e2e.local` spends the shared account's budget 3x per run. The
refusal banner is fixed `AUTH_COPY` text, so echoing it leaks no address.

**The OTP send is charged per request** (VEN-620 audit, 2026-09-22, PASS): the
sign-up's send moved from `signUpWithEmail` into `sign-up-form.tsx` and still
fires once per `'ok'` sign-up; `sendOnMount` still fires once (the `live` flag
only guards `setState`). Refusal banners are `failureCopy` constants, and the
code step is reachable only after a password-correct unverified sign-in, so the
banner is no oracle curl against the proxy did not already have.

**`change-password` is the one signed-in account call** (VEN-677 audit,
2026-09-23, PASS with lows): the proxy rebuilds the body from two fields and forces
`revokeOtherSessions: true`; budget is `addr|change-password|sha256(userId)`, 5/10
min, read-only check then charge (TOCTOU, same as sign-in). The caller's id can come
from the minted cache (no revocation check), so charging upstream 401/403 lets a
revoked session keep spending the owner's budget; Better Auth's wrong current password
is 400 `INVALID_PASSWORD`. CSRF holds: SDK cookies are SameSite=Lax by default and the
SDK forwards the browser's Origin to Neon. Change does not bump
`sessions_invalidated_at` (deferred to VEN-670); a naive bump refuses the caller's own
same-second re-mint.

Related: the request-reset path hides account existence with a fixed 200 and
`after()`; its sibling `email-otp/reset-password` returns the upstream status
verbatim, so existence can leak there instead. See [[fixed-response-sibling-leak]].
