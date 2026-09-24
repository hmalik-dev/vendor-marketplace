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
live row). Backfill exists after all: migration 0089 tombstones pre-VEN-614
`users` rows (the earlier "no backfill" note was wrong). Residual, low: the object delete lists by the
route param, and `z.uuid()` accepts uppercase, so an uppercase id matches no key
and leaves the sweep to clean up. Fix is `retired.user.id`.

**VEN-672 (audited 2026-09-23, PASS):** retirement also tombstones
`email_deliveries.recipient_email` (user_id NOT NULL, so all rows reached),
`support_cases.sender_email` by `sender_user_id`, and nulls
`vendor_profiles.address`; 0093 backfills them idempotently. Still holding a closed
person's address, all low: `vendor_invites.email` / `vendor_applications.email`
(console invite list; scrubbing touches the invite gate, so product call), signed-out
support cases (`sender_user_id` null, found only by address), and an in-flight
notification send whose `recordDelivery` inserts the pre-closure address after the
scrub commits (one Resend round trip).

**VEN-687 (audited 2026-09-24, PASS):** retirement also nulls `bio`/`tagline`,
puts a placeholder in `booking_requests.event_location/custom_details` and
`bookings.event_location` for **either** party (so a vendor closure rewrites a live
customer's own record and DSAR export: this is by design, don't re-raise), nulls
`vendor_applications` name/city/message by address, and replaces `support_cases.message`
(open complaints included). 0097 backfills everything except applications. Still left, low:
`quote_note`, `cancellation_reason`, `dispute_reason`, message bodies; a
`confirmBooking` waiting on the users `FOR UPDATE` inserts the request's pre-scrub
location once closure commits (input built before the tx).

Related: [[email-uniqueness-is-partial-nothing-joins-by-email]],
[[closure-refuses-only-the-customer-side]],
[[legal-acceptance-record-is-undeletable-pii]].
