# Parallel Lane Execution — Design

**Date:** 2026-08-28 (database isolation amended 2026-08-29)
**Status:** Approved design, pending implementation plan
**Scope:** `~/.claude` workflow skills, this repo's lane tooling, GitHub repo settings

## Problem

Ticket execution is single-threaded by default. `--worktree` exists on `/ticket`
and `/next-ticket` but is opt-in, and the isolation it promises is not real:

1. **Port isolation is documented, not executed.** `ticket/references/workflow.md`
   instructs the model to "derive a deterministic offset (hash mod 100 + 1)".
   Nothing runs that. `apps/api` reads `env.PORT`; `apps/web/next.config.ts`
   reads `NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'`. A second lane that
   moves its API to 4042 still serves a web app calling **lane 1's API on 4000**,
   and browser verification passes while testing the wrong process.
2. **All lanes share one database and one pair of E2E accounts.**
   Concurrent `browser-verifier` runs mutate the same rows as the same users, so
   a red lane cannot be distinguished from another lane's writes.
3. **`verify-and-ship` merges before CI is green,** then watches CI afterwards.
   Five lanes doing that lands red commits on `main`.
4. **`node_modules` isolation is broken.** `worktree.symlinkDirectories:
   ["node_modules"]` symlinks only the 1.0G root tree. `apps/*/node_modules` and
   `packages/*/node_modules` are separate real directories that a fresh worktree
   does not get, so pnpm workspace resolution is incomplete in every lane — and
   the only in-lane fix, `pnpm install`, writes through the symlink into state
   every other lane depends on.

## Goals

Three to five ticket lanes running concurrently in isolated worktrees, each
carrying the full quality gate — tests, lint, typecheck, build, adversarial
review, real-browser verification — and landing without human review.

## Non-goals

- Code review by a human or a required PR approval. Solo repo; CI is the gate.
- Cross-lane coordination of product decisions. A blocked lane escalates.
- Running lanes on anything but the local machine.

## Invariants

These are the constraints every part of the design answers to.

1. **`main` is never broken.** Not transiently, not between two independently
   green PRs. This is structural, not procedural.
2. **No lane mutates state another lane reads.** Not `node_modules`, not the
   developer's own database, not the main checkout's working tree or git state, not
   another lane's ports.

   The single deliberate exception is `.claude/lanes/`, which exists precisely
   to be shared coordination state. It is gitignored, holds one file per lane,
   and every write is either `O_EXCL` or taken under the allocation lock — so
   no lane can observe a torn or half-written value. Nothing else in the main
   checkout is writable by a lane.
3. **Isolation is executable.** Every isolation claim is enforced by a script,
   hook, or platform rule — never by a paragraph asking a future session to
   remember. Per `~/.claude/CLAUDE.md`: prefer an executable guard over a
   written rule.

## Lane model

A **lane** is one ticket, and owns exactly:

| Resource | Value |
| --- | --- |
| Worktree | `.claude/worktrees/<ticket-id>/` |
| Git branch | created by the native worktree off `main` |
| Database | `vendor_marketplace_lane_<ticket>`, on the local Docker container |
| API port | allocated, recorded |
| Web port | allocated, recorded |
| Manifest | `.claude/lanes/<ticket-id>.json` in the **main checkout** |

The manifest lives in the main checkout, not the worktree, for two reasons:
lanes must see each other's claimed ports, and cleanup must still know what to
delete after the lane's session has exited.

Manifest fields: `ticket`, `branch`, `worktreePath`, `apiPort`, `webPort`,
`database`, `prUrl`, `state`, `createdAt`.

`state` is one of `active`, `pending-merge`, `failed`.

## Lane tooling

New scripts in `packages/preflight`, exposed as root package scripts.

### `pnpm lane:up <ticket-id>`

Run inside the lane's worktree.

1. **Acquire the allocation lock.** `mkdir .claude/lanes/.lock` — atomic on
   POSIX — with bounded retry and backoff. Released in a `finally`.
2. **Allocate ports.** One offset drives both ports, so a lane's pair is easy
   to reason about:

   ```
   offset  = (stableHash(ticketId) mod 40) + 1     // 1..40
   webPort = 3000 + offset                          // 3001..3040
   apiPort = 4000 + offset                          // 4001..4040
   ```

   The offset is a deterministic first guess, so a lane's ports are reproducible
   across restarts. If either port of the pair is claimed in an existing
   manifest or has a live listener, increment the offset and retry, wrapping
   within 1..40. Exhausting all 40 is an error, not a silent fallback — at a
   ceiling of 5 lanes it cannot occur, and if it does, something is leaking.

   Deterministic to be reproducible; probed to be collision-proof; paired so
   `NEXT_PUBLIC_API_URL` is always derivable from the lane's own offset.
