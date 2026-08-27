# 14 — Checkout (`/bookings/[id]/pay`) — **MVP**

**Purpose:** take payment with no ambiguity about what's being bought or what
happens if plans change.
**Scroll budget:** ≤ 1.5×. Summary rail sticky at 420px.

## Composition

Header strips back to the logo plus "Secure checkout · encrypted by Stripe" with
a sage dot. No nav — nothing competes with finishing.

Left: `Confirm and pay` (Serif 26px) and one context line — "Maya accepted your
request on May 2. Paying now locks June 14 in her calendar."

Fields, max 620px: card number (with brand mark right-aligned) · expiry + CVC on
one row · name on card · country + ZIP on one row. Stripe Elements styled to
match — Instrument Sans 15px, `#23201C`, placeholder `#6B6459`.

Below the fields, **"If plans change"** in a bordered `stone-0` panel: the
cancellation terms in plain sentences, not a policy link. It sits above the fold
with the form, because it is the last real objection.

## Summary rail

Vendor mini-card · date / venue / guests · price breakdown:

| Line        | Treatment                                                           |
| ----------- | ------------------------------------------------------------------- |
| Package     | `stone-700`                                                         |
| Service fee | **"None"** in `sage-600` — stated, not omitted; it's a trust signal |
| Total today | Serif 30px above a 1px `stone-200` rule                             |

Then **"Pay $1,450 — confirm June 14"** (primary, 14px, full width) and a sage
dot line: "Held by Stripe until the event is complete."

The button names both the amount and the outcome. Never bare "Pay".

## Acceptance

- [ ] Total and cancellation terms visible without scrolling
- [ ] Fee line present even at zero
- [ ] Pay button states amount + what it buys
- [ ] Card errors appear inline under the field, never as a toast
- [ ] Double-submit impossible: button disables and shows an inline spinner on click

## Post-MVP

- Deposit + balance split payments
- Saved payment methods
- Instalment plans for larger bookings
