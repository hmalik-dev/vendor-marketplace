# @vendorhub/api

The VendorHub backend: Fastify 5 with the Zod type provider, Drizzle ORM, and
Clerk session verification.

## Running it

From the repository root:

```bash
pnpm dev                      # every app and package
pnpm --filter @vendorhub/api dev   # just this one
```

Configuration is validated once at boot by `src/config/env.ts`; a missing or
malformed variable fails the process before it binds a port. Copy
`.env.example` at the repository root for the full list.

## Layout

```
src/config/    Environment parsing.
src/plugins/   Cross-cutting concerns: error handler, database handle,
               Clerk session resolution.
src/lib/       AppError and the role guards routes compose.
src/modules/   One folder per aggregate: routes -> service -> DAO.
src/testing/   Boots the real server against in-process Postgres.
```

Routes declare Zod schemas and guards, services hold business rules and throw
`AppError`, DAOs own every Drizzle query. Only an `AppError` produces a
client-visible message; anything else is logged and answered with an opaque
500, so stack traces, SQL, and paths never leave the process.

## Tests

`pnpm --filter @vendorhub/api test` boots an in-process Postgres (PGlite),
applies the real migrations, and drives the real Fastify instance. Only two
network boundaries are faked: Clerk token verification and svix webhook
signature verification.
