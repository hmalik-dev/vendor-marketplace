---
name: review-checklist-subtree-scan-vs-same-file-subcomponent
description: A JSX-subtree source guard reads only the ink region's literal children, so a subcomponent defined in the same file and rendered inside it is unscanned; mutate a hoisted class const that a helper component owns
metadata:
  type: feedback
---

A source guard that establishes context by **walking the JSX subtree** of the
element carrying a ground (`<footer className="bg-stone-950">` → read every
`text-*`/`border-*` in its children) only sees markup written _literally_ inside
that element. Markup that renders there at runtime but is authored in a sibling
function in the same file — `function FooterColumn() { <p className={COLUMN_HEADING}> }`
— is invisible, and so is any hoisted class constant only that helper names.

**Why:** #447 shipped exactly this. Its doc comment named the cross-_file_
`children` case as the one limit and claimed hoisted consts were folded in. The
fold only fires when the const identifier appears inside the subtree, so
`LINK_CLASS` was covered by accident (one inline `cn(LINK_CLASS, …)` at
site-footer.tsx:343) while `COLUMN_HEADING` — holding `text-stone-560`, one of
the four ink steps the table pins by name — was dark. Setting it to
`text-stone-400`, the literal defect the guard exists to catch, left 206 files /
2978 tests green.

**How to apply:** when a diff adds a context-aware source scan, do not stop at
the fixture tests. For each real region the guard claims to cover:

1. `grep -n "^const \|^function "` the file and map which JSX lives inside the
   ground element and which lives in a helper defined beside it.
2. Count the utilities the scan actually reaches vs the utilities in the file.
   site-footer.tsx had 11; the subtree reached 3 plus two folded consts.
3. Mutate a class the helper owns — not one on the region's own children — and
   run the **whole** suite. The per-call-site guards the law was meant to
   replace usually do not cover it either, so nothing is red.

**And re-attack the fix the same way.** #447's repair folds in every _top-level_
declaration the subtree names, transitively. That covers `FooterColumn` →
`COLUMN_HEADING`, and it covers a local `const` inside a reached top-level
declaration (the whole chunk text is scanned, scope-blind). What it still misses
is the **enclosing** component's own body: the element's `attributes + children`
never include the `const`s declared above the `return`, and that function's chunk
is only folded if the subtree happens to name it — it never does. Moving
`LEGAL_CLASS` out of module scope into `SiteFooter`'s body at `text-stone-400`
left 206/206 files and 2981/2981 tests green. Seed the walk with the chunk the
ink element _lives in_, not just the subtree.

The mirror hazard: a transitive fold keyed on bare identifiers folds on words in
JSX prose and on any branch of a reached component. A top-level `const Support`
plus the footer text "Support" is a false positive on correct code.

Related: [[review-checklist-source-grep-substring-collisions]],
[[review-checklist-source-guard-regex-truncation]]. Same family: the guard's
regex vocabulary is also narrower than its prose — `border-t-stone-0/10` is a
`border-*` stone utility that `/\b(text|border)-(stone-\d+)/` cannot see, and
this repo already writes that directional form.
