# @vendor-marketplace/web

The Orla frontend: Next.js 15 (App Router, React Server Components),
Tailwind CSS 4, shadcn/ui, and Clerk for authentication.

## Running it

From the repository root:

```bash
pnpm dev                      # every app and package
pnpm --filter @vendor-marketplace/web dev   # just this one
```

The app reads `NEXT_PUBLIC_API_URL` (browser) and `API_URL` (server) to reach
the Fastify API in `apps/api`. Copy `.env.example` at the repository root and
put the Clerk keys in `apps/web/.env.local`.

## Layout

```
src/app/         Routes. `/customer/*` and `/vendor/*` are role-separated by
                 their layouts; `/dashboard` resolves the role and forwards.
src/components/  Server Components by default; `'use client'` only where a
                 hook, an event handler, or a browser API needs it.
src/lib/         `api-client.ts` (the single fetch path to the API),
                 `current-user.ts` (session + role resolution, server only),
                 `wire-schemas.ts` (JSON <-> domain schema coercion).
```

Route protection is two-layered: `src/middleware.ts` requires a Clerk session
for `/dashboard`, `/customer/*`, and `/vendor/*`, then each role layout checks
the local `users.role` column — never Clerk metadata, which the account holder
can write.
