---
name: review-checklist-source-grep-substring-collisions
description: Review checklist — parity tests in this repo assert `expect(sourceFile).toContain('<class>')`; Tailwind's fractional steps make those substrings collide (`gap-2` ⊂ `gap-2.5`), so the assertion passes on an unrelated line
metadata:
  type: feedback
---

This repo's parity tests routinely `readFileSync` a component and assert
`expect(source).toContain('some-class')`. Tailwind's fractional spacing steps
mean the guard class is a **prefix of another class in the same file**, so the
assertion is satisfied by a line it was never about.

**Why:** #297's `frame-02-parity.test.tsx` pinned the clear-button hit area's
right anchor to the chip row's gutter with
`expect(refineBar).toContain('after:-right-2')` + `toContain('gap-2')`. But
`refine-bar.tsx` also has `gap-2.5` on the tag-option labels. Rewriting the chip
row from `gap-2` to `gap-9` kept all 8 tests green — and at `gap-1` the 8px
`-right-2` overhang would have covered 4px of the next chip's trigger with the
suite still green. The one assertion that named the relationship was the one
that could not fail.

**How to apply:** for every `toContain('<class>')` in a diff, grep the target
file for that string and count the matches. More than one, or one that is a
longer class (`gap-2` / `gap-2.5`, `px-6` / `px-6.5`, `py-1.75` / `py-1`,
`text-display-md` / `text-display-md-…`) means the guard is vacuous. Prove it by
mutating the intended line and re-running — cheap, and it turns a suspicion into
a demonstrated failure. Prefer asserting the rendered `className` of the element,
or a longer anchored substring including the neighbouring classes.
Related: [[review-checklist-pseudo-element-hit-areas]],
[[review-checklist-unpinned-safety-constants]].
