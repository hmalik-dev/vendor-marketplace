---
name: idempotency-guards-orphan-side-effects
description: Confirmed pattern — every ON CONFLICT DO NOTHING idempotency guard in this API sits in front of non-transactional follow-on writes, so a half-failed first attempt is permanently absorbed by the retry
metadata:
  type: project
---

Every write path in `apps/api` that guards duplicate delivery does so at the
_insert only_, then performs its follow-on writes as separate autocommit
statements — no `db.transaction`. When the insert's uniqueness guard later
absorbs a retry, the follow-on writes of the failed first attempt are never
re-run and there is no other call site that would create them.

Confirmed instances:

- `createBookingRequest` (ticket #67, 2026-08-29): `insertRequest` →
  `ensureConversation` → `notifyParty`. `ensureConversation` has exactly one
  call site, so a request whose conversation write failed never gets one.
- `bookings_request_id_key` is described in `packages/db/src/schema/bookings.ts`
  as "the idempotency guard for the `payment_intent.succeeded` webhook, which
  may be delivered more than once" — same shape, check it the same way.

**Why:** the guard turns a loud partial failure (500, client retries, second row
created, vendor still notified) into a silent permanent one (200 "sent", vendor
never notified). The dedupe is correct; suppressing _all_ side effects on the
dedupe branch is what loses data.

**How to apply:** on any diff adding or moving an `onConflictDoNothing` /
unique-index guard, ask what runs _after_ the guarded insert and whether the
dedupe branch re-runs the idempotent ones. Distinguish the writes that must stay
suppressed (notifications — the user-visible duplicate) from the ones that are
already idempotent and must be re-run (`ensureConversation`, which uses a
targeted conflict on `conversations_customer_vendor_key`). The alternative fix is
one transaction around insert + side effects, so a failure rolls the row back and
the retry genuinely re-creates it.

Related: [[env-target-live-key-trap]].
