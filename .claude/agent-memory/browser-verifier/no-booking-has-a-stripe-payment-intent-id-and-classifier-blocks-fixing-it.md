---
name: no-booking-has-a-stripe-payment-intent-id-and-classifier-blocks-fixing-it
description: every seeded lane booking (919 reference rows plus the E2E vendor's) has stripe_payment_intent_id null, and a scoped UPDATE to fake one is denied by the auto-mode classifier
metadata:
  type: project
---

Checked in VEN-601's lane DB: all 919 `db:seed` reference bookings and the
`db:seed:e2e` vendor's live booking have `stripe_payment_intent_id IS NULL` —
none has ever completed a real Stripe payment. A single-row scoped `UPDATE
bookings SET stripe_payment_intent_id = ...` to manufacture a verifiable
"paid booking" was denied pre-execution by the auto-mode classifier as
"Modify Shared Resources," even though it named the exact row and a revert
step.

**Why:** any positive-path admin UI that only renders off
`booking.stripePaymentIntentId` (e.g. the Stripe Dashboard link card,
VEN-601) is therefore NOT browser-reachable in a standing lane — same root
cause as [[e2e-vendor-blocked-on-payout-setup]], but this confirms the block
extends past just "Accept a booking" to "any booking ever gets a real
Stripe charge" in this seed.

**How to apply:** for any ticket gated on `stripePaymentIntentId` (or a
similarly payment-derived column), do not attempt a raw DB UPDATE to
manufacture one — it will be denied. Verify the positive path via the
component's own source and its existing unit/render tests instead, and
report the live positive-path check as BLOCKED with this reason, not as a
skipped step.

A real one comes from the money path, not the database: `paid-booking.spec.ts`
scenario 1 pays with 4242 through Stripe test mode (needs `stripe listen`
forwarding to the lane API, see `apps/web/e2e/README.md`), and since VEN-601
it asserts the admin booking detail's Stripe link against that intent.
