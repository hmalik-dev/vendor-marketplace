---
name: a-guard-reads-a-smaller-region-than-you-think
description: "A source scan can answer clean about code it never looked at — pin the reach with mutations in the real files, not just the entry point, because fixtures only prove it works on the shape the fixture has"
metadata:
  type: feedback
---

A guard that scans source has two independent properties: **the verdict it gives
on what it read**, and **how much it read**. Tests almost always check the first.
The failures come from the second.

**Three instances in one ticket (#447, 2026-09-07), each a coverage drop rather
than a wrong verdict:**

- **The light-ground limit.** The ink-ground role law can only decide an element
  whose ground is observable. On a light ground `stone-400` is legitimate `text-*`
  at four decorative sites, so that half of the class stays unguarded — and
  silence there reads as the whole class being closed.
- **The subtree limit.** `site-footer.tsx` opens `<footer>` at the bottom and
  delegates to `FooterColumn`/`FooterLink` declared *above* it, so
  `COLUMN_HEADING` was never in the walked subtree. Setting it to
  `text-stone-400` — the literal #430/#441 defect — left **2,978 tests green**.
  The coverage that did exist was accidental, through one inline
  `cn(LINK_CLASS, …)`, while a doc comment claimed it was the design.
- **The enclosing-scope limit.** The component's own body is never reached
  either: you are already inside it, so nothing names it. A constant moved into
  `SiteFooter`'s body went unseen, green again.

**Why:** the scan answers *clean* about source it never looked at, and nothing
distinguishes that from a real pass. **A fixture cannot catch it** — a fixture
only proves the guard works on the shape the fixture has, and all three holes
left the pinned file list unchanged.

**How to apply:**

- **Pin the reach, not just the entry point.** One mutation per *route* into the
  region being checked — inline attribute, module constant, a constant reached
  only through a sibling component — and mutate the **real** files, not fixtures.
  Verify the pins are not vacuous by disabling the fold and watching them fail.
- **State the limits out loud where the guard is documented.** An unstated
  exclusion becomes an assumed guarantee.
- **A reviewer's diagnosis being right does not make its patch right.** The
  suggested fix here was to seed the walk with the enclosing chunk, which pulls
  in all of `HomePage` — turning an under-reaching guard into one that swallows
  every light-ground class on the landing page.

Related: [[verify-with-a-differently-shaped-check]],
[[source-grep-guards-match-their-own-comment]] and
[[a-failed-command-reads-as-a-passing-check]] — same family, different mechanism.
