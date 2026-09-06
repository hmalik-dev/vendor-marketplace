---
name: auth-storage-state-is-outside-the-secret-scan
description: .auth/*.json holds live Clerk session JWTs, is gitignored, but is in neither FORBIDDEN_PATHS nor any content rule — gitignore is the only barrier
metadata:
  type: project
---

`.auth/<role>.json` is Playwright storage state: live `__session`,
`__client_uat` and `__clerk_db_jwt` cookies for an E2E account. Since #392 that
includes an **admin** session on every checkout by default, and
`.worktreeinclude` copies `.auth/` into every lane worktree.

Two layers, only one of which covers it:

- `.gitignore:51` (`.auth/`) — a directory rule with no negations under it, so
  an accidental `git add -A` cannot reach it. This holds.
- `packages/preflight/src/secrets/patterns.ts` — `FORBIDDEN_PATHS` lists env
  files, private keys and credential stores but **not** `.auth/`, and
  `SECRET_RULES` has no JWT/`eyJ` rule. The generic high-entropy rule keys on
  `SECRET|TOKEN|PASSWORD`-shaped **key names**; storage state stores the JWT
  under `"value"`, so it does not match. A deliberate `git add -f .auth/` would
  pass the scan.

**Why:** that file's own header states the design — "an ignore rule stops an
accidental `git add`, not a deliberate `git add -f`" — so the omission is a gap
in the stated model, not a decision.

**How to apply:** when auditing anything that writes session material to disk,
check `FORBIDDEN_PATHS` as well as `.gitignore`; they are independent lists and
the scan is the layer that survives a gitignore regression. Related:
[[credential-fixtures-assembled-at-runtime]], [[lane-env-file-mode-not-repaired]]
(same class — `.auth/*.json` is written 0644, world-readable).
