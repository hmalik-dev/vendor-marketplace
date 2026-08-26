# Vendor Marketplace — Project Instructions

Two-sided marketplace connecting customers with event service vendors
(photographers, DJs, caterters, florists). Turborepo + pnpm monorepo.

**Ticket tracker:** `~/.claude/plans/vendor-marketplace-tickets.md`
**Plan:** `~/.claude/plans/vendor-marketplace-plan.md`
**Decisions:** `~/.claude/plans/vendor-marketplace-decisions.md`
**Design system:** `~/.claude/plans/vendor-marketplace-design-system.md`

## Ticket queue

This project's queue is the **local markdown tracker** above, not Linear. This
overrides the Linear-resolution step in `~/.claude/orchestration-policy.md`:
`/next-ticket` and `/ticket` must **not** return `BLOCKED` for a missing
`Linear project:` entry, and must not call the Linear MCP connector (it is
unauthenticated here).

Read eligibility, priority, and `Blocked By` from the tracker's Status Board
table, apply the policy's queue order (highest priority; In Progress before
ready; respect `Blocked By`), and write transitions back to that table
(Backlog → In Progress → Done), filling the Branch column and recording the
commit SHA in Notes when marking Done.

## Commands

Run from the repository root; Turborepo fans each task out across packages.

| Task            | Command                                                                                      |
| --------------- | -------------------------------------------------------------------------------------------- |
| Install         | `pnpm install`                                                                               |
| Build all       | `pnpm build`                                                                                 |
| Typecheck all   | `pnpm typecheck`                                                                             |
| Lint all        | `pnpm lint`                                                                                  |
| Test all        | `pnpm test`                                                                                  |
| Format          | `pnpm format` (check with `pnpm format:check`)                                               |
| Preflight gate  | `pnpm preflight --ticket <n>`                                                                |
| Regenerate env  | `pnpm env:example`                                                                           |
| Dev servers     | `pnpm dev`                                                                                   |
| Build API image | `docker build -f apps/api/Dockerfile -t vendor-marketplace-api .` (context is the repo root) |
| Single package  | `pnpm --filter @vendor-marketplace/db <script>`                                              |

Database:

| Task                 | Command                                                        |
| -------------------- | -------------------------------------------------------------- |
| Start local services | `docker compose up -d` (MinIO; Postgres only for offline work) |
| Generate a migration | `pnpm db:generate` (after editing `packages/db/src/schema`)    |
| Apply migrations     | `pnpm db:migrate`                                              |
| Seed reference data  | `pnpm db:seed`                                                 |
| Browse data          | `pnpm db:studio`                                               |

## Layout

```
apps/
  web/        Next.js 15 (App Router, RSC) frontend      — port 3000
  api/        Fastify 5 backend                          — port 4000
packages/
  shared/     Zod schemas, inferred types, constants, utilities, env registry
  db/         Drizzle schema, client, migrations, seed
  preflight/  `pnpm preflight` — the pre-ticket environment gate
  config/     Shared TypeScript, ESLint, and Tailwind configs
```

`packages/preflight` is a leaf: it depends on `packages/shared`, and nothing
depends on it, so the one-way `apps → packages` direction still holds.

**Dependency direction is one-way: `apps → packages`.** `packages/shared` never
imports from `packages/db` or from an app. `packages/db` may import enums and
constants from `packages/shared`.

## Conventions

- **Enums live once.** Every domain enum is a `as const` array in
  `packages/shared/src/constants`. `pgEnum` in `packages/db` and `z.enum` in
  `packages/shared/src/schemas` both derive from it, so the database, the API
  contract, and the frontend cannot drift. Never redeclare a literal union.
- **Money is always integer cents.** `price_cents`, `total_amount_cents`, and
  friends. Convert at the display boundary with `formatPrice`.
- **Event dates are Postgres `DATE`** and stay `YYYY-MM-DD` strings end to end.
  Never round-trip one through a `Date` in local time — use the helpers in
  `packages/shared/src/utils`.
- **Derived columns** (`vendor_profiles.avg_rating`, `review_count`) are
  recomputed from source rows, never incremented, and never writable by an
  endpoint.
- **Environment variables live once**, in `packages/shared/src/env/registry.ts`.
  `.env.example` and `turbo.json`'s `globalPassThroughEnv` are generated from it
  by `pnpm env:example`; a test in `packages/shared` fails if either drifts.
  `apps/api/src/config/env.ts` and `apps/web/src/config/env.ts` derive their Zod
  schemas from the same rows, so presence, shape, and defaults cannot disagree.
  Never add a variable to `.env.example` by hand.
- **Every ticket declares its capabilities** (`core`, `auth`, `storage`,
  `stripe`, `email`, `sentry`; `e2e` is implicit) in
  `packages/shared/src/env/tickets.ts`. `pnpm preflight --ticket <n>` checks only
  those, so a ticket that never touches Stripe is never blocked on Stripe keys.
- **The application database is a Neon branch.** Local development must never
  point at `production`; preflight refuses to start a ticket that does. The
  Postgres service in `docker-compose.yml` exists only for offline work.
- **Schema changes** are made in `packages/db/src/schema`, then committed with
  the migration generated by `pnpm db:generate`. Never hand-edit a file in
  `packages/db/drizzle/`.
- The DB and API test suites boot an in-process Postgres (PGlite) via
  `@vendor-marketplace/db/testing`, so schema, seed, and route behaviour are verified
  against a real engine without Docker. `apps/api/src/testing/test-server.ts`
  wraps it with the real Fastify instance, faking only the two network
  boundaries — Clerk token verification and svix signature verification.
- **`apps/api` is layered route → service → DAO.** Routes declare Zod schemas
  and guards, services hold business rules and throw `AppError`, DAOs own every
  Drizzle query. Only `AppError` produces a client-visible message; anything
  else becomes an opaque 500.
- **Role is chosen once, at sign-up**, and travels as Clerk `unsafeMetadata`.
  Because the account holder can write that field, it is narrowed by
  `normalizeRole` at the single point where a user row is created, and every
  later authorization decision reads the local `users.role` column instead.

Global engineering standards (type safety, defensive code, testing, commit
format, pre-commit gate) live in `~/.claude/CLAUDE.md` and apply here.

## Stack

Next.js 15 · Fastify 5 · Drizzle ORM · PostgreSQL 16 · Clerk · Stripe Connect ·
Cloudflare R2 · Resend · Tailwind CSS 4 + shadcn/ui · Zod · Vitest · Playwright
