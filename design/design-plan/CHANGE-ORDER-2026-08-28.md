# Orla — change order for Claude Code

**Hand Claude Code this file only.** It is self-contained: every value needed to
implement the changes is written out below, so no other design-plan file has to
be re-read and no screen outside the ones named here should be touched.

Baseline: the implementation built from `CLAUDE-CODE-PROMPT.md`.
Date: 2026-08-28.

---

## Rules of engagement

1. **Only the files backing the screens named below may change.** If a change
   seems to require editing a shared component used by an unnamed screen, add a
   variant or a prop — do not alter that component's existing default.
2. **No refactors, no dependency changes, no formatting passes** on files you
   open incidentally.
3. Tokens: add new ones to the existing theme file, do not inline hexes in
   components. Names below are suggestions; match the project's convention.
4. When done, list the files you changed and nothing else.

---

# Part A — this round

## A1. Availability calendar: state marks (screen 11)

**Problem being fixed:** booked, pending and blocked were three pale fills
within ~2 points of luminance of one another. Indistinguishable in greyscale, at
a glance, or with red-green colour deficiency.

**Rule: every cell state carries a shape as well as a fill. Fill alone is never
the signal.**

| State                | Fill                                                                         | Shape                                                  | Number         | Interactive                      |
| -------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------ | -------------- | -------------------------------- |
| Available            | `#FFFDF9`, 1px `#E4DDD1`                                                     | none                                                   | `#23201C`      | click / drag to block            |
| Booked — locked      | `#F7E7E0`                                                                    | **4px solid `#B4552F` dot**, centred below the number  | `#8E3F20`, 600 | opens the booking                |
| Pending request      | `#F5EEDC`                                                                    | **1.5px dashed `#C99A2E` border**                      | `#7A5A12`, 600 | opens the request                |
| Blocked by you       | 45° hatch: `repeating-linear-gradient(-45deg,#EFE9E0 0 3px,#E0D8CA 3px 6px)` | **line-through** on the number                         | `#6B6459`      | click to unblock                 |
| **Completed** (new)  | `#EDF0E9`                                                                    | **check glyph** in `#5E6B4F`, centred below the number | `#4B5940`, 600 | **yes — opens the past booking** |
| Selecting now        | `#B4552F`                                                                    | fill is the signal                                     | `#FFFDF9`, 600 | drag continues                   |
| **Today** (new)      | `#FFFDF9`, **1.5px solid `#23201C`**                                         | ink outline                                            | `#23201C`, 600 | normal for its state             |
| Past, nothing booked | `#F8F5EF`                                                                    | none                                                   | `#C9C1B5`      | inert, no hover                  |

Implementation notes:

- Cells carrying a dot or check need `padding: 5px 0 10px` (against `7px 0`
  elsewhere) so the number stays optically centred. Cells with a 1.5px border
  use `padding: 5.5px 0` to avoid a 3px height shift.
- Dot: `position:absolute; left:50%; bottom:4px; margin-left:-2px; width:4px;
height:4px; border-radius:50%`.
- Check: `position:absolute; left:50%; bottom:5px; margin-left:-4px; width:7px;
height:4px; border-left:1.6px solid #5E6B4F; border-bottom:1.6px solid #5E6B4F;
transform:rotate(-45deg)`.
- **Do not use ✕ for blocked** — a cross means "close / dismiss" elsewhere in the
  product.
- **Completed cells are clickable and get a hover state.** Other past dates do not.
- The **legend must render the real marks**, not flat colour chips, and gains
  rows for Completed and Today. Add the caption: "Every state carries a shape as
  well as a colour, so the calendar still reads in greyscale and for colour-blind
  vendors."
- Sidebar summary splits "Booked" into **Booked ahead** and **Completed**
  (completed counted in `#4B5940`).
- Helper text becomes: "Click a date to block it, or drag across several. Booked
  dates are locked, and completed events stay on the calendar — click one to open it."

Screen 11 has no separate tablet/mobile frame; the same cell component serves
every width. Any other calendar in the product (e.g. the dashboard week strip)
either uses this component or already carries text labels — do not restyle those.

## A2. Dropdowns and pickers — new shared component

Currently every select is undesigned. Build **one** component; nothing rolls its own.

### Mounts

- **≥ 640px:** anchored popover, 8px below the field, aligned to the field's **left edge**.
- **< 640px:** **bottom sheet** — full width, 48px rows, 34×4px grab handle, explicit "Close", dismissing scrim, max 70% of viewport height.

### Shell

