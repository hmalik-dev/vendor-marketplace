---
name: a-lane-web-build-must-be-made-under-the-lane-env
description: A lane's web app reads API_URL server-side and inlines NEXT_PUBLIC_API_URL at build time — preflight now asserts both, and a stale lane env is repaired by lane:up in place
metadata:
  type: project
---

A lane's web app reaches the API by **two different variables**, and getting
either wrong points the whole lane at port 4000:

- `API_URL` — read at request time by `apps/web/src/lib/api-client.ts` for every
  **Server Component** fetch.
- `NEXT_PUBLIC_API_URL` — **inlined into the bundle at build time**, and the
  value the CSP's `connect-src` is derived from.

`renderLaneEnv` wrote only the public one until 2026-09-07 (`1e899ae1`), so the
root `.env`'s `API_URL=http://localhost:4000` won for every server-side read.
Lane 432's `/admin/*` routes all rendered the 500 page and the cause read as a
defect in the change under test.

**`pnpm preflight` now asserts both axes** (#448, `36683a21`), so neither is
something to remember to check:

- The **file shape** — `.env.lane` carries `API_URL`, `NEXT_PUBLIC_API_URL` and
  `WEB_URL` pointing at this lane's own ports.
- The **built origin** — the `connect-src` baked into
  `apps/web/.next/routes-manifest.json` (and `.next-dev/`) names this lane's API.
  Read off the build, not off a running server: preflight runs *before* the dev
  servers, so a `curl` finds nothing listening in the very flow it gates and
  cannot tell that from a server still cold-compiling — it would have to pass
  both, which is the defect reproduced inside its own fix.

Still build through the lane, because the assertion tells you afterwards:

```
pnpm lane:exec <n> -- pnpm build --filter=./apps/web
```

**A stale `.env.lane` is repaired by `pnpm lane:up <n>` — in place, database
kept.** Do not run `lane:down`; it drops the lane database and takes the E2E
fixtures with it. Until #448, `laneEnvAgreesWith` compared only the two ports
and `NEXT_PUBLIC_API_URL`, so a file missing `API_URL` still *agreed* with its
manifest and a resume never rewrote it — see
[[an-idempotence-check-must-compare-everything-it-writes]].

Also true, and cheaper than reasoning about it: a lane whose server-side reads
go elsewhere renders `/vendors/<seeded slug>` as **404**, because the seeded
vendor exists only in the lane database. See
[[next-dev-hits-emfile-with-many-lanes]] for why a build is being served at all.

## A port answering 200 does not mean it is serving *your* build

After rebuilding, a **stale `next start` still holding the lane's port** makes the
new `pnpm start` exit `EADDRINUSE` — **in the background log, where nobody is
looking** — while the port keeps answering 200 from the *old* build. The E2E
suite then runs against code that no longer exists and fails in ways that read as
product defects. Three failures were misread that way before the log was checked
(lane #464, 2026-09-08).

**The tell is that the failures look like real defects and the server looks
healthy**, because it is healthy — it is just the wrong one.

**How to apply:** after any rebuild, confirm the process serving the port is the
one you just started — check the start command's own exit, or kill the port
*before* starting and assert it is free. A 200 proves something is listening; it
proves nothing about what it is listening with.

Sibling of the API half already recorded here, and of #454's stale-API case where
the web was current and the API predated the rebase.
