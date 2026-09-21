---
name: signup-role-is-confirmed-not-narrowed
description: VEN-507 — the client supplies users.role once on POST /legal/terms/accept; normalizeRole now REFUSES anything outside customer|vendor instead of narrowing to customer, and that throw is the only writer of the column
metadata:
  type: project
---

`normalizeRole` (`apps/api/src/modules/users/users.service.ts:49`) used to narrow
an unrecognised value to `customer`. Since VEN-507 it **throws**
`validationFailed`, and it sits inside `toNewUserRow` → `syncUserFromAuth`, the
single writer of `users.role`. `admin` is unreachable from the wire three times
over: `acceptTermsSchema.role` is `signUpRoleSchema` (`customer|vendor`), the
service calls `normalizeRole(input.role)` before the identity read, and
`createNeonUserLoader` pins `roleHint: undefined` so no token claim can stand in.
`updateUserSchema` carries no `role`; promotion is `/admin` only.

**Why:** a missing hint (verified on another device, blocked storage) silently
fixed an invited vendor as a customer for good. The account screen now confirms
the role and the server stores what it submits.

**How to apply:**

- `syncUserFromAuth` is the chokepoint — a **new** caller passing an unvalidated
  `roleHint` now gets a 400, not a customer row. Today only `acceptTerms` (role
  pre-validated) and `test-server.ts` call it; there is no `user.created` webhook
  any more (`auth-sync.service.ts` creates nothing).
- The role in the body is **ignored** when a `users` row already exists, so the
  column is write-once. Any new path that sets `role` on an existing row breaks
  the invariant every guard reads.
- `admitVendor` still runs inside the creating transaction on `row.role`/
  `row.email` (the row as inserted, not the choice), so a race that loses the
  insert reports the winner's role — see
  [[vendor-invite-gate-checks-before-the-row-it-creates]].
- `GET /legal/terms` now answers `account:{exists,role}` and `suggestedRole`
  (`vendor` iff the caller's own verified address holds an unused invite). Both
  are keyed on the caller's token, and `neon-auth.ts` refuses
  `emailVerified !== true`, so neither enumerates anyone else. The page is
  `force-dynamic` — keep it that way, it now renders per-account data.

Related: [[terms-gate-is-a-five-state-session]], [[neon-auth-cutover-boundaries]].
