---
name: availability-status-literals-are-load-bearing
description: The double-booking guards compare availability.status to the literal 'booked'; redefining which status a lifecycle writes silently disarms them
metadata:
  type: project
---

`availability.status` is a cross-module contract enforced only by string
literals, with no DB constraint behind it — `availability_vendor_date_key` is
unique on `(vendor_id, date)` and nothing stops two `accepted` booking requests
on one date.

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
