---
name: rate-limit-key-is-the-proxy-not-the-caller
description: How rate limiting is wired here — hop-0 trustProxy, the pre-auth instance hook and its five skipped routes, and the shared rateLimitRan symbol that makes "just drop the skip" silently disable four custom limits
metadata:
  type: project
---

Facts about `@fastify/rate-limit` 11.2.0 on Fastify 5, all read from the vendored
source (`node_modules/.pnpm/@fastify+rate-limit@11.2.0/.../index.js`):

- **`request.ip` is hop 0, not the socket.** `trustProxy` was unset, so every
  deployed caller shared one bucket; **fixed in #421** with a `hop === 0`
  predicate, `false` off a deployment. Never `trustProxy: true`. Guard:
  `server.test.ts` §"the rate-limit key behind a proxy".
- **The limiter runs ahead of authentication (VEN-437).** `server.ts` keeps one
  `const limitRequest = app.rateLimit()` in an **instance** `onRequest` hook, so
  a flood of junk bearer tokens is counted before `neon-auth` throws. It skips
  any route declaring `config.rateLimit`.
- **`app.rateLimit()` with no argument shares the plugin's store, `globalParams`
  and keyGenerator**, and sets `req[rateLimitRan]`, so the plugin's own route
  hook returns early — no double counting, and the web-tier visitor keying is
  preserved.
- **`rateLimitRan` is one symbol for the whole registration**: a route's
  component is `Object.create(pluginComponent)` and inherits it. So running the
  global limiter on a route that has its own config **disables that route's
  limit entirely**. The skip in `server.ts` is load-bearing; `support`, `reports`
  and `vendor-invites` route tests assert their own 429 and would catch it,
  `/tags/suggest` has no such test.
- **The skip's residual:** `neon-auth`'s instance hook throws 401/403 (bad token,
  deleted identity, ban) before any _route_ hook, so the five config routes —
  `/webhooks/stripe`, `/support/messages`, `/tags/suggest`, `/reports`,
  `/vendor-applications` — are still floodable at any rate with
  `Authorization: Bearer garbage`. On the webhook that lands in the `signature`
  failure kind unlimited, the VEN-405 residual without its rate cap. Only
  `server-error` reaches the persisted counter, so there is no DB write per shed
  request. Count-only fix: `app.createRateLimit()`, which does not set
  `rateLimitRan`.

Related: [[public-mail-endpoint-echoes-to-any-address]],
[[operator-alert-dedupe-is-attacker-armable]].
