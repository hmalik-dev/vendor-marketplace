---
name: canbook-is-chrome-not-a-gate
description: BookingRail's canBook prop hides the two vendor-profile CTAs by role, but the refusal lives in three independent server checks — do not treat the prop as the control
metadata:
  type: project
---

`BookingRail`'s required `canBook` prop (added #412,
`apps/web/src/components/vendors/profile/booking-rail.tsx`) hides
`Request booking` and `Send a message` for a vendor or an admin. It is
**presentation**. Three server checks are the actual refusal and each was
verified independently:

- `apps/api/src/modules/booking-requests/booking-requests.routes.ts` —
  `POST /booking-requests` is `preHandler: requireRole('customer')`.
- `apps/api/src/modules/messaging/messaging.routes.ts` — `POST /conversations`
  is `preHandler: requireRole('customer')` (deliberately narrowed from
  `requireAuth` in #402).
- `apps/web/src/app/vendors/[slug]/request/page.tsx` — the direct URL calls
  `requireRole('customer')` and bounces every other role to its own dashboard
  (#401).

**Why:** the page feeds `canBook` from `readRoleForChrome()`, which degrades to
`null` — the _signed-out_, most-permissive answer — whenever the identity read
fails. That is correct only because it decides nothing.

**How to apply:** a change that makes `canBook` (or any `readRoleForChrome`
result) the reason something is allowed rather than the reason it is drawn is
the defect. Never delete one of the three server checks on the grounds that the
UI already hides the control.

Related: [[route-handlers-do-not-inherit-layout-gates]],
[[identity-read-is-cached-and-route-dynamism-is-inherited]].
