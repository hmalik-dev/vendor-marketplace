---
name: rate-limit-key-is-the-proxy-not-the-caller
description: How rate limiting is wired here — hop-0 trustProxy, the pre-auth instance hook, the shared rateLimitRan symbol that makes "just drop the skip" silently disable a route's own limit, countBearer's header-only residual, and the VEN-484 per-account keys
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
- **The skip's residual is closed for bearer traffic:** the same hook now runs
  `app.createRateLimit()` (`countBearer`) on a config route whenever an
  `Authorization` header is present — `createRateLimit` never sets
  `rateLimitRan`, so it counts in the API-wide visitor bucket without silencing
  the route's own ceiling. **Residual:** a request with _no_ `Authorization`
  header on a config route is counted by nothing. Auth is bearer-only
  (`neon-auth` returns early on a missing header), so such a flood costs a route
  lookup and a guard 401 — no DB, no crypto, no body parse. Widening it would
  put Stripe's webhook address in the 120/min visitor bucket.
- **Per-account limits (VEN-484).** `lib/rate-limit.ts` `perAccountRateLimit`
  keys on `request.auth?.id ?? request.ip` for `/upload/image`,
  `/conversations`, `/conversations/:id/messages`, `/booking-requests`. Sound
  because `addRouteRateHook` **pushes** its hook after the route's own
  `onRequest` guards and `neon-auth` resolves `request.auth` in an instance
  hook, so the account is known before the key is taken; and
  `LocalStore.child()` returns a **new** store per route config, so no two
  routes share a bucket. Two cautions: the fallback is bare `request.ip`, not
  `rateLimitKey`, so an unauthenticated caller arriving through the web tier
  keys on the platform's egress address; and a per-_account_ ceiling is only as
  strong as sign-up, which is open for customers — the API-wide IP bucket stays
  the only cap on an attacker minting accounts.
- **The tier-key mismatch report is attacker-armable (VEN-649).** `rateLimitKey`
  calls `onMismatch` for any anonymous caller sending a wrong `x-web-tier-key`
  plus a valid `x-visitor-ip`; `server.ts` latches the Sentry capture once per
  process, so the first probe after each deploy spends it and a later genuine
  rotation mismatch never reports. Flagged low; fix is a time-windowed throttle,
  not a process latch. The capture carries a static message; Sentry's
  `CREDENTIAL_HEADER` already drops both headers.

Related: [[public-mail-endpoint-echoes-to-any-address]],
[[operator-alert-dedupe-is-attacker-armable]].
