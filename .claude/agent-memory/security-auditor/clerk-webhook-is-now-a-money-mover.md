---
name: clerk-webhook-is-now-a-money-mover
description: POST /webhooks/clerk issues Stripe refunds since #433; its replay guard is a read that only closes after an unbounded Stripe loop, so a svix timeout redelivers into a concurrent unwind
metadata:
  type: project
---

`POST /webhooks/clerk` stopped being one `UPDATE` in #433. `user.deleted` now
runs `unwindAccountBookings` — Stripe refunds, booking cancellations,
notification writes and queued email — inside the request.

**Verification order is sound and should not be re-reported.** `clerk.routes.ts`
verifies svix over the raw bytes _before_ `JSON.parse` and before the service
call; missing svix headers are a 401; the route declares no body schema, so
nothing parses ahead of verification; `CLERK_WEBHOOK_SECRET` has no
`defaultValue` in the env registry. A forged event cannot reach the refund.

**The live weakness is the replay guard's shape.** `applyUserDeleted` claims a
redelivery is a no-op because _"the second delivery finds no live user"_ — but
`findUserByClerkId` is a read, and `retireUserByClerkId` runs only **after** the
whole loop. `findConfirmedBookingsToUnwind` has no `LIMIT` and each iteration is
up to two Stripe round trips, so a large account outruns svix's timeout and the
retry re-enters the unwind concurrently.

Money survives it — `findRefund`, the per-booking idempotency key, and
`cancelBookingAndFreeDate`'s `status = 'confirmed'` guard returning null to the
loser. What does not survive is the alert: the loser's in-flight-key 409s are
caught and counted into `refundsFailed`, firing the _"left refunds stuck"_
`log.error` on a delivery where nothing is stuck.

**How to apply:** on any diff that puts new work on this route, ask whether the
handler can outlive the webhook timeout, and whether its precondition is a claim
(`UPDATE … WHERE deleted_at IS NULL RETURNING`) or merely a read. The route also
shares the global per-IP `RATE_LIMIT_MAX` bucket with no `config: { rateLimit:
false }`, which is a second path to redelivery-while-running.

Related: [[account-unwind-full-refund-is-the-ban-argument]],
[[idempotency-guards-orphan-side-effects]],
[[background-work-queue-carries-no-session]].
