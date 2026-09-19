---
name: support-report-is-a-public-route-that-moves-money
description: POST /support/messages is unauthenticated but a bookingId on it freezes a vendor payout, so the route's own guards are the wrong place to look — placeDisputeHold is
metadata:
  type: project
---

Since #425, `POST /support/messages` is still deliberately public (no
`requireAuth`, 6/hour keyed by `request.auth?.id ?? request.ip`) but an optional
`bookingId` in the body turns the send into a money write: `placeDisputeHold`
sets `bookings.status = 'disputed'`, which stops the payout sweep.

**Where the authorization actually lives.** Not on the route. `placeReportHold`
(`support.service.ts:146`) adds the one refusal the route needs — 401 with no
session — and delegates everything else to `placeDisputeHold`
(`payments.service.ts:1086`): 404 for a booking that is not the caller's, 403
for the vendor on it, 409 outside the window, and `releasedBefore` re-asserted
at write time. The global `clerk-auth` `onRequest` hook rejects a banned account
on _every_ route including this one, so the public route inherits the ban check
it never declares. Verified 2026-09-06 — do not re-report the missing route
guard.

**The shape to check on any change here:** the hold is written **before** the
email and compensated by `unwindReportHold` if the send throws. Only
`deps.email.send` sits inside that `try`. Anything moved above the try but after
`placeReportHold` (today: `disputeHoldAudience`, `support.service.ts:167`) can
throw and leave a payout frozen with no support email and no unwind.

**The receipt now carries `replyTo` (VEN-435)** — the address the server chose,
which is `resolveReplyTo`'s output: the account's own email for a signed-in
caller (a supplied one is ignored), the typed one otherwise. Audited as not an
enumeration surface: reaching the account branch needs a valid session for that
account. `supportSendFailureDetailsSchema` was narrowed to `pick({reference})`
so the 502 path keeps carrying no address.

**Not a disclosure surface.** `dispute_reason` holds the customer's 4,000-char
free text and is read back by nothing — it is in no response projection, and the
two emails route every interpolation through `escapeHtml`. The vendor's hold
notification carries fixed copy, never the complaint.

**How to apply:** treat `bookingId` on this body as the trust boundary, and read
`placeDisputeHold` rather than the route options. Related:
[[payout-sweep-is-a-second-money-mover]],
[[public-mail-endpoint-echoes-to-any-address]],
[[rate-limit-key-is-the-proxy-not-the-caller]].
