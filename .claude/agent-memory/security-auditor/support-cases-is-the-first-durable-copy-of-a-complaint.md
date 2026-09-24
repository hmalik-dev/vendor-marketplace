---
name: support-cases-is-the-first-durable-copy-of-a-complaint
description: #431's support_cases table stores what customers wrote to support and is written by a public route and a Stripe webhook; the three admin routes are correctly gated, so audit the two non-admin writers instead
metadata:
  type: project
---

> **The auth provider is retired** (VEN-447/448/449 moved auth to Neon Auth). The auth provider names below describe the pre-cutover code and are historical; do not act on them as live.

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
  own customer (`id` / `authUserId` / `role`, read from the `users` row) as the
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
questions are disclosure and integrity rather than tamper-evidence.

**VEN-429 closed the false-refusal spot and added a money gate.** The
`AlreadyHeldError` branch re-reads the booking and compares `disputeReason` to
this dispute's own generated message, so a retry that finds its own hold records
`hold_refusal = null`; the bell now rings only for the delivery whose insert
wins. And `resolveDispute` (payments) refuses both rulings against
`findOpenChargebackCase` — a **deny**-list, not an allowlist: refund blocked when
`network_outcome` is `null` or `'lost'`, vendor blocked only on `'lost'`.
`network_outcome` is Stripe's `dispute.status` written verbatim by
`recordChargebackOutcome`, so any status that is neither of those opens the
refund path. Two soft spots left, both non-blocking: the DAO's `limit(1)` has no
`ORDER BY` (a second chargeback on one booking can hide a `lost` one behind a
`won` one), and the console keys its hidden buttons on the _viewed case's_
`origin`, so the report case beside a chargeback still draws controls the API
409s. `resolveCase` refuses a `disputed` booking and `resolveCasesForBooking`
runs only after the ruling, so the `status='open'` predicate cannot be
short-circuited from the console; `account-unwind` does not call
`resolveDispute`, so a chargeback cannot block a closure.

**VEN-683 (audited PASS):** on a `cancelled` booking the open chargeback case
is the only thing holding the residual (`payoutResidualHeld`), so `resolveCase`
now 409s unless `network_outcome` is in the **allowlist**
`DISPUTE_RESOLVABLE_OUTCOMES` (`won`, `warning_closed`). `readPlatformLiabilities`
excludes the booking only while the outcome is null or outside
`DISPUTE_FUNDS_NOT_HELD`; the `not in` list is bound constants via `sql.join`.
The guard's read sits outside the close transaction, which is acceptable because
`won`/`warning_closed` are terminal Stripe states.
