# Lane infrastructure — the finding that still needs an owner

From the #74 lane, 2026-08-29. Four lanes hit the same set of lane-tooling
defects independently. Most are now owned; **one is not**, and it is recorded
here because appending a Status Board row while three lanes were editing
`vendor-marketplace-tickets.md` is the one edit guaranteed to conflict.

## Already owned — do not re-file

| Defect                                                                   | Owner                                                    |
| ------------------------------------------------------------------------ | -------------------------------------------------------- |
| `lane:up` reads `DATABASE_URL` from the ambient env and never loads `.env` | **#231** (lane 165); fixed on lane 67's `worktree-67`     |
| `laneUp`'s `alreadyUp` short-circuit prints `✓` for an unprovisioned lane  | **#231** (lane 165); fixed on lane 67's `worktree-67`     |
| Web dev server binds the API's `PORT`, so the API dies with `EADDRINUSE`   | **#230** (lane 165)                                      |
| `pnpm install` aborts without a TTY (`..._NO_TTY`)                        | fixed on lane 67's `worktree-67` (`pnpmInLane` sets `CI=true`, which also pins the lane to the committed lockfile — independent of the symlink below) |
| `.gitignore`'s `node_modules/` does not match a symlink                   | fixed on lane 67's `worktree-67` (trailing slash removed) |

---

## Unowned — a lane's `node_modules` is a symlink to the main checkout's

This is the shared mutable state the orchestration policy explicitly forbids:
*"Do **not** symlink `node_modules` between lanes. A symlinked tree is shared
mutable state, and the one command that repairs a lane's resolution writes
through it into every other lane."*

The worktree has no tree of its own:

```
$ ls -ld node_modules
lrwxr-xr-x  node_modules -> /Users/humza/Documents/vendor-marketplace/node_modules
```

So `pnpm install` from inside a lane writes straight into the main checkout. It
reports `Recreating /Users/humza/Documents/vendor-marketplace/node_modules`, and
`stat` confirms only that path's mtime moves. Four lanes each running an install
take turns deleting and recreating the tree the other three are importing from.

The symptom this produced has been fixed, but **only the symptom**: lane 67
removed the trailing slash from `.gitignore`'s `node_modules/`, so the symlink
stops being staged. That does not stop a lane's install from mutating its peers.

(Lane 67's other change — `pnpmInLane` passing `CI=true` — is **not** a fix for
this and should not be read as one. `pnpm install` aborts with
`ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY` because it wants to replace
`node_modules` and has no TTY to confirm, and `CI=true` also pins the install to
the committed lockfile, which is what a lane should build against either way.
The TTY problem still exists on a genuinely fresh worktree once the symlink is
gone, so that fix stands on its own.)

**What the symlink does NOT do — checked, because the fear is worse than the
fact.** It is the **root** `node_modules` only. Each app and package has its own
real directory, and its workspace links are **relative**, so they resolve inside
the lane:

```
apps/web/node_modules                                   (real directory)
apps/web/node_modules/@vendor-marketplace/config  ->  ../../../../packages/config
  realpath: /Users/humza/.../.claude/worktrees/74/packages/config
```

Verified by resolving that link and reading the file through it: `apps/web` sees
this worktree's `theme.css`, `--text-base--line-height: normal` and all. So a lane
**does** compile and test its own source, and a lane's `dist/` does not leak into
its peers through this link. A stale `dist/` still breaks a lane, but the cause is
the worktree's own unbuilt `packages/*/dist`, not the shared tree — do not go
hunting in the wrong place for it.

What is genuinely shared is the third-party dependency store, which is what makes
a lane's `pnpm install` a fleet-wide write.

**Fix direction.** Whatever creates the worktree should give each lane a real
`node_modules`, or worktrees should live outside the repository root so the
symlink is unnecessary. A test should assert that `node_modules` inside a lane
worktree is a directory, not a symlink.

**Until then:** stage explicit paths in a lane, never `git add -A`, and treat any
`pnpm install` inside a worktree as a write the whole fleet sees.

---

## Related to #230 — the lane env carries no web origin, so the API blocks CORS

Same root as the `WEB_PORT` defect and probably belongs in #230's fix. `.env.lane`
writes only `PORT`, `WEB_PORT`, `NEXT_PUBLIC_API_URL` and `DATABASE_URL` — no
`WEB_URL`. The API's CORS allowlist is therefore built for the default origin, not
the lane's, and every browser fetch from the lane web app is refused:

```
Access to fetch at 'http://localhost:4023/vendors?category=photography&...'
from origin 'http://localhost:3023' has been blocked by CORS policy:
No 'Access-Control-Allow-Origin' header is present on the requested resource.
```

The endpoint itself is healthy — `curl http://localhost:4023/vendors?pageSize=3`
returns seeded vendors — so this is origin configuration, not a broken route.

**Why it matters beyond inconvenience:** the search grid renders `0 photographers`
and `Could not load vendors just now.` instead of results. A browser agent that
does not read the console sees a plausible empty state rather than a failure, and
**frame `02 Search` cannot be parity-checked at all** — its result card, 19px title
and availability chip are unmeasurable. #74's parity pass recorded them as
unmeasured for exactly this reason. Do not accept a frame-02 parity pass until the
grid renders.

## Not a defect, but it costs time to rule out

`next dev` and `next build` contend over `apps/web/.next`. With the lane's dev
server running, `pnpm build` fails with `Failed to build /sitemap.xml/route …
took more than 60 seconds` on all three attempts, and the dev server can die
silently — which reads exactly like a real build failure, and like a dead server
to any browser agent pointed at it afterwards. Stop dev before building, and
re-check both ports before trusting a browser pass.

**Stopping dev is not always enough — the damage can outlive the race.** Lane 66
hit a corrupt webpack cache after a build raced its dev server: `Error: invalid
stored block lengths`, then `GET /search 404 in 311233ms` — a 404 after five
minutes, served by a process that looked perfectly healthy. Recovery needed
`rm -rf apps/web/.next`. **The symptom is the trap:** slow 404s from a live server
read as an application routing bug, and a browser agent will happily file them as
findings against whatever ticket is in flight. If a lane starts serving slow 404s
after any build/dev overlap, clear `.next` before believing anything it says.
Check for it with `grep 'invalid stored block lengths'` in the dev log and by
timing a known-good route; a healthy lane serves its landing page in well under a
second once warm.
