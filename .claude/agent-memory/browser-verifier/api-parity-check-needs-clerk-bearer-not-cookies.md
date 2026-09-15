---
name: api-parity-check-needs-clerk-bearer-not-cookies
description: comparing a rendered page to its API response needs a Clerk bearer token pulled from window.Clerk.session.getToken(); a same-cookie fetch to the API's own port 401s
metadata:
  type: feedback
---

The API runs on a different port than the web app (e.g. 4029 vs 3029). A
`fetch(apiUrl, { credentials: 'include' })` from a page carrying the web app's
Clerk session cookies still 401s with `UNAUTHORIZED` — the API expects a Clerk
JWT in `Authorization: Bearer`, not the browser's session cookie, and it isn't
same-origin anyway.

**Why:** the web app's SSR/RSC layer calls the API server-side with its own
token exchange; that never appears as a browser network request, so there is
nothing to read off the Network panel for a client-side parity check.

**How to apply:** after loading the page (and after warm-up), run
`await page.evaluate(async () => window.Clerk.session.getToken())` to get a
short-lived JWT, then pass it as `Authorization: Bearer <token>` in a
`fetch()` run inside `page.evaluate` against the API's own origin/port. This
reliably reproduces exactly what the ticket calls "GET /admin/bookings/:id"
or similar, for both admin and customer identities.
