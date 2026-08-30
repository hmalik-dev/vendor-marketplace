---
name: review-checklist-ring-offset-same-as-ground
description: A focus-ring "fix" that sets ring-offset-<colour> to the colour already behind the control is a no-op that deletes the indicator's only 3:1 edge — scan pixels outward from the border box
metadata:
  type: feedback
---

A diff that changes `focus-visible:ring-offset-0` to
`focus-visible:ring-offset-2 focus-visible:ring-offset-<ground>` is not
automatically an accessibility improvement. Tailwind's ring is an **outward**
box-shadow: with offset 0 the ring band already sits outside the border box, on
the parent's background — never on the control's own fill. So the usual
rationale ("the ring was flush against the fill and the same hue") describes a
boundary that is often the indicator's _highest_-contrast edge.

If the offset colour equals the parent's background, the offset band is
invisible, and the only thing that changed is that the ring moved outward and
lost its contrasting neighbour.

**Why:** measured on this repo's hero submit (`search-bar.tsx`, ticket #296).
Before: clay-400 pill | 2px clay-400/30 over stone-0 (232,202,188) — that edge
is 3.18:1, which clears 1.4.11. After: clay-400 pill | 2px opaque stone-0 (the
bar's own colour) | 2px 232,202,188 | stone-0 — every edge of the indicator is
1.52:1 and nothing clears 3:1. The "fix" regressed the axis it cited.

**How to apply:** don't reason about it, measure it.

1. Compile the real stylesheet: `postcss([require('@tailwindcss/postcss')()])`
   over `apps/web/src/app/globals.css` with `from` set to that path — the
   plugin resolves the `@import`s and auto-scans `apps/web/src`, so every real
   class is emitted.
2. Build a probe page with the compiled CSS, reproduce the control inside its
   real parent background, focus it with `keyboard.press('Tab')` (a scripted
   `.focus()` may not match `:focus-visible`).
3. Read `getComputedStyle().boxShadow` for the layer order and spreads, then
   screenshot and scan a pixel row outward through the border box (load the PNG
   back as a base64 data URL — a `file://` image taints the canvas).
4. Compute contrast on **both** boundaries of every band that changed colour.
   An indicator with no 3:1 neighbour has failed regardless of its width.

Related: [[review-checklist-tailwind-v4-transition-lists]] (same compile-and-probe
discipline), and this repo's `.claude/rules/web-design-parity.md`, which says the
parity pass is the only gate the six accessibility laws get.
