---
name: closure-refuses-only-the-customer-side
description: POST /admin/users/:id/close blocks only on bookings the subject holds as the customer; a vendor closure refunds every future confirmed booking in full and zeroes the payout, so any copy saying closure refunds nothing is false for a vendor subject
metadata:
  type: project
---

`closeBlockers` in `apps/api/src/modules/admin/data-rights.service.ts` calls
`findConfirmedBookingsToUnwind(db, userId, null, ...)` — the literal `null`
narrows the predicate to `customer_id = subject`. **That is deliberate and
correct** (D39: only the customer can cancel a confirmed booking, so refusing a
vendor's closure would be an instruction nobody can follow).

**The consequence is that a vendor closure is a money mover with an empty
blocker list.** `CLOSURE_UNWIND` carries `initiatedBy: 'account-holder'`, whose
leave-for-review branch is guarded on `booking.customerId === targetId`, so for
a vendor subject every future confirmed booking falls through to the full-refund
path: customer refunded 100%, `vendor_payout_cents` written to 0, key
`close-refund:direct:<bookingId>`. `closeBlockers` returns `[]`, so nothing on the
refusal path warns about it — the console is told through a separate count,
`bookingsRefundedOnClose`, and not through the blocker list.

**Why:** D39 ruled the vendor side keeps #433's full refund; the refusal exists
only for the customer side. The behaviour is settled — do not re-litigate it.
What was _not_ settled is that four surfaces stated the opposite of it: the
confirmation dialog, the console page, the route's own docstring and the public
privacy policy all said closure refunds nothing. **Corrected in #438**, which
also surfaced `bookingsRefundedOnClose` so the dialog names the refunds before
an operator confirms them. The lesson survives the fix — the copy was wrong
because it described one half of a two-sided rule.

**How to apply:** any change here must keep the two halves apart. The refusal is
customer-side; the refund is vendor-side. Before trusting any copy about this
route ("refunds nothing", "prices nothing", "never prices a refund"), check
which side of the booking the subject is on — the sentence is true for a
customer subject and false for a vendor one.

Related: [[account-unwind-full-refund-is-the-ban-argument]],
[[refund-idempotency-key-is-parameter-sensitive]],
[[payout-sweep-is-a-second-money-mover]].
