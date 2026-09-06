---
name: cancelled-by-does-not-say-which-side
description: bookings.cancelled_by records that an operator acted, never which account was suspended — copy that names the counterparty is false after an unban
metadata:
  type: project
---

`bookings.cancelled_by` (#415) has two values, `customer` and `admin`. `admin`
is written by exactly one path — `setUserBanned` in
`apps/api/src/modules/admin/admin.service.ts` — and that path unwinds bookings
where the banned user is **either** party:
`findConfirmedBookingsToUnwind(db, targetId, profile?.id, today)`.

So `cancelledBy: 'admin'` means "an operator unwound this". It does **not**
record which side was suspended, and nothing else on the row does either — the
`cancellation_reason` sentence is `'The other party's account was suspended'`,
written from the actor's point of view and equally silent about direction.

**Why this matters and is not academic:** a ban is reversible. The banned party
cannot read the screen while banned (`apps/api/src/plugins/clerk-auth.ts:122`
403s them), but after an unban they can, and any copy that turns
`cancelledBy === 'admin'` into "the _other_ account was suspended" then states
the opposite of what happened and asserts a moderation fact about a
counterparty who was never suspended. The vendor-side wording in
`apps/web/src/lib/settlement-copy.ts` ("an account involved was suspended") is
the direction-free form and is the shape to copy.

**How to apply:** treat `cancelledBy` as an actor, never as a subject. Anything
that needs to name the suspended side needs a new column recording it — do not
re-derive it from who is reading, because after an unban both parties can read.
Related: [[settlement-is-a-third-money-projection]].
