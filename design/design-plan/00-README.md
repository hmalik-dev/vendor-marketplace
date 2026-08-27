# Design Plan — Event Vendor Marketplace

Implementation-ready design specification, generated from the approved visual
direction and the thirteen-screen mockup set in `../Orla - Screens.dc.html`.

**The rendered frame is the design.** This folder explains it — the values, the
reasoning, and the rules that generalise beyond one screen. Where the two
disagree, **build the frame** and fix the prose. Frame captions are _not_ spec
and one is already stale; see the precedence list in `04-laws.md`. The
implementation is verified against the frames in a real browser before a ticket
is Done.

## Brand name

**Decided: the product is Orla.** The repository, packages and infrastructure keep
the name `vendor-marketplace`; everything a person sees says Orla.

The name still lives in exactly one constant, because it has already moved twice
(VendorHub → VenMatch → Orla):

```ts
// packages/shared/src/constants/brand.ts
export const BRAND_NAME = 'Orla';
export const BRAND_DOMAIN = 'orla.com';
```

Used by: header wordmark, footer, page `<title>`, auth panel, transactional
email, the `/vendors/[slug]` profile-link preview, and the full-page loading
state. A grep for a literal brand string in `apps/web/src` should return zero
hits outside `brand.ts` — today it returns 26, all of them `VenMatch`, and
clearing them is part of the foundation ticket.

**The logo mark is name-agnostic by construction** — two equal circles, no
letterform (see `02-brand-and-logo.md`). Changing the name changes the wordmark
text and nothing else.

## How to use this folder

| File                   | What it covers                                                                                                                                                          |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `01-foundations.md`    | Tokens: colour, type, spacing, radius, shadow, layout variables. Build this first.                                                                                      |
| `02-brand-and-logo.md` | Logo construction, sizes, the brand-name constant.                                                                                                                      |
| `03-components.md`     | The shared component vocabulary every screen composes from.                                                                                                             |
| `04-laws.md`           | Layout laws, scroll budgets, and the review checklist each screen must pass.                                                                                            |
| `10`–`22`              | One file per screen. Each is self-contained and buildable. Every screen file is titled **MVP** and carries a **Post-MVP** section where work was deliberately deferred. |
| `30-responsive.md`     | How every screen degrades to 1280 / 768 / 390.                                                                                                                          |
| `31-content-voice.md`  | Copywriting rules and the real strings used in the mockups.                                                                                                             |
| `98-post-mvp.md`       | **Everything deliberately deferred, with the condition that unblocks each.** Read before adding anything not in a screen file.                                          |
| `99-open-questions.md` | Unresolved design decisions, plus resolved ones with their reasoning.                                                                                                   |

## MVP vs Post-MVP

Everything in `10`–`22` is **MVP** unless a section says otherwise. Three things
were cut deliberately and are recorded in `98-post-mvp.md`:

- **No platform statistics on public pages.** The app is new; it has no vendor count, no "events booked", no average rating worth publishing. Public surfaces prove themselves with mechanism (real availability, payment held until the event, no service fee). Metric marketing returns when the numbers are real — the unblock condition is written down.
- **No Event entity.** There is no way to create an event in MVP, so no screen may assume one. Bookings group by **month**, derived from their dates; occasion and venue are free-text fields on the booking. "Still to book" was removed as an invalid concept.
- **Search is category + city + date, not a text query.** Three enumerable pickers, URL-addressable. The vendor-type field cannot hold an unrecognised value. Name search is a secondary affordance for the referral case.
- **No reply-time claim on any public surface.** A median reply time needs message history the app doesn't have at launch. It survives only as the vendor's own private dashboard metric, which starts empty honestly.
- **No fee language on vendor surfaces, in either direction.** Vendors pay something and the model isn't settled, so no vendor-facing surface makes a claim it might have to walk back. The customer's "no service fee on top" stays; it is not mirrored or negated.

Rule that outlives all of them: **every number on a public page is read from the
database at request time, or it does not ship.**

## Revision of 2026-08-27

