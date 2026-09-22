---
name: ven586-terms-gate-fetch-still-403s
description: FIXED same-day — NotificationBell now takes a server-derived `gated` prop and skips its fetch entirely on gate-exempt pages; re-verified clean, ungated accounts unaffected
metadata:
  type: project
---

**FIXED 2026-09-22, same ticket.** The coordinator added `isTermsGatedForChrome()`
in `current-user.ts`, threaded a `gated` prop through `SiteHeader` into
`NotificationBell`, which now skips its `/notifications` and
`/events/stream-ticket` fetches entirely when gated AND on a gate-exempt page.
Re-verified live: 0 console errors and **zero requests** to either endpoint
(not even a 403 — the call never fires) on `/`, `/search`, and
`/vendors/e2e-test-studio`, each held 5s+, same waitlisted Mailosaur session.
Regression check: signed in as the ordinary seeded `E2E_CUSTOMER` — both
endpoints returned real `200 OK` on `/` and `/search`, confirming the skip is
scoped to gated sessions only, not a blanket removal of the bell's fetch.

VEN-586 widened `isGateExemptPath` (`apps/web/src/lib/terms-gate-paths.ts`) so a
waitlisted-but-uninvited vendor (every call answers `TERMS_REQUIRED`) no longer
gets `router.push`ed off `/`, `/search` or `/vendors/<slug>`. Verified: the
redirect genuinely stops on all three.

**But the AC also required "no 403 console noise from `/notifications` or
`/events/stream-ticket`", and that part fails.** `NotificationBell` is mounted
ambiently by the root layout and still fires its mount-time fetch to both
endpoints regardless of `isGateExemptPath` — the exemption only guards the
`router.push` branch in `use-api.ts`'s catch handler
(`if (isTermsRequired(error) && !isGateExemptPath(...)) { router.push(...) }`),
not whether the fetch happens at all. The API still legitimately answers 403
`TERMS_REQUIRED` to those calls, and the browser logs "Failed to load resource:
403" for a failed fetch/XHR regardless of any client-side catch — that log line
is not something app code can suppress after the fact, only avoid by not
firing the request in the first place (e.g. `NotificationBell` should skip its
fetch entirely when the session is gated).

**Why:** confirmed by reading the network response body directly —
`{"statusCode":403,"error":"TERMS_REQUIRED",...}` — and the console messages
consistently reproduced across `/`, `/search`, and a live storefront
(`/vendors/e2e-test-studio`), each waited 5s+. Not a timing fluke; it fires on
every page load for this session shape.

**How to apply:** when an AC bundles "stop redirecting" with "no console
noise" for the same ambient fetch, verify them as two separate assertions —
a fix to the redirect branch does not imply the fetch was suppressed. Check
the actual network response body/console log, not just the URL bar.

See also [[gate-exempt-paths-misses-client-side-ambient-fetches]] (a related,
narrower prior finding about the redirect itself, now fixed by this ticket) —
this is the surviving, distinct half of that surface.
