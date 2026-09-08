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

## `mergeStateStatus` cannot tell stalled from slow — read `autoMergeRequest`

**`BEHIND` looks identical whether a merge is armed or nothing is armed at all.**
A supervisor watched two PRs read `BEHIND` for forty minutes believing they were
"merging", while `origin/main` had not moved: `autoMergeRequest` was `null` on
both. Nothing was going to merge them when their checks finished.

**The field that distinguishes them is `autoMergeRequest`, and it is not the one
anybody watches.** A PR watch built on `mergeStateStatus` alone reports a stalled
queue and a busy one with the same word — a check that cannot fail for the state
it exists to detect.

    gh pr view <n> --json autoMergeRequest,mergeStateStatus

Found 2026-09-08 by the lane being held behind it, which read the API rather than
trusting the supervisor's account of it.

**But `autoMergeRequest: null` has two causes and does not distinguish them
either.** It means *nothing is armed*, which covers both "abandoned" and "the
lane is still working and was told not to arm". Here it was the second: the lane
was mid-gate, absorbing two main pushes, and re-running the whole gate after each
rather than pushing a green earned against a tree that no longer existed. **No
field answers this. Ask the lane.** A status API describes the PR; only its owner
knows whether anyone is still working on it.

**And the supervisor caused the delay it was diagnosing.** Three separate docs
commits pushed to `main` while that lane was gating forced three merge-and-regate
cycles. **Batch supervisory commits, or hold them while a lane is at its gate** —
every push to `main` costs each gating lane a full re-run, and the cost is
invisible from the pushing side.

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

## `gh pr merge --delete-branch` fails *after* landing, from a worktree

    gh pr merge --squash --delete-branch
    failed to run git: fatal: 'main' is already used by worktree at …

**The merge had already succeeded.** That error is `gh` attempting the *local*
branch cleanup afterwards, which it cannot do from a lane session because `main`
is checked out in the shared checkout. Reading the non-zero exit as "the merge
failed" leads straight to a retry against an already-merged PR.

**The command's exit status is a fact about `gh`, not about the merge.** Check
`state` and `mergeCommit` on the PR instead — the same instrument-versus-subject
distinction that keeps producing wrong answers here.

**How to apply: drop `--delete-branch` from the lane recipe.** Merge plainly,
then delete the remote branch explicitly during teardown. Every lane landing from
a worktree hits this otherwise.

## The merge recipe for this repo, corrected 2026-09-08

**`--auto` is mandatory here, not optional.** Three rules compose into a
constraint that makes a plain `--squash` possible only inside a race:

1. **Force-push is banned** by the hook, so a **rebased** branch can never reach
   its own PR.
2. **Branch protection requires an up-to-date head** — exactly what rebasing
   would have provided.
3. So **`gh pr update-branch` is mandatory**: it merges `main` *into* the branch,
   a new commit with no history rewrite, so no hook fires. **A local rebase is
   verification only, never something you can deliver.**

`update-branch` **re-triggers the required check**, so the only window for a plain
merge is between CI going green and the next push to `main`. Arming
`--squash --auto` is not "letting a queue decide" — it is the only way to merge
without hand-timing that race, and it satisfies the repo's own law against
merging by hand.

**The hazard that made me ban `--auto` is real but belongs to the supervisor**:
an armed auto-merge is silently *dequeued* by a push to `main`. The remedy is
**hold supervisory pushes while a lane is landing**, not have lanes time merges.

**Two steps that make it sound, both from lane #462:**

- After `update-branch`, **diff the new head against the head you gated and
  re-gate only if the delta touches code, config or the lockfile.**
  `git diff --stat <gated-head> <new-head>` — a markdown-only delta (tracker,
  memory, agent-memory) cannot change a suite result, and re-running twenty
  minutes of tests to prove that is waste. Byte-identical is the strong case;
  docs-only is the common one. **What you must never do is skip the diff and
  assume.** Lane #462, 2026-09-08 — it re-gated the update that pulled in #157
  because that one moved code, and the web suite went 3095 → 3117, which is what
  a real delta looks like.

  **Two lanes derived this from opposite cases the same night, which is what
  makes it a rule rather than a preference.** #462's update was three markdown
  files and re-gating would have proved nothing. #444's *first* update brought
  **~1085 insertions of another lane's code** — a sign-up form, a new module, its
  tests and an E2E spec — so the green it had earned did not cover the tree that
  would merge, and without the diff it would have merged a tree it had never
  built. **Byte-identical is the check, not the expectation.** A landing lane's
  close-out carries whatever landed before it, code included.
- Confirm the arming by **reading `autoMergeRequest` back** (`ARMED SQUASH`),
  never by trusting the exit code — **but read `state` and `mergeCommit`
  alongside it.** That field was `null` before arming, `null` after the merge
  consumed the arming, and `null` when nothing was ever armed: **three states,
  one value.** Alone it cannot tell "never armed" from "armed and done".
  `state: MERGED` with a `mergeCommit` is the answer; `autoMergeRequest` only
  distinguishes armed-and-waiting from not-armed-and-waiting.

**And arming is never the slower path.** With the required check already green,
`--squash --auto` collapses to an immediate merge — so there is no case where
hand-timing a plain merge is better, and one (the check still running) where it
is the only thing that works.

**Three states, three different remedies — all hit in one night:**

| Reading | Means | Remedy |
| --- | --- | --- |
| `BEHIND` + `autoMergeRequest: null` | nobody will merge it | ask the lane; arm or merge |
| `BEHIND` + armed | waiting on the branch being updated | `update-branch` |
| `BLOCKED` | armed and a required check is running | wait, by name — the only one where waiting is correct |

**`mergeStateStatus` has a fourth reading the table cannot answer: `UNKNOWN`**,
while GitHub recomputes after an update. Waiting for it to settle costs a cycle.

**Decide locally instead — it is immediate and cannot be `UNKNOWN`:**

    git fetch origin main <branch>
    git merge-base --is-ancestor origin/main origin/<branch>

Exit 0 = the branch already contains `main`. Non-zero = it needs
`update-branch`. Pure git over refs you already have, so it answers while the API
is still thinking.

**`mergeStateStatus` is the reporting field; `merge-base --is-ancestor` is the
deciding one.** Use the API to understand *why* something is stuck; use git to
decide *whether to act*. Lane #462, 2026-09-08.

**`BEHIND` + armed is the one that looks like progress and is not**, and it is
**re-enterable**: every push to `main` puts an armed PR back into it. So the lane
loop is `update-branch → diff → re-gate if code moved → wait`, repeated until it
lands. **Arm-and-forget does not work here** — the lane has to keep watching.

**And for the supervisor: holding your own commit is not the same as `main`
holding still.** A landing lane's close-out rebase can carry your commit along
and push it, moving `main` without you doing anything. Tell lanes *before* a
landing, not after.

