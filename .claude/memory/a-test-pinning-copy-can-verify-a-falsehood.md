---
name: a-test-pinning-copy-can-verify-a-falsehood
description: When a rule applies to one side of a two-party relationship, the copy describing it is false for the other side — and a test asserting that copy makes the falsehood look checked
metadata:
  type: feedback
---

When a rule is narrowed to **one side** of a two-party relationship, every
sentence describing it becomes false for the other side. Find those sentences
before shipping the narrowing, and treat a **test that pins one of them** as the
worst case rather than as reassurance.

**Why:** #438 built D39's closure refusal. The refusal correctly applies only to
bookings the account holds **as the customer** — a vendor's forward bookings are
refunded in full by #433's unwind, because the vendor walked away and the
customer did not. Narrowing `closeBlockers` to the customer side was right, and
its consequence was that a vendor subject always has an empty blocker list, so
the closure falls straight through to the full-refund path.

Four surfaces said the opposite: the confirmation dialog (_"It refunds nothing
and prices nothing"_), the console page (_"it never prices a refund"_), the
route's own docstring, and **`privacy.md`**, a public legal document — where
`legal-content.test.ts` asserted that sentence against the rendered page. The
test was written to stop the policy and the product drifting apart, and it did
the reverse: it held the false half in place and made it look verified. The
whole local gate was green throughout.

**How to apply:** after narrowing any rule to one party, grep the words the rule
uses — _"refunds nothing"_, _"never"_, _"always"_ — across components, route
docstrings, legal documents and the tests that assert them, and make each one
name which side it is true of. Prefer surfacing the fact over softening the
sentence: #438 returns `bookingsRefundedOnClose` so the dialog can say _"cancels
the 1 upcoming confirmed booking their customers hold with them"_ rather than
hedging. And when a destructive action can leave money unmoved, return the count
(`refundsFailed`) — a console showing a clean success over a stranded refund is
the same defect #400 fixed on the ban.

Related: [[record-findings-in-backlog]],
[[source-grep-guards-match-their-own-comment]],
[[verify-with-a-differently-shaped-check]].
