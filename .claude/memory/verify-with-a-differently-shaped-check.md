---
name: verify-with-a-differently-shaped-check
description: A grep that silently over- or under-matches returns a confident wrong answer; re-run differently rather than re-reading the pattern
metadata:
  type: feedback
---

A verification pattern that matches more or fewer lines than intended looks identical to
one that worked — it returns a clean, confident, wrong answer. Re-reading the pattern does
not catch it. Only re-running the check in a differently shaped way does.

Two real cases, same night, opposite directions:

- `grep -E '^| 12 |'` — unescaped `|` is ERE alternation, so it matched all 3301 lines of
  the file and reported a confident `DIFFERS`. Escaped to `^\| 12 \|` the answer flipped to
  `IDENTICAL`.
- `grep -noE '.{24}\b(35[4-9])\b.{14}'` — fixed context padding silently required 24 chars
  before and 14 after the match, so hits near a line boundary never matched. Reported a
  confident three; the real count was six.

**Why:** neither was found by inspection. Each was found by another session running the
same question with a different command.

**How to apply:** when a grep result is load-bearing, confirm it with a check that does not
share the first one's failure mode — count with a second pattern, diff whole files instead
of matching lines, or assert a post-condition on the result. Prefer guards that do not
depend on any pattern being right: for a find-and-replace sweep, diff the file before and
after and confirm only the intended lines changed.
**Corroboration requires independent preconditions, not just different commands.**
2026-08-30, four sessions on one board produced four confidently-wrong greps in a night.
The worst one: a peer reported `scripts/` and `pnpm e2e:auth` absent from `origin/main`,
confirmed by `git ls-tree`, `find` and `ls` all agreeing, and was about to file a ticket
telling the next lane to rebuild files that already existed.

The cause was not any pattern. **`git ls-tree -r <ref>` is scoped to the current working
directory unless you pass `--full-tree`** — and the Bash cwd had persisted from an earlier
`cd apps/web`, where `scripts/` genuinely does not exist. All three checks shared that one
hidden precondition, so their agreement carried no information.

**How to apply:** three checks agreeing is not evidence when they share a precondition
(cwd, ref, env, a stale build). Prefer *behavioural* evidence over listings — running the
thing beats looking for the thing. What settled this was a session that had actually
executed `pnpm e2e:auth` successfully, plus a preflight check asserting reachability, both
of which were impossible if the file were missing. When a listing surprises you, re-run it
from a known-absolute position (`--full-tree`, an absolute path, a fresh shell).

Related: [[never-abort-a-rebase-you-did-not-start]], [[lead-dont-narrate]].
