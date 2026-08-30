---
name: main-pushes-dequeue-parallel-lane-prs
description: Branch protection is strict, so any push to main knocks a queued lane PR back to BEHIND and cancels its auto-merge; parallel lanes must coordinate holds
metadata:
  type: project
---

`main` has branch protection with `strict: true` and `allow_update_branch`
disabled. Any push to `main` — **including a one-line tracker or docs commit** —
makes every open PR BEHIND, which cancels a pending `gh pr merge --squash --auto`
before CI (~4 minutes) can finish. With three lanes running, a lane that commits
its ticket transition straight to `main` will repeatedly dequeue the others'
PRs, and nothing in the output says that is what happened.

The convention that works, established 2026-08-30 across lanes 9, 222, 307 and
308: **before enqueuing, message the other sessions to hold `main` pushes, and
message them again the moment it merges.** Use `ListAgents` to find them and
`SendMessage` to ask. Honour the same request when it comes the other way, and
say so explicitly rather than going quiet — a lane mid-landing should finish and
re-queue rather than both sides stalling.

This is why tracker edits, which [[commit-ticket-changes-immediately]] says go
straight to `main`, need a moment's thought during a parallel run: they are the
commits most likely to dequeue someone. Batch them, or send them while no PR is
in flight.

**Why:** the failure is silent and expensive — a lane waits out a full CI cycle,
sees the merge cancelled with no error, and re-queues into the same race.

**How to apply:** ask for the hold before `gh pr merge --auto`, watch the PR to a
terminal state with a `Monitor` rather than returning, and release the hold with
a second message as soon as it lands. Related: [[ticket-worktree-merge-immediately]].
