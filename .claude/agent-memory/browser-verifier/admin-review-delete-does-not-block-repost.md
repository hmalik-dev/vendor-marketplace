---
name: admin-review-delete-does-not-block-repost
description: deleteReviewAndRecalculate hard-deletes the reviews row, so the same reviewer can post a fresh review on the same booking after an admin deletion — confirmed live on lane hunt-prelaunch, 2026-09-18
metadata:
  type: project
---

`createReview`'s duplicate check (`reviews.service.ts`) and the storefront's
`viewer.canReview` flag (`findUnreviewedCompletedBooking`, `reviews.dao.ts`)
both key off whether a `reviews` row currently exists for
`(booking_id, reviewer_id)`. `deleteReviewAndRecalculate` (used by
`DELETE /admin/reviews/:reviewId`) hard-deletes that row rather than
soft-deleting or tombstoning it. There is no separate "this booking has been
reviewed, ever" fact — existence of the row _is_ the fact.

**Confirmed live** (E2E customer `d74a49d0-…`, vendor `e2e-test-studio`,
booking `ced9422f-…`): admin deleted the seeded review through
`/admin/reviews` (console button, not just the API) → vendor's
`avg_rating`/`review_count` correctly dropped to `0`/`0` and it left
`/vendors/e2e-test-studio` and the reviews API. Signing back in as the same
customer then showed `viewer.canReview: true` for that booking, and
`POST /bookings/:bookingId/reviews` with the **original review's own
content** returned `201`, restored the vendor's rating to `5`/`1`, and wrote
a fresh `new_review` notification row to the vendor. A second repost attempt
right after correctly 409s (the row exists again) — so the guarantee is "one
review at a time," not "one review ever," and a customer whose review an
admin removed for cause can simply repost it unchanged.

**Why it matters:** if the product intends "an admin's deletion is
permanent, this reviewer never reviews this booking again," that needs a
tombstone (e.g. a `deleted_reviews` row, or a nullable soft-delete + a
distinct `NOT EXISTS` check that also considers the tombstone) — the current
schema cannot express "reviewed and then struck" separately from "never
reviewed."

**How to apply:** any future ticket touching `reviews.dao.ts`'s delete path,
`findUnreviewedCompletedBooking`, or the admin moderation console should
treat this as a known gap, not re-discover it from scratch. If a ticket
claims to fix "permanent" deletion, verify with this exact repro (delete via
console, repost via API, check `viewer.canReview` and the notifications
table) rather than trusting the 204 alone.
