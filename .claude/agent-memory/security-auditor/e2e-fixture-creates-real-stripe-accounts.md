---
name: e2e-fixture-creates-real-stripe-accounts
description: the e2e seed provisions a REAL Stripe connected account under a fabricated identity; one sk_test_ prefix check is the only thing keeping a live key off that path
metadata:
  type: project
---

**Renamed from `e2e-fixture-forges-stripe-onboarded` (2026-08-31).** The forged
flag it was written about is gone twice over — #381 made it unrepresentable with
a CHECK (see [[stripe-onboarded-entails-account-id]]) and #387 removed the
placeholder that motivated it. What is recorded here now is the _new_ exposure
that replaced it, which is why the file kept its history instead of being
deleted with the old concern. The old shape — `stripeOnboarded: true`
beside `stripeAccountId: 'acct_e2e_fixture_not_a_real_account'` — is gone.
`packages/db/src/seed-e2e.ts` now takes a `stripeAccountId` and narrows
`payoutsReady` to `false` whenever it is `null`, so the impossible row
(`onboarded = true AND account_id IS NULL`, or a placeholder id) can no longer
be written. Do not re-report the forged flag.

What replaced it is a **fixture that calls Stripe for real.**
`packages/db/src/scripts/e2e-stripe-account.ts` creates a v2 recipient account
under a fabricated individual (Stripe's documented test identity: Jenny Rosen,
SSN `000000000`, `address_full_match`) and **attests to Stripe's terms of
service on that person's behalf**, then attaches `btok_us_verified`.

The whole thing that stops that reaching a real Stripe organisation is
`createStripeFixtureGateway`'s `secretKey.startsWith('sk_test_')` throw. It is
correctly placed — before `new Stripe(...)`, before any network call, and
`assertSafeTarget` has already refused an unsafe database well before it — but
it is one line and it is the sole control on that path.

**Why:** the database guard (`assertSafeTarget`) reads `.neon`/`NEON_BRANCH`,
not `STRIPE_SECRET_KEY`. Nothing about a safe local Postgres constrains which
Stripe organisation the key points at, so the two guards are independent and
neither substitutes for the other.

**How to apply:** any diff touching `e2e-stripe-account.ts`,
`resolveConnectedAccount`, or the gateway interface must be checked for that
prefix throw still being on the only path from a key to `stripe.v2.core.accounts.create`.
`ensureE2eConnectedAccount` takes an _injected_ gateway, so a second caller that
builds its own `new Stripe(key)` bypasses the guard entirely. The module is not
in `packages/db`'s `exports` map, which is what currently keeps callers inside
the package. Related: [[fabricating-seeds-share-one-declared-branch-guard]],
[[credential-fixtures-assembled-at-runtime]].

`packages/preflight/src/checks/browser.ts`'s `describePayoutRoute` reads the
same key and has **no** such prefix check — deliberate and acceptable, because
it only issues `GET /v1/accounts/<id>` and creates nothing.
