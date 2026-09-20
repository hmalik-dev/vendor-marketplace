---
name: unwind-resume-is-a-repeatable-endpoint
description: VEN-478 turned PUT /admin/users/:id/ban and POST .../close into resumable endpoints; the resume gate is derived from bookings, so an unresolvable booking makes the endpoint permanently re-enterable
metadata:
  type: project
---

VEN-478 replaced the "already banned" / "already closed" 409 with a **resume**:
the flag/retirement and its `user_banned` / `user_closed` intent row now commit
in one transaction, the unwind runs after, and a re-run finishes it. Outcome is
a second row, `account_unwind_finished`.

**Why:** a kill mid-unwind used to leave a banned account with no audit row and
no way to finish the refunds; the old rollback-the-flag path was worse.

**How to apply:**

- The ban resume (`admin.service.ts`, `resuming = isBanned && target.isBanned`)
  has **no pending gate** — it always 200s and always re-runs the unwind. The
  closure resume gates on `countUnwindPending(...) === 0`.
- `countUnwindPending` is derived from `findConfirmedBookingsToUnwind`, so any
  booking the unwind can never resolve — `isLegacyDestinationPayout` (counted
  `refundsFailed`, never cancelled), or a permanently unrefundable intent —
  pins it above zero **for ever**. That permanently disables closure's 409 and
  re-enters `deleteAndConfirm`, which then writes `identityDeleted: false` into
  the immutable log for an identity the first run really did delete.
- Double refund is not the exposure here: `findRefund` subtracts what already
  came back, the key `<prefix>:marked:<bookingId>` is stable per path, and
  Stripe caps a refund at the charge's remaining amount — so the deliberately
  distinct `ban-refund:` / `close-refund:` / `delete-refund:` prefixes cannot
  pay twice. Do not re-report it.
- Both new transactions contain only Postgres work; no Stripe call sits inside
  `OPERATOR_RETIREMENT_LOCK`. Keep it that way.

See [[account-unwind-full-refund-is-the-ban-argument]],
[[refund-idempotency-key-is-parameter-sensitive]],
[[legacy-destination-rows-guarded-in-one-place]],
[[admin-action-log-is-trigger-immutable]].
