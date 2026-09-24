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

**A JSON body can also be a form body** (VEN-685 audit, 2026-09-24): `forwardBudgeted`
and `forwardReset` forward the caller's `content-type`, so `content-type:
application/x-www-form-urlencoded` with a JSON body whose string value holds
`&email=victim&password=short&` passes every proxy check on the JSON reading while
a form-parsing upstream (better-call does) acts on the injected pair: the password
floor and the per-address budget key both miss. `change-password` pins
`application/json` (VEN-677) and is safe. Fix: `headers.set('content-type',
'application/json')` on every re-encoded upstream. node_modules reads are
permission-denied for this agent, so the SDK's forwarding was inferred, not read.
`readBounded` (VEN-685) counts stream bytes and fails closed on gzip; clean.
`forwardBudgeted` now pins `application/json` (seen VEN-714).

**Discarding a minted session** (VEN-714 audit, 2026-09-24, PASS): sign-up,
verify-email and a 200 unverified sign-in are signed out with the cookie from the
provider's own `Set-Cookie` (caller's `cookie` replaced, `authorization` deleted,
the `endEverySession` pattern), plain `sign-out` not `forwardSignOut`, so only that
one session ends; no cross-account lever since minting needed the password or OTP.
The body (`token`) and any non-cookie header still pass through, owner-only.

**VEN-630 made the sign-in address budget rotatable** (audit 2026-09-24, blocker):
`isSignInRefused` refuses a caller only if its own `pair|` bucket is spent, or the
address bucket is spent **and** it has failed once itself. A fresh caller is never
refused, so guesses per account = distinct caller keys × ~10 (the per-minute
`chargeCaller` cap passes a parallel burst past the read-only check). On Vercel the
key is the full `x-real-ip`, so one IPv6 /64 is unlimited callers; off Vercel it is
the rightmost XFF. The owner is still lockable: one typo while the address is spent,
a shared CGNAT address, and the "reset instead" escape is itself an any-caller
5/10-min address budget. Fix shape: /64 caller keys + a hard address ceiling that
binds everyone; the canonical form is OWASP device cookies (trusted device exempt).

Related: the request-reset path hides account existence with a fixed 200 and
`after()`; its sibling `email-otp/reset-password` returns the upstream status
verbatim, so existence can leak there instead. See [[fixed-response-sibling-leak]].
