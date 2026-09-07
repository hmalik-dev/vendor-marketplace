---
name: class-assertions-need-the-split-list
description: A `toContain` on `className` is a substring match, so a responsive variant satisfies the assertion for the base step it was meant to pin
metadata:
  type: feedback
---

`expect(el.className).toContain('text-[11px]')` **passes on
`min-[90rem]:text-[11px]` alone.** The base step it was written to pin is then
guarded by nothing, and deleting it leaves the suite green.

Assert against the split list instead — `expect(el.className.split(/\s+/))
.toContain('text-[11px]')` — which makes each Tailwind variant a distinct token.

**Why:** every responsive class in this repo *ends* with its base class, so the
one step no larger breakpoint covers for — the mobile-first base — is exactly
the one a substring match cannot fail on. Found twice now: `refine-bar.test.ts`
anchored its own check for this reason, and #426 shipped an unpinned 390px caret
size until a review mutation-tested it.

**How to apply:** any assertion naming a single utility class goes through the
split list. The same shape as [[verify-with-a-differently-shaped-check]] and
[[source-grep-guards-match-their-own-comment]] — before trusting a check, ask
what state would make it fail.
