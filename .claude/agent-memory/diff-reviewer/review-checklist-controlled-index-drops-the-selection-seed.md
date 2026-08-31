---
name: review-checklist-controlled-index-drops-the-selection-seed
description: When a diff adds a "controlled" mode that hoists an active/highlight index out of a list, diff the new initialiser against the old one — a lazy `useState(seed)` becomes a hardcoded `useState(0)` and Enter then commits the wrong row
metadata:
  type: feedback
---

**A `controlled` prop that hoists a highlight index out of a list component is a
rewrite of that index's _initial value_, not just of who owns it. Read the old
initialiser and the new one side by side.**

**Why:** #375 moved `DropdownList`'s active index into a combobox input so the
input could carry `aria-activedescendant`. `DropdownList` seeded it from the
current selection:

```ts
useState(() =>
  Math.max(
    0,
    options.findIndex((o) => selected.includes(o.value)),
  ),
);
```

The new owner used `useState(0)`. With `Florals` committed, opening the panel
highlighted row 0 — `Any vendor type`, value `''` — so `Enter` silently cleared
the customer's filter. Nothing in the diff reads as wrong locally; the defect is
only visible against the line it replaced, and the uncontrolled path still had
the seed so no existing test moved.

**How to apply:**

- Grep the old component for `useState(` / `useReducer(` on the hoisted state and
  compare the initialiser, not the type.
- Then ask the two questions that make it fail: _what is highlighted when the
  panel opens with a value already committed?_ and _what does `Enter` commit
  right then?_ Probe with a non-zero committed value — a fixture whose selection
  is index 0 hides this completely.
- Same shape for scroll position, focused tab, expanded accordion row: any index
  that used to be derived from the current value.

Related: [[review-checklist-derived-src-flips-after-commit]],
[[review-checklist-dirty-tree-vs-reviewed-commit]]
