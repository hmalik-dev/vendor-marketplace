---
name: retired-users-keep-their-email-in-the-unique-index
description: A soft-deleted users row keeps its email under the unconditional users_email_key, so closing an account and signing up again with the same address is a permanent, opaque 500 lockout
metadata:
  type: project
---

`retireUserWhere` (`apps/api/src/modules/users/users.dao.ts`) writes only
`deleted_at`/`updated_at` on `users` and `is_deleted`/`is_published` on the
storefront. **It never releases the address**, and
`users_email_key` (`packages/db/src/schema/users.ts`) is unconditional — no
`WHERE deleted_at IS NULL`. So a retired row reserves its email forever, against
every future identity.

Two consequences, both reachable through ordinary product use because a
Clerk-deleted identity frees its address _in Clerk_ while the local row keeps it:

- **Re-registration is a hard lockout.** Same person, new Clerk id, same
  address: `insertUserIfAbsent` is declined by `users_email_key`, finds no row
  under the new Clerk id, and (since #442) **throws**. The caller sees an opaque
  500 at the Terms interstitial forever, and `user.created` 500s through svix's
  retries. Before #442 the same point raised a bare 23505 — the effect is
  pre-existing; what #442 added is the claim in the doc comment that this needs
  "two identities that cannot co-exist" in Clerk, which the retired row makes
  false, and a message pointing an operator at "another account" that is really
  the caller's own closed one.
- **`user.updated` cannot mirror onto a taken address.** `updateUserByClerkId`
  has no conflict handling, so the mirror raises 23505 → 500 → svix gives up and
  `users.email` stays permanently stale. `notification-email.dao.ts` picks the
  recipient from that column, so counterparty PII keeps going to an address the
  account holder no longer controls.

Neither path can merge or overwrite another identity: every resolution reads by
`clerk_user_id` and the update's `where` is `clerk_user_id = X AND deleted_at IS
NULL`. This is availability and stale-recipient, not takeover.

**Why:** the row is kept for referential integrity (bookings, reviews, and the
undeletable acceptance record point at it), so the address rides along with it.
The only way an operator frees the address today is a hard `users` delete, which
is the one thing that cascades `legal_acceptances` away — see
[[legal-acceptance-record-is-undeletable-pii]].

**How to apply:** the smallest correction is a partial `users_email_key`
(`WHERE deleted_at IS NULL`) in its own migration; the untargeted `DO NOTHING`
still declines correctly against live rows. If the address must stay reserved,
the retired row has to be found by `email` and answered deliberately, not left
as an unhandled throw. Any diff touching account closure, the Clerk mirror, or
`insertUserIfAbsent` re-enters this. Related:
[[terms-gate-is-a-five-state-session]], [[closure-refuses-only-the-customer-side]],
[[clerk-webhook-is-now-a-money-mover]].
