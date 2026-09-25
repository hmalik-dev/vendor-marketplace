---
name: availability-calendar-blocks-selecting-pending-booked-dates
description: /vendor/availability's calendar refuses to let you select a pending-request or booked date at all, so the PUT 409 refusal copy is unreachable through normal clicks/drags
metadata:
  type: project
---

On lane VEN-753 (2026-09-25), the vendor availability calendar
(`apps/web/src/app/vendor/availability`) actively prevents the two 409 cases
the API can return: clicking a single "Pending request" day (dashed
aria-label) does not PUT anything — it `router.push`es to `/vendor/dashboard`
instead (no non-GET network request fires). Drag-selecting a range that spans
a pending date silently drops that day from the selection (`Nov 8 — 10` became
"2 days" when Nov 9 was pending, not 3). The same DB-backed seed had zero
`status: 'booked'` availability rows (`GET /v1/vendor/availability` returned
only the one pending row), so the "already booked" case has no live fixture
either.

**Why:** the frontend's own guard makes both refusal toasts effectively
unreachable via mouse interaction by design — you cannot even attempt the
blocked action through the UI, so a ticket asking to "try to block" one of
these dates will not produce a toast no matter how it's driven.

**How to apply:** verify the 409 message text by calling the API directly
(`fetch('/api/session/token')` for the bearer, `PUT
http://localhost:<api-port>/v1/vendor/availability` with body `{ entries:
[{date, status:'blocked'}] }` — note the body is `{entries: [...]}`, not a
bare array) and by reading/running the route test
(`apps/api/src/modules/availability/availability.routes.test.ts`, look for
"refuses to block a date a pending request holds" / "refuses to change a date
held by a confirmed booking"). Report the calendar-side unreachability as the
UI evidence, not a failure to find the toast.
