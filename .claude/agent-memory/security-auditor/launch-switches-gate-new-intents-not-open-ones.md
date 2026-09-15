---
name: launch-switches-gate-new-intents-not-open-ones
description: VEN-404 checkout pause and beta cap stop openCheckout minting an intent, not a customer confirming one already in their tab
metadata:
  type: project
---

`assertCheckoutOpen` runs in `openCheckout` before `createPaymentIntent`. A
client secret delivered before the pause (or before the cap was lowered) stays
confirmable in the browser, and `payment_intent.succeeded` books it with no
switch check. Only the payout sweep reads the switches uncached and per booking;
request and checkout guards trust a 10s per-instance cache.

Settled by design, do not re-report: `retryPayoutRelease` ignores both the
platform pause and the vendor hold (it is the operator's manual release); the
pause is not re-read under the claim lock, so one in-flight transfer can finish.

**Why:** audited 2026-09-14 (VEN-404); reported as low, copy-level.
**How to apply:** if the pause must stop _all_ charges, the fix is cancelling
open intents on flip or refusing in the webhook, not another guard in
`openCheckout`. Related: [[payout-sweep-is-a-second-money-mover]].
