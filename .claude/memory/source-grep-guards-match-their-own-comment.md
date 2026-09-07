---
name: source-grep-guards-match-their-own-comment
description: A test that greps source for a string passes when that string also appears in the comment explaining it
metadata:
  type: feedback
---

A guard that asserts `readFileSync(file).toContain('chrome={false}')` passes
after the prop is deleted from the JSX, because the comment directly above the
call site explains *why* `chrome={false}` is there — and the comment is in the
file the grep reads.

It survived a deliberate mutation run and was only caught because the mutation
script printed the grep count: `2 -> 1`. One occurrence went, one stayed, and
the suite stayed green.

**Why:** in this repo comments are long and quote the code they explain, so a
needle chosen from the code is almost always also in the prose beside it. That
makes the failure mode systematic here rather than unlucky. It is the
`.claude/rules/web-design-parity.md` rule — *before trusting a check, ask what
state would make it fail* — with a specific tell: the answer is "nothing", and
the reason is the comment.

**How to apply:** prefer rendering the thing over grepping the file that
declares it — importing the route's own boundary component and asserting the
absence of `[data-slot="error-header"]` catches what the grep could not. Where a
source read genuinely is the only option (a CSS rule, a class-level fact jsdom
cannot lay out), strip comments first or slice past them. And mutation-test the
guard: reverting the change must turn it red, and "the test still passed" on a
mutation you know applied is itself the finding.

Related: [[verify-with-a-differently-shaped-check]]
