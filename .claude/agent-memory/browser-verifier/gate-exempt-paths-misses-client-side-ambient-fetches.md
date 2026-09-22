---
name: gate-exempt-paths-misses-client-side-ambient-fetches
description: VEN-512's terms-required gate bounces a waitlisted session off home/search/storefront within a few seconds via NotificationBell's ambient fetch, not just protected routes
metadata:
  type: project
---

`apps/web/src/lib/use-api.ts:128-129` (`useApi`'s catch handler) redirects to
`/accept-terms` on **any** client-side `TERMS_REQUIRED` response, gated only
by `isGateExemptPath(window.location.pathname)`
(`apps/web/src/lib/terms-gate-paths.ts:84-91` — legal pages, `/support`,
`/accept-terms`, vendor-apply/details/waitlist only). `NotificationBell` is
mounted by the root layout on every non-admin route and fetches
`/notifications` + `/events/stream-ticket` on mount — both 403
`TERMS_REQUIRED` for a signed-in, no-`users`-row session. So `/`, `/search`
and a vendor storefront (`/vendors/[slug]`) all **look** fine on first paint
(server-rendered, and `/` alone also fails server-side via
`redirectVendorToDashboard`) but get client-side redirected to
`/accept-terms` → `/waitlist` ~2-3s after mount once that ambient fetch
resolves.

**Why:** found 2026-09-22 verifying VEN-584/VEN-512's AC18 ("Public pages
(home, search, storefronts) stay viewable" for a waitlisted signed-in
session). A first read of `/search` and a storefront right after
`browser_navigate` reported them as staying viewable — a false negative from
reading before the delayed client redirect fired. Re-checked with a 3s
`browser_wait_for` and both moved to `/waitlist`.

**How to apply:** never trust a public-page "stays viewable" check for a
signed-in session on the URL alone immediately after navigation — wait
several seconds (or watch for the ambient `/notifications` /
`/events/stream-ticket` 403 in the console) before asserting the page held.
This is a real, reproducible defect against AC18's literal claim, not a
timing artifact to explain away — the destination genuinely changes.
