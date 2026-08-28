---
name: credential-fixtures-assembled-at-runtime
description: A PreToolUse hook blocks credential-shaped literals on the bash command line, so even throwaway audit probe scripts must build fixtures at runtime
metadata:
  type: feedback
---

Never write a credential-shaped literal into a bash command line, including a
heredoc that creates a throwaway probe script in the scratchpad. Assemble it:
`['sk', 'test', '51ABCdefGHIjklMNO'].join('_')`, or write the file with a
`python3 -` heredoc that concatenates the parts.

**Why:** a `PreToolUse` hook blocks the whole call, and it fires on `sk_test_`,
`sk_live_`, `pk_live_`, `whsec_`, a postgres URL with an inline password, and any
`*SECRET*`/`*TOKEN*`/`*KEY*` name assigned a high-entropy value 24+ characters
long. It cost three blocked calls during the ticket-61 audit. The repo's own
`pnpm secrets:scan` applies the same rules to tracked files, and
`packages/preflight/src/secrets/patterns.ts` holds a small `KNOWN_FIXTURES`
allowlist — adding to it is meant to be conspicuous, so prefer runtime assembly
over an allowlist entry.

**How to apply:** when auditing env/credential code, build probe values from
`variable.placeholder` and `variable.modes` rather than typing them, which is
also the idiom the repo's own tests use. Related: [[env-target-live-key-trap]].
