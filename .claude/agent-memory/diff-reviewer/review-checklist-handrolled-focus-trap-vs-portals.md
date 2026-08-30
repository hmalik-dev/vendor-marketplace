---
name: review-checklist-handrolled-focus-trap-vs-portals
description: A hand-rolled focus trap that keys on `panel.contains(document.activeElement)` breaks every Radix Popover/Select inside the panel, because their content is portalled to <body> and is therefore "outside" — and a document-level Escape listener closes the panel along with the popover.
metadata:
  type: feedback
---

Whenever a diff adds a hand-rolled modal/focus-trap hook, enumerate the
**portalling** descendants of the trapped panel before reading anything else.

**Why:** ticket #73 added `useModalSheet` to the search Refine sheet. Every chip
in `refine-bar.tsx` is a `Popover` whose `PopoverContent` renders inside
`PopoverPrimitive.Portal` (→ end of `<body>`), so:

- The trap's `if (!panel.current.contains(document.activeElement)) { preventDefault(); focusable[0].focus(); }`
  fires on every Tab pressed inside an open chip popover and yanks focus back to
  the top of the sheet — the second price slider and every checkbox after the
  first become keyboard-unreachable.
- The trap's `document` keydown Escape handler and Radix's `DismissableLayer`
  both run (Radix 1.1.19 has zero `stopImmediatePropagation`), so one Escape
  dismisses the popover _and_ the whole sheet.

**How to apply:** grep the panel's subtree for `Portal`, `PopoverContent`,
`SelectContent`, `DropdownMenuContent`, `TooltipContent`. If any exist, the trap
must treat the portalled layer as inside (Radix `FocusScope`, or an
`[data-radix-popper-content-wrapper]` allowance) or the diff is a keyboard
regression. Also check whether the "modal" flag is width-gated: a sheet that is
`max-lg:fixed` but whose `open` state has no `matchMedia` reset keeps
`role="dialog" aria-modal` and the trap on the plain desktop bar after an iPad
rotates 768→1024.
