---
name: markdown-only-prs-merge-without-ci
description: "A PR that changes only .md files (docs, memory notes, CLAUDE.md) is committed and merged straight away with `gh pr merge --squash --admin`, no CI wait"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 6be10981-584c-4523-aa1e-5e7193e3b9ff
  modified: 2026-09-19T03:29:16.106Z
---

The account holder (2026-09-19): "md changes can be auto committed and merged, they don't need all the extra checks since they don't impact anything."

**Why:** waiting on `Typecheck, lint, build, test` for a memory note stalled the desk for minutes, and a dirty main checkout blocks every lane's rebase in the meantime ([[shared-checkout-working-tree-is-a-tripwire]]).

**How to apply:** only when `git diff --name-only origin/main` lists nothing but `*.md`. Still a branch and PR, never a push to `main`: `gh pr create`, then `gh pr merge <n> --squash --admin`, then `git switch main && git pull --rebase`. Any non-`.md` file in the diff goes the normal way. Vercel's red check is noise either way ([[vercel-deploy-check-always-fails]]).
