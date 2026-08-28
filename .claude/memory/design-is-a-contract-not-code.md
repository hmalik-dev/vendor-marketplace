---
name: design-is-a-contract-not-code
description: Design passes edit the design plan in design/design-plan; tickets write the code
metadata:
  type: feedback
---

A design pass edits `design/design-plan/*.md` in the repo and never application
code. The plan must be concrete enough to build from — named tokens, fonts,
container widths, per-surface layouts, acceptance checklists — because ticket
implementers read it as the foundation for all styling work.

The bundle also carries `design/Orla - Screens.dc.html`: thirteen 1440x900
reference frames. The prose is the spec; the frames settle anything the prose
leaves ambiguous, and the implementation is **verified against the frames in a
real browser** before a ticket is Done — see the parity gate in
`design/design-plan/04-laws.md`.

**Why:** the design plan is the single source of truth. A value invented inside
a component (a hex, a width, an icon) becomes a second source of truth and
drifts — which is exactly how the palette and fonts in the previous design doc
went stale against the code.

**How to apply:** when asked to iterate on design, change the plan; add any
missing primitives (tokens, utilities, components) to the plan as a
specification; leave implementation to the ticket that owns the surface. When a
resolved question invalidates a screen, rewrite that screen's file rather than
letting the ticket improvise. See [[vendor-marketplace-desktop-first]] and
[[vendor-marketplace-playwright-verification]].
