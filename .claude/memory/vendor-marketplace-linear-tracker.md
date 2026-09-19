---
name: vendor-marketplace-linear-tracker
description: The queue is Linear team VEN, project "Vendor Marketplace", since 2026-09-14; the local markdown board and its ticket registry are gone
metadata:
  type: project
---

Since 2026-09-14 the vendor-marketplace queue is **Linear**: team `Team A-H-A`
(key `VEN`), project **Vendor Marketplace**, workspace slug `vendor-marketplace`.
Settings for the pipeline scripts are in `.claude/project.json`; the procedure is
the global `~/.claude/skills/ticket/references/workflow.md`, unchanged from the
bse-nlq-agent repo. Ids are `VEN-n`; the branch is `worktree-ven-n`.

**What moved:** the 22 rows open on the local board that day were migrated
one-to-one, each carrying its old `#n` under a _Provenance_ heading. The board,
its archive, `scripts/board.mjs`, `scripts/overnight.sh` and the
`TICKET_CAPABILITIES` registry in `packages/shared/src/env/tickets.ts` were
deleted in the same PR; git history before `chore/linear-tracker` holds them.

**Conventions that replaced board columns:**

- Capabilities → `cap:auth` / `cap:storage` / `cap:stripe` / `cap:email` /
  `cap:sentry` labels; the gate is `pnpm preflight --capabilities <a,b>`
  (`--ticket <n>` is gone). `core` and `e2e` are implicit.
- "Deferred — needs a human" → assign it to the account holder (or make it a
  `blockedBy` of the ticket that waits on it), with a first-line quote of what
  the person must decide. There is no `blocked` label (removed 2026-09-19);
  `/next-ticket` skips anything with an open `blockedBy` or a person assigned.
- Blocked By → Linear's blocking relation. A blocker that was already closed on
  the board is prose in _Provenance_, not a relation.
- Branch / Notes → the issue description and comments; `/land-lanes` reads the
  open PR from the lane manifest and the PR body carries the `VEN-n`.

**Why:** the user moved the repo to Linear on 2026-09-14 to run the rollout
against one queue with a clear picture of remaining work, aligned with the
global orchestrator workflow. **How to apply:** never recreate a markdown
tracker; read and write the queue over `mcp__plugin_linear_linear__*` only, and
never put a status transition in a code PR — Linear holds the state.

Related: [[record-findings-in-backlog]], [[ticket-worktree-merge-immediately]],
[[check-for-an-existing-branch-before-starting-a-ticket]]
