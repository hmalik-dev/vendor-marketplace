---
name: log-redaction-covers-query-not-path
description: The pino req serializer redacts every query value but writes the path verbatim — a credential in a path segment is still logged whole, despite the comment claiming otherwise
metadata:
  type: project
---

`apps/api/src/server.ts` installs a custom pino `serializers.req` that runs
`redactQueryValues` (`apps/api/src/lib/log-redaction.ts`) over `request.url`.
It replaces **every** query value, not a list of suspicious names, so it cannot
be defeated by casing, percent-encoding, or renaming the parameter. Parameter
names survive only when they match `/^[A-Za-z0-9_.-]{1,40}$/`; anything else is
redacted in the name position too.

What it does **not** cover: **the path**. `/events/stream/<secret>` is logged
whole. The comment above the serializer claims the logger "cannot write a
credential even if some future route puts it back into a URL" — that claim is
one component wider than the code.

**Why:** #215 found 27 live Clerk session JWTs in a lane's dev log, written by
Fastify's default request serializer from `/events/stream?token=…`. The
serializer is the standing guard against a repeat, and the comment is what a
future author will trust instead of re-reading the regex.

**How to apply:** if a route is ever proposed that carries a credential, a
ticket, or a signed value as a **path segment**, the redaction does not save it —
say so rather than assuming the guard is general. Nothing else in the API logs a
URL: the error handler logs `request.routeOptions.url` (the route pattern), and
`request.log` call sites log `err` only. The 404 handler at
`apps/api/src/plugins/error-handler.ts` does echo the raw URL into the **response
body**, which is a self-echo to the caller and not a log. Related:
[[stream-route-auth-is-hand-rolled]].
