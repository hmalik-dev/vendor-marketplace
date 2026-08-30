---
name: response-schemas-are-a-second-write-boundary
description: Widening a write schema in packages/shared without widening every response schema fed by the same column turns user data into a cross-user 500, because fastify-type-provider-zod validates on the way out
metadata:
  type: project
---

Every API response is re-validated by `serializerCompiler`, and a failure is a
500 (`apps/api/src/plugins/error-handler.ts`, `isResponseSerializationError`).
So a column's *write* schema and every *response* schema that reads that column
form one boundary: widening only the write side lets a user store a value that
detonates on someone else's page.

Confirmed twice on `users.avatar_url` / `vendor_profiles.profile_image_url`:
`imageRefSchema` (object keys) on the write side, `urlSchema` still on
`conversationSummarySchema.otherPartyAvatarUrl` — the counterparty's whole
`GET /conversations` 500s once the other side has an uploaded photo.

**Why:** the #47 key migration converted columns field by field, and the shared
schema file has five separate avatar fields fed by two columns; there is no test
that walks column -> every schema that carries it.

**How to apply:** when a diff changes a field in `packages/shared/src/schemas`,
grep the *column* (not the field name) through the DAOs to find every response
schema it reaches, and check each one. Related: [[image-ref-scheme-allowlist-is-whitespace-bypassable]].
