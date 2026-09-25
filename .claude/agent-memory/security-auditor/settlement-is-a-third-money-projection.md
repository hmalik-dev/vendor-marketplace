---
name: settlement-is-a-third-money-projection
description: bookingRequestDetailSchema.settlement is a fourth place booking money crosses the wire, and it is the only one both parties read from one shape
metadata:
  type: project
---

Booking money reaches a browser through four projections now, not the three
[[booking-reads-gate-on-two-separate-paths]] names:

1. `apps/api/src/lib/booking-view.ts` — `bookingSchema`, both parties, no fee
   split and no Stripe ids (`packages/db/src/schema/type-parity.test.ts` holds
   that line).
2. `adminPaymentRowSchema` — admin only, carries `platformFeeCents`,
   `vendorPayoutCents`, `stripePaymentIntentId`.
3. `vendorDashboardSchema.nextPayout` — vendor only.
4. **`bookingRequestDetailSchema.settlement`** (#415) — `bookingId`, `status`,
   `totalAmountCents`, `paidAt`, `cancelledAt`, `cancelledBy`,
   `refundAmountCents`, served by `findSettlements` in
   `booking-requests.dao.ts` to **both** parties from one object.

**Why it is safe today, so a later diff knows what it is breaking:**
`findSettlements` filters on `requestId` alone — it carries _no_ ownership
predicate — and is safe only because both callers pass ids that were already
authorized: `getBookingRequest` after `requireParticipant`, and
`listBookingRequests` off the `visible` set. A third caller that passes an
unfiltered or client-supplied id list leaks another pair's booking with no
query change to notice. It also has the empty-array guard before the
`inArray`.

**How to apply:** adding a field to `settlement` widens it for the customer and
the vendor simultaneously — there is no per-audience branch, unlike
`toDetail`'s `disclosesCustomerContact` block three lines above it. The fee
split and the Stripe ids must never appear here; the wire-shape guard in
`booking-requests.routes.test.ts` asserts key sets for `booking` only, so
nothing would fail. See also
[[response-schemas-are-a-second-write-boundary]].

**Fifth: the vendor's yearly statement CSV (VEN-725, audited 2026-09-24, PASS).**
`GET /v1/vendor/tax/statement.csv` hands the vendor their own fee split and
debt netting. Tenancy rests on `settledBookings(db, year, vendorId?)` and
`taxYearsWithSettledBookings(db, vendorId?)` in `tax-reporting.dao.ts`, whose
filter is `vendorId ? eq(...) : undefined` — **fail-open**: an `undefined` or
`''` id silently returns every vendor's rows (the admin 1099-K path relies on
that). Safe only because `ownVendorId` throws when the caller has no live
profile. A new caller of either DAO with a vendor scope must pass a non-empty
id or it becomes the admin export.
