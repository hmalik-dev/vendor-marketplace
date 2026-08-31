# 11 — Search (`/search`) — **MVP**

**Purpose:** the core discovery surface.
**Shell:** `app-shell` — the page does not scroll. The results grid scrolls in its own pane.

## The query is three inputs

```
Vendor type ▾   |   City   |   Event date   |   [ Search ]
```

Nobody arrives knowing a vendor's name — they arrive knowing **what kind of vendor,
where, and when**. Those three values are the entire query, and each is
constrained, so a search can only ever resolve to something the platform
recognises.

| Input           | Control                                      | Normalisation                                                                                                                                                                                                                                     |
| --------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Vendor type** | Select / combobox over the eleven categories | **Cannot hold an unrecognised value.** Typing filters the list; a non-matching string shows "No matching type" plus the three closest categories. It resolves to a category id or the field stays empty — never free text.                        |
| **City**        | Typeahead over live markets                  | Resolves to a market id. Unmatched input returns the nearest market plus a "we're not in [city] yet" state. A market is the pair `city` + two-letter state code, written `Austin, TX`; one place is one option, never two spellings of one place. |
| **Event date**  | Single date picker                           | Optional. When set, results are **filtered** to vendors free on it — the cards carry no availability chip, because surviving the filter is the answer (D16).                                                                                      |

### Why the type field is a select, not a search box

A text query has to guess intent from strings like "wedding photographer near me"
or "someone to do flowers", and it fails silently and differently for each. A
select can't be phrased wrong, it teaches the taxonomy on first use, it makes the
query URL-addressable and cacheable, and it means the result count sentence can
always name the category truthfully.

Free-text search over **vendor names** exists as a separate, deliberately small
affordance — a `clay-500` "Search by name" link beside the bar — for the one real
case: someone was handed a business card or a referral. It is not on the main path.

## The event date cannot be in the past

Availability is only recorded forward, so a past event date asks about a day the
calendar has nothing to say about — and answers it with an empty grid that reads
as "no vendors here".

The rule is shown in the control rather than discovered on submit: the date field
carries a `min` of today, so the browser's own picker greys out every earlier
day. **Today itself is valid** — an event happening today is still bookable.

A date input can still be typed into, so a past value is caught on submit. The
query is held back, the value stays put for the customer to fix, and the field
says what is wrong in the product's voice: _"That date has already passed — pick
today or a later date."_ Nothing is silently corrected; a search the customer did
not ask for is worse than being told the date is wrong. The message is absolutely
positioned, because the compact bar lives inside a 64px header and the hero bar
sits above a fold budget.

A `?date=` carried by a shared or bookmarked link is a different case — a link
sent in March is opened in July. There the date is **dropped**, the rest of the
query runs, and the results say so: the category and city are still a good
question. Only the client can judge this, because "today" is the viewer's local
day; the API validates the date's shape and nothing more.

## The compact bar is the five siblings, not frame `02` — ruled 2026-08-30 (#248 via #306)

Six frames draw the compact header bar. **Five agree and frame `02 Search` is the
outlier**, so the five are the spec:

|             | The five siblings                             | `02 Search`                    |
| ----------- | --------------------------------------------- | ------------------------------ |
| Height      | **fixed** — 42px at 1440, 40px at 1024        | none declared; auto, ≈45px     |
| Padding     | `0 5px 0 18px` (1440) · `0 4px 0 14px` (1024) | `4px 4px 4px 16px`             |
| Border      | `1px solid #E4DDD1` (`stone-300`)             | `1px solid #DDD5C7`            |
| Shadow      | `0 2px 10px rgba(35,32,28,.06)`               | `0 1px 3px rgba(35,32,28,.04)` |
| Submit      | 32px clay **circle**, no label (30px at 1024) | labelled `Search` text pill    |
| Third label | `Date`                                        | `Event date`                   |
| Dividers    | `border-right` on the segment                 | standalone 1px `<div>`s        |

The five are `17 Search loading`, `18 Search no results`, `27 Search results — 1024`,
`27 Search — loading · 1024` and `27 Search — no results · 1024`, and the
`28 Dropdown variants` component tile matches them too (42px, `#E4DDD1`,
`0 2px 10px`) — seven drawings against one.

**This confirms rather than reverses #37 and #57**, which already built the circle
and the fixed height from these frames. `02 Search` is the only screen frame that
was not redrawn when the compact bar was settled, and it is a stale drawing rather
than a competing intent.

**`02 Search` is not edited.** `Orla - Screens.dc.html` stays byte-identical to the
export so the next import diffs cleanly; the divergence is recorded here and
against the source design project. A parity pass on `/search` reads this ruling,
not frame `02`'s header — and **only its header**: everything below the bar in
frame `02` is current and remains the acceptance criterion.

## One control per value

An earlier draft had category selectable in the header bar, a chip strip, _and_ a
rail checkbox group at once — three controls that could disagree. Now:

| Control               | Owns                                        |
| --------------------- | ------------------------------------------- |
| **Header search bar** | The query: vendor type, city, date.         |
| **Refine bar**        | Refinement only: price, rating, tag groups. |
| **"Search by name"**  | The referral case.                          |

**Date never appears as a filter chip.** It's a search input; echoing it in Refine
would be a second control for a value the bar already owns.

## Composition at 1440 — no filter rail

