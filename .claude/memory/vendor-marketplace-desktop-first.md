---
name: vendor-marketplace-desktop-first
description: "The product is desktop-first — designed at 1440x900, adapted downward"
metadata: 
  node_type: memory
  type: project
  originSessionId: 455c2c95-480f-458e-b727-7300f60da04e
  modified: 2026-08-28T02:13:21.858Z
---

The product is **desktop-first** (decided 2026-08-26). Every surface is
designed and reviewed at the 1440x900 reference viewport first; 1280 / 1024 / 768 / 390
are adaptations.

**1024 x 640 became a standard design viewport on 2026-08-27**, with seven drawn
frames of its own. Height is the binding constraint there, not width. Its three
rules: sidebars keep their labels (220px, no icon rail), right rails narrow
420 -> 340px but never stack, and grids lose a column before a card loses
information. Only landing, search, checkout and the vendor dashboard are drawn;
anything not in section 25 inherits 1440 with padding reduced 40 -> 24px. `design/design-plan/04-laws.md` carries the layout laws, the scroll budgets (app
shells 1.0x — panes scroll, not the page), the desktop review checklist and the
design parity gate; `30-responsive.md` carries the degradation table.

**Why:** the users are at laptops — customers comparing vendors across tabs, vendors
working through requests. Stretching a phone layout across 1440px wasted roughly half
the width and turned one screen of content into three.

**How to apply:** columns before stacking, persistent rails over modals, master-detail
over navigate-away, forms as two-column grids, and no centred column leaving >30% of
the viewport as empty gutter. See [[design-is-a-contract-not-code]] and [[vendor-marketplace-playwright-verification]].
