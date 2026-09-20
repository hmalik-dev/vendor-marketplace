---
name: deploy-env-is-the-only-tier-signal
description: DEPLOY_ENV (local|staging|production) gates the email sink, the live-Stripe-key refusal and Sentry's environment; every send funnels through one plugin gateway, and Neon Auth mail is outside it
metadata:
  type: project
---

`DEPLOY_ENV` (VEN-489) is the only value that tells a deployed staging from
production. Three behaviours read it: the email sink, the live-key boot guard,
and Sentry's `environment`.

**Why:** `NODE_ENV` and the platform markers are identical on both deployed
tiers, so before this a staging API mailed real recipients and could hold
`sk_live_`. See [[env-target-live-key-trap]] and
[[deployment-gate-detects-by-marker-and-fails-open]].

**How to apply:**

- Every comparison is `=== 'production'`, so an unset, empty, misspelled or
  whitespace-padded value fails **closed**: no mail is delivered and a live key
  refuses to boot. Both Stripe shapes (`/^sk_(test|live)_[A-Za-z0-9]{16,}$/`) are
  fully anchored, so `startsWith('sk_live_')` after the schema cannot be
  whitespace- or case-bypassed. Do not re-report the unset/empty axis.
- **The sink's completeness rests on one funnel:** `plugins/email.ts` is the only
  construction of a gateway, and all six senders (notifications, support,
  reports, vendor-invites, operator-alerts, operator-digest) take it as
  `deps.email`. A new `createResendGateway(...)` call, or any mail sent outside
  the Fastify app (a script, a worker, a web route), delivers to a real recipient
  on staging. That is the regression to look for.
- The sink puts the intended recipient in `subject`/`html`/`text`; only `html` is
  escaped, which is correct — the other two are not markup sinks. The delivery
  record still stores the _intended_ address, the log-only gateway logs the
  idempotency key alone, and `createResendGateway` still throws status-only.
- **Neon Auth's own OTP and verification mail bypasses the sink entirely** (its
  per-branch Auth instance sends it). Documented in `docs/development.md` and
  owned by VEN-377; a dev/staging sign-up mails whatever address is typed.
- `DEPLOY_ENV` is absent from `.github/` — a deploy would refuse to boot or
  build until the workflow sets it. Fail-closed, and the pipeline is inert
  pre-launch, so not a finding.
