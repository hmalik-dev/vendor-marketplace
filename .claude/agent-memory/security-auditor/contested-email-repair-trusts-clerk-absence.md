---
name: contested-email-repair-trusts-clerk-absence
description: VEN-386 user.updated collision repair retires a holder Clerk omits and hands released addresses to pending_email waiters without asking Clerk
metadata:
  type: project
---

VEN-386: a `users_email_key` collision on `user.updated` makes `releaseStaleHolder` (clerk.service.ts) ask
`getUserList({userId:[holder]})`. Absent means the full `applyUserDeleted` unwind with refunds, and moved means Clerk's primary is mirrored onto the holder.
Seeded `seed_mkt_` rows are skipped by `isClerkIdentity`. A Clerk error keeps the claimant diverged.

**Why it holds against an attacker:** the holder's fate depends only on Clerk's answer about the holder, never on the
claimant's payload. Clerk addresses are instance-unique, so a claimant cannot hold a live identity's address.
The `err` goes through the #445 serializer, and no address is logged.

**Residual (reported low, 2026-09-15):** `handAddressToWaiter` (users.dao.ts) hands an address to the
earliest `email_sync_failed_at` waiter without asking Clerk. That column is coalesced to the first failure of any
address, so with two waiters the stale one wins. Its notifications then reach the real owner's inbox, and the
real owner stays diverged, which suppresses their email.

**How to apply:** re-audit if absence-as-deletion gains a second caller or the handoff stops being best-effort.
A DB paired with another instance's CLERK_SECRET_KEY, such as a restore drill, retires accounts on a single collision.
