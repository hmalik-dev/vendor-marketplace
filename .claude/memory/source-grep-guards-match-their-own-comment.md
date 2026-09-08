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

## Awareness does not prevent it. A reviewer or a mutation does

Recorded 2026-09-07: a lane wrote a self-referential guard —
`expect(Object.keys(BASE)).not.toContain('viewerOwnsProfile')`, inspecting the
fixture literal declared beside it — **three hours after reading this entry**.
Adding an optional prop to the component and passing it from the page leaves
`BASE` untouched and the file green, so the guard could not fail for the state it
existed to detect. `diff-reviewer` caught it; recall did not.

**Why:** at the moment of writing, it does not look like the shape. It looks like
a reasonable assertion about a thing you can see. The resemblance is only visible
from outside the diff.

**How to apply:** do not rely on remembering this. **Every guard of this kind
needs either an adversarial reviewer or a mutation that proves it can fail** —
and the mutation must be the *precise evasion* the guard exists to stop, not a
crude break. The replacement here was an end-to-end pin at the page driving the
real components, verified against exactly the prop-addition it was meant to
catch.

## A mutation harness can corrupt the source it is testing

Same lane, same day. A harness anchored on a code **snippet** that also matched a
lookalike earlier in the file restored the mutation to the wrong place, silently
corrupting the source.

**The tell is the giveaway and it does not look like a failure:** the next run
reported **"no tests"** rather than a failing assertion. A mutation produces a
failure; an empty collection means the file no longer parses as you think.

**How to apply:** anchor a mutation on a **whole function**, never a snippet that
could repeat. And treat *"no tests collected"* as corruption until proven
otherwise — never as a pass, and never as a flaky runner.
