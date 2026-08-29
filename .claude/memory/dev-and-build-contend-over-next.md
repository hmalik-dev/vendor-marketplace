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

Related: [[vendor-marketplace-playwright-verification]],
[[ticket-worktree-merge-immediately]]
