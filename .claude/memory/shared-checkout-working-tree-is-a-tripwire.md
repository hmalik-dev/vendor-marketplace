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

## A committed-but-unpushed commit is not held either — 2026-09-07

Holding a push in the **shared checkout** does not hold anything. Any lane
landing its own ticket has to `git rebase origin/main` and `git push` to bring
main up and confirm `0 0` — and that publishes **whatever the shared checkout
holds**, including commits another session was deliberately sitting on.

Lane 439 did exactly that while landing: five docs commits being held to avoid
dequeuing an in-flight PR were rebased (new SHAs) and pushed as part of its
reconciliation. It was in-bounds — it was told to bring main up, which cannot be
done otherwise — and it said so, which is why this is written down rather than
discovered later.

**So there are only two real ways to hold work while lanes are landing:**

1. Do not commit it to the shared checkout's `main` at all — keep it on a branch
   or outside the repo until the window is safe.
2. Accept that it goes up with the next landing, and make sure it is safe to
   publish at any moment (docs-only, no half-finished edits).

The second is usually right. The mistake is believing option zero exists.

Related: [[commit-ticket-changes-immediately]],
[[main-pushes-dequeue-parallel-lane-prs]].
