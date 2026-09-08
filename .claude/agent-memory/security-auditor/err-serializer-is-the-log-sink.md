---
name: err-serializer-is-the-log-sink
description: apps/api's `err` pino serialiser redacts bound query params, but pino reaches errors through three doors and the serialiser only walks one of them (`cause`)
metadata:
  type: project
---

`apps/api/src/lib/log-error-serializer.ts` (#445) is the single sink for every
`log.*({ err })` in the API. It strips `DrizzleQueryError`'s bound values from
`message`, `stack` and the own `params` property, keeps `query`, the frames, the
type and the driver `SQLSTATE` (lifted from the cause as `driverCode`).

**Why:** the insert behind the public unauthenticated `POST /support/messages`
fails on a caller-chosen `U+0000` (Postgres 22021), so a stranger decided when
4 KB of their own text plus their reply-to address were written to the log.
See [[support-report-is-a-public-route-that-moves-money]] and
[[free-text-accepts-nul-so-any-text-insert-can-be-failed-on-demand]].

**How to apply:** pino (`pino-std-serializers@7`) reaches nested errors through
**three** doors, and `sanitize()` walks only the first:

1. `cause` — covered.
2. `err.errors` → `_err.aggregateErrors = err.errors.map(errSerializer)`, pino's
   own serialiser, unsanitised. An `AggregateError`/`Promise.any` over two DB
   reads reinstates the whole leak.
3. any _other_ own enumerable error-valued property → `_err[key] =
errSerializer(val)`, also unsanitised. And a query error nested inside a
   plain-object property is copied whole and JSON-stringified with its `params`.

All three verified by probe against the real `DrizzleQueryError` and
`pino-std-serializers`. None is reachable in the tree as of 2026-09-07 (no
`AggregateError`, no error stored under a named property), so it was reported as
defence-in-depth — but the ticket's whole thesis is that a future author is
covered without knowing the hazard exists.

Settled non-leaks, do not re-report:

- **`PostgresError.detail` / `where` / `hint` / `internalQuery` never reach the
  log** while the driver error sits at `cause`. pino skips `key === 'cause'` in
  its `for...in` and takes only `message` and `stack` from the chain; Postgres
  puts the offending value in `detail`, never in `message`. Drizzle 0.45.2's
  `pg-core/session.cjs` wraps every execution path, and no raw postgres.js query
  runs in the request path, so the driver error is never the top-level `err`.
- **The stack splice by position is not defeatable.** It excises
  `error.message` from `stack` by `indexOf` + `length`, so a bound value shaped
  like `\n    at X (y.ts:1:1)\nparams: decoy` goes with it.
- `_err.raw` is non-enumerable on `pinoErrProto` and holds the sanitised clone.
- zod 4.4.3 `ZodError` has no `errors` array and its issues carry no `input`.

**pino does not catch a throwing serialiser** (`pino/lib/tools.js` calls
`serializers[key](value)` bare). A throw out of `request.log.error` in
`error-handler.ts` is caught by Fastify as `reply.send(err)`, which replies with
the serialiser's own message instead of the opaque 500 body.
