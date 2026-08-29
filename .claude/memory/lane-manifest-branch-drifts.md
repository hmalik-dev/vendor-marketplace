---
name: lane-manifest-branch-drifts
description: "Fixed 2026-08-29: the manifest now reads its branch from git and records its PR via `pnpm lane:pr`. Manifests written before that still lie — verify old ones against git and gh"
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

**Fixed at the source on 2026-08-29**, after lane 198 hand-edited the JSON to be
landable:

- `laneUp` reads the branch from `git symbolic-ref --short HEAD` in the worktree
  instead of composing `lane/<ticket>`, a name nothing creates.
- **`pnpm lane:pr <ticket> <url>`** records the PR and sets `pending-merge`
  through the same atomic `updateManifest` every other change uses. Run it at
  delivery; never hand-edit `.claude/lanes/<n>.json`.

**How to apply:** a manifest written on or after 2026-08-29 can be trusted for
`branch` and `prUrl`. One written before cannot — those still say `lane/<n>` and
`"prUrl": null` — so when landing an older lane, resolve its real state from
`git -C <worktree> symbolic-ref --short HEAD` and
`gh pr list --state all --json number,headRefName,state`, matching on the branch
name. See [[ticket-worktree-merge-immediately]] and [[worktree-env-copies-drift]].
