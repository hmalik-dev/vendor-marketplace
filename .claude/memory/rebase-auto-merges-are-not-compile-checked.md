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
