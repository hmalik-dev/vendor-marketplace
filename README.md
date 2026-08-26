# VendorHub

A two-sided marketplace connecting customers with event service vendors —
photographers, DJs, makeup artists, decorators, caterers, and florists.
Preset packages with transparent pricing, reviews tied to real bookings,
secure payment via Stripe Connect, and messaging in booking context.

## Getting started

Prerequisites: Node 20+, pnpm 10+, Docker, and the [Neon CLI](https://neon.com/docs/reference/neon-cli).

```bash
cp .env.example .env          # once — fill in keys as integrations come online

neon branches create --name dev            # never develop against `production`
neon connection-string dev                 # → DATABASE_URL
neon connection-string dev --pooled false  # → DATABASE_URL_UNPOOLED

pnpm preflight                # tells you what is still missing, and the fix
pnpm start                    # install, start Docker, migrate, seed, run dev servers
```

`pnpm start` is idempotent, so it is also the right command after a `git pull`
or whenever you just want the servers back. Web runs on
http://localhost:3000, the API on http://localhost:4000, and the MinIO console
on http://localhost:9001 (`vendorhub` / `vendorhub_dev`). Ctrl-C stops the dev
servers; Docker keeps running until `docker compose down`.

Individual steps are available as `pnpm install`, `docker compose up -d`,
`pnpm db:migrate`, `pnpm db:seed`, and `pnpm dev`.

### Where the database lives

The application database is a **Neon branch**, not the Postgres service in
`docker-compose.yml`. Branches are copy-on-write, so a personal `dev` branch is
a full-fidelity copy that resets instantly, and pooled-connection and SSL
behaviour match production — which is where connection-level bugs hide.
Compose still provides Postgres for fully offline work, and MinIO on every run
as the local stand-in for Cloudflare R2.

`preflight` refuses to start a ticket while `DATABASE_URL` points at the
`production` branch.

### Environment variables

`packages/shared/src/env/registry.ts` is the single list of every variable.
`.env.example` and `turbo.json`'s passthrough array are generated from it — run
`pnpm env:example` after changing the registry, never edit either by hand. A
test in `packages/shared` fails the build if they drift.

```bash
pnpm preflight                # baseline: core + browser verification
pnpm preflight --ticket 9     # only what ticket #9 needs — Stripe included
pnpm preflight --env production  # production value set, stricter shapes
```

Each check prints the literal command or URL that fixes it, and a run reports
every failure at once rather than stopping at the first.

## Workspace

```
apps/web        Next.js 15 frontend (App Router, RSC)
apps/api        Fastify 5 API
packages/shared Zod schemas, types, constants, utilities
packages/db     Drizzle schema, migrations, seed
packages/config Shared TypeScript, ESLint, and Tailwind configs
```

## Checks

```bash
pnpm build      # compile every package
pnpm typecheck  # tsc --noEmit across the workspace
pnpm lint       # ESLint across the workspace
pnpm test       # Vitest across the workspace
```

The database suite runs against an in-process PostgreSQL (PGlite), so
`pnpm test` needs no running database.

## Running the API in a container

`apps/api/Dockerfile` builds the deployable API image. The build context is the
repository root, because a pnpm workspace cannot be installed from one package's
directory:

```bash
docker build -f apps/api/Dockerfile -t vendorhub-api .
docker run --rm -p 4000:4000 --env-file .env -e HOST=0.0.0.0 vendorhub-api
```

The image installs and builds only the `@vendorhub/api` subgraph, then ships a
`pnpm deploy --prod` tree, so it carries neither devDependencies nor the rest of
the monorepo. It runs as the unprivileged `node` user and closes Fastify on
`SIGTERM`, so a rollout drains in-flight requests.

Two probes are exposed for the hosting platform, and `railway.json` points at
them:

- `GET /health` — liveness. Answers `200` from the event loop alone, with no
  I/O: a restart is the only response to a failed liveness probe, and a restart
  cannot fix a dependency outage.
- `GET /ready` — readiness. Round-trips the database and the object storage
  bucket and reports each separately, answering `503` when either is down so the
  platform withholds traffic instead of routing it into failures.

Both are unauthenticated and exempt from rate limiting.

Migrations run as a release step rather than at boot, over the direct
(unpooled) connection:

```bash
node node_modules/@vendorhub/db/dist/scripts/migrate.js
```

See `CLAUDE.md` for architecture conventions and the full command reference.
