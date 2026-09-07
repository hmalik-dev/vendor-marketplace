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
   drastically", so a scroll list is not the affordance. City caps at eight
   suggestions.

   **City searches every US city, not our inventory (D32, #384).** It used to
   suggest only places that already had a published vendor, preloaded whole and
   labelled with how many were there, on the reasoning that the field may only
   ask questions the platform can answer. The user overruled that: _"i currently
   want the city dropdown to function the way airbnb's 'where' input functions.
   Do not preload and indicate how many vendors are in each city.. users should
   be able to search for any city and see the results."_ So the suggestions come
   from a seeded US places table as the customer types, no row carries a count,
   and no count orders two same-named cities — population does, and it never
   leaves the API. A city with nobody in it commits and lands on frame `18`'s
   no-results state with relaxations, which is a better answer than making the
   place unpickable.

   **What survives unchanged is the constraint, not the shape:** the committed
   value is still a category slug or empty, and still a real `(city, state)`
   pair or empty. Typing is an input affordance and never a query term; only a
   click or a keyboard commit changes the query, and uncommitted text reverts on
   blur, `Esc` and `Tab`. That is the half of D6 D32 left standing, and a bare
   `Enter` on a string that matches no place still commits nothing.

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
- **Empty body**: one row of `stone-600` copy saying so plus a single action, never a blank panel. The example used to be _"a city with no vendors in that category"_ and **#384 retired it** — a city with no vendors is not an empty panel any more, it is a suggestion that commits and lands on frame `18`. City's empty bodies are now a typed string no US place matches, a request still in flight, and a request that failed; all three carry `Search anywhere` as the action.

## The `▾` in the frames is a recorded override, not a miss — except on the vendor-type picker

D25 (2026-08-31) removed the unicode caret from every trigger in the app, as a
user override of this file and of the frames — the one place where code leads the
contract. **The frames still draw `▾` and they are not going to stop**:
`frame-13-parity.test.ts` asserts frame `13` contains `Category ▾`, `City ▾` and
`Payouts ▾`, and inverts its own app-side assertion rather than deleting it,
precisely so the override stays visible from both sides.

**#426 reverses it for one control (2026-09-06).** The account holder asked for
the caret back on the **vendor-type picker**, on the landing hero and on
`/search` — one component, `CategorySelect`, that both surfaces mount. There the
app now draws what frames `01`, `02` and `28` draw: `▾` in `stone-600` closed,
flipping to `▴` in `clay-600` open, `aria-hidden` and never part of the
accessible name. `clay-600` rather than frame `28`'s `#B4552F`, because
`01-foundations.md` makes `clay-400` a fill and never text on cream.

The **open state on the field** above is therefore live again as written — the
value turns clay _and_ the caret flips. Both, not one: the caret is the
affordance and the clay value is the state. `City` draws no caret in any frame
and keeps the clay value alone.

The other thirteen sites keep D25, and `app/dropdown-caret.test.ts` is narrowed
rather than deleted so they stay that way — it exempts exactly one named file and
fails if the exemption list grows.

A parity pass that files "the app draws no caret where the frame does" is
re-finding a decision. It has now been filed **four** times — #228, #338, and
again as the fifth row of **#392** — which is why it is written here, in the file
a dropdown ticket actually opens, rather than only in the decision log. #392's
chevron item is struck for this reason; its other four are real.

The two **lucide** icons D25 deliberately left alone (`ui/select.tsx`,
`tags/tag-category-section.tsx`) are still in scope for nobody: removing an icon
from a shadcn primitive is a different decision on frames that ruling never
opened.