3. **Write the manifest** with `O_EXCL`, then release the lock. An existing
   manifest for this ticket means the lane is already up: reuse it, do not
   reallocate.
4. **Create the lane database.** `docker exec vendor-marketplace-postgres
   createdb -U vendor_marketplace vendor_marketplace_lane_<ticket>`, then derive
   the lane's `DATABASE_URL` by swapping only the database name on the
   developer's own base URL.

   **Not a Neon branch.** Local development moved off Neon in `5ca9a5f`: an
   always-open `pnpm dev` pool keeps a Neon compute from scaling to zero, and a
   few days of it paces ~375h/month against a 100 CU-hour per-project cap whose
   exhaustion suspends the compute shared with production. Five lanes multiply
   exactly that. A database on the one local container costs nothing, needs no
   network, and is created instantly.
5. **Emit `.env.lane`** in the worktree — gitignored, shell-sourceable:

   ```
   PORT=<apiPort>
   WEB_PORT=<webPort>
   NEXT_PUBLIC_API_URL=http://localhost:<apiPort>
   DATABASE_URL=<lane database url>
   ```

   `DATABASE_URL_UNPOOLED` and `NEON_BRANCH` are deliberately **absent**. They
   describe a Neon deployment; the env registry marks both optional for
   `local`, and setting them against the Docker container fails the gate on a
   correctly configured machine.

6. **Install.** `pnpm install` in the worktree, against its own real
   `node_modules` (see *Dependency isolation*).
7. **Build the workspace packages.** `pnpm build --filter=./packages/*`. A fresh
   worktree has no `dist/`, so every `@vendor-marketplace/shared` import fails to
   resolve and the migration cannot run. Apps are excluded: a lane runs dev
   servers, and building them costs minutes for output nothing reads.
8. **Migrate and seed** the lane's own database through `lane:exec`.

### `pnpm lane:exec <ticket-id> -- <command>`

Sources `.env.lane` into the process environment, then execs the command.

This indirection is required, not stylistic. `packages/db/src/load-env.ts`
loads only the repo-root `.env` and a package-local `.env` — it never reads
`.env.local` — and dotenv does not overwrite variables already present in the
real process environment. Exporting into the environment is therefore the only
override channel that reaches both the Fastify API and Next.js reliably.

All lane dev servers, migrations, seeds, and browser verification run through
`lane:exec`.

### `pnpm lane:down <ticket-id>`

Stop the lane's dev servers, `dropdb --if-exists` for the lane database, remove
`.env.lane`, remove the manifest. Idempotent: a missing resource is not an error.

### Application change

Both apps read `PORT`, and Turbo hands every task the same environment. One
line in `apps/web/package.json`:

```
"dev": "next dev -p ${WEB_PORT:-3000}"
```

This is the only application-code change in the design. The default keeps
non-lane development on 3000 unchanged.

## Dependency isolation

Remove `worktree.symlinkDirectories` from `.claude/settings.json`. Each lane
runs a real `pnpm install` into its own `node_modules`.

pnpm hardlinks package contents from the global content-addressed store at
`~/Library/pnpm/store/v10`, so N lanes cost far less disk than N x 1.0G, and
concurrent installs against that store are safe by design — pnpm locks it. The
hazard was never the store; it was the shared `node_modules` *directory*.

Consequence: a ticket that changes dependencies is **not** disqualified from
parallel dispatch.

## Worktree by default

`worktree_mode` defaults to `true` in `/ticket` and `/next-ticket`.

- `--no-worktree` is the escape hatch: documentation-only tickets, tracker
  edits, and hotfixes that must land on `main` directly.
- `--worktree` remains accepted as a no-op alias, as does `--isoworktree`.
- `ticket/references/workflow.md` section 2 is restructured so worktree mode is
  the primary path and standard mode the documented exception.

## Delivery: main cannot break

Auto-merge alone is insufficient. Two lanes can each be green against an older
`main`, both merge, and `main` breaks semantically with neither PR ever red.
GitHub's merge queue is the structural fix: it builds each PR against `main`
plus everything ahead of it in the queue and merges only if *that* combination
passes.

### One-time repository configuration

