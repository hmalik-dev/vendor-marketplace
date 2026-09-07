---
name: stripe-caches-failed-idempotent-results
description: Stripe replays a cached FAILURE for a repeated idempotency key for 24h, so a retry key must carry the attempt number
metadata:
  type: project
---

Stripe caches the result of an idempotent request for 24 hours, and **that
includes failures**. Found 2026-09-06 driving #423's payout sweep against real
test mode: the first transfer was refused `balance_insufficient`, and every
later attempt returned the identical error even after the platform balance was
funded. A fresh key succeeded instantly on the same parameters.

**The diagnostic tell is `request_log_url` pointing at the *original* request**
while the outer `requestId` differs. That is what distinguishes a replayed cache
entry from a fresh refusal; the error message alone looks identical.

**The rule:** an idempotency key must be versioned by the *attempt*, not only by
the subject, wherever a retry is expected to succeed after a transient failure.
`payout_<bookingId>_<attempt>`, read from a durably committed counter.

**The boundary matters** — this is not a blanket rule. Ask whether a repeat is a
*retry of a failure* or a *replay of a success*:

- Retry of a failure (the payout transfer) → attempt in the key.
- Replay of a success (the refund, keyed per cancellation) → **no** attempt.
  That replay is the behaviour #416 depends on; adding an attempt there would
  reintroduce double refunds.

Nothing is given up by varying it when a row lock already prevents concurrent
duplicates, and the must-replay case — a write that reached Stripe under a
transaction that never committed — still replays, because a rolled-back
transaction never incremented the counter. Recorded as **D33**.

A key replayed with *different parameters* is separately refused with
`StripeIdempotencyError`, so a key must also be versioned whenever its request
shape changes — `pay_…_separate`, `cancel_…_direct`.
