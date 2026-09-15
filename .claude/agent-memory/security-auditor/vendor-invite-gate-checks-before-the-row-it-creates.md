---
name: vendor-invite-gate-checks-before-the-row-it-creates
description: VEN-406 vendor invite gate in acceptTerms decides on the Clerk snapshot, but insertUserIfAbsent can hand back the webhook's row with a different role; waitlist POST trusts body email
metadata:
  type: project
---

VEN-406 review (2026-09-15): `assertVendorMayJoin` in `acceptTerms`' no-row path judges `normalizeRole(snapshot.roleHint)`, then `syncUserFromClerk` -> `insertUserIfAbsent` returns the **held** row on conflict. A `user.created` webhook landing in the window (it spans the Clerk `getUser` round trip) supplies `role='vendor'` while the snapshot, flipped via client-writable `unsafeMetadata`, said customer. Revoke-vs-accept also races (no lock on the invite row).

**Why:** a gate must decide on the row it commits, inside the transaction that commits it.
**How to apply:** if re-reviewed, check the gate runs on `user.role`/`user.email` after the sync, inside the tx, ideally with the invite row locked. `POST /vendor-applications` trusts the body email with ON CONFLICT DO NOTHING, so a stranger can squat a real business's address on the waitlist. Rendering (React, no raw HTML), admin guards (`requireRoleBeforeValidation`), invite email escaping and the E2E seed invite were clean. Related: [[sign-up-role-is-client-written-server-narrowed]], [[idempotency-guards-orphan-side-effects]].
