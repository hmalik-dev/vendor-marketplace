# Security auditor memory — vendor-marketplace

- [Env schema target is a live-key trap](env-target-live-key-trap.md) — apps must pass `baseline`; `local` bricks the Vercel build and no test covers the choice
- [Credential fixtures assembled at runtime](credential-fixtures-assembled-at-runtime.md) — a PreToolUse hook blocks credential-shaped literals on any bash command line, probe scripts included
- [URL params are validated in the nuqs hook](url-params-validated-in-the-nuqs-hook.md) — nuqs types but never validates; the hook is the boundary, not the screen
- [.env.lane mode is not repaired on rewrite](lane-env-file-mode-not-repaired.md) — writeFileSync's `mode` applies only on create, and no test asserts 0600
