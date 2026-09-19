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

## `Total today`, not `Due today` — ruled 2026-09-04 (D30)

#380 recorded the frames as splitting three-all. **They do not.** The tally
counted a layout constraint's prose as a copy source:

- **`Total today` is the string.** This file's content table specifies it, frame
  `05 Checkout` draws it, `checkout-screen.tsx` renders it,
  `checkout-screen.test.tsx` asserts it, and `accepted-request.tsx` echoes it.
- **`Due today` was never specified anywhere.** It appears in `30-responsive.md`
  and `CHANGE-ORDER-2026-08-28.md` only inside a sentence about the **fold** —
  "Due today stays above the fold" — where the writer was naming the row
  informally, not fixing its label. Frames `27 Checkout — 1024` and
  `21 Checkout — payment declined` then copied that informal phrasing.

Both frames now read `Total today`, and `30-responsive.md`'s two fold sentences
are reworded so the phrase cannot be mistaken for a string again. The change
order is left alone: it is a dated record of what was ordered, not a spec.

**The layout question this was wearing the clothes of does not exist** — the row's
bottom sits at 302 in a 640px frame, so nothing about the fold constrains the
label's length.

## Accepted deviations from frame `05`, `15` and `16` — ruled 2026-09-19 (VEN-452)

Each is the shipped design being the intent. A parity pass reading one is
reading this record, not drift. The frames are corrected by a design pass.

**Frame `05 Checkout`**

- **The left column is Stripe's Payment Element** (Card / Bank / Klarna tabs,
  Link block), not four drawn inputs. The frame's fields are a picture of what
  Elements renders; the card data never touches our DOM.
- **`If plans change` lives in the rail as `RefundScheduleBlock`**, a four-row
  schedule on `stone-100` at 14px radius with a 10.5px uppercase heading.
  Frame `33` draws it there, and one block replaces the two-sentence panel so
  the policy is stated once (`/terms` section 5).
- **The summary card ends at the total and the pay button is its sibling**, with
  the schedule between them (frame `33`'s composition).
- **The line under the button reads `Held by Orla until …`, not `Held by
Stripe`.** Since #423 the charge lands in the platform balance; "Stripe" names
  the wrong holder.
- **A `By paying you accept the Terms and the refund schedule above.` line is
  added.** Acceptance of the Terms at the point of payment is a legal
  requirement the frame predates.

**Frame `15 404`** — the block now centres in the space under the header
(`flex-1`), so it lands where the frame does inside the checkout segment. The
marketing nav and category set are already ruled in `web-design-parity.md`
(VEN-419, #419). The root 404 sits above a footer the frame does not draw, so
its centre is higher by half the footer's height.

**`CheckoutUnavailable` (frame `16` composition)** — headline 38px and body
14px/1.65 now match. The money strip stays the bordered `Banner` (`sage-50` on
`sage-300`, radius 12, weight 400) where frame `16` draws it borderless at
radius 10, weight 500 with `11px 16px` padding: ruled 2026-09-06 (#372) in
`03-components.md`, one `Banner` for every screen.
