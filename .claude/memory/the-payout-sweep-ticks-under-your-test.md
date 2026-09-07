---
name: the-payout-sweep-ticks-under-your-test
description: "The payout release sweep runs every 15 minutes against the real database, so a due booking's payout_attempts changes mid-run — never pin a literal attempt count"
metadata:
  type: project
---

`payout-release` runs **every 15 minutes** and operates on real rows. Lane 432
watched a fixture go from **7 attempts to 8 during a browser pass**, with nobody
touching it.

**Scope, narrowed 2026-09-07 and verified — this does NOT reach the vitest
suites.** `createTestHarness` passes `payoutSweepIntervalMs: 0`
(`testing/test-server.ts:768`) and `payoutReleasePlugin` returns early on
`intervalMs <= 0` (`plugins/payout-release.ts:40`), deliberately, because a
sweep firing mid-test would move money against fixtures nobody asked it to
touch. So a suite pinning `payoutAttempts: 2` is **stable by construction** and
is not what this memory is about. Do not go weakening suite assertions that were
never at risk.

**What is exposed is anything driven against a running API** — browser passes,
manual checks, `lane:exec` scripts. That is where the 7 → 8 happened. A literal
attempt count asserted there is a flake.

**How to apply:**

- Assert **relative** facts — that the count increased, that a reason is present,
  that the row is still unreleased — not `attempts === 9`.
- Or take the booking **out of the sweep's reach**. The sweep selects on
  `payout_released_at IS NULL AND status <> 'cancelled' AND vendor_payout_cents > 0`
  **and a due window on the event date**, so a fixture failing any of those is
  stable. The least invasive is moving the **event date forward**: it drops out
  of the due window while staying failing, because the failing predicate has no
  date bound. Lane 432 needed that for a sharper reason than flakiness — its
  fixture sat on the **real Stripe test account**, so a tick would have
  transferred real money and dropped its failing count from 2 to 1 under a pass
  asserting 2.
- Copy displayed to a user *may* name the number (`That is attempt 9.`); the
  **test** for that copy must not pin it.

**Why:** the same class as the environment artefacts in
[[verify-with-a-differently-shaped-check]] — the check passes for reasons that
have nothing to do with what it claims to verify, until suddenly it does not.
Here the state changes underneath a correct assertion rather than the
environment being wrong.

Related: [[dev-and-build-contend-over-next]].
