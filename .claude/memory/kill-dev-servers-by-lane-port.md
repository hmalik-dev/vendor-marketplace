---
name: kill-dev-servers-by-lane-port
description: Never pkill a dev server by process name — it reaches every lane; kill by the lane's own port instead
metadata:
  type: feedback
---

`pkill -f "next dev"` kills **every lane's** web server, not yours.
`pnpm lane:exec <n> -- …` scopes the *environment*, not the process tree, so
every lane's Next server has an identical command line and a name-matched kill
cannot tell them apart.

Kill by the lane's port, which is the only discriminator: `lsof -ti :<webPort> |
xargs kill`. `pnpm lane:up` prints that port, and `.claude/lanes/<n>.json` holds
it.

**Why:** done on 2026-09-05 from lane t392 to relieve memory pressure, it took
down lanes t403 and t411 mid-browser-pass. Both recovered, and both said the
same thing about the cost: from inside the affected lane an unexplained SIGTERM
is indistinguishable from the ticket's own change crashing the app, so the
expensive part is not the restart but the debugging it invites. t403 had already
written it off as memory pressure before the warning arrived.

**How to apply:** kill by port, never by name. If you have already fired an
unscoped kill, say so to the live lanes immediately — `ListAgents` then
`SendMessage` — because the warning is what converts someone else's confusing
debug into a two-minute restart. Related: [[dev-and-build-contend-over-next]],
[[lane-429-renders-as-500]].

## Killing by port does not kill a `tsx watch` API — the watcher respawns it

Lane #464, 2026-09-08. `lane:down` refused with *"database is being accessed by
other users"*. `pg_stat_activity` named one idle `postgres.js` session mid-`select
from bookings` — the payout sweep. **Port 4034 read free and the connection was
still there.**

**The lane API runs under `tsx watch`.** Killing the listener by port kills the
**child**; the watcher notices and respawns it. So the port is momentarily free,
the process is back, and its pool connection never closed.

**What clears it: kill the whole group, scoped by the worktree path.**
`ps aux | grep worktrees/<n>` returned seven pids, all under that path. Kill
those — **never an unscoped `pkill`**, which reaches every other lane. Then the
session count goes to 0 and `lane:down` succeeds first try.

**A free port is not a dead process when a watcher owns it.** Check the database's
own view (`pg_stat_activity`) or the process list, not the port.

**Built-output lanes are genuinely exempt, and the mechanism says why.** A lane
running `node dist/index.js` and `next start` has **no watcher**, so nothing
respawns a killed child. `tsx watch` is the entire hazard. Verified three ways on
lane #462 (2026-09-08): 0 processes under the worktree path, 0 rows in
`pg_stat_activity` for the lane database, 0 listeners on its ports.

**The port tells you whether something is *listening*; `pg_stat_activity` tells
you whether something is *alive*.** A free port is the reading that lies — it is
exactly what a respawning watcher looks like between kills. Ask the database.

**And do not decide this from what you believe you ran.** "I used the built
output" is a claim about the past; the query is a fact about now. Ask either way.

The lane's own caveat is worth keeping: three checks agreeing on **zero** have the
same shape as three checks looking in the wrong place. The `pg_stat_activity`
count is the one that carries weight, because it is a positive query against a
**named** database — it would have to be wrong about a specific thing rather than
merely fail to match.
