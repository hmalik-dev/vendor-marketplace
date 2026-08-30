# Parity + QA Sweep Ledger

Screen-by-screen comparison of every Orla frame against the live local app.
One row per frame. A row is only `PASS` when a `parity-checker` run has
reported all six axes and a click-through found no defect.

**Status values:** `todo` · `in progress` · `PASS` · `FAIL (n)` where n is the
finding count · `blocked` · `n/a`.

> **Design bundle updated twice on 2026-08-28** (20:41 and 20:59), driven by
> `design/design-plan/CHANGE-ORDER-2026-08-28.md`. Frame count 38 → **40**.
> The seven `25 … — 1024` frames were **renumbered `27 …`**; two new frames
> arrived (`28 Dropdown open — hero`, `28 Dropdown variants`); and
> `10 Messaging`, `11 Availability`, `14 Landing mobile`,
> `14 Vendor dashboard mobile` and `26 State library` **changed**.
> `01`, `02`, `03`, `08` and `09` are byte-identical across both merges, so
> batches 1 and 2 stand — **except frame `11`, which must be re-run.**

The frame file is `design/Orla - Screens.dc.html`. Open it directly in the
browser alongside the live screen; compare, never recall.

| # | Frame | Live route | Auth | Viewport | Status | Tickets |
|---|-------|-----------|------|----------|--------|---------|
| 1 | 01 Landing | `/` | guest | 1440x900 | **FAIL (8)** | #82–#89 |
| 2 | 02 Search | `/search` | guest | 1440x900 | **FAIL (13)** | #90–#102 |
| 3 | 03 Vendor profile | `/vendors/june-harlow` | guest | 1440x900 | **FAIL (14)** | #103–#116 |
| 4 | 04 Booking request | `/vendors/june-harlow/request` | customer | 1440x900 | **FAIL (16)** | #192–#193 |
| 5 | 05 Checkout | `/bookings/[requestId]/checkout` | customer | 1440x900 | todo | #9, #10 |
| 6 | 06 Booking confirmed | `/bookings/[requestId]/confirmed` | customer | 1440x900 | todo | #9, #10 |
| 7 | 07 Customer bookings hub | `/bookings` | customer | 1440x900 | **FAIL (24)** | #187–#191 |
| 8 | 08 Vendor dashboard | `/vendor/dashboard` | vendor | 1440x900 | **FAIL (13)** | #124–#136 |
| 9 | 09 Vendor profile editor | `/vendor/profile/edit` | vendor | 1440x900 | **FAIL (16)** | #137–#152 |
| 10 | 10 Messaging | `/messages` | customer | 1440x900 | todo | — |
| 11 | 11 Availability | `/vendor/availability` | vendor | 1440x900 | **re-run done — #153–#164 all closed; still FAIL on the new state model** | #153–#164 done, +#166, new #254–#270 |
| 12 | 12 Sign up | `/sign-up` | guest | 1440x900 | **FAIL (13)** | #194–#197 |
| 13 | 13 Admin | `NO ROUTE — #15` | guest | 1440x900 | n/a | — |
| 14 | 14 Search tablet | `derive from base screen` | guest | 768x1024 | todo | — |
| 15 | 14 Messaging tablet | `derive from base screen` | customer | 768x1024 | todo | — |
| 16 | 14 Landing mobile | `derive from base screen` | guest | 390x844 | todo | — |
| 17 | 14 Search mobile | `derive from base screen` | guest | 390x844 | todo | — |
| 18 | 14 Vendor profile mobile | `derive from base screen` | guest | 390x844 | todo | — |
| 19 | 14 Vendor dashboard mobile | `derive from base screen` | vendor | 390x844 | todo | — |
| 20 | 27 Landing — 1024 | `derive from base screen` | guest | 1024x768 | todo | #169 |
| 21 | 27 Search results — 1024 | `derive from base screen` | guest | 1024x768 | todo | #169 |
| 22 | 27 Checkout — 1024 | `derive from base screen` | customer | 1024x768 | todo | #169 |
| 23 | 27 Vendor dashboard — 1024 | `derive from base screen` | vendor | 1024x768 | todo | #169 |
| 24 | 27 Search — loading · 1024 | `derive from base screen` | guest | 1024x768 | todo | #169 |
| 25 | 27 Search — no results · 1024 | `derive from base screen` | guest | 1024x768 | todo | #169 |
| 26 | 27 Vendor dashboard — empty · 1024 | `derive from base screen` | vendor | 1024x768 | todo | #169 |
| 27 | 15 404 | `/vendors/does-not-exist` | guest | 1440x900 | todo | — |
| 28 | 16 Server error | `force a 500` | guest | 1440x900 | todo | — |
| 29 | 17 Search loading | `/search (throttled)` | guest | 1440x900 | todo | — |
| 30 | 18 Search no results | `/search?name=zzzz` | guest | 1440x900 | todo | — |
| 31 | 19 Bookings hub empty | `/bookings (empty acct)` | guest | 1440x900 | todo | — |
| 32 | 20 Vendor dashboard empty | `/vendor/dashboard` | vendor | 1440x900 | todo | — |
| 33 | 21 Checkout declined | `/bookings/[requestId]/checkout` (declined state, same route) | customer | 1440x900 | todo | #9, #10 |
| 34 | 22 Booking request errors | `request (invalid submit)` | customer | 1440x900 | todo | — |
| 35 | 23 Messaging offline | `/messages (offline)` | customer | 1440x900 | todo | — |
| 36 | 24 Image upload | `/vendor/portfolio` | vendor | 1440x900 | todo | — |
| 37 | 25 Upload failures | `/vendor/portfolio` | vendor | 1440x900 | todo | — |
| 38 | 26 State library | `components, not a screen` | guest | 1440x900 | n/a | — |
| 39 | 28 Dropdown open — hero | `/ (hero search)` | guest | 1440x900 | todo | #167 |
| 40 | 28 Dropdown variants | `all select surfaces` | guest | 1440x900 | todo | #167 |

