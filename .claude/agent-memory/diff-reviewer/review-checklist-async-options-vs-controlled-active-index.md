---
name: review-checklist-async-options-vs-controlled-active-index
description: When a combobox's options move from a synchronous filter to a fetch, Enter commits row 0 of the *previous* query — type past a prefix, then Enter before the debounce
metadata:
  type: feedback
---

A diff that makes a combobox's `options` arrive from the network (debounce + keep
the old rows so the panel does not flash) silently breaks the invariant that the
highlighted row matches the typed text.

**Why:** `dropdown-combobox.tsx` computes `matched = filter(options, typed)` and
`active = moved === null ? Math.max(0, selectedIndex) : …`, so with nothing
committed `active` is `0`. Under the old synchronous `filter`, row 0 always
matched what was typed. With async options the panel holds the _previous_
query's rows for `debounce + RTT`, and `Enter` commits `shown[0]` — a place the
customer never typed. In #384 this made typing `santa fe` and pressing Enter
commit `Santa Ana, CA`. The hook's own "keep the rows so the panel does not
flash empty" comment is the thing that causes it.

**How to apply:** whenever a `filter` prop is dropped or defaulted to identity,
write the probe: answer the first query, leave the second hanging
(`new Promise(() => {})`), type the extra characters, press Enter, and assert
`onChange` was not called. The shipped suite will not catch it — its stale-answer
test asserts what _renders_, not what `Enter` commits. The fix shape is to gate
the commit (or empty `shown`) on the answered query matching `typed`.

Related: [[review-checklist-controlled-index-drops-the-selection-seed]],
[[review-checklist-derived-src-flips-after-commit]].
