---
name: review-checklist-widened-write-schema-vs-response-schemas
description: When a diff widens a write-side Zod schema for a DB column, grep every response schema reading that same column — this API 500s on response-serialization mismatch
metadata:
  type: project
---

A diff that relaxes a column's **write** schema (e.g. `avatarUrl: urlSchema` ->
`imageRefSchema`) makes new value shapes reachable in the database. Every
**response** schema that reads the same column must be widened in the same
commit, or the first row carrying the new shape kills the whole endpoint.

**Why:** `apps/api/src/server.ts` sets `serializerCompiler` from
`fastify-type-provider-zod`, and it _validates_. Verified empirically in the
170 worktree with a throwaway Fastify app: a `z.url()` response field returning
`'portfolio/a.webp'` answers `500 FST_ERR_RESPONSE_SERIALIZATION`, and
`plugins/error-handler.ts` converts that to an opaque `Internal server error`.
The failure is total (whole list endpoint), not per-row, and the log line is
`'Response failed its schema'`.

Caught this in the #170 diff: `users.avatarUrl` was widened to `imageRefSchema`
but `conversationSummarySchema.otherPartyAvatarUrl`
(`packages/shared/src/schemas/index.ts`) still read `urlSchema` while
`messaging.service.ts` maps `users.avatarUrl` into it — so a customer uploading
a profile photo would 500 every vendor's inbox.

**How to apply:** for each schema field the diff changed, `grep -rn "<column>"
packages/shared/src/schemas apps/api/src/modules` and check the _read_ models
and DAO projections, not just the write model. Also check
`apps/web/src/lib/wire-schemas.ts` — if the wire schema already uses
`imageUrl()` for a field the shared schema still types as `urlSchema`, that
mismatch is itself the tell that the shared side was missed by an earlier
migration.

Related: [[review-checklist-unpinned-safety-constants]].
