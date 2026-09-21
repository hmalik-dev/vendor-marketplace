---
name: availability-status-literals-are-load-bearing
description: The double-booking guards compare availability.status to the literal 'booked'; redefining which status a lifecycle writes silently disarms them
metadata:
  type: project
---

`availability.status` is a cross-module contract enforced only by string
literals, with no DB constraint behind it — `availability_vendor_date_key` is
unique on `(vendor_id, date)`.

**VEN-482 (audited clean) put the date rule in the database**: partial unique
indexes `booking_requests_accepted_date_key` (status = 'accepted') and
`bookings_confirmed_date_key` (status = 'confirmed'), both on
`(vendor_id, event_date)`. Only the accept path maps them —
`isAcceptedDateTaken` → the same generic 409 as `hasRivalAcceptanceOn`. The
confirmed-date index is **unmapped on the money path**: `confirmBooking`'s
`onConflictDoNothing` targets `bookings.request_id` only, so a date collision
there rolls the whole transaction back into an opaque 500 while Stripe has the
charge and redelivers for three days. Unreachable only because two requests
cannot both be `accepted` on one date; anything that changes that (a direct
booking writer, a status whose meaning moves) turns it into money captured with
no booking row.

The guards that do stop it both test the literal `'booked'`:

- `createBookingRequest` — refuses a new request when the date reads `booked`
- the `accept` branch of `prepareTransition` — refuses the accept when the date
  reads `booked`
- `setOwnAvailability` — refuses to let a vendor edit a `booked` date

**Why:** #307 changed the status an accept writes from `pending` to `booked` and
shipped no data migration. Every row written by the old `holdDate` stays
`pending`, and because `accepted` is a terminal status nothing ever recomputes
it — so on those dates all three guards are disarmed at once and the date can be
double-booked. The same shape recurs any time a status's meaning is redefined.

`syncHeldDate`'s clear path also `DELETE`s any row whose status is `booked` or
`pending` for that vendor+date, regardless of what wrote it. The code it replaced
deliberately refused to touch `booked` ("`booked` belongs to #10"). Unreachable
today because creation 409s on a `booked` date, but live the moment the payments
module writes its own `booked` rows.

**How to apply:** treat any change to what a lifecycle writes into
`availability.status` as a migration, not a code change. Grep for the literal
before approving, and check whether a terminal request status means the stale
rows can ever be recomputed.
