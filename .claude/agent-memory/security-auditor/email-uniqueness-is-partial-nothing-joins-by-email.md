---
name: email-uniqueness-is-partial-nothing-joins-by-email
description: since #451 users_email_key is UNIQUE(email) WHERE deleted_at IS NULL, so a closed address is reclaimable — audited and confirmed that no read in the tree resolves a person by email
metadata:
  type: project
---

`users_email_key` is partial as of migration `0039_reflective_dust.sql`:
`UNIQUE (email) WHERE deleted_at IS NULL`. Closing an account releases its
address, and two rows — one retired, one live — can now hold the same one.

**Why the release is safe:** identity is `clerk_user_id`, and that index is
still **full** unique. A retired row keeps its clerk id forever, Clerk never
reissues one, so a returning person always lands on a brand-new `users.id`.
Audited 2026-09-07 across `apps/api/src` and `packages`: **nothing resolves a
person by email.** `findUserEmail`, `findCustomerNames`, `userExists`,
`findUserRecord`, every data-rights gather and the whole export key on
`users.id`; the auth hook and the webhook key on `clerk_user_id`. The two
email-keyed queries in the tree are fixtures — `packages/db/src/scripts/
seed-e2e.ts:121` (guarded by `vendor_profiles.is_deleted = false`, and
`retireUserWhere` retires the row and the storefront in **one** transaction, so
a retired user can never present a live profile) and
`packages/preflight/src/checks/browser.ts:242` (guarded by `deleted_at is
null`). `admin.dao.ts`'s two hits are `containsInsensitive` search filters, not
joins.

**How to apply:** the invariant a future change must not break is _"email is a
label, `clerk_user_id` is the key."_ Any new read that resolves a user by email
— a support-case linker, a merge tool, an import — inherits the whole retired
row's bookings, reviews and messages to whoever next registers that address.
Insert-side, `insertUserIfAbsent`'s `onConflictDoNothing` targets
`clerk_user_id` and therefore does **not** swallow an email collision; two live
accounts on one address still raise 23505, which is the half of the guarantee
`data-rights.routes.test.ts` asserts separately. Note `email` is compared
case-sensitively, so `A@x.com` and `a@x.com` are two live rows — pre-#451 and
unchanged.

Related: [[closure-deletes-the-clerk-identity]],
[[closure-refuses-only-the-customer-side]],
[[clerk-webhook-is-now-a-money-mover]].
