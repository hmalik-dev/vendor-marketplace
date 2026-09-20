# Development

The root `README.md` is the plain-language guide to running the app. This page
is everything a developer needs beyond it. Agent conventions, the full command
table and the workspace layout are in `CLAUDE.md`.

## Local setup

Prerequisites: Node 22.22.2+ (`engines` in `package.json`), pnpm through
`corepack enable` (the version is pinned by `packageManager`), and Docker. The
[Neon CLI](https://neon.com/docs/reference/neon-cli) is only needed for staging
and production work, not to run the app locally.

```bash
pnpm start                    # check, install, start Docker, migrate, seed, run dev servers
pnpm preflight                # tells you what is still missing, and the fix
```

`pnpm start` first runs `scripts/start-local.mjs`, which needs nothing
installed. It stops with a one-line message when Node is older than `engines`
or Docker is not running. When there is no `.env` it creates one from
`.env.example`, with `DATABASE_URL` set to the `postgres` service in
`docker-compose.yml` and `DATABASE_URL_UNPOOLED`, `NEON_BRANCH`,
`RESEND_WEBHOOK_SECRET` and `OPERATOR_ALERT_EMAIL` left empty. Their
placeholders are not empty to the apps: the migrator would prefer the unpooled
placeholder, and the API refuses to boot on `operator@...`. An existing `.env` is
only ever read. It then lists every key the apps refuse to boot without that
still holds its placeholder (Neon Auth, Stripe, Resend) and exits non-zero before
`pnpm install`. The key lists are held against the env registry by
`scripts/start-local.test.mjs`.

`pnpm start` is idempotent, so it is also the right command after a `git pull`
or whenever you just want the servers back. Web runs on
http://localhost:3000 and the API on http://localhost:4000. Ctrl-C stops the
dev servers; Docker keeps running until `docker compose down`. Docker holds
Postgres only: uploads are not served from a container (see Object storage).

Individual steps are available as `pnpm install`, `docker compose up -d`,
`pnpm db:migrate`, `pnpm db:seed`, and `pnpm dev`. Parallel ticket work runs in
lanes instead (`pnpm lane:up <id>`, see `CLAUDE.md`).

## Where the database lives

**Locally: the Postgres service in `docker-compose.yml`.** **Staging and
production: Neon branches.**

Local development deliberately does _not_ use Neon. `pnpm dev` holds a
connection pool open, so a Neon compute never scales to zero and a day of
development burns CU-hours against a per-project monthly cap — and exhausting
that cap suspends the compute until the next billing period. Running locally is
also faster, since no query crosses the network.

Locally, point `DATABASE_URL` at that service and leave `DATABASE_URL_UNPOOLED`
and `NEON_BRANCH` unset: `packages/db/src/migration-url.ts` then falls back to
the pooled URL, which is correct because there is no PgBouncer in front of it.

The compose image tracks the major version Neon runs (**18**); a drift test in
`packages/preflight` fails if the two disagree, because a version gap is
invisible locally and surfaces only in production. Postgres 18+ images require
the data volume mounted at `/var/lib/postgresql`, one level above the pre-18
path.

Neon still backs every deployed environment, and its copy-on-write branching is
what gives each pull request an isolated, full-fidelity database. The Neon
connection strings are kept commented in `.env` for when you need to point at a
branch deliberately.

`preflight` refuses to start a ticket while `DATABASE_URL` points at a
`production`, `main` or `master` branch.

## Object storage

Uploaded images live on Neon Object Storage, which has no local emulator, so
nothing in `docker-compose.yml` serves them. Every place that runs the app
uploads to a Neon branch that is **not** `production`:

| Where           | Storage branch                                                   |
| --------------- | ---------------------------------------------------------------- |
| A lane          | `lane-<id>`, made by `pnpm lane:up`, deleted by `pnpm lane:down` |
| A pull request  | `preview/pr-<n>`, from `.github/workflows/preview-branch.yml`    |
| A CI end-to-end | `ci-<run>-<attempt>`, deleted by an `always()` step in `ci.yml`  |
| Staging, prod   | their own branch, provisioned per `neon.ts` (not this document)  |

`pnpm lane:up <id>` creates `lane-<id>` with no compute, cut from `dev` (so it
starts with `dev`'s `uploads` bucket, copy-on-write), reads the branch's own
credential and writes the `STORAGE_*` rows into `.env.lane` (owner-only). It is
idempotent, and a branch expires on its own after seven days if a lane dies
before `lane:down`. It needs `NEON_API_KEY`, or a logged-in `neon` CLI; without
either it fails naming what is missing, and never falls back to a shared
bucket. A Neon refusal (the plan's branch ceiling) fails it the same way.

A plain `pnpm start` has no lane and so no storage branch: the API boots, and
an upload fails at the storage call. Work that uploads belongs in a lane.
`node scripts/ci-storage.mjs assert` fails when a `STORAGE_*` or `AWS_*` value
in the environment names the production branch.

## Environment variables

`packages/shared/src/env/registry.ts` is the single list of every variable.
`.env.example` and `turbo.json`'s passthrough array are generated from it — run
`pnpm env:example` after changing the registry, never edit either by hand. A
test in `packages/shared` fails the build if they drift.

```bash
pnpm preflight                # baseline: core + browser verification
pnpm preflight --capabilities auth,stripe  # the ticket's cap:* labels, Stripe included
pnpm preflight --env production  # production value set, stricter shapes
```

Each check prints the literal command or URL that fixes it, and a run reports
every failure at once rather than stopping at the first. Production readiness
across the providers is `pnpm launch:check` ([pre-launch.md](pre-launch.md)).

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

The scan looks for provider token shapes (Stripe, a retired auth provider, Resend webhook signing, Neon, AWS,
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
leaked. Rotate it at the provider.

## Running the API in a container

`apps/api/Dockerfile` builds the deployable API image. The build context is the
repository root, because a pnpm workspace cannot be installed from one package's
directory:

```bash
docker build -f apps/api/Dockerfile -t vendor-marketplace-api .
docker run --rm -p 4000:4000 --env-file .env -e HOST=0.0.0.0 vendor-marketplace-api
```

The image installs and builds only the `@vendor-marketplace/api` subgraph, then
ships a `pnpm deploy --prod` tree, so it carries neither devDependencies nor the
rest of the monorepo. It runs as the unprivileged `node` user and closes Fastify
on `SIGTERM`, so a rollout drains in-flight requests.

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

## Other developer docs

- [pre-launch.md](pre-launch.md) — `pnpm launch:check` and what must be true before real users
- [runbook-restore.md](runbook-restore.md) — nightly backups and restoring from one
- [demo.md](demo.md) — the hosted demo for friends
