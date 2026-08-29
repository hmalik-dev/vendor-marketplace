---
name: validate-before-normalize-return-path
description: safeReturnPath's validate-vs-return mismatch was FIXED by #76 via parse-then-reserialise; 894k-case chain fuzz found zero origin escapes — do not re-report
metadata:
  type: project
---

**Status: FIXED as of ticket #76 (2026-08-29). Do not re-report.**

`apps/web/src/lib/return-path.ts` (`safeReturnPath`) once validated a string that
was **not** the string the redirect finally used — it returned
`decodeURIComponent(value)` and ran the loop guard on `candidate.split(/[?#]/)[0]`
before dot segments collapsed. That let `?package=a%26foo%3Dbar` inject query
delimiters and `/x/../sign-in` walk past `LOOPING_PREFIXES`.

It now does parse-then-reserialise, which is the shape that fixes both:
reject control chars and `//`/`\` on the raw string, `new URL(value,
'https://return-path.invalid')`, reject unless `url.origin` is unchanged,
**re-check `startsWith('//')` on the normalized string** (because `/x/..//evil`
resolves into a scheme-relative path), run the loop guard on `url.pathname`,
return `url.pathname + url.search + url.hash`.

**Why:** verified 2026-08-29 by fuzzing the _whole chain_ — caller/header value
-> `signInPathReturningTo` -> `/sign-in?returnTo=` -> the sign-in page's
`safeReturnPath` -> `/after-sign-in?returnTo=` -> `safeReturnPath` -> `new
URL(target, request.url)` — over 894,419 cases built from `//`, `\`, `%2e%2e`,
`%2f`, `%5c`, `@`, `:`, scheme prefixes, CR/LF/TAB, NUL, U+2044/U+FF0F/U+2215,
U+202E, zero-width, lone surrogates and double-encoding. **Zero** origin escapes,
zero loop-guard evasions, zero non-idempotent returns
(`safeReturnPath(safeReturnPath(v)) === safeReturnPath(v)` holds throughout).

**How to apply:** the open-redirect boundary itself is settled. Spend audit time
on the _callers_ that assemble a candidate (`/vendors/${slug}/request...`,
`/messages?...`, `/bookings?tab=...`) and on where the destination lands after
sign-in, not on the validator. If a caller ever stops routing through
`safeReturnPath`, that is the finding.

Related: [[middleware-request-path-header-trust]],
[[role-bounce-self-loop-admin-bookings]], [[clerk-redirect-url-param-collision]],
[[url-params-validated-in-the-nuqs-hook]]
