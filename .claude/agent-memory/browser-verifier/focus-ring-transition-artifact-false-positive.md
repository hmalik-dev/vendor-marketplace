---
name: focus-ring-transition-artifact-false-positive
description: Button primitive's focus-visible ring reads as "computes correctly but composes to five all-transparent box-shadow layers" when measured synchronously right after Tab — it's a transition-duration artifact, not a broken ring. Always re-measure after waiting past --duration-fast.
metadata:
  type: project
---

On ticket #73, a parity pass claimed the `Button` primitive's focus ring on
`secondary`/`ink` variants "computes correctly but the composed box-shadow
resolves to five all-transparent entries and `outline: 3px none`, so nothing
renders." Measuring `getComputedStyle(el).boxShadow` in the same tick as
`page.keyboard.press('Tab')` reproduced exactly that: five
`rgba(0,0,0,0) 0px 0px 0px 0px`-shaped layers.

Re-measuring the identical element 250-750ms later (no other action) showed
the ring fully painted: `rgb(248,245,239) 0 0 0 2px` (offset ring) plus
`oklab(... / 0.3) 0 0 0 4px` (clay-400/30 outer ring), stable and unchanged at
750ms. A zoomed screenshot at t=0 shows no ring; at t=300ms shows a clearly
visible clay-toned ring around the input.

**Why:** the button has `transition-all duration-(--duration-fast)` (150ms)
and Tailwind v4 registers `--tw-ring-shadow`/`--tw-ring-offset-shadow` etc. as
animatable custom properties. `transition: all` means the very first painted
frame after `:focus-visible` engages starts the interpolation from each
property's _initial_ value (`0 0 #0000`, zero spread) and animates toward the
real ring value over 150ms. A synchronous post-Tab measurement (or a
screenshot taken without a wait) always lands on/near that initial frame and
looks like a broken ring even though the ring is correctly defined and does
render.

**How to apply:** never conclude a focus ring "doesn't render" from a
measurement taken in the same event-loop tick as the keypress that triggered
`:focus-visible`. Wait at least one full `transition-duration` (check
`getComputedStyle(el).transitionDuration`, or the `--duration-fast`/etc. custom
property on `:root`) past the focus event, then re-measure `boxShadow` and
re-screenshot before calling it broken. If it still shows all-transparent
layers after that wait, THEN it's a real bug — walk the cascade for a genuine
specificity/override conflict rather than a timing artifact. See
[[stored-auth-state-needs-marker-wait-not-fixed-sleep]] for the same
"don't trust the synchronous read, wait for the settled state" pattern applied
to a different kind of async UI state (Clerk auth) in this repo.
