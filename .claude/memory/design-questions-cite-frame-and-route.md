---
name: design-questions-cite-frame-and-route
description: Every design question must name the frame in Orla - Screens.dc.html and the live route, so the user can verify both sides before ruling
metadata:
  type: feedback
---

When putting a design question to the user, always give **both** coordinates up
front, before the options:

1. **Where it is in the screens HTML** — the `data-screen-label` frame (e.g.
   `02 Search`, which opens at `design/Orla - Screens.dc.html:259`), the line
   number of the element itself, the identifying content on that card or block
   (`Salt & Vine Studio`, `★ 4.9 (61)`), and the literal token values drawn
   (`#F5EEDC` / `#7A5A12`). Name every other frame that redraws it.
2. **Where it is in the live app** — the route (`/search`) and the component and
   line that renders it (`vendor-card.tsx:227`).

**Why:** the user verifies the design themselves before ruling — they open the
frame and the running page side by side. A question phrased only as prose makes
them hunt for the thing being asked about, and they will (correctly) refuse to
answer until told where it is. Asked twice on 2026-08-30 during the #335 ruling
round, for the availability chip and the `New` chip.

**How to apply:** find the coordinates *before* opening `AskUserQuestion`, not
after they ask. `grep -o 'data-screen-label="[^"]*"'` lists every frame;
`awk` back from a matched line to the nearest `data-screen-label` maps a line to
its frame. The same rule holds for a design finding reported in chat or filed as
a ticket. See [[vendor-marketplace-orla-design]] and
[[design-is-a-contract-not-code]].
