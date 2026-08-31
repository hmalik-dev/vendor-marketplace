---
name: review-checklist-dirty-tree-vs-reviewed-commit
description: Run `git status --porcelain` before any probe — a lane worktree can carry uncommitted follow-up that already fixes the commit you were asked to review, and your test run silently measures the wrong code
metadata:
  type: feedback
---

**Before running a single probe, `git status --porcelain`. If the tree is dirty,
every test you run measures the working tree, not the commit you were asked to
review.**

**Why:** on #375 the task named one commit (`06774cd`). The worktree also held
three uncommitted files, one of which was a follow-up fix to
`dropdown-combobox.tsx` for the exact defect the caller had asked me to confirm.
The first probe rendered a `<button>` where the commit renders an `<input>` and
read as "the diff does not say what it says" — a confident wrong answer that
cost a round trip. The lane session had moved on while the review was queued.

**How to apply:**

- `git status --porcelain` first, then `git diff` (unstaged) and `git diff
--staged` to see what diverges from the review target.
- Findings are reported **against the commit**. Say plainly which ones the
  uncommitted tree already fixes — that is useful, not noise, and it stops the
  caller re-fixing something.
- Never mutate their tree to get a clean reading (no `git stash`, no swapping
  files in and out). Fall back to static reading for the diverged file and probe
  only the files that are byte-identical to `HEAD` — check with
  `git diff --name-only`.
- A throwaway probe test under `src/` is fine (vitest's `include` is
  `src/**/*.test.{ts,tsx}`), but delete it and re-run `git status` at the end.
  Format-on-save will rewrite it under you; that is not a finding.

Related: [[review-checklist-source-grep-substring-collisions]],
[[review-checklist-controlled-index-drops-the-selection-seed]]
