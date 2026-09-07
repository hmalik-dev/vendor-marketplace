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

**The tree moves under you mid-review (#408).** Reviewing an _uncommitted_ diff
is the unstable case: the lane committed it and merged `origin/main` while I was
mid-probe, so `git status` went from 29 modified files to **clean**, and the
checkout silently reverted an in-place mutation I had made to run a
mutation-coverage check. Two consequences, both real: the review target gained a
transaction wrapper and 70 lines of new tests I had not read, and one finding
("no test covers the new writer") was already fixed by the version that landed.

- Re-run `git status --porcelain` and `git log --oneline -3` **after** any probe
  that takes minutes, not only before. A clean tree is not proof nothing changed.
- Then diff the new commit's `--stat` against the `--stat` you started from,
  file by file. Every count that matches means your reading still holds; the one
  that moved is the only file worth re-reading.
- A mutation check (edit in place, run the suite, restore) is safe only while
  you own the tree. Keep a `cp` backup, and treat "my edit vanished" as evidence
  someone else committed, not as a tool failure.

**It goes clean → dirty too (#426).** `git status` was clean at the first tool
call; twenty minutes later the lane had written fixes for both findings into the
tree, so `sed -n` on `category-select.tsx` and `dropdown-combobox.tsx` returned
lines the reviewed commit does not contain, with line numbers that do not match
it either. **Reading a file is a probe.** Quote line numbers from
`git show <sha>:<path>`, not from the working tree, and re-run `git status`
before writing the report.

**A peer lane can be fixing your finding while you probe it (#425).** The tree
was clean-but-staged at the first call. Four minutes of mutation runs later a
security-auditor lane had written unstaged edits into `payments.dao.ts`,
`payments.service.ts` and `payouts.routes.test.ts` — files I had not touched —
and the api suite's total moved 1049 → 1050. **The test count is the cheap
tripwire:** if `Tests N passed (N)` changes between two runs you did not cause,
stop and re-read `git status` before trusting either number. Their edit was a
real fix to a real defect in the staged diff (an ABA race in the compensating
unwind), so the right report is "this is in the staged diff, and an unstaged fix
for it is already in the tree" — not silence, and not a claim it is unaddressed.

**A peer agent's _memory_ write can fail the commit gate (#434).** Mid-review a
security-auditor lane dropped a new file into
`.claude/agent-memory/security-auditor/`, and `pnpm format:check` — which
globs `**/*.md` — went red on a path nowhere near the diff. `git status` had
been clean of it at the first call. So: run `pnpm format:check` late rather than
early, and when it fires, check whether the offending path is in
`git diff origin/main...HEAD --name-only` before reporting it as the lane's.
Report it either way — it blocks their commit — but say whose it is.

Related: [[review-checklist-source-grep-substring-collisions]],
[[review-checklist-controlled-index-drops-the-selection-seed]]
