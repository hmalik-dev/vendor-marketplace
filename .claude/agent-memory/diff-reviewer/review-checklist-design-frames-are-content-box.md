---
name: review-checklist-design-frames-are-content-box
description: design/Orla - Screens.dc.html ships no preflight so its divs are content-box — but every newer standalone bundle under design/ DOES set the reset, so the box model is per-bundle and must be re-read for each frame a diff cites
metadata:
  type: project
---

`design/Orla - Screens.dc.html` (and `support.js`) contain **no**
`*{box-sizing:border-box}` reset — the only global `*` rule is inside
`@media print`, and `.ldg i` opts into `box-sizing:border-box` explicitly, which
it would not need if a reset existed. So every inline-styled div in a frame is
**content-box**: `width:15px;border:1.2px` paints a 17px border box that
overflows its declared parent.

**Why:** ticket #250/#296 turned on exactly this. Frame `01`'s header lockup is a
22x15 box holding a 15px clay disc and a 15px outlined circle at `left:6px`.
Rendered as the bundle actually renders it, the outlined circle measures
**17x17** and its ink runs to x=23, y=17 — past the 22x15 box, and 1px lower
than the disc. `logo.tsx` had `box-border`, so it drew a 13px hole beside a 15px
disc. `box-content` is the correct match, not a regression.

**The box model is per-bundle, not global — do not carry this memory forward
blind (#441).** Grep `box-sizing` in the specific file a diff cites:

| bundle                          | global `*` reset                                       |
| ------------------------------- | ------------------------------------------------------ |
| `design/Orla - Screens.dc.html` | **none** (content-box; its 33 hits are inline opt-ins) |
| `design/delta-band/`            | `* { box-sizing: border-box; }`                        |
| `design/delta-legal/`           | `* { box-sizing: border-box; }`                        |
| `design/contact-support/`       | `* { box-sizing: border-box; }`                        |

So delta-band's footer lockup paints **two equal 17x17 circles**, ink 0→25 in a
26px box — the stroke _inside_ the D — which is the exact opposite of the
screens document's reading that #250 built `box-content` on. A ticket that takes
a diameter off a delta bundle inherits its box model too, and `logo.tsx`'s
`it.each(EVERY_SIZE)` box-content guard then pins the new diameter to the wrong
one: at D=17 the app paints a 19x19 outline beside a 17px disc.

**How to apply:** when a diff argues about a frame's box model, reproduce the
frame's markup in Chromium on a **bare page** — body rule only, no
`@import 'tailwindcss'`. Loading the app's compiled CSS applies Tailwind's
preflight to the frame markup too and silently converts it to border-box, which
inverts the answer. Then compare `getBoundingClientRect()` against the
component's.

Note the app's three renderings of the mark are independent and can drift:
`components/brand/logo.tsx`, `app/icon.svg` (the favicon, hand-written SVG
radii) and `app/apple-icon.tsx` (`ImageResponse`, explicit
`boxSizing: 'border-box'`). `icon.svg`'s own comment tells you to keep them in
step.
