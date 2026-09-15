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
