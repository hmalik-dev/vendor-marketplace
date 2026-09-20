---
name: launch-check-bearer-hosts-are-fixed
description: pnpm launch:check (VEN-409) audited clean — bearer secrets go only to hard-coded provider hosts; the pk-decoded Clerk FAPI host, API_URL and WEB_URL get unauthenticated GETs
metadata:
  type: project
---

> **Clerk is retired** (VEN-447/448/449 moved auth to Neon Auth). Clerk names below describe the pre-cutover code and are historical; do not act on them as live.

`packages/preflight/src/launch/` was audited 2026-09-14 and passed. `bearer()` is called only with the
`CLERK_API`/`STRIPE_API`/`RESEND_API` constants. The Frontend API host decoded from the publishable
key is hostname-regex-checked and fetched with no headers. `repo-modules.ts` imports three
constant paths under `REPO_ROOT`, and none of those modules has import-time side effects.
`loadContext` merges env into a copy, never into `process.env`.

**Why:** so the next audit does not re-derive this.
**How to apply:** re-open it only if a probe passes `bearer()` to a URL built from env, adds a
non-GET method to `HttpGet`, or a seed module gains a top-level `main()`. The read-only session relies on
`default_transaction_read_only` as a startup parameter, which a pooler can silently drop. The fixed
SELECTs are what actually keep it read-only.
