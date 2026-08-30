---
name: e2e-fixture-forges-stripe-onboarded
description: The e2e seed sets vendor_profiles.stripe_onboarded true with stripe_account_id null — a state Stripe can never produce, and a trap for whoever builds checkout
metadata:
  type: project
---

`packages/db/src/seed-e2e.ts` writes `stripeOnboarded: true` (default, via
`payoutsReady`) and never writes `stripeAccountId`. Real onboarding sets both:
`apps/api/src/modules/vendors/stripe-connect.service.ts` claims an account id
first, then flips the flag from the account-updated webhook.

`stripe_onboarded = true AND stripe_account_id IS NULL` is therefore a row shape
only the fixture produces. Today it is harmless — the only reader of the flag is
the 402 gate in `booking-requests.service.ts` (`accept`), and there is no
payment-intent code in `apps/api` at all.

**Why:** the flag exists so an unattended browser pass can accept a booking
without a Stripe round trip. The fixture is the intended, ticketed behaviour, not
a defect.

**How to apply:** when checkout / payment intents land, any code that reads
`stripeOnboarded` as a promise that `stripeAccountId` is present will hit a null
on every seeded developer database. Say so then; do not re-report the seed.
Related: [[fabricating-seeds-share-one-declared-branch-guard]].
