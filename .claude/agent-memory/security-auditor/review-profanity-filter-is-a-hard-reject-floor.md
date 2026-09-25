---
name: review-profanity-filter-is-a-hard-reject-floor
description: Reviews module boundaries — the blocked-word floor (hard reject by design, \w* over-match now FIXED), and VEN-421's eligibility widening plus the review_tombstones finality record
metadata:
  type: project
---

`BLOCKED_PATTERN` in `apps/api/src/modules/reviews/reviews.service.ts` refuses
the whole write with a 400 rather than publishing-then-flagging.

**Why:** #12 was asked for "profanity filtered" reviews and there is nowhere to
queue to — moderation is #15. Trivially bypassable (`f u c k`, homoglyphs,
misspellings) **on purpose**; that is not a finding. The `\w*` suffix that
rejected "spicy" / "retardant" / "shitake" is **FIXED** — every inflection is
now written out and nothing matches by prefix. Do not re-report either half.

**Eligibility (VEN-421):** `isBookingReviewable` = `completed`, or `confirmed`
with `isUniversallyPastDate(eventDate)`. Audited clean: no endpoint writes
`bookings.event_date` (it is copied from the request, whose schema refines away
a universally-past date), so the reviewable state cannot be arranged. The
consequence that _is_ new: `cancelBooking` only accepts `confirmed`, so a review
can now be filed and the booking then cancelled at the 50% late tier — the
review keeps counting in `publicVendorReviews`.

**14-day window (VEN-747), audited clean:** `isBookingReviewable` =
`hasBookingHappened` + `isReviewWindowOpen`; `createReview` still 404s a
non-participant before any status-revealing 400. `GET /v1/bookings` left-joins
`reviews`/`review_tombstones` on `(booking, reviewerId = user.id)`, so
`reviewDeadline` reflects only the reader's own row, never the other party's
private `vendor_to_customer` review. Keep that join reader-keyed; a join on
booking alone would leak the counterpart's review existence.

**`review_tombstones` (booking_id, reviewer_id) finality:** the re-review race
is closed by statement _order_, not by a lock — `createReview` reads `reviews`
then the tombstone, and `deleteReviewAndRecalculate` commits the delete and the
tombstone insert in one transaction, so a reader that sees the review gone must
see the tombstone. Keep that order if either side is touched, or re-check the
tombstone inside `insertReviewAndRecalculate`'s transaction. Nothing deletes a
tombstone and it is absent from the hand-enumerated DSAR
([[data-rights-export-is-hand-enumerated]]).
