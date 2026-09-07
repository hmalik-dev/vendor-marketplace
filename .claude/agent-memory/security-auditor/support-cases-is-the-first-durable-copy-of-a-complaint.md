---
name: support-cases-is-the-first-durable-copy-of-a-complaint
description: #431's support_cases table stores what customers wrote to support and is written by a public route and a Stripe webhook; the three admin routes are correctly gated, so audit the two non-admin writers instead
metadata:
  type: project
---

`support_cases` (#431, `packages/db/src/schema/support-cases.ts`) is the first
place a support message body is stored rather than only emailed. Three writers,
and only one of them is an admin operation:

- **`POST /support/messages`** — public, unauthenticated, 6/hour. `senderUserId`
  is `auth?.id ?? null` and `bookingId` is refused with 401 when there is no
  session, so neither can be chosen by the caller; `senderEmail` is the caller's
  own unverified string for a signed-out send and the `users` row's address
  otherwise. Nothing here is a new authorization surface — the audit surface is
  the failure branch, see
  [[free-text-accepts-nul-so-any-text-insert-can-be-failed-on-demand]].
- **`charge.dispute.created`** — `openChargebackCase` synthesises the booking's
  own customer (`id` / `clerkUserId` / `role`, read from the `users` row) as the
  actor for `placeDisputeHold`. **This was audited and is sound**: every input on
  the chain is server-derived — signed event → `retrieveDispute` → Stripe's
  `payment_intent` → `bookings.stripe_payment_intent_id` → that booking's
  customer — so `participantIn`'s `side === 'customer'` check is satisfied by
  construction and cannot be steered onto another booking. Do not re-report it as
  an authorization bypass.
- **`PUT /admin/cases/:caseId/resolve`** and the two `GET`s — all three carry
  `onRequest: adminOnly` (`requireRoleBeforeValidation('admin')`), which is what
  [[schema-validation-runs-before-prehandler-guards]] asks of a new guarded route
  with an enum in its request schema. Pinned by a test that injects
  `?status=not-a-status` and asserts 403, not 400.

**The audit `detail` is clean** — `{ reference, origin, hadBooking }`, no message
and no email, per [[admin-action-log-is-trigger-immutable]].

**How to apply:** the table is not the audit log and is mutated normally, so the
questions are disclosure and integrity rather than tamper-evidence. The one
recorded soft spot: `openChargebackCase` places the hold _before_ it writes the
case and has no compensation, and it files `placeDisputeHold`'s customer-facing
409 copy verbatim into `hold_refusal` — so a booking already held (by a report,
or by this same path's failed first attempt) yields a case telling an operator
"the payout could not be put on hold" while it is frozen.
