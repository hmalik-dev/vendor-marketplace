---
name: backup-integrity-is-not-authenticity
description: VEN-408 backup/restore drill — the manifest sha and age AEAD prove integrity only; anyone with the bucket write token can forge a restorable dump, and the drill pg_restores it as a superuser
metadata:
  type: project
---

`packages/db/src/scripts/restore-drill.ts` trusts whatever the newest manifest in the
backups bucket says. The sha256 sits in a plaintext manifest written by the same
token, and age is encrypted to a public key committed in
`.github/backup-age-recipients.txt`, so age proves nothing about the sender. A
leaked read/write `BACKUP_S3_*` token forges manifest + dump; a future-dated key
(`9999/12/31`) wins `latestManifestKey` and is never pruned; `manifest.dumpKey` and
`manifest.environment` are not bound to the key that was listed.

pg_restore executes archive SQL verbatim, and the runbook restores onto the Docker
Postgres superuser and then copies rows into production.

Found in review on 2026-09-14 (VEN-408). Reported as medium.

**Also settled in that review:** secrets never reach argv or logs (PG* env, message-only
errors), workflow inputs never reach a `run:` line, `sql(name)` quotes identifiers,
and the recipients file refuses `AGE-SECRET-KEY-`. Do not re-audit those unless the
code changes. The prune token can delete every backup, and that was reported as low.

**How to apply:** on any change to the backup/restore scripts, check whether the
signature (or out-of-band digest) and the key binding have landed before re-reporting.
Related: [[fabricating-seeds-share-one-declared-branch-guard]].
