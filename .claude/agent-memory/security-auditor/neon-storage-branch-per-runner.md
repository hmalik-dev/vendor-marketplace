---
name: neon-storage-branch-per-runner
description: VEN-457 gave every lane, CI run and preview PR its own Neon storage branch; NEON_API_KEY is project-wide and production-capable, and where it appears is the whole surface
metadata:
  type: project
---

Uploads moved off MinIO to Neon Object Storage (no emulator), so every runner
gets a storage-only branch: `lane-<ticket>` (cut from `dev`, 7-day expiry),
`ci-<run>-<attempt>` (cut from `dev`, 1-day expiry), `preview/pr-<n>`.

**Why:** `NEON_API_KEY` is a project-wide credential — it can delete the
`production` branch and read its storage. It now reaches `ci.yml`'s e2e job and
`preview-branch.yml`, which previously held only test-mode secrets.

**How to apply:** when this area changes, check these four things.

- The key is set at _step_ level, never job level — so `pnpm install` of PR code
  never sees it. Keep it that way. A step that holds the key must not also run
  `npm install --global neonctl@…`: the unpinned transitive install scripts run
  with the key in env, which is exactly the risk the file's own header comment
  cites when it pins the two `neondatabase/*` actions by commit SHA.
- Destructive calls are guarded by name only: `assertLaneBranch` (prefix
  `lane-`, and a deny-list of `production`/`staging`/`dev`) and the shell
  `case "$STORAGE_BRANCH" in ci-*)`. Both are sound; a new caller that deletes a
  branch must pass through one of them.
- `scripts/ci-storage.mjs map` masks then appends `STORAGE_*` to `GITHUB_ENV`.
  Run it with `GITHUB_ENV` unset where the job has no consumer — `append()`
  no-ops, and the production refusal and masking still happen. The paired
  `assert` step only reads `process.env`, so without the export it is vacuous.
- `assert` detects production by substring of the branch id
  `br-curly-boat-axhuowvc` in any `*_STORAGE_*`/`*_AWS_*` value. It is a
  backstop for the branch name, not a capability check: the key itself is
  unscoped either way.

Related: [[lane-env-file-mode-not-repaired]], [[ci-e2e-artifacts-are-public]],
[[fabricating-seeds-share-one-declared-branch-guard]].