1. `gh repo edit --enable-auto-merge --delete-branch-on-merge`
   (currently `allow_auto_merge: false`, `delete_branch_on_merge: false`).
2. A ruleset on `main` requiring the CI `verify` check **and** requiring the
   merge queue. No reviewer requirement — this adds no review ceremony.
3. **`.github/workflows/ci.yml` gains a `merge_group:` trigger.** Without it the
   queue blocks forever waiting on a required check that never runs for the
   queue's temporary branches. The existing `concurrency` group keys on
   `github.ref` and remains correct.

The repo is public, so rulesets and merge queue are available on the current
plan.

### Lane delivery sequence

`verify-and-ship` worktree mode becomes:

1. Commit on the lane branch.
2. `git push -u origin <branch>`.
3. `gh pr create --base main --head <branch>` with ticket context.
4. `gh pr merge --squash --auto` — enqueues and returns immediately.
5. Record the PR URL in the manifest, set `state: pending-merge`, return.

The lane does **not** wait for CI. It does not merge. It does not delete its own
worktree.

### Fallback, specified rather than assumed

If merge queue proves unavailable on this plan, `/land-lanes` serializes
instead: for one lane at a time — update the branch onto `main`, wait for CI,
merge on green, then move to the next. Slower, identical guarantee. The rest of
the design is unchanged.

## New terminal state

Because the lane now exits before its merge, `COMPLETED` no longer describes the
outcome. The status record in `~/.claude/orchestration-policy.md` gains:

- `STATUS: PENDING_MERGE` — work delivered, PR enqueued, merge not yet observed.
- `PR: <url>` — a new line, present whenever a PR was opened.

`COMPLETED` remains correct for `--no-worktree` tickets that land on `main`
directly, and for lanes confirmed merged by `/land-lanes`.

The ticket moves to Done only when `/land-lanes` observes the merge and records
the squash SHA.

## New skill: `/land-lanes`

Asynchronous merging makes a sweep mandatory; without it worktrees and lane
databases accumulate without bound.

For each manifest in `.claude/lanes/`:

| PR state | Action |
| --- | --- |
| Merged | `pnpm lane:down`, remove the worktree, move the ticket to Done with the squash SHA, delete the manifest |
| CI failed / dequeued | Report the failing job. **Keep** the worktree and lane database so `/ticket <id>` resumes in place. Set `state: failed` |
| Queued or open | Report as waiting. Take no action |
| No PR, worktree dirty | Report as abandoned work. Never delete |

Runs against the main checkout, which it is allowed to update (`git pull
--ff-only`) — it is one of the only two things that may.

## Skill integration

Skills are attached at the workflow step where they pay for themselves, not
uniformly.

| Workflow step | Skill | Rationale |
| --- | --- | --- |
| 3, plan | `superpowers:brainstorming` then `writing-plans`, **only** when the ticket is ambiguous or spans more than three packages | Routine tickets should not pay spec ceremony |
| 4, implement | `superpowers:test-driven-development` | Formalizes the RED-then-GREEN loop the step already describes |
| 4, implement | `karpathy-guidelines` | Its *Surgical Changes* rule is the direct lever on parallel throughput: scope creep is what makes two lanes touch one file and collide at merge |
| 4, new UI | `frontend-design` | Before `parity-checker`, so the frame is met by design rather than by correction |
| Stuck, 2+ failed attempts | `superpowers:systematic-debugging` | The workflow currently says nothing about being stuck |
| 5, review | The existing ladder: `/simplify`, then `diff-reviewer`, then `security-auditor`, then `/code-review high` for money, auth, migrations, webhooks | Already on disk; unchanged |
| 7, ship | `superpowers:verification-before-completion` | Gate immediately before the status record is emitted |
| After a fleet lands | `/hunt-bugs` | Integration defects that no single lane can observe |

`karpathy-guidelines` is vendored into `~/.claude/skills/karpathy-guidelines/`
from `multica-ai/andrej-karpathy-skills` (MIT), rather than pasted inline, so it
updates as a unit and is invocable by name.

## `/orchestrate` changes

- Lane count: default 3, ceiling 5.
- Fleet preflight gains: the `main` ruleset exists; auto-merge is enabled;
  `ci.yml` has a `merge_group` trigger; `neonctl` is authenticated;
  `.claude/lanes/` holds no stale manifests; `.worktreeinclude` covers the
  gitignored files a lane needs.
- **Independence check gets teeth.** `Explore` returns each candidate ticket's
  predicted file set. Two candidates whose sets intersect are not both
  dispatched; the higher-priority one runs and the other stays queued.
