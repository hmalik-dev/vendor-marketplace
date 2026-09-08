---
name: violates-constraint-matches-bound-parameters
description: violatesConstraint's name check is dead under postgres.js, so it matches only the message — and DrizzleQueryError's message contains every bound parameter, making the match attacker-influenceable
metadata:
  type: project
---

`apps/api/src/lib/constraint-violation.ts` decides whether a failed statement is
a named constraint violation. Two facts make it wider than every call site's
doc comment claims:

- **The `constraint` field never exists in production.** postgres.js 3.4.9 maps
  Postgres error field `n` to **`constraint_name`**
  (`node_modules/.pnpm/postgres@3.4.9/.../src/connection.js:46`, and
  `PostgresError` is `Object.assign(this, x)`), not `constraint`. `named()`
  reads `link.constraint`, so it returns `null` for every real driver error and
  the **message substring is the only matcher that ever fires**. The unit test
  passes anyway because the first case takes a real error whose message _does_
  carry the name, and the second case hand-builds `{ constraint: … }`.
- **The message carries the bound values.** drizzle 0.45.2
  (`drizzle-orm/errors.js:10-19`) builds `DrizzleQueryError`'s message as
  `Failed query: ${query}\nparams: ${params}` — array `toString()`, every
  value verbatim. `chainOf(...).some(link => link.message.includes(constraint))`
  therefore returns **true for any failure of that statement** whenever a bound
  parameter contains the constraint name as a substring. The wrapper is the
  outermost link, so it is checked before the driver error.

**Why:** #462 leaned on this to decide whether to swallow a failed identity
mirror on the svix-verified Clerk webhook and answer 200. A user who puts
`users_email_key` in their Clerk first name, last name or email arms every
transient failure of that `UPDATE` (40P01, 40001, 57014, connection loss) to be
read as an email collision: the true error is discarded, svix never redelivers
because the reply is 200, `users.email` stays stale, and the console shows a
fabricated "Email out of date" flag. `reviews.service.ts:225`
(`reviews_booking_reviewer_key`) has the same shape over review text.

Not directly weaponisable into a silent swallow through a _forced_ error,
because the retry re-binds every field except `email` and fails again — so a
poisoned over-long name or a NUL still 500s. It is the transient-error case
that swallows.

**How to apply:** any new `violatesConstraint` call site that decides whether to
_continue_ rather than _translate a status code_ must also pin the SQLSTATE —
`driverCodeOf(error) === '23505'`, the same cause walk
[[err-serializer-is-the-log-sink]] already implements — or the substring arm has
to go and `named()` has to read `constraint_name` too. Related:
[[retired-users-keep-their-email-in-the-unique-index]] (why the collision exists
at all), [[clerk-webhook-is-now-a-money-mover]].
