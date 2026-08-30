# 42 — Dropdowns and pickers

Section 28 of `Orla - Screens.dc.html`. One shell, four bodies, two mounts.
Every select in the product uses this; nothing rolls its own.

## Mounts

| Viewport | Mount                                                                                                               |
| -------- | ------------------------------------------------------------------------------------------------------------------- |
| ≥ 640    | anchored popover, 8px below the field, aligned to the field's **left edge**                                         |
| < 640    | **bottom sheet** — full width, 48px rows, grab handle, explicit Close, dismissing scrim, max 70% of viewport height |

A popover anchored to a 44px field on a 390px screen either covers the field or
runs off it, which is why mobile switches rather than shrinks.

## Shell

- `stone-0` fill, 1px `stone-300`, **12px radius**, `shadow-lg`, 6px inner padding
- Rows **44px** (38px from the compact header bar; 48px in the sheet), 8px radius
- Hover `stone-150` · selected `clay-100` with a **clay check**, label to 600
- Optional `lbl` caption at the top naming the field and the option count
- Width: 330px from the hero, 258px from the compact bar, never narrower than its field
- Height: caps at **360px** and scrolls, with the cut row left half-visible so the scroll is legible
- Flips above the field when the field is within 380px of the viewport bottom

## Bodies

1. **Single-select** (vendor type, city, event type) — commits and closes on click.
   **No search field**, and this is not negotiable: 11 categories fit one screen, a
   filter box on a list this short is friction rather than help, and because such a
   field is autofocused its focus ring would appear every single time the panel
   opened — permanent decoration, not feedback. **Typing narrows the list in
   place.**
2. **Multi-select** (style, and any "pick any" filter) — **checkboxes, not
   checkmarks**; the square says "more than one" before anything is read. Footer
   with **Apply · n** and Clear.
3. **Range** (price) — preset chips first for the common case, min/max inputs
   below, slider as a _readout_ of the inputs rather than the only control.
   Footer with Apply and Clear.
4. **Date** — single-month popover using the availability cell marks from
   section 11 (hatch = unavailable, dashed = held, ink outline = today).

**Multi-select and ranges never auto-apply.** A filter that fires per keystroke
makes the results grid flicker and re-sort under the user's hand.

## Behaviour

- **Dismiss:** click outside, `Esc`, or select. Scroll does **not** dismiss — it repositions.
- **Keyboard:** ↑↓ moves, ↵ commits, typing **narrows the list in place** (not a jump-to-first-letter), `Tab` closes and moves on. Focus returns to the field on close.
- **Open state on the field:** open **adds to** the focused state rather than replacing it — same `stone-200` fill and clay label, plus the value turning clay and the caret flipping. (The earlier "open replaces focus" rule made an open segment look quieter than a focused one.) In the compact header bar the open segment is the only clay element. A segment inside a joined bar takes a fill and a clay label at every rung — **never a border, edge or outline**, which would fight the bar it sits inside.
- **Scrim:** hero and mobile only, where the dropdown is the page's subject. **Never** in the compact header — results must stay readable behind it.
- **Empty body** (a city with no vendors in that category): one row of `stone-600` copy saying so plus a single action, never a blank panel.
