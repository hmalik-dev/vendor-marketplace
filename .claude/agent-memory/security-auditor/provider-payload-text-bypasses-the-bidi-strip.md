---
name: provider-payload-text-bypasses-the-bidi-strip
description: Free text arriving in a webhook payload is stored without stripBidiControls, and request-body-free-text.test.ts structurally cannot see it — the schema is safeParsed by hand, not attached as a Fastify body schema
metadata:
  type: project
---

`packages/shared/src/schemas/index.ts` makes `freeText()` — `z.string()
.overwrite(stripBidiControls).trim()` — the one boundary every stored free-text
field crosses, and `apps/api/src/request-body-free-text.test.ts` enforces it by
**discovering the schemas that route files attach as request bodies** and
parsing a U+202E through every string field.

A webhook schema is invisible to that guard. `resend.schemas.ts` and
`clerk.schemas.ts` are run by hand with `safeParse` inside the handler; the
route's `schema` option carries a `response` only. The test file names this gap
itself ("a write path that is not a Fastify request body… needs its own guard;
this one cannot see it") and points at `mirroredClerkName` as the covered
example.

Confirmed 2026-09-07 on #439: `resendEventSchema.data.bounce.message` is a bare
`z.string().optional()` and lands in `email_deliveries.failure_reason`.

**Why:** the text is third-party-influenceable, not merely third-party. Anyone
who can make the platform email an address at a domain they control — register a
customer, trigger any notification — chooses what their MTA returns as the SMTP
diagnostic, and Resend forwards it verbatim. #437 renders that column in the
admin console. Bidi reordering in an operator's view is the #398 defect, one
hop further out.

**How to apply:** any new schema parsed with `safeParse` rather than attached to
a route builds its string fields from the shared free-text helpers and states
its own maximum — the DAO's later `slice()` is a column guard, not a validator.
Related: [[image-ref-scheme-allowlist-is-whitespace-bypassable]],
[[drizzle-query-errors-log-bound-parameters]].
