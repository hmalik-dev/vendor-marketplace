---
name: no-trace-guard-vs-history-scan
description: The repo-wide "no retired provider name" guard and the gitleaks full-history scan pull against each other; scrubbing .gitleaks.toml turns CI red for ever
metadata:
  type: project
---

Two controls collide whenever a retired vendor is scrubbed from the tree
(VEN-503 scrubbed the identity provider):

- CI runs `gitleaks git . --config .gitleaks.toml` with `fetch-depth: 0`
  (`.github/workflows/ci.yml`), so it reads **every commit's patch**. An
  allowlist entry for a value an _older commit_ carried is load-bearing after
  the value leaves the tree — history is immutable, so deleting the entry makes
  the secret-scan job fail permanently, on main and on every PR. Verified: the
  historical `NEXT_PUBLIC_..._PUBLISHABLE_KEY: pk_test_…` line in `ci.yml`
  fires `generic-api-key` under the scrubbed config.
- `packages/shared/src/repo-guard.test.ts` flags the provider's name in _any_
  tracked file outside its allow-list — including `.gitleaks.toml`. So the
  allowlist must either stay exempted there, or be written so the literal name
  never appears (`CL[E]RK`, a fingerprint/`commits` allowlist).

The guard's own fragment trick only works if the split breaks the needle:
`['legacy', 'the auth provider'].join('_')` still spells it, `['legacy_cl', 'erk']` does not.

**Why:** a tree-only scrub reads clean locally (`secrets:scan:all` reads the
tree) while the history scan goes red in CI, and the fix for red is never
"allowlist it" for a real credential — it is rotation.

**How to apply:** on any "remove vendor X from the repo" diff, check deleted
`.gitleaks.toml` entries against `git log -S`, and re-derive every
fragment-built literal. Related: [[credential-fixtures-assembled-at-runtime]],
[[auth-storage-state-is-outside-the-secret-scan]].
