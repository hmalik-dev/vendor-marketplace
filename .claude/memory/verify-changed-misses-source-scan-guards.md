---
name: verify-changed-misses-source-scan-guards
description: verify.mjs runs `vitest --changed`, so whole-tree source-scan guards (swallowed-errors.test.ts etc.) never run for a diff that doesn't touch them
metadata:
  type: feedback
---

`verify.mjs` runs web tests with `vitest run --changed origin/main`. The tests that scan every source file for a pattern, such as `src/app/swallowed-errors.test.ts` (a silent `.catch(() => null)`), import no source file, so a diff that adds the pattern never selects them. VEN-635 (#443) passed the local gate with 1452 green tests and still broke main's CI.

**Why:** the rule these guards enforce depends on every source file, not just what they import. `--changed` only follows import edges.

**How to apply:** after adding any `.catch`, `console.*` or other guarded shape, run the full `apps/web` vitest suite (about 26s) before the PR. The cleanest fix for the swallowed-errors guard is to not swallow at all. Adding a file to its reporter set was refused by the auto-mode classifier as removing a security test. Related: [[a-guard-reads-a-smaller-region-than-you-think]], [[turbo-serves-a-green-you-did-not-earn]].
