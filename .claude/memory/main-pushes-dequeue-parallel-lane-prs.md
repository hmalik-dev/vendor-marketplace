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

**BEHIND never clears itself here, and the two obvious escapes are both shut.**
Confirmed 2026-08-31 on PR #89: the `Create or update the branch` workflow
reports `skipping`, so nothing updates the branch automatically, and
`git push --force-with-lease` after a rebase is refused by a hook
(*"Force-pushing is prohibited in this direct-to-main workflow"*). The two
routes that do work:

- **`gh pr update-branch <n>`** — GitHub's own update API, so it needs neither a
  force-push nor a local merge commit, and it keeps the queue's hold on the
  branch. Prefer this.
- `git merge origin/main` into the lane branch and a normal push. The merge
  commit is invisible in the end because the repo squash-merges.

Both restart CI, because both move the head.

**The treadmill this creates is structural, not bad luck.** The required check
takes ~6 minutes. With several sessions landing tracker commits, any PR whose CI
is slower than the gap between `main` pushes can never catch up: each fix
restarts the clock. That is why the hold is the actual fix and not politeness —
and why tracker-only commits, which move `main` without affecting any build, are
the ones to batch first.

**A green check goes stale the moment the branch updates.** After an
update-branch or a merge, `gh pr checks` shows a *new* run; the old green
described the old head, not what the queue will merge. Read it again before
reporting CI as green.

**Why:** the failure is silent and expensive — a lane waits out a full CI cycle,
sees the merge cancelled with no error, and re-queues into the same race.

**How to apply:** ask for the hold before `gh pr merge --auto`, and ask *every*
live session, not one — `ListAgents` first, since one holder does not keep `main`
still. Ask them to disarm any competing `--auto`, not just to refrain from
pushing: a peer's armed PR lands on its own and dequeues yours. Watch the PR to a
terminal state rather than returning, and release the hold with a second message
as soon as it lands. Related: [[ticket-worktree-merge-immediately]].
