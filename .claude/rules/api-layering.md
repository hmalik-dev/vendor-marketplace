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

Role is chosen once, at sign-up, and travels as Clerk `unsafeMetadata`. The
account holder can write that field, so it is narrowed by `normalizeRole` at the
single point where a user row is created. **Every later authorization decision
reads the local `users.role` column.** A guard that trusts `unsafeMetadata` at
request time is a privilege-escalation bug.

A new or modified endpoint carries auth and authz consistent with its neighbours.
An unguarded route beside guarded ones is a finding.

## Derived columns are recomputed, never incremented

`vendor_profiles.avg_rating` and `review_count` are recomputed from source rows.
No endpoint may write them.

## API contracts

POST that creates returns 201 with a `Location`. POST as an action returns 200.
PUT and PATCH return 200 or 204. Response shape is consistent across endpoints.
Removing a required field from a response is a breaking change.
