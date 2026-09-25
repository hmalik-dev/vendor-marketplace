---
name: e2e-seed-has-no-canceled-booking-or-booking-case
description: The E2E seed's ~919 bookings include no CANCELED row, and the single seeded case has no booking attached — several admin dialogs tied to those states are only reachable via a fresh mutation, not the standing seed
metadata:
  type: project
---

Checked on VEN-737 (2026-09-25): `/admin/bookings?status=cancelled` returns
"0 total" against the full seed (919 bookings, statuses seen are only
CONFIRMED/COMPLETED). The one seeded case (`ORL-E2EE-22`, subject "Something
else") shows `Booking: —` on `/admin/cases`, so its detail page only offers
"Mark resolved" — the booking-dispute actions "Resolve for the vendor" /
"Refund and cancel" (and their shared footer copy "Neither position can be
undone here. A resolved case reopens only as a new case on the same
booking.") never render for it.

**Why:** those dialogs and the canceled-row admin.bookings label only exist
for booking states this seed doesn't produce; seeing them needs a
booking-attached case or an actually-canceled booking, both of which require
a state-changing action the read-only rule in this ticket type forbids.

**How to apply:** report booking-dispute dialogs and "Canceled" / "Canceled
by" booking-list labels as NOT-REACHABLE against the standing seed rather
than searching further pages for them — 62 pages of the bookings table are
still all CONFIRMED/COMPLETED. Pairs with [[e2e-seed-has-only-one-pending-booking-request]] and [[hand-seeded-case-rows-need-a-valid-reference-and-terms-gates]].
