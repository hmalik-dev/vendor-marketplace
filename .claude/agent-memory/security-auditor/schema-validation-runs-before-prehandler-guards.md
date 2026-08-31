---
name: schema-validation-runs-before-prehandler-guards
description: Fastify validates params/query/body before preHandler, so every requireAuth/requireRole route answers anonymous callers with a Zod 400 first; requireAuthBeforeValidation (onRequest) is the fix and only /upload/image uses it
metadata:
  type: project
---

The error handler sends `details: error.validation` verbatim
(apps/api/src/plugins/error-handler.ts:63-69), and Zod 4's enum message lists
every allowed value. Because validation precedes `preHandler`, an
**unauthenticated** caller reads that 400 off any guarded route.

#311 fixed exactly one route: `/upload/image` moved to
`onRequest: requireAuthBeforeValidation` (apps/api/src/lib/guards.ts:65). The
ordering that makes it work is guaranteed, not incidental — `clerkAuthPlugin` is
`fastify-plugin`-wrapped so its `onRequest` hook lands on the root instance, and
it is registered (server.ts:139) before every route plugin (144+); instance-level
hooks always run before route-level hooks of the same phase.

Still on `preHandler` with an enum in a _request_ schema, as of 2026-08-30:
`GET /booking-requests?status=` (booking-requests.routes.ts:64) and
`PATCH /vendor/availability` (availability.routes.ts:31).

**Why:** the values those two leak are already public (availability statuses ship
in the public `/vendors/:slug/availability` response; both sets are literals in
the web bundle), so they were left as low-severity rather than fixed.

The operations console (#15, `modules/admin/admin.routes.ts`) repeats the shape
on a **privileged** plugin: the four mutating routes correctly use
`requireRoleBeforeValidation('admin')` on `onRequest`, but every `GET` and the
`DELETE` stay on `preHandler: requireRole('admin')`. Reproduced 2026-08-31 with a
standalone Fastify + `fastify-type-provider-zod` app: an anonymous
`GET /admin/vendors?status=bogus` answers
`400 {"details":[{"params":{"values":["live","review","flagged","paused"]}}]}`
where a well-formed request answers 401. The plugin's own
`it('refuses every admin route without a session')` passes because it injects no
query string — the suite's guarantee is narrower than it reads.

**How to apply:** don't re-report those two as blockers. Do require
`requireAuthBeforeValidation` on any _new_ guarded route whose request schema
would describe something not already public — internal enums, id-shape hints, or
a `refine` message naming a rule.
