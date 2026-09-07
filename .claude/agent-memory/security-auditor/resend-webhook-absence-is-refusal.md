---
name: resend-webhook-absence-is-refusal
description: RESEND_WEBHOOK_SECRET is the only registry row optional on every target including production; verified 2026-09-07 that absence means the route is never registered, and exactly which two functions hold that property up
metadata:
  type: project
---

`POST /webhooks/resend` is the one route `apps/api/src/server.ts` registers
conditionally, on `env.RESEND_WEBHOOK_SECRET !== undefined`. The registry row
carries `optionalFor: ['baseline', 'local', 'production', 'deployed']`.

Traced and confirmed the safety property holds, so a later audit need not
re-derive it:

- `requiresExplicitValue` (`packages/shared/src/env/registry.ts`) short-circuits
  to `false` on any target listed in `optionalFor`, **before** the
  per-environment rule that would otherwise force a value on `deployed`.
- `schemaFor` (`env/schema.ts`) then takes the `.optional()` branch #439 added,
  which is the first branch in that file that lets a no-default row parse from
  `undefined` for an app rather than for tooling.
- A stated-but-empty value does not slip through: the field is still
  `z.string().min(1).regex(/^whsec_.../)`, so `''` or a wrong-shaped value fails
  boot loudly.

**Why:** absence is refusal, not permission — with no secret there is no handler
for an unsigned delivery event to reach. That is the entire justification for
the production exemption, and it is the property any change to this row must
preserve. A `?? ''`, a stub secret, or a handler that answers 503 instead of not
existing all convert it into an unauthenticated writer on `email_deliveries`.

**How to apply:** this is the one row where "optional in production" is correct
and should not be re-reported as a
[[deployment-gate-detects-by-marker-and-fails-open]] hole. Escalate only if the
conditional registration in `server.ts` disappears or the env branch gains a
fallback. Both svix routes share the `options.webhooks.verifySignature` seam,
which is test-only — `apps/api/src/index.ts` passes no `webhooks` key.
