# Environments

Three tiers, each with its own database, auth users, storage, Stripe endpoints,
Sentry project and secrets. Nothing is shared between them: a value in one
environment must never be a fallback for another.

| Tier             | Git branch                | Runs on                                              | Data                                                                    |
| ---------------- | ------------------------- | ---------------------------------------------------- | ----------------------------------------------------------------------- |
| Local and lanes  | `main` (integration)      | your machine, not deployed                           | Docker Postgres (app DB); Neon `dev` (Neon Auth, storage, E2E accounts) |
| Staging          | `staging`, moved by hand  | Railway `staging` (+ Vercel preview for web)         | Neon `staging`, Stripe sandbox                                          |
| Production       | `production`, moved after | Railway `production` (+ Vercel production for web)   | Neon `production`, Stripe sandbox until live keys                       |
| Preview (per-PR) | the PR branch             | Vercel preview, Neon `preview/pr-<n>` (storage only) | throwaway, expires in 7 days                                            |

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
- Railway `staging` follows the `staging` branch and `production` follows
  `production`, both with **Wait for CI** on.
- A merge that adds a migration must be migrated first. The release workflow
  (`.github/workflows/deploy.yml`) migrates production; staging has no such step
  yet, so run `pnpm db:migrate` against staging's `DATABASE_URL_UNPOOLED` before
  pushing to `staging`. Every migration stays backwards-compatible with the
  release still serving.

Staging's Railway service was first deployed with `railway up` from a clean
export of `origin/main`, because it had no GitHub source. With the repo
connected, pushes to `staging` deploy it.

## What each environment holds

Set on the Railway service, per environment, with that environment's own values.
Names below are the keys in `packages/shared/src/env/registry.ts`; run
`pnpm env:example` for the full authoritative list.

| Key                                                                                        | Comes from                                                                                                   |
| ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| `DATABASE_URL`                                                                             | the branch's **pooled** Neon connection string                                                               |
| `DATABASE_URL_UNPOOLED`, `NEON_AUTH_DATABASE_URL`                                          | the same branch's **direct** connection string (`neon connection-string <branch>`)                           |
| `NEON_AUTH_BASE_URL`                                                                       | Neon console, that branch, Auth URL                                                                          |
| `STORAGE_ENDPOINT`, `STORAGE_ACCESS_KEY_ID`, `STORAGE_SECRET_ACCESS_KEY`, `STORAGE_REGION` | Neon's injected `AWS_ENDPOINT_URL_S3`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`            |
| `STORAGE_BUCKET`                                                                           | `uploads` (declared in `neon.ts`)                                                                            |
| `STORAGE_PUBLIC_URL`                                                                       | `<STORAGE_ENDPOINT>/uploads`, no trailing slash; the web app's `NEXT_PUBLIC_STORAGE_PUBLIC_URL` is identical |
| `STRIPE_SECRET_KEY`                                                                        | Stripe sandbox API keys (`sk_test_`)                                                                         |
| `STRIPE_WEBHOOK_SECRET`                                                                    | the **Your account** endpoint's signing secret                                                               |
| `STRIPE_CONNECT_WEBHOOK_SECRET`                                                            | the **Connected accounts** endpoint's signing secret (optional to boot; needed for vendor onboarding)        |
| `RESEND_API_KEY`                                                                           | a key per environment, sending access only                                                                   |
| `SENTRY_DSN`                                                                               | a Node project per environment; required to boot a deployment                                                |
| `WEB_TIER_KEY` (optional)                                                                  | `openssl rand -hex 32`, the same value on the API and web of one environment                                 |
| `OPERATOR_ALERT_EMAIL`, `SUPPORT_EMAIL_TO`                                                 | real inboxes for production, your own test inbox elsewhere                                                   |

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
