---
name: playwright-parity-gate-every-fe-ticket
description: "Every frontend ticket must Playwright-verify 1:1 parity with its Orla frame on five axes - layout, style, colour, font, and the literal text"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: e3ef26b0-6634-4274-8a46-c0adcdc62d66
  modified: 2026-08-27T04:48:08.739Z
---

Any ticket that touches the frontend must be driven in Playwright and compared
against its **current** screen frame in `design/Orla - Screens.dc.html` at
1440x900 before it can move to Done. Parity is **1:1 on five axes, all hard
gates**: layout, style, colour, font, and **the literal text** — headings,
labels, button copy, helper lines, micro-labels, empty states and count
sentences must read word for word, same capitalisation, same punctuation. Only
real content, real data volume and real photography may differ.

**Why:** the frame is the acceptance criterion, not the diff. The earlier gate
covered composition and tokens but treated copy as paraphrasable, and copy
drifted on every screen — the user called this out explicitly: "style, font,
colour, and content of text". Screens built before a frame revision match
structure but not strings, and reading the diff never catches it.

**How to apply:** find the screen's frame in `Orla - Screens.dc.html`, open the
real page in Playwright at 1440x900 on populated data, screenshot both, compare
across all five axes, then **pull the frame's visible strings out of its markup
and diff them against the live DOM text** — read the markup, never the `sc-d`
caption blurbs, which are commentary and go stale. Then run the desktop review
checklist in `design/design-plan/04-laws.md` and the adaptation checklist in
`30-responsive.md` at 1280 / 768 / 390. Record the frames verified in the
ticket's Notes column. When a design re-import lands, screens already shipped
against a superseded frame get **redesign tickets ahead of new-screen build**.
See [[design-is-a-contract-not-code]], [[vendor-marketplace-orla-design]],
[[vendor-marketplace-playwright-verification]].
