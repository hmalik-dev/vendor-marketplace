---
name: the-payout-sweep-ticks-under-your-test
description: "The payout release sweep runs every 15 minutes against the real database, so a due booking's payout_attempts changes mid-run — never pin a literal attempt count"
metadata:
  type: project
---

`payout-release` runs **every 15 minutes** and operates on real rows. Lane 432
watched a fixture go from **7 attempts to 8 during a browser pass**, with nobody
touching it.

That is correct behaviour — the sweep is doing its job — but it means any test or
verification that pins a **literal `payout_attempts` value** on a booking the
sweep considers due is a flake waiting to happen. It will pass locally, pass in
CI, and fail once on somebody else's machine fifteen minutes later.

**How to apply:**

- Assert **relative** facts — that the count increased, that a reason is present,
  that the row is still unreleased — not `attempts === 9`.
- Or take the booking **out of the sweep's reach**: the sweep selects on
  `payout_released_at IS NULL AND status <> 'cancelled' AND vendor_payout_cents > 0`,
  so a fixture that fails any of those is stable by construction.
- Copy displayed to a user *may* name the number (`That is attempt 9.`); the
  **test** for that copy must not pin it.

**Why:** the same class as the environment artefacts in
[[verify-with-a-differently-shaped-check]] — the check passes for reasons that
have nothing to do with what it claims to verify, until suddenly it does not.
Here the state changes underneath a correct assertion rather than the
environment being wrong.

Related: [[dev-and-build-contend-over-next]].
