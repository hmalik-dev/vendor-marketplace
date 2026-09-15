---
name: unattached-conversation-avoids-shared-booking-mutation
description: to get a fresh customer<->vendor conversation for a messaging/case test, use "Send a message" on the vendor's storefront (an unattached thread) instead of touching the seed's one pending booking request
metadata:
  type: project
---

On VEN-412 (2026-09-15), `db:seed:e2e` left zero rows in `conversations` and
zero in `support_cases` for the lane. The seeded pending booking request
(`booking_requests`, one row, `status: pending`) has no messaging UI on its
detail page — a thread only opens once the vendor responds, which
[[e2e-seed-has-only-one-pending-booking-request]] already forbids forcing.

Instead: sign in as the E2E customer, visit `/vendors/<vendor-slug>`, click
**Send a message**. Per `packages/db/src/schema/messaging.ts`'s own comment,
this opens "an unattached thread" — a `conversations` row with
`booking_request_id: null` — entirely independent of the one seeded pending
request. Send a message, then **Report this conversation** from the thread's
header to create a real `support_cases` row (origin `in_product`, subject_type
`conversation`) via the actual report flow, reference `ORL-XXXX-XX` printed on
success.

**Why:** this exercises the real create-conversation and create-report code
paths (not a raw insert guessing at required columns) while touching zero
shared/contended fixtures — a second session can do the same thing concurrently
without colliding.

**How to apply:** for any ticket needing a fresh conversation or support case
against the E2E vendor, prefer this UI path over inventing one at the DB layer.
Note also the real table names: the case table is `support_cases` (there is no
`cases` table), and the _pending_ seeded request lives in `booking_requests`,
not `bookings` — `bookings` only has _completed/paid_ rows, useful as an
event-date fixture (see [[ticket-setup-steps-can-authorize-scoped-db-writes]]).
