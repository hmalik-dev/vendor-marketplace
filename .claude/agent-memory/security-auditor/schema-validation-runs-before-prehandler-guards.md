---
name: schema-validation-runs-before-prehandler-guards
description: Fastify parses the body and validates params/query/body before preHandler, so a preHandler-only guard answers a wrong-role or signed-out caller with a 400 describing the schema; requireAuthBeforeValidation / requireRoleBeforeValidation (onRequest) are the fix and VEN-488 moved every body-bearing role route
metadata:
  type: project
---

The error handler sends `details: error.validation` verbatim
(apps/api/src/plugins/error-handler.ts), and Zod 4's enum message lists every
allowed value. Validation — and the body parser, whose
`FST_ERR_CTP_EMPTY_JSON_BODY` fires even with no `body` schema — precede
`preHandler`, so an unauthenticated or wrong-role caller reads a 400 off a
guarded route.

The ordering that makes the `onRequest` guards work is guaranteed, not
incidental: `neonAuthPlugin` is `fastify-plugin`-wrapped (its single `onRequest`
hook lands on the root instance) and is registered in `server.ts` before every
route plugin, and instance hooks always run before route-level hooks of the same
phase. So `request.auth` / `request.termsRequired` are resolved. Both
`requireAuthBeforeValidation` and `requireRoleBeforeValidation` call
`assertTermsAccepted` first, exactly like their `preHandler` twins — moving a
guard between the two stages changes nothing but the stage.

**VEN-488 (2026-09-20) moved all 13 body-bearing role-gated routes** to
`onRequest` — vendor profile POST/PUT, packages POST/PUT×2, portfolio
POST/PUT/PATCH, `PUT /vendor/availability`, `/tags/suggest`,
`/booking-requests/:id/quote`, `POST /booking-requests`, `POST /conversations`.
Guard coverage, terms gate and role sets all unchanged; handlers still re-assert
with `assertRole`/`authenticated`.

**VEN-490 (2026-09-20)** took the two bodyless holdouts: `DELETE
/vendor/portfolio/:itemId` and `GET /customers/me/reviews`. A bodyless route is
still reachable with `content-type: application/json` and an empty payload, so
the parser's `FST_ERR_CTP_EMPTY_JSON_BODY` 400 preceded the old `preHandler`
guard; params/query validation did too.

Still on `preHandler` **on purpose**: `GET /booking-requests?status=` — its enum
is already public. Same for every `GET`/`DELETE` in `modules/admin/admin.routes.ts`
(its four mutating routes do use `requireRoleBeforeValidation('admin')`): an
anonymous `GET /admin/vendors?status=bogus` still answers
`400 {"details":[{"params":{"values":[...]}}]}` where a well-formed request
answers 401. Don't re-report these.

**Ordering residual:** `@fastify/rate-limit` appends its route hook after the
route's own `onRequest` (index.js:236), so on `/tags/suggest` the role guard now
runs before that route's limiter and non-vendor traffic is no longer counted.
Harmless — the limit is per-vendor queue flooding, and the route was already
floodable pre-auth (see [[rate-limit-key-is-the-proxy-not-the-caller]]) — but a
guard placed on `onRequest` always shortens what its route limiter sees.

**How to apply:** require `requireRoleBeforeValidation` /
`requireAuthBeforeValidation` on any new guarded route that takes a body, or
whose request schema would describe something not already public — internal
enums, id-shape hints, a `refine` message naming a rule.
