---
name: layout-gates-run-concurrently-with-the-page
description: VEN-715 moved requireRole/notFound/redirect from pages into route-group layouts above loading.tsx; Next 15 renders the page segment in parallel with its layout, so a page's reads start before the layout's gate settles
metadata:
  type: project
---

VEN-715 (2026-09-24) moved the `/bookings/[requestId]/*` and
`/vendors/[slug]/request` gates into layouts (`lib/booking-route.ts`,
`lib/vendor-route.ts`) so a 404/307/308 stays a real status under `loading.tsx`.
Next 15 builds each child segment's seed data alongside the layout, so the page
component runs **concurrently** with the layout's `requireRole`, not after it.
The layout's throw still decides the response (it is in the shell; the page is
under the Suspense boundary), so nothing the page renders reaches the visitor.

**Why it was PASS:** every page read goes through `customerToken()` (redirects
with no session) and a customer-scoped API route that authorizes itself
(not-yours = 404; `openCheckout` short-circuits an already-paid request before
Stripe). The web gate was only ever UX; the API is the boundary.

**How to apply:** a layout gate protects a page only if every read in that
page is independently authorized. Flag a page under a gated layout that reads
with a service/admin token, a public reader returning private fields, or a
side-effecting call the API does not itself refuse — it now runs for visitors
the layout will reject. Page-side "vanished between layout and page" throws
can fire for rejected visitors (error-log noise, not leakage).
Related: [[route-handlers-do-not-inherit-layout-gates]],
[[search-retired-category-redirect]].
