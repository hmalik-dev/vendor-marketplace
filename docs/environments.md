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
2. **Preflight**: every input below is set, or the run fails by name. Then
   (VEN-660) it asks the Neon API, with `NEON_API_KEY`, for the Neon Auth of
   the branch named `NEON_BRANCH` in `NEON_PROJECT_ID`, and fails by name when
   `NEON_AUTH_BASE_URL` is not that integration's base URL or `WEB_URL`'s
   first origin is not among its trusted domains, so no tier ships pointed at
   another tier's identities. The value it checked is the value that ships:
   the API step sets it on the Railway service and the web deploy passes it
   as a deployment variable, overriding the dashboard's.
3. **Sender** (VEN-609): Resend must report `EMAIL_FROM`'s domain as
   `verified`, or nothing ships. A key that cannot list domains (a
   sending-only key) fails too, since the release cannot prove the sender.
   Exception (VEN-626): `EMAIL_FROM=onboarding@resend.dev`, Resend's shared
   test sender, passes this step without a domain — it delivers only to the
   Resend account owner, and it is the friends-beta accommodation until a real
   domain exists (VEN-563). `launch:check`, the real-money gate, still fails
   it; no other `resend.dev` address qualifies.
4. **Migrate** the environment's database over its `DATABASE_URL_UNPOOLED`, then
   the idempotent reference seed. `NEON_BRANCH` must equal the environment
   name and the URL's host must equal `NEON_HOST`, so neither a mis-set branch
   variable nor a secret copied from the other tier can migrate the wrong
   database.
5. **API**: `railway up` with the environment's token. Railway's own branch
   auto-deploy must stay **off**, since it cannot be ordered after a GitHub job
   and would ship code before its migration. The release sets the service
   variable `RELEASE_COMMIT` first, which the Dockerfile bakes into the image,
   and `/ready` names that baked commit, not a variable (VEN-634).
   `SENTRY_RELEASE` is only the error tracker's release.
6. **Web**: a prebuilt Vercel deploy: production as a production deployment,
   promoted to the domain explicitly (so an earlier `vercel rollback`, which turns
   auto-assign off, cannot strand it), staging as a preview deployment aliased to
   `WEB_URL`'s host. Staging's Vercel
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
   minutes, or the run fails; then the web's `/api/ready` must name it too and
   report its runtime variables, and the web must serve auth, sign-in and the
   home page.

A release can also be started by hand to redeploy an environment's tip
(Actions > Deploy > Run workflow), and one that stops after the API leaves the
tiers on different commits; `runbook-rollback.md` covers both, and rolling back.

Every step runs only if the one before it succeeded, so a failed migration
stops the release before either service moves. Migrations therefore run against
the previous release's code and must stay backwards-compatible with it.

