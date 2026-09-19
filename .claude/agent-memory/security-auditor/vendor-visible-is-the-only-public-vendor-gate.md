---
name: vendor-visible-is-the-only-public-vendor-gate
description: VENDOR_VISIBLE (published + not retired + owner alive + owner not banned, VEN-431) is the single gate on every anonymous vendor read; the checkout path carries no vendor predicate at all and rests on the ban unwind
metadata:
  type: project
---

`apps/api/src/modules/vendors/vendor-visibility.ts` exports the one predicate
every public vendor read carries. As of VEN-431 it is four terms: `is_published`,
`NOT is_deleted`, `OWNER_NOT_DELETED`, `OWNER_NOT_BANNED`. Audited reach —
search, `/vendors/availability/nearby`, `/vendors/:slug`, that slug's
availability and reviews (both via `findPublicVendorBySlug`), booking creation
(`findBookableVendorById`), `openConversation` and the thread list, and the web
sitemap (it walks `/vendors`). No public reader uses its own spelling.

**Why:** the ban's own unpublish is a one-shot write. Anything that flips
`is_published` back — a publish already in flight, an operator republish — used
to make a suspended owner searchable and bookable again. The authority is now
read on every request, and `updateVendorProfileById`'s `requireUnheld` option
puts both `moderation_hold = false` and `OWNER_NOT_BANNED` in the `WHERE` of the
publishing statement, so the compare-and-set is what guarantees it.

**How to apply:** two things this predicate does _not_ cover.

- **Money paths have no vendor predicate.** `payments.dao.ts` joins
  `vendor_profiles` off the booking request with no visibility or ban term at
  all. A customer holding an accepted, unpaid request from a now-banned vendor
  is stopped only because the ban unwind declines that request (a request with a
  booking behind it is spared, and only a succeeded PaymentIntent writes one).
  The payout side is guarded differently again, by `eq(users.isBanned, false)`
  inside `payouts.dao.ts`. Three different mechanisms, no shared code — widening
  any of them does not widen the others.
- **Both `NOT EXISTS` terms correlate on the literal name `vendor_profiles`.**
  A consumer that aliases the table gets a Postgres parse error, not a silently
  uncorrelated subquery, so this fails loud. Contrast
  [[messaging-tenancy-is-two-statements]], where the correlation fails _quiet_.

Related: [[moderation-levers-are-undoable-by-their-subject]],
[[account-unwind-full-refund-is-the-ban-argument]],
[[unwind-decline-spares-requests-with-a-booking]].
