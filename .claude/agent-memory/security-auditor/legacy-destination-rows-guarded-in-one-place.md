---
name: legacy-destination-rows-guarded-in-one-place
description: isLegacyDestinationPayout (released + null transfer id) guards refundAndUnwind and the account unwind; VEN-658's zero-transfer release collides with it; deploy window still open
metadata:
  type: project
---

A pre-#423 booking was a destination charge: Stripe already paid the vendor and
there is no transfer object. Migration `0028_hold_payouts_until_the_event.sql`
marks every such row `payout_released_at = coalesce(paid_at, created_at)` with
`stripe_transfer_id` null, and `isLegacyDestinationPayout` (packages/shared) is
the named test for that pair.

Guarded: `refundAndUnwind` (`payments.service.ts`, 409 "older arrangement") and
the account unwind loop (`account-unwind.ts`, counted as `refundsFailed`).

**VEN-658 collision (flagged 2026-09-24).** Debt netting records a release with
`stripe_transfer_id` null when recovery consumes the whole payout, so a modern
`separate` booking now matches the legacy pair and every post-release refund of
it is refused as legacy. Partial netting has the twin: `reverseOutstanding`
targets `vendor_payout_cents` but the transfer carries only the payout less
`debt_netted_cents`, so a full reversal over-reverses (Stripe refuses, after the
refund has gone out). Check whether the classifier now also keys on
`payout_model` / `debt_netted_cents` before re-reporting.

Still open: **the migrate-then-deploy window.** Rows the old image charges after
`preDeployCommand` have a null `payout_released_at`; the sweep transfers them again.

**Seed use (VEN-395).** `seed-e2e.ts`'s `createCompletedBooking` writes a past,
completed `payout_model='destination'` row, released, no transfer id, no PI.
Sound while `payoutOwedClauses` requires `separate` + null release.

**How to apply:** any writer that leaves `payout_released_at` set with a null
transfer id is a legacy row to every reader; any writer that sends less than
`vendor_payout_cents` must be matched by every reversal target. Related:
[[payout-sweep-is-a-second-money-mover]], [[refund-proportionality-is-now-ours-to-state]].
