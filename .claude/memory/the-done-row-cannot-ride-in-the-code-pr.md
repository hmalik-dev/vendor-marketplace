---
name: the-done-row-cannot-ride-in-the-code-pr
description: A lane produces two main-updates and the second cannot move earlier — the board row records the squash SHA, which does not exist until the queue merges
metadata:
  type: feedback
---

Never put a ticket's `Done` transition inside the PR that carries its code. A
lane makes **two** updates to `main` and the order is forced:

1. the merge queue squashes the PR — not a push you make, and its SHA is
   created at that moment;
2. you commit the board row **carrying that SHA**.

**Why:** a row written inside the PR names no commit, because the squash does
not exist yet, and the Notes column exists precisely so a later session can find
it. Worse, the row reads `Done` from the moment you push until the queue
merges — and if the PR is dequeued, fails or is abandoned, that `Done` is a
falsehood on a branch nobody is watching.

**How to apply:** land the squash, observe it, then commit the row
([[commit-ticket-changes-immediately]] — straight to `main`, immediately, not
after doing something else). An open row on already-merged work is what makes
the next unattended batch dispatch a second lane for it
([[ticket-worktree-merge-immediately]]).

**On batching, which is what invites the mistake:** every push to `main`
dequeues every other lane's armed PR and restarts its required check from zero,
about six minutes each — #403 paid four cycles this way on 2026-09-05. The
saving is **across lanes, not within one**: if two sessions are closing rows in
the same window, one of them pushes both tracker commits. Saying this loosely
as "batch the tracker commits" was read by three separate lanes as "fold the row
into the code commit", so say which of the two you mean.
