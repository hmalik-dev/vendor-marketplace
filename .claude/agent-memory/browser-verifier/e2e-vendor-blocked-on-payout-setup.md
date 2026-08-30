---
name: e2e-vendor-blocked-on-payout-setup
description: The E2E vendor (June Harlow, vendor+clerk_test@example.com) can view requests but cannot Accept them — POST /booking-requests/:id/accept returns 402 until Stripe payout setup is complete
metadata:
  type: project
---

On lane 307 (2026-08-30), after the vendor-profile fixture gap ([[e2e-vendor-account-has-no-seeded-profile]]) was fixed and the E2E vendor account was linked to the seeded "June Harlow" profile, the Decline flow worked end-to-end (POST .../decline → 200, row leaves queue), but clicking **Accept** on a pending request fired `POST /booking-requests/:id/accept` → **402 Payment Required**, surfaced in the UI as an inline alert: "Finish your payout setup before accepting bookings." There is no reachable payout-setup surface in the vendor nav (`Dashboard, Bookings, Business profile, Packages, Portfolio, Availability` — no `Payouts`/`Settings` item), so the gate cannot be cleared through the UI as this account is currently seeded.

**Why:** Accept is gated behind a Stripe Connect payout account being fully onboarded, and the seed/E2E-account wiring evidently didn't include marking June Harlow's Stripe status as complete (unlike the 16 unrelated `*@orla-demo.example` demo vendors, which do have `BOOKED` past events with real emails — see the pre-existing "Past events" list at `/vendor/bookings`).

**How to apply:** Any ticket whose acceptance criteria require _accepting_ a request as this E2E vendor (booking creation, calendar "Booked — locked" state transitions, post-accept contact disclosure, earnings/payout numbers) cannot be exercised past the Accept click — report `BLOCKED` with the exact 402 + UI copy, don't try to route around it (no payout-completion UI exists to click through, and fabricating Stripe Connect state isn't a browser-verification task). Decline-only and read-only criteria (queue privacy, dialog behavior, calendar states for _already-seeded_ bookings) are unaffected and can still be verified normally.
