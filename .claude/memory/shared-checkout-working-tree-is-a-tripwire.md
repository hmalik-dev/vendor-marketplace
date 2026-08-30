---
name: shared-checkout-working-tree-is-a-tripwire
description: Uncommitted work in the main checkout is invisible to other sessions and blocks their rebase; commit immediately, hold only the push
metadata:
  type: project
---

Parallel lanes each get their own worktree, but they all share the **main
checkout's working tree**. An uncommitted change left there is invisible to
every other session — no lock, no manifest, no branch name, nothing naming an
owner — and the first thing it does is refuse the next session's
`git rebase origin/main`, which is the step every lane runs to land a merge.

Seen 2026-08-30: a peer filed ticket #320 in the main checkout (board row,
`tickets.ts`, `registry.test.ts`) and held the commit while waiting to push. My
lane's landing stopped dead, and the only way to identify the owner was to read
the diff and spot "while tracing #302" in the prose.

**Commit immediately, always; hold only the push.** A commit is private and
costs nobody anything. It was the well-intentioned inverse — holding the commit
too, out of courtesy over
[[main-pushes-dequeue-parallel-lane-prs]] — that turned a four-minute wait into
an invisible hard block.

**Never resolve someone else's.** Do not commit their work under your name, and
do not `git stash` it: the stash stack is shared with every worktree, so that is
the same mistake one layer down. Message the owner — `ListAgents` finds them —
and wait.

**Why:** the failure is silent until it blocks someone, and the blocked session
can tell neither whose it is nor whether it is safe to touch.
