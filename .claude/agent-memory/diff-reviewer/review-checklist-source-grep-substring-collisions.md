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
**The comment-prose variant (#393).** The colliding second match is often not
another _class_ — it is the file's own docstring. `frame-13-parity.test.ts`
pinned the new scroll axis with `expect(dataTable).toContain('overflow-auto')`,
and `data-table.tsx`'s docstring says "inside an `overflow-auto` body". Reverting
the className to `overflow-y-auto` left that file 34/34 green. This repo writes
essay-length comments naming the very classes the guards assert, so
`grep -n '<class>' <file>` will usually return the comment as well as the code —
count the matches, do not eyeball the className.

**The hand-computed-derivation variant (#393).** A test that claims to
_recompute_ a constant from the shell is only as pinned as the inputs it
actually reads. That one read `--sidebar-admin-width` numerically but hardcoded
the rail's `12 * 2` gutters and `1` border while merely asserting
`toContain('px-3')` / `toContain('lg:border-r')` beside them — both of which
match `px-3.5` and `lg:border-r-2`. Widening the nav gutter to `px-3.5` kept all
34 green with the derived constant 8px wrong. **For each number in the
arithmetic, ask which assertion would have to fail if that number moved; a
`toContain` next to a literal is decoration.**

**The responsive-ladder variant (#426).** The colliding match is the _same_
class under a breakpoint prefix. `category-select.test.tsx` pinned the caret's
four-step ladder with `toContain('text-[11px]')`, `toContain('sm:text-[9px]')`,
`toContain('lg:text-[10px]')` and `toContain('min-[90rem]:text-[11px]')` — but
the base step `text-[11px]` is a substring of `min-[90rem]:text-[11px]`, so
deleting the 390px step (a measured frame value) left 33/33 green. **In a
mobile-first ladder the base step is the one that collides with every prefixed
step, and it is also the one no larger breakpoint can cover for.** Assert it
with an anchored regex (`/(?:^|\s)text-\[11px\](?:\s|$)/`), the way
`refine-bar.test.tsx` already does for `gap-2`.

Related: [[review-checklist-pseudo-element-hit-areas]],
[[review-checklist-unpinned-safety-constants]],
[[review-checklist-focus-opener-dead-when-already-focused]].
