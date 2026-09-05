---
name: refund-before-row-move-can-double-refund
description: cancelBooking refunds before it cancels the row, and nothing durable records that a refund happened — past Stripe's 24h key window a retry refunds a second time, and since D31 that debits the vendor twice
metadata:
  type: project
---

`cancelBooking` sends the refund first and moves the booking row second, on
purpose: a cancelled row whose refund failed is the unrecoverable direction.
The compensating failure is that when `cancelBookingAndFreeDate` _throws_
(deadlock, connection loss — a `null` return is the benign case), the booking
stays `confirmed` with money already out, and the only record is a
`log.error(... 'Refunded a booking whose row could not be cancelled')`.

`bookings` has `stripe_payment_intent_id` but **no refund column**, so the sole
replay guard is Stripe's idempotency key, which expires after 24 hours. A cancel
retried after that window creates a second refund, and Stripe accepts it as long
as the running total stays inside the charge — two 50%-tier refunds sum to 100%
and both succeed.

**Why it matters more since D31 (#416):** refunds now carry
`reverse_transfer: true`, so a duplicate no longer just costs the platform — it
claws the vendor's payout back a second time and can leave a third party's
connected account negative.

**How to apply:** treat "refund issued" as state that must survive the process,
not as something the idempotency key remembers. Smallest fix is to look for an
existing refund on the intent before creating one, or to persist the refund id
on the booking. Related: [[refund-idempotency-key-is-parameter-sensitive]],
[[idempotency-guards-orphan-side-effects]].
