---
name: review-checklist-turbo-inputs-cover-only-some-outside-reads
description: A turbo `inputs` fix that names some outside-the-package paths a test reads leaves the rest cache-hitting; list every root path the package's tests read, and remember mtime-only touches never bust a hash
metadata:
  type: feedback
---

When a diff adds `$TURBO_ROOT$/...` globs to a package's `test` inputs, the fix
is only as wide as the list. Enumerate **every** file outside the package that
**any** test in that package reads — `grep -rn "\.\./\.\./\.\.\|REPO_ROOT" <pkg>/src`
— not just the paths the ticket names. In this repo `packages/shared` has two
outside readers: `repo-guard.test.ts` (the **whole tracked tree**, via
`git ls-files` at ROOT) and `env/generate.test.ts` (root `.env.example` and root
`turbo.json`). `packages/preflight/turbo.json` states the rule in a comment.

Prove reach without running the suite: `pnpm turbo run test --filter=<pkg>
--dry=json`, then read `tasks[].inputs` (the resolved file→hash map) and
`globalCacheInputs.files` (empty here, so no root file is globally hashed).

**Why:** turbo hashes only a package's own files, so a guard that reads the repo
cache-HITs while the thing it guards is already broken — and CI restores `.turbo`
with a prefix `restore-keys`, so this is not local-only.

**How to apply:** also distrust "verified by touching the file": turbo hashes
**content** (git hash-object), so `touch` alone leaves the hash identical and the
status HIT. Demand an edit, and compare `--dry=json` hashes before/after.

For a **whole-tree** reader like `repo-guard.test.ts`, no enumeration is ever
complete — compute the complement, don't read the list:
`git ls-files --full-name -- . ':!<glob>' ':!<glob>' …` (`--full-tree` is
`ls-tree` only, and the Bash cwd persists). Here 55 of ~1890 tracked files sat
outside an 11-glob list — `scripts/**`, `.github/**`, `docker-compose.yml`,
`README.md`, `.claude/agents|hooks|settings.json`, `parity-review/` — i.e. the
exact files VEN-457 deleted the retired provider's name from (`git log -S` the
needle to prove it). The list already carried `apps/**`, so the "narrow keeps
the cache" rationale bought ~3% of the tree and left only guard-relevant files
uncovered. `packages/preflight/turbo.json` is the precedent and names
`package.json`, `.nvmrc`, `docker-compose.yml`, `.github/workflows/ci.yml`.

Related: [[review-checklist-build-time-output-keyed-on-passthrough-env]],
[[review-checklist-repo-wide-source-guards-fire-on-new-files]].
