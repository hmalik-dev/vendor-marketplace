---
name: review-checklist-pseudo-element-hit-areas
description: Review checklist — when a diff shrinks a control to a glyph and restores the 44x44 target with an absolutely positioned ::before, measure it in a browser; an overflow ancestor clips it
metadata:
  type: feedback
---

When a diff replaces a sized icon button with a bare glyph and re-provides the
`04-laws.md` 44x44 hit area with `before:absolute before:size-11
before:-translate-*-1/2`, the class string is not evidence. The pseudo-element
overflows the control's own box, so it is clipped by the nearest ancestor with
`overflow` other than `visible` — in this repo that is `@utility app-pane`
(`overflow-y: auto`, `packages/config/tailwind/theme.css`), which every app
surface uses.

**Why:** In lane 153 (#157) the availability month-nav buttons went from
`Button size="icon"` (a real 44px box in flow, which cannot overflow the start of
its flex line) to a 13px glyph with `before:size-11`. The heading row sits at the
top of `section.app-pane`, so the pseudo spanned y 19->63 against a pane clipping
at 22 and the top ~3px of the target was unreachable. The unit test asserted
`className` contains `before:size-11` and passed, because jsdom has no layout.

**How to apply:** Build a static Chromium repro of the same box model (ancestor
`overflow-y:auto`, the same flex/baseline row, the same font sizes) and call
`document.elementFromPoint(cx, cy±21)` and `(cx±21, cy)`. If any of the four
extremes returns something other than the button, the 44x44 is not there. Also
check the horizontal overhang does not shadow a neighbouring interactive element.
Related: [[review-checklist-unpinned-safety-constants]] — same shape, a test that
pins the mechanism's name rather than its effect.
