---
name: review-checklist-focus-opener-dead-when-already-focused
description: Review checklist — in `dropdown-combobox.tsx` the panel opens from the input's `onFocus`, so any new affordance that opens by calling `inputRef.focus()` is a dead click whenever the input already has focus (after Escape, after a keyboard commit)
metadata:
  type: feedback
---

`ComboboxDropdown` (`apps/web/src/components/ui/dropdown-combobox.tsx`) opens
its panel from **two** handlers on the `<input>`: `onFocus` (when `openOnFocus`)
and `onClick`. The `onClick` exists precisely because `focus()` on an
already-focused element fires no event — the file's own comment says it "did
nothing at all, twice in a row".

The segment's `onMouseDown` opener has only the first half: it
`preventDefault()`s and calls `inputRef.current?.focus()`. So **any element
added inside the segment that is not the input itself inherits a one-way
opener** — the click never reaches the input's `onClick`, and `focus()` is a
no-op when focus is already there.

**Why:** #426 put a disclosure caret (`▾`/`▴`, an `aria-hidden` span) beside the
value and routed its click through that `onMouseDown`. Reachable dead clicks:
focus the field (panel opens) → `Escape` (panel closes, focus stays on the
input) → click the caret → nothing; and ArrowDown+Enter to commit (focus is
restored to the field) → click the caret → nothing. Clicking the input text in
the same state does reopen, which is what makes it look broken rather than
modal. The shipped test only clicks the caret from an unfocused fresh render,
so the suite was green.

**How to apply:** when a diff adds a clickable thing inside `combobox-field`, or
changes that `onMouseDown` guard, drive the sequence _open → Escape → click the
new thing_ and _keyboard-commit → click the new thing_ in jsdom (append a probe
`describe` to `category-select.test.tsx`, run, restore from a `cp` backup).
Also check the other direction: a click inside `[data-slot="combobox-field"]` is
excluded from Radix's `onInteractOutside`, so the affordance cannot close the
panel either — it opens only.

Related: [[review-checklist-source-grep-substring-collisions]],
[[review-checklist-dirty-tree-vs-reviewed-commit]].
