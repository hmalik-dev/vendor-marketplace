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

**The open-PR check must GATE the merge, not accompany it — 2026-09-07.** A lane
was told to check `gh pr list --state open` "in the same breath as the merge",
and put the check and the `gh pr merge --squash` in **one command**. The check
printed its answer *after* the merge had already gone through, and a peer's PR
had opened while the lane waited on CI — so it was knocked BEHIND by the very
merge the check existed to prevent. The wording caused it; the rule is:

    gh pr list --state open      # its own command. read the result.
    gh pr merge --squash         # only if the first was empty.

**Why:** a check whose result arrives after the action it guards is not a guard,
it is a log line. Same class as [[verify-with-a-differently-shaped-check]] — ask
what state would make it fail, and if the answer is "nothing, by then", it is not
a check.

**Merging past a red Vercel check, mechanically.** `gh pr merge --squash` is
*refused* while the required status check is pending, and `--admin` — the
documented bypass — is blocked by the permission classifier. What works: wait for
the check named **`Typecheck, lint, build, test`** to read SUCCESS, then plain
`gh pr merge --squash` goes through on its own, with Vercel still failing. The
merge is gated on CI and **not** on Vercel. See [[vercel-deploy-check-always-fails]].

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

## An armed auto-merge is not a merge that will happen

A lane armed `--auto`, saw `autoMergeRequest` non-null, and would have waited
**indefinitely**: the PR sat at `mergeStateStatus: BEHIND`, and this repo's
**"Create or update the branch" job reports `skipping`** — so nothing was ever
going to advance the branch. It looked armed the whole time.

**The tell is `BEHIND` plus an armed auto-merge and no update job.** Arming is a
state, not a process; on a repo with no merge queue and no auto-update, something
still has to move the branch.

**How to apply:** after arming, check `mergeStateStatus`. If it is `BEHIND`,
`git merge origin/main` into the lane branch and push normally — the merge commit
disappears at squash time and no force is needed. `gh pr update-branch` does the
same and also only fast-forwards; neither can clear a `DIRTY`, which needs a
local merge.

**And do not reach for a branch rename after a rebase that only re-parented.**
A non-fast-forward push rejection looks like rewritten history, but the rename
rule is for history that genuinely changed. Compare **the commit's own patch
against its parent on both sides** first — if they are byte-identical, the rebase
moved the commit onto new docs commits and changed nothing that reached the diff,
so realigning to the pushed branch loses nothing.