- Landing delegates entirely to `/land-lanes`.

## Files changed

**Global (`~/.claude`)**

- `skills/ticket/SKILL.md` — default worktree mode on
- `skills/next-ticket/SKILL.md` — default worktree mode on
- `skills/ticket/references/workflow.md` — restructured section 2; lane tooling;
  skill attachment points; `PENDING_MERGE`
- `skills/verify-and-ship/SKILL.md` — `--auto` delivery, no CI wait, no self-cleanup
- `skills/orchestrate/SKILL.md` — preflight, independence, delegation to `/land-lanes`
- `skills/land-lanes/SKILL.md` — new
- `skills/start/SKILL.md` — boot through `lane:exec`
- `skills/karpathy-guidelines/` — vendored
- `orchestration-policy.md` — invariants, `PENDING_MERGE`, `PR:` line

**Repository**

- `packages/preflight/src/lane/` — allocator, manifest, database lifecycle, CLI
- `packages/preflight/src/lane/*.test.ts` — unit tests
- `package.json` — `lane:up`, `lane:down`, `lane:exec` scripts
- `apps/web/package.json` — `next dev -p ${WEB_PORT:-3000}`
- `.claude/settings.json` — remove `worktree.symlinkDirectories`
- `.gitignore` — `.claude/lanes/`, `.env.lane`
- `.github/workflows/ci.yml` — `merge_group:` trigger
- `CLAUDE.md` — lane commands table, parallel-execution law

**GitHub**

- Repo settings: auto-merge, delete-branch-on-merge
- `main` ruleset: required `verify` check, merge queue

## Testing

Unit, in `packages/preflight`:

- Port allocator returns the deterministic first guess when free.
- Port allocator skips a port claimed by an existing manifest.
- Port allocator skips a port with a live listener.
- Two concurrent allocations under the lock never return the same port.
- Manifest round-trips every field.
- `O_EXCL` claim on an existing manifest reuses rather than reallocating.
- `lane:down` is idempotent against a missing database and a missing manifest.
- `lane:exec` puts `.env.lane` values into the child environment, and the lane
  file **wins** over an inherited process-environment value of the same name.

  This is the opposite of dotenv's precedence, and deliberately so. The lane
  file exists to override; if an inherited `PORT=4000` beat it, a lane launched
  from a shell that had sourced the root `.env` would silently bind the shared
  ports and isolation would fail exactly where it matters. Because `lane:exec`
  sets the values in the child's real environment, `loadEnv`'s dotenv pass then
  declines to overwrite them, which is the behaviour the apps need.

`docker` is mocked at the process-spawn boundary in all of the above.

Integration proof, run once by hand and recorded in the plan:

- Dispatch three lanes. Assert each lane's web app calls **its own** API port —
  this is the defect that exists today and the single clearest signal the
  isolation is real.
- Assert each lane's writes are invisible to the other two.

## Rollout order

Each step leaves the repository working.

1. Vendor `karpathy-guidelines`. No behavior change.
2. Lane tooling plus tests, `apps/web` port flag, `.gitignore`. Nothing consumes
   it yet.
3. Remove the `node_modules` symlink; verify one worktree installs and boots.
4. GitHub configuration: auto-merge, ruleset, `merge_group` trigger. Verify with
   one throwaway PR that the queue runs `verify` and merges.
5. `/land-lanes`, plus `PENDING_MERGE` in the policy.
6. Flip `worktree_mode` to default; rewrite `verify-and-ship` delivery.
7. `/orchestrate` preflight and independence check.
8. Run three real lanes. Record what broke and close that class per the
   self-improving-workflow section of the policy.

## Risks

| Risk | Mitigation |
| --- | --- |
| Merge queue unavailable on this plan | Serialized `/land-lanes` fallback, specified above |
| Abandoned lane databases accumulate on the container | `/land-lanes` reports orphans; `/orchestrate` preflight fails on stale manifests. Local databases cost only disk, not quota |
| Five headed browsers exceed local resources | Ceiling of 5 lanes; browser verification is the heaviest phase and lands last in each lane, so overlap is partial |
| A lane edits the main checkout | Invariant stated in the policy and in `CLAUDE.md`; a lane operates within its worktree and writes nothing in the main checkout but its own `.claude/lanes/` manifest |
| Disk growth from per-lane `node_modules` | pnpm hardlinks from the shared store; `/land-lanes` removes worktrees promptly |
