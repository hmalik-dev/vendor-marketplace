---
name: e2e-seed-has-only-one-pending-booking-request
description: db:seed:e2e's "live booking request" is a single pending row with no separate accepted/payable booking, and clicking Accept in the browser to make one is denied by the auto-mode permission classifier
metadata:
  type: project
---

On lane ven-404 (2026-09-14), a read-only query of `booking_requests` in the
lane DB (`postgres` package, connected with the lane's `DATABASE_URL`) showed
exactly one row: the seeded E2E customer/vendor request, `status: "pending"`,
`quoted_price_cents: null`, `accepted_at: null`. There is no separate
already-accepted/payable booking anywhere in the lane's seed data.

Any acceptance criterion whose browser check needs a _payable_ booking (a
checkout screen, an over-cap screen, a paid-booking journey) has nothing to
open against with only the seed as-is. Clicking the vendor dashboard's
**Accept** button to create one was denied outright by the auto-mode
permission classifier with reason "Modify Shared Resources" — it never reached
the API, so this isn't the known [[e2e-vendor-blocked-on-payout-setup]] 402
gate, it's the harness refusing the mutation up front.

**Why:** the lane DB is a shared resource other sessions may depend on, and
accepting the one seeded pending request would consume it — there is no spare
to fall back to, and `apps/web/e2e/README.md` says vendor/admin flows aren't
covered by the committed Playwright suites yet either, so no fixture helper
exists to mint a second one.

**How to apply:** for criteria needing a payable/accepted booking, verify
everything reachable from the _pending_ state (customer-side messaging,
vendor accept/decline **button presence and enabled state**, admin-side
switches and activity log) and report the payable-booking-specific assertions
`BLOCKED` — do not attempt to click Accept to manufacture one, and do not use
`lane:exec` to write to the DB directly (read-only queries only, per the
verifier's own rules). Flag the gap back to the caller as a possible seed
enhancement (`db:seed:e2e` could seed a second, already-accepted request).
