---
name: backup-withholding-is-a-fifth-money-projection
description: VEN-723 backup withholding — bookings.backup_withheld_cents is written once by the sweep and nothing after a release re-derives it; the audit-row attribution to the setting admin is a recorded design choice
metadata:
  type: project
---

VEN-723 (D49) added `bookings.backup_withheld_cents` (24%, written by the payout
sweep in the claiming transaction) and `PUT /admin/vendors/:vendorId/backup-withholding`
(`onRequest: [adminOnly, requireStepUp]` + `withinDestructiveCeiling`; set/cleared
are in `ADMIN_CEILING_ACTIONS`, the sweep's `backup_withholding_withheld` is not).

Audited clean (2026-09-24, pre-merge): authz order, step-up, ceiling counting,
flat-scalar `detail`, TIN never leaves `taxIdStateFrom` (enum only), Stripe read
failure logs `{vendorId, err}` and renders `null`, backfill CLI prints account id +
Stripe message only.

**Accepted design, do not re-report:** the sweep writes its per-payout audit row
under the admin who last set withholding (`findBackupWithholdingSetter`), because
the sweep has no actor; a missing setter row fails the payout before money moves.

**Found at audit time, fixed in the same PR:** `reverseOutstanding` capped a
post-release clawback at what the transfer holds and never touched
`backup_withheld_cents`, and the `existing`-transfer retry recomputed the withholding
from today's flag. Now `owePayoutRecoveredByNetting` lowers `backup_withheld_cents` by
the shortfall left after the debt part, `settleLostChargeback` bills only what reached
the vendor, and the transfer carries `backupWithheldCents` in its metadata so a retry
records what its own attempt withheld.

**How to apply:** any new reader of "what the vendor was sent" must subtract
`debt_netted_cents` AND `backup_withheld_cents` (`lowerReleasedVendorPayout`,
`owePayoutRecoveredByNetting` and `settleLostChargeback` do). Related: [[payout-sweep-is-a-second-money-mover]],
[[settlement-is-a-third-money-projection]], [[legacy-destination-rows-guarded-in-one-place]].
