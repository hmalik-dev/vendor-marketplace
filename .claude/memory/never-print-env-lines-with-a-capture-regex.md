---
name: never-print-env-lines-with-a-capture-regex
description: "A sed capture that silently fails prints the whole .env line, secret included; extract names with cut, not sed"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 55a5e167-a9bf-464c-8644-ed282d3c83cc
  modified: 2026-09-20T19:24:56.323Z
---

To list names from an env file use `cut -d= -f1` (or `grep -o '^[A-Z_]*'`), never `sed -E 's/^\s*#\s*(NAME)=.*/\1/'`. BSD sed on macOS does not support `\s`, so the substitution matched nothing and printed the full line: two commented-out Neon connection strings with a password reached the transcript (2026-09-20).

**Why:** the user's rule is that a credential exposed once is rotated; that leak forced a dev-branch role password reset.

**How to apply:** when reading `.env*`, print names or lengths only, and prefer `[[:space:]]` over `\s`. Test the extraction on a masked copy or with `wc -c` before printing lines. See [[credentials-env-files-only]].
