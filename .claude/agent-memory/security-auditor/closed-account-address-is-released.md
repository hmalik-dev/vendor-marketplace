---
name: closed-account-address-is-released
description: CORRECTION — users_email_key is partial (WHERE deleted_at IS NULL) since #451, so closing an account gives the address back; the old "retired row locks the email out forever, opaque 500" memory was stale
metadata:
  type: project
---

Verified 2026-09-20 in `packages/db/src/schema/users.ts:124`:
`uniqueIndex(USERS_EMAIL_UNIQUE_INDEX).on(email).where(deleted_at is null)`.
A retired row is **out** of the index, so the same person can sign up again with
the same address. The earlier memory
(`retired-users-keep-their-email-in-the-unique-index`) described the
pre-#451/#462 unconditional index and is deleted — do not re-report it.

What is still true:

- The retired row keeps its `auth_user_id`, and `acceptTerms` reads
  `findUserByAuthIdIncludingRetired` and answers **401** for `deletedAt`, so a
  closed account cannot revive itself by re-accepting. A return visit needs a new
  identity.
- `pending_email` / `email_sync_failed_at` still record a live-row collision the
  auth mirror could not write (#462); that path is unchanged.

**Why it matters now:** VEN-507's accept-terms copy tells the reader "To switch,
close the account and register again" in three places plus `docs/demo.md`. That
instruction is only true because the index is partial — if anyone makes
`users_email_key` unconditional again, the product is advising an irreversible
closure (which refunds future bookings) into a permanent lockout.

**VEN-614 (audited 2026-09-23, no blocker):** retirement now scrubs the row
(`closedAccountFields`: `closed+<id>@invalid`, "Former <role>", contact nulled)
and `handAddressToWaiter` gets the pre-scrub address read under `FOR UPDATE`.
`removeOwnedObjects` cannot reach another owner: S3 `list` appends the `/`,
and ids are fixed-length uuids. The sweep ignores rows whose owning `users` row
is closed (`vendor_profiles.user_id` is NOT NULL, so the inner joins drop no
live row). Residuals, low: no backfill, and the resume branch of `closeAccount`
does not re-scrub, so pre-VEN-614 closed rows keep name/phone/email (reviews
still print "Former customer" off `deleted_at`); the object delete lists by the
route param, and `z.uuid()` accepts uppercase, so an uppercase id matches no key
and leaves the sweep to clean up. Fix is `retired.user.id`.

Related: [[email-uniqueness-is-partial-nothing-joins-by-email]],
[[closure-refuses-only-the-customer-side]],
[[legal-acceptance-record-is-undeletable-pii]].
