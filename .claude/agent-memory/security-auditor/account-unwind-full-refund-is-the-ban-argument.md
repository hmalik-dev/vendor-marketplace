---
name: account-unwind-full-refund-is-the-ban-argument
description: unwindAccountBookings refunds 100% and zeroes the vendor payout because a ban is operator-initiated; the same code now runs on self-service Clerk deletion, where that reasoning inverts into a D3 cancellation-tier bypass
metadata:
  type: project
---

`unwindAccountBookings` (`apps/api/src/modules/admin/account-unwind.ts`) refunds
`booking.totalAmountCents` — the **full** amount, never D3's tiers — and writes
`vendorPayoutCents: 0`. Its own doc comment states why: _"the platform is
removing a party from a transaction the other side did nothing wrong in, so
charging them a cancellation penalty would be indefensible."_

**That argument is the ban's, and it only holds while the operator is the
initiator.** #433 pointed the Clerk `user.deleted` webhook at the same function
via `DELETION_UNWIND`, and per #438's own state section _"the only deletion that
exists happens if the user deletes their own Clerk identity"_ — `<UserButton />`
in `site-header.tsx`. So the refunded party is now the one who initiated.

The gap is concrete: `cancelBooking` prices a customer cancellation with
`calculateRefund`, which pays `LATE_CANCELLATION_REFUND_RATE` inside
`FULL_REFUND_CUTOFF_HOURS` and leaves the vendor `retainedPayoutCents`. Deleting
the account instead pays 100% on **every** future confirmed booking at once and
zeroes every vendor's payout. `findConfirmedBookingsToUnwind` bounds only on
`event_date > today`, so the day before the event is in range.

**How to apply:** the loop already knows which side was deleted —
`booking.customerId === targetId`. Any future caller of `unwindAccountBookings`
must be classified before it reuses the copy constants: operator-initiated
(`SUSPENSION_UNWIND`) keeps the full refund; a subject-initiated closure is a
cancellation and must price like one. #438 ("account closure … must reuse #433's
path") is the next caller and inherits this whole question.

Related: [[refund-proportionality-is-now-ours-to-state]],
[[refund-idempotency-key-is-parameter-sensitive]],
[[legacy-destination-rows-guarded-in-one-place]].
