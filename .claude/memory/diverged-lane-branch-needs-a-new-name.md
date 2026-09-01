---
name: diverged-lane-branch-needs-a-new-name
description: once a lane branch has diverged from its remote, neither force-push nor gh pr update-branch can reconcile it — push a new branch name instead
metadata:
  type: feedback
---

A lane branch pushed, then **recreated by a post-merge push**, then rebased
locally, has diverged from its remote. Neither route out works here:

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
recreated after a merge, and if so push under a new name. Then **update the lane
manifest with `pnpm lane:pr <ticket> <url>`**, because the manifest's `branch`
field will still name the original: `prUrl` is the field `/land-lanes` can
actually resolve, and without it that follow-up is work nobody reconciles.
Related: [[lane-manifest-branch-drifts]],
[[main-pushes-dequeue-parallel-lane-prs]],
[[ticket-worktree-merge-immediately]].
