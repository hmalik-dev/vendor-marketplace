---
name: staging-probe-spec-guard
description: VEN-562's live-staging Playwright spec; the real guard is STAGING_WEB_URL plus a separate config, DEPLOY_ENV defaulting to local is deliberate, and a probe run leaves public storefronts on the beta marketplace
metadata:
  type: project
---

`apps/web/e2e/*.staging.spec.ts` sign up real accounts on the live staging
deployment. They load only through `playwright.staging.config.ts`
(`test:e2e:staging`); the default config ignores `.staging.spec.ts` at top level
**and** in `desktop-1440`, because a project's own `testIgnore` replaces the
top-level one. Vitest includes only `e2e/**/*.test.ts`; `verify.mjs` and CI run
the default config only.

**Why:** the guard (`assertStagingEnvironment`) copies the mail-code CLI's
`DEPLOY_ENV?.trim() || 'local'` default, so its DEPLOY_ENV prong never fires in
CI (unset there). What actually stops an unattended run is the required
`STAGING_WEB_URL` (host must contain `staging`), which nothing in CI sets, plus
the config separation. Production's host has no `staging` in it.

**How to apply:** do not re-report the default-local direction as a blocker; the
reachable hardening is refusing when `CI` is set. Reopen if any workflow or
script sets `STAGING_WEB_URL`, loads the staging config, or a new project in the
default config sets its own `testIgnore` without `STAGING_SPEC_IGNORE`.
Each run leaves two **published** storefronts that beta users on staging can
find (see [[beta-uses-real-signups-not-seeded-data]]). The decision covers
leaving the accounts in place; it does not cover leaving storefronts listed.
Stdout contract: an outer `pnpm <script>` without `--silent` prints its
lifecycle banner to stdout, so a parser that reads stdout fails and echoes
the command line.
