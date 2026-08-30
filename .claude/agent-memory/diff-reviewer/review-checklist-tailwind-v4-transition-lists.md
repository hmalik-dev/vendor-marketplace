---
name: review-checklist-tailwind-v4-transition-lists
description: Replacing `transition-all` with an explicit property list in Tailwind v4 silently drops scale/translate/rotate/filter (they are NOT `transform`), and keeping `box-shadow` in the list keeps a focus ring ramping — verify by compiling the classes and probing computed style in Chromium.
metadata:
  type: feedback
---

When a diff swaps `transition-all` for `transition-[a,b,c]`, compile the real
classes with the installed Tailwind and read the generated CSS before believing
the diff's stated effect.

**Why:** on ticket #73 a diff replaced `transition-all` on `Button` with
`transition-[color,background-color,border-color,box-shadow,opacity,transform]`
to stop the focus ring animating in. Compiling against tailwindcss 4.3.3 showed:

- `scale-[1.02]` → `scale: 1.02`, `-translate-y-0.5` → `translate: …`,
  `rotate-45` → `rotate: 45deg`. These are **separate CSS properties**, not
  `transform`. Tailwind's own `transition-transform` expands to
  `transform, translate, scale, rotate` — that expansion is the tell.
  `brightness-110` is `filter`, also its own property.
- The ring is painted by `box-shadow`, and `box-shadow` was still in the list,
  so a Chromium probe gave **byte-identical** computed `box-shadow` at t=0/40/300ms
  before and after the change. The stated fix fixed nothing and broke the hover
  easing it claimed to preserve.

**How to apply:** for any transition/ring diff in this repo, run the two probes —
they are cheap and decisive:

1. `compile()` from `tailwindcss/dist/lib.mjs` with a `loadStylesheet` that
   resolves `tailwindcss` to the package's `index.css`, then `compiler.build([...classes])`.
2. Playwright `chromium`, a file:// fixture with that CSS, `el.focus()`, and read
   `getComputedStyle(el).boxShadow` at 0ms / ~40ms / ~300ms.

Also check the _other_ elements that draw a ring: a card with
`transition-[box-shadow,transform]` ramps its `has-[…]:ring-*` over
`--duration-base` for the same reason, and a source-scanning guard test that only
greps `transition-all` next to `focus-visible:ring-` cannot see it
(`has-[a:focus-visible]:ring-2` does not contain the substring
`focus-visible:ring-`). Related: [[review-checklist-pseudo-element-hit-areas]].
