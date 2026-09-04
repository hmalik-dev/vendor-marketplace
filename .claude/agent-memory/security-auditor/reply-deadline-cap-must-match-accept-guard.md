---
name: reply-deadline-cap-must-match-accept-guard
description: One instant — event date + 2 UTC days — is written in four unrelated places; if they drift, a booking request becomes live-but-unacceptable or expires while it is still someone's today
metadata:
  type: project
---

Since #401 a booking request's reply window is capped at the moment its event
date stops being anybody's today. That single instant, `event_date + 2 days` at
UTC midnight, is now expressed in **four places that share no code**:

1. `isUniversallyPastDate` (`packages/shared/src/utils/index.ts`) — the predicate
   `transitionRequest` uses to refuse an `accept`.
2. `universallyPastFrom` in the same file — derived from that predicate's
   arithmetic on purpose, and consumed by `replyDeadline`, which
   `createBookingRequest` and `seed-demo.ts` both write with.
3. `ageIfExpired` in `apps/api/src/modules/booking-requests/booking-requests.service.ts`
   — expires on `expiresAt <= now`, which has to fire at the same instant the
   accept guard starts refusing.
4. `packages/db/drizzle/0022_cap_reply_window_at_event.sql` — the backfill,
   `(event_date + 2)::timestamp AT TIME ZONE 'UTC'`, in raw SQL that no type
   checks against the TypeScript.

**Why:** the two failure modes are asymmetric and both are real. Cap _later_
than the accept guard and a row sits `pending`/`quoted` offering `Accept` and
`Send quote` on a date `transitionRequest` will refuse — the exact #401 defect.
Cap _earlier_ and a request dies while the event is still today for a vendor in
UTC-12, destroying a live negotiation the participants had no warning about. The
two-day tail is that timezone allowance, not a rounding choice, and
`replyDeadline` deliberately has **no floor**: a request sent at the edge of its
date is born with hours to live, which is honest rather than a defect.

**How to apply:** a diff touching any one of the four must be checked against
the other three, including the SQL. Verified aligned 2026-09-04. Also note the
knock-on: expiry calls `syncHeldDate`, so a shorter window releases a vendor's
calendar cell sooner — that path is safe only because `setHeldDate(…, null)`
deletes rows whose status is `booked`/`pending` and only when no `bookings` row
exists, so a vendor's own `blocked` day and any paid date survive.

Related: [[availability-status-literals-are-load-bearing]],
[[response-schemas-are-a-second-write-boundary]]
