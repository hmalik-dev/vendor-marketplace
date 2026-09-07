---
name: payout-sweep-is-a-second-money-mover
description: The #423 payout sweep moves money on a timer with row locks the request paths do not take, so cancel and dispute race it
metadata:
  type: project
---

`releaseDuePayouts` (`apps/api/src/modules/payments/payouts.service.ts`) runs on
an in-process 15-minute timer in **every** API instance, claims a booking with
`FOR UPDATE SKIP LOCKED`, and transfers `vendor_payout_cents` inside that
transaction. It is internally safe against itself.

It is **not** serialised against the request paths. `cancelBooking` and
`raiseDispute` read the booking, make their Stripe call outside any
transaction, and then write through a guarded update that keys on `status`
alone (`payments.dao.ts:320`, `:249`) — and the sweep never changes `status`,
so the guard cannot see a release that landed in between. The observable
consequence is a refund computed as "nothing has been transferred" committing
against a booking the sweep transferred a moment later.

**Why:** before #423 the money moved once, at charge time, on the request path.
The timer is the first background writer on the money path.

**How to apply:** any new booking write that reasons about
`payout_released_at` / `stripe_transfer_id` must carry those columns into its
guarded update's `where`, or take the row lock the sweep respects. A status-only
guard is not enough any more. Related:
[[refund-proportionality-is-now-ours-to-state]].
