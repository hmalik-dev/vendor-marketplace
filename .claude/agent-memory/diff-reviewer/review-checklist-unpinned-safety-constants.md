---
name: review-checklist-unpinned-safety-constants
description: Review checklist — when a diff hardcodes a constant chosen for a safety/correctness reason, verify a test at the consuming layer pins it, not just the layer below
metadata:
  type: feedback
---

When a diff introduces a literal argument whose _value_ is the safety decision
(a target/mode/flag chosen so a deploy does not break), check that a test in the
package that passes the literal would fail if the literal were changed. A test on
the callee's _default_ does not pin an explicit argument at the call site.

**Why:** In ticket #61 both apps were switched to `registrySchemaShape({ ... target:
'baseline' })`. The only regression guard lived in `packages/shared`'s test of the
default. Flipping both call sites to `'local'` left all 681 `apps/web` tests and all
15 `apps/api` env tests green, while it would have failed the Vercel production build
and the Railway API boot on live keys.

**How to apply:** Mechanically flip the literal in the working tree, run the suites of
the packages that own the call site, and report a missing test if they stay green.
Restore the files afterwards. This is cheap and produces a demonstrable failure
scenario rather than a guess.

Relevant project rule: `.claude/rules/env-registry.md` — "Assert the production
branch in a test; a default is exactly the code no test covers."

**The extract-a-helper variant (#238).** A diff that replaces an inline constant
with a new exported resolver (`DEV_PORTS` → `devPorts(env)`, `?? 'http://localhost:3000'`
→ `resolveBaseUrl(env)`) usually ships tests for the resolver only. Those tests
still pass if the call site is reverted to the old literal. Same mechanical check:
re-hardcode the call site, run the owning package's suite. In #238
`packages/preflight` stayed 234/234 green with `portsCheck.run` back on a
hardcoded `[3000, 4000]`, and nothing at all covered `scripts/e2e-auth.mjs`
consuming `resolveBaseUrl`.
