---
name: error-handler-4xx-passthrough-leaks-sdk-messages
description: FIXED — apps/api's 4xx passthrough now only lets Fastify's own errors speak, so a Stripe/Clerk/AWS SDK error no longer reaches the client verbatim; do not re-report
metadata:
  type: project
---

**Status: fixed. Do not re-report.** Verified against
`apps/api/src/plugins/error-handler.ts` on 2026-08-31 (#15 audit).

The branch after the `AppError` check still passes the _status_ through for any
thrown object carrying a numeric `statusCode` in 400–499, but the _message_ is
now gated:

```ts
function messageOf(error, statusCode) {
  if (isFastifyError(error) && error instanceof Error) return error.message; // code.startsWith('FST_')
  return statusCode === 404 ? 'Resource not found' : 'Request failed';
}
```

That is the narrowing the old finding asked for. `stripe-node`'s `StripeError`
sets `statusCode` and a message naming the API key and its mode; it now lands on
`'Request failed'` and the detail goes to `request.log.error({ err })` instead.

What is still true and still worth checking:

- The **log** gets the whole SDK error object (`{ err: error }`, line ~115).
  Pino's `err` serializer copies own enumerable properties, so a Stripe error's
  `raw`, `charge` and `payment_intent` fields are written to the log. See
  [[webhook-error-objects-carry-the-redacted-header]].
- The client-side counterpart `apps/web/src/lib/user-facing-error.ts` passes any
  4xx message straight to the reader. That is safe _because_ of the narrowing
  above — the two are coupled, so narrowing `messageOf` further is fine but
  widening it re-opens the leak at both ends.

**How to apply:** on a diff introducing a new upstream client in `apps/api`,
check the log path rather than the reply path. Wrapping the SDK call and
rethrowing as an `AppError` is still the right containment for anything the
operator or user needs to read.

Related: [[response-schemas-are-a-second-write-boundary]],
[[webhook-error-objects-carry-the-redacted-header]].
