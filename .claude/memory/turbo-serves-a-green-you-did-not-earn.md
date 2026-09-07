---
name: turbo-serves-a-green-you-did-not-earn
description: "Turbo's cache can make any check unfalsifiable — a suspiciously fast green on inputs you just changed is the tell, and build-baked output keyed on a passThrough env replays the wrong artefact in both directions"
metadata:
  type: project
---

Turborepo's cache decides what to replay from a hash over `globalEnv` and the
declared inputs. Anything in **`globalPassThroughEnv` is passed to the task but
is not part of the key** — so output that depends on it is cached against a hash
that cannot see it.

**Two failures, one mechanism, found 2026-09-07 in #452.**

**1. Build-baked output.** `headers()` is frozen into
`apps/web/.next/routes-manifest.json` at build time. A first revision keyed the
TLS decision on `WEB_URL`, which lives in `globalPassThroughEnv`. Measured
result: **identical hashes for an http build and an https one**, and a warm cache
replayed the wrong manifest **in both directions** — including serving the very
defect being fixed, with the fix already in the tree. Fixed by reading only
`PLATFORM_ENV_KEYS`, which are in `globalEnv` and therefore hashed: with
`DEPLOYMENT_ORIGIN` set the hash is `4a9aab5e`, unset `4edcc209`, and `WEB_URL`
no longer moves it. `CSP_ENFORCE` was moved between the two lists for the
identical reason in #396, which is what makes this a shape rather than an
incident.

**2. Gate results.** Re-checking a freshly updated PR head, `pnpm typecheck`
returned **FULL TURBO in 342ms, 7/7 cached** — a green on a tree that had never
been compiled. Forced (`--force`, 0 cached, 76s) it was genuinely fine, but the
cache had been willing to certify it either way.

**Why:** these are the same failure as every other *check that cannot fail* in
this repo, in its most expensive form — the cache does not merely hide a defect,
it can serve the defect and the pass at the same time. And the success is what
stops anyone looking further.

**How to apply:**

- **A diff that makes build-baked output depend on a new env var must check
  which turbo list that var is in.** `globalEnv` is hashed; `globalPassThroughEnv`
  is not. Prefer deriving from a hashed key over adding to it — widening the key
  buys correctness by invalidating the cache for everything that reads it.
- **A suspiciously fast green on inputs you just changed is not a green.** After
  a rebase, a merge or an `update-branch`, run the gate with `--force`. `--force`
  is a turbo flag: `pnpm typecheck --force`, never `pnpm --filter <pkg> test
  --force`, which dies with `ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL`.

Related: [[verify-with-a-differently-shaped-check]],
[[rebase-auto-merges-are-not-compile-checked]] and
[[filing-a-ticket-is-a-three-file-change]], which already records the tracker
half of the same cache behaviour.
