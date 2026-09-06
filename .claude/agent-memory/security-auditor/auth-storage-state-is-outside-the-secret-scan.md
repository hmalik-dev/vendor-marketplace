---
name: auth-storage-state-is-outside-the-secret-scan
description: .auth/*.json holds live Clerk session JWTs; FORBIDDEN_PATHS covers the path as of #392, and no content rule ever will — do not re-report the path half
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
- `packages/preflight/src/secrets/patterns.ts` — **FIXED in #392.**
  `FORBIDDEN_PATHS` now carries a `Playwright storage state (live session
cookies)` entry matching `(^|/)\.auth/[^/]+\.json$`, with cases in
  `scan.test.ts` for the bare, nested and lane-worktree paths, plus one
  asserting `src/auth/config.json` is _not_ caught. **Do not re-report the path
  half.**

  Still true, and not fixable by a path rule: `SECRET_RULES` has no JWT/`eyJ`
  rule, and the generic high-entropy rule keys on `SECRET|TOKEN|PASSWORD`-shaped
  **key names** while storage state files the JWT under `"value"`. So the
  _contents_ of a session file, pasted into some other path, still pass.

**Why:** that file's own header states the design — "an ignore rule stops an
accidental `git add`, not a deliberate `git add -f`" — so the omission was a gap
in the stated model rather than a decision, which is why it was closed instead
of recorded as accepted.

**How to apply:** when auditing anything that writes session material to disk,
check `FORBIDDEN_PATHS` as well as `.gitignore`; they are independent lists and
the scan is the layer that survives a gitignore regression. Related:
[[credential-fixtures-assembled-at-runtime]], [[lane-env-file-mode-not-repaired]]
(same class — `.auth/*.json` is written 0644, world-readable).
