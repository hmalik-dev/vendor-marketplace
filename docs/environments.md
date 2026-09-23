# Environments

Three tiers, each with its own database, auth users, storage, Stripe endpoints,
Sentry project and secrets. Nothing is shared between them: a value in one
environment must never be a fallback for another.

| Tier             | Git branch                | Runs on                                            | Data                                                                    |
| ---------------- | ------------------------- | -------------------------------------------------- | ----------------------------------------------------------------------- |
| Local and lanes  | `main` (integration)      | your machine, not deployed                         | Docker Postgres (app DB); Neon `dev` (Neon Auth, storage, E2E accounts) |
| Staging          | `staging`, moved by hand  | Railway `staging` (+ Vercel preview for web)       | Neon `staging`, Stripe sandbox                                          |
| Production       | `production`, moved after | Railway `production` (+ Vercel production for web) | Neon `production`, Stripe sandbox until live keys                       |
| Preview (per-PR) | the PR branch             | Neon `preview/pr-<n>` (storage only); no Vercel    | throwaway, expires in 7 days                                            |

`main` is where merges land and CI runs. It is not deployed. Pre-merge testing
is the lane (`pnpm lane:up <id>`): a full isolated stack per ticket.

The friends beta runs on the **production** stack with Stripe in test mode. It
is not a separate environment; do not create one called "beta".

## Promotion

Promote by fast-forward only, never by merging one branch into another. `main`
requires linear history, and a merge commit would make the branches diverge.

```bash
git push origin main:staging          # deploy a commit to staging
git push origin staging:production    # promote what passed on staging
```

- Production only receives a commit that is already on `staging`.
- Nobody commits to `staging` or `production` directly; protect both branches
  so only fast-forward pushes are allowed.

### What a push does

`.github/workflows/deploy.yml` runs after CI succeeds on a push to `staging` or
`production`, and only those: a push to `main` deploys nothing. The branch names
the environment, and the job runs in the GitHub environment of the same name, so
each has its own secrets and variables.

1. **Gate**: the commit is still the branch's tip (a superseded run exits
   green without deploying; the run for the tip carries it).
2. **Preflight**: every input below is set, or the run fails by name.
3. **Sender** (VEN-609): Resend must report `EMAIL_FROM`'s domain as
   `verified`, or nothing ships. A key that cannot list domains (a
   sending-only key) fails too, since the release cannot prove the sender.
4. **Migrate** the environment's database over its `DATABASE_URL_UNPOOLED`, then
   the idempotent reference seed. `NEON_BRANCH` must equal the environment
   name and the URL's host must equal `NEON_HOST`, so neither a mis-set branch
   variable nor a secret copied from the other tier can migrate the wrong
   database.
5. **API**: `railway up` with the environment's token. Railway's own branch
   auto-deploy must stay **off**, since it cannot be ordered after a GitHub job
   and would ship code before its migration.
6. **Web**: a prebuilt Vercel deploy: production as a production deployment,
   staging as a preview deployment aliased to `WEB_URL`'s host. Staging's Vercel
   variables are scoped to the Preview `staging` branch, and the release pulls
   them by branch (`--git-branch=staging`). `WEB_TIER_KEY` and
   `NEON_AUTH_COOKIE_SECRET` are Secret-type Vercel variables, which `vercel
pull` cannot read (it writes them as empty strings, and the web build
   validates them), so the release takes them from GitHub environment secrets
   of the same names (`staging` and `production`, the same values as the
   runtime ones, entered once by the account holder) and hands them to `vercel
build` alone (VEN-575). Preflight fails by name when either is missing. When
   rotating either, rotate it in all three places: Vercel, Railway (for
   `WEB_TIER_KEY`) and the GitHub environment secret.
7. **Ready**: `/ready` on the API must name the pushed commit within ten
   minutes, or the run fails.

Every step runs only if the one before it succeeded, so a failed migration
stops the release before either service moves. Migrations therefore run against
the previous release's code and must stay backwards-compatible with it.

