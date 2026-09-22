---
name: payout-release-needs-a-real-payment-intent
description: Seeding a payout-release scenario with a fake stripe_payment_intent_id 500s on findRefund before it ever reaches the transfer or account checks
metadata:
  type: project
---

Driving `PUT /admin/bookings/:id/payout/retry` through the real code path (not
`releaseDuePayouts` in a test harness) calls `stripe.findRefund(paymentIntentId)`
_before_ it checks the vendor's connected-account state. A fixture row with a
made-up `pi_...` id fails with "No such payment_intent" from real Stripe test
mode — this looks like the release logic itself is broken but it's just an
unresolvable lookup.

**Why:** `releaseOnePayout` (`apps/api/src/modules/payments/payouts.service.ts`)
checks for an external refund via the real payment intent id first, and only
after that checks `vendorStripeOnboarded`/`vendorStripeAccountId`. So a
stranded-vendor scenario (no account) fails correctly even with a fake intent
id — that branch returns before `findRefund` is reached — but a
released/happy-path scenario needs a **real** Stripe test-mode PaymentIntent
that exists (does not need to be confirmed/captured, `refunds.list` just needs
it to exist).

**How to apply:** when seeding a released-payout fixture directly in Postgres,
create a real PaymentIntent first (`stripe.paymentIntents.create(...)` with the
project's real `STRIPE_SECRET_KEY`, no confirm needed) and store _that_ id in
`bookings.stripe_payment_intent_id`, not a placeholder string. Also remember
the retry route reads the caller's own session (`/api/session/token` →
bearer JWT against the API's own port), not cookies — `fetch('/admin/...')`
on the web app's own origin 404s because that path only exists on the API.
And a fresh vendor also needs a `legal_acceptances` row
(`document='vendor_agreement'`) or release fails with "vendor has not accepted
the vendor agreement yet" before ever reaching Stripe.

Separately: [[admin-manual-retry-never-dispatches-operator-alerts]].
