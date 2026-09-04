---
name: role-bounce-self-loop-admin-bookings
description: FIXED — DASHBOARD_PATH_BY_ROLE.admin is now /admin, so the role bounce terminates; the invariant it broke (bounce destination must pass its own guard) still needs checking on every requireRole change
metadata:
  type: project
---

**Status: fixed.** `DASHBOARD_PATH_BY_ROLE` in
`apps/web/src/lib/current-user.ts` now reads `admin: '/admin'`, and
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

**How to apply:** whenever a diff adds or changes a `requireRole` call or an
entry in `DASHBOARD_PATH_BY_ROLE`, resolve the destination for **all three
roles** and read the guard on each destination's own route. Also check
`POST_SIGN_IN_PATH_BY_ROLE`, which is a separate map with a separate answer.

Related: [[validate-before-normalize-return-path]],
[[route-handlers-do-not-inherit-layout-gates]]
