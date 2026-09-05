---
name: lane-manifest-branch-drifts
description: "A lane is homed wherever `lane:up` is invoked — cli.ts takes the worktree from process.cwd(). Run it from inside the worktree, or the lane lands on main in the shared checkout"
metadata:
  type: project
---

A lane manifest's `branch` and `prUrl` fields are written at `lane:up` time and
are not kept current. Both lanes reconciled on 2026-08-29 (#66, #67) had
`"prUrl": null` and `"branch": "lane/<n>"` while the real branches were
`worktree-<n>` and the real PRs were #8 and #10. The worktrees were created
before `pnpm lane:up` ran, so the `lane/<n>` ref was never created at all.

**Why:** `/land-lanes` reads `prUrl` to decide a lane's fate. Taken at face
value, a null `prUrl` classifies a merged lane as "abandoned work" and leaves
its worktree and database to accumulate — the exact unbounded growth the skill
exists to prevent.

**Fixed at the source on 2026-08-29**, after lane 198 hand-edited the JSON to be
landable:

- `laneUp` reads the branch from `git symbolic-ref --short HEAD` in the worktree
  instead of composing `lane/<ticket>`, a name nothing creates.
- **`pnpm lane:pr <ticket> <url>`** records the PR and sets `pending-merge`
  through the same atomic `updateManifest` every other change uses. Run it at
  delivery; never hand-edit `.claude/lanes/<n>.json`.

## The fix is real but its input is cwd — this still bites (2026-08-29, parity run)

`packages/preflight/src/lane/cli.ts:22` is `const worktree = process.cwd()`.
Every lane command resolves the worktree from **where you invoked it**, not from
the manifest. So the branch really is read from git — but read in whatever
checkout you happened to be standing in.

Consequences seen in one run of four parallel lanes:

- A lane bootstrapped from the repo root recorded `"branch": "main"` and
  `worktreePath` = the repo root, and was **genuinely unisolated** — it had no
  worktree at all, so its commits would have landed on `main` in the shared
  checkout, sweeping up whatever else was dirty there. That is the failure
  `b1b8e7c` and `1bd37ab` already caused once.
- `laneDown` (`cli.ts:48`) takes cwd the same way, so `rmSync(cwd/.env.lane)`
  deletes the env of whichever lane is homed there. One lane's `.env.lane`
  vanished mid-run; its API then read a stale copy, bound another lane's port
  and died with `EADDRINUSE`.

**How to apply:** always `cd` into the lane's worktree before `pnpm lane:up
<n>` / `lane:down <n>`, and verify afterwards that the manifest names a real
worktree, not the repo root — `jq -r '.branch + " @ " + .worktreePath'
.claude/lanes/<n>.json` against `git worktree list`. A manifest pointing at the
repo root means that lane is not isolated; fix it before it commits, not after.
A manually created worktree also gets none of `.worktreeinclude`'s gitignored
files, so copy `.env*` and `.auth/` in before `lane:up`, or it fails deriving
the lane database. See [[ticket-worktree-merge-immediately]] and
[[worktree-env-copies-drift]].

## `lane:pr` does not refresh `branch` — a rebase-renamed lane still lies (2026-09-05, #416/#407)

The 2026-08-29 fix above is narrower than it reads. **`laneUp` re-derives the
branch; `laneEnqueued` does not.** `packages/preflight/src/lane/lane.ts:463` is

```ts
export function laneEnqueued(mainCheckout, ticket, prUrl) {
  return updateManifest(mainCheckout, ticket, { prUrl, state: 'pending-merge' });
}
```

— `prUrl` and `state`, and nothing else. `laneUp` (same file, ~377) *does*
re-derive it, and its own comment says why: "a branch can be renamed after the
fact". So `lane:pr` closes the `prUrl` half of this memory's failure and leaves
the `branch` half exactly as it was.

**When it bites:** a lane that has to rebase. A rebase rewrites history, `git
push` is rejected, and the pre-push hook blocks the force-push — so the only
route is a new branch name (see [[diverged-lane-branch-needs-a-new-name]]).
`lane:pr` then records the new PR against the **old** branch name, and
`/land-lanes` reads the lane as abandoned work it correctly refuses to touch.
Observed on lane 407: manifest said `worktree-t407`, real branch was
`worktree-t407-rebased`.

**How to apply:** after any branch rename, `lane:pr` is not sufficient — check
`jq -r .branch .claude/lanes/<n>.json` against `git branch --show-current` in the
worktree and correct it with an atomic write if they disagree. The durable fix
is one line in `laneEnqueued`: take `branchOf(worktreePath)` the way `laneUp`
already does. Not done here because three lanes were mid-flight on `lane:pr` at
the time, and it is shared infrastructure.

**Not every lane needs the rename.** Where the branch is merely *behind*, leave
it alone: GitHub's own auto-merge merges main into the branch (a merge commit,
not a rewrite), which keeps the branch name, keeps the PR, and needs no force
push. #416 was put BEHIND twice and landed without a rename.
