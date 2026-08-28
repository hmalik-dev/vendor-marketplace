# Security auditor memory — vendor-marketplace

- [Env schema target is a live-key trap](env-target-live-key-trap.md) — apps must pass `baseline`; `local` bricks the Vercel build and no test covers the choice
- [Credential fixtures assembled at runtime](credential-fixtures-assembled-at-runtime.md) — a PreToolUse hook blocks credential-shaped literals on any bash command line, probe scripts included
