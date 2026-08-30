---
name: review-checklist-seeded-rows-vs-the-production-writer
description: Review checklist — a fabricating seed must set every column the real writer sets at that lifecycle point; diff the seed's row against the service that would have produced it, column for column
metadata:
  type: feedback
---

When a diff adds or edits a seed that fabricates domain rows (`seed-demo.ts`,
`seed-marketing.ts`, `seed-e2e.ts`), do not read the seed on its own terms. Open
the **service that writes that row in production** and compare the column sets.
A seed that sets a column only where it "looks needed" produces rows no code
path could ever have created, and the UI then renders its null branch for ever.

**Why:** #14's `seed-demo.ts` set `final_price_cents` only on requests that went
on to become bookings, and `expires_at` only on `pending` ones.
`createBookingRequest` sets **both at creation, for every request** —
`finalPriceCents: servicePackage?.priceCents ?? null` and
`expiresAt: addDays(now, BOOKING_REQUEST_EXPIRY_DAYS)`. Consequences, all
silent: `request-row.tsx` renders `'quote needed'` and `'—'` for a request the
seed marked `quoted`; `booking-entries.ts` renders `'no price agreed'` for the
accepted row carrying a Pay CTA; `quote-review.tsx` drops the countdown; and
`resolveAction` lets a vendor `quote` a package request the API refuses with
"already priced by its package". `.claude/rules/db-schema.md` already records
this exact shape as #317 — a seed is the second place it recurs.

**How to apply:**

- For each table the seed writes, grep the API for the insert that owns it, and
  diff the two `values` objects field by field. Ask of every field the seed
  omits or nulls: _what renders when this is null?_
- Timestamps are the other half. Check the sign: a settled row derived as
  `eventDate - N` lands in the **future** whenever the event is more than N days
  out, and the bell (`orderBy desc(created_at)`) and the inbox
  (`desc(last_message_at)`) then pin those rows to the top with dates months
  ahead.
- Notification `data` payloads are a contract, not decoration: `notificationHref`
  keys on `conversationId`, then `vendorSlug` for `new_review`, then
  `bookingRequestId`. A payload missing the key its type needs routes the
  recipient to the wrong role's page.
- Row spacing has product consequences: the demo's `7 + index * 7` day spacing
  put no booking within ±119 days, so `countBookingsBetween` and
  `sumPayoutsBetween` answered zero on every vendor dashboard.

Related: [[review-checklist-onconflict-target-vs-other-unique-indexes]] — the
other half of reviewing a seed, and the same lesson that the rule governing the
row lives in a file the diff never touches.
