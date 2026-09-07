---
name: free-text-accepts-nul-so-any-text-insert-can-be-failed-on-demand
description: freeText() strips bidi controls but not U+0000, and Postgres refuses NUL in a text parameter with 22021 — so a caller can deterministically fail any insert that binds their free text
metadata:
  type: project
---

`freeText()` (`packages/shared/src/schemas/index.ts:225`) is
`z.string().overwrite(stripBidiControls).trim()`. `BIDI_CONTROLS` covers the
overrides and isolates only, and JS `.trim()` does not treat `U+0000` as
whitespace — so a NUL survives Zod and reaches the bound parameter.

Postgres refuses it: verified 2026-09-07 against PGlite 0.5.7 (real Postgres),
`insert into t (m) values ($1)` with `"a\0b"` raises
`22021 invalid byte sequence for encoding "UTF8": 0x00`. Fastify's JSON parser
happily produces the character from a `"�"` escape.

**Why it matters:** it turns "this insert might fail transiently" into "the
caller decides when this insert fails". Any consequence a diff parks on the
failure branch of a user-text write is then attacker-triggerable on demand —
most importantly the `{ err }` log leak in
[[drizzle-query-errors-log-bound-parameters]], and any `bestEffort` /
`onConflictDoNothing` branch that swallows the write and lets the rest of the
request commit.

**How to apply:** when a diff adds a text column fed by `freeText()`, ask what
happens when that one statement fails while everything around it succeeds. On
`POST /support/messages` the booking-linked path is accidentally safe — the same
NUL fails `bookings.dispute_reason` inside `placeDisputeHold` first, so the
request 500s before any hold is placed — but the general path reaches
`openSupportCase` with the hold question already settled. Do not assume the
ordering that saves one path saves the next one.
Related: [[support-report-is-a-public-route-that-moves-money]].
