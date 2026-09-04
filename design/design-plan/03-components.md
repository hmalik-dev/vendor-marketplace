# 03 — Component vocabulary

Every screen composes from these. If a screen needs something not here, add it
here first — a value chosen inside a page is a second source of truth.

## Buttons

| Variant     | Spec                                                                                     | Use                                                                       |
| ----------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Primary     | `bg-clay-400 text-stone-0 font-semibold text-base px-5 py-2.5 rounded-lg`                | The one action the screen exists for                                      |
| Secondary   | `bg-stone-0 text-stone-900 border border-stone-300 font-semibold px-5 py-2.5 rounded-lg` | The alternative                                                           |
| Ghost       | `text-clay-500 font-semibold`, no fill, no border                                        | "View all →", tertiary actions                                            |
| Ink         | `bg-stone-900 text-stone-50 rounded-full px-4.5 py-2.5`                                  | "Sign up" in the marketing header only                                    |
| Destructive | `bg-error-500 text-stone-0`                                                              | Irreversible only; always behind an AlertDialog; never the primary action |

Hover: primary → `clay-500` + `scale(1.02)`; secondary → `bg-stone-150`; ghost →
`clay-600` + underline. Active: `scale(.98)`.

Copy is imperative and specific, 2–4 words: "Request booking", "Send a message",
"Save changes", "Send revised quote". Never "Submit", never bare "Continue".

## Status pills

`text-xs font-bold tracking-[.07em] uppercase px-2.5 py-1.5 rounded-full`

| Status                      | Background  | Text        | Means                      |
| --------------------------- | ----------- | ----------- | -------------------------- |
| PENDING / NEW               | `gold-50`   | `gold-600`  | waiting on the other party |
| QUOTED                      | `steel-50`  | `steel-600` | vendor sent a number       |
| NEEDS YOU                   | `clay-100`  | `clay-600`  | waiting on _this_ user     |
| CONFIRMED / LIVE            | `sage-50`   | `sage-600`  | settled                    |
| COMPLETED                   | `sage-100`  | `sage-600`  | done                       |
| DECLINED / PAUSED / EXPIRED | `stone-200` | `stone-600` | inert                      |
| CANCELLED / FLAGGED         | `error-50`  | `error-500` | went wrong                 |

## Vendor card

`rounded-2xl bg-stone-0 shadow-sm`, no border. Hover: `shadow-hover` +
`translateY(-2px)`; cover `scale(1.03)`.

```
[ cover 3:2 ]                                  full-bleed to the card's top corners
  (avatar 34px, circle, 2px stone-0 border, overlapping the seam by 17px)
  Business name                                Instrument Serif 21px
  ★ 4.9 (127) · Austin, TX                     text-meta 12px, rating bold in stone-700
  [New]                                        chip: stone-150/stone-700 — no availability chip (D16)
  ─────────────────────────────                1px stone-200
  From                     $1,450              text-meta 12px stone-600 / 18px bold ink
```

