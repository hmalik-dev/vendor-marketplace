---
name: error-handler-4xx-passthrough-leaks-sdk-messages
description: apps/api's error handler returns the raw message of ANY thrown object carrying a numeric `statusCode` between 400 and 499, so a third-party SDK error (Stripe) reaches the client verbatim
metadata:
  type: project
---

`apps/api/src/plugins/error-handler.ts` has a branch after the `AppError` check:

```ts
const statusCode = statusCodeOf(error);            // reads error.statusCode
if (statusCode !== null && statusCode >= 400 && statusCode < 500) {
  return reply.status(statusCode).send({ ..., message: messageOf(error) });
}
```

It was written for `@fastify/rate-limit` and other plugins that throw Fastify
errors, and it is safe for those. It is **not** safe for an SDK whose error class
also exposes a top-level `statusCode` plus an upstream `message`. `stripe-node`
does exactly that: `StripeError` sets `this.statusCode = raw.statusCode` and
`this.message = raw.message`, so a Stripe 400/401/403/404 raised inside a service
is answered to the browser with Stripe's own words — including
`Invalid API Key provided: sk_live_****abcd` on a revoked platform key.

Clerk (`status`, not `statusCode`) and the AWS SDK (`$metadata.httpStatusCode`)
miss the branch, which is why the leak did not exist before Stripe landed.

**Why:** the repo rule in `.claude/rules/api-layering.md` is "only `AppError`
produces a client-visible message"; this branch is the one hole in it, and it
opens automatically whenever a new upstream client is added.

**How to apply:** on any diff introducing or extending a third-party client in
`apps/api`, check whether its error class carries `statusCode`. The containment
belongs at the call site — wrap the SDK call and rethrow as an `AppError` with
approved copy, logging the detail — rather than in the handler, unless the branch
is narrowed to Fastify's own errors (`error.code?.startsWith('FST_')`).

Related: [[response-schemas-are-a-second-write-boundary]],
[[webhook-error-objects-carry-the-redacted-header]].
