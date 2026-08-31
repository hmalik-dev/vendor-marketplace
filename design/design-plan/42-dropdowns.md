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

1. **Single-select** (event type, and any short enumerable list) — commits and
   closes on click. **No search field _inside the panel_**, and that is not
   negotiable: a filter box on a list this short is friction rather than help,
   and because such a field is autofocused its focus ring would appear every
   single time the panel opened — permanent decoration, not feedback. **Typing
   narrows the list in place.**
2. **Combobox** (vendor type) and **typeahead** (city) — **the field itself is
   the text input**, and the panel hangs off it. Ruled by the account holder on
   2026-08-31 and recorded as **D28**; `11-search.md` has specified both
   controls this way since it was written.

   This does **not** contradict body 1, and the distinction is the whole of it:
   body 1 forbids a **second, autofocused** field inside the panel, and there is
   no second field here. The customer types into the one they already tabbed to,
   so its focus ring means what it has always meant. The narrowing behaviour is
   body 1's own — see Behaviour below, which has said "typing narrows the list
   in place" since the 2026-08-30 import.

   The two differ in one behaviour and it is deliberate. **Vendor type opens on
   the full taxonomy**, because eleven categories are worth seeing and teaching.
   **City opens nothing until something is typed** — "cities can vary
   drastically", so a scroll list is not the affordance. City also caps at eight
   suggestions and says how many more matched.

   **What survives unchanged is the constraint, not the shape:** the committed
   value is still a category slug or empty, and still a real `(city, state)`
   pair or empty. Typing is an input affordance and never a query term; only a
   click or a keyboard commit changes the query, and uncommitted text reverts on
   blur, `Esc` and `Tab`. That is D6, and it is untouched.

3. **Multi-select** (style, and any "pick any" filter) — **checkboxes, not
   checkmarks**; the square says "more than one" before anything is read. Footer
   with **Apply · n** and Clear.
4. **Range** (price) — preset chips first for the common case, min/max inputs
   below, slider as a _readout_ of the inputs rather than the only control.
   Footer with Apply and Clear.
5. **Date** — single-month popover using the availability cell marks from
   section 11 (hatch = unavailable, dashed = held, ink outline = today).

**Multi-select and ranges never auto-apply.** A filter that fires per keystroke
makes the results grid flicker and re-sort under the user's hand.

## Behaviour

- **Dismiss:** click outside, `Esc`, or select. Scroll does **not** dismiss — it repositions.
- **Keyboard:** ↑↓ moves, ↵ commits, typing **narrows the list in place** (not a jump-to-first-letter), `Tab` closes and moves on. Focus returns to the field on close. On a combobox or typeahead the field never lost focus in the first place, so ↑↓ must `preventDefault` — a text input's own arrows move the caret, and the ticket's requirement that the caret stay put is a requirement to suppress that.
- **Open state on the field:** open **adds to** the focused state rather than replacing it — same `stone-200` fill and clay label, plus the value turning clay and the caret flipping. (The earlier "open replaces focus" rule made an open segment look quieter than a focused one.) In the compact header bar the open segment is the only clay element. A segment inside a joined bar takes a fill and a clay label at every rung — **never a border, edge or outline**, which would fight the bar it sits inside.
- **Scrim:** hero and mobile only, where the dropdown is the page's subject. **Never** in the compact header — results must stay readable behind it.
- **Empty body** (a city with no vendors in that category): one row of `stone-600` copy saying so plus a single action, never a blank panel.
