---
name: lane-env-file-mode-not-repaired
description: Confirmed defect class in packages/preflight/src/lane — writeFileSync's mode option only applies on create, so the 0600 on .env.lane is not enforced when the file is rewritten or already correct
metadata:
  type: project
---

`ensureLaneEnv` in `packages/preflight/src/lane/lane.ts` writes `.env.lane`
(which holds a live Postgres connection string) with
`writeFileSync(file, desired, { mode: 0o600 })`. Node applies that `mode` only
on the `O_CREAT` path — verified empirically 2026-08-29: rewriting an existing
0644 file with `{ mode: 0o600 }` leaves it 0644. `ensureLaneEnv` also returns
early without touching permissions when the content already matches, so a
lane file that ever acquires a permissive mode keeps it for the lane's life.

**Why:** ticket #66 turned the single create-time write into an idempotent
repair that runs on every `laneUp` resume, which is exactly the "file already
exists, possibly created by something else" case the create-only mode does not
cover. No test in `lane.test.ts` asserts the mode at all, so a regression here
is silent.

**How to apply:** on any diff under `packages/preflight/src/lane/`, check that
a write of `.env.lane` is followed by an explicit `chmodSync(file, 0o600)`
(unconditionally, including the content-unchanged path), not just a `mode`
option. The same reasoning applies anywhere else in the repo that writes a
credential-bearing file. Related: [[credentials-and-lane-databases]].
