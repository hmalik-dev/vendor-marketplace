---
name: ticket-worktree-merge-immediately
description: "Every /ticket invoke must merge the PR, close the lane and bring main up before it may report done — PENDING_MERGE is not a terminal state and /land-lanes is not a handoff"
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

## The hard gate — restated 2026-08-29 after lane 198 stopped at `PENDING_MERGE`

**Merge, close the lane, and bring `main` up. Always. Every invoke.** These three
are a single hard gate that `/ticket`, `/next-ticket` and `/orchestrate` must
pass before reporting the work done. `PENDING_MERGE` is **not** a terminal state
and `/land-lanes` is **not** a handoff the invoking session may defer to — it
exists only for lanes whose session died before the queue reached them.

This overrides `~/.claude/orchestration-policy.md` and
`~/.claude/skills/ticket/references/workflow.md` section 7, both of which still
say a lane "exits at `PENDING_MERGE`" and leaves the merge to `/land-lanes`.
Where those files and this rule disagree, this rule wins.

**Why:** a lane that stops at the enqueue leaves the ticket row saying
`In Progress` on `origin/main`, the worktree on disk, and the branch alive — so
the next unattended batch re-selects work that is already written, and the
operator cannot tell finished work from abandoned work. Lane 198 was reported as
delivered while `main` still had none of it.

**Expect the PR to be `BEHIND` by the time you get there** — a real ticket takes
long enough that another lane lands first. Merge `origin/main` into the lane
branch, **re-run the full gate on the merged result** (it is new code that no CI
run has seen), push, and only then merge. Never force-push; the hook blocks it.

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

- The gate, in order, every invoke: watch CI green → merge `origin/main` into the
  lane and re-run the gate if the PR is `BEHIND` → merge the PR → move the ticket
  to **Done** with the squash SHA → `pnpm lane:down <id>` → remove the worktree,
  the local branch and the remote branch → bring the main checkout to
  `origin/main` → confirm `git rev-list --left-right --count main...origin/main`
  reads `0 0`. Only then report the status record.
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
