---
name: ticket-worktree-merge-immediately
description: "A ticket runs in its own branch and worktree; the PR is merged immediately with no review, and that merge is the signal to remove the worktree and start the next ticket"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: f528c010-b3fc-481e-9bf4-b7b283920048
  modified: 2026-08-29T05:39:42.560Z
---

Each ticket is executed on its own branch inside an isolated worktree. When the
work is finished a PR is opened and **merged immediately** — no review wait, no
approval step, because the user is the only reviewer and the pre-commit gate plus
CI already ran. **The completed merge is the signal** to remove that worktree and
move to the next ticket.

Stated by the user 2026-08-29.

**Why:** the PR exists for the CI run and the record, not for human review.
Leaving it open blocks nothing and only accumulates stale worktrees and branches,
which is how `main` ends up diverged across concurrent sessions — exactly what
had to be untangled on 2026-08-29, when two sessions held unpushed commits on the
same local `main`.

**Every merge is followed by landing it, in the same session** — stated by the
user 2026-08-29 after #231 merged and was left half-landed: bring the default
branch up to date, and move the ticket to **Done** in the tracker. Not "later",
not "`/land-lanes` will". A merged PR whose row still reads `Backlog` or
`In Progress` on `origin/main` is work the next unattended batch will start over.

The main checkout is routinely diverged at that moment: the lane branched before
the session's own tracker commit, so local `main` holds an unpushed transition
while the remote holds the squash. `git rebase origin/main` — `git pull
--ff-only` just fails there, and `reset --hard` drops the local commit silently.
Squash a superseded `In Progress` commit into the landing commit instead of
pushing both. Finish by checking `git rev-list --left-right --count
main...origin/main` reads `0 0`. Encoded in `~/.claude/skills/ticket/references/workflow.md`
section 7 and the status-record rules in `~/.claude/orchestration-policy.md`.

**How to apply:**

- One ticket, one branch, one worktree under `.claude/worktrees/<name>`.
  `.worktreeinclude` copies the gitignored env files in; run `pnpm install` in
  the worktree or the pre-commit hook fails with `tsx: command not found`.
- Open the PR, let CI run, merge it, then delete the worktree, the local branch
  and the remote branch in the same step. Do not leave a merged worktree lying
  around while starting the next ticket.
- Never work two tickets in one worktree, and never commit ticket work directly
  on local `main` — that is what produced the divergence above.
- Merging to `main` ships to **staging**, not to users. Reaching production is a
  separate deliberate fast-forward of the `production` branch — see
  [[vendor-marketplace-vercel-deployment]].

Related: [[adhoc-work-single-commit]], [[commit-ticket-changes-immediately]]
