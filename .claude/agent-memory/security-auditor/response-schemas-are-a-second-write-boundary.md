---
name: response-schemas-are-a-second-write-boundary
description: Widening a write schema in packages/shared without widening every response schema fed by the same column turns user data into a cross-user 500, because fastify-type-provider-zod validates on the way out
metadata:
  type: project
---

Every API response is re-validated by `serializerCompiler`, and a failure is a
500 (`apps/api/src/plugins/error-handler.ts`, `isResponseSerializationError`).
So a column's _write_ schema and every _response_ schema that reads that column
form one boundary: widening only the write side lets a user store a value that
detonates on someone else's page.

Confirmed twice on `users.avatar_url` / `vendor_profiles.profile_image_url`:
`imageRefSchema` (object keys) on the write side, `urlSchema` still on
`conversationSummarySchema.otherPartyAvatarUrl` — the counterparty's whole
`GET /conversations` 500s once the other side has an uploaded photo.

**Why:** the #47 key migration converted columns field by field, and the shared
schema file has five separate avatar fields fed by two columns; there is no test
that walks column -> every schema that carries it.

**Second variant, confirmed on #12 (reviews):** the response value need not be a
column at all. `reviewsDisplayName` in `apps/api/src/modules/reviews/reviews.dao.ts`
builds `first_name || ' ' || left(last_name,1) || '.'` — three characters longer
than `users.first_name`'s `varchar(100)` — and
`publicReviewSchema.reviewerName` bounds it at `MAX_NAME_LENGTH` (100). A
reviewer who fills their first name to the 100 the profile editor allows 500s
the vendor's whole public Reviews tab. **Any SQL-concatenated display field
needs its bound computed from the concatenation, not copied from the source
column's constant.**

**How to apply:** when a diff changes a field in `packages/shared/src/schemas`,
grep the _column_ (not the field name) through the DAOs to find every response
schema it reaches, and check each one. When a DAO _derives_ a string in SQL,
add up the maximum length by hand and compare it to the schema's `.max()`.
Related: [[image-ref-scheme-allowlist-is-whitespace-bypassable]].
