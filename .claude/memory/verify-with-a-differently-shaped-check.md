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
Related: [[never-abort-a-rebase-you-did-not-start]].
