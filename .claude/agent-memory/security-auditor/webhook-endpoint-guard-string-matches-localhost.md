---
name: webhook-endpoint-guard-string-matches-localhost
description: Confirmed 2026-09-04 — the Clerk endpoint guard's deployment localhost check is a raw substring test, so LOCALHOST, 127.0.0.1 and [::1] walk past it whenever the platform announces no origin
metadata:
  type: project
---

`apps/api/src/modules/webhooks/clerk.endpoint-guard.ts` refuses a localhost
webhook endpoint on a deployment with `endpoint?.includes('//localhost')`, a
raw-string test on the _unparsed_ value, while `checkWebhookEndpoint` itself
exempts `url.hostname === 'localhost'` from its HTTPS rule.

Verified passing on a deployment whose origin is unknown (`NODE_ENV=production`
alone, or `DEPLOYMENT_PLATFORM` with no `DEPLOYMENT_ORIGIN`):
`http://LOCALHOST:4000/webhooks/clerk`, `https://127.0.0.1/webhooks/clerk`,
`https://[::1]/webhooks/clerk`, plus any third-party relay that is not
`webhooks.clerk.com` (ngrok, smee.io) and `https://user:pass@host/webhooks/clerk`.
It also _false-positives_ on a legitimate URL carrying `//localhost` in its
query. With an origin present (Railway, Vercel, Render) the origin-equality
check catches all of them, which is why the tests are green.

**Why:** this is the same defect shape as
[[image-ref-scheme-allowlist-is-whitespace-bypassable]] — a URL decided by
string matching rather than by `new URL(...)` and a host allowlist.
`packages/shared/src/env/schema.ts` already owns the right set
(`LOOPBACK_HOSTS`: localhost, 127.0.0.1, ::1, [::1], 0.0.0.0).

**How to apply:** any new "is this value localhost / internal / mine" check in
this repo must parse the URL and compare `hostname`, and the deployed case must
drop the local-development exemption by flag rather than by a second string
test. Failure mode when it slips: Clerk `user.*` webhooks silently never arrive
— a deleted Clerk account keeps a live `users` row and a working session.
Related: [[deployment-gate-detects-by-marker-and-fails-open]].
