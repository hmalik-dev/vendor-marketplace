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

## Content versus reach — the one sentence that unifies these

Three guards failed on one night in three different surfaces, and #454 named
what they share: **the guard's *content* was asserted and its *reach* never was.**

- **#447** — the scan walked a smaller subtree than anyone believed, so it
  answered *clean* about source it had never read.
- **#442b** — the race test caught its defect one run in four, so restoring the
  bug left the suite green three times out of four and the red read as flake.
- **#454** — a colour table read the shared presentation map; the *screen* under
  test kept a **private copy** of that map, so a table-driven guard could not see
  a defect living in a table it does not read.

The fix in each case was an assertion about **absence or extent**, not about
values: pin every route into the region; assert deterministically on something
the fix changes definitely; assert **the screen has no second map at all**.

**A guard that only ever asserts what it read has established nothing about what
it did not read.** Ask, of every new guard: *which inputs can change without this
firing?* If the honest answer includes the defect you are guarding, the guard is
about content and needs a claim about reach beside it.
