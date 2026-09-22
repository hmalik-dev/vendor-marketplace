---
name: gate-exempt-paths-misses-client-side-ambient-fetches
description: SUPERSEDED by VEN-586 — the redirect this describes is fixed; see [[ven586-terms-gate-fetch-still-403s]] for the console-noise half that survives
metadata:
  type: project
---

**SUPERSEDED 2026-09-22 (VEN-586).** `isGateExemptPath` now includes `/`,
`/search` and `/vendors/<slug>`, and `use-api.ts`'s catch handler is gated by
it before calling `router.push` — verified live with a fresh waitlisted
Mailosaur identity: all three pages held past 5s with no redirect. The
ambient fetch itself still 403s and logs console noise on those pages; that
narrower, still-open half is [[ven586-terms-gate-fetch-still-403s]]. The
redirect mechanism this entry originally described no longer exists as
written below.

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
