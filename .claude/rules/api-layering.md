---
paths:
  - 'apps/api/**/*.ts'
---

# API layering and authorization

## Route -> service -> DAO

Routes declare Zod schemas and guards. Services hold business rules and throw
`AppError`. DAOs own every Drizzle query. A route that runs a query directly, or
a DAO that decides policy, is in the wrong layer.

Only `AppError` produces a client-visible message. Anything else becomes an
opaque 500 — so never leak an internal error string by throwing a bare `Error`
with detail in it.

Use the Zod type provider for route schemas. Register cross-cutting concerns as
plugins, and use `onRequest` / `preHandler` hooks for middleware.

## Authorization reads the local column, never the token

Role is chosen once, at sign-up. Neon Auth has no sign-up field to carry it
(VEN-444; it refuses `role` and drops any other custom field, VEN-662), so the
auth proxy takes it off the sign-up body and records it at the API's
`/internal/sign-up-role` in `sign_up_roles`, keyed by the provider's user id.
The Terms acceptance creates the user row with that record, and falls back to a
`role` in its body only where nothing was recorded. Both are caller-writable, so
each is validated against `SIGN_UP_ROLES` (`normalizeRole` refuses anything but
`customer` or `vendor`, never defaulting) at the single point where a user row
is created, and `vendor` is gated on an invite before any
row exists. **Every later authorization decision reads the local `users.role`
column.** The Neon JWT's own `role` claim is always `authenticated` and is never
read; a guard that trusts a token claim or the request body at request time is a
privilege-escalation bug. A valid token proves an identity and nothing else: the
API never creates a `users` row from a token alone.

## Derived columns are recomputed, never incremented

`vendor_profiles.avg_rating` and `review_count` are recomputed from source rows.
No endpoint may write them.

## API contracts

POST that creates returns 201 with a `Location`. POST as an action returns 200.
PUT and PATCH return 200 or 204. Response shape is consistent across endpoints.
Removing a required field from a response is a breaking change.