- `#FFFDF9` fill, 1px `#E4DDD1`, **12px radius**, `0 14px 44px rgba(35,40,38,.20)`, 6px inner padding
- Rows **44px** (38px from the compact header bar, 48px in the sheet), 8px radius
- Hover `#F1ECE4`; **selected** `#F7E7E0` with a clay check and label weight 600, label colour `#8E3F20`
- Optional uppercase caption at top naming the field and option count
- Width **330px** from the hero bar, **258px** from the compact header bar; never narrower than its field
- Max height **360px**, scrolls, cut row left half-visible so the scroll is legible
- Flips above the field when the field is within 380px of the viewport bottom

### Bodies

1. **Single-select** (vendor type, city, event type) — commits and closes on click. **No search field** (11 categories fit one screen).
2. **Multi-select** (style, any "pick any" filter) — **checkboxes, not checkmarks**; 15px square, 4px radius, `#B4552F` when checked. Footer: **Apply · n** + Clear.
3. **Range** (price) — preset chips first, min/max inputs below, slider as a readout of the inputs rather than the only control. Footer: Apply + Clear.
4. **Date** — single-month popover reusing the **A1 cell marks** (hatch = unavailable, dashed = held, ink outline = today), with a mini legend and Clear in the footer.

**Multi-select and range panels never auto-apply** — a filter firing per
keystroke makes the results grid flicker under the user's hand.

### Behaviour

- Dismiss on outside click, `Esc`, or select. **Scroll repositions, never dismisses.**
- Keyboard: ↑↓ move, ↵ commits, type-ahead jumps to first letter, `Tab` closes and moves on. Focus returns to the field on close.
- Open field state: value turns clay, caret flips. In the compact header bar the open segment is the only clay element.
- Scrim (`rgba(35,32,28,.16)` desktop, `.34` mobile) on **hero and mobile only** — never in the compact header, where results must stay readable behind the panel.
- Empty body: one row of `#6B6459` copy explaining why plus a single action. Never a blank panel.

Applies to: hero search (landing), compact header bar (search results and every
signed-in screen that carries it), Refine bar filters, booking-request event
type, and vendor profile editor selects.

---

# Part B — earlier design changes, if not already built

Skip any item already in the codebase.

## B1. Card cover aspect ratio

Vendor-card covers declare **`aspect-ratio: 3/2`**, never a fixed height. A fixed
height against a fluid card width crops the same vendor's photo differently at
every breakpoint; 3:2 is also the native ratio of essentially every camera, so an
uploaded portfolio image needs no re-crop. Applies to search results, profile,
and all loading/empty states.
Consequence: **any pane with a fixed bottom action bar needs bottom padding equal
to the bar's height** (76px on mobile search) or the last card's price row lands
under it.

## B2. Vendor profile header (screen 03)

> **SUPERSEDED 2026-08-29 — do not implement.** The full-bleed banner and the
> overlapping avatar are removed at every width. See
> `CHANGE-ORDER-2026-08-29.md` and the rewritten `12-vendor-profile.md`. The
> section is kept only so a stale copy of this file is recognisable.

Banner **196px**. Avatar **82px** with a 4px `#F8F5EF` ring and
`0 4px 14px rgba(35,32,28,.10)`, overlapping the banner's lower edge by **16px
(20%)** — the row uses `margin-top:-34px` against the content column's 18px
`padding-top`. The clipping ancestor must be `overflow: visible` with the banner
at `z-index:0` and the header row at `z-index:2`; keep `overflow:hidden` on the
inner tab pane. Name block offset **23px** so its cap-height reads level with the
avatar; the name must not touch the banner edge.

## B3. Page loader

Replace the wordmark pulse with the **mark's two rings converging**: 30px circles,
filled `#B4552F` and 2px `#23201C` outline, translating −9px→+7px and +9px→−7px
on a 1.9s `cubic-bezier(.45,0,.55,1)` loop so they cross past each other at
mid-cycle. **No wordmark** — this renders before fonts are guaranteed. Page
loader is for first paint and auth redirects only.

## B4. 1024 breakpoint

1024 is a **real breakpoint**, not compressed desktop; the binding constraint at
this width is **height (640px usable)**, not width.

- Page padding 40 → 24–28px
- Sidebars stay **220px with labels** — no icon rail
- Right rails narrow 420 → **340px**, never stack
- Grids lose a column before a card loses information (results 4 → 3, 14px gaps)
- Landing hero keeps **all three** overlapping photo cards beside the text at
  0.73 scale; display type 54 → 40px
- **Checkout: "Due today" must stay above the fold.** Hard constraint.
- Vendor dashboard: right column 300px, calendar shows the booking week not the month

---

## Out of scope — do not touch

Every other screen and flow: landing below the category row, vendor profile body,
booking request, confirmed, bookings hub, dashboard body, profile editor,
messaging, sign-up, admin, 404/500, checkout decline, validation errors, offline
messaging, the state library, and the tablet/mobile adaptations except where
named in B1 and B4.