## Findings log

Every defect found during the sweep, newest last. Promote each to the ticket
board in `.claude/plans/vendor-marketplace-tickets.md` once triaged.

### Pass 1 — guest, `/` `/search` `/vendors/[slug]` (18 findings)

| ID | Sev | Finding |
|----|-----|---------|
| P1-1 | HIGH | SSR **500** on any unparseable `?date` — `not-a-date`, `2026-13-45`, `0000-00-00`, and a valid ISO *timestamp*. `RangeError: Invalid time value`, `search-shell.tsx:271` |
| P1-2 | HIGH | SSR **500 instead of 404** on a bad vendor slug — `/vendors/JUNE-HARLOW` (uppercase alone). API 400 never converted to `notFound()`. Same for `<script>`, `%00`, traversal, 300-char |
| P1-3 | HIGH | **Focus ring invisible on every vendor card** — outward ring on an element exactly filling an `overflow:hidden` parent, 100% clipped. Landing + search |
| P1-4 | HIGH | **Languages filter unreachable at 1024x768** — panel 719px at y=113 → bottom 832 in a 768 viewport; `overflow:visible`, `max-height:none`, page cannot scroll |
| P1-5 | MED | Landing popover floats **over** the sticky header after scroll; header links unclickable (`elementFromPoint` returns a popover option) |
| P1-6 | MED | `/search?page=2` renders a blank pane while `h1` claims "17 vendors" |
| P1-7 | MED | Raw API string `"Request validation failed"` shown as user copy, no action, under a heading claiming success |
| P1-8 | MED | 600-char city query → **5386px-wide `h1`** in a 1440px viewport (invisible to `scrollWidth`) |
| P1-9 | MED | Empty state names a **"style" filter that does not exist** (Languages, Cultural, Dietary) |
| P1-10 | MED | Name no-results claims "No vendors listed yet" (false), blames untouched filters, **no CTA, no clear** |
| P1-11 | MED | Vendor name over cover photo, 11px band, no scrim → **filed #65** |
| P1-12 | MED | Two filter bars, **opposite commit semantics** on one screen; staged filter shows selected label over contradicting results |
| P1-13 | LOW | Profile tabs use history `replace` — one Back skips the whole page |
| P1-14 | LOW | Signed-out 500 page offers "Go to my bookings" |
| P1-15 | LOW | "From $X" shows top of range once a package is selected |
| P1-16 | LOW | "Austin, TX" vs "Austin, Texas" in one grid |
| P1-17 | LOW | Tablist is not a roving tabstop |
| P1-18 | LOW | Portfolio tab: one 192x142 thumbnail in an 800px column |

### Pass 2 — customer, booking journey, 4 viewports (23 findings)

