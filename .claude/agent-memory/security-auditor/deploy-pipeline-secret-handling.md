---
name: deploy-pipeline-secret-handling
description: deploy.mjs redacts child output and scopes env per phase; VEN-494 made the branch name the GitHub environment, so every shared-name input now falls back across tiers
metadata:
  type: project
---

`scripts/deploy.mjs` is sound on the sinks that exist: `run()` line-buffers the
**child's** stdout and stderr through `redact`, children get only
`pick(env, TOOL_ENV)` plus the one credential the phase needs, and preflight
receives only `HAS_*` booleans. `deploy.yml`'s `workflow_run` is gated on
`conclusion == 'success' && event == 'push'`, `permissions: contents: read`, and
a checkout pinned to `workflow_run.head_sha`.

**The one soft spot on output:** `PhaseError`s from `run()` quote `command` and
`args.join(' ').slice(0, 60)`, and `main()` prints them verbatim to `::error::`,
**not** through `redact`. Safe only while every credential travels in `env`
(`API_HOSTS[*].credentialVariable`), never in argv. Any **non**-PhaseError
(e.g. a V8 `SyntaxError` from `response.json()`, which quotes a body snippet)
prints only `<phase> failed unexpectedly`, so a body can reach CI only if a
PhaseError message interpolates it. VEN-632's web probes (`/api/ready`,
`/api/auth/get-session`, `/sign-in`, `/`) echo status and content-type only.

**VEN-494 — the branch is the environment.** `head_branch` (`staging` or
`production`) becomes `environment:`, the concurrency group and `DEPLOY_TARGET`;
the job `if` pins it to those two literals, so no attacker-chosen environment.
The new hazard is GitHub's **environment → repository → org** resolution: every
input has the same name on both tiers, so one value left at repository level is
silently production's on a staging run. `NEON_BRANCH !== DEPLOY_TARGET` catches
a _whole_ variable set falling back, but it compares two branch-derived values
and never reads `DATABASE_URL_UNPOOLED` — a secret-only fallback is invisible.
The worst sink is `web`'s staging step: `vercel alias set <preview> <host of
WEB_URL>` repoints whatever host that variable names, with no second factor and
no undo, and `ready` then polls the same variable and goes green.

**VEN-609 — sender phase.** Env/argv/redaction clean. It puts a **full-access**
Resend key (Resend has no read-only scope: full access mints keys, deletes the
domain, sends as it, reads sent bodies incl. admin step-up codes) into _both_
GitHub environments; with one Resend team, staging's copy controls production
mail. Docs set no deployment-branch policy on the environments.

**`productionShape` gates nothing automated.** `shapeFor('deployed')` returns
the base shape, and neither deploy.mjs nor boot runs `--env production`; only
a manual `pnpm preflight --env production` does. VEN-609's `POSTGRES_TLS_URL`
regex is bypassable: postgres.js 3.4.9 (`index.js:437` reduce) takes the
**last** duplicate param, decodes `ssl%6Dode`, and ignores a `#` fragment.
Neon refuses plaintext server-side, so it is low; parse, do not regex.

**How to apply:** a new per-environment input needs either a tier-named
variable (a repository fallback then cannot be the other tier's value) or a
canary compared against `DEPLOY_TARGET`. See
[[deploy-env-is-the-only-tier-signal]] for the runtime half.