Six frames were revised. `CLAUDE-CODE-PROMPT.md` is the revision brief of record.

| Frame                      | Change                                                                                                                                        |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `01 Landing`               | Category-first hero search (`Vendor type` / `City` / `Event date`); "Or jump straight to" + four category pills replaces the "Popular:" links |
| `02 Search & browse`       | 280px filter rail **deleted**; horizontal Refine bar; 4 columns / 8 cards; no category chip strip; "Search by name" link                      |
| `03 Vendor profile`        | Cover 190px → **150px**; avatar 80px → **72px**, moved fully below the cover — no negative-margin overlap                                     |
| `07 Customer bookings hub` | Grouping by named event → **by month**; "All categories ▾" / "Soonest first ▾"; no "My events", no event page                                 |
| `12 Sign up`               | Marketing-panel copy → "See the price. / See the open dates. / _Then decide._" and three new guarantee lines                                  |
| `14 Adaptations`           | Tablet and mobile reflect all of the above                                                                                                    |

Unchanged and still correct: `04 Booking request`, `05 Checkout`,
`06 Booking confirmed`, `08 Vendor dashboard`, `09 Vendor profile editor`,
`10 Messaging`, `11 Availability`, `13 Admin`. Tokens, the logo, the brand
constant and the component vocabulary are unchanged.

## Revision — second pass, 2026-08-27

Three frames were revised again and one was added.

| Frame                           | Change                                                                                                                                                                                      |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `01 Landing`                    | Header carries **two** entry points — **List your services** (text) · divider · **Sign in** · **Sign up** (ink pill); the single "Join as a vendor" pill is gone. Hero vendor chip deleted. |
| `03 Vendor profile`             | "Replies in ~2h" cut from the meta line; About stat tiles four → **three** (Replies tile removed)                                                                                           |
| `12 Sign up`                    | Marketing panel is **role-aware**; this frame is the customer state                                                                                                                         |
| `12b Sign up — vendor selected` | **New.** Vendor state of the same screen: sage accent, "Set your prices. / Set your dates. / _Get booked._", three vendor guarantees, no fee claim                                          |
| `14 Adaptations`                | Mobile header keeps a compact **Sign up** pill beside the hamburger; mobile profile drops its reply-time line                                                                               |

Also resolved: open question 2 (reply-time ranking) — the signal is deferred, so
the vendor dashboard's "keep it under 4h to stay ranked" is softened to a plain
norm rather than a promised mechanic.

Unchanged by this pass: `02`, `04`–`11`, `13`. Tokens gain one value —
`--color-sage-150`, the pale-sage italic accent on the vendor panel's ink ground.

## Non-negotiables

- **Desktop-first.** Every layout is designed at 1440 × 900. Narrower viewports are adaptations, never the source of truth.
- **Parity is 1:1 on five axes** — layout, style, colour, font, **and the literal text**. See the gate in `04-laws.md`.
- **App surfaces do not scroll the page.** The shell fills the viewport; panes scroll inside it.
- **Clay is a fill, not a text colour.** `#B4552F` behind white text; `#A34A28` for clay text on cream. This is an accessibility rule, not a preference.
- **Colour is a signal.** Clay = _you can act here_. Sage = _settled_. Gold = _waiting on someone_. Steel = _information_. Never spend clay on decoration.
- **No invented numbers.** If a stat isn't in the database, it isn't on the page.
- **Photography is the content.** Placeholders in the mockups are labelled; the real thing is vendor work, and the platform is the frame.

## Build order

1. `01-foundations.md` — tokens into `packages/config/tailwind/theme.css`, shadcn slots into `globals.css`.
2. `02` + `03` — logo component and the shared component set.
3. `10-landing`, `11-search`, `12-vendor-profile` — the public trio; they exercise most of the component set.
4. `13`–`15` — the booking funnel (request → checkout → confirmed).
5. `16`–`19` — vendor surfaces (dashboard, editor, availability, messaging).
6. `20`–`22` — customer bookings hub, sign up, admin.
7. `30-responsive.md` last, per screen, after each desktop layout passes its checklist.
