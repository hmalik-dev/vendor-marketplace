---
name: neon-auth-cutover-boundaries
description: VEN-447 moved customer and vendor sign-in from Clerk to Neon Auth; the new trust boundaries are the same-origin /api/auth proxy, /api/session/token, and one users.auth_user_id column now holding ids from two providers
metadata:
  type: project
---

**Audited 2026-09-19 (VEN-447).** Token verification itself is sound and does
not need re-reading: `apps/api/src/plugins/neon-auth.ts` pins `EdDSA`, pins
`iss` **and** `aud` to `new URL(baseUrl).origin` (Neon issues the origin, not
the `/auth` path), requires `emailVerified === true`, takes the bearer from the
header only (never the query — #215 put 27 live JWTs in a dev log), fails closed
on any token it cannot verify, and checks `deletedAt` then `isBanned` before the
row resolves. Neon Auth has **open sign-up**: a token proves an identity and
nothing else, and `findSessionSubject`'s row is the whole gate.

**The role hint is narrowed twice and cannot reach `admin`**: `z.enum(['customer',
'vendor'])` on `acceptTermsSchema`, then `normalizeRole`, and `vendor` is
invite-gated by `admitVendor` inside the acceptance transaction. Do not re-report
the localStorage `signup_role` value as trusted input.

**Three boundaries that are new and thin:**

- `/api/auth/[...path]` is a same-origin Better Auth proxy with a seven-entry
  allowlist (`lib/auth/proxy-allowlist.ts`). The allowlist is what keeps
  change-email / change-password / delete-user unreachable, and it is the only
  thing that does. **Nothing throttles it** — it is a Next route, so the Fastify
  limiter never sees it, and the provider sees the server's IP, not the caller's.
- `/api/session/token` hands the browser a 15-minute JWT from the httpOnly
  cookie. `no-store`, no CORS, never a client prop — verified.
- `users.auth_user_id` holds ids from two providers in one column, and since
  **VEN-450 `users.auth_provider`** (`neon_auth|legacy_clerk|seed`) says which —
  recorded at insert, never inferred from the id. `isUnbackedIdentity` is
  `!== 'neon_auth'`, and it is the _only_ thing keeping `pnpm reconcile:auth`,
  `releaseStaleHolder` and `closeAccount`'s identity deletion off seeded and
  Clerk-era rows: absent at Neon Auth otherwise means **retired and refunded**.
  The column defaults to `neon_auth`, so **the dangerous value is the default** —
  a new writer of an unbacked row (seed, fixture, import) that omits it arms a
  mass retirement, and no CHECK ties `'seed'` to a `seed_` id. Migration 0056 is
  the last place an id shape decides anything. Audit any pass that treats
  "absent at the provider" as "deleted by the user"; the only backstop is
  `remote.size === 0 && local.length > 1`.
- `packages/db/src/neon-auth-directory.ts` is raw SQL on `neon_auth` over a
  second connection (`NEON_AUTH_DATABASE_URL`, required off baseline/local).
  Queries are module constants and parameterised; the one wart is the
  verification cleanup matching the address as a **substring** of `identifier`.

**How to apply:** audit any new `/api/auth/*` allowlist entry as an account
operation, and any new writer of `users` rows as a second provider writing into
`users_email_key` — a squatted address is an unrecoverable 500 at
`insertUserIfAbsent`, not a collision anyone sees.
