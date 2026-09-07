---
name: zdate-needs-a-wire-coercion
description: A z.date() added to any response schema needs a matching z.coerce.date() in wire-schemas.ts, or that screen 500s
metadata:
  type: project
---

Adding a `z.date()` field to a response schema in
`packages/shared/src/schemas` **requires** a matching `z.coerce.date()` in
`apps/web/src/lib/wire-schemas.ts`. JSON has no date type, so the value arrives
as an ISO string, `safeParse` fails, and `api-client` throws
`ApiClientError: … did not match its schema` from the RSC — the whole screen,
not the field.

**The local gate cannot see it.** `tsc` infers `Date` on both sides of the wire,
and the API route suites read the response *object* rather than its JSON, so
typecheck, lint and every test stay green. Component tests hand the component a
real `Date` and pass too.

**And it can be conditional, which is what makes it dangerous.** #423 added
`releaseAt` to `vendorDashboardSchema.nextPayout`, which is nullable — so the
dashboard rendered perfectly for every vendor owed nothing and 500'd for every
vendor owed a payout. A browser pass over a fixture in the *other* state reports
the screen clean, which is exactly what happened.

So: when a schema gains a date, check `wire-schemas.ts` in the same edit, and
drive the browser in the state that actually populates the field. Any wire
schema whose comment says "no date fields, so no coercion is needed" is a
statement that a later ticket can silently falsify — that comment was on
`wireVendorDashboardSchema`.

Related: [[verify-with-a-differently-shaped-check]].
