---
name: rate-limit-key-is-the-proxy-not-the-caller
description: Route rate limiters can read request.auth (hook order verified), but request.ip is the socket address — no trustProxy anywhere, so every deployed caller shares one bucket
metadata:
  type: project
---

Two facts about `@fastify/rate-limit` 11.2.0 on Fastify 5.12.1 in this repo,
both verified by reading the vendored source rather than inferred:

- **A route's `keyGenerator` can see `request.auth`.** A `config.rateLimit`
  object makes the plugin push its handler into `routeOptions.onRequest`
  (`addRouteRateHook`), and `lib/route.js` concatenates instance hooks _then_
  route hooks — so `clerkAuthPlugin`'s global `onRequest` has already run.
  `request.auth?.id ?? request.ip` really does key by account when there is one.
  A route with its own `config.rateLimit` is **not** additionally covered by the
  global `RATE_LIMIT_MAX` limiter; the plugin registers one or the other.
- **`request.ip` was not the client, and now is.** `trustProxy` was set nowhere
  in `apps/api`, so Fastify used the socket address — behind Render
  (`render.yaml`), Vercel, or any load balancer that is the proxy, and _every
  caller shared a single bucket_. **Fixed in #421**: `buildServer` now sets
  `trustProxy` to a hop-0 predicate when `isDeployedRuntime()`, and `false`
  otherwise.

**Why:** the second fact was invisible locally — `pnpm dev` and `app.inject()`
both give a real per-caller address, so a per-IP limit tested perfectly and
collapsed on deploy. It is also why the demo raised `RATE_LIMIT_MAX` to 600.

**How to apply:** the guard is `apps/api/src/server.test.ts` §"the rate-limit
key behind a proxy", which drives all three cases — the header ignored locally,
two deployed callers keyed apart, and a forged leading `X-Forwarded-For` entry
failing to mint a fresh bucket. Keep the predicate a **bounded** hop count;
never `trustProxy: true`, which walks the header to its leftmost entry and hands
the key straight back to the attacker. Before #421 the right reading was "N per
IP means N for the whole deployment" — check that test still exists before
trusting any per-IP limit here again. Related:
[[public-mail-endpoint-echoes-to-any-address]].
