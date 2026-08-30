---
name: webhook-error-objects-carry-the-redacted-header
description: server.ts redacts req.headers["stripe-signature"] / ["svix-signature"], but logging {err} on a failed verification re-emits the header and the whole raw body, because pino serialises every own enumerable property of an Error
metadata:
  type: project
---

`apps/api/src/server.ts` redacts signature headers by path
(`req.headers["stripe-signature"]`). Redaction is path-based, so it protects only
the `req` branch of the log record. A webhook route that answers a failed
verification with `request.log.warn({ err: error }, ...)` puts the same value
back into the record under `err`, where no redact path matches.

Verified against pino 10 in this repo: `stdSerializers.err` copies every own
enumerable property, and `stripe-node`'s `StripeSignatureVerificationError`
constructor sets `this.header = header; this.payload = payload` — so the full raw
request body and the signature header land in the log stream at `warn`, on an
endpoint no one has to authenticate to reach.

svix's verification error does not carry the payload, which is why the Clerk
route (same shape, `clerk.routes.ts`) does not leak. The hazard is the error
class, not the pattern.

**Why:** an unauthenticated caller controls the entire content of a log record
(up to Fastify's 1 MB body limit, 120 req/min/IP), and a genuine Stripe delivery
that fails only on the 5-minute timestamp tolerance gets its real body logged.

**How to apply:** whenever a diff logs `{ err }` for a failed signature or auth
check, look at the SDK's error class for fields that echo the request. Log
`error.message` (or a whitelist) rather than the error object, or add the field
to `redact`. Do not assume the header redact list covers it.

Related: [[error-handler-4xx-passthrough-leaks-sdk-messages]].
