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

## The deadlock is symmetric, and batching is the exit

Two well-behaved sessions can lock each other out of the shared checkout: one
edit **staged**, the other **unstaged**, and the hook refuses both commits —
each session sees "unstaged or untracked files remain" and neither is the one
holding it up. It is not "the second commit waits for the first".

**The only exit that discards nobody's work is one commit taking both halves**,
with the message naming whose each half is. That is the sanctioned resolution
here, not an exception — the hook will produce this again whenever a supervisor
writes to the tree while a lane is closing out.

**Better still: do not write into the shared checkout while a lane is landing.**
Hold the edit until the lane reports its push. Recorded 2026-09-08 after I did
exactly this minutes after warning three lanes about it.

## A teardown that fails on a busy database means a process survived

`lane:down` refusing with *"database is being accessed by other users"* is not a
transient to retry. **Ask which session is holding it**: `pg_stat_activity`
showed an idle connection whose last statement was a `bookings` status query —
the **payout sweep**, which ticks every fifteen minutes and had outlived the dev
servers the lane believed it had killed. Seven processes were still alive under
the worktree path.

Kill scoped to the **worktree path** in the command line, never by process name:
an unscoped `pkill` here would have reached four other running lanes. Then
`lane:down` succeeds first try.

And `git push origin --delete <branch>` erroring with *"remote ref does not
exist"* is the merge having already removed it — **an error reporting the state
you wanted**, same family as `gh`'s post-merge exit code. Check `git ls-remote`
rather than reading the exit status.
