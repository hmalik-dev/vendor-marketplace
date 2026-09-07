---
name: client-parse-failures-are-shown-verbatim
description: A browser-side response-schema mismatch becomes an ApiClientError carrying the 200 status, so userFacingError's 5xx filter passes the internal drift message straight to the reader
metadata:
  type: project
---

`apiRequest` (`apps/web/src/lib/api-client.ts:259`) `safeParse`s every response
and, on failure, throws
`new ApiClientError(response.status, INTERNAL_ERROR, "API response for <path>
did not match its schema", issues)`. The status it carries is the **response's**
— `200` on a successful call whose body simply did not match.

`userFacingError` (`apps/web/src/lib/user-facing-error.ts`) suppresses a message
only when the error is `>= 500` or matches `UPSTREAM_ERROR_SHAPES`. A 200 parse
failure is neither, so the internal sentence — including the full request path
with its uuid — is rendered verbatim wherever the caller shows it
(`ConfirmAction`'s `role="alert"`, toasts, form errors).

**Why:** the 5xx filter was written for the API's own error bodies, and predates
the client-side validator being able to throw with a success status.

**How to apply:** two consequences on any diff that adds a browser `call(...)`.
First, a schema mismatch is _reader-visible copy_, not a silent log — so the
usual `z.date()` wire-coercion rule (a shared response schema with `z.date()`
must be re-declared in `wire-schemas.ts` with `z.coerce.date()`) is a
user-facing defect, not only a broken screen. Second, on a **money-moving**
action the misreport is the real damage: the throw makes `ConfirmAction` hold
its dialog open under a comment saying an open dialog means the action did
nothing, so a transfer that actually landed is reported as a failure and
`router.refresh()` never runs. Confirmed on #432's
`adminPayoutRetryResultSchema`, which carries `payoutReleasedAt: z.date()` and
is passed to `useApi` straight from `@vendor-marketplace/shared`. Related:
[[response-schemas-are-a-second-write-boundary]],
[[error-handler-4xx-passthrough-leaks-sdk-messages]].
