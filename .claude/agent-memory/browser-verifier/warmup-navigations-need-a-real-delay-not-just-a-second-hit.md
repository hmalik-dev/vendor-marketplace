---
name: warmup-navigations-need-a-real-delay-not-just-a-second-hit
description: Two back-to-back page.goto('/') warm-ups with no wait between them still left a fresh storageState context reading signed-out on the next protected navigation — add ~1s waits between warm-up hits
metadata:
  type: feedback
---

On lane VEN-399, a scratch Playwright script did `context = browser.newContext({
storageState: '.auth/customer.json' })`, then `page.goto('/')` twice in a row
with `waitUntil: 'load'` and no delay between them, then immediately navigated
to `/admin/bookings/:id` and `/admin/requests` (both under `requireRole('admin')`).
Both came back at `/sign-in?returnTo=...` — read as "customer denied by bouncing
to sign-in", which would have been a **false** finding: it should redirect to
the customer's own dashboard (`requireRole` throws `DASHBOARD_PATH_BY_ROLE`, not
sign-in, for a signed-in non-admin — see the comment in
`apps/web/src/app/admin/layout.tsx`).

Re-running the identical script but with **~1.2s waits inserted between each
`goto('/')`** made every subsequent protected navigation resolve correctly:
customer → `/bookings`, vendor → `/vendor/dashboard`, both with `aria-current`
etc. all readable normally afterward.

**Why:** consistent with [[admin-storage-state-needs-public-warmup-before-protected-route]]
and #321's handshake mechanic — the fix there was "hit `/` first", but two
`goto()` calls issued back-to-back apparently outrun the
`/v1/client/handshake` round trip that actually settles the session
server-side. The warm-up hit has to be given time to land, not just be counted.

**How to apply:** when scripting a role check outside the MCP browser (per
[[playwright-mcp-single-context-scratch-script]]), put a real `setTimeout`
delay (~1-1.5s) after each warm-up `goto`, not just a second `goto`. If a
signed-in role's session reads as fully signed-out (redirected to `/sign-in`,
not to its own home) on a route it should be denied by role rather than by
auth, suspect this timing gap before reporting a permission defect — re-run
with delays and see if the redirect target changes.
