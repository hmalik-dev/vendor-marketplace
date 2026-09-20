---
name: vendor-invite-gate-checks-before-the-row-it-creates
description: the vendor invite gate decides on a Clerk/Neon snapshot before the row it commits; VEN-441 added hasLiveAccount to all three entry points — where each one runs (tx or not) is the thing to re-check
metadata:
  type: project
---

> **Clerk is retired** (VEN-447/448/449 moved auth to Neon Auth). Clerk names below describe the pre-cutover code and are historical; do not act on them as live.

VEN-406 review (2026-09-15): `assertVendorMayJoin` in `acceptTerms`' no-row path
judges `normalizeRole(snapshot.roleHint)`, then `syncUserFromClerk` ->
`insertUserIfAbsent` returns the **held** row on conflict. A `user.created`
webhook landing in the window supplies `role='vendor'` while the snapshot, flipped
via client-writable metadata, said customer. Revoke-vs-accept also races.

**Why:** a gate must decide on the row it commits, inside the transaction that
commits it.

VEN-441 (2026-09-19) added `hasLiveAccount(db, email)` — `lower(users.email)`,
`deleted_at is null` — at **three** entry points, and they are not uniform:
`decideVendorApplication` runs it on `tx` after `lockApplication`;
`createVendorInvite` runs it on `deps.db` **before** its transaction; the public
`POST /vendor-applications` runs it on `db` with no lock. Both unlocked ones are
consequence-free today only because a `users` row implies terms already accepted,
so a stray invite is inert — **that is the invariant to re-check**, not the race.

Disclosure shape, reviewed clean: signed-in callers have their body email replaced
by the session address and `neon-auth.ts:113` refuses a token with
`emailVerified !== true`, so the 409 only ever speaks about the caller's own
address; signed-out callers get the uniform `{received:true}` and no row. The
residual channel is **timing** — the has-account branch skips `findInviteByEmail`
and the insert — bounded by 6 req/hour/IP.

**How to apply:** if re-reviewed, check the acceptance gate still reads
`user.role`/`user.email` after the sync, inside the tx. `upsertApplication` still
trusts a signed-out body email with `ON CONFLICT DO NOTHING`, so an address with
no account is squattable on the waitlist (only `verified` session writes overwrite).
`status_before_invite` goes stale after a decline-then-revoke but self-corrects on
the next invite. Rendering (React, no raw HTML), admin guards
(`requireRoleBeforeValidation`), invite email escaping were clean again.
Related: [[sign-up-role-is-client-written-server-narrowed]],
[[email-uniqueness-is-partial-nothing-joins-by-email]],
[[idempotency-guards-orphan-side-effects]].
