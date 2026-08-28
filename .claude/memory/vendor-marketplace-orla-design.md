---
name: vendor-marketplace-orla-design
description: The Orla design bundle in design/ replaced the old design-system doc on 2026-08-26; parity with its frames is a ticket gate
metadata:
  type: project
---

The design lives in the repo at `design/`, imported from Claude Design on
2026-08-26. `design/design-plan/` is a 22-file implementation spec (tokens,
brand and logo, component vocabulary, layout laws, one file per screen 10–22,
responsive, voice, open questions) and `design/Orla - Screens.dc.html` holds
thirteen 1440x900 reference frames plus a tablet/mobile adaptation frame.

It **replaced** `.claude/plans/vendor-marketplace-design-system.md` and
`vendor-marketplace-color-schemes.md`, both deleted. Nothing should reference
them again.

Two things that are easy to get wrong:

- **Clay is a fill, not a text colour.** `#B4552F` behind white text;
  `#A34A28` when clay is the text on cream. Colour is a signal — clay means *you
  can act here*, sage *settled*, gold *waiting on someone*, steel *information*.
- **The product books vendors for anything, repeatedly** — not one wedding. The
  customer dashboard leads with the next booking and keeps history; never say
  "your wedding", "couples", or assume a single event.

**Why:** the previous design doc drifted out of sync with the code, which is what
motivated a spec concrete enough to verify against.

**How to apply:** screens are folded into the feature ticket that owns their
data, not tracked separately. #21 is the foundation ticket every frontend ticket
is gated by. A screen is not Done until it has been driven in Playwright at
1440x900 and compared against its frame — composition, not just content, must
match. See [[design-is-a-contract-not-code]],
[[vendor-marketplace-playwright-verification]], [[vendor-marketplace-naming]].
