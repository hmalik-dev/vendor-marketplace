# Vendor Marketplace

A two-sided marketplace connecting customers with event service vendors —
photographers, DJs, makeup artists, decorators, caterers, and florists.
Preset packages with transparent pricing, reviews tied to real bookings,
secure payment via Stripe Connect, and messaging in booking context.

## Getting started

Prerequisites: Node 20+, pnpm 10+, and Docker. The [Neon CLI](https://neon.com/docs/reference/neon-cli)
is only needed for staging and production work, not to run the app locally.

```bash
cp .env.example .env          # once — fill in keys as integrations come online

pnpm preflight                # tells you what is still missing, and the fix
pnpm start                    # install, start Docker, migrate, seed, run dev servers
```

Set `DATABASE_URL` to the local Postgres described in `docker-compose.yml` —
user, password and database name are all declared on the `postgres` service —
and leave `DATABASE_URL_UNPOOLED` and `NEON_BRANCH` unset. Nothing needs
provisioning before the first run.

`pnpm start` is idempotent, so it is also the right command after a `git pull`
or whenever you just want the servers back. Web runs on
http://localhost:3000, the API on http://localhost:4000, and the MinIO console
on http://localhost:9001 (`vendor-marketplace` / `vendor_marketplace_dev`). Ctrl-C stops the dev
servers; Docker keeps running until `docker compose down`.

Individual steps are available as `pnpm install`, `docker compose up -d`,
`pnpm db:migrate`, `pnpm db:seed`, and `pnpm dev`.

### Where the database lives

**Locally: the Postgres service in `docker-compose.yml`.** **Staging and
production: Neon branches.**

Local development deliberately does *not* use Neon. `pnpm dev` holds a
connection pool open, so a Neon compute never scales to zero and a day of
development burns CU-hours against a per-project monthly cap — and exhausting
that cap suspends the compute until the next billing period. Running locally is
also faster, since no query crosses the network.

The compose image tracks the major version Neon runs (**18**); a drift test in
`packages/preflight` fails if the two disagree, because a version gap is
invisible locally and surfaces only in production. Note that Postgres 18+ images
require the data volume mounted at `/var/lib/postgresql`, one level above the
pre-18 path.

Neon still backs every deployed environment, and its copy-on-write branching is
what gives each pull request an isolated, full-fidelity database. The Neon
connection strings are kept commented in `.env` for when you need to point at a
branch deliberately.

`preflight` refuses to start a ticket while `DATABASE_URL` points at a
`production`, `main` or `master` branch.

MinIO runs on every local run as the stand-in for Cloudflare R2 — that container
*is* required.

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

## Credentials

Three layers keep a credential out of the repository, in the order they fire:

1. **`.gitignore`** ignores `.env.*` wholesale and re-admits only the generated
   `.env.example`. It previously listed `.env`, `.env.local` and `.env.*.local`
   by name, which left an ad-hoc `.env.bak` stageable.
2. **A pre-commit hook** runs `pnpm secrets:scan` over the _staged blobs_ — not
   the working tree, so staging a secret and then editing the file does not get
   past it. It is installed by the root `prepare` script, so `pnpm install` is
   all a fresh clone needs. Run it by hand any time.
3. **CI** runs `pnpm secrets:scan:all` over every tracked file, before anything
   else. A hook skipped with `--no-verify` still fails the pull request.

The scan looks for provider token shapes (Stripe, Clerk, svix, Neon, AWS,
GitHub, Slack, Google), private key blocks, npm auth tokens, database URLs
carrying a password to a non-local host, and high-entropy values assigned to
secret-named keys. It also refuses any `.env*` other than `.env.example`, plus
`.pem`/`.key`/`.netrc`/`.pgpass` files.

Findings print a truncated excerpt and a length, never the credential — they
end up in CI logs.

False positives have two escape hatches. For a one-off, mark the line:

```ts
const key = 'sk_test_...'; // secret-scan:allow
```

For a fixture the env-shape suites assert against, add the literal to
`KNOWN_FIXTURES` in `packages/preflight/src/secrets/patterns.ts`, so the
exceptions stay in one reviewable place. `secret-scan:allow-file` exempts a
whole file and is reserved for suites that exist to hold credential shapes.

**If the scan ever fires on a real value, rotate it.** A credential that reached
a file you tried to commit should be treated as compromised, not as nearly
leaked.

## Running the API in a container

`apps/api/Dockerfile` builds the deployable API image. The build context is the
repository root, because a pnpm workspace cannot be installed from one package's
directory:

```bash
docker build -f apps/api/Dockerfile -t vendor-marketplace-api .
docker run --rm -p 4000:4000 --env-file .env -e HOST=0.0.0.0 vendor-marketplace-api
```

The image installs and builds only the `@vendor-marketplace/api` subgraph, then ships a
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
node node_modules/@vendor-marketplace/db/dist/scripts/migrate.js
```

See `CLAUDE.md` for architecture conventions and the full command reference.
