---
name: claude-workflow-config-repo
description: The global ~/.claude config is version-controlled in the private repo hmalik-dev/claude-workflow
metadata:
  type: reference
---

`~/.claude` is a git repo whose origin is the **private**
`github.com/hmalik-dev/claude-workflow`. Set up 2026-08-28 when moving to a
second device. It carries `CLAUDE.md`, `orchestration-policy.md`,
`settings.json`, `agents/`, `hooks/`, `skills/`, `scripts/`, `references/`,
`plans/` and `projects/*/memory/` — plus `README.md` and `MIGRATION.md`.

**Its `.gitignore` denies `/*` and re-admits config by name.** Never invert it:
`~/.claude` is a state directory that happens to hold config, so an allow-list
that misses a file loses a setting, but a deny-list that misses one publishes a
credential. `settings.local.json`, `history.jsonl`, `.credentials.json` and the
219MB of session transcripts are all deliberately out.

There is **no sync automation**. After a session that changes a rule, a skill or
the ticket board, commit and push from `~/.claude` by hand, and pull on the
other machine before starting. `plans/` is the live queue, so it is the file
that actually conflicts.

Credentials move by `scripts/pack-keys.sh` / `unpack-keys.sh` (openssl AES-256,
interactive passphrase) — never a commit. See
[[credentials-env-files-only]] and [[vendor-marketplace-e2e-credentials]].
