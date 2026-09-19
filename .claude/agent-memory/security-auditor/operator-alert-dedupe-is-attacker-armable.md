---
name: operator-alert-dedupe-is-attacker-armable
description: VEN-405 operator alerts — the Stripe webhook failure alert shares one 6h dedupe subject for unsigned 401s and real 5xx, so an anonymous caller can mute it
metadata:
  type: project
---

`stripeWebhookFailingAlert` uses `subjectId: 'stripe'` for both 401 (signature) and 5xx failures, counted by an `onResponse` hook on the unauthenticated `POST /webhooks/stripe`. Three unsigned POSTs in 10 min send one alert and write the 6h dedupe row, silencing a genuine 5xx/secret-rotation outage for 6h; repeat every 6h to mute it indefinitely. Reported on the VEN-405 lane (2026-09-14).

**Why:** `recordAlertUnlessRecent` dedupes on kind+subject only; an attacker-reachable trigger and a trusted trigger share the key.

**Second shape, VEN-434:** `paymentRefusedAlert` sends _both_ "refunded" and "has not been refunded" under `payment_refused` + the same `requestId`. The failure fires first (it rethrows so Stripe redelivers), so the later truth is deduplicated away and the operator is left holding the inverted state. An alert kind that reports two opposite outcomes of the same subject needs two subject ids, not two summaries.

**How to apply:** any new alert whose trigger an unauthenticated caller can reach must not share a dedupe subject with a trusted trigger, and no two contradictory outcomes may share one. Settled on that lane: alert bodies carry no customer PII (reporter text/email excluded), `renderOperatorEmail` escapes every line, advisory-lock/digest SQL is parameterised, `OPERATOR_ALERT_EMAIL` throws on a deployment (env.test), `/reports` is per-account rate limited. Related: [[idempotency-guards-orphan-side-effects]].
