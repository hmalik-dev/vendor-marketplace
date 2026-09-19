---
name: new-secret-header-has-three-registries
description: A new credential- or address-bearing request header must be registered in pino's redact list, Sentry's CREDENTIAL_HEADER, and its registry placeholder must fail its own shape
metadata:
  type: project
---

Adding a header that carries a secret or a caller address (VEN-440's
`x-web-tier-key` / `x-visitor-ip`) needs three registrations, and only the first
is obvious:

1. `apps/api/src/server.ts` logger `redact: ['req.headers…']` — beside
   `authorization`, `cookie`, `svix-signature`, `stripe-signature`.
2. `CREDENTIAL_HEADER` in `packages/shared/src/utils/error-reporting.ts`.
   **Sentry keeps request headers**; `scrubErrorEvent` redacts a header only by
   _name_, `redactString` knows no generic-random-string shape, and the regex is
   an anchored allow-list plus the substrings `token|secret|signature|session|
svix` — `x-web-tier-key` matches none of them. VEN-449 dropped the retired
   provider's name from that alternation and added **no successor name**, so a
   Neon Auth header whose name carries none of those keywords (an `x-stack-…`
   that is not `-token`/`-secret`) is redacted only if its _value_ trips the
   JWT/bearer/`sk|rk|whsec|re_` value regexes. `x-forwarded-for` and
   `x-real-ip` are on that list for PII, so any new address-carrying header
   belongs there too or `sendDefaultPii: false` is undone.
3. The env registry row's `placeholder` **must fail its own `shape`** —
   `registry.test.ts:47` enforces it over every row. `.env.example` is generated
   and public, so a prose placeholder that satisfies a loose shape
   (`a-random-string-of-32-or-more-characters` against `[A-Za-z0-9_-]{32,}`) is
   a publicly known value the deployed app accepts.

**Why:** a shared secret that gates a trust decision leaves by the log sink, the
Sentry sink and the repo before it is ever attacked.

**How to apply:** on any diff that introduces a request header, grep both
scrubbers and the placeholder invariant before reading the guard itself. See
[[err-serializer-is-the-log-sink]], [[sentry-is-a-second-log-sink]],
[[rate-limit-key-is-the-proxy-not-the-caller]].