| ID | Sev | Finding |
|----|-----|---------|
| P2-H1 | HIGH | **`POST /booking-requests` has no idempotency** — 3 clicks in one tick created **3 real bookings** (3x201). UI guard unmounts the button so a physical double-click is safe, but nothing server-side dedupes. No withdraw route, so all 3 sit in the vendor queue |
| P2-H2 | HIGH | `?minPriceCents=2147483648` → **500 + raw "Internal server error"** to the user, no recovery action. Exactly the int4 boundary; Zod bounds below but not above. Chip renders `$21,474,836.48 – $10,000+` |
| P2-H3 | HIGH | Languages popover **unreachable at 1024 (clipped below) and 390 (flips to y=-77, clipped above)**. Real clicks time out; URL never changes |
| P2-H4 | HIGH | Below 768px `/messages` shows **one thread with no way to reach the others** — list is `max-md:hidden`, no back button, no switcher |
| P2-H5 | HIGH | Notifications panel renders at **x = -80** at 390x844 — title reads "ons", body cut; the held date is the part clipped off |
| P2-H6 | HIGH | Message bubbles **do not break long tokens** — a 160-char share URL overflows its bubble; 5000 chars → 54,116px scroller. `overflow-wrap: normal`. Pasting a gallery link is the most likely message in this product |
| P2-M1 | MED | **Escape dismisses neither** the Filters drawer nor the Notifications panel. Drawer has no `role="dialog"`, no focus trap, no in-panel close |
| P2-M2 | MED | `/customer/profile` City >100 chars → bare **`Invalid input`** at the submit bar, no field named, no counter, no `maxlength` — while the same form has an exemplary guest-range message |
| P2-M3 | MED | **No upper bound on event date** — a booking for **9999-12-31** goes through end to end; search then claims 17 vendors free 7,973 years out |
| P2-M4 | MED | Vendor name overlaps cover photo by 11px at all four viewports (same class as #65) |
| P2-M5 | MED | **An accepted, priced booking has no route to detail, quote approval, or checkout.** Every card links to the marketing profile. Checkout leg is undrivable |
| P2-M6 | MED | Booking cards show a **permanently blank grey swatch** where the vendor should be identified; imagery exists and is unused |
| P2-M7 | MED | One thread per *vendor*, labelled with one arbitrary booking — a question about the Jun 11 fundraiser lands in a thread titled "Mar 15 birthday" |
| P2-M8 | MED | **Raw ISO date** in notification copy: "`2026-12-19` is held" |
| P2-L1..L9 | LOW | "From" qualifier after package select · State accepts `ZZZZZZZZZZ` · past-date still fires a 400 · `h1` accessible text runs on ("17 vendorsfree on…") · **auth redirects lose the return URL** · composer has no limit, grows to 907px · rail `aria-label` mismatches its content · TX/Texas · stale `?package=` id silently falls back |

**State left behind by pass 2:** 8 booking requests on the customer account (3 duplicate
Wren & Field Mar 15 from H1, plus Apr 20, May 22 x2, Jun 11, and a June Harlow **Dec 31 9999**),
and 2 messages in the Wren & Field thread. There is no customer-side withdraw, so the agent
could not clean up. Worth clearing before any demo.

### Static findings (no browser)

| ID | Sev | Finding |
|----|-----|---------|
| S-1 | MED | **Vendor nav diverges from frame 08.** Frame: `Dashboard, Requests, Bookings, Messages, Availability, Packages, Edit profile, Payments`. App (`vendor-nav.tsx:23-27`): `Dashboard, Business profile, Packages, Portfolio, Availability`. **"Edit profile" vs "Business profile" is a text-axis failure**; order is a layout-axis failure. Missing items may be MVP scope; the labels are not |
| S-2 | MED | ~~**Five live routes have no frame**, so parity is unprovable: `/customer/profile`, `/sign-in`, `/suspended`, `/vendor/packages`, `/vendor/portfolio`.~~ **STALE — corrected 2026-08-30 (#306, #319).** `/vendor/portfolio` **is** framed (rows 36-37 above, `24 Image upload` / `25 Upload failures`) — this finding and that mapping were the self-contradiction #319 was filed to stop recurring. The count itself was also stale: nine routes had no frame by the time #306 ruled on it, not five, because four more (`/bookings/[requestId]`, `/vendor/bookings`, `/vendor/payments`, `/vendor/payments/return`) landed afterward. The current, current-checked ruling for every one of them lives in `design/design-plan/00-README.md` under "Routes with no frame," and `route-parity-ledger.test.ts` now fails the build if a route ever again has neither a frame here nor a ruling there. (Packages/Portfolio exist as tabs inside frame 09 — the app split them into routes, itself a composition divergence) |
| S-3 | MED | **`DrizzleQueryError` is logged without its `cause`** — the actual Postgres error is discarded, so the failures seen during pass 2 cannot be diagnosed. `async-and-errors` class |
| S-4 | LOW | Commit `b1b8e7c "chore: Reconcile the ticket tracker"` swept 28 lines of unrelated in-progress work from a concurrent session into a mislabeled commit, already pushed to `main` |


### Parity batch 1 — frames 01, 02, 03 vs live, six axes, 1440x900 (35 failures)

**BLOCKING CONFLICT — needs a human ruling before any parity work proceeds.**
The frame sets `line-height: normal` on every sans text node. The app applies the
`01-foundations.md` scale ratios (`text-sm` -> 18.75px, `text-base` -> 21.6px,
`text-xs` -> 15.4px). Every pill, chip, button and card is therefore **3-7px taller
than its frame counterpart** — landing pills 33 vs 29, category cards 164 vs 158,
search chips 35 vs 31, `Request booking` 50 vs 43, profile chip 27 vs 24.

`04-laws.md` precedence says the frame wins and the plan gets corrected. Applied
literally that means stripping the line-height scale out of `01-foundations.md`
and every component built on it. This is a design decision, not an agent's call,
and it currently blocks a clean parity verdict on **every screen in the product**.

#### `01 Landing` — FAIL (8)

| ID | Axis | Expected (frame) | Observed (live) |
|----|------|------------------|-----------------|
| PB1-1 | Style | `All 11 categories ->` plain span 110x16, no padding/radius | `<a>` 134x33, padding 6px 12px, radius 8px |
| PB1-2 | Style | Header `Sign up` pill 82x36 | 86x44 |
| PB1-3 | Style | Hero `Search` button 102x43, padding 13px 28px | 93x44, padding 11px 24px |
| PB1-4 | Font | Hero badge 12px | 11px |
| PB1-5 | Font | Hero `Search` 14px; `All 11 categories` 13px | 13.5px; 12.5px |
| PB1-6 | Font | Category titles `letter-spacing: normal` | `-0.425px` |
| PB1-7 | Text | City field literal `Austin, TX` (frame markup line 96) | placeholder `Anywhere` |
| PB1-8 | Access | Per-segment focus ring `ring-2 clay/0.3 offset-2` | segments suppress their ring; one bar-level `ring-3 clay/0.2 offset-0` — **a keyboard user cannot tell which of Vendor type / City / Event date has focus** |

Also raised, needs a ruling: `How it works` numerals are `clay-200 #EFD8CC` on
`stone-100 #F4F0E8` = **1.20:1**. `aria-hidden`, meaning carried by the step name,
and `10-landing.md:116` explicitly specifies clay-200 — but `04-laws.md` grants no
decorative exemption. Plan-vs-law conflict.

Verified exact: header 1440x64, hero 56/44 grid, search bar 728x58 at 40/353, all
three photo-cluster cards (size, rotation, centre), 6x215 category grid, every
colour token, H1 metrics, scroll 2.82x within the 4x budget, no platform statistic.

#### `02 Search` — FAIL (13)

| ID | Axis | Expected | Observed |
|----|------|----------|----------|
| PB1-9 | Layout | Header padding 26px (logo x=26) | 40px (logo x=40) — header inset differs from the Refine bar and results pane below it |
| PB1-10 | Layout | Header search bar 582x45 | 560x42 |
| PB1-11 | Layout | Refine bar `Price · Rating · **Style** · Languages · Cultural · Dietary` | **`Style` chip absent** |
| PB1-12 | Layout | 4-column grid | 3 columns below 1440 (`lg:grid-cols-3` to `min-[90rem]`) — the frame composition exists only at exactly >=1440 |
| PB1-13 | Style+Text+Access | Header submit: clay pill 81x35, literal text `Search` | **icon-only 32x32** — breaches the 44x44 law AND drops the literal |
| PB1-14 | Style | Header border `#DDD5C7`, shadow `0 1px 3px /.04` | `#E4DDD1`, `0 2px 10px /.06` |
| PB1-15 | Style | Vendor card radius 16px | 18px (`rounded-2xl`) |
| PB1-16 | Style | Card avatar 32x32 + 2px ring (36 outer) | 34x34 outer |
| PB1-17 | Style | Sort chip `bg #FFFDF9`, 1px `#E4DDD1`, radius 8, 92x31 | native `<select>` 148x33 with browser chevron |
| PB1-18 | Colour | Card clay monogram `#EADCCB` | `#F7E7E0` (clay-100) — sage variant matches exactly, only clay is off-token |
| PB1-19 | Font | Card meta 12px uniform `#6B6459` | 11px, rating split to 600 `#4A443C` |
| PB1-20 | Text | `EVENT DATE` | `DATE` |
| PB1-21 | Text | Date `Sun, Jun 14`; City `Austin, TX`; Sort `Top rated` | native `09/19/2026`; raw param `Austin`; `Most relevant` |

**NEW DEFECT — Rating and Price popovers stay open after a value is chosen**, and
the 280x147 panel then occludes the results heading and the first result card.

Verified exact: 4x335 grid with gap 16, pane padding, card top y=181, 3:2 cover,
page never scrolls (app-shell law), active filter chip tokens, availability chips,
**zero contrast failures**, all popovers trap focus and restore it.

#### `03 Vendor profile` — FAIL (14)

The layout axis fails hardest.

| ID | Axis | Expected | Observed |
|----|------|----------|----------|
| PB1-22 | Layout | Full-bleed: main column x=0 w=1020, content 40->992, rail 380px at x=1021..1401 | `mx-auto max-w-7xl px-8` -> **1216px centred, 112px gutters**; main content 112..916 (**804px vs 952px**), rail 948..1328 — **PASS** (#103, 2026-08-29): content 40..992, rail 1020..1400 measured live |
| PB1-23 | Layout | Rail card y=282, level with the avatar row | y=364 — **82px lower**, level with the tab bar — **PASS** (#104, 2026-08-29): rail card top = cover bottom + 20 measured live |
| PB1-24 | Layout | Avatar y=246 (14px cover overlap) | y=226 (34px overlap) — **PASS** (#105, 2026-08-29): overlap 16px measured live; ledger's "14px" corrected to 16px from the rendered frame |
| PB1-25 | Layout | `See all 34 ->` in the `Recent work` header at x=651 | **absent** |
| PB1-26 | Layout+Text | Rail pairs `Event date` + `Guests` above `Package` | **both fields absent** — **PASS** (#107, 2026-08-29): 194.13 + 135.88 with 10px gap, above Package, measured live |
| PB1-27 | Style+Colour | Package control `.inp`: `bg #F1ECE4` (stone-150), h39 | native `<select>` `bg #FFFDF9` (stone-0), h41 — **PASS** (#108, 2026-08-29): bg rgb(241,236,228), padding 10px 13px, h38 measured live; ledger's "h39" corrected to 38 from the rendered frame |
| PB1-28 | Style | Attribute chips radius 6px; portfolio tiles 12px | 8px; 14px — **PASS** (#109, 2026-08-29): chip 6px, tile 12px measured live |
| PB1-29 | Style | `Send a message` enabled `.btnS` | **disabled, opacity .5, pointer-events:none** |
| PB1-30 | Font | Vendor name `letter-spacing: normal`; `Recent work` -0.2px | -0.825px; -0.5px — **PASS** (#111, 2026-08-29): closed by re-measurement after #74/#165/#198 — name `normal`, Recent work `-0.2px` |
| PB1-31 | Text | Rail shows `Free on June 14` | **absent** — **PASS** (#112, 2026-08-29): "Free on December 5" in rgb(75,89,64) 12px/600 on the From row, measured live |
| PB1-32 | Text | Rail price row shows `· 6 hour coverage` | **absent** |
| PB1-33 | Text | `You won't be charged yet — <vendor> confirms the date first.` | prefixed with `Messaging opens shortly.` — copy the frame does not carry — **PASS** (#114, 2026-08-29): exact frame sentence, one line, measured live |
| PB1-34 | Text | Straight quotes | curly `" "` and `'` — **PASS** (#115, 2026-08-29): zero curly characters in rendered text, pull-quote opens U+0022, measured live |
| PB1-35 | Interaction | Signed-out `Request booking` preserves the destination | redirects to `/sign-in` with **no `redirect_url`** (`location.search === ""`) — the booking in progress is lost — **PASS** (#116, 2026-08-29): 307 to /sign-in?redirect_url=<full destination>, measured live signed out; open-redirect vectors rejected |

Also: `Send a message` is dead by design, and the blocker is explained only inside
the shared payment reassurance sentence. `40-states.md` wants the blocker named
next to the control it blocks.

Verified exact: cover 1440x196 at y=64, tab gaps, 3x164 stat grid, 680px portfolio
grid, sticky rail at top:80, rail card and avatar tokens, all type metrics except
the two above, **zero contrast failures**, tabs carry full ARIA, scroll 1.32x.

### Parity batch 2 — frames 08, 09, 11 vs live, vendor account, 1440x900 (41 failures)

**Frame `11 Availability` must be re-run.** The `.dc.html` changed at 20:41 while this batch
was mid-flight, and frame 11 is one of the frames that changed. Its 12 findings are recorded
but carry unknown provenance — they may be measured against the pre-merge frame.
Frames `08` and `09` are byte-identical across the merge, so their results stand.

#### ROOT CAUSE — one rule breaks the font axis on every screen in the product

`apps/web/src/app/globals.css:162-166`

```css
h1, h2, h3 { @apply font-display tracking-tight; }
```

Two consequences, both measured on all three screens:

1. **Any `h2`/`h3` used as a micro-label renders in Instrument Serif** — observed at 10.5px,
   11px and 12.5px. `01-foundations.md` states Instrument Serif is "Never below 16px".
   Hit: the dashboard rail label `Friday, August 28`, the editor's `Languages spoken` /
   `Cultural specialties` / `Dietary` group headings, and the availability rail's
   `SELECTED` / `LEGEND` / `THIS QUARTER` micro-labels.
2. **`tracking-tight` (-0.025em) overrides the frames' `.h2` `letter-spacing: -.01em`**, so
   titles compute `-0.65px` where the frame computes `-0.26px`. The dashboard `h1` escapes
   only because it carries an explicit `tracking-[-.01em]`.

Fixing this one rule clears a font failure on `08`, `09`, `11` and almost certainly on every
other screen in the sweep. Highest-leverage fix found so far.

#### Shared chrome (counted once per frame, described once)

| ID | Axis | Expected (frame) | Observed |
|----|------|------------------|----------|
| PB2-S1 | Text | Header carries a `Vendor` chip (`#EDF0E9` / `#4B5940`, 11px/600/uppercase/.06em, radius 5) | ~~absent on all three screens~~ **PASS 2026-08-29 (#117, `7c9c689`+`53ce575`)** — chip renders for the vendor role only; measured 11px/600/.66px/uppercase, `rgb(75,89,64)` on `rgb(237,240,233)`, radius 5, padding 4px 8px, box **67.3 x 22** against the frame's **67.33 x 22** |
| PB2-S2 | Layout | Header padding `0 32px`, logo 23px | ~~`0 40px`, logo 24px~~ **PASS 2026-08-29 (#118, `668cb0f`)** — padding **32px**, wordmark **23px**. The wordmark ratio was the wrong constant, not a one-frame slip: 1.6 rendered 24px here, 22.4px on mobile and 30.4px on sign-up, where the frames draw 23/21/29 |
| PB2-S3 | Layout | `.side` footprint 265px (240 + 24 padding + 1 border), content column starts x=290 | ~~240px total, content starts x=264~~ **PASS 2026-08-29 (#119, `eb03fb3`+`c33e00d`)** — sidebar **265**, content column **x=265**, first heading **x=289**, dashboard rail **381**, availability rail **341**. One cause: the frames are content-box, Tailwind is border-box |
| PB2-S4 | Access | Focus ring on every interactive element | **PARTLY SELF-CLOSED, then PASS 2026-08-29 (#120, `33e03db`+`16a5426`)** — re-measuring found the `Messages`/`Dashboard` links already correct: a global `:focus-visible` rule landed between the sweep and this lane. Clerk's `Open user menu` had not, and drew a single 4px clay at 50% with no offset ring |
| PB2-S5 | Access | Icon-only controls >=44x44 | ~~28x28 / 36x36 / 36x36 / 36x36~~ **PASS 2026-08-29 (#121, `10d7ee3`+`16a5426`)** — all four measure **44x44**. The button's 36px `icon-sm` variant was the root of three and is retired, not resized: every one of its callers was an icon-only control that could never satisfy the law |
| PB2-S6 | Access | Overlays close on Escape | ~~keeps `aria-expanded="true"` on Escape~~ **PASS 2026-08-29 (#122, `ad0396b`)** — there was no `keydown` handler at all, only a `mousedown` outside-click. Escape now closes it and returns focus to the trigger; driven in the browser |
| PB2-S7 | Text | Dates formatted at the display boundary | **SELF-CLOSED, guarded 2026-08-29 (#123, `c002aae`)** — all three notification bodies already route through `readableDate` (named month, UTC). No production change needed. **Still UNVERIFIED in the browser**: the e2e vendor has zero notification rows, so the panel is empty and proves nothing. Regression guard added and confirmed to go red on the original `${row.eventDate}` |

Console: **zero errors** across all three screens and every interaction.

#### `08 Vendor dashboard` — FAIL (13)

**Data caveat:** the seeded vendor has 0 pending requests, 0 bookings and a published
profile, so the request rows, `Needs you` / `New` pills, `See all 4 ->`, and the **entire
publish-checklist rail** could not be observed. Those remain unverified, not passed.

| ID | Axis | Expected | Observed |
|----|------|----------|----------|
| PB2-1 | Layout | `View my public profile` in the header, 13.5px/500 `#4A443C` | moved into the content column at x=947,y=101, 12.5px/600 `#A34A28` |
| PB2-2 | Layout | Rail 381px footprint / 340px content | 340px / 300px |
| PB2-3 | Layout | Empty request pane (frame `20`): flex-filled panel, `1px dashed #D5CEC2`, radius 18, two-circle glyph, `.btnS` CTA | `flex flex-col items-center gap-3 px-6 py-12` — **no panel, no glyph, no CTA**, ~470px of undrawn space in an 812x594 region |
| PB2-4 | Layout | `See all N ->` beside `Requests waiting on you` | absent from the markup |
| PB2-5 | Style | Stat card radius 12px (frame overrides `.card`'s 16) | 14px |
| PB2-6 | Font | Stat micro-label `.lbl` 10.5px/600/.525px | **11px**/600/.55px (`text-xs`, not the 10.5px micro-label the foundations fix) |
| PB2-7 | Font | Stat delta line 11.5px | 11px |
| PB2-8 | Font | Rail label `Friday, August 28` in Instrument **Sans** 10.5px | `<h2>` in Instrument **Serif** 11px (root cause above) |
| PB2-9 | Font | Empty-state headline 26px serif (`40-states.md`) | 21px (`text-display-sm`) |
| PB2-10 | Font | `h2 Requests waiting on you` letter-spacing normal | `-0.525px` |
| PB2-11 | Text | `Vendor` chip string | absent (PB2-S1) |
| PB2-12 | Text | `See all 4 ->` | absent |
| PB2-13 | Text | A delta line, as the frame's `+2 vs April` | `Bookings this month -> "None in July"` on an **August 28** dashboard — a statement about the wrong month, and not a delta |

Correctly absent: `Median reply time 2h · keep it under 4h to stay ranked` — the recorded
deviation in `16-vendor-dashboard.md`. Verified nothing says "reply", "ranked" or "4h".
Colour: **MATCH**, every fill and text colour resolves to a token. Contrast: **0** nodes
below 4.5:1.

#### `09 Vendor profile editor` — FAIL (16)

| ID | Axis | Expected | Observed |
|----|------|----------|----------|
| PB2-14 | Layout | **Media pair on one row**: `grid-template-columns:158px 1fr; gap:20px` — 128px circle then a 128px-tall 21:9 cover drop zone | `display:block`, a single **160x160** circle with **nothing beside it — the cover image drop zone is missing entirely**. Breaks law 9 and `17-vendor-profile-editor.md` |
| PB2-15 | Layout | Fields as the frame lists them | `Your line` (span-2) and `Years in business` (half) inserted between `Profile link` and `About your business` — in neither the frame nor the plan |
| PB2-16 | Layout | Pane has no section headings | `Business`, `Location & service area` (sr-only 1x1) and a visible serif `Tags` inserted |
| PB2-17 | Layout | Section nav includes `Payouts` | absent (scope-deferrable, but the gold dot is unbuilt) |
| PB2-18 | Layout | Form pane scrolls <=1.5x (`17-vendor-profile-editor.md`) | **1.92x** (`scrollHeight 1487 / clientHeight 774`) |
| PB2-19 | Style | `.inp`: `padding:10px 13px`, bg `#FFFDF9`, ~39px tall | `padding:4px 10px`, **transparent** over `#F8F5EF`, **32px** tall |
| PB2-20 | Style | Photo zone 128x128, `1px dashed #D5CEC2`, hatched placeholder | **160x160**, `2px dashed #EFE9E0` (stone-200 not stone-400), flat fill |
| PB2-21 | Style | Selected chip `1.5px solid #B4552F`, `padding:7px 13px 7px 8px`, 22px `#F3D6C8` icon circle | `1px solid #B4552F`, `padding:6px 16px 6px 6px`; unselected border `#EFE9E0` not `#E4DDD1` |
| PB2-22 | Style | `.btnP` 13.5px/600 `padding:11px 20px` radius 10; `.btnS` `padding:10px 20px` | `Save changes` and `Preview` both 12.5px/600, `padding:6px 12px`, **radius 8**, 33px tall |
| PB2-23 | Style | Service radius: 4px `#EFE9E0` track, 46% `#B4552F` fill, 14px `#FFFDF9` thumb ringed `2px #B4552F` | native `input[type=range]` styled by `accent-color`, 24px tall |
| PB2-24 | Colour | Selected chip label `#8E3F20` | `oklch(0.268 0.007 34.298)` ~ stone-900 |
| PB2-25 | Colour | Field labels `.lbl` `#6B6459` | `rgb(35,32,28)` stone-900 |
| PB2-26 | Font | Field labels 10.5px/600/uppercase/.05em | **12.5px/500/sentence case** |
| PB2-27 | Font | Tag group headings in sans | `<h3>` in **Instrument Serif at 12.5px** (root cause) |
| PB2-28 | Text | `Cover image` label, `cover 21:9 — 1600x686 min` mono placeholder, `Drop an image or browse`; photo zone `portrait` + `Replace`; `Service radius — 60 miles`; slug `orla.com/kessler-co`; `Saved 30 seconds ago` in the submit bar | **all missing**. Photo zone reads `Add photo`; radius value split into a separate span plus an unsourced helper; slug renders `orla.com/vendors/northgate-sound` — the `/vendors/` segment is in neither source; `Saved N ago` exists in **no** state |
| PB2-29 | Text | — | Eight helper strings present with no frame or `31-content-voice.md` source (`One sentence, in your own words.`, `Counted from when you started...`, `1 of 5 chosen.`, `0 / 80`, `57 / 1200`, etc.) |

**The blocker state is a clean MATCH** and worth recording as verified: inducing a missing
response time produced the gold dot `#C99A2E` on the nav row **and** in the submit bar, field
border `#C99A2E`, helper `Required before you can publish`, legend `Gold dots block
publishing`, summary `1 thing left before you can publish — response time`. Three-place
visibility per the plan, and `40-states.md`'s gold-means-waiting semantics both hold.

**Access is otherwise a PASS**: every input has a real `label[for]` association (verified by
id, not appearance), 0 contrast failures, the gold blocker carries text not colour alone.

#### `11 Availability` — FAIL (12) — RE-RUN REQUIRED

The closest of the three; the calendar itself is near-exact.

**Re-run completed 2026-08-29 (lane 153).** The frame was flagged `RE-RUN REQUIRED`
because the 2026-08-28 design merge changed frame `11`. Every value below was
re-derived from scratch: the frame rendered **in situ** from the whole
`Orla - Screens.dc.html` at 1440x900 with `document.fonts.ready` awaited, read off
the `[data-screen-label="11 Availability"]` node, and the live screen measured in
the same browser at the same viewport. **Every frame-side ("Expected") value in
this table re-derived correctly** — the stale-frame worry did not materialise for
these twelve. **No finding was voided by the frame change.** Four are now closed by
re-measurement; the frame change instead produced *new* findings, filed as
**#254–#270**.

The frame's revision is a **state-model** change, not a metric change. It now
draws nine distinct cell states and a seven-row legend in which every swatch
carries the real mark; the app has five states, no `completed` state at all, and
a shape on exactly one of them. That is why the twelve numbers survived while
the screen still fails: nothing the old findings measured moved, and everything
the merge added is new ground. #166 owns the shapes; #254 and #255 own the
missing state and the legend.

One mis-transcription found: **PB2-34 said "36px"; the live buttons are 44x44**
(`size-11`). The 36px `icon-sm` variant was deleted from `button.tsx` precisely
because no caller could make it meet the 44px hit-area law, so 36px could not
have been observed. Corrected in place.

| ID | Axis | Expected | Observed | Re-run verdict |
|----|------|----------|----------|----------------|
| PB2-30 | Layout | Rail 341px footprint / 300px content | 300px / 260px — month columns absorb the 41px (852px content vs 786px; columns 271px vs 248.7px) | **PASS** — live now 341px/300px, months grid 786px, gap 20px, columns 248.656px, identical to frame. Fixed by shared chrome `43ce159` (#153) |
| PB2-31 | Style | Selected panel radius 12 / padding 13 | 14 / 14 | **PASS** — fixed in this lane (#154): panel is now `rounded-[12px] p-[13px]` |
| PB2-32 | Style | Market-note panel radius 12 | 14 | **PASS** — fixed in this lane (#155): now `rounded-[12px]` |
| PB2-33 | Style | `Block these` `padding:8px 14px` | `6px 12px` | **PASS** — fixed in this lane (#156): `px-3.5 py-2` at the call site |
| PB2-34 | Style | Month nav inline glyphs in `#6B6459` at 13px | ~~two 36px circular icon buttons~~ → **two 44x44 icon buttons**, `border-radius:10px`, `color:#A34A28` | **PASS** — fixed in this lane (#157): bare `‹`/`›` at `text-action` / `text-stone-600`, 44x44 target kept via `before:size-11` |
| PB2-35 | Colour | `Clear` `#4A443C` | `#A34A28` | **PASS** — fixed in this lane (#158): `text-stone-700` at the call site |
| PB2-36 | Font | Day cells 12px | **11px** | **PASS** — fixed in this lane (#159): now `text-meta` (12px, line-height normal) |
| PB2-37 | Font | Title letter-spacing -0.26px | -0.65px (root cause) | **PASS** — live now `-0.26px`. Closed by #165 (`8a14155`) |
| PB2-38 | Font | Month names letter-spacing normal | -0.45px | **PASS** — live now `normal`. Closed by #165 (`8a14155`) |
| PB2-39 | Font | Rail micro-labels in Instrument Sans | **Instrument Serif** (root cause) — size/weight/tracking/colour all correct | **PASS** — all three rail labels now Instrument Sans 10.5px/600/0.525px/`#6B6459`/uppercase. Closed by #165 (`8a14155`) |
| PB2-40 | Text | One instruction | **Contradictory copy 40px apart**: rail says `Click a date to select it, or drag across several.` while the pane sub-line says `Click a date to block it...`. Only one is true | **PARTIAL** — contradiction removed in this lane (#163); rail is now a status line. The frame full instruction still cannot ship until the `completed` state exists |
| PB2-41 | Access | Page has an `h1` | **No `<h1>` on the page** — the title is an `h2`, so the document has no top-level heading | **PASS** — fixed in this lane (#164): title is now the page `h1`, rail sections stay `h2` |

Recorded as plan-authorized, do not re-flag: the market note states this vendor's own numbers
rather than the frame's Austin market figure — `19-availability.md` Post-MVP requires exactly
that until real market data exists. **Recommend recording it on the frame** the way
`16-vendor-dashboard.md` records the reply-time omission.

**Verified exact:** legend swatches 18x18 radius 5 with every token colour, day cells radius 7
`padding:7px 0`, available/blocked/selecting/today states all exact, three months across,
rail order, page does not scroll. **Behaviour verified and fully restored:** click-select,
drag-select across the Sep/Oct month boundary, `Block these` (rail recomputed live), then
`Open these up` back to 0 blocked — final state identical to how it was found. No dead
controls. Contrast: the only sub-4.5:1 node is the sanctioned `stone-500` on past days, which
`19-availability.md` names as exactly that exception — **PASS**.