Both meta lines read **12.5px** here until 2026-08-29. The frames draw them at
12px on `02` and `04`, and `04-laws.md` gives the frame precedence, so the plan
was corrected rather than the card (#198). 12.5px is the `14 Adaptations` size,
for tablet and mobile.

**Availability chip — ruled 2026-08-30, D16.** The search results grid draws
**no availability chip at all**. `vendor-search.dao.ts` filters a dated query on
availability, so every card that survives one is free on that date by
construction and a chip saying so is a tautology — the DAO's own comment says as
much. The sage chip survives in exactly one place: the **"free on a nearby date
instead" band** that closes frame `18 Search no results`, where it names a
_different_ date than the one searched (`nearby-dates-band.tsx` passes
`nearestAvailableDate`) and is the only thing that unsticks a dead-end query.

The **gold "scarce" chip is dropped from MVP.** This file said "gold when scarce
("2 dates left")" and never defined scarce — free dates in what window, below
what number — and that threshold is an invented number, which the
no-invented-numbers rule forbids. **Both chips came off the frames in the
2026-08-30 drop.** Sage left the six result cards on `02`, the four on
`27 Search results — 1024`, and both editor preview cards on `09`, which mirror
them. Gold left `02` (line 294) and `27` (315). On the two `18` frames (1722, 1744) the gold chip did not disappear — it became the sage nearby-date form and
now reads `Free Jun 18`, a date other than the one searched.

**New chip.** The stone chip (`#F0EAE1` / `#4A443C`, literal `New`, frame `02`
line 297) is **not** an availability state — frame `02` puts it on a vendor
already showing ★ 5.0 (17). It is a _joined recently_ badge: a vendor published
within the last 30 days. With the sage and gold chips gone from the grid, it is
the only chip a search card carries. Frame `02` keeps it on `Wildbloom Films`
alone.

**The profile header keeps its sage chip, and does not inherit it.**
`03 Vendor profile` is not a filtered result — a visitor reaches it from a link,
a message or a bookmark as often as from a dated search — so `Free Jun 14` there
is information the page owes them rather than a restatement of a query they
already made. Sage therefore survives in exactly two places: that header, and the
nearby-dates band on `18`. See `12-vendor-profile.md`.

### Two densities

|         | Search grid (compact) | Landing / featured  |
| ------- | --------------------- | ------------------- |
| Cover   | `aspect-ratio: 3/2`   | `aspect-ratio: 3/2` |
| Padding | 12px                  | 14px                |
| Name    | 19px Serif            | 21px Serif          |
| Chips   | `New` only            | category + `New`    |

The search grid runs at the compact end so **8 cards fit at 1440 × 900** with the
third row peeking — that number is an acceptance criterion in `11-search.md`, and
it is what the 280px filter rail used to make impossible.

**On the cover's aspect ratio.** Every vendor-card cover declares
**`aspect-ratio: 3/2`** and never a fixed height — frames `02`, `14`, `18` and
`27 Search results — 1024` all label it "cover 3:2", and the markup declares the
ratio directly. A fixed height against a fluid card width crops the same vendor's
photo differently at every breakpoint, which a vendor cannot design a cover
against; 3:2 is also the native ratio of essentially every camera, so an uploaded
portfolio image needs no re-crop. The cover height therefore _follows_ the column
width: 4 columns at 1440 and 3 at 1024 both land near 207px. See the card-covers
rule in `30-responsive.md`.

**The vendor-profile banner is a different thing** and is specified in
`12-vendor-profile.md`: a full-bleed **196px** banner that the **82px** avatar
deliberately overlaps.

## Inputs

Rest: `bg-stone-150 border border-stone-300 rounded-lg px-3.5 py-2.5 text-base`.
On a white card, the fill goes `stone-0`.
Focus: **three mechanisms, chosen by what the element already has** — never mixed.

| Element                                         | Focus treatment                                                   |
| ----------------------------------------------- | ----------------------------------------------------------------- |
| Standalone bordered field                       | `border-clay-400` + `ring-3 ring-clay-400/15`, **no offset**      |
| Segment inside a joined bar or panel            | `bg-stone-200` fill + clay label. **No border, edge or outline.** |
| Unbordered control (button, link, avatar, card) | `ring-2 ring-clay-400/40` + `ring-offset-2`                       |

This resolves the old conflict with `04-laws.md`, which specified the offset ring
for everything. A bordered field already has an edge to darken — giving it a
detached ring as well reads as browser chrome. Three further laws:

- **`:focus-visible` only.** A mouse click on a field must not flash a ring.
- **A focus indicator never has a radius the element doesn't have.** A pill ring
  around a square segment reads as a balloon floating over the surface.
- **Never a native `date`, `time` or `select`.** They bring their own selection
  colour and OS glyphs — three palettes in one field.

Hover: fill one step deeper (`stone-100` on bar segments), border one step darker
on standalone fields. Hover is not focus and never borrows its colour.
Label above: 10.5px / 600 / `.05em` / uppercase / `stone-600`.
Helper below: 11.5px `stone-600`; when it names a publish blocker, `gold-600`.
Error: `border-error-500` + `ring-error-500/20`, message below in `error-500`.

Blocking-field variant: `border-gold-400` with a gold helper line — used in the
profile editor so a blocker is visible in the field, in the section nav, and in
the submit bar simultaneously.

## Avatars

Circle, 2px `stone-0` border when overlapping imagery. Initials fallback:
Instrument Serif on **`clay-150`** (`clay-600` text) or `sage-100` (`sage-600`) —
alternate by hash so a list doesn't read as one colour. Sizes: 30 / 34 / 38 / 64 / 80.

**`clay-150` is new, ruled 2026-08-30 (D17).** The frames draw the clay avatar
fill as `#EADCCB` at **42 sites across 20 frames**, and the ramp had no step for
it — `clay-100` (`#F7E7E0`) is far paler. The sage pair was already exact
(`#E4E9DE` / `#4B5940`) and the clay initials were already exact (`#8E3F20`), so
the fill was the only thing off-token. Same class of finding as #306's
`#C4D6A8` / `#5C4A18`: **the ramp was incomplete, not the frame wrong.**
`sage-150` and `stone-150` were the naming precedent.

## Sidebar nav

240px, `bg-stone-0`, 1px `stone-300` right border. Items `px-3 py-2.5 rounded-[9px]`
13.5px / 500. Active: `bg-clay-100 text-clay-600 font-semibold` + `inset 3px 0 0 clay-400`.
Counts right-aligned in `stone-600`; urgent counts become a `clay-400` pill with
white text. Unread is a 7px `clay-400` dot.

## Rails

Always `bg-stone-0` with a 1px `stone-300` inner border, 18–20px padding, and a
10.5px uppercase `stone-600` section label at the top of each block. A rail never
scrolls the page; if its content overflows, the rail scrolls internally.

## Placeholder imagery

**The labelled placeholder is a build-time device, not a live empty state.**
Ruled 2026-08-30 (D17). It stands in for photography the _product_ does not have
yet — in frames, and in seeded demo rows before launch. **A real published vendor
who has not uploaded a cover never sees it, and neither do their customers**: that
is an empty state, and it is specified in `40-states.md`. The hatch reads as an
unfinished product rather than an unfinished profile, and it is shown to the
wrong audience.

Until real photography exists:
`repeating-linear-gradient(135deg, #E6DFD3 0 9px, #EFE9DF 9px 18px)` with a 9px
JetBrains Mono `stone-600` label naming the shot ("cover 3:2", "photographer /
portrait"). Never a hand-drawn illustration, never a stock-photo stand-in.

**Frame `26 State library` draws the pair** as of the 2026-08-30 drop: the live
coverless block on the left, the hatch on the right under the heading _never on a
public page_. The two sit side by side because the mistake this rule prevents is
confusing one for the other.

## Empty states

Muted geometric glyph (`stone-400`, 32px) · Instrument Serif headline ("No
bookings yet") · one `stone-700` sentence saying what will appear here · one
primary CTA. Never a blank pane.

## Loading

- **Element**: 16px spinner, 2px `clay-400` ring with a transparent quarter. Button text dims to 60%.
- **Content**: skeletons, always. `bg-stone-200`, shimmer sweep `stone-200 → stone-100 → stone-200`, 1.5s linear. One variant per content type, mirroring real dimensions — **the component's, not a frame's**, since a loading frame and its loaded sibling can disagree (see #386). Minimum 200ms so fast loads don't flash.
- **Page**: wordmark in Instrument Serif `clay-500`, opacity pulse 0.4→1→0.4 over 2s. First load and auth redirects only.

Never a spinner and a skeleton on the same screen.

## Toasts

Bottom-right, `bg-stone-0`, `shadow-xl`, `rounded-xl`, 4px left accent by type
(sage success, steel info, error). Auto-dismiss 5s, manual close. Slide up, fade out.
