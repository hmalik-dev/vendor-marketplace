---
name: full-booking-lifecycle-drive-recipe
description: Working recipe for driving fresh customer sign-up -> request -> vendor accept -> Stripe pay -> vendor action in one MCP session (VEN-659)
metadata:
  type: project
---

MCP page = fresh Mailosaur customer (sign-up via UI, `pnpm e2e:mail-code`), scratch
`browser.newContext({storageState:'.auth/vendor.json'})` in run_code_unsafe = vendor. Find it
again via `browser.contexts()[1].pages()[0]`; close with a loop at the end (leave `page.context()`).

- Lane `pnpm e2e:auth vendor customer` first (429 retry is automatic); RATE_LIMIT_MAX was unset yet the pass worked.
- Sign-up radios are `sr-only` inputs: click the label text, not the radio ref.
- Date picker: click `[aria-label="Next month"]` then `[role="gridcell"][aria-label*="November 18, 2026"]`.
- Accept on /vendor/dashboard: card filtered by customer name, `Accept` -> POST .../accept 200. Ticket named the sequence, so it is authorised; the shared E2E Customer request stays untouched.
- Stripe Payment Element iframe: `frameLocator('iframe[name^="__privateStripeFrame"]').first()`; fill Card number / Expiration `1230` / Security code / ZIP; `Pay $` button; lands on /bookings/<request-id>/confirmed.
- Bearer for direct API probes: `fetch('/api/session/token')` inside the page (never print it); use `page.request.put` to the API port.
- DB reads: `lane:exec -- sh -c 'cd packages/db && node --input-type=module -e "import postgres ..."'` works; `bookings` has `cancelled_by`, `refund_amount_cents`; events live in `booking_events` keyed by `subject_id` (not booking_id).
- Seeded E2E vendor has a completed, payout-released 2026-08-25 booking: a ready "past event" refusal target.
- Stripe key env name is not `STRIPE_SECRET_KEY` in lane env; direct Stripe refund reads were not possible.
