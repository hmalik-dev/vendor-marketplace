---
name: worktree-env-copies-drift
description: .worktreeinclude copies env files once at worktree creation, so a long-lived lane's .env silently goes stale and fails tests that read the registry
metadata:
  node_type: memory
  type: feedback
---

**`.worktreeinclude` copies gitignored files at worktree creation. They are
snapshots, not links.** A worktree that lives for hours holds whatever `.env`
looked like when it was made.

Observed 2026-08-29: a worktree created before the Docker migration kept
`NEON_BRANCH` and `DATABASE_URL_UNPOOLED` in its `.env`. After rebasing onto the
commit that made both absent-by-design for `local`, the untouched test
`environment.test.ts > passes locally when the Neon-only rows are unset` failed
**only in the worktree** and passed in the main checkout. The diff looked
unrelated to the failure, which is what made it expensive.

The sibling failure mode: a stale `dist/`. A fresh worktree has none, and one
built before a rebase is worse than none — `evaluateVariable` reads the env
registry out of the built `@vendor-marketplace/shared`, so a stale build silently
answers with the old rules.

**Why:** a test that fails in one checkout and passes in another looks like
flakiness or a bad rebase. It is usually neither — it is un-tracked state that
git does not reconcile because git never knew about it.

**How to apply:** when a worktree fails a test the main checkout passes, before
debugging the diff, re-copy `.env` from the main checkout and rebuild with
`pnpm build --filter=./packages/* --force`. `pnpm lane:up` does the build for
this reason; it does not refresh `.env`, so a rebased lane still needs that by
hand. Related: [[credentials-env-files-only]].
