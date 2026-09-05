---
name: review-checklist-status-filter-vs-webhook-idempotency
description: When a diff narrows a shared DAO read with a status filter, grep every caller — one of them is usually the webhook's "already recorded?" idempotency check, and narrowing it turns a redelivery into a permanent 409
metadata:
  type: feedback
---

**A status filter added to a shared finder is a behaviour change for every
caller, and in this repo one of those callers is an idempotency guard.**

`findBookingByRequest` (`apps/api/src/modules/payments/payments.dao.ts`) has
four callers. Three are customer-facing reads where "a cancelled booking is not
the answer" is right. The fourth is `recordSuccessfulPayment`
(`payments.service.ts`), whose first statement is `const existing = await
findBookingByRequest(...)` — that read **is** the webhook's "have I already
recorded this event" check, and the post-conflict re-read below it is the
"another delivery won the race" branch. #400 added `ne(status,'cancelled')` and
both went blind: a redelivered `payment_intent.succeeded` after a cancel falls
through, `confirmBooking` hits `bookings_request_id_key` and returns `null`, the
re-read is still blind, and the route answers **409 `That booking could not be
recorded`** — for three days of Stripe retries. The unique index is what stops it
being a duplicate booking instead.

**How to apply:**

- For any `and(...)`/`ne(...)` added to an exported DAO finder, list the callers
  (`grep -rn '<fnName>' apps/api/src`) and ask of each: _is this read a
  presentation question or a "did this already happen" question?_ Only the first
  kind may be narrowed.
- Probe it: copy the `payments.routes.test.ts` helpers into a throwaway
  `zz-*.test.ts`, split `payFor` into `deliverWebhook(intentId)`, then
  accept → pay → cancel → `deliverWebhook` again and assert 200. Delete the
  file and re-run `git status`.
- The shipped tests will not catch it — they drive each webhook exactly once.

Related: [[review-checklist-read-time-overlay-vs-sibling-write]] — same family:
the caller the diff never shows is the one that breaks.
