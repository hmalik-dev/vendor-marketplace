# Design Plan — Event Vendor Marketplace

Implementation-ready design specification. Generated from the approved visual
direction (working name **Orla**) and the twelve-screen mockup set.

## Brand name is not final

The name is still being decided (`orla.com` is taken). **Every surface reads the
brand name from one constant** — never hardcode it in a component.

```ts
// packages/shared/src/constants/brand.ts
export const BRAND_NAME = 'Orla'; // <- the only place the name lives
export const BRAND_DOMAIN = 'orla.com';
```

Used by: header wordmark, footer, page `<title>`, auth panel, transactional
email, the `/vendors/[slug]` profile-link preview, and the full-page loading
state. A grep for a literal brand string in `apps/web/src` should return zero
hits outside `brand.ts`.

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
| `30-responsive.md`     | How every screen degrades to 1280 / 1024 / 768 / 390. **1024 × 640 is a standard design viewport** with its own drawn frames in section 25.                             |
| `31-content-voice.md`  | Copywriting rules and the real strings used in the mockups.                                                                                                             |
| `98-post-mvp.md`       | **Everything deliberately deferred, with the condition that unblocks each.** Read before adding anything not in a screen file.                                          |
| `99-open-questions.md` | Unresolved design decisions, plus resolved ones with their reasoning.                                                                                                   |

## Build order

1. `01-foundations.md` — tokens into `packages/config/tailwind/theme.css`, shadcn slots into `globals.css`.
2. `02` + `03` — logo component and the shared component set.
3. `10-landing`, `11-search`, `12-vendor-profile` — the public trio; they exercise most of the component set.
4. `13`–`15` — the booking funnel (request → checkout → confirmed).
5. `16`–`19` — vendor surfaces (dashboard, editor, availability, messaging).
6. `20`–`22` — customer dashboard, sign up, admin.
7. `30-responsive.md` last, per screen, after each desktop layout passes its checklist.

## MVP vs Post-MVP

Everything in `10`–`22` is **MVP** unless a section says otherwise. Two things
were cut deliberately and are recorded in `98-post-mvp.md`:

- **No platform statistics on public pages.** The app is new; it has no vendor count, no "events booked", no average rating worth publishing. Public surfaces prove themselves with mechanism (real availability, payment held until the event, no service fee). Metric marketing returns when the numbers are real — the unblock condition is written down.
- **No Event entity.** There is no way to create an event in MVP, so no screen may assume one. Bookings group by month, derived from their dates; occasion and venue are free-text fields on the booking. "Still to book" was removed as an invalid concept.
- **Search is category + city + date, not a text query.** Three pickers, URL-addressable. Name search is a secondary affordance for the referral case.

Rule that outlives both: **every number on a public page is read from the
database at request time, or it does not ship.**

## Non-negotiables

- **Desktop-first.** Every layout is designed at 1440 × 900. Narrower viewports are adaptations, never the source of truth.
- **App surfaces do not scroll the page.** The shell fills the viewport; panes scroll inside it.
- **Clay is a fill, not a text colour.** `#B4552F` behind white text; `#A34A28` for clay text on cream. This is an accessibility rule, not a preference.
- **Colour is a signal.** Clay = _you can act here_. Sage = _settled_. Gold = _waiting on someone_. Steel = _information_. Never spend clay on decoration.
- **No invented numbers.** If a stat isn't in the database, it isn't on the page.
- **Photography is the content.** Placeholders in the mockups are labelled; the real thing is vendor work, and the platform is the frame.
