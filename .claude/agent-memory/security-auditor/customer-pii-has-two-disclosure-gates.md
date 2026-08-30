---
name: customer-pii-has-two-disclosure-gates
description: Customer email/phone is released to vendors by two independent, differently-scoped gates — audit both whenever either moves
metadata:
  type: project
---

A customer's `lastName`/`email`/`phone` reaches a vendor through **two** gates
that do not share code and do not agree on scope:

1. `getCustomerProfileForVendor` in `apps/api/src/modules/customers/customers.service.ts`
   — gated on `findRelationship(...).accepted`, which is true if **any** request
   or booking between that vendor and that customer has ever reached an accepted
   status. It is therefore **permanent and customer-wide**: once one request is
   accepted the vendor can read the full profile forever, including after the
   relationship ends.
2. `toDetail` in `apps/api/src/modules/booking-requests/booking-requests.service.ts`
   — gated on `disclosesCustomerContact(row.status)` /
   `CONTACT_DISCLOSING_BOOKING_REQUEST_STATUSES` (currently `['accepted']`).
   Per-request and revocable in principle, though `accepted` is a terminal
   status so in practice it never revokes.

**Why:** #307 added gate 2 without touching gate 1. Both are correctly
authorised today (gate 1 derives the vendor id from the session and 404s a
stranger; gate 2 goes through `requireParticipant`, and `findRequests` returns
`[]` rather than an unfiltered query when the filter is empty). The hazard is
divergence: widening either set, or adding a status to
`CONTACT_DISCLOSING_BOOKING_REQUEST_STATUSES`, changes only one of them.

**How to apply:** any diff touching `CONTACT_DISCLOSING_BOOKING_REQUEST_STATUSES`,
`ACCEPTED_REQUEST_STATUSES`, `findRelationship`, or the `customer` object in
`bookingRequestDetailSchema` must be checked against **both** call sites, not the
one it edits. See also [[response-schemas-are-a-second-write-boundary]] — the
widened `customer` block is also a read schema over `users.email`/`users.phone`,
so loosening those columns' write validation 500s the vendor's bookings page.
