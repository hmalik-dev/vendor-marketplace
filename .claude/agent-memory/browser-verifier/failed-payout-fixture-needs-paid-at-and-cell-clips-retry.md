---
name: failed-payout-fixture-needs-paid-at-and-cell-clips-retry
description: Seeding a failed payout for /admin/payments needs paid_at set too (only 1 paid booking exists); the Payout state cell overflow-clips the Retry button
metadata:
  type: project
---

E2E seed has 919 bookings but only ONE with `paid_at` (E2E vendor, `payout_model=destination`, released). The Payments list requires `paid_at is not null`, so a failed-payout fixture is `paid_at=now(), payout_attempts>0, payout_failure_reason=...` on a demo `completed` + `separate` booking with `vendor_payout_cents>0` (not `disputed`). Restore with paid_at=null, attempts=0, reason=null, by id.

Vendor invites fixture: `vendor_invites` row with `email_attempts>0`, `email_sent_at` null, `email_failure_reason` set reads "Email failed"; page works with the invite gate off.

VEN-742 pass (2026-09-24): the DataTable cell wrapper is `overflow-clip whitespace-nowrap [overflow-clip-margin:6px]`; the pill + `Retry payout` row is wider than the Payout state column, so at 1440 ~10px of the button is clipped and at 1024 the button is entirely unclickable (elementFromPoint misses it, trial click times out). Not introduced by VEN-742's diff, but an "unobstructed Retry button" criterion must hit-test the button's centre and right edge at 1024, not just at 1440.

**How to apply:** for any admin-table cell that packs a pill and a button, run elementFromPoint at the button centre and at right-2 at both 1440 and 1024.
