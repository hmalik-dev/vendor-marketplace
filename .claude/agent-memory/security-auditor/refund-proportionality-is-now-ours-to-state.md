---
name: refund-proportionality-is-now-ours-to-state
description: Since #423 replaced the destination charge, D31's proportional unwind is application arithmetic, and the pre-release cancellation path states only the customer's half
metadata:
  type: project
---

Until #423 a refund carried `reverse_transfer` + `refund_application_fee` and
**Stripe** applied D31's split proportionally: a 50%-tier cancellation reversed
half the vendor's transfer, so the vendor kept the other half. Under separate
charges and transfers those flags are gone (`refundParams` in
`apps/api/src/lib/stripe.ts` sends neither, and `refusedRefundParams` now
refuses `reverse_transfer` outright), so **every party's share is arithmetic we
write**: `reversalAmountCents` states the vendor's half, and nothing states the
vendor's _retained_ half.

That is the gap to check on any refund path. Before the payout release the
booking is cancelled, `RELEASABLE_STATUSES` (`payouts.dao.ts`) excludes
`cancelled`, and `findDuePayoutBookingIds` never looks at it again — so on a
partial refund the vendor's proportional share of what Orla retained has no
path to them at all. Reported against `cancelBooking`
(`payments.service.ts:819-821`); the same shape will exist in any future
partial-refund caller of `refundAndUnwind`.

**Why:** the destination charge hid a three-way split inside one Stripe call.
Removing it moved the whole policy into this codebase without a single place
that asserts the three shares sum to the total.

**How to apply:** on any diff touching a refund, check both halves — what the
customer gets back _and_ what the vendor keeps — and check that the retained
half can still reach the vendor given the status the row ends in. See
[[payout-sweep-is-a-second-money-mover]] and
[[legacy-destination-rows-guarded-in-one-place]].
