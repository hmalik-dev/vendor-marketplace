---
name: request-ip-is-one-hop-trusted-not-validated
description: request.ip takes one X-Forwarded-For hop on a deployment and is never checked to be an IP — it is unbounded text against varchar(45)
metadata:
  type: project
---

`apps/api/src/server.ts` sets `trustProxy: isDeployedRuntime() ? (_addr, hop)
=> hop === 0 : false`. That is the right shape for rate-limit keying (see
[[rate-limit-key-is-the-proxy-not-the-caller]]) but it says nothing about the
value's _form_: `proxy-addr`/`forwarded` split `X-Forwarded-For` on commas and
trim, with no IP validation, so `request.ip` is whatever text occupies the hop
the predicate stops at. Two consequences, both live:

- Deployed with no appending proxy in front (or a pass-through one),
  `request.ip` is a caller-written string. Over 45 characters it overflows
  `legal_acceptances.ip` (`varchar(45)`) into a Postgres 22001 — a 500 whose
  Drizzle message carries every bound parameter
  ([[drizzle-query-errors-log-bound-parameters]]).
- When `isDeployedRuntime()` misses the host
  ([[deployment-gate-detects-by-marker-and-fails-open]]) `trustProxy` is `false`
  and `request.ip` is the load balancer's own address — stored as the vendor's,
  silently.

**How to apply:** anywhere `request.ip` is persisted rather than used as a
bucket key, require `net.isIP(value) !== 0` and fall back to `null`. Truncating
is not enough: a truncated forgery is still a forgery, and this one lands in a
record that exists to be evidence.
