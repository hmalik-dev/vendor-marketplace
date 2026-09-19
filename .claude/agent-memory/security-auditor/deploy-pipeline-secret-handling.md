---
name: deploy-pipeline-secret-handling
description: VEN-397's deploy.mjs redacts child stdout/stderr and passes a picked env, but PhaseError messages built from argv are unredacted
metadata:
  type: project
---

`scripts/deploy.mjs` is sound on the sinks that exist: `run()` line-buffers the
**child's** stdout and stderr through `redact` before `write`, children get only
`pick(env, TOOL_ENV)` plus the one credential the phase needs, `migrate` refuses
to start if `DATABASE_URL` is set beside `DATABASE_URL_UNPOOLED`, and preflight
receives only `HAS_*` booleans. `deploy.yml`'s `workflow_run` is gated on
`conclusion == 'success' && event == 'push'` with `branches: [main]`,
`permissions: contents: read` and a checkout pinned to `workflow_run.head_sha` —
a fork's PR CI run is `pull_request` and cannot reach it.

**Why the one soft spot matters:** the `PhaseError`s thrown from `run()` quote
`command` and `args.join(' ').slice(0, 60)`, and `main()` prints a `PhaseError`'s
words verbatim to `::error::` — **not** through `redact`. That is safe only
because every credential travels in `env` via `API_HOSTS[*].credentialVariable`.

**How to apply:** a new `API_HOSTS` adapter whose `commands()` puts a token in
argv (`--token`, `--api-key`) leaks it into the Actions log on the failure path.
Credentials go in `credentialVariable`, never in `commands`. Also settled:
`pnpm db:seed` here is `packages/db/src/scripts/seed.ts` — reference data and US
cities only, fabricates no identity, correctly outside
[[fabricating-seeds-share-one-declared-branch-guard]].
