---
name: contention-gate-is-a-path-pattern
description: verify.mjs runs the contention suite only when a changed path matches verify.contentionPattern in .claude/project.json; apps/api/src/modules/payments/payments.* does not match, and CI is the backstop
metadata:
  type: project
---

Since the Linear migration (2026-09-14) `.claude/project.json` carries
`verify.contentionPattern`, and `~/.claude/scripts/verify.mjs:202` runs
`test:contention` only when a changed path matches it (or `--contention` is
passed). With no pattern the suite never runs automatically, so the key is an
improvement — but it is a **path** match, not a symbol match.

`apps/api/src/modules/payments/payments.service.ts` and `payments.dao.ts` hold
`confirmBooking`, `applyBookingTransition`, `cancelBookingAndFreeDate`,
`reconcileBooking`, `recordSuccessfulPayment` and `placeDisputeHold` — the exact
row-lock code `dispute-hold.contention.test.ts` and
`booking-counts.contention.test.ts` exist to protect — and the path matches none
of the alternatives. Adding `payment` to the alternation covers the directory.

**Why:** the local gate is the only thing an agent reads before opening a PR.
**How to apply:** severity stays LOW while `.github/workflows/ci.yml:107` runs
`pnpm test:contention` on every `pull_request` to `main`/`production`; if that
job is ever scoped or removed, this becomes the only gate on double-booking and
dispute-hold locking. Related: [[payout-sweep-is-a-second-money-mover]],
[[contention-harness-issues-server-ddl]].
