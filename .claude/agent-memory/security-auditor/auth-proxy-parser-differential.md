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

Related: the request-reset path hides account existence with a fixed 200 and
`after()`; its sibling `email-otp/reset-password` returns the upstream status
verbatim, so existence can leak there instead. See [[fixed-response-sibling-leak]].