Set on each GitHub environment (`staging`, `production`) by the account holder
(VEN-377): secrets `DATABASE_URL_UNPOOLED`, `API_HOST_TOKEN` (a Railway project
token scoped to that environment), `VERCEL_TOKEN`, `SENTRY_AUTH_TOKEN`, `WEB_TIER_KEY`, `NEON_AUTH_COOKIE_SECRET`
(the last two: the web build's Secret variables, above), `RESEND_API_KEY` (a
full-access Resend key, so the sender step can list domains; the API's own key
on Railway stays sending-only);
variables `EMAIL_FROM` (the same sender as the API's on Railway), `NEON_BRANCH` (`staging` or `production`), `NEON_HOST` (that
branch's direct endpoint host), `API_HOST`, `API_SERVICE`, `API_URL`, `WEB_URL`
(staging's first entry must be a host containing `staging`, since it is the
alias target), `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`, `SENTRY_WEB_PROJECT`. A push to
`staging` or `production` with any of them unset fails at preflight, naming it.

Never set any of these at the repository level: GitHub falls back from an
environment to the repository, and the names are the same on both tiers, so a
repository-level value is silently the other tier's. Do not add a deployment
branch policy to the environments either: a `workflow_run` job runs on the
default branch, so a rule limiting `production` to the `production` branch
would refuse every deploy.

Vercel builds nothing from git (`vercel.json`, VEN-535): Git deployments are
off and every branch is skipped, so a push to `staging` or `production` cannot
put the web live ahead of the migration and the API, and pull requests and lanes
get no Vercel preview. The release workflow's prebuilt deploy is the only web
path, so until VEN-377 provisions its inputs the deployed web does not move.

## What each environment holds

Set on the Railway service, per environment, with that environment's own values.
Names below are the keys in `packages/shared/src/env/registry.ts`; run
`pnpm env:example` for the full authoritative list.

| Key                                                                                        | Comes from                                                                                                                  |
| ------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                                                                             | the branch's **pooled** Neon connection string                                                                              |
| `DATABASE_URL_UNPOOLED`, `NEON_AUTH_DATABASE_URL`                                          | the same branch's **direct** connection string (`neon connection-string <branch>`)                                          |
| `NEON_AUTH_BASE_URL`                                                                       | Neon console, that branch, Auth URL                                                                                         |
| `STORAGE_ENDPOINT`, `STORAGE_ACCESS_KEY_ID`, `STORAGE_SECRET_ACCESS_KEY`, `STORAGE_REGION` | Neon's injected `AWS_ENDPOINT_URL_S3`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`                           |
| `STORAGE_BUCKET`                                                                           | `uploads` (declared in `neon.ts`)                                                                                           |
| `STORAGE_PUBLIC_URL`                                                                       | `<STORAGE_ENDPOINT>/uploads`, no trailing slash; the web app's `NEXT_PUBLIC_STORAGE_PUBLIC_URL` is identical                |
| `STRIPE_SECRET_KEY`                                                                        | Stripe sandbox API keys (`sk_test_`)                                                                                        |
| `STRIPE_WEBHOOK_SECRET`                                                                    | the **Your account** endpoint's signing secret                                                                              |
| `STRIPE_CONNECT_WEBHOOK_SECRET`                                                            | the **Connected accounts** endpoint's signing secret (required to boot a deployment; vendor onboarding needs it)            |
| `RESEND_API_KEY`                                                                           | a key per environment, sending access only                                                                                  |
| `SENTRY_DSN`                                                                               | a Node project per environment; required to boot a deployment                                                               |
| `RESEND_WEBHOOK_SECRET`                                                                    | signing secret of that environment's Resend webhook endpoint at `<api host>/webhooks/resend`; required to boot a deployment |
| `WEB_TIER_KEY`                                                                             | `openssl rand -hex 32`, the same value on the API and web of one environment; required to boot a deployment                 |
| `OPERATOR_ALERT_EMAIL`, `SUPPORT_EMAIL_TO`                                                 | real inboxes for production, your own test inbox elsewhere                                                                  |

Never reuse a value across environments: not the database URLs, the storage
credentials, either webhook secret, the Resend key or the Sentry DSN. Stripe
secret keys may match while both use the same sandbox account.

### Names

- Neon branches: `production`, `staging`, `dev` (persistent); `preview/pr-<n>`
  and `lane-*` (expiring).
- Sentry projects: `vendor-marketplace-api-staging`,
  `vendor-marketplace-api-production` (web: `vendor-marketplace-web-<env>`).
- Resend keys: one per environment, named for it.
- Infrastructure carries the repo name; the product name comes from
  `BRAND_NAME` and is not written as a literal.

### Stripe endpoints

Each of staging and production has two endpoints at
`https://<api host>/webhooks/stripe`, each with its own signing secret:

- **Your account**: the Charge, Payment intent and Refund event groups. The API
  handles `payment_intent.succeeded`, `charge.refunded`, `charge.dispute.created`,
  `charge.dispute.closed`, `charge.dispute.funds_reinstated`, `refund.failed`,
  `refund.updated` and `charge.refund.updated`, and answers `200` to the rest.
- **Connected accounts** (not Accounts v2): `account.updated` and
  `capability.updated`.

## Regions and replicas

Neon (database, Neon Auth and storage) is in `us-east-2` (AWS Ohio), so run the
API in **US East** on Railway, and the Vercel web functions in `iad1`. An API in
another region pays the round trip on every query. Both Railway services run
**one replica**: stream tickets, the sign-in throttle and the per-process rate
limiter are per instance, so a second replica breaks streams and multiplies
limits (VEN-462 lifts this). Multi-region replicas need the Pro plan and are not
wanted here.

## Rules

- Local development and every lane run on the Docker Postgres. Neon `staging`
  and `production` are never a local target; Neon `dev` serves auth and storage
  only. `neon connection-string --branch-id` defaults to production, so name the
  branch positionally.
- A staging instance must not email a real address. Until the non-production
  email sink lands (VEN-489), keep real-looking addresses out of staging's
  database.
- Seal secrets in Railway (and mark them sensitive in Vercel) only after the
  service boots and `/ready` answers, and keep each secret at its origin first:
  a sealed value cannot be read back.
- The retired identity, webhook and object-storage providers are gone; no variable
  named for them belongs in any environment or local env file.

## Reset and reseed

- Local: `pnpm lane:down <id> && pnpm lane:up <id>` (migrates and seeds), or
  `docker compose down && docker compose up -d && pnpm db:migrate && pnpm db:seed`.
- Staging and dev branches hold synthetic data only. Rebuild one from a fresh
  Neon branch, migrate it, run the reference seed, and re-create its Neon Auth
  identities. Do not run `pnpm db:seed:demo` or `pnpm db:seed:e2e` against
  production.
