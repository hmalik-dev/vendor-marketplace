---
name: credentials-env-files-only
description: Credentials belong in env files only — never inline in a command, never in Claude config
metadata:
  type: feedback
---

Credentials must live in `.env` files and be read from the environment. They must
never appear inline in a command line, and never in any Claude configuration —
`settings.json`, `settings.local.json`, agents, skills or rules.

**Why:** an inline secret in an approved Bash command gets saved verbatim as a
permission rule in `settings.local.json`, and lands in every session transcript
that touched it. That is how a live Neon `DATABASE_URL` ended up in this repo's
`.claude/settings.local.json` — removed 2026-08-28, but it survives in six
transcripts under `~/.claude/projects/`, so the value still needs rotating.
Deleting an exposed credential is never sufficient.

**How to apply:** pass `DATABASE_URL="$DATABASE_URL"` or source the env file
rather than pasting the value. `~/.claude/hooks/no-inline-credentials.mjs` denies
both routes at `PreToolUse`; if it fires on something real, rotate rather than
work around it. Related: [[vendor-marketplace-e2e-credentials]],
[[vendor-marketplace-neon-dev-branch]].
