# The demo deployment — a link you can send someone

**This is a showcase, not production. Nothing in this file is part of the real
launch path, and nothing built here should ever be pointed at by anything that
matters.** It exists for one reason: so Orla can be shown to a person over a URL
instead of over a screen share.

Concretely, what that means:

- It reads the Neon **`staging`** branch. The `production` branch is never
  touched, and `packages/db/src/scripts/safe-target.ts` refuses to seed it.
- Its vendors are **fabricated** — the marketing seed's invented photographers,
  with invented ratings and review counts. That is the whole reason they are
  confined to `staging`; see `pre-launch.md` §1.1, which treats those same rows
  reaching a public production site as the single most serious blocker in the
  file.
- Clerk is a **development instance** and Stripe is in **test mode**. No real
  money can move; no real account is reachable.
- It is on free infrastructure that sleeps when idle.

`pre-launch.md` remains the gate for a real deployment. This file satisfies
almost none of it, deliberately.

---

## What it costs

Nothing, and not by accident — every tier below either bills zero or stops
serving rather than billing.

| Piece         | Where                       | Cost                                                         |
| ------------- | --------------------------- | ------------------------------------------------------------ |
| Web (Next.js) | Vercel Hobby                | $0 — no overage billing, limits throttle instead             |
| API (Fastify) | Render free web service     | $0 — 750 instance-hours/month, sleeps after ~15 min idle     |
| Database      | Neon Free, `staging` branch | $0 — 191.9 CU-hours/month, 0.5 GB, scale-to-zero after 5 min |
| Auth          | Clerk development instance  | $0 — capped at 100 users                                     |
| Payments      | Stripe test mode            | $0 — no live charges exist                                   |
| Images        | Cloudflare R2 free tier     | $0 — the bucket is effectively empty                         |

The Neon project used ~11.7 of its 191.9 CU-hours in the month to 2026-08-31,
so a demo's browsing is not close to the ceiling. The one historical way this
stopped being free was an **always-open connection pool** holding Neon awake
around the clock — a Render free service cannot do that, because it sleeps
itself after 15 idle minutes and drops the pool with it.

## What a visitor can actually do

Browse the landing page, search and filter vendors, open a storefront and its
packages, sign up, send a booking request, message a vendor, and run a test-mode
checkout with card `4242 4242 4242 4242`. Uploads work — the API runs as a real
container, so neither `sharp` nor multipart bodies nor the messaging SSE stream
hit the limits a serverless function would impose.

**The first request after an idle spell takes roughly a minute.** Render's free
instance has cold-started, and Neon's compute has to resume behind it. Open the
link yourself and wait for it to load before you send it to anyone.

---

## Standing it up

Everything below is one-time. Two of the three steps need a browser and an
account, so they cannot be scripted from here.

### 1. The API, on Render

`render.yaml` at the repository root is a complete blueprint. In the Render
dashboard: **New → Blueprint**, point it at this repository, and it reads that
file — free instance type, Ohio region, built from `apps/api/Dockerfile` with
the repository root as its build context.

Render will prompt for every variable the blueprint marks `sync: false`. Fill
them from the same values the local `.env` carries, with one exception that
matters:

- **`DATABASE_URL` must be the Neon `staging` branch**, taken from the Neon
  dashboard. Not `production`.
- **`WEB_URL`** is the demo web URL from step 2, so it is filled in after that
  step and the service redeployed once. It doubles as the API's CORS
  allow-list, which fails only in the browser — the server logs look healthy
  while every request from the page is blocked.

Never paste any of these into a shell command or a file under `.claude/`. A
credential that reached a command line has to be rotated, not deleted.

Deploys are set to manual (`autoDeploy: false`) so a merge to `main` cannot
break the demo halfway through someone looking at it. Redeploy from the
dashboard when you want it current.

> The free instance builds with limited memory. If `pnpm install` is killed
> during the Docker build, that is the cause; retry, or build the image locally
> and push it instead.

### 2. The web app, on Vercel

Create a **second Vercel project** from this repository rather than reusing the
existing one. The existing project's Production environment stays exactly as it
is — this is the isolation the whole arrangement depends on, and a branch-scoped
Preview deployment would be behind Vercel's deployment protection anyway.

Root directory `apps/web`. Set these in the new project's Production
environment:

| Variable                                          | Value                                    |
| ------------------------------------------------- | ---------------------------------------- |
| `NEXT_PUBLIC_API_URL`                             | the Render service URL                   |
| `API_URL`                                         | the same Render service URL              |
| `WEB_URL`                                         | this project's own `*.vercel.app` origin |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`               | the `pk_test_` key                       |
| `CLERK_SECRET_KEY`                                | the `sk_test_` key                       |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL`                   | `/sign-in`                               |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL`                   | `/sign-up`                               |
| `NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL` | `/after-sign-in`                         |
| `NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL` | `/after-sign-in`                         |
| `NEXT_PUBLIC_S3_PUBLIC_URL`                       | the R2 public base URL                   |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`              | the `pk_test_` key                       |

The last two are not in the web app's validated capability set — it checks
`core` and `auth` only — so leaving either out fails at render time on an image
or at the checkout screen, not at build time.

### 3. Point Clerk at the demo

Add the demo web origin to the Clerk development instance's allowed origins, and
repoint `CLERK_WEBHOOK_ENDPOINT` at `<render-url>/webhooks/clerk` if you want
`user.updated` and `user.deleted` to reach the demo at all. A development
instance is capped at 100 users, which is the right ceiling for this.

### 4. Optional — a richer dataset

`staging` carries the marketing seed. For the fuller marketplace — every
category populated, live booking requests, message threads, reviews and
notifications, all deterministic — run the demo seed against `staging` from a
laptop with `NEON_BRANCH=staging` in the environment:

```
pnpm db:seed:demo
```

It is additive and disjoint from both the reference and marketing seeds, needs
no Clerk or Stripe credentials, and refuses to run against `production` or with
`NODE_ENV=production`. `pnpm db:seed:demo -- --clear` removes exactly the rows
it owns.

---

## Tearing it down

Delete the Render service and the second Vercel project. Nothing else was
created — no Neon branch, no bucket, no Clerk instance — so nothing else has to
be cleaned up, and `production` was never in the blast radius to begin with.
