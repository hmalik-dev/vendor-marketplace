---
name: payout-owed-clauses-is-shared-with-the-sweep
description: payoutOwedClauses() is one predicate shared by the vendor dashboard's read and the release sweep's money-moving claim, so widening it widens what Stripe transfers
metadata:
  type: project
---

`payoutOwedClauses()` (`apps/api/src/modules/payments/payouts.dao.ts:52`)
returns the three clauses that decide a payout is owed:

```
isNull(bookings.payoutReleasedAt),
eq(bookings.payoutModel, 'separate'),
gt(bookings.vendorPayoutCents, 0),
```

Since #424 it is spread into **three** WHEREs: `findDuePayoutBookingIds`
(`:107`), `claimReleasableBooking` (`:170`) — the `FOR UPDATE SKIP LOCKED`
claim that immediately issues the Stripe transfer — and `owedPayout()` in
`apps/api/src/modules/vendors/dashboard.dao.ts:191`, the vendor's read.

**Why:** the figure a vendor plans around and the amount that arrives must name
the same rows, so #424 collapsed three hand-synced copies into one. The cost is
that a read-side edit now reaches a money mover. Dropping `payoutModel =
'separate'` to "also show legacy bookings" would make the sweep transfer
destination-charge rows a second time — see
[[legacy-destination-rows-guarded-in-one-place]].

**How to apply:** treat any diff to `payoutOwedClauses` as a change to the
transfer path, not to a dashboard. The two legitimate differences live at the
call sites and must stay there: the status list (`RELEASABLE_STATUSES` for the
sweep, plus `HELD_PAYOUT_STATUSES` for the dashboard) and the
`lte(eventDate, dueThroughDate)` bound the dashboard deliberately drops. The
reconciliation test in `dashboard.routes.test.ts` ("shows exactly what the
release sweep would transfer for the same rows") calls
`findDuePayoutBookingIds` directly and is the thing that fails if they drift —
keep it. Related: [[payout-sweep-is-a-second-money-mover]].

**VEN-423 put a fourth guard in the pre-scan only.** `findDuePayoutBookingIds`
now joins `users` through `vendorProfiles.userId` and adds
`is_banned = false` + `deleted_at is null`. `claimReleasableBooking` — the
`FOR UPDATE SKIP LOCKED` row that actually transfers — was **not** given them,
and `refusePayoutRetry` has no ban/retired arm either, so the operator retry
(`honourVendorHold: false`) pays a banned or retired vendor outright. Every
other payout guard (status, amount, release, `payout_hold`) is re-read under
the lock; this one is not. The mirror cost: a retired vendor's owed payout for a
past event is now claimed by nothing, `payout_attempts` never increments so
`payoutFailingClauses` cannot see it, and the console still prints
"Awaiting release".

**#432 added a second shared predicate and a third money mover.**
`payoutFailingClauses()` (same file) is `payoutReleasedAt is null` +
`payout_attempts > 0` and is spread into the admin Payments filter and the
Overview's failing count — a read-only pair, so widening it widens a console
list rather than a transfer. The money mover it added is
`PUT /admin/bookings/:id/payout/retry`, which calls the sweep's own
`releaseOnePayout` verbatim: the operator cannot force a payout outside
`claimReleasableBooking`'s predicate, and `refusePayoutRetry` is strictly
narrower than it (it also refuses `cancelled`, which the sweep releases). Audited
2026-09-07 — a retry that widened the claim, rather than reusing it, would be
the finding.
