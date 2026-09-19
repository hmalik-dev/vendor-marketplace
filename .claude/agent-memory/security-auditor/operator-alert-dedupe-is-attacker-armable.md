---
name: operator-alert-dedupe-is-attacker-armable
description: Operator alerts — the Stripe webhook failure counters are driven by an unauthenticated endpoint, so every dedupe subject, DB write and unrecorded-send fallback they gained is attacker-paced
metadata:
  type: project
---

`stripeWebhookFailingAlert` is counted by an `onResponse` hook on the
unauthenticated `POST /webhooks/stripe`, so **everything that hook touches is
attacker-paced**. Three shapes, in order of when they were found:

**VEN-405 (settled):** one `subjectId: 'stripe'` for 401s and 5xx let three
unsigned POSTs mute a real outage for 6h. Split into `stripe:<kind>`. Residual
accepted: an attacker sending a _bogus_ `stripe-signature` still lands in the
`signature` kind and can mute that one alert. Do not re-report it.

**VEN-434 (settled):** `paymentRefusedAlert` sent two opposite outcomes under one
subject; now `<requestId>:refunded|unrefunded`.

**VEN-430:** the counter gained a 429 kind and a persisted DB counter, so a
_rejected_ request now costs a DB transaction (~1:1 with shed traffic) where on
main it cost nothing — the rate limiter stopped shedding load and started
amplifying it. Separately `alertNow` learned to send **unrecorded** (fresh
`randomUUID`) when `recordAlertUnlessRecent` throws, which deletes the only email
cap during the one outage an unauthenticated flood can ride.

**Why:** an unauthenticated trigger and a trusted trigger keep sharing a
mechanism — a dedupe key, a write path, a send budget.

**How to apply:** for any new work the webhook's failure hook performs, ask what
it costs at 10k rejected req/min, not at Stripe's delivery rate. Settled on these
lanes: alert bodies carry no customer PII, `renderOperatorEmail` escapes every
line, dedupe SQL is parameterised, `OPERATOR_ALERT_EMAIL` throws on a deployment.
`stripe_webhook_failures` growth is **bounded** (cleared at threshold, pruned to
24h) — that half is fine. Related: [[idempotency-guards-orphan-side-effects]].
