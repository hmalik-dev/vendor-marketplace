---
name: review-checklist-source-guard-regex-truncation
description: A source-scan guard whose tag regex is `<tag\b([^>]*)>` is cut short by an inline arrow function's `=>`; mutation-test the guard before trusting it
metadata:
  type: feedback
---

A guard test that greps source for a defect class is only worth what a mutation
proves. Before accepting one, **delete the thing it forbids across the whole
tree and count the offenders it reports.** If the number is far below the number
of real instances, the guard is decoration.

**Why:** #411 added `apps/web/src/landmark-guard.test.ts` with
`BUTTON = /<button\b([^>]*)>([\s\S]*?)<\/button>/g`. `[^>]*` stops at the first
`>` — and `onClick={() => close()}` puts a `>` **inside the opening tag**. The
attributes captured are then a truncated prefix (so `aria-label` written after
the handler is invisible), and the "children" begin with the tag's own leftover
text (so `visible !== ''` and the button is skipped as "not icon-only").
Deleting every `aria-label` in `apps/web/src` made the guard report **2**
offenders; there were **7** genuinely icon-only `<button>`s, and the regex is
case-sensitive so the ~10 icon-only shadcn `<Button size="icon">` instances were
never scanned at all.

**How to apply:** when a diff adds or edits a file under `src/testing/` or a
`*-guard.test.ts`:

1. Re-implement its regexes in a throwaway node script over the real tree.
2. Mutate the source in memory (strip the attribute, flip the class, add the
   forbidden tag) and re-run. Report the offender count before and after.
3. Check case: `<button` never matches `<Button`, and a wrapper component
   (`Button`, `IconButton`, `Trigger asChild`) is outside the scan entirely.
4. Check `withoutComments`: `//` stripping also eats the rest of any line
   holding a `//` inside a string literal.

Related: [[review-checklist-source-grep-substring-collisions]].
