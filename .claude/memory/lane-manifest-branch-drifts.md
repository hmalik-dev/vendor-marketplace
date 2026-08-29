---
name: lane-manifest-branch-drifts
description: .claude/lanes/<n>.json can name a branch and PR that don't exist — trust git and gh, not the manifest
metadata:
  type: project
---

A lane manifest's `branch` and `prUrl` fields are written at `lane:up` time and
are not kept current. Both lanes reconciled on 2026-08-29 (#66, #67) had
`"prUrl": null` and `"branch": "lane/<n>"` while the real branches were
`worktree-<n>` and the real PRs were #8 and #10. The worktrees were created
before `pnpm lane:up` ran, so the `lane/<n>` ref was never created at all.

**Why:** `/land-lanes` reads `prUrl` to decide a lane's fate. Taken at face
value, a null `prUrl` classifies a merged lane as "abandoned work" and leaves
its worktree and database to accumulate — the exact unbounded growth the skill
exists to prevent.

**How to apply:** when landing lanes, resolve each lane's real state from
`git -C <worktree> rev-parse --abbrev-ref HEAD` and
`gh pr list --state all --json number,headRefName,state`, matching on the branch
name. Use the manifest only for `worktreePath` and `database`. See
[[ticket-worktree-merge-immediately]] and [[worktree-env-copies-drift]].
