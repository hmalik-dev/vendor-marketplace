# VendorHub

A two-sided marketplace connecting customers with event service vendors —
photographers, DJs, makeup artists, decorators, caterers, and florists.
Preset packages with transparent pricing, reviews tied to real bookings,
secure payment via Stripe Connect, and messaging in booking context.

## Getting started

Prerequisites: Node 20+, pnpm 10+, Docker.

```bash
pnpm install                  # install workspace dependencies
cp .env.example .env          # fill in values as integrations come online
docker compose up -d          # start local PostgreSQL 16
pnpm db:migrate               # apply migrations
pnpm db:seed                  # populate service categories
pnpm dev                      # start dev servers
```

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

See `CLAUDE.md` for architecture conventions and the full command reference.
