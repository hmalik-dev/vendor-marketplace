---
name: browser-snapshot-can-close-an-open-dialog
description: A browser_snapshot call issued mid keyboard-interaction test silently closed an open lightbox/modal, making a working focus trap look broken
metadata:
  type: project
---

On VEN-731 (portfolio lightbox keyboard test), pressing Tab four times through
the sequence Close -> Previous -> Next -> Close was independently confirmed
correct via `browser_evaluate` reads after each key press. But the very next
`browser_snapshot` call (no key press, no click) showed the dialog gone and
`document.activeElement` back on the trigger thumbnail — as if Escape had
fired between the last Tab and the snapshot.

**Why:** `browser_snapshot`'s ref-resolution appears to perform an incidental
pointer/hover action while building the accessibility tree, which some
click-outside/blur-to-close modal implementations (Radix included) treat as an
outside interaction and close on. This is a tool-interaction artifact, not a
product defect — re-running the identical Tab sequence with only
`browser_evaluate` reads between key presses (no `browser_snapshot` calls
interleaved) reproduced the correct trap behavior every time.

**How to apply:** when driving a focus-trap/keyboard sequence inside an
open dialog, avoid `browser_snapshot` between key presses — use
`browser_evaluate` (`document.activeElement`, dialog presence) instead, and
only take a `browser_snapshot`/screenshot before the interaction starts or
after it's fully done. If a modal appears to "randomly" close mid-sequence,
suspect the last tool call before concluding the component has a real
click-outside bug.
