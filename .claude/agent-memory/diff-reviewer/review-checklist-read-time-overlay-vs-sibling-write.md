---
name: review-checklist-read-time-overlay-vs-sibling-write
description: Review checklist — when a diff adds a read-time overlay to a GET, check every sibling endpoint whose response the client stores as the same state, and check the overlay's predicate against lazy expiry
metadata:
  type: feedback
---

When a diff synthesises rows at read time in a `listX` service (deriving instead
of storing, usually for a good reason), ask two questions the diff itself never
shows:

1. **Which other endpoint returns the same list?** In this repo `PUT
/vendor/availability` returns the whole calendar and the client does
   `setEntries(saved)` (`apps/web/src/components/availability/availability-calendar.tsx:289`).
   If only the GET service grew the overlay, the first save silently erases every
   synthesised cell until a reload — the two endpoints now disagree about what
   the calendar is.
2. **Is the overlay's predicate the same one the rest of the module uses?**
   `findLiveRequestDates` filtered on `status IN (live)` only, while booking
   requests expire **lazily** (`ageIfExpired` runs on reads of the _request_
   list, not the calendar). A request a week past `expiresAt` is still
   `pending` in the table, so the overlay kept it on the calendar forever — and
   `pending` is in `LOCKED_AVAILABILITY_STATUSES`, so the vendor could not
   even block the date.

**Why:** #307 (`51150d8`) overlaid live booking requests onto the vendor's own
availability. Both defects were invisible in the diff: the PUT hunk was not in
it, and the expiry rule lives in a different module.

**How to apply:** grep the service file for every exported function returning the
same response type, not just the one the diff edited. And whenever a derived view
reads a status that some _other_ code path is responsible for advancing (lazy
expiry, cron-less sweeps), assume nobody has advanced it yet and ask what the
view shows in that state. Both are cheap to prove with a throwaway
`*.test.ts` next to the module's route test, reusing `createTestHarness` (the
Docker Postgres is usually already up) — write, run, delete.

Related: [[review-checklist-derived-src-flips-after-commit]] — same family: the
value the user sees comes from a different source than the one the test asserts.
