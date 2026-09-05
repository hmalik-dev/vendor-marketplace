---
name: availability-date-floors-are-universally-past
description: Since #409 the availability read and write floors are one day wider than the UTC day; what keeps history safe is the booked-row guard in the DAO, not the floor
metadata:
  type: project
---

`setOwnAvailability`'s write floor is `isUniversallyPastDate` and the public
`getPublicVendorAvailability` read floor is `toDateString(addDays(now, -1))`, so
a vendor can write, and a stranger can read, the calendar day **before** the
server's UTC day. The two agree by construction; keep them agreeing.

**What actually stops a vendor rewriting history is not the floor.** It is the
pair of `booked` guards in `apps/api/src/modules/availability/availability.dao.ts`
— `ne(availability.status, 'booked')` on both the delete and the upsert's
`where` — plus the service's 409 on a booked date. `completed` is _derived_ at
read time from `status === 'booked'` and never stored, so widening the floor
cannot unlock a settled cell.

**Why:** #409 widened both floors because the server was standing in for the
viewer's day: a vendor at UTC-5 blocking their own evening got a 200 that wrote
nothing, and a visitor west of UTC was told a blocked day was free. The audit
question a later diff will ask — "can the extra day reopen a settled date?" —
is answered by the DAO predicates, not by the date arithmetic.

**How to apply:** any further widening of these floors has to be checked against
those two predicates and against `setHeldDate`'s clear path (which deletes only
`booked`/`pending` rows and only when no live `bookings` row exists). A floor
change that also removes a status predicate is the dangerous shape.
See [[availability-status-literals-are-load-bearing]].
