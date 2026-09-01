---
name: stripe-onboarded-entails-account-id
description: A DB CHECK makes stripe_onboarded imply stripe_account_id, and the acct_ format check on top of it was refused as a product decision (D29) — do not re-open it
metadata:
  type: project
---

Since #381, `vendor_profiles` carries
`vendor_profiles_stripe_onboarded_requires_account`
(`stripe_onboarded = false OR stripe_account_id IS NOT NULL`), added by
migrations `0020` (data repair) then `0021` (the CHECK). The pair is written from
exactly four places — `stripe-connect.service.ts` (claim), the account webhook
(flip), `seed-demo`, `seed-e2e` — and never from request input: the profile
create/update service builds its `values`/`patch` field-by-field and the shared
schema omits both columns, so no untrusted value reaches `stripe_account_id`.

**Why:** the flag alone was writable, and a fixture wrote it. The consequence was
two surfaces giving opposite answers about one vendor — the admin console's
`Payouts: connected` filter reads `stripe_onboarded` alone and said connected,
while the customer's `Pay` 402'd on the null account id and the web app rendered
that as `404 · NOT FOUND` (#387). Superseded
[[e2e-fixture-forges-stripe-onboarded]].

**The refused fix, so a later audit does not relitigate it.** #387 asked for
`acct_` plus Stripe's id charset on the same constraint. D29 refuses it: Stripe
does not publish the charset as a contract, so a regex would refuse a legitimate
future id at the moment a real vendor finishes onboarding, and this repo writes
non-Stripe ids on purpose (`acct_demo_<key>`, `acct_e2e_fixture_not_a_real_account`,
`acct_test_vendor`) precisely so they cannot be mistaken for real accounts.

**How to apply:** treat `stripeOnboarded = true` as entailing a non-null id, but
**not** as entailing a Stripe-issued one. A seeded database still reaches
`createPaymentIntent` with a fabricated `transfer_data[destination]`; the only
thing keeping that out of production is `assertSafeTarget` on the seeds
([[fabricating-seeds-share-one-declared-branch-guard]]). Do not propose a format
check as the remedy — name the seed guard instead.
