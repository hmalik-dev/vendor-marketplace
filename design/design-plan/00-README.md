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
| `30-responsive.md`     | How every screen degrades to 1280 / 1024 / 768 / 390. **1024 × 640 is a standard design viewport** with its own drawn frames in section 27.                             |
| `31-content-voice.md`  | Copywriting rules and the real strings used in the mockups.                                                                                                             |
| `40`–`42`              | Cross-screen specs: error/loading/empty states, film and audio, and the shared dropdown and picker component.                                                           |
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

## Routes with no frame — ruled 2026-08-30 (#80 via #306)

Parity is unprovable on a route with no frame, so every live route is either
drawn or **recorded here as deliberately unframed, with the reason**. Undecided
is not an outcome.

**The count in #80 was stale.** It named five; the tree has **nine**, because
four routes were added after the 2026-08-28 mapping and nothing forced the ledger
forward. That is the actual finding — not which five.

| Route                     | Ruling                                                                                                                                                                                                |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/sign-in`                | **Exempt.** The form is Clerk-hosted and we do not control its markup. The surface around it — the marketing panel — **is** framed, by `12 Sign up`, and that panel is on the parity gate.            |
| `/suspended`              | **Exempt for now.** A dead end for a banned account, reached by no navigation. `#15` owns the admin tooling behind suspensions and draws it then.                                                     |
| `/vendor/packages`        | **Framed, as a tab.** Drawn inside `09 Vendor profile editor`. The app split the tab into a route; that split is a composition question for `#79`, not a missing frame.                               |
| `/vendor/portfolio`       | **Framed.** `24 Image upload` and `25 Upload failures` both draw it. The ledger says both things — rows 36–37 map the frames, finding `S-2` calls it unframed — and the rows are right.               |
| `/customer/profile`       | **Needs a frame.** A four-tab surface with an editable form, booking history and the customer's own reviews, and no drawing anywhere. It has already produced defects that a frame would have caught. |
| `/bookings/[requestId]`   | **Needs a frame.** The customer's quote-review screen, added by `#308`.                                                                                                                               |
| `/vendor/bookings`        | **Needs a frame.** Added by `#307`; the one surface that prints a customer's contact details.                                                                                                         |
| `/vendor/payments`        | **Needs a frame.** Stripe Connect payout onboarding, added by `#9`.                                                                                                                                   |
| `/vendor/payments/return` | **Exempt.** A redirect landing that exists for the length of one round trip and renders nothing a person reads for longer.                                                                            |

Four exempt, four to draw, one already framed and mis-recorded.

**The reverse gap is real too and is not a defect:** frames `05 Checkout`,
`06 Booking confirmed` and `21 Checkout declined` have no route yet, because the
payment lifecycle is `#10`. `13 Admin` has no route because that is `#15`.

**What stops this recurring is a test, not this table.** A route added after a
mapping is exactly how the count went from five to nine with nobody noticing.
`#80`'s own acceptance asks for it: enumerate `apps/web/src/app/**/page.tsx` and
assert each route appears in the parity ledger with either a frame or a recorded
exemption. That is code, which `#306` does not write — **filed as `#319`.**

## Non-negotiables

- **Desktop-first.** Every layout is designed at 1440 × 900. Narrower viewports are adaptations, never the source of truth.
- **App surfaces do not scroll the page.** The shell fills the viewport; panes scroll inside it.
- **Clay is a fill, not a text colour.** `#B4552F` behind white text; `#A34A28` for clay text on cream. This is an accessibility rule, not a preference.
- **Colour is a signal.** Clay = _you can act here_. Sage = _settled_. Gold = _waiting on someone_. Steel = _information_. Never spend clay on decoration.
- **No invented numbers.** If a stat isn't in the database, it isn't on the page.
- **Photography is the content.** Placeholders in the mockups are labelled; the real thing is vendor work, and the platform is the frame.
