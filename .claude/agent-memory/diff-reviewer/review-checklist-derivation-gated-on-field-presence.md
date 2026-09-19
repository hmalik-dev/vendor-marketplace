---
name: review-checklist-derivation-gated-on-field-presence
description: A shared derivation that adds a branch guarded by `field !== undefined` answers differently on every surface, because each DAO projection selects a different column set
metadata:
  type: feedback
---

A new member added to a shared derivation (`payoutStatusOf`, `bookingStatusOf`,
any `xStatusOf`) and gated on **optional field presence** —
`if (a !== undefined && b !== undefined && …) return 'new-member'` — is not one
rule. It is one rule per caller, decided by whether that caller's DAO projection
happens to `select` those columns.

**Why:** VEN-423 added `'not-owed'` behind
`payoutModel !== undefined && vendorPayoutCents !== undefined`.
`admin.dao`'s payments projection and `admin-detail.dao`'s booking detail both
select `payout_model`; `cases.dao`'s `CaseBookingProjection` selects
`vendorPayoutCents` but **not** `payoutModel`. So the same fully-refunded
booking reads "Not owed" on `/admin/bookings/<id>` and still reads
"Awaiting release" on `/admin/cases/<caseId>` — the exact surface disagreement
those files' own comments exist to prevent. The diff's tests covered the two
projections that happen to be complete.

**How to apply:** when a diff widens a shared derivation, grep every caller,
then open each caller's **projection/interface** (not the call site) and list
which of the new guard's fields it actually selects. A caller missing one is a
silently unchanged surface, not a compile error — the guard is `undefined`-typed
on purpose. Also check the new branch's **position**: placed above an existing
branch (`held`/`disputed`) it steals rows from it.
