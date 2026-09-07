---
name: diverged-lane-branch-needs-a-new-name
description: "REWRITTEN history needs a new branch name; merely BEHIND does not — auto-merge resolves that one itself. Check which failure you have before renaming"
metadata:
  type: feedback
---

**First decide which failure you have. They look alike and their remedies differ.**

| Symptom | What happened | Remedy |
| --- | --- | --- |
| PR reads `BEHIND`, push still fast-forwards | main moved under you | **Do nothing.** GitHub's auto-merge merges main into the branch as an ordinary merge commit — same branch, same PR, no force push, no manifest drift |
| Push rejected as non-fast-forward | your history was **rewritten** (rebase, or a branch recreated by a post-merge push) | push a new branch name |

Renaming a merely-behind branch drifts the manifest for no reason at all.
Verified 2026-09-05 landing #416: it was put `BEHIND` twice, by `a583200` and
`cc7bc2a`, and auto-merge cleared both on its own as `f3a39fd`. The branch, the
PR and the manifest were untouched throughout.

The rest of this memory is the **rewritten** case.

A lane branch pushed, then **recreated by a post-merge push**, then rebased
locally, has diverged from its remote. Neither route out works there:

- **force-push is hook-blocked** in this repo's direct-to-main workflow
- **`gh pr update-branch` does not apply** — it clears `BEHIND` on an open PR by
  merging the base in; it does not reconcile a branch whose history was rewritten

**Push a new branch name and open the PR from that.** Cheap, leaves the old ref
alone, and needs no hook exemption.

**Why:** hit on 2026-08-31 landing #387. The queue merged PR #90 while a review
fix was still being written; the follow-up commit was pushed seconds later, which
**recreated** the just-deleted `worktree-387`. Rebasing that onto the new `main`
then diverged it, and the fix had nowhere to go until it was pushed as
`worktree-387-stripe-decides` (PR #92).

**How to apply:** when a push is rejected as non-fast-forward on a lane branch,
do not reach for `--force` or `update-branch` — check whether the branch was
recreated after a merge, and if so push under a new name. Then update the lane manifest — but
know that **`pnpm lane:pr <ticket> <url>` is not enough on its own.** It writes
`prUrl` and `state` and leaves `branch` naming the branch you just abandoned, so
after a rename you must also correct `branch` with an atomic write. Confirmed at
the source on 2026-09-05 (`laneEnqueued`, `lane/lane.ts:463`) after lane 407 hit
it: manifest said `worktree-t407`, real branch was `worktree-t407-rebased`.
`/land-lanes` reads both fields, so a stale `branch` classifies the lane as
abandoned even when `prUrl` is right.

Related: [[lane-manifest-branch-drifts]],
[[main-pushes-dequeue-parallel-lane-prs]],
[[ticket-worktree-merge-immediately]].

## Better: do not rewrite at all — merge `origin/main` instead — 2026-09-07

Lane 439 rebased its pushed branch onto `origin/main`, which rewrote history and
left the branch **unpushable**: `git push --force-with-lease` is blocked by the
hook, so there is no way to land a rewritten lane branch. Renaming the branch
would have meant abandoning the open PR **and its queue position**, and drifting
the lane manifest — see [[lane-manifest-branch-drifts]].

**What it did instead, and this is the recipe:**

1. `git reset` back onto the **pushed tip** (undoing the rebase locally).
2. Redo the update as a real **merge** of `origin/main` — which is a
   fast-forward-able push, so the branch and its PR survive.
3. **Verify the merge result is byte-identical to the rebased tree** it had
   already run the gate on: `git diff <rebased-sha> HEAD` empty.
4. Confirm the diff against main touches only that ticket's paths.

Step 3 is what makes it safe rather than hopeful — it proves the cheaper history
produced the same tree the expensive one did, so the gate run already performed
still applies.

**The rule: once a lane branch is pushed, update it by merging, never by
rebasing.** `gh pr update-branch <n>` does exactly this from the remote side and
is the one-command version. Rebase is only for a branch that has never been
pushed.