```
header 64px — logo | [ Vendor type ▾ | City | Date | Search ] | by name | account
┌───────────────────────────────────────────────────────────────────────┐
│ REFINE  [$500–$3,200 ▾] [4★ & up ✕] [Languages ▾]                     │ sticky
│         [Cultural ▾] [Dietary ▾]  Clear                    Sort ▾     │
├───────────────────────────────────────────────────────────────────────┤
│ 24 photographers in Austin · free on Sun, Jun 14                      │
│ ┌────┐ ┌────┐ ┌────┐ ┌────┐                                          │
│ └────┘ └────┘ └────┘ └────┘   4 columns                               │ scrolls
│ ┌────┐ ┌────┐ ┌────┐ ┌────┐                                          │
└───────────────────────────────────────────────────────────────────────┘
```

**The 280px filter rail is gone.** It held a permanent column of the viewport for
controls touched once or twice per session, and capped results at three across.
Filters are one horizontal **Refine** bar, which returns the full width to what the
page is for: **8 vendors instead of 3**, four across — a full first row, with the
second row's cards carrying their price row above the fold and their bottom edge
just past it, which is what signals there's more.

> **Corrected 2026-08-27, after the 3:2 cover import.** This budget previously
> read "two full rows with the third peeking". That was written against the old
> 132px cover and is arithmetically impossible at 3:2: at 1440 the cards are
> 335px wide, so a cover is 223px and a card 357px, and two rows plus the chrome
> above them come to roughly 911px. **Frame `02 Search` does not achieve it
> either** — measured in a browser, its second row ends at 943px inside a 902px
> frame, clipped by the frame's own `overflow: hidden`. The frame is the
> acceptance criterion, so the budget is corrected to what the frame draws
> rather than the code being bent to a number the design no longer meets.

This is the one place the "a persistent rail beats a modal" law in `04-laws.md`
yields — a rail earns its width when its contents are referenced _while_ working in
the main pane (the booking rail, the vendor checklist, the messaging context).
Search filters aren't: you set them, then you read results.

Grid: **3 columns at 1024–1439** (310px cards, 3:2 cover 207px tall — frame
`27 Search results — 1024`), **4 at ≥1440**, 5 at ≥1728. Two columns belong to
768, not to 1024.

## Refine bar

One row, wrapping to two if needed, prefixed by a `REFINE` micro-label so it
reads as secondary to the query above it. Each chip is a dropdown trigger:

| Chip                                   | Behaviour                                                   |
| -------------------------------------- | ----------------------------------------------------------- |
| `$500 – $3,200 ▾`                      | Dual-handle range popover; the label carries the live range |
| `4★ & up ✕`                            | Active state — `clay-100` fill, `clay-600` text, `✕` clears |
| `Languages ▾` `Cultural ▾` `Dietary ▾` | Multi-select popovers, options in seed `displayOrder`       |
| `Clear`                                | Ghost link, only when a filter is set                       |

Sort sits at the far right of the same row. **An active filter is shown by its own
chip** (filled state + value in the label), so there's no separate active-pill row —
that was a second representation of one state. Facet counts live inside each
popover beside their options.

## Results

Count sentence names category, city and date. Beside it, one quiet positioning
line: "Prices are what they charge — no quotes needed."

Cards per `03-components.md` at the compact end: `aspect-ratio: 3/2` cover, 12px padding,
name at 19px, and **no availability chip** — a dated query is filtered on
availability, so a chip repeating that is a tautology (D16). The one chip a
result card can carry is the stone `New` badge, for a vendor published within the
last 30 days.

**Sort defaults to `Most relevant`** (`sort: 'relevance'`). Ruled 2026-08-30
(D16), because this file had never fixed a default and frame `02` draws
`Top rated ▾`. The frame draws a _chosen_ sort exactly as it draws a chosen price
and a chosen rating, so it is not evidence the default is wrong — and a new
marketplace defaulting to `Top rated` ranks its thinnest review counts first, so
one 5★ review outranks forty. Revisit against real review volume. **Do not
"fix" this by matching the frame.**

## States

- **Loading:** 8 `VendorCardSkeleton` in the live grid; bar and Refine row stay put.
- **Empty:** `SearchX` glyph, "No vendors match your search", the two filters most worth loosening named explicitly, then a fallback row from the same category with the date dropped — an empty result on a date is usually a date problem.
- **No market:** "We're not in Tulsa yet" plus email capture.

## Behaviour

`?category=photography&city=austin-tx&date=2026-06-14` via `nuqs`. All three are
ids, not strings. Shareable, back button works, SWR revalidates.

## Acceptance

- [ ] Three query inputs: vendor type, city, date — no more, no fewer
- [ ] **Vendor type cannot hold an unrecognised value** — it resolves to a category id or stays empty
- [ ] Category is selectable in exactly one control
- [ ] Date does not appear in the Refine bar
- [ ] No filter rail; filters are a horizontal bar
- [ ] 8 cards rendered at 1440 × 900, four across. The **first** row is fully visible, and every second-row card's **price row** is above the fold — assert each first-row card's `getBoundingClientRect().bottom <= innerHeight`, and each second-row card's price row likewise. The second row's bottom edge falls just past the fold, as frame `02` draws it
- [ ] Name search present as the smallest affordance on the screen
- [ ] No separate active-filter pill row
- [ ] Page height exactly one viewport; only the results grid scrolls
- [ ] 4 columns at 1440, 3 at 1280, **3 at 1024** — one full row plus the next row's top edge visible at 640
- [ ] The date picker cannot select a day before today; today is selectable
- [ ] A typed past date holds the search back and is explained, not silently cleared
- [ ] A past `?date=` is dropped, the search still runs, and the customer is told

## Post-MVP

- Saved searches and email alerts for a type + city + date
- Map view alongside the grid
- Semantic search as an _additional_ entry point once there's enough profile text to index — never replacing the select
- "Similar vendors" on an empty result set — needs behavioural data
