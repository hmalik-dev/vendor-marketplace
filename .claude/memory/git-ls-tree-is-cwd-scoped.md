---
name: git-ls-tree-is-cwd-scoped
description: git ls-tree -r lists only the current directory unless you pass --full-tree, and the Bash cwd persists across calls
metadata:
  type: feedback
---

`git ls-tree -r <ref>` is scoped to the **current directory**. Without
`--full-tree` it lists only paths beneath it, and reports nothing for a
directory that exists at the repo root.

    from repo root:  git ls-tree -r origin/main --name-only | grep -c '^scripts/'   -> 8
    from apps/web:   same command                                                    -> 0
    from apps/web:   git ls-tree -r --full-tree origin/main --name-only | grep -c    -> 8

**Why:** on 2026-08-31 this produced a confidently wrong conclusion — that
`scripts/e2e-auth.mjs` and the whole `scripts/` directory did not exist on
`origin/main`, and therefore that browser verification was broken repo-wide. Two
sessions had to contradict it, one of them with the decisive evidence: it had
**executed** `pnpm e2e:auth` successfully twice. Behaviour beats a listing.

The trap is compounded by the harness: **the Bash tool's working directory
persists between calls.** A single earlier `cd apps/web` (done so a bare
`playwright` import would resolve) became a silent precondition under every
later check. `find . -name …` and `ls -d scripts` "confirmed" the result — but
they were not independent confirmations, they shared the same hidden input.

**How to apply:**

- Pass `--full-tree` whenever asking about a ref rather than about the current
  directory, or `cd` to the repo root first.
- Treat agreement between checks that share a precondition as **one** check, not
  three. Corroboration requires a differently shaped input, not a differently
  spelled command — see [[verify-with-a-differently-shaped-check]].
- When a peer reports that a command *ran*, weight that above any number of
  re-read listings, including your own.

Related: [[verify-with-a-differently-shaped-check]],
[[tracker-board-rows-are-bold]].
