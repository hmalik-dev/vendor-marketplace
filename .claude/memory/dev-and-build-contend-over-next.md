---
name: dev-and-build-contend-over-next
description: Running pnpm build while pnpm dev is up kills the web dev server silently
metadata:
  type: project
---

Never run `pnpm build` in a worktree where `pnpm dev` is already running. Both
write `apps/web/.next`, and the dev server dies without an error line — the log
just stops. `curl` on the web port then returns connection refused while the
API is still healthy, which reads exactly like the change under test being
broken.

Also: `pnpm dev` runs both apps in one turbo invocation, so when the web task
dies the whole run is torn down and the API goes with it. Starting the two
separately (`pnpm --filter @vendor-marketplace/api dev` and
`pnpm --filter @vendor-marketplace/web exec next dev --port <webPort>`) makes
them independent and survives a stray build.

**Why:** cost two silent outages during #67, one of them while a
`browser-verifier` agent was mid-run — its early results had to be discarded
because a pass against a dead server reports nothing and looks like a clean run.

**How to apply:** before starting a browser agent, curl both ports and confirm
200. Do not run builds while it works. If a verification result looks
inexplicably broken, check the servers are alive before believing the finding.

**The build that kills it is almost always the pre-commit gate's own.** That is
the sequencing nobody sees coming: you finish implementing, delegate the parity
pass, and then — correctly — start the gate, whose `pnpm build --force` lands in
the middle of the agent's run. It happened again on lane t384 (2026-09-05, #384)
to a session that had *read this file*, because "do not run builds while it
works" does not read as "do not run the gate yet". Either hold the build until
the agent reports, or arm the watch in
[[guard-a-delegated-browser-pass-with-a-liveness-watch]] and treat its firing as
your own doing rather than a peer's.

Related: [[vendor-marketplace-playwright-verification]],
[[ticket-worktree-merge-immediately]]

**`turbo typecheck build` in ONE invocation races the same directory** — and
this one is not about the dev server at all. Turbo runs the two concurrently,
the build wipes and regenerates `apps/web/.next/types/**`, and `tsc` reads the
directory mid-rebuild: 37 `error TS6053: File '.../.next/types/app/**/page.ts'
not found`, every one of them naming a route that exists and compiles. It reads
exactly like a broken tsconfig or a mangled route tree.

Run them as **separate commands** — `pnpm turbo build --force` then `pnpm turbo
typecheck --force` — and both are clean on the identical tree. Seen on lane
t372 (2026-09-06) while running the final gate, after the same two had passed
serially minutes earlier.

**How to apply:** never batch `typecheck` and `build` into one `turbo` call. A
`TS6053` naming a file under `.next/types` is this, not your diff — re-run the
two serially before believing it.
