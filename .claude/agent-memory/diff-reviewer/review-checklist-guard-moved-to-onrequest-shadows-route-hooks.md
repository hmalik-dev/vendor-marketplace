---
name: review-checklist-guard-moved-to-onrequest-shadows-route-hooks
description: Moving a route guard from preHandler to onRequest puts it ahead of every plugin hook attached at that same stage — @fastify/rate-limit's per-route limiter stops counting the callers the guard refuses
metadata:
  type: feedback
---

A diff that moves a role guard from `preHandler` to `onRequest` changes hook
_order_, not just timing. `@fastify/rate-limit` appends its per-route handler to
whatever `routeOptions[hook]` already holds
(`node_modules/.pnpm/@fastify+rate-limit@*/…/index.js:236-241`, default hook
`onRequest`), so the route that previously ran `[limiter]` then the guard now
runs `[guard, limiter]` — and every caller the guard throws for is never
counted.

**Why:** VEN-488 moved `POST /tags/suggest` to `requireRoleBeforeValidation`.
That route declares its own `config.rateLimit`, and `apps/api/src/server.ts`'s
API-wide hook deliberately **skips** a route that declares one unless an
`Authorization` header is present. Net effect: an anonymous POST to that route
is now counted by nothing, where before it was 10/hour per IP via the
limiter's `request.auth?.id ?? request.ip` fallback.

**How to apply:** for every route in such a diff, grep the route options for
`config.rateLimit` (and any other plugin that registers at `onRequest`), then
read the app-level limiter's skip condition. The question is "what else was
already attached at the stage the guard just moved into, and what did it do for
the callers the guard now short-circuits?"

Second half of the same review: the error handler here has **two** branches that
emit `{ statusCode: 400, error: 'VALIDATION_ERROR' }` — the Zod one _with_
`details` and the Fastify-error fallback _without_ (`plugins/error-handler.ts`).
A test asserting `toMatchObject({ statusCode: 400, error: 'VALIDATION_ERROR' })`
cannot tell a schema refusal from `FST_ERR_CTP_EMPTY_JSON_BODY`, which is the
exact distinction these guard tickets exist to make. Make it assert `details`.

Related: [[review-checklist-source-grep-substring-collisions]].
