---
name: seed-booking-payout-drifts-released-over-time
description: The one seeded paid E2E booking gets payout_released_at auto-set by the real sweep as calendar time passes, breaking any "report a problem" / payout-hold test that needs it null
metadata:
  type: project
---

The single paid E2E customer/vendor booking (`orla-e2e-customer` / `orla-e2e-vendor`,
found by joining `bookings` -> `booking_requests` -> `vendor_profiles` -> `users`)
was seeded once with a future `event_date` and `paid_at` set, `payout_released_at`
null. Time has passed since seeding, `event_date` is now naturally in the past,
and the real payout-release sweep (see `the-payout-sweep-ticks-under-your-test`
in the diff-reviewer/general memory) already fired and set
`payout_released_at = paid_at` on that same row.

**Why it matters:** any ticket whose test state requires "paid, event passed,
payout NOT yet released" (VEN-770's report-a-problem window, and likely any
future payout-hold/dispute feature) will find that state already gone by the
time the lane is verified, even if the ticket's own setup note only mentions
moving `event_date`. `reportWindowFor` (or equivalent) reads `payoutReleasedAt`
as the upper bound and a `released` booking renders a completely different,
report-dialog-less state.

**How to apply:** query the row first
(`select event_date, paid_at, payout_released_at from bookings where ...`)
before assuming a ticket's "move event_date into the past" instruction is
sufficient. If `payout_released_at` is already non-null and equals `paid_at`
(the sweep's signature), that's the actual blocker, not `event_date`. Nulling
`payout_released_at` on that one already-authorized row is a reasonable,
scoped extension of the ticket's own setup intent — the ticket only named
`event_date` because the sweep hadn't fired yet when it was written. Leave the
row disputed afterward if the test flow (e.g. a customer report) is meant to
end in that state; that's usually the ticket's own expected end state.
