---
name: legacy-destination-rows-guarded-in-one-place
description: isLegacyDestinationPayout guards only refundAndUnwind; the ban unwind refunds the same rows with nothing reversed, and the 0028 backfill cannot see rows the old code writes during the deploy
metadata:
  type: project
---

A pre-#423 booking was a destination charge: Stripe already paid the vendor and
there is no transfer object. Migration `0028_hold_payouts_until_the_event.sql`
marks every such row `payout_released_at = coalesce(paid_at, created_at)` with
`stripe_transfer_id` null, and `isLegacyDestinationPayout` (packages/shared) is
the named test for that pair.

Two places do not consult it:

- **`setUserBanned`'s unwind loop** (`admin.service.ts`, the `createRefund`
  around line 290) refunds `totalAmountCents` with no legacy check and, since
  `refundParams` dropped `reverse_transfer`, nothing is clawed back — the
  vendor keeps the destination-charge share. `refundAndUnwind`
  (`payments.service.ts:728`) refuses the identical row with a 409.
- **The migrate-then-deploy window.** The backfill only sees rows that exist
  when `preDeployCommand` runs; anything the still-live old image charges
  before the new one takes over is a destination charge with a null
  `payout_released_at`, which the sweep will transfer a second time and which
  `isLegacyDestinationPayout` cannot recognise (it requires the released flag).

**Why:** the set is empty in production only because no production Stripe
credentials have ever been minted (#362). Staging and any lane database with
pre-#423 bookings has real ones.

**How to apply:** when a diff adds a money path, ask whether it can reach a
legacy row, and prefer routing every refund through `refundAndUnwind` rather
than calling `stripe.createRefund` directly. Related:
[[refund-proportionality-is-now-ours-to-state]].
