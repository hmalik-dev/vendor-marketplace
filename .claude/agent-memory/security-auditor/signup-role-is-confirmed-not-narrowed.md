---
name: signup-role-is-confirmed-not-narrowed
description: VEN-507 — the client supplies users.role once on POST /legal/terms/accept; normalizeRole now REFUSES anything outside customer|vendor instead of narrowing to customer, and the same route's first acceptance is a notice (continue_notice) while a new version still needs the tick
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

**The tick is now server-decided, not client-declared** (VEN-507, second pass).
`acceptTerms` refuses an explicit `accepted: false` always, echoes the version
first, then reads `termsStatusOf` and branches on **`explicitTickRequired`** =
"no acceptance of `CURRENT_TERMS_VERSION` **and** some earlier
`terms_of_service` row on file". True → `accepted !== true` is a 400 and the row
is labelled `clickwrap_checkbox`; false → the first acceptance, labelled
`continue_notice`, and the **only** branch that runs `admitVendor`. The client
cannot reach the notice label on a re-acceptance, because the flag is derived
from the database rather than from the body. One cliff to keep in view: it rests
on `findAcceptancesByUser`, capped at `MAX_ACCEPTANCES_READ = 100` — an account
with 100 newer rows would read as a first acceptance and skip the tick, which
needs ~100 published document versions to reach. `insertAcceptance`'s
`ON CONFLICT DO NOTHING` on `(user, document, version)` makes replay a no-op.

**The browser hint is address-bound and stated read-only (audited PASS
2026-09-23).** `signup-role.ts` stores `{role, email (trim+lowercase), at}`;
`/accept-terms` reads the address from the caller's own server-minted JWT
(`tokenEmail`, unverified decode, UI-only) and, on a match, shows the role with
no picker. Trust is unchanged: the server still takes `role` from the body and
enforces the invite gate. Residual, accepted: a planted hint for the victim's
own address (needs same-origin script or the device) now removes the picker
rather than preselecting it. Re-open if `tokenEmail` ever feeds an API call,
an authorization branch, or a non-`force-dynamic` page.

Related: [[terms-gate-is-a-five-state-session]], [[neon-auth-cutover-boundaries]],
[[legal-acceptance-record-is-undeletable-pii]].
