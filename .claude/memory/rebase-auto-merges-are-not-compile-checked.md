---
name: rebase-auto-merges-are-not-compile-checked
description: A rebase that reports no conflict in a file can still leave it broken — git merges text, not meaning. Re-run typecheck and the suites after every rebase, not just the conflicted files
metadata:
  type: feedback
---

`Successfully rebased` means git found no overlapping _lines_. It does not mean
the result compiles, and the files it merges cleanly are exactly the ones nobody
then looks at.

Both of these landed on 2026-09-07 rebasing #429 onto main after #434, and
**neither appeared in `git diff --name-only --diff-filter=U`**:

- `packages/db/src/testing/test-db.ts` — main added `import { sql } from
'drizzle-orm'` and so had the branch, at different line numbers. Git kept both.
  `TS2300: Duplicate identifier 'sql'`.
- `packages/db/src/legal-acceptance-immutability.test.ts` — main had refactored
  `refusalOf` to take the database as a first argument. The branch's two _added_
  test cases still called the one-argument form. Git merged the additions
  happily; `TS2554: Expected 2 arguments, but got 1`.

The second is the shape to watch for: **main changing a helper's signature while
you add new callers of the old one.** There is no textual overlap to conflict
on, so the only thing that catches it is a compiler.

**Why:** conflict markers are a lexical result, not a semantic one. Git's
three-way merge reasons about line ranges; nothing in it knows a signature
changed. A rebase that touches a shared-contract file is therefore most
dangerous precisely where it looks cleanest.

**How to apply.** After any rebase, before pushing: `pnpm typecheck` and the
suites for every package the rebase touched — not only the files that
conflicted. Resolving the conflicts is the start of the work, not the end. It is
also why a "clean" rebase's earlier green is worth nothing: that gate ran on the
pre-rebase tree.

Related: [[migration-numbers-collide-between-lanes]] and
[[diverged-lane-branch-needs-a-new-name]].

## `git rebase --continue` reports the wrong reason — 2026-09-07

It refuses with **"You must edit all merge conflicts and then mark them as
resolved using git add"** against a completely clean index: `git ls-files -u`
empty, and `git status` itself saying *"all conflicts fixed: run git rebase
--continue"*.

The real cause is **unstaged changes elsewhere in the tree**. Git checks
`has_unstaged_changes` and reuses the merge-conflict message for it, so the
message names the wrong condition entirely.

**How a lane gets there:** a `diff-reviewer` or `security-auditor` subagent
writes to `.claude/agent-memory/` while the rebase is paused. Any lane running a
review agent mid-rebase hits this, and it reads as data loss when it is not.

**The fix:** copy the offending files aside, `git checkout --` them, continue the
rebase, then restore. One pass. Do **not** start hunting for a conflict that is
not there — check `git status` for unstaged paths first, and believe those over
the message.

Measured by lane 432 while landing #432.

## A clean rebase can also be a non-installable rebase

Third variant, found in lane 447 on 2026-09-07. The rebase brought source that
imports a dependency the lane never installed:

    src/lib/log-error-serializer.ts(1,32): error TS2307: Cannot find module 'pino'

`pino` was added by #445, which landed **after** that lane ran `lane:up`. So the
worktree had the file and not the `node_modules` entry.

**Why it is worth a paragraph:** it fails **only in the lane**. Main and CI are
green, because they installed after the dependency landed — which is exactly the
profile that gets misread as *"my diff broke the API"* and sends someone hunting
through their own changes for an import they never wrote.

**How to apply: `pnpm install` after every rebase, before the `--force` gate.**
One idempotent line, and it removes the class.

Related: [[worktree-env-copies-drift]] — same family, where a stale copy in the
worktree fails nowhere else.
