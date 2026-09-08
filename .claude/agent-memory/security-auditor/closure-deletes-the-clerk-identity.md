---
name: closure-deletes-the-clerk-identity
description: POST /admin/users/:id/close now deletes the Clerk user — the only irreversible console action, it provokes its own user.deleted webhook, and it has no guard on an admin target or a non-Clerk id
metadata:
  type: project
---

`closeAccount` (`apps/api/src/modules/admin/data-rights.service.ts:576`) calls
`app.deleteClerkUser` — a new `FastifyInstance` decorator in
`plugins/clerk-auth.ts:174` — after the retirement commits. That is the only
action in the console that **cannot be undone from this repository**.

**The self-replay is sound, do not re-report.** Deleting the Clerk user fires
`user.deleted` back at our own webhook. The order is retire → unwind → delete,
and `retireUserWhere`'s `UPDATE ... WHERE deleted_at IS NULL RETURNING` is a
_claim_, not a read, so `applyUserDeleted` finds no live row and answers
`ignored`. No second unwind, no double refund. Forging the event needs the svix
secret. `data-rights.routes.test.ts` asserts the refund count across the
replay.

**The two gaps found and reported at #451, both low:**

1. No guard on an **admin target**. `actorId === userId` is refused (403) with
   the reasoning that an actor must not erase their own audit trail, but
   nothing stops one admin permanently deleting another's identity. `role =
'admin'` is unreachable from inside the product, so the platform can lose
   its last operator; recovery is a Clerk-dashboard user plus a re-seed, or a
   hand-written DB row. `setUserBanned` shares the absence but a ban is
   reversible.
2. `isClerkIdentity()` (`webhooks/clerk.reconcile.ts:70`, the repo's named
   predicate for _"Clerk never issued this id"_) is not applied before the
   outbound call, so closing a `seed_mkt_…` row hands a fabricated id to
   Clerk; the 404 is swallowed by `isAlreadyGone` and reported as
   `identityDeleted: true`.

**How to apply:** treat any new outbound Clerk write the same way — guard the
id with `isClerkIdentity`, and keep it strictly after the local claim. Never
drive this route against a seeded E2E account: `db:seed:e2e` _resolves_ Clerk
ids rather than creating them, so it cannot restore a deleted identity.

Related: [[email-uniqueness-is-partial-nothing-joins-by-email]],
[[clerk-webhook-is-now-a-money-mover]], [[admin-action-log-is-trigger-immutable]].
