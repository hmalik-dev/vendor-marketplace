---
name: role-bounce-self-loop-admin-bookings
description: FIXED — DASHBOARD_PATH_BY_ROLE.admin is now /admin, so the role bounce terminates; the maps moved to lib/role-routes.ts, where roleCanReach is a redirect hint and never a gate
metadata:
  type: project
---

**Status: fixed.** `DASHBOARD_PATH_BY_ROLE` — since #410 in
`apps/web/src/lib/role-routes.ts`, not `current-user.ts` — now reads
`admin: '/admin'`, and
`apps/web/src/app/admin/layout.tsx` gates that route with
`requireRole('admin')` — a role that passes its own destination's guard, so the
bounce lands and stops. Re-verified 2026-09-04 against `#401`, which moved
`/vendors/[slug]/request` from a hand-rolled `role === 'vendor'` check to
`requireRole('customer')` and therefore started routing admins through this
branch for the first time. Do not re-report the `/bookings` loop.

**The invariant is still live.** `requireRole`'s mismatch branch redirects to
`DASHBOARD_PATH_BY_ROLE[user.role]` and never checks that the destination is a
route that role is allowed on. It was `admin: '/bookings'`, and `/bookings` is
`requireRole('customer')`-gated, so an admin self-looped until the browser gave
up. `LOOPING_PREFIXES` in `return-path.ts` cannot catch this: it only knows the
auth pages, and this is the _role_ bounce, not the auth bounce.

**Why it stays easy to reintroduce:** `admin` is a real member of `USER_ROLES`
and is not self-assignable (`users.service.ts` refuses `value === 'admin'`), so
admin accounts are provisioned out of band and are easy to miss when driving
flows in a browser with only the customer and vendor e2e accounts. Any page that
narrows from `requireCurrentUser` + a hand check to `requireRole` newly exposes
the admin branch.

**`roleCanReach` / `ROLE_ROUTE_RULES` are a redirect hint, never a gate.** #410
added them beside the two maps so `/after-sign-in` can _decide_ a destination
instead of discovering it by bouncing. Audited 2026-09-05: the only non-test
caller is `postSignInPath`, and `requireRole`, `redirectVendorToDashboard` and
every API check are untouched. A rule missing or wrong costs a wasted hop or the
#410 blank page — it can never admit anyone anywhere. **If a future diff ever
consults this table to decide whether to render or return data, that is the
finding**, because it is a regex list maintained by hand and the real answer
lives in the local `users.role` read.

**`DASHBOARD_LABEL_BY_ROLE` is a fourth table and is purely cosmetic.** Added
2026-09-06 (#372) beside the other three; `SiteHeader` resolves it once as
`DASHBOARD_LABEL_BY_ROLE[role ?? 'customer']` and hands the same string to the
bar and to `SignedInDrawer`. `role` comes from `readRoleForChrome`, which
degrades to `null` on an unreadable record, so the word can be wrong — it can
never be a grant. Every reader of that link goes through
`app/dashboard/route.ts`, which re-reads `getCurrentUser()` server-side and
redirects a signed-out caller to sign-in; the destinations
(`/vendor/dashboard`, `/bookings`, `/admin`) each carry their own
`requireRole`. Audited and confirmed cosmetic — do not re-report the `null →
'Bookings'` fallback.

**How to apply:** whenever a diff adds or changes a `requireRole` call or an
entry in `DASHBOARD_PATH_BY_ROLE`, resolve the destination for **all three
roles** and read the guard on each destination's own route. Also check
`POST_SIGN_IN_PATH_BY_ROLE`, which is a separate map with a separate answer, and
whether `ROLE_ROUTE_RULES` grew a matching rule — `role-routes.guard.test.ts`
greps the gates out of `app/` and fails on drift in both directions, but it only
sees literal `requireRole('<role>')` and `redirectVendorToDashboard(` under
`app/`, so an inline `user.role !== 'admin'` check (as in
`app/admin/vendors/export/route.ts`) is invisible to it.

Related: [[validate-before-normalize-return-path]],
[[route-handlers-do-not-inherit-layout-gates]]
