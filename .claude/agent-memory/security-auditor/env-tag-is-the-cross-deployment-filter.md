---
name: env-tag-is-the-cross-deployment-filter
description: VEN-529 — metadata.env on a payment intent decides which deployment acts on a Stripe event; staging and production share one test account and one branched database
metadata:
  type: project
---

Staging and production share **one Stripe test account**, so every event reaches
both webhook endpoints, and staging's database is branched from production — so
`metadata.requestId` matches on _both_ tiers and cannot discriminate. VEN-529
stamps `env: DEPLOY_ENV` in `paymentIntentParams` and filters on it.

**Why:** a booking id is not a tier; only a tag written by the creating
deployment is.

**How to apply:**

- Order is load-bearing: the `payment_intent.succeeded` filter must run **before**
  the request lookup (`stripe.routes.ts`), because the lookup succeeds on both
  tiers. The dispute and failed-refund filters sit **inside** the no-match branch,
  so a dispute on one of our bookings can never be suppressed. Keep both shapes.
- Only a tag naming _another_ tier suppresses; untagged means pre-tag or foreign
  and is judged by whether a request matches. An untagged succeeded intent whose
  request is unknown returns `ignored` with a `log.warn` and **no alert and no
  refund** — the sibling `refuseDeclinedPayment` refunds and alerts. Reachable
  only if a `booking_requests` row is actually deleted; if a delete path is ever
  added, that branch becomes silent money loss.
- `isForeignEnvPaymentIntent` costs a Stripe `retrieve` inside the alerting
  branch: a retrieve that throws converts a 200 "alert and ignore" into a 500,
  so `unmatchedDisputeAlert` / `unmatchedRefundFailedAlert` never dispatch for
  that delivery. Self-healing on Stripe's retry; a permanently unretrievable PI
  (a Connect direct charge) would suppress the alert for good — but
  `retrieveDispute` already fails first on those.
- `reconcileBooking` and `recordSuccessfulPayment` carry **no** env check: they
  read the intent named by our own row, which on a branched staging database is
  production's intent. That door is open by design; do not widen it.
- The fake gateway tags with `TEST_ENV.DEPLOY_ENV` (`'local'`), not the harness's
  `env` override — a suite created with `DEPLOY_ENV: 'staging'` that runs a real
  checkout silently takes the foreign branch.
- VEN-645 (audited PASS 2026-09-24): the EFW branch filters env **before** the
  booking lookup (right shape). `transfer.reversed` and `payout.failed` carry no
  env tag (transfers have only `bookingId` metadata; payouts none): the reversal
  is gated on our own `stripe_transfer_id` and only lowers toward Stripe's truth;
  the bank-payout alert fires on both tiers for a shared vendor row (sink-bound
  noise). `payout.failed`'s `stripeAccount` header is the signed `event.account`,
  `acct_`-prefixed, never caller input. A lost chargeback now cancels the
  branched staging copy of a production booking (DB-only, no Stripe call).
  EFW case dedupe is read-then-insert: `insertSupportCase`'s conflict target is
  `stripe_dispute_id` (NULL here), so two concurrent deliveries write two cases.
- VEN-644's daily balance reconciliation compares the **shared** account's
  balance with **one** tier's liabilities, so pre-live it is noise or masking
  across tiers (correctness, not a trust boundary). Audited PASS 2026-09-23:
  alert/log carry only cents, the launch probe reuses the existing GET `/account`.
