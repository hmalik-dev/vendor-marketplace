---
name: review-checklist-skeleton-geometry-from-the-wrong-frame
description: A skeleton read off the loading frame instead of the component it replaces still reflows; measure both in Chromium, and check whether the class even compiles
metadata:
  type: feedback
---

Two questions to ask of any "match the frame" diff in this repo.

**1. A skeleton's source of truth is the component, not the loading frame.**
Ticket #386 rebuilt `VendorCardSkeleton` from frame `17 Search loading`. Every
class resolved to the frame's number exactly — and the card still grew **27px**
on resolve, because frame `17` is drawn at 3 columns / 450.7px wide with a fixed
152px cover, while frame `02 Search` (same 1440 width, loaded state) is 4 columns
/ 335px with a 3:2 cover. Inside the design file the loading card's body is 141px
against its loaded sibling's 116px: the frame's own arithmetic was 25px off
before anyone copied it. `#385` is right that frames are composition, not
arithmetic — and that applies to a _pair_ of frames, not just one.

**How to apply:** compile the app's real CSS
(`npx @tailwindcss/cli -i apps/web/src/app/globals.css -o out.css --content probe.html`),
render the loaded component and the skeleton side by side in Playwright with the
webfonts loaded, and diff `getBoundingClientRect().height`. Per-block class
comparison is not enough — `mt-0.5` on the card vs `mt-2.25` on the skeleton is
invisible in a diff and 7px on screen. Do the same for padding: `px-4 pt-3.5 pb-4`
is not `p-3.5`.

**2. An undefined ramp step does not "fall through" — it compiles to nothing.**
The #386 comments (and the ticket) claimed `text-sage-700` / `hover:text-steel-700`
"fell through to Tailwind's own cool default palette". Tailwind v4 has no `sage`
or `steel` at all, so those classes emit **zero CSS**: the element inherited
`body`'s colour, and the hover was already a no-op on main. That inverts the
impact story — "we removed a hover" was really "we ratified a hover that never
rendered".

**How to apply:** before believing any claim about what a bad utility rendered,
put it in a probe file, compile, and grep the output for the selector. Absent
selector = inherited value, not a wrong value.

**Why:** both errors survive a green test suite and a careful read of the diff,
because the diff's own comments assert them as fact. Related:
[[review-checklist-design-frames-are-content-box]],
[[review-checklist-source-grep-substring-collisions]].
