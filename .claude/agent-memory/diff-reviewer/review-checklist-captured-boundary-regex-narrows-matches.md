---
name: review-checklist-captured-boundary-regex-narrows-matches
description: A ReDoS fix that adds a captured `(^|[^class])` boundary (Safari has no lookbehind) silently stops matching tokens glued to a class char or a previous match
metadata:
  type: feedback
---

When a redaction regex gains a captured leading boundary `(^|[^class])` to become linear
(VEN-674: `JWT`, `EMAIL` in `error-reporting.ts`), it no longer matches:

- a token preceded by a URL escape: `Bearer%20eyJ…`, `__session%3DeyJ…`, `%22eyJ…` (the char
  before `eyJ` is a hex digit, i.e. in the class);
- the second of two matches glued by a class char: `a@x.com%2Cb@y.com`, `a@x.com_b@y.com`,
  `a@x.com+b@y.com` — the first match consumed the run's head, so the tail has no boundary.
  The old unanchored regex redacted all of these.

**Why:** the diff's own "no delimiter eaten" tests only use non-class delimiters (`=`, `,`, `:`),
so they cannot see it.

**How to apply:** for any boundary-captured rewrite, run base vs new through the real function
(`git show HEAD:file > /tmp/x.ts`, `node_modules/.bin/tsx -e`) on `%XX`-prefixed and
class-char-glued inputs. Also time every other regex in the same chain: `QUERY_VALUE`'s name
class includes `?`, so `'?'.repeat(65536)` took ~1.9 s before and after.
