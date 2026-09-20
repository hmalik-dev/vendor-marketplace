---
name: orchestrated-tickets-must-end-merged
description: Every ticket the orchestrator dispatches must end merged when appropriate; stacked drafts merge bottom-up as soon as the parent lands
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 00094479-b900-4cba-8e4d-b6e7cb981bfc
  modified: 2026-09-19T14:16:08.149Z
---

Every ticket I work on under /orchestrate must be merged when it is appropriate to, not left as a draft or a parked PR.

**Why:** the user said this overnight (2026-09-19) after I left stacked draft PRs (#252 VEN-438, #253 VEN-450, VEN-427) parked behind VEN-448 (#229). They expect finished work on `main`, not a queue of drafts they must merge by hand.

**How to apply:**
- Stacked children (draft, base = parent branch, auto-merge off by design) merge bottom-up: the moment the parent PR merges, GitHub retargets the child to `main`; then mark it ready, arm `gh pr merge --squash --auto`, run `~/.claude/scripts/wait-merge.sh <pr>`, confirm the merge SHA and green CI, then mark the ticket Done. Never rebase a parent with an open child.
- "When appropriate" excludes a human gate: do not merge VEN-448 (#229) without its operator-identity step and the AC5 browser pass. The stack waits for it, and a watcher on #229 does the rest.
- A reopened ticket (browser pass owed) is not finished until the pass is run or the reason it cannot be run is recorded.
- Related: [[ticket-worktree-merge-immediately]], [[orchestrate-check-lane-outcome-not-liveness]].
