---
name: booking-reads-gate-on-two-separate-paths
description: reconcileBooking has two returns and each needs its own ownership check — the already-booked short-circuit leaked every booking until #387
metadata:
  type: project
---

`reconcileBooking` in `apps/api/src/modules/payments/payments.service.ts` returns
from **two** places, and only the second one was ever gated:

- the reconciliation path checks `row.customerId !== user.id` (it always did);
- the already-booked short-circuit — `findBookingByRequest` hitting a row —
  returned it unconditionally to any signed-in caller until #387 added
  `if (existing.customerId !== user.id) return null;`.

The route `GET /customer/booking-requests/:requestId/booking` carries only
`requireAuth`, so ownership is entirely the service's job. What leaked was
`bookingSchema` in full: `totalAmountCents`, `platformFeeCents`,
`vendorPayoutCents`, `stripePaymentIntentId`, `stripeTransferId`.

**Why:** the short-circuit reads like a cache hit rather than an authorization
decision, which is exactly why it was missed — the same shape appears in
`openCheckout` (line ~154) and in `recordSuccessfulPayment` (line ~232). Those
two are safe for different reasons and not by their own check:
`openCheckout` runs `requirePayableByCustomer` first, and
`recordSuccessfulPayment` has no user at all (it is the Stripe webhook).

**How to apply:** treat every `findBookingByRequest` / `findBookingById` result
as unauthorized until something in that same function compares it to `user.id`.
`participantIn` is the pattern that does it properly for the two `bookings/:id`
routes. `null`-then-404 is the settled convention here, not 403 — it matches
`requirePayableByCustomer` and denies a prober an id oracle. Do not propose 403.
Related: [[customer-pii-has-two-disclosure-gates]],
[[response-schemas-are-a-second-write-boundary]].
