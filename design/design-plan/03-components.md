# 03 — Component vocabulary

Every screen composes from these. If a screen needs something not here, add it
here first — a value chosen inside a page is a second source of truth.

## Buttons

| Variant     | Spec                                                                                     | Use                                                                       |
| ----------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Primary     | `bg-clay-400 text-stone-0 font-semibold text-base px-5 py-2.5 rounded-lg`                | The one action the screen exists for                                      |
| Secondary   | `bg-stone-0 text-stone-900 border border-stone-300 font-semibold px-5 py-2.5 rounded-lg` | The alternative                                                           |
| Ghost       | `text-clay-500 font-semibold`, no fill, no border                                        | "View all →", tertiary actions                                            |
| Ink         | `bg-stone-900 text-stone-50 rounded-full px-4.5 py-2.5`                                  | "Join as a vendor" in the marketing header only                           |
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
[ cover 4:3 ]                                  full-bleed to the card's top corners
  (avatar 34px, circle, 2px stone-0 border, overlapping the seam by 17px)
  Business name                                Instrument Serif 21px
  ★ 4.9 (127) · Austin, TX                     12.5px, rating bold in stone-700
  [Photography] [Free June 14]                 chips: stone-150/stone-700, sage-50/sage-600
  ─────────────────────────────                1px stone-200
  From                     $1,450              12.5px stone-600 / 18px bold ink
```

Availability chip is sage when free on the searched date, gold when scarce
("2 dates left"), absent when no date is in the query.

### Two densities

|         | Search grid (compact)  | Landing / featured      |
| ------- | ---------------------- | ----------------------- |
| Cover   | **132px** fixed height | 4:3                     |
| Padding | 12px                   | 14px                    |
| Name    | 19px Serif             | 21px Serif              |
| Chips   | availability only      | category + availability |

The search grid runs at the compact end so **8 cards fit at 1440 × 900** with the
third row peeking — that number is an acceptance criterion in `11-search.md`, and
it is what the 280px filter rail used to make impossible.

**On the cover's aspect ratio.** Frame `02` draws the compact card's cover as a
fixed-height box while the label inside it reads "cover 4:3". The fixed height
wins for the compact variant — 132px is the value, and the image is cropped to
fill. The 4:3 ratio holds for the landing and featured variants, where the card
is wider and nothing depends on a row height.

**The vendor-profile cover is a different thing** and is specified in
`12-vendor-profile.md`: 21:9, `box-sizing: border-box`, **150px**, with the 72px
avatar entirely below it.

## Inputs

Rest: `bg-stone-150 border border-stone-300 rounded-lg px-3.5 py-2.5 text-base`.
On a white card, the fill goes `stone-0`.
Focus: `border-clay-400` + `ring-3 ring-clay-400/15` — a warm glow, never browser blue.
Label above: 10.5px / 600 / `.05em` / uppercase / `stone-600`.
Helper below: 11.5px `stone-600`; when it names a publish blocker, `gold-600`.
Error: `border-error-500` + `ring-error-500/20`, message below in `error-500`.

Blocking-field variant: `border-gold-400` with a gold helper line — used in the
profile editor so a blocker is visible in the field, in the section nav, and in
the submit bar simultaneously.

## Avatars

Circle, 2px `stone-0` border when overlapping imagery. Initials fallback:
Instrument Serif on `clay-100` (`clay-600` text) or `sage-100` (`sage-600`) —
alternate by hash so a list doesn't read as one colour. Sizes: 30 / 34 / 38 / 64 / 80.

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

Until real photography exists:
`repeating-linear-gradient(135deg, #E6DFD3 0 9px, #EFE9DF 9px 18px)` with a 9px
JetBrains Mono `stone-600` label naming the shot ("cover 4:3", "photographer /
portrait"). Never a hand-drawn illustration, never a stock-photo stand-in.

## Empty states

Muted geometric glyph (`stone-400`, 32px) · Instrument Serif headline ("No
bookings yet") · one `stone-700` sentence saying what will appear here · one
primary CTA. Never a blank pane.

## Loading

- **Element**: 16px spinner, 2px `clay-400` ring with a transparent quarter. Button text dims to 60%.
- **Content**: skeletons, always. `bg-stone-200`, shimmer sweep `stone-200 → stone-150 → stone-200`, 1.5s. One variant per content type, mirroring real dimensions. Minimum 200ms so fast loads don't flash.
- **Page**: wordmark in Instrument Serif `clay-500`, opacity pulse 0.4→1→0.4 over 2s. First load and auth redirects only.

Never a spinner and a skeleton on the same screen.

## Toasts

Bottom-right, `bg-stone-0`, `shadow-xl`, `rounded-xl`, 4px left accent by type
(sage success, steel info, error). Auto-dismiss 5s, manual close. Slide up, fade out.