Set on each GitHub environment (`staging`, `production`) by the account holder
(VEN-377): secrets `DATABASE_URL_UNPOOLED`, `API_HOST_TOKEN` (a Railway project
token scoped to that environment), `VERCEL_TOKEN`, `SENTRY_AUTH_TOKEN`, `WEB_TIER_KEY`, `NEON_AUTH_COOKIE_SECRET`
(the last two: the web build's Secret variables, above), `RESEND_API_KEY` (a
full-access Resend key, so the sender step can list domains; the API's own key
on Railway stays sending-only), `NEON_API_KEY` (a Neon API key that can
read the project's branches and Neon Auth; the one input that may also be the
repository-level key CI already uses, since a Neon key is project-wide and
names no tier);
variables `EMAIL_FROM` (the same sender as the API's on Railway), `NEON_BRANCH` (`staging` or `production`), `NEON_HOST` (that
branch's direct endpoint host), `API_HOST`, `API_SERVICE`, `API_URL`, `WEB_URL`
(staging's first entry must be a host containing `staging`, since it is the
alias target), `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`, `SENTRY_WEB_PROJECT`, `NEON_PROJECT_ID`,
`NEON_AUTH_BASE_URL` (the tier's own, as `neon neon-auth status --branch
<NEON_BRANCH>` prints it). A push to
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

| Key                                                                                        | Comes from                                                                                                                                                |
| ------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                                                                             | the branch's **pooled** Neon connection string                                                                                                            |
| `DATABASE_URL_UNPOOLED`, `NEON_AUTH_DATABASE_URL`                                          | the same branch's **direct** connection string (`neon connection-string <branch>`)                                                                        |
| `NEON_AUTH_BASE_URL`                                                                       | Neon console, that branch, Auth URL                                                                                                                       |
| `STORAGE_ENDPOINT`, `STORAGE_ACCESS_KEY_ID`, `STORAGE_SECRET_ACCESS_KEY`, `STORAGE_REGION` | Neon's injected `AWS_ENDPOINT_URL_S3`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`                                                         |
| `STORAGE_BUCKET`                                                                           | `uploads` (declared in `neon.ts`)                                                                                                                         |
| `STORAGE_PUBLIC_URL`                                                                       | `<STORAGE_ENDPOINT>/uploads`, no trailing slash; the web app's `NEXT_PUBLIC_STORAGE_PUBLIC_URL` is identical                                              |
| `STRIPE_SECRET_KEY`                                                                        | Stripe sandbox API keys (`sk_test_`)                                                                                                                      |
| `STRIPE_WEBHOOK_SECRET`                                                                    | the **Your account** endpoint's signing secret                                                                                                            |
| `STRIPE_CONNECT_WEBHOOK_SECRET`                                                            | the **Connected accounts** endpoint's signing secret (required to boot a deployment; vendor onboarding needs it)                                          |
| `RESEND_API_KEY`                                                                           | a key per environment, sending access only                                                                                                                |
| `SENTRY_DSN`                                                                               | a Node project per environment; required to boot a deployment                                                                                             |
| `RESEND_WEBHOOK_SECRET`                                                                    | signing secret of that environment's Resend webhook endpoint at `<api host>/webhooks/resend`; required to boot a deployment                               |
| `WEB_TIER_KEY`                                                                             | `openssl rand -hex 32`, the same value on the API and web of one environment and a different one per environment (VEN-649); required to boot a deployment |
| `ADMIN_ALERT_EMAIL`, `SUPPORT_EMAIL_TO`                                                    | real inboxes for production, your own test inbox elsewhere                                                                                                |

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

- **Your account**: the Charge, Payment intent, Refund, Transfer and Radar event
  groups. The API handles `payment_intent.succeeded`, `charge.refunded`,
  `charge.dispute.created`, `charge.dispute.closed`,
  `charge.dispute.funds_reinstated`, `refund.failed`, `refund.updated`,
  `charge.refund.updated`, `transfer.reversed` and
  `radar.early_fraud_warning.created`, and answers `200` to the rest.
- **Connected accounts** (not Accounts v2): `account.updated`,
  `capability.updated` and `payout.failed`.

## Regions and replicas

Neon (database, Neon Auth and storage) is in `us-east-2` (AWS Ohio), so run the
API in **US East** on Railway, and the Vercel web functions in `iad1`. An API in
another region pays the round trip on every query. Both Railway services run
**one replica**: the sign-in throttle and the per-process rate limiter are per
instance, so a second replica multiplies limits (VEN-462 lifts this). Multi-region replicas need the Pro plan and are not
wanted here.

## Rules

- Local development and every lane run on the Docker Postgres. Neon `staging`
  and `production` are never a local target; Neon `dev` serves auth and storage
  only. `neon connection-string --branch-id` defaults to production, so name the
  branch positionally.
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

### `pnpm db:reset` (VEN-751)

Empties a tier's app data in one transaction and keeps the schema. It connects
over `DATABASE_URL_UNPOOLED` (the migration role) and never prints it.

| Kept                                                                 | Deleted                                                                                                                       |
| -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `drizzle.__drizzle_migrations`                                       | every customer and vendor, and every row they own                                                                             |
| `categories`, `tags`, `us_cities` (the reference seed)               | bookings, requests, payments, refunds, reviews, messages, notifications                                                       |
| `platform_settings`                                                  | support cases, admin alerts, audit rows (`admin_actions`, `booking_events`), email deliveries                                 |
| `email_send_days` (it mirrors Resend's daily quota)                  | invites, the waitlist, sign-up roles, step-up challenges and grants, stream tickets, rate-limit rows, Stripe webhook failures |
| every `users` row with role `admin`, and its own `legal_acceptances` |                                                                                                                               |

Guards: `--tier` and `--confirm <database name>` are required; the host must be
the tier's (staging `ep-jolly-poetry-ax8noqyz`, production
`ep-lucky-cherry-axtyizs9`, local `localhost`); a run without `--yes` prints the
counts and deletes nothing; `--dry-run` does the same and exits 0. A new table
fails the suite until it is added to a list in `packages/db/src/scripts/reset.ts`.

`<database>` is the connected database's name (`neondb` on a Neon branch
unless renamed). The reset reads `DATABASE_URL_UNPOOLED`; the seeds read
`DATABASE_URL` and `NEON_BRANCH`, so export all three for the tier, from the
CLI rather than pasted, and unset them when done. Staging:

```bash
export DATABASE_URL_UNPOOLED="$(neon connection-string staging)"
export DATABASE_URL="$DATABASE_URL_UNPOOLED" NEON_BRANCH=staging
pnpm db:reset --tier staging --confirm <database> --dry-run  # read the counts
pnpm db:reset --tier staging --confirm <database> --yes --auth
pnpm db:seed       # reference data: already kept, and idempotent
pnpm db:seed:demo  # staging carries the demo seed
unset DATABASE_URL DATABASE_URL_UNPOOLED NEON_BRANCH
```

Production:

```bash
export DATABASE_URL_UNPOOLED="$(neon connection-string production)"
pnpm db:reset --tier production --confirm <database> --dry-run
pnpm db:reset --tier production --confirm <database> --yes --auth
unset DATABASE_URL_UNPOOLED
```

Production gets no demo or E2E seed; the next release's migrate step runs the
reference seed on its own. The reset locks every table it counts, so the live
API's writes wait (up to the 5-second lock timeout) until it commits. Pause
checkout in `/admin` first, so no payment lands mid-reset, and resume it
after: `platform_settings` is kept, switches included.

What the reset does not touch:

- **Neon Auth identities**, unless `--auth` is passed. With it, every identity
  in the branch's `neon_auth` schema goes except the admins' (sessions and
  accounts cascade), and so does every one-time code not addressed to an
  admin. Without it, a former user keeps an identity with no app row: an open
  session reads as signed out (protected pages redirect to `/sign-in`), and
  signing in again takes the newcomer path, where they pick a role and accept
  the Terms. `--auth` is refused on local, whose identities live on the shared
  `dev` branch.
- **Stored images.** Nothing references them after a reset, and the API's
  upload sweep (VEN-485) deletes unreferenced objects older than 24 hours, so
  the bucket empties itself within a day.
- **Stripe.** Test-mode customers and connected accounts stay in the Stripe
  sandbox; no app row points at them.
