---
name: csp-unsafe-inline-is-a-recorded-tradeoff
description: script-src carries 'unsafe-inline' by deliberate, unticketed decision, so adding hosts to the web CSP allowlist is never the XSS escalation — and CSP_ENFORCE can only turn enforcement on
metadata:
  type: project
---

`apps/web/src/config/security-headers.ts` is the **only** place the web tier's
CSP exists — no middleware, no `vercel.json`, no second definition. It ships
`'unsafe-inline'` on both `style-src` and `script-src`, and that is a recorded
decision, not an oversight: the file's own doc comment explains that the
alternative is a per-request nonce, which needs nonce-emitting middleware and
opts the whole marketplace out of static generation. As of 2026-09-03 **no
ticket exists for the nonce** — grepped the board and the archive, zero hits.

**Why:** the policy's protective value was deliberately relocated to the
directives that are tight — `frame-ancestors 'none'`, `object-src 'none'`,
`base-uri 'self'`, `form-action 'self'`, and the allowlists on `connect-src`,
`img-src` and `frame-src`. With `'unsafe-inline'` present, script execution is
not gated by the host allowlist at all.

**How to apply:** when a diff adds hosts to `script-src` (Stripe in #396, Clerk
before it), do not report the widening — including subdomain wildcards — as an
XSS or exfiltration escalation. It cannot lower a bar that `'unsafe-inline'`
already removed. Report instead on: whether the host is owned by the party it
claims, whether the same host leaked into a directive it has no business in, and
whether the four tight directives above are still intact. Flag the missing nonce
ticket at most once; do not relitigate it per diff.

Related: enforcement is **monotone** —
`enforceCsp: process.env.CSP_ENFORCE === '1' || isProduction`
(`apps/web/next.config.ts:76`). The flag can only turn enforcement on, so a
development default of `0` can never disable it in production. Its `^[01]$`
shape is validated by `assertWebEnv()` before the raw read, so a malformed value
fails the build loudly. This is the settled answer to the
"development-default-reaches-production" check for this flag — see
[[env-target-live-key-trap]] for the registry's harder case.
