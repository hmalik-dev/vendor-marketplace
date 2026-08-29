---
name: role-bounce-self-loop-admin-bookings
description: DASHBOARD_PATH_BY_ROLE.admin points at /bookings, which is itself requireRole('customer')-gated — the role bounce redirects to a route that bounces again
metadata:
  type: project
---

`requireRole`'s mismatch branch (`apps/web/src/lib/current-user.ts`) redirects to
`DASHBOARD_PATH_BY_ROLE[user.role]` without checking that the destination is a
route the user is actually allowed on. `admin: '/bookings'` and `/bookings` calls
`requireRole('customer')`, so an `admin` account self-loops until the browser
gives up. `/customer/profile` and `/dashboard` funnel into the same loop.

`LOOPING_PREFIXES` cannot catch this: it only knows about the auth pages, and
this loop is the _role_ bounce, not the auth bounce.

**Why:** `admin` is a real member of `USER_ROLES` in
`packages/shared/src/constants/index.ts`. It is not self-assignable
(`users.service.ts` refuses `value === 'admin'`), so admin accounts are
provisioned out of band and are easy to miss when driving flows in a browser
with only the customer and vendor e2e accounts.

**How to apply:** whenever a diff adds or changes a `requireRole` call or an
entry in `DASHBOARD_PATH_BY_ROLE`, check the destination against the guard on
that destination's own route — for all three roles, not the two that get tested.
Ticket #76 made the loop worse by carrying `returnTo` through sign-in, so an
admin who signs in from any protected route now lands in it instead of on `/`.
`POST_SIGN_IN_PATH_BY_ROLE.admin` is already `'/'`, and `/` lets an admin through
(`redirectVendorToDashboard` only redirects vendors) — that is the terminal
destination the dashboard map should agree with.

Related: [[validate-before-normalize-return-path]]
