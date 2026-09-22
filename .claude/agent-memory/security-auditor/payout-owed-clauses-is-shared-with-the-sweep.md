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

**VEN-569 deleted the ban/closure gate from both payout queries (D41).** A
banned or closed vendor is paid for an event already behind us, because the
service was delivered; `vendorUnpayableExpr` (banned/closed **and** no
onboarded account) is all that is left, and it only drives the console's
`payoutStranded` and `payoutFailingClauses`. The date windows do keep the
sweep and `findConfirmedBookingsToUnwind` disjoint — unwind takes
`event_date > unwindFloorDate` (today/yesterday), the sweep
`event_date <= now - 72h` — so nothing races. **The gap the removal opened is
the unwind that did not finish**: `account-unwind.ts:420` counts a failed
Stripe refund and `continue`s, leaving a _future_ booking `confirmed`,
unrefunded, `vendor_payout_cents` intact. The ban commits first
(`admin.service.ts:569`) and never rolls back, so that row now becomes due 72h
after its event and the sweep transfers to the banned account while the
customer holds neither the service nor their money. `users.banned_at` /
`deleted_at` versus `bookings.event_date` is the discriminator D41's argument
actually needs.

**VEN-543 added `payoutResidualHeld()` — a fifth predicate, and the first with a
TS twin nobody feeds.** It is `status = 'cancelled' and (external_refund_cents >
0 or exists an open `origin='chargeback'` support case)`, hand-qualified with
`sql.identifier` (safe: static schema names, literal constants, whole expression
parenthesised so `not()` binds right, both columns `NOT NULL` so no three-valued
gap) and negated in `payoutFailingClauses`, `findDuePayoutBookingIds`,
`claimReleasableBooking` and `findNextPendingPayout`. It **requires `bookings`
and `support_cases` to stay unaliased** at every call site — an `alias()` and the
EXISTS silently stops correlating. Arming it needs a real Stripe dispute
(`origin='chargeback'` is written only by the webhook) and only an operator
resolves it, so the subject cannot lift its own hold. The gap: `residualHeld` is
**optional** on `PayoutStatusSubject`, so `payoutStatusOf`/`isPayoutFailing` at
`cases.service.ts:716`, `admin-detail.service.ts:252`, `admin.service.ts:783` and
`booking-report.ts:62` still answer `pending`/`failing` for a row the SQL twin
excludes.

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
