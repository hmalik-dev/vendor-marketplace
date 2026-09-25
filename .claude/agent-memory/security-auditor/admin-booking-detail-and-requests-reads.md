---
name: admin-booking-detail-and-requests-reads
description: VEN-399 PASS — GET /admin/bookings/:bookingId and GET /admin/requests; what keeps them sound and what would reopen them
metadata:
  type: project
---

VEN-399 audited PASS (2026-09-15). Both routes use `onRequest: adminOnly`
(`requireRoleBeforeValidation`), uuid params, enum-only filters built from
`readsAs`, and no writes (the admin list never calls `ageIfExpired`).

**Why:** the participant read ages lapsed requests and sends `request_expired`;
the console must report the same status without the side effect.

**How to apply:** reopen only if `listRequests` gains a call into
`booking-requests.service` (a write + notification from an operator browse),
if the request row adds customer email/contact (the list is name-only on
purpose; email is on the booking detail), or if a filter stops being an enum.
Related: [[admin-vendor-detail-is-a-gated-aggregate]].

VEN-743 (2026-09-24) PASS: free-text `q` on `/admin/bookings` + `/admin/payments`
(and booking id on cases) via `containsInsensitive` (bound, escaped) and the shared
`adminSearchTerm` (freeText → trim → max → empty-as-undefined). A search predicate
names `users`/`vendorProfiles`, so every count and widening scan must carry those
joins or the query errors. Web `boundedText` strips only NUL and slices pre-NFC;
the API still refuses controls/over-length after NFC — a 400, never an injection.
