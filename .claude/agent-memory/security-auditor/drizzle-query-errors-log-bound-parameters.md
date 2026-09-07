---
name: drizzle-query-errors-log-bound-parameters
description: drizzle-orm 0.45.2's DrizzleQueryError message is `Failed query: <sql>\nparams: <every bound value>` and also exposes enumerable .query/.params, so any log.error({err}) on a failed write emits the row's values verbatim
metadata:
  type: project
---

Verified in `node_modules/.pnpm/drizzle-orm@0.45.2/.../drizzle-orm/errors.js`:

```
class DrizzleQueryError extends Error {
  constructor(public query, public params, public cause) {
    super(`Failed query: ${query}\nparams: ${params}`);
```

`query` and `params` are own enumerable properties **and** are interpolated into
`message`. pino's default `err` serializer copies every own enumerable property,
and `server.ts`'s `redact` list is path-based (`req.headers.*` only) — nothing
matches the `err` branch. So every `log.error({ err })` on a failed statement
writes the full SQL plus each bound value into the log stream.

The driver error underneath is on `.cause`, which is why
`lib/constraint-violation.ts` walks the chain for the constraint name rather
than matching the wrapper's message.

**Why:** this is the same class of leak as
[[webhook-error-objects-carry-the-redacted-header]] but reached from ordinary
writes rather than webhook verification, and it is **pre-existing and
project-accepted**: `plugins/error-handler.ts` already logs `{ err }` on every
unhandled error and on every non-Fastify 4xx, deliberately ("logged in full even
though the reply is generic"). Moving a throw from the error handler into a
local `try/catch` that logs `{ err }` is therefore net-neutral — do not report it
as a new leak.

**How to apply:** it _is_ a finding when the failing statement binds something
the log must never hold — a session token, a Clerk secret, an R2 key, a webhook
secret. As of #408 the four new catch sites (`bestEffortAnnouncement`,
`bestEffortNotice`, `sendMessage`'s notification catch, `lib/background.ts`) all
fail on `notifications` inserts, whose params are a user id, a title and a body
naming a business or first name — no credential. Check what the _statement_
binds before escalating, not the fact that `{ err }` is logged.

**The first confirmed escalation is #431** (`modules/cases/cases.service.ts`'s
`bestEffort`, reached from `openSupportCase`). That statement is the
`support_cases` INSERT, so its params are the 4,000-character support message
body and the sender's reply-to address — the two things
`support.service.ts:323-327` says in words must never reach the log. It is not a
theoretical failure either: see
[[free-text-accepts-nul-so-any-text-insert-can-be-failed-on-demand]]. The fix is
per-call-site, not in `bestEffort` — `recordCaseSendFailure` shares the helper
and its statement binds only ids and timestamps.
