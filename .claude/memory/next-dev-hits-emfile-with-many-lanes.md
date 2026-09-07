---
name: next-dev-hits-emfile-with-many-lanes
description: With several lanes live, `next dev` dies on EMFILE and every page 500s — build and `next start` for a browser pass instead
metadata:
  type: project
---

With six lanes running, `pnpm dev` in a lane produced a wall of

> Watchpack Error (watcher): Error: EMFILE: too many open files, watch

and **every web route answered 500** while the API on the same lane was healthy
on its own port. Seen 2026-09-07 in lane 432.

`apps/web`'s dev script already runs `ulimit -n 65536`, so raising the limit is
not the remedy — the ceiling is process-wide across the machine, and each Next
dev watcher claims descriptors for the whole tree.

**For a browser pass, build once and serve the build:**

```
pnpm build
pnpm lane:exec <n> -- pnpm --filter @vendor-marketplace/api start
pnpm lane:exec <n> -- pnpm --filter @vendor-marketplace/web exec next start --port <web port>
```

No watchers, no recompilation, and flat memory — which also answers the other
half of this problem, that a `next dev` server left up across many recompiles
grew to 4.2GB in one lane and OOM-killed four background processes.

**The reason this matters beyond speed:** an EMFILE 500 looks exactly like the
change under test breaking the page. A browser pass driven against it reports
defects that are not there, or none at all — see
[[guard-a-delegated-browser-pass-with-a-liveness-watch]]. Probe with `curl`
before trusting either answer, and kill only your own ports
([[kill-dev-servers-by-lane-port]]).
