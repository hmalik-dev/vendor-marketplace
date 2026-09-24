---
name: review-checklist-new-error-field-trips-duck-typed-guard
description: Adding a property (digest, code, status) to an app error class can satisfy a duck-typed guard elsewhere, e.g. web isNavigationSignal treats any string `digest` as a Next redirect/notFound
metadata:
  type: feedback
---

When a diff adds a field to an error class (VEN-690 gave `ApiClientError`/`ApiTimeoutError` a
`digest` so Next's error page shows the API request id), grep the whole app for guards that
test that property by presence or type rather than by class or value.

`apps/web/src/lib/navigation-signal.ts` `isNavigationSignal` is `typeof error.digest === 'string'`.
It has 12 call sites that say "rethrow a navigation signal, degrade everything else". With the new
digest on every server-side API error, they all rethrow the failure. The header's chrome reads
then send every page to global-error, and the 401 → sign-in branches never run.

**Why:** existing tests build `new ApiClientError(500, ...)` with no id, and most run in jsdom
(`window` is defined, so no id is minted). The suite stays green.

**How to apply:** for a new field on an error, `grep -rn "\.<field>\b\|'<field>' in"` across the
consumers. Then construct the error the way production now does (with the field set) and pass it
through one caller's catch.
