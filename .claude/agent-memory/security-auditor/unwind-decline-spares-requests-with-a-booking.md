---
name: unwind-decline-spares-requests-with-a-booking
description: declineOpenRequests now spares an accepted request when a correlated NOT EXISTS finds a bookings row; only a real succeeded PaymentIntent writes that row, so the exemption is not attacker-arrangeable, and it closes a latent post-unban double-booking window
metadata:
  type: project
---

`declineOpenRequests` (`apps/api/src/modules/admin/admin.dao.ts`) declines
`pending | quoted` unconditionally and `accepted` **only when no `bookings` row
sits behind the request** (#444). All three unwind entry points share it:
`setUserBanned`, the Clerk `user.deleted` path in `clerk.service.ts`, and
`closeAccount`.

**The exemption cannot be arranged by either party.** `bookings` has exactly one
production writer — `confirmBooking` in `payments.dao.ts`, called only from
`recordSuccessfulPayment`, which needs a Stripe intent that actually succeeded
(webhook, or `reconcileBooking` retrieving a `succeeded` intent). `bookings_
request_id_key` makes it at most one row. So making a request survive an unwind
costs a real charge, and that charge produces a **future confirmed** booking the
same run cancels and refunds in full.

**The row set is strictly narrower, and the `sides` clause is untouched.**
Verified by printing the generated SQL through `drizzle-orm/pg-proxy`'s
`toSQL()`: the `or` arm is parenthesised and ANDed with `sides`, so no tenant
widening, and every value is a bound parameter — `sql\`1\`` emits a bare literal.

**The narrowing removes a latent double-booking window rather than adding one.**
`hasRivalAcceptanceOn` and `syncHeldDate` both key on the literal `'accepted'`:
under the old predicate an unwind flipped the request behind a live or settled
booking to `declined`, which freed that vendor+date for a rival acceptance on a
date that was already sold. See [[availability-status-literals-are-load-bearing]].

**What a spared request does _not_ newly disclose.** An `accepted` request keeps
gate 2 of [[customer-pii-has-two-disclosure-gates]] open
(`CONTACT_DISCLOSING_BOOKING_REQUEST_STATUSES = ['accepted']`). No incremental
exposure: every spared row has a booking, `ACCEPTED_BOOKING_STATUSES =
['confirmed','completed','disputed']` in `customers.dao.ts` already grants gate 1
permanently and customer-wide off that same booking, and a `cancelled` booking
cannot sit behind a spared request because `cancelBookingAndFreeDate` settles the
parent request to `cancelled` in the same transaction (#400) — it is the only
writer of `bookings.status = 'cancelled'` in the tree.

**How to apply:** the _booking_ row, not the request status, is what holds a
customer's date through an unwind. `findConfirmedBookingsToUnwind` bounds on
`status = 'confirmed'` and `event_date > today`, so a `disputed` booking, a
today-dated one, a failed refund and a legacy destination payout all survive an
unwind already — the request now agreeing with them is consistency, not a new
open commitment. Audit any future edit that either widens what writes `bookings`
or adds `booking_requests` to the `notExists` subquery's `FROM` (that decorrelates
it and silently spares every accepted request), and see
[[messaging-tenancy-is-two-statements]] for the same correlation hazard.
