---
name: legacy-destination-rows-guarded-in-one-place
description: isLegacyDestinationPayout now guards refundAndUnwind and the account unwind; the deploy window is still open, and the E2E seed deliberately writes this pair to stay outside the payout sweep
metadata:
  type: project
---

A pre-#423 booking was a destination charge: Stripe already paid the vendor and
there is no transfer object. Migration `0028_hold_payouts_until_the_event.sql`
marks every such row `payout_released_at = coalesce(paid_at, created_at)` with
`stripe_transfer_id` null, and `isLegacyDestinationPayout` (packages/shared) is
the named test for that pair.

Guarded: `refundAndUnwind` (`payments.service.ts`) and, as verified 2026-09-14,
the account unwind loop (`apps/api/src/modules/admin/account-unwind.ts`, skips
and counts it as `refundsFailed`). The earlier "ban unwind refunds it" finding
is FIXED; do not re-report.

Still open: **the migrate-then-deploy window.** The backfill only sees rows that
exist when `preDeployCommand` runs; anything the old image charges before the
new one takes over has a null `payout_released_at`, which the sweep transfers a
second time and which `isLegacyDestinationPayout` cannot recognise.

**Seed use (VEN-395).** `seed-e2e.ts`'s `createCompletedBooking` writes a past,
completed `payout_model='destination'` row with `payoutReleasedAt` set, no
transfer id and no PaymentIntent, against the real test-mode connected account.
Audited sound: `payoutOwedClauses` requires `separate` + null release, the unwind
only selects future confirmed events, and no PI means no refund can be issued.
If a later seed switches it to `separate` or leaves the release null, the sweep
moves real test-mode money.

**How to apply:** when a diff adds a money path or a fabricated booking, ask
whether it can reach a legacy row or the sweep, and route every refund through
`refundAndUnwind`. Related: [[refund-proportionality-is-now-ours-to-state]],
[[e2e-fixture-creates-real-stripe-accounts]].
