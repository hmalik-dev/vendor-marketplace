# Vendor Marketplace — Ticket Tracker

Local ticket tracker for the vendor-marketplace project. Reference this file when invoking tickets.

**Repo:** `~/Documents/vendor-marketplace` | **Plan:** `.claude/plans/vendor-marketplace-plan.md` | **Decisions:** `.claude/plans/vendor-marketplace-decisions.md`

**MVP is the goal.** Every screen file in `design/design-plan/` is titled **MVP** and
carries a **Post-MVP** section listing what was deliberately deferred. `98-post-mvp.md`
is the deferral register: the before/after for every removed metric, the unblock
condition, and the reasoning. **No ticket may implement anything in a Post-MVP section.**
Anything deferred lives in the Post-MVP Backlog at the foot of this file, with its
unblock condition — not as commented-out code, not as a half-built surface.

**No invented numbers.** Every number on a public page is read from the database at
request time, or it does not ship. In MVP that means **no platform statistics on any
public surface** — no vendor count, no "events booked", no average rating, no median
reply time. Public pages prove themselves with mechanism instead (real availability,
payment held until the event, no service fee, reviews only from bookings that happened).
Still valid in MVP, because they are query results or a vendor's own facts rather than
platform marketing: search result counts, filter facet counts, a vendor's own rating and
reply time on their profile and private dashboard, and real counts in admin.

**Design:** `~/Documents/vendor-marketplace/design/` — `Orla - Screens.dc.html` holds the 1440×900 frames and **is the parity goal**; `design-plan/` explains them. Where the two disagree, build the frame and correct the plan. The blurbs above each frame are not spec — read the markup.

**Design revision — 2026-08-27, second import. Fully landed.** The design project added **twelve frames, `15`–`26`**, covering error, loading and empty states, plus one new spec file, `design/design-plan/40-states.md`. Both are now in this repo: `design/Orla - Screens.dc.html` carries **all 27 frames** (`01`–`26` plus `12b`, the role-chosen sign-up panel) and is byte-exact against the design project, verified by sha256.

**The original fourteen frames did not change** — verified by hashing each frame block in the old file against the new one: `01`–`13`, `12b` and `14`'s screen markup are all byte-identical, and `03-components.md` matches the remote exactly. `support.js` was already current. **The import is therefore purely additive**, and no shipped screen loses its parity status.

`40-states.md` is now a **law**, not a screen file: its colour semantics (steel = information, gold = waiting on someone, red = it failed, sage = settled), its one-idiom-per-screen loading rule, and its three-tier validation model bind every ticket, including ones whose frames predate it. **Red is never used for `pending`; gold is never used for a failure.**

**Status values:** `Backlog` → `In Progress` → `Done`.

Two more are in use and are **not** part of that flow — both mean the ticket cannot
proceed without someone outside this session, and both keep whatever priority they had:

- `Blocked — needs a human` — a defect that cannot be fixed from the repo (a dashboard
  setting, a secret rotation).
- `Deferred — needs a human` — a ticket that cannot start without a credential, an
  external account, or a product decision.

Record the specific thing being waited on in `Blocked By`, not just the status.

**Convention:** Run `pnpm preflight --ticket <n>` first — a ticket does not move to
`In Progress` until the gate passes. Then set `In Progress`, fill in the branch, and set
`Done` after merge to main.

**Design parity is the hard gate — 1:1, on five axes.** The rendered frame in
`design/Orla - Screens.dc.html` is the acceptance criterion; the plan explains it, the
frame defines it. No ticket carrying an Orla screen is `Done` until that screen has been
driven in a real browser with Playwright at 1440×900, screenshotted, and compared against
its frame on **all five** of:

| Axis | Must match |
| --- | --- |
| **Layout** | Composition, column and rail widths, order of every block, what is above the fold, what scrolls |
| **Style** | Radii, borders, shadows, fills, chip and pill shapes, cover heights, avatar sizes |
| **Colour** | Every fill and text colour resolves to the same token value the frame uses — not "close" |
| **Font** | Family, size, weight, letter-spacing, line-height, italics |
| **Text** | **The literal strings** — headings, labels, button copy, helper lines, micro-labels, empty states, count sentences. Same wording, same capitalisation, same punctuation |

Only three things may differ: real content, real data volume, and real photography in
place of the labelled placeholders. A screen that reproduces the frame's content in a
different composition has failed — the composition *is* the design. A screen that
reproduces the composition with reworded copy has failed too — the words are the design.
The full procedure is in `design/design-plan/04-laws.md`; the approved strings are in
`design/design-plan/31-content-voice.md`. Record which frames were verified in the Notes
column.

**Design revision — 2026-08-27.** The design project was re-imported and **six frames
changed**: `01 Landing`, `02 Search & browse`, `03 Vendor profile`,
`07 Customer bookings hub`, `12 Sign up`, and `14 Adaptations`. Eight frames are
untouched: `04`, `05`, `06`, `08`, `09`, `10`, `11`, `13`. Tokens, the logo, `BRAND_NAME`
and the component vocabulary are unchanged. `design/design-plan/CLAUDE-CODE-PROMPT.md` is
the changelog of record; the affected screen specs are already rewritten.

Four product decisions moved:

1. **Search is category-first.** The query is three enumerable inputs — `Vendor type` ▾ / `City` / `Event date`. The vendor-type field is a select that **cannot hold an unrecognised value**. Free-text query on the main path is gone; name search survives as a small `clay-500` link for the referral case.
2. **The 280px search filter rail is deleted.** Filters are a horizontal **Refine** bar; the width goes to results — **8 cards at 1440×900**, four across, instead of three. No category chip strip: category is selectable in exactly one control. The date never appears as a filter chip.
3. **There is no Event entity.** `/bookings` groups by **month derived from the booking date**. No `/events` route, no "My events" nav item, no "New event" CTA, no event foreign key. Occasion and venue are free-text fields on the booking.
4. ~~**Vendor-profile header no longer overlaps.** Cover 190px → **150px**; avatar 80px → **72px**, sitting fully below the cover.~~ **SUPERSEDED by the 2026-08-27 import** — frame `03 Vendor profile` reinstates the overlap (banner **196px**, avatar **82px**, overlapping by **34px**), done safely inside one positioned wrapper. See **#53**. The original reasoning below still explains *why the naive version broke*, and it is still the failure mode to avoid. The old negative margin crossed a pane's `overflow:hidden` boundary and sliced the avatar.

**Two shipped screens are now out of parity** and carry redesign tickets ahead of every
new screen: `02 Search` (#6a, shipped with the filter rail and a free-text query) → **#23**,
and `12 Sign up` (#21, shipped with the old marketing copy) → **#24**. `01 Landing` is
partially built and is re-composed by **#6c**.

**Every ticket clears the old-design debt in the surfaces it touches.** The Orla plan is
the only design law; the pre-Orla system survives only as debt, and it is removed
surface by surface as tickets pass through. A ticket that builds or edits a surface and
leaves any of the following behind in it is **not** `Done`:

| Debt | Replace with |
| --- | --- |
| `primary-*` terracotta tokens (33 call sites, 20 files) | the `clay-*` ramp — clay is a **fill**; `clay-500` when clay is the text |
| Fraunces / Albert Sans | Instrument Serif / Instrument Sans |
| `VenMatch`, `venmatch.com`, `venmatch.app` literals (22 files) | `BRAND_NAME` / `BRAND_DOMAIN` — never a literal |
| `--color-success` / `--warning` / `--info` / `--info-light` / `--error-light` | the `sage` / `gold` / `steel` / `error` signal ramps |
| `--container-prose` / `-form` / `-app` / `-wide` | the layout variables in `01-foundations.md` |
| The 4-step radius scale, the old shadow set, the old stone ramp values | the 5-step radius, the 5 warm-tinted shadows, the new stone ramp |
| Any hex, width or radius written inline in a component | a token |

**No surface is left half-migrated.** If a ticket touches a file, that whole file comes
across — migrating three of five `primary-*` uses in a component is worse than migrating
none, because the mismatch is invisible in review. #21 clears the shared and global debt
so later tickets inherit a clean base; each later ticket clears whatever remains in its
own surfaces. Any debt a ticket finds but cannot clear without leaving its scope goes in
the Notes column, named, rather than being silently left.

**Capabilities** name the external services a ticket needs (`core`, `auth`, `storage`,
`stripe`, `email`, `sentry`). They are declared in `packages/shared/src/env/tickets.ts`
and enforced by preflight, which checks only the capabilities a ticket declares — so a
ticket that never touches Stripe is never blocked on Stripe credentials. Browser
verification (`e2e`) is implicit on every ticket.

---


## Overnight queue — the autonomous run follows this list, not raw `/next-ticket`

Added 2026-08-29. **This ordered list is the queue for an unattended run.** Raw
`/next-ticket` is wrong here: it sorts by priority then by oldest ticket, which would start
on #9 — the largest and riskiest ticket in the backlog — before the small changes that
unblock sixty others.

Work top to bottom. Take the next ticket only when the one above it is committed and green.

### Wave 1 — unblockers. Small, low-risk, and they release the rest of the backlog

| Order | # | Why it is first |
| --- | --- | --- |
| 1 | **#165** | One CSS rule. Direct cause of #89, #109, #119, #121 and the same failure on all 26 unswept frames |
| 2 | **#74** | The line-height ruling the operator already made. **60+ parity tickets are blocked on it**; fixing them first means measuring everything twice |
| 3 | **#198** | Five type-scale mappings, decided once. Accounts for most remaining font-axis findings |

### Wave 2 — self-contained functional defects

| Order | # | Note |
| --- | --- | --- |
| 4 | **#66** | Six URLs return 500. Ships with the table-driven status-code test the ticket specifies |
| 5 | **#67** | Booking idempotency. Needs a unique partial index via `pnpm db:generate` — never hand-edit the migration |
| 6 | **#170** | Upload authorization must become **per prefix**, not per route |
| 7 | **#171** | Renders the storage key where it needs the resolved URL |
| 8 | **#222** | Onboarding swallows a 400 with no feedback. The booking-request form is the model to copy |

### Wave 3 — security

| Order | # | Note |
| --- | --- | --- |
| 9 | **#215** | Session JWT in a URL query string. Replace with a short-lived single-use stream ticket |
| 10 | **#172** | Format allow-list bypassed by renaming. Compare the **decoded** format, not the declared one |

### Wave 4 — the critical path, when there is runway

| Order | # | Note |
| --- | --- | --- |
| 11 | **#9** | Stripe Connect. **Verified agent-executable 2026-08-29** — test keys present, Connect enabled. Build on **Accounts v2** (`POST /v2/core/accounts`); v1 is refused. Load `npx skills add stripe/ai` first. Unblocks #10, #68, #220, #221 |

### Wave 5 — the change-order features, once Wave 1 has landed

| Order | # | Note |
| --- | --- | --- |
| 12 | **#167** | The shared dropdown component. Closes #69 outright and several parity findings with it, so it earns its place before the per-finding tickets |
| 13 | **#166** | Availability cell marks. Also resolves #164 and pairs with #212's mislabelling |
| 14 | **#169** | 1024 as a real breakpoint — seven `27 …` frames depend on it |
| 15 | **#186** | Landing hero scale ladder |
| 16 | **#168** | Page loader |

### Wave 6 — parity, but re-measured first

**Do not work the 83 per-finding parity tickets one at a time, and do not assume they are
still failing.** #74, #165 and #198 in Wave 1 change the computed metrics of most of them.

1. **Re-measure before fixing.** Run `parity-checker` once per already-swept frame — `01`,
   `02`, `03`, `08`, `09`, `11`, `12`, `04`, `07`. Close every ticket the pass now reports as
   MATCH, with the evidence in Notes. Expect a large number to close for free.
2. **Then batch what survives by frame, not by ticket.** One browser pass verifies a whole
   screen; running one per ticket would mean ~80 passes on a single serial browser.
3. **Only then sweep the 26 unswept frames** (`.claude/plans/parity-sweep-ledger.md` lists
   them with route, auth state and viewport), filing findings as you go.

### Wave 7 — everything else, until the queue is empty

Fall back to **`/next-ticket`** and keep going until it returns `QUEUE_EMPTY`.

By this point raw `/next-ticket` is safe: the ticket that made it unsafe (#9) is done, every
genuine human gate is already marked `Deferred — needs a human` or `Blocked — needs a human`
so eligibility skips it, and the 59 tickets blocked on #74 have been released by Wave 1.

**Stop conditions.** Stop and leave a status record when any of these is true:

- `/next-ticket` returns `QUEUE_EMPTY`
- Three consecutive tickets return `BLOCKED` — that means the queue's remaining work needs a
  human, not that the run should keep grinding
- `pnpm preflight` fails twice in a row on the same check
- The working tree cannot be made clean, or a commit is refused twice

### Rules for the unattended run

1. **Work in a worktree.** Two sessions have already swept each other's in-flight files into
   mislabeled commits on the shared checkout (`b1b8e7c`, `1bd37ab`). `claude --worktree <id>`.
2. **`pnpm preflight` before every ticket.** It now fails on an empty database
   (`Demo data present`) — a `docker compose` recreate wipes local data, and without this a
   run spends hours describing an empty marketplace.
3. **Never reseed, drop, or recreate shared infrastructure.** If data is missing, stop and
   report. The agent guards in `.claude/agents/` forbid the bigger hammers.
4. **Do not edit `design/`.** Another session owns the design bundle and merged it three
   times on 2026-08-28. Design passes edit the plan; tickets write code.
5. **Defer rather than guess.** Return `BLOCKED` with one question for any unapproved product
   decision, destructive migration, or new dependency. A deferred ticket is a good outcome;
   a guessed one is not.
6. **Browser work is serial.** One shared Playwright browser. Never run two driving agents at
   once, and never kill another session's browser.
7. **Agents never type a password.** `pnpm e2e:auth`, then load `.auth/<role>.json` as
   `storageState`. See `.claude/rules/e2e-auth.md`.
8. **Do not sweep parity before Wave 6.** Waves 1-5 are code. Parity re-verification waits
   until #74 and #165 have landed, because most findings will move.
9. **Never mark a ticket Done without the evidence.** `CHECKS` lists checks whose output
   was read, not checks that were intended. `BROWSER` is `verified` only when a browser
   actually drove the flow.
10. **One ticket per commit, and the commit message says what is in it.** If the staging hook
    refuses a partial stage because a concurrent session left files dirty, say so in the
    message rather than hiding it — and prefer a worktree so it cannot happen.
11. **The Stripe and Clerk agent skills are available** — `connect-recommend`,
    `connect-required-verification-information`, `stripe-best-practices`,
    `clerk-nextjs-patterns`, `clerk-webhooks`, `clerk-testing`. Load the relevant one before
    writing an integration rather than working from memory. They are symlinks from
    `.agents/skills/` into `.claude/skills/`; if one is missing, re-link rather than
    guessing at the API.
12. **Stage in its own command.** `check-staging.mjs` is a `PreToolUse` hook, so chaining
    `git add && git commit` blocks the whole call and nothing is ever staged.


## Beta gate — what blocks shipping to real users

> ## The one-line answer, verified 2026-08-29
>
> **No booking can be created by anyone.** `POST /booking-requests/:id/accept` returns
> **`402 - "Finish your payout setup before accepting bookings"`**, and payout setup does
> not exist: all **17** vendor profiles are `is_published = true, stripe_onboarded = false`,
> and there is no Stripe onboarding route, link or `accountLink` anywhere in the tree. The
> only mentions of payouts in the web code are two comments saying it is deliberately absent
> until **#9**.
>
> The 918 bookings in the database are **seed data**. Not one can be reproduced through the
> application. Everything downstream of accept - the date hold, payment capture, completion,
> reviews - is unreachable and therefore untested and unverifiable.
>
> **The product cannot transact.** That is #9 and #10, not a defect list. Until they land,
> the only honest beta is browse-and-enquire, and the shipped payment copy has to come out
> (**#217**, **#220**). See **#220** and **#221**.


Added 2026-08-28 after five adversarial passes (136 findings). This separates **defective**
from **off-spec**. Parity matters, but a cosmetic delta does not harm a real user and a
broken transaction does.

### Tier 1 — the product does not work end to end

**Updated 2026-08-28 after the two-sided functional pass.** The vendor half is worse than
the customer half: **#210** (a vendor cannot see a booking they accepted — `GET /bookings`
returns `[]` with their own token) and **#211** (the vendor never learns who the customer is;
every surface reads `A customer`). A vendor who accepts a wedding cannot find it and cannot
contact anyone. Add **#215** — the session JWT travels in a URL query string on every
authenticated page load.


| # | Blocker |
| --- | --- |
| **#68, #9, #10** | **The core transaction cannot complete.** A customer can send a request; there is no route to a booking detail, no way to approve a quote, and no checkout. Every booking card links to the vendor's *marketing profile*. The shipped copy already promises "Payment is held" and "you approve before any card is charged" — neither is reachable. Stripe onboarding (#9) is deferred and the payment lifecycle (#10) is backlog |
| **#67** | Three clicks in one tick create **three real bookings**. No server-side dedupe, and no customer-side withdraw, so duplicates sit in the vendor's queue permanently |
| **#170** | Customer profile photo upload **403s every time** and shows the user `This endpoint requires the vendor role` |
| **#171** | A successful upload renders a **broken image and a 500** while the toast reads "Profile photo updated." |

### Tier 2 — a real user will hit these and watch the app break

| # | Blocker |
| --- | --- |
| **#66** | Six URL shapes return **HTTP 500**, including an uppercased vendor slug and a pasted ISO timestamp |
| **#69 / #167** | Filter options are **unreachable** at 1024 and 390 — real clicks time out |
| **#70** | Below 768px `/messages` shows one thread with **no way to reach the others**; the notifications panel renders at `x = -80` and the held date is the part clipped off |
| **#71** | A pasted gallery link **overflows its own bubble** — the single most likely message in this product |
| **#76** | Sign-in **discards the destination**, dropping the user at the moment of booking intent |
| **#172** | The image format allow-list is **bypassed by renaming the file** |

### Tier 3 — visibly wrong, not blocking

#72 (error and empty-state copy), #73 (the six accessibility laws), #77 (no date upper
bound — year 9999 bookings), and the uploads P2 set (#174–#180).

### Explicitly NOT beta blockers

The 83 per-finding parity tickets (#82–#164) and the design-fidelity work (#74, #165, #166,
#169, #186). These decide whether the product looks like Orla, not whether it works.

### The untested half

**The vendor side of the transaction has never been driven.** The seeded vendor account has
**0 pending requests and 0 bookings**, so accepting a request, declining one, sending a quote,
and the vendor's view of a booking were all unobservable in every pass so far — as was the
publish-checklist rail on frame 08. A two-sided functional pass is required before any beta
claim: customer creates a request -> vendor accepts -> customer sees the change.


## Status Board

| # | Ticket | Phase | Milestone | Priority | Status | Branch | Blocked By | Capabilities | Notes |
|---|--------|-------|-----------|----------|--------|--------|------------|--------------|-------|
| 0 | Repo Init + GitHub Link | P0 | M0 | P0 Critical | Done | — | None | — | Pushed 2026-08-26 |
| 1 | Monorepo Foundation + Database Schema | P1 | M1 | P0 Critical | Done | main | #0 | `core` | Pushed 2026-08-26 (07370b2, c3b7ad6) |
| 2 | Authentication + App Shell | P1 | M1 | P0 Critical | Done | main | #1 | `core` `auth` | Pushed 2026-08-26 (abd3d0d, 741f982); Sentry deferred to #15 |
| 3 | Vendor Registration + Profile Management | P1 | M2 | P1 High | Done | main | #2 | `core` `auth` `storage` | Pushed 2026-08-26 (1686d0c) |
| 17 | Environment Contract + Preflight Gate | P1 | M1.5 | P0 Critical | Done | main | #3 | `core` | Pushed 2026-08-26 (9e92c03); follow-up 872804a |
| 21 | Orla Design Foundation, Brand & Reskin | P1 | M1.8 | P0 Critical | Done | main | #17 | `core` `auth` | Pushed 2026-08-26 (0076250). Verified 2026-08-27 audit: **no pre-Orla debt remains** — `primary-*`, `VenMatch`, Fraunces all clear (residual grep hits are shadcn `--primary-foreground` slots, test guards and history comments) |
| 4 | Vendor Service Setup (Packages, Portfolio + Availability) | P1 | M2 | P1 High | Done | main | #3, #17, #21 | `core` `auth` `storage` | Pushed 2026-08-26 (61cc5b6) + bf525f9. Frames `09`, `11`. Re-verified 2026-08-27: availability calendar is **sound** — past dates disabled with correct accessible labels, "Show earlier months" disabled, quarter counts arithmetically correct. Defects found in its sibling surfaces are in **#31** (cents copy, price min/max) and **#29** (upload states) |
| 6a | Vendor Search API + Search Screen | P1 | M3 | P1 High | Done | main | #4 | `core` `auth` `storage` | Pushed 2026-08-27 (da38e01). Screen superseded by #23; the endpoint, its 32 tests and the card component survive. **API correctness defects found 2026-08-27 → #29** **OUT OF PARITY 2026-08-27:** vendor-card cover 4:3 → **3:2** on frame `02 Search` → **#52** |
| 23 | Search Redesign — Category-First Query + Refine Bar | P1 | M3 | P0 Critical | Done | main | #6a | `core` `auth` `storage` | Pushed 2026-08-27 (9fb2b81) + b402b0b. Frame `02`. Re-verified 2026-08-27: 4 columns, empty state and past-date clearing all correct. `Style ▾` still absent → #25 **OUT OF PARITY 2026-08-27:** frame `02 Search` now labels the vendor-card cover **3:2** and declares `aspect-ratio:3/2`; the shipped grid is 4:3. → **#52**. Also gains the `25 Search results — 1024` frame → **#55** |
| 6c | Landing Re-composition | P1 | M3 | P1 High | Done | main | #23 | `core` | Pushed 2026-08-27 (1dd665a) + b574f55. Frame `01`. Re-verified 2026-08-27: composition correct; hero City/Event-date inputs are **unlabelled** → #31 **OUT OF PARITY 2026-08-27:** the featured-vendor row's covers go 4:3 → **3:2** → **#52**. Landing also gains the `25 Landing — 1024` frame (both hero portraits stay *beside* the headline at 124px, 3:4) → **#55** |
| 24 | Sign-Up Marketing Panel Copy | P1 | M3 | P0 Critical | Done | main | #21 | `core` `auth` | **Shipped out of band — tracker was stale.** Pushed 2026-08-27 (a40600d), extended by 29d30ce (role fork) and f769767 (neutral default). Verified 2026-08-27: `auth-screen.tsx` carries **both** panels — customer "See the price. / See the open dates. / *Then decide.*" and the neutral default "Clear prices. / Open calendars. / *No back-and-forth.*" — matching `21-sign-up.md:95` and `:128`. Remaining defect: the "Pick one above to continue" hint renders **below** the Clerk footer → #31 |
| 18 | API Containerization + Release Readiness | P1.5 | M4.5 | P0 Critical | Done | main | #17 | `core` | Pushed 2026-08-26 (bebd04b). Re-verified 2026-08-27: `/ready` reports `database: up`, `storage: up` — the MinIO bucket mismatch it flagged is resolved |
| 31 | Shipped-Surface Defect Sweep — scaffold, copy & a11y | P1 | M3 | P0 Critical | Done | main | None | `core` `auth` | Pushed 2026-08-27 (bc1baf8). **9 of 11 defects were real.** #9 and #10 (unlabelled City / Event date / Sort) were **false positives** — each input is wrapped in its `<label>`, and Chromium reports `textbox "City"`, `textbox "Event date"`, `combobox "Sort"`; the names are now asserted in a test instead. Toast styling needed `globals.css` against Sonner's `[data-styled]` rule — utility classes there are silently ignored. Header is still 64px at 390 (spec says 56px) → **#26** |
| 43 | CI has never passed — Node 20 against jsdom 30 | P1.5 | M4.5 | P0 Critical | Done | main | None | `core` | **Fixed 2026-08-27 (eb6b1ac); run 33124712643 is the first green CI in the repo's history.** Every run since #0 died at `pnpm test` in the web package before one test executed: `webidl.util.markAsUncloneable is not a function`. That function arrived in Node 22; `jsdom@30` needs `^22.22.2` and its `undici@8` needs `>=22.19.0`, but the workflow pinned **Node 20**, so vitest's fork pool could not start a worker for any of the 41 web test files. Typecheck, lint and build passed throughout because none of them loads jsdom — which is why it read as a test problem, not a toolchain one. **Four files declared a Node version and no two agreed** (workflow 20, `engines` >=20, Dockerfile 22, preflight hardcoded 20). `engines.node` is now the only one that decides, `.nvmrc` carries the version, CI reads that file, preflight derives its floor from the manifest, and `toolchain.test.ts` fails if any drifts — verified by breaking `.nvmrc` |
| 44 | Railway deploy — build fixed, service provisioned, cutover done | P1.5 | M4.5 | P1 High | Done | — | None | `core` | **Closed 2026-08-27.** Two separate faults. **(1) Build:** the service's Root Directory was `/apps/api`, so the Docker context excluded `packages/` and every build since project creation died at `"/packages/shared/package.json": not found`. Set `rootDirectory=/` and `railwayConfigFile=railway.json` via the GraphQL API. The Dockerfile was never at fault — verified locally on arm64 and `linux/amd64`, Node 22 and 24. **(2) Environment:** the service had been provisioned from `.env.example` **verbatim** — every secret a literal placeholder (`sk_test_...`, `whsec_...`, `https://<account-id>.r2...`), bucket `vendorhub` (pre-#17 name), URLs `localhost`. All replaced with real values. `/ready` now returns `{"status":"ready","database":"up","storage":"up"}`. Web cut over: `NEXT_PUBLIC_API_URL` and `API_URL` repointed and the web app redeployed — verified by grepping the shipped `/search` chunk, which carries **only** the Railway host. **Vercel API project deleted 2026-08-28** — `vendor-marketplace-api.vercel.app` now 404s and only the web project remains, so there is exactly one API runtime. Post-cutover verification: landing, search and a vendor profile all 200 with real content, `/ready` green. Implements **D10** |
| 45 | Mid-width layout defects — 768 and 1024 (reported by the user) | P1 | M3 | P1 High | Done | main | None | `core` | **Reported by the user 2026-08-27; three distinct defects, all between `sm` and `xl`.** Diagnoses below are **candidate causes read from the source, not yet confirmed in a browser** — the Playwright profile was locked by the user's own Chrome session during triage, so **the first step is to reproduce all three at 768 and 1024 and confirm before editing**. **(a) Tablet — the featured vendor covers sit awkwardly below the search.** `apps/web/src/app/page.tsx:303` grids the Featured vendors row `sm:grid-cols-2 lg:grid-cols-4`, so 768–1023 gets **two columns over two rows**, and `vendor-card.tsx`'s `featured` density draws an `aspect-[4/3]` cover — roughly 260px tall at that column width — which is what pushes them down the page. **The user's own remedy: drop the cover image on these cards at tablet** (explicitly *not* the landing category cards, which are correct). Confirm against frame `14 Adaptations` and `30-responsive.md` before choosing between hiding the image, a shorter cover, or four columns earlier. **(b) 1024 — input placeholders overflow or truncate.** `lg` is exactly 1024px, the width at which `search-shell.tsx` hides the standalone query row (`lg:hidden`) and the bar moves into the header — so the bar is at its most cramped precisely as it takes over. Suspect `search-bar.tsx`'s Vendor type / City / Event date fields. **(c) 1024 — a Refine pill wraps to a second row that it would fit on.** `refine-bar.tsx:207` is `flex flex-wrap` and `:320` puts **`ml-auto` on the Sort label**; the auto margin eats the line's free space and leaves the last pill stranded on its own row. **Not a redesign** — three responsive fixes on shipped surfaces. Parity gate at 768 and 1024 against frames `02` and `14`. **(b) and (c) CONFIRMED live in a browser at 1024 on 2026-08-27**, while verifying #29: the header search bar truncates to "Any vendor t…" and "Add a dat", and the hero photo cluster overflowed the right edge — the last is now moot, because the cluster is hidden below `lg` as of 2765dc2, but the bar is still cramped at exactly 1024. **(a) is partly overtaken**: the same "drop the image when the column is too narrow" remedy was applied to the *hero* cluster in 2765dc2; **RESOLVED — pushed 2026-08-27 (2458878).** All three reproduced in a browser first. **(a)** Confirmed at 768: four cards over two rows cost ~880px; the cover is dropped from `sm` to `lg` and the row now costs ~430px, with the avatar rejoining the flow since it had been overlapping a seam that no longer exists. **(b)** Confirmed at 1024: bar 486px against 495px needed, and the 500px cluster sliced inside a 409px column. Hero gutter narrows at `lg`, the vendor-type and event-date segments carry width floors, and the cluster scales to fit. **(c) DID NOT REPRODUCE** — at 1024 today's chip set leaves 181px spare. The `ml-auto`-inside-the-wrap structure the spec forbids was fixed anyway, so it cannot strand once #25's Style chip lands. Verified at 1440 / 1024 / 768 / 390: no truncation, no clipped composition, no horizontal overflow, 1440 unchanged. |
| 46 | Clerk webhooks point at a CLI relay, not the API | P1.5 | M4.5 | P1 High | Blocked — needs a human | main | Secret rotation (Clerk dashboard) | `core` `auth` | Code shipped `34cd28c`, `ed41aed`. Scope 1 (reconciliation) and 2 (guard) are **Done**; scope 3 (**rotate `CLERK_WEBHOOK_SECRET`**, leaked into a chat transcript 2026-08-27) needs a human in the Clerk dashboard and is the only thing left. The API now refuses to boot when its Clerk endpoint is a relay, a foreign origin, the wrong route, or plain HTTP — silent off a platform, since a relay is the correct local setup. `CLERK_WEBHOOK_ENDPOINT` added to the env registry and set on Railway. Reconciliation routes corrections through the webhook handler itself, so deletion behaves once, and skips `seed_mkt_…` rows Clerk never issued — the first dry run would otherwise have retired 50 of 54 rows and taken the seeded marketplace down. Production dry run: **4 real users, 0 drift, 0 retirements, 50 skipped**, so the write-mode run is a proven no-op; `pnpm reconcile:clerk [--dry-run]` when wanted |
| 47 | Image URLs persist absolute — the CDN domain cannot change without a migration | P1.5 | M4.5 | P1 High | Done | main | None | `core` `storage` | Pushed 2026-08-28 (**5448428**), CI green. **The database now stores object keys**; the URL is built at the boundary from `S3_PUBLIC_URL`, so changing it repoints every image with **no data change** — asserted directly by a unit test that resolves the same key under two different bases. **Resolution happens once**, in the wire schemas on the way in, rather than at the fourteen render sites: fourteen sites is fourteen chances to forget one, and a second resolution site is the same coupling. **Passed through, not prefixed:** absolute URLs (Clerk avatars, pre-change rows) and site-relative paths (the seeded `/marketing/...` imagery). A key with no configured base resolves to **no image**, never a bare bucket root. **Migration:** `pnpm --filter @vendor-marketplace/db keys:from-urls`, idempotent — a test runs it twice and asserts the second run converts nothing, and that a Clerk avatar and a marketing path both survive untouched. **`NEXT_PUBLIC_S3_PUBLIC_URL`** added to the registry (one row derives both halves, so the two cannot disagree) and `.env.example`/`turbo.json` regenerated. **Browser-verified**: 16/16 search cards and the vendor profile banner all load, zero broken images. `uploadedImageSchema` now returns `imageKey`/`thumbnailKey` for persistence alongside preview URLs. **Not done, out of scope by the ticket's own words:** attaching a Cloudflare custom domain — still worth doing, but no longer load-bearing, and it is an infrastructure task needing a human |
| 48 | The Vercel "production" API was serving the Neon `dev` branch | P1.5 | M4.5 | P1 High | Backlog | — | #19 | `core` | **Found 2026-08-27 during the Railway cutover, by comparing the two APIs.** The Neon `production` branch returns **0 vendors / 10 categories**; the Vercel API returned **16 vendors / 11 categories** — byte-identical to the local `dev` branch. So the deployed "production" API has been reading **`dev`** since it was first deployed. This is the mirror of the rule in `CLAUDE.md` ("local development must never point at `production`"), which preflight enforces in one direction only. **It also explains #47/§1.1 of `docs/pre-launch.md`:** the 16 fabricated vendors and 918 fabricated reviews on the live site were never in a production database. **Railway is deliberately pointed at `dev` too**, by decision, so the deployment stays a demo/staging environment with working design-parity data until launch; the `production` branch is reserved and empty. **Open work:** (a) preflight should refuse a *production* target reading a non-production branch, closing the missing direction; (b) the `production` branch is **stale** — 10 categories where `dev` has 11 — so its reference seed must be re-run before launch; (c) the swap is a launch-gate item in `docs/pre-launch.md` §1.1 and §3.2 |
| 49 | A signed-in visitor's front door still 500s when `/users/me` fails | P1.5 | M4.5 | P1 High | Done | main | None | `core` `auth` | Pushed 2026-08-28 (**d6daf45**), CI green. Took the split #33 anticipated, **declared in code** as `readIdentityOnPublicRoute()` rather than inferred from a nearby `try/catch`. **Verified with the API process killed and a real signed-in Clerk session:** `/` renders the full landing page (was the 500 boundary), `/search` renders with its failure scoped to the results pane. Protected routes never render without identity. A `redirect()` is not a failure — the degrade rethrows Next's `digest` signals, so a suspended account still reaches `/suspended` while the API answers; that check is now **one shared `navigation-signal.ts`** instead of two copies. The test's redirect mock gained a **`digest`**, matching what Next actually throws — without it the new branch was never exercised. **Security half asserted:** `requireCurrentUser` and `requireRole` propagate on both an unreachable API and a 500, and do **not** fall back to a sign-in redirect; a test asserts a suspended user cannot reach protected content because a read broke, and it fails if the guard is removed. **Acceptance item not met, with cause:** `/vendors/[slug]` still shows the boundary with the API down — that is the **profile** read, not the identity read (the page never calls `getCurrentUser`), and #33 deliberately propagates it because there is no vendor page without a vendor. Out of #49's stated scope, which is `getCurrentUser` and its callers |
| 50 | Search no-results — the nearby-date alternatives band | P1 | M3 | P2 Medium | Done | main | #29 | `core` | Done `6574066`. **One endpoint** — `GET /vendors/availability/nearby` — serving this band and, when it lands, #7's blocked-date suggestion. Returns each vendor's **nearest** free day, not a calendar: nearest to the wanted date rather than earliest in the window, ties breaking earlier. Window is a parameter defaulting to ±14 days; its lower bound is the later of the window start and **today**, so a search anchored on today can only look forward. A vendor free on the wanted date is excluded. The band is **absent rather than empty**, and silent on a failed request. "See all N in the region" counts the full predicate, not the cards on screen, and does not render when the band already shows everyone. 16 route tests against real Postgres plus 8 component tests. Verified in the browser on `?category=photography&city=Oakland&date=2026-09-11`, which is genuinely empty in the seed |
| 51 | Cover is a designation, not a second uploader | P1 | M3 | P2 Medium | Done | main | #29 | `core` `storage` | Done `6da1dfd`. The separate cover drop zone is gone; the first portfolio tile carries a **COVER** badge and the rule is stated above the grid. The column stays — deriving it at read time would make search cards, the profile banner and share metadata all join into a list's ordering — and every write that changes what is first (reorder, delete, first upload) sets it **in the same transaction**, asserted by a refused-reorder test that leaves both untouched. Empty portfolio → no cover. Backfill `pnpm --filter @vendor-marketplace/db run cover:from-portfolio` **adopts** an orphan cover as item 0 rather than dropping it; the marketing seed now does the same so it stops contradicting the rule. Verified end to end in the browser: reordering moved the cover with it |
| 52 | Vendor card covers — 4:3 → 3:2 | P1 | M3 | P1 High | Done | main | None | `core` | Pushed 2026-08-27 (**6c244b5**), CI green. Both densities now declare `aspect-ratio: 3/2`; the **132px fixed height is retired** and a test fails on any `h-*` returning to either density. **Measured in a browser:** ratio exactly **1.500** at 1440, 1024, 768 and 390; cover 221px at 1440 (4 cols, 331px cards), 216px on the landing featured row, 223px at 390. Landing **category** cards untouched at **94px**; the featured cover still drops at 768 (0 visible); no horizontal overflow at any width. **Plan corrected, per the frame-wins law:** `11-search.md`'s "8 cards with none sliced / two full rows" budget was written against the old 132px cover and is arithmetically impossible at 3:2 — **frame `02 Search` does not meet it either**, its own second row ending at **943px inside a 902px frame**, clipped by its `overflow:hidden`. The criterion now describes what the frame draws (full first row, second row's price rows above the fold); the shipped page clips **11px** where the frame clips 41px, and the new assertion passes. **Not verifiable here, deferred with cause:** the no-results fallback card row does not exist yet (**#50**), and the acceptance's "207px at 3 columns / 1024" presumes the 3-column 1024 grid that **#55** delivers — 1024 is currently **2 columns**, which is #55's scope and now unblocked |
| 53 | Vendor profile — 196px banner and the 82px avatar overlap | P1 | M3 | P1 High | Done | main | None | `core` `storage` | Pushed 2026-08-28 (**942b3ab**), CI green. Banner **196px** `box-border`, avatar **82px** with a **4px `stone-50`** ring drawn *inside* the size, identity row `-mt-[34px]` + `relative` + `z-[2]` — all three asserted together, since any one missing brings the slicing defect back. **Measured at 1440 / 1280 / 1024 / 768 / 390:** banner 196, avatar 82, overlap exactly **34px**, avatar fully rendered, **no clipping ancestor between the avatar and `body` at any width**, no horizontal overflow, long name fits at 390. A unit test asserts the no-clip structure too, because a browser pass only proves the widths it visits. Name, rating, from-price and both CTAs visible without scrolling. No-cover case covered by test: placeholder banner still 196px with the overlap intact. **Refactor:** `Avatar`'s `bordered` boolean became `ring: 'card' \| 'banner'` — two treatments that differ by the ground behind them (2px `stone-0` on a card seam, 4px `stone-50` on the page ground), so the prop names the ground rather than leaving the caller to remember; `AVATAR_SIZES.xl` 72 → **82** **DESIGN DROP 2026-08-29:** **unshipped by #287** — the 196px banner and the 82px avatar overlap are removed at every width. Do not treat this row's measurements as current. |
| 54 | Page loader — the mark's two rings, no wordmark | P1 | M3 | P2 Medium | Done | main | #28 | `core` | Done `e58f47f`. The loader is the mark's geometry: 52x30 holding two 30px rings overlapping by 8px, clay fill and ink outline, on the frame's **1.9s** loop and easing, with the hold at 46–54% that makes it read as a meeting rather than a bounce. **No text is painted** — only the screen-reader label — asserted by a test that greps the component's own source. `motion-safe` leaves reduced motion at the static overlap. `PageLoading` and the `wordmark-pulse` keyframes deleted, since nothing rendered them and leaving a wordmark loader invites its reuse. Parity measured against frame `26` from the compiled stylesheet: geometry, colours, easing and both keyframes match exactly |
| 55 | 1024 parity — the shipped screens | P1 | M3 | P1 High | Done | main | None | `core` `auth` | Pushed 2026-08-28 (**7d33161**), CI green. **Verified at 1024x640 specifically.** Search now **3 columns** (was 2 — it was inheriting the tablet grid): gap **14px**, cards **314px**, cover **209px**, page padding **20px**, row 1 fully visible with row 2's top edge peeking as the scroll affordance, no horizontal overflow. Landing: headline **40px**, sub **13.5px**, category row top at **390px** — well inside 640; all three hero cards stay **beside** the headline. 1440 unchanged (54px/16px, 4 cols); 1280 → 3 cols; 768 → 2 cols; none overflow. Loading state driven live with a throttled fetch: **6 skeletons in 3 columns at 1024, 8 in 4 columns at 1440** — two full rows at either width, matching both loading frames. **Defects found and fixed:** the vendor-card skeleton still declared a **4:3** cover after #52 moved the card to 3:2, so the grid reflowed the instant data landed. **Token added:** `--text-display-hero-md: 40px`, the 1024 hero step between `display-lg` and `display-xl` — a real token, not an inline size. **Guardrail:** `--sidebar-width-icon` is annotated as deliberately unused, since the responsive pass **considered and rejected** an icon rail at 1024 and an inert token with no note is how that gets reversed. **Out of scope, confirmed not regressed:** vendor-profile rail is 380px and does not wrap (its own frame `03` width, not a 420px rail); the vendor sidebar keeps labels at 200px with no icon rail — the 220px figure belongs to the vendor-dashboard frame, which **#22a** owns. No-results fallback **card row** still does not exist (**#50**) |
| 33 | Front-Door Resilience — reference reads must degrade, not 500 | P1 | M3 | P0 Critical | Done | main | None | `core` | Pushed 2026-08-27 (ed58b0c). Verified with the API stopped and a cold fetch cache: `/` and `/search` serve 200 with hero, header and search bar intact; search scopes its failure to the results pane. The signed-in `/users/me` gap is filed as **#49**. |
| 32 | Imagery — landing category cards, and the covers the seed points at | P1 | M3 | P0 Critical | Done | main | None | `core` | Closed 2026-08-27. **(b) landed first** in 315055a — `public/marketing/` is tracked and all 16 seeded covers serve (verified 200 on Vercel). **(a) is #36** (01bd8bf), which moved the six category images to a tracked `public/categories/` and left `marketing/` as the vendor-cover staging area. Also removed `marketing/index.html`, a contact sheet 315055a had begun serving publicly |
| 28 | Application States Foundation — 404, 500, boundaries & state library | P1 | M3 | P0 Critical | Done | main | #21 | `core` | Pushed 2026-08-27 (a97001a). **All six acceptance boxes met.** Frames `15`/`16` built and verified on Vercel; incident id is Next's `error.digest`, confirmed matching the server log. `Banner` derives tone from `status`, so red-on-pending is unrepresentable. **Two recorded frame deviations:** frame `15` says "Log in" where every other frame and the shipped header say **"Sign in"** (built Sign in); frame `15` sets the headline **38px** where `01-foundations.md` puts `display-lg` at **33-36px** (built the 34px token rather than a one-off). **Remainder of the state library → #39** — skeleton variants, element loader, empty-state extension, the four dialogs, the validation hook and the 403/rate-limit surfaces, none of which has a consumer until #7/#8/#10 **OUT OF PARITY 2026-08-27:** frame `26 State library` replaces the wordmark opacity pulse with the mark's two rings converging, geometry only. → **#54** |
| 29 | States Retrofit — search, uploads & search-API correctness | P1 | M3 | P0 Critical | Done | main | #28 | `core` `auth` `storage` | Pushed 2026-08-27 (a5cab14, 6eb52c1). **Frames `17` and `18` built and browser-verified at 1440x900** — the no-result screen counts the filters set, names the narrowest, and one tap on a relaxation took a live search from 0 to 2 results. Both search-API defects fixed with tests that fail without them. Uploads run through a real queue: per-file determinate progress over XHR, partial success, four distinctly worded failure modes with `40-states.md` tones, batch trim with the held-back files named. Upload contract now JPG/PNG · 12 MB · 1200px · 20 per batch, stated once in `packages/shared`; WebP left the accepted set at both ends together. **Three deviations, each deliberate:** **(1)** the loading grid keeps **8** skeletons, not the ticket's 6 — frame `17` draws 6 in a **3-column** grid, but #23 shipped 4-across and this ticket forbids touching it, so 6 renders a ragged 4+2 row that breaks the "skeletons mirror real geometry" law. 8 is two full rows. **(2)** frame `18`'s **"Free on a nearby date instead"** band is **not built** — it needs an API that can find vendors free on nearby dates, which exists nowhere. Split to **#50**. **(3)** **cover-as-a-designation** (drag to first slot, replacing the separate cover drop zone) is **not built** — it is a portfolio-ordering feature rather than an upload state. Split to **#51**. **Frames `24 Image upload` and `25 Upload failures` have NOT passed the browser parity gate**: signing in as the vendor test account was blocked in this session, so the upload surface was never driven in a real browser. It is covered by 34 unit tests (model + queue hook, including the 8-file/2-failure case). **Re-open the gate on `24 Image upload`/`25 Upload failures` before treating this as parity-complete.** **OUT OF PARITY 2026-08-27:** frame `18 Search no results` moves its card covers 4:3 → **3:2** → **#52**. The loading and no-results screens also gain `25 Search — loading · 1024` and `25 Search — no results · 1024` → **#55** |
| 6b | Public Vendor Profile | P1 | M3 | P1 High | Done | main | #28 | `core` `auth` `storage` | Pushed 2026-08-27 (acb3bba). Frame `03` verified in Chromium at 1440/1280/768/390 — cover 150px `border-box`, avatar 72px with top 232 ≥ cover bottom 214 (**no overlap, no clipping**), rail 380px sticky, five tabs writing `?tab=`, 2.29 viewports. **Both rail CTAs render disabled** with an explaining helper line per `40-states.md`, since #7 and #8 do not exist. **Tagline and Experience tile deliberately not built → #41** (no column, no data). Three defects found and fixed in build: identity row outside the content column (avatar clipped at x=0), five tabs overflowing 390 by 4px, and a stale unused `AVATAR_SIZES.xl: 80` the plan had revised to 72. **Soft-404 found → #42.** Availability tab is read-only; `30-responsive.md` wants anchored sections + scroll-spy below 1280, deferred as a named deviation **OUT OF PARITY 2026-08-27:** frame `03 Vendor profile` reinstates the avatar overlap — banner **196px**, avatar **82px** overlapping by **34px** via a positioned, `z-index:2` identity row. The shipped page renders the flat, no-overlap version. → **#53** |
| 16 | Customer Profile + Preferences + History | P1 | M2 | P1 High | Done | main | None | `core` `auth` `storage` | Pushed 2026-08-28 (**ddb5acc**), CI green. **Tiered visibility decided server-side from the booking relationship, never from a parameter** — 12 API route tests, including the same request before and after acceptance returning different shapes, a vendor with no relationship getting **404 not 403** so ids cannot be probed, and a customer's private `is_public=false` review staying out of another vendor's view. The tiers are a **discriminated union**, so the limited branch cannot carry a contact field even by mistake. `/customer/profile` browser-verified at 1440 and 390 with **live data**: Active showed the real pending request (`Wedding · November 14, 2026 · $1,450 · Waiting on the vendor`), Past showed the withdrawn custom request (`To be quoted · Withdrawn`), Reviews showed the acceptance's exact empty copy, no horizontal overflow. Tiered API confirmed over real HTTP (customer reading a customer profile → **403**). **Deviations, recorded:** (1) **no customer-profile frame exists** among the 27, so the parity gate has nothing to run against — built to `03-components.md`; (2) **no `emailVerified` badge** — Clerk holds that signal and the local row does not mirror it, so it could only render as always-true, which is decoration; (3) `PUT /users/me/profile` and `GET /users/me/profile` were **not** added — `/users/me` already carries every field and stat, and a second path would be two contracts for one record; (4) the **vendor-facing mini-profile card was not built** — its only consumer is the vendor's request view, which is **#22a**, and an unconsumed component is dead code. **Also:** `customer-profile` added to `STORAGE_PREFIXES`; whitespace-only bio/city/state now rejected. **Debt named:** `ImageUpload`'s shared hint says "20 files per upload" on a single-file avatar dropzone |
| 25 | Style Tags — Category-Specific Refine Chip | P1 | M3 | P2 Medium | Deferred — needs a human | — | Product decision (style taxonomy) | `core` `auth` | Frame `02` draws a `Style ▾` chip; the data model has no `style` tag category and no tag→vendor-category link. **Seeding a style taxonomy for eleven categories is a product decision** — agree the vocabulary before building  **Deferred 2026-08-28:** the ticket's own blocker is a product decision — "choosing the style vocabulary for eleven categories" — and it says to agree it **before** writing any migration. Nothing in `11-search.md` or the frames defines one beyond the illustrative "documentary, editorial…" for photography, and a seeded public taxonomy is expensive to change once customers filter on it. A proposal is recorded in the ticket body for one-line approval; the machinery is a day's work once the words are agreed |
| 26 | Chrome Parity — Responsive Header & Clerk Pin | P1 | M3 | P2 Medium | Done | main | None | `core` `auth` | Done `96716ae` (Part A), `0261c66` (Part B). **A:** drawer built on the dialog primitive, so focus trap, Escape and focus restoration are the primitive's; also closes on pathname. Renders only where it has something to carry — signed out that is `/` only, inheriting the marketing nav's deliberate scoping; the Sign up pill never goes into it. `--header-height` is 56px below `md` as an override on the same token, so every shell and sticky offset followed with no surface touched. Trigger hides from **769** up, not 768: the tablet frame is drawn at exactly 768 and holds the hamburger. Verified 390/768/1024 — header 56/64/64, 44px target, no horizontal overflow. **B:** `ui` from `@clerk/ui` passed to `ClerkProvider`; the `structural_css_pin_clerk_ui` warning is gone from `/sign-in` and `/sign-up`. **Deviation — the selectors were kept, not deleted:** pinning is what removes the fragility (Clerk's own remedy), and the `display: contents` rules reorder Clerk's card and footer around our role hint, which `appearance.elements` cannot express. Frame `12` is **byte-identical** before and after at 1440x900; sign-up's hint still sits 6px under the disabled submit; the avatarBox override still matches |
| 7 | Booking Request — API, Lifecycle & Screen | P1 | M4 | P0 Critical | Done | main | None | `core` `auth` | Pushed 2026-08-27 (23966bf). Frames `04` + `22` built and **browser-verified at 1440x900, 1024, 768 and 390** — form, validation, review and success all driven live, request persisted with `event_type`, `venue` and `event_start_time`, one conversation, `new_request` notification, and the state machine exercised over real HTTP (cancel 200 -> repeat 409 `INVALID_STATE_TRANSITION`, customer accepting a pending request 403). Scroll budget **1.06x** (limit 1.5x). 36 API route tests + 13 screen tests + 9 validation-hook tests. **Deviations, all deliberate:** (1) route is `/vendors/[slug]/request` per `13-booking-request.md`, not the `/booking/request` in the old scope line; (2) frame `04`'s copy names a persona ("Tell Maya... anything else **she** should know") — shipped as **they**, since a real vendor's pronouns are unknown; (3) the gold reassurance body is `gold-600`, the ramp's gold-as-text token — frame `22` draws `#5C4A18`, which is not in the ramp and would be a second source of truth; (4) `ACCEPTED -> CANCELLED` is **not** implemented: the ticket's own transition table calls `accepted` terminal and says any unlisted edge is rejected, which contradicts its older edge-case line — the table won, and the case belongs to #10's cancellation; (5) **the three-tier validation hook was built here**, in `apps/web/src/lib/use-submit-validation.ts` — #28 never shipped it and #39 still lists it as outstanding, so **#39 must consume this one, not write a second**. **Defects found and fixed during verification:** select/textarea dropped the error border by overriding `className`; `border-1.5` is not a Tailwind class; the stepper overflowed the viewport at 390; the review heading rendered Serif below 16px; the review showed a raw ISO date. **Debt found, not cleared:** frame `04`'s header carries Messages/Bookings nav that needs #8/#22b, and `pnpm format:check` fails on 4 pre-existing files (3 byte-exact design imports + `public/stock/CREDITS.md`) — untouched deliberately \| *Merges old #7a + #7b — re-joined after the split proved unverifiable alone.* The spine every remaining screen hangs off. **No `events` table** — occasion and venue are plain fields on the booking. Frames `04` + **`22`** (request validation — new) |
| 22b | Customer Bookings Hub | P1 | M4 | P1 High | Done | main | None | `core` `auth` | Pushed 2026-08-28 (**48035b0**), CI green. Frames `07` + `19` built, browser-verified at **1440 / 1024 / 390 with live data** — real pending request grouped under `NOVEMBER 2026` with `1 booking`, sub-line `awaiting reply · expires in 7d`, `Search Nov 14` on the invitation. **The page does not scroll at 1440x900** — measured `scrollHeight === innerHeight === 900`. **Month grouping derived from the booking date alone**; no Event entity, no `event_id`, no `/events` route, and a month header carries a count and nothing to open. 16 model tests + 9 hub tests. **Defects found and fixed during verification:** (1) the page scrolled because the **marketing footer** sat under a full-height pane layout — the footer is now scoped to public surfaces via `public-chrome.tsx`, which also fixes `/customer/*` and `/vendor/*`; (2) the invitation searched the **1st of the month** instead of the group's own date, where frame `07` writes `Search Sept 5`; (3) the sub-line led a **pending** card with a price nobody had agreed to — frame `07` writes `awaiting reply · 2d`; (4) below `xl` the rail is dropped for width, which **hid a quote waiting on the customer** — it now moves into the column. **`/customer/dashboard` deleted**, `DASHBOARD_PATH_BY_ROLE.customer` → `/bookings`. **Deviations, recorded:** (1) `GET /bookings` was **not** given tab/filter/sort — the hub's list spans **both** `booking_requests` and `bookings`, so a single server-side tab parameter cannot express it; the union is built in `booking-entries.ts` from the two endpoints #7 already ships; (2) **Messages** and **Saved vendors** are drawn in the frame and omitted — messaging is #8 and there is no saved-vendor feature at all, so both would be dead links; the frame's **Recent messages** rail block is omitted for the same reason; (3) **master–detail at ≥1280 not built** — its contextual actions are Pay now (#10), Leave a review (#12) and the thread (#8), none of which exist, so the pane would be a shell of disabled controls. Follow-on ticket needed when #8/#10/#12 land; (4) `All categories ▾` / `Soonest first ▾` render as the frame draws them but are **inert** — one category and one month in the data. **Debt named:** the shared header still says **Dashboard** for a signed-in customer (frame `07` shows Notifications + avatar) — belongs to **#26** |
| 22a | Vendor Dashboard | P1 | M4 | P1 High | Done | main | None | `core` `auth` | Pushed 2026-08-28 (**da6623e**), CI green. Frames `08` + `20` built, **browser-verified signed in as the real e2e vendor with a real request**: accepting from the row cleared it, retitled the page and moved **response rate 0% → 100%**, proving both that accepting needs no navigation and that stats are recomputed from source rows rather than incremented. Page does not scroll at 1440x900 (`scrollHeight === 900`); stats stay **one row of four at 1024** (185px each) and never stack above it; no overflow at 1024 / 390. Row carries `inset 3px 0 0 clay-400` + **Needs you**; facts line reads `Corporate event · Sat Dec 19 · Fair Market · 300 guests · Half day…`. **The checklist is the publish gate itself** — same `publishBlockers` function, not a parallel list — verified 4-of-6 with the next open row bold + `Finish →` and the **gold** (never red) consequence panel; 12 API tests provoke each blocker in turn. Rail switches to today's schedule once published. **No reply-time figure or ranking claim anywhere** — the only `reply`/`ranked`/`median` hits in the surface are comments explaining the omission. **Defects found and fixed:** (1) the row rendered a **raw customer id** where a name belongs — the #31 defect class; `bookingRequestDetailSchema` now carries `customer: { firstName, lastInitial }`, the same limit the tiered profile applies; (2) the greeting used the **business name** where frame `08` greets the person; (3) the facts-line date carried a comma the frame does not (`Sun, Jun 14` → `Sun Jun 14`). **Deviations, recorded:** (1) **Ask a question** is drawn on a custom request and omitted — it needs messaging (#8), and a second dead control is not better than one fewer; **Decline** is offered in its place, which #7 supports; (2) frame `08`'s sidebar draws Requests / Bookings / Messages / Payments — the existing `VendorNav` is kept, since those surfaces do not exist and **#26** owns header/nav parity; (3) `Earnings this month` delta reads "Your share, after the platform fee" rather than a **next-payout date**, which needs #9/#10. **Debt named:** the conflict-on-accept path renders inline (asserted by component test) but was not provoked in a browser |
| 9 | Stripe Connect Vendor Onboarding | P1 | M4 | P0 Critical | Backlog | — | None | `core` `auth` `stripe` | **Unblocked 2026-08-28:** Stripe test keys are present and real — `pnpm preflight --ticket 9` passes 35/35, including `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET` and the `stripe listen` forwarder. Blockers #2 and #17 are Done. **BLOCKED on credentials, not code** (re-checked 2026-08-27): three Stripe variables are still placeholders and the `stripe` CLI is not installed. Needs a human with the Stripe account  **Deferred 2026-08-28:** its own `Blocked By` names **Stripe test keys**, which only the account holder can mint. Preflight gates the `stripe` capability, so the ticket cannot even start without them. #10, #12, #14 and #15 sit behind this, which is the whole downstream half of the remaining queue |
| 8 | Messaging + Notification Center | P1 | M4 | P1 High | Done | main | None | `core` `auth` | Pushed 2026-08-28 (**4814ef8**), CI green. Frames `10` + `23`. **20 API tests** (participant gates, unread counts, XSS-as-plain-text, length ceiling, notification scoping, hub fan-out) + **9 screen tests**. **Browser-verified with a real thread**: SSE connected (banner cleared, console clean), a message sent and rendered in the clay-100 own-bubble with the mirrored `14px 14px 4px 14px` radius and the timestamp outside it, day divider centred, list preview and `1m` updated, **`RE: DEC 19 CORPORATE EVENT` context line** on the row, notification panel opened with its item and **Mark all read**, bell badge live. No overflow and no page scroll at 390. **Three defects found and fixed in the browser:** (1) **SSE was blocked by CORS on every connection** — writing frames to the raw socket bypasses `@fastify/cors`'s `onSend` hook, so the allow-list is now applied by hand from the same source; (2) the header could not hold four items at **390** and overflowed — `Dashboard` gives way below `sm`, since Messages and the bell have no other route on a phone until **#26** builds the drawer; (3) `/messages` was missing from `public-chrome`'s app-route list, so the marketing footer came back and the page scrolled. **Also fixed:** notification bodies rendered **raw ISO dates** (`2026-12-19` → `December 19`) — the same defect class as the raw id fixed in #22a. **Deviations, recorded:** (1) **no 320px booking-context rail** — its actions are Send revised quote / Accept as-is / Decline, which #7 supports, but the rail also carries the price-adjustment negotiation that belongs to **#10**; the thread header carries the booking one-liner in the meantime. Follow-on ticket needed; (2) **Attach** and **Insert package** are drawn in frame `10` and omitted — attachments have no storage path and no consumer, and a control that opens nothing is furniture; (3) failed-bubble **Retry / Delete** at 55% opacity is not built — the composer keeps the text and states the failure instead, which is the same guarantee with one fewer state; (4) message pagination is server-side (50/page) but the client loads page 1 only — no infinite scroll. **Debt named, important:** the event hub is **per-process and in memory**. With more than one API instance a subscriber on one will not see an event published on another; crossing that needs a shared bus (Redis or Postgres `LISTEN/NOTIFY`). Relevant the moment **#20** scales past one instance |
| 10 | Payment + Booking Completion Lifecycle | P1 | M4 | P0 Critical | Backlog | — | #7, #9, #28 | `core` `auth` `stripe` | Frames `05`, `06` + **`21`** (checkout declined — new). The declined state must state the money position and the 24h date hold explicitly **Carries its own 1024 frame** `25 Checkout — 1024`: rail 420 → **340px**, and **Due today must stay above the fold** — the hard constraint on the screen. |
| 30 | Launch Hardening — headers, SEO & share metadata | P1.5 | M4.5 | P0 Critical | Done | main | None | `core` | Shipped in **21a12b7** (tracker row was stale — headers, robots, sitemap, manifest, icons, OG and `outputFileTracingRoot` all already existed). **Closed out 2026-08-27 (e4eb20b, e33cd34) after verifying against the deployed origin, which found three defects the local check could not see:** (1) `WEB_URL`'s localhost **default reached production**, so every sitemap `<loc>`, the robots `Host` and every OG URL pointed at `http://localhost:3000` — the sitemap was useless to a crawler and every shared link a dead card; `siteOrigin()` now falls back to Vercel's own domain and never serves a localhost canonical from a deployment. (2) The landing page overrode `metadataBase` with `BRAND_DOMAIN`, publishing `https://orla.com` as canonical/`og:url`/`og:image`; the vendor JSON-LD did the same — both now use the real origin, with a **grep guard** beside the brand-literal one. (3) `img.clerk.com` was missing from `img-src`, so the header avatar was **blocked for every signed-in user** — it survived review because the CSP was only ever exercised signed-out. **Acceptance verified live:** 4 security headers present with CSP **enforced**; robots disallows `/vendor/`, `/customer/`, `/dashboard`; sitemap 29 URLs, 16 vendors from the DB, 0 localhost leaks; `og:image` returns **200 image/png**; build emits no workspace-root warning; sign-in completes and search renders 16/16 images under the enforced CSP with 0 broken images. Clerk **telemetry** stays CSP-blocked — analytics, which this ticket excludes. **Also fixed:** CI had failed on **every push** for many commits on `format:check`; `design/uploads` joins `.prettierignore` (verbatim design imports, same rule as the `.dc.html` exports) and two hand-maintained docs were formatted. **CI is now green.** **Debt named, not cleared:** the CSP's `img-src` has no object-store origin because `S3_PUBLIC_URL` is unset on Vercel — harmless today (uploads are not yet served in prod) but it will block real uploads; belongs with **#47** |
| 34 | API Runtime Target — Vercel serverless vs container | P1.5 | M4.5 | P0 Critical | Done | — | #18 | `core` `storage` | **Resolved 2026-08-27 as decision D10: web on Vercel, API on Railway.** The API is a container, not a function — Vercel's **4.5MB** body cap breaks the 12MB uploads #29 specifies and would force presigned direct-to-R2, removing the server-side `sharp` re-encode that `images.ts` relies on as a security boundary; `sharp` is CPU-heavy; #8's SSE needs long-lived connections; and in-memory `@fastify/rate-limit` plus `createDatabase max: 10` both assume a bounded instance count. Railway gives all four. Rationale and the rejected alternatives are in `vendor-marketplace-decisions.md` D10. Cutover done in #44 |
| 35 | Post-Deploy Smoke Check — catch a green build that serves 500s | P1.5 | M4.5 | P1 High | Done | main | None | `core` | The API answered **500 on every route for 19h** while Vercel reported the deployment **Ready** — a build that never invokes a route cannot see a broken runtime export. Done `e648ebd`. `.github/workflows/smoke.yml` polls `/ready` (not `/health`), reads a real vendor from the API, then requires that vendor's own profile page to render the name — since #33 a public page returns 200 during an API outage, so status alone is no longer evidence. `/ready` now names the commit it serves (`RAILWAY_GIT_COMMIT_SHA`), so the check cannot be satisfied by the previous release; the first run retried 73s until `e648ebd` was answering. A timeout is a failure, verified end to end against a hanging server. Fails loudly, no auto-rollback. Stays until **#20** lands the gated pipeline |
| 36 | Landing Category Cards — real photography | P1 | M3 | P1 High | Done | main | None | `core` | Pushed 2026-08-27 (01bd8bf). Frame `01` parity confirmed in Chromium: radius 14px, `overflow:hidden`, card padding 0, 94px `object-fit:cover`, empty alt, inner `11px 13px 13px`, row top 552 < 836 fold, columns 2/3/6 at 390/768/1440. `music.jpg` → `entertainment.jpg` because the card resolves by **slug**, not icon. A promoted category with no image now fails a disk-check test by name. Closes **#32(a)** **OUT OF PARITY 2026-08-27:** vendor-card covers 4:3 → **3:2** (the landing *category* cards are unaffected — they stay 94px) → **#52** |
| 37 | Clay Search Button — pill vs circle discipline | P1 | M3 | P2 Medium | Done | main | None | `core` | Done `1de1189`. The compact header bar now renders the frame's control — a 32px clay circle holding an 11px ring with a 5px stem at 45°, per frames `17`/`18`; every other context keeps the labelled pill, mobile full-width included. The choice is an explicit `action` prop, not a breakpoint, so it follows the bar's role. `aria-label` keeps the accessible name and the glyph is unconditional, so a bare ring cannot return. Swept the app: every other clay circle is a decorative dot, badge or progress bar, never a control. Verified at 390/768/1024/1440, no overflow |
| 38 | Tab Identity — Orla favicon and the title it sits beside | P1 | M3 | P1 High | Done | main | None | `core` | Pushed 2026-08-27 (7a4b911). `icon.svg` + `apple-icon.tsx` derive from the same OFFSET_RATIO/STROKE_RATIO as `logo.tsx`; the Next default `favicon.ico` is deleted because it outranks `icon.svg` at that path. Tab title agreed with the user as **`Orla · Book event vendors`** (25 chars) — brand first, since a tab truncates from the right; the sentence stays on the share card as one named constant. Two guards added, both verified by breaking them. `brand-literals.test.ts` caught the first draft hardcoding the name |
| 39 | State Library — skeletons, dialogs, validation & the 403 surfaces | P1 | M3 | P1 High | Done | main | None | `core` | **5 of 12 rows closed** (`542db0c`, `21f6c4a`). Built and rendered: list-row skeleton (`/bookings/loading.tsx`), message-bubble skeleton (`/messages/loading.tsx`), element loader (now `Button loading`, consumed by the booking request and the message composer). Already satisfied and verified: `empty-state.tsx` (glyph · Serif headline · one sentence · one CTA) and the three-tier validation hook (`use-submit-validation.ts`, rendered by #7's form — costly shows at once, blockers only after a submit attempt, counted summary at the submit bar). Also corrected the spinner to the frame: a faint ring with a solid leading quarter at .8s, not a solid ring with a gap. **7 rows deferred with reasons and reassigned to their real owners** — table-row skeleton, 403 and rate-limit to **#15**; availability-conflict and destructive-confirm dialogs to **#10**; session-expired to **#58** (the draft is not persisted, so its copy would be untrue); listing-removed 410 needs a disclosure decision that reverses the recorded 404. Closed per its own acceptance: every row is built-and-rendered or deferred with a reason |
| 40 | Unexplained edit to `uploads/soundtrack-license.md` | P1.5 | M4.5 | P3 Low | Done | — | None | — | **Closed 2026-08-27 by the user: the audio uploads were marketing-only and are not needed, so the lost edit does not matter.** The working-tree change ("Home Was You" → "Meanwhile") disappeared during the #43 run and was not in any stash; the file reads "Home Was You" at HEAD. No action — recorded so a later audit does not re-open it |
| 56 | Vendor profile — identity row vertical rhythm (reported by the user) | P1 | M3 | P2 Medium | Done | — | None | `core` | **Closed as no-change 2026-08-28.** Measured live at 1440x900 against frame `03`; every value matches: row `align-items:flex-start`, `gap:16px`, `margin-top:-34px`, `padding-bottom:14px`; avatar 82x82 with a 4px border-box border; name block `margin-top:23px`; name 33px / line-height 36.3px. Avatar centre y=267.0 vs name centre y=267.1 — the name's first line is centred on the avatar to within 0.1px. The slightly-lower position the user noticed **is** what the frame draws, so nothing was changed |
| 57 | Compact search header — three parity gaps found during #37 | P1.5 | M4.5 | P3 Low | Done | main | None | `core` | Done `3324a79`. All three closed. The bar now takes the frames' measurements from `lg`: **40px/30px circle at 1024**, **42px/32px from 1280**. The date label shortens to **"Date"** in the compact bar, staying "Event date" on the hero. The control shows a **spinner while a search is in flight** (frames `17`, `25`), the flag crossing the results↔header boundary through a one-boolean context. **Decision recorded:** the frames only appeared to contradict each other — frame `02` alone draws a labelled pill with "Event date", while the five frames showing the bar in a working state (`17`, `18`, and the three at 1024) all draw the circle with "Date". Five against one is a stale frame, not a decision to escalate. Also moved `Spinner` out of `skeleton.tsx`, so the one-idiom guard's import signal is honest and `button.tsx` no longer needs an exemption |
| 60 | Portfolio uploads were refused after the move to object keys | P1.5 | M4.5 | P1 High | Done | main | None | `core` `storage` | Found and fixed 2026-08-28 while verifying #51, in `6da1dfd`. **Adding any portfolio photo was broken in production.** #47 changed uploads to store an object key so the CDN could move without a migration, and the client posts `portfolio/abc.webp` — but `createPortfolioItemSchema.imageUrl` was still `z.url()`, so every real upload was refused with a 400. A new `imageRefSchema` accepts the three shapes actually persisted — object key, site-relative seeded path, absolute URL for a Clerk avatar — and refuses `javascript:`, `data:`, protocol-relative and traversal, because an `img src` is a sink. Nothing had caught it because the API tests all used absolute URLs |
| 59 | Test suites fail intermittently under a parallel `pnpm test` | P1.5 | M4.5 | P3 Low | Done | main | None | `core` | Fixed in `6da1dfd`. Root cause was contention, not a defect: every db and api suite boots its own in-process Postgres, and `beforeAll` timed out on a different file each run. `packages/db` now runs its files **one at a time** and the api pool drops from three workers to two. Three consecutive full-suite runs green where it had been failing every run |
| 58 | The booking request draft is not saved anywhere | P1.5 | M4.5 | P2 Medium | Done | main | None | `core` | Done `74bed46`. `useSavedDraft` keeps the request **per vendor**, written on every change since none of the events it protects against gives warning, and stopped once sent — otherwise the next render writes the draft back after clearing it. The restore is **announced** in steel rather than silently filling the form. Every storage access is guarded: a private window, blocked site data or a full quota degrades to exactly the old behaviour. A draft in an older shape, unparseable, or over a month old is ignored; an untouched form is not a draft, since the date arrives pre-filled. Verified in the browser — typed, reloaded, restored. **Unblocks #39's session-expired dialog**, whose copy can now truthfully say the draft is saved |
| 61 | Preflight accepts a live key against a local target | P1.5 | M4.5 | P1 High | In Progress | main | None | `core` `auth` `stripe` | **Found 2026-08-28** while unblocking #9. `shapeFor()` returns the permissive `shape` for the `local` target and falls back to `productionShape` only for `production`, so a **live** Clerk or Stripe key reports "set, shape ok" locally. Four variables admit both modes. **The mirror of #48** — `CLAUDE.md` forbids local pointing at production and preflight enforces it for the Neon branch only |
| 63 | The ticket capability map stops at #37 | P1.5 | M4.5 | P1 High | Done | main | None | `core` | **Found 2026-08-28 while running #61's own gate.** `TICKET_CAPABILITIES` in `packages/shared/src/env/tickets.ts` has no row past **37**, so `pnpm preflight --ticket <n>` exits 2 with "Unknown ticket" for every ticket filed since — #38 through #62, twenty-five rows. The project convention is that a ticket does not move to `In Progress` until its gate passes, so the gate has been unrunnable as specified for every recent ticket. `registry.test.ts` requires the keys to be contiguous from 0, which is why a single row cannot be added on its own. #61 ran `--ticket 9` instead (the same `core auth stripe` set) and recorded the substitution. **Done 2026-08-29 (`4ee0c50`).** `TICKET_CAPABILITIES` now covers **0-229** and an unregistered ticket resolves to the baseline with a stderr warning instead of throwing, so `pnpm preflight --ticket <n>` runs for every board ticket — verified directly: `--ticket 165` passed 22 checks where it previously exited 2. A new `tickets.board.test.ts` ties the registry to the Status Board, so a ticket filed with no registry row goes red. |
| 62 | Stripe public business name is "VendYou", not Orla | P1.5 | M4.5 | P1 High | Blocked — needs a human | — | Stripe dashboard | `core` `stripe` | **Found 2026-08-28** from `stripe config --list` during #9 setup: `display_name = 'VendYou'`. Stripe renders the platform's public business name on the **hosted Connect Express onboarding page** (#9), on Checkout (#10), and as the statement descriptor on cardholders' statements. Harmless in sandbox, wrong in front of a real vendor. **A #19 prerequisite** — only the account holder can change it |
| 41 | Vendor profile — the tagline and the experience figure | P1 | M3 | P2 Medium | Done | main | #6b | `core` | Done `0fe9921`. `tagline varchar(80)` and `years_in_business` added via `pnpm db:generate` (`0007`), capped in the column **and** the Zod schema; experience is self-declared, because deriving it from the first completed booking is wrong for an established vendor joining today. Neither blocks publishing. Every absence renders: no tagline means no pull-quote, an unanswered figure means two tiles, and `0` reads **"Less than a year"**. Two seeded vendors are deliberately left without so those states are reachable. **Third tile changed:** `12-vendor-profile.md` names Experience/Events/Travels and defers a Replies tile, so Replies came out. Also corrected the tiles from the 14px card token to the frame's **12px**. Parity verified at 1440x900 — Instrument Serif italic 20px/1.4, stone-700, 620px cap, bio +14px, tiles +20px, 14px gap, 520px row — then 390 and 768. Production migrated by the Railway `preDeployCommand` and serving both fields |
| 42 | Soft 404 — `notFound()` returns HTTP 200 in production | P1.5 | M4.5 | P1 High | Done | main | None | `core` | Pushed 2026-08-28 (**0bd90cc**), CI green, **verified on the deployed origin**: `/vendors/<missing>` and `/definitely-not-a-route` both **404**, `/`, `/search` and a real vendor **200**, `/customer/dashboard` still **307** to sign-in. **The ticket's diagnosis was wrong and is corrected here.** Clerk's middleware does rewrite to the URL it already has (`decorateRequest` swaps `x-middleware-next` for `x-middleware-rewrite: <same url>`), but that is **not** what costs the status — proven by a 2x2: with the **original** middleware untouched and the root `loading.tsx` removed, every `notFound()` returns 404. **The root `loading.tsx` was the whole cause:** it is a Suspense boundary, Next streams everything inside one, so the 200 shell flushes before the page finishes and a later `notFound()` has nothing left to set — and at the root it wrapped every route in the app. A patch to unwrap Clerk's no-op rewrite was written, measured, found unnecessary, and **reverted**. **Fix:** the loader is unchanged and became `components/ui/page-loader.tsx`, mounted on `/customer` and `/vendor` — the two segments that await identity and never call `notFound()`. **Guardrail:** `app/loading-boundaries.test.ts` walks the app directory and fails if any loading boundary sits at or above a page calling `notFound()`; verified to fail on all three counts with the old root file restored. Middleware and matcher are byte-unchanged, so nothing was opened |
| 19 | Production Environment Provisioning | P1.5 | M4.5 | P0 Critical | Deferred — needs a human | — | #17 | all | **BLOCKED on a human** — external accounts only, no repo code. Parallel with #18; schedule after #10  **Deferred 2026-08-28:** the ticket says so itself — "almost entirely external account configuration rather than repository code", with a provisioned environment rather than a diff as its deliverable. Every value must be newly minted in Clerk, Stripe, R2 and Resend by the account holder; nothing here can be produced autonomously |
| 20 | Deploy Pipeline | P1.5 | M4.5 | P0 Critical | Backlog | — | #18, #19, #30 | `core` | First production deploy |
| 12 | Review System | P2 | M5 | P1 High | Backlog | — | #10 | `core` `auth` | Fills the Reviews tab on frame `03` and the write-review flow. **MVP because the landing page promises "Reviews from real bookings" and every vendor card renders a rating** |
| 11 | Transactional Email Notifications | P3 | M6 | P2 Medium | Deferred — needs a human | — | Resend API key | `core` `auth` `email` | **BLOCKED on credentials, not code** (checked 2026-08-28): `pnpm preflight --ticket 11` fails on `RESEND_API_KEY — still the placeholder re_...`; `EMAIL_FROM` is set. The project's own rule is that a ticket does not start until the gate passes, and the acceptance requires verifying that each row of the event table actually sends. **Unblocks with one key** from https://resend.com/api-keys. Everything it hangs off is ready: `NOTIFICATION_TYPES` is the shared enum, and #7/#8 already emit every event at a single call site, so email attaches there without a second source of truth |
| 14 | Demo Dataset + Playwright E2E | P3 | M6 | P1 High | Backlog | — | #12 | all | **Content gap partly closed by ef8b341:** `pnpm db:seed:marketing` now seeds 16 photography vendors with covers, packages, and 918 reviews behind 918 completed bookings. **Still open here:** the other 10 categories (5 of 6 landing cards still lead to an empty search), portfolio images, messages, notifications, the non-completed booking statuses, and the 8 E2E suites. Asset tracking for the covers is **#32** |
| 15 | Admin Portal + Sentry Integration | P3 | M6 | P1 High | Backlog | — | #12, #14 | `core` `auth` `sentry` | Frame `22`. **MVP-minimal** — `/suspended` already exists and implies suspension, so something must be able to suspend. Preflight enforces `sentry` |
| 64 | Flaky test in `packages/preflight` under parallel Turbo runs | P1 | M1.5 | P2 Medium | Backlog | — | None | `core` | **Found 2026-08-28** while gating the #61 env-shape commit. `pnpm test --force` failed `@vendor-marketplace/preflight#test` at **1 failed / 131 passed (132)**; an immediate rerun and `pnpm --filter @vendor-marketplace/preflight test` in isolation both passed **132/132**. The failing test's name was **not captured** — the run was piped through `tail -20`, so only the summary survived. Reproduce with the full log: `pnpm test --force > /tmp/t.log 2>&1` in a loop. Suspect contention, not logic: the suite took **36s** inside the Turbo fan-out against **2.15s** isolated, a 17x stretch that points at a real-clock or filesystem assumption rather than a stable failure. Use `/debug-flaky-test`. Gating on a suite that fails ~1 run in 2 is the actual cost here |
| **65** | **Vendor profile — the identity row overlaps the cover by 34px, not 16px (reported by the user)** | **P1** | **M3** | **P1 High** | **Done** | — | **None** | `core` | **Closed 2026-08-29 as not reproducible — this is a stale spec line, not a live defect.** Re-measured at 1440x900 by `parity-checker`: the live overlap is **16.00px** and **frame `03`'s own markup also renders 16.00px** (frame cover bottom 262 / avatar top 246; app 260 / 244). The `-34px` is the identity row's `margin-top`, cancelled by the content column's `padding-top:18px` — **in the frame markup too** (`padding:18px 28px 0 40px`). The 34px figure comes only from frame `03`'s `sc-d` caption and `12-vendor-profile.md`'s prose, and `04-laws.md` precedence puts rendered markup first and the caption last. #105 measured the same thing and is correctly Done. **No code changed.** Filed #283 to correct the caption and the plan line, since `design/` is not writable from a ticket. **DESIGN DROP 2026-08-29:** superseded by **#287**; the overlap it re-measured no longer exists at any width. |
| **66** | **Unvalidated URL input crashes six ways into a 500** | **P1** | **M3** | **P0 Critical** | **Done** | `worktree-66` | **None** | `core` | **Adversarial sweep 2026-08-28.** 7 URLs anyone can paste return 500. Rule added: `.claude/rules/web-route-boundaries.md`. **Merged 2026-08-29 (`0f7ddbe`, PR #8), CI green.** All ten URLs verified in a browser at both auth states: the four `?date=` shapes, both price overflows and `?page=0` return **200** with a line naming what was cleared; the five bad slugs return **404** on the designed page. The 300-char slug needed a second fix — the API answers an over-long slug **414**, not the 400 its schema gives a malformed one, so `getPublicVendorProfile` now checks the slug before it makes a request. Ships the `maxLength` half of the governing rule too, because the new boundary made a long paste fail silently. Branch was `worktree-66`; `.claude/lanes/66.json` records `lane/66`, a ref that never existed |
| **67** | **`POST /booking-requests` has no idempotency — 3 clicks created 3 bookings** | **P1** | **M3** | **P0 Critical** | **Done** | `worktree-67` | **None** | `core` `auth` | **Adversarial sweep 2026-08-28.** Server-side; UI guard only covers a physical double-click. **Implemented 2026-08-29 on `worktree-67`.** Two unique partial indexes on `booking_requests` (`booking_requests_live_package_key`, `booking_requests_live_custom_key`), split because `package_id` is nullable and Postgres treats NULLs as distinct — one index would still admit two identical *custom* requests. Predicated on the **live** statuses, `pending` and `quoted`, not on `pending` alone: a vendor who quotes a custom request moves it out of `pending` without settling it, and the customer resubmitting would open a second thread for one date (found by `diff-reviewer`). `LIVE_BOOKING_REQUEST_STATUSES` is derived from `BOOKING_REQUEST_TRANSITIONS` so it cannot drift, and a test reads `pg_indexes` to hold the SQL predicate to it. `insertRequest` uses a **targeted** `ON CONFLICT DO NOTHING`; the service re-reads the natural key and returns the existing request with **200 and the original id**. All three create writes now run in one transaction with the live push after commit — without it a row that committed before a later write failed would be found by every retry, which skips the side effects by design, so the vendor would never be told (found by `security-auditor`; regression test forces the failure with a Postgres trigger, no mocks). Migration `0008` is a hand-written `--custom` data repair that clears pre-existing duplicates so `0009` can build the indexes; `0009` is `pnpm db:generate` output, unedited. Both applied cleanly to a **clone of the real dev database** (921 rows). Browser-verified end to end at 1440x900 on the final code with no shim: 9/9 items, bursts of 6 and 8 each yielding exactly one 201, 15 requests to 15 notifications 1:1, zero console errors. **Acceptance item 4 was already satisfied** — the dev database holds zero duplicate live requests; the ticket's prose was stale. The surviving junk row is `2999-12-31` (already `declined`, not `9999-12-31`) and belongs to #77 | **Merged 2026-08-29 (`c676e2c`, PR #10), CI green.** Lane torn down; the branch was `worktree-67`, not the `lane/67` the manifest recorded.
| **68** | **An accepted, priced booking dead-ends — no detail, quote approval or checkout** | **P1** | **M3** | **P0 Critical** | **Backlog** | — | **#9, #10** | `core` `auth` `stripe` | Blocks parity on frames `05`, `06`, `21` — no live screen to compare |
| **69** | **Filter popovers unreachable below 1440 and stay open after use** | **P1** | **M3** | **P1 High** | **Backlog** | — | **None** | `core` | Languages 719px tall, no `max-height`; clicks time out at 1024 and 390 |
| **70** | **The app is broken below 768px — messaging dead end, notifications off-screen** | **P1** | **M3** | **P1 High** | **Backlog** | — | **None** | `core` | 390 is a designed breakpoint; notif panel renders at x=-80 |
| **71** | **Long tokens are never broken — one pasted link overflows its bubble** | **P1** | **M3** | **P1 High** | **Backlog** | — | **None** | `core` | Invisible to the page-level overflow assertion; an ancestor clips it |
| **72** | **Error and empty-state copy violates `40-states.md` in five places** | **P1** | **M3** | **P1 High** | **Backlog** | — | **None** | `core` | Raw API strings reaching users; an empty state names a filter that does not exist |
| **73** | **The six accessibility laws are violated and nothing was checking them** | **P1** | **M3** | **P1 High** | **Backlog** | — | **None** | `core` | Sixth `Access` parity axis added 2026-08-28; card focus ring is 100% clipped |
| **74** | **Adopt the frames' line-height — the app's type scale contradicts every frame** | **P1** | **M3** | **P1 High** | **Done** | `worktree-74` | **None** | `core` | **User ruling 2026-08-28: the frames win.** **Criteria half-met — read before closing.** Every `--text-*--line-height` is now `normal`, `display-xl` corrected 1.08→1.04, `--leading-prose` added as the named exception. Browser-measured at 1440x900: **2 of the 5 acceptance controls closed** (landing pill 33→29.00 = frame; `Request booking` line-height component closed exactly, +2.00 residual is a stray transparent border). **3 did not** — category card +6.25, search chip +3.75, profile chip +3.25. Cause is **#235**, not this change: those controls are sized by arbitrary `text-[Npx]`, which emits no line-height and inherits Preflight's 1.5. Unblocks #198 and the 59 tickets gated on this one | **Merged 2026-08-29 (`47c081f`, PR #9), CI green.** Lane torn down. The 3 unclosed controls are #235, not this ticket.
| **75** | **Landing, Search and Vendor profile fail parity on 35 counts** | **P1** | **M3** | **P0 Critical** | **Backlog** | — | **#74** | `core` | Parity batch 1. Full `expected` vs `observed` tables in the sweep ledger |
| **76** | **Sign-in redirect discards the destination** | **P1** | **M3** | **P1 High** | **Done** | main | **None** | `core` `auth` | **Done 2026-08-29 (`dbd7d78`).** The return leg already existed from #116; the outbound half was missing. Middleware stamps the requested path so the `/customer` and `/vendor` **layout** gates can carry it too (a layout is never told its child's URL); pages that know their own destination pass it and win. Header is `set`, not merged, and still re-validated by `safeReturnPath`. Browser-verified at both auth states on lane 82: all five routes preserve path+query, both round trips land on the destination not `/`, and `https://evil.example`, `//evil.example` and `/x/..//evil.example` all collapse to the role default with **zero off-origin navigations**; a chain fuzz over **894,419** inputs found no origin escape. Two review finds fixed here: `DASHBOARD_PATH_BY_ROLE.admin` pointed at `/bookings`, itself gated by `requireRole('customer')` — an **infinite redirect** that carrying a destination made reachable from every protected route (now `/`); and `redirectIfSignedIn` dropped the destination on the second-tab reload path. Middleware also strips Next's `_rsc`. Web tests 978 → **1018**. Filed #255 for the 401-degrades-to-empty-state inconsistency found while testing. |
| **77** | **Event date has no upper bound — a booking for the year 9999 goes through** | **P1** | **M3** | **P2 Medium** | **Backlog** | — | **None** | `core` | Lower bound is handled well, which makes this an oversight |
| **78** | **`DrizzleQueryError` is logged without its cause** | **P1** | **M3** | **P2 Medium** | **Backlog** | — | **None** | `core` | 7 occurrences during the sweep, none diagnosable |
| **79** | **Vendor nav labels and order diverge from frame 08** | **P1** | **M3** | **P2 Medium** | **Backlog** | — | **None** | `core` | `Edit profile` vs `Business profile`; missing entries may be deferred scope |
| **80** | **Five live routes have no design frame, so parity is unprovable on them** | **P1** | **M3** | **P2 Medium** | **Backlog** | — | **None** | `core` | 38 frames vs 15 routes; `/customer/profile` and `/suspended` have no coverage at all |
| **81** | **Nine smaller defects found in the adversarial sweep** | **P1** | **M3** | **P2 Medium** | **Backlog** | — | **None** | `core` | Grouped; split any that grows |
| **82** | **01 Landing — `All 11 categories →` is rendered as a padded pill, not a plain span** | **P1** | **M3** | **P2 Medium** | **Done** | `worktree-82` | **#74** | `core` | Parity sweep 2026-08-28, finding `PB1-1`, axis **Style** — **Done 2026-08-29 (lane 82).** Frame re-rendered in Chromium with webfonts loaded (`document.fonts.status === 'loaded'`) and compared from computed DOM styles at 1440x900 in a cookie-less guest context. Frame `01 Landing` draws a bare `<span>` at `padding:0`, `border-radius:0`; live was an `<a>` 133.52x29 at `padding:6px 12px`, `border-radius:8px` from `Button variant="ghost" size="sm"`. Dropped the `Button` wrapper; link now measures `padding:0px`, `border-radius:0px`, colour `rgb(163,74,40)` matching the frame. The `Button`'s focus ring was re-spelled on the link so Access does not regress. Residual 1px height is the 12.5px-vs-13px font size, which is #86. Checks read: `pnpm typecheck` 7/7, web suite 779 passed (69 files), including a new regression test asserting the pill classes are gone and the ring remains. |
| **83** | **01 Landing — Header `Sign up` pill is 8px too tall** | **P1** | **M3** | **P2 Medium** | **Done** | `worktree-82` | **#74** | `core` | Parity sweep 2026-08-28, finding `PB1-2`, axis **Style** — **Done 2026-08-29 (lane 82).** Measured from computed DOM styles at 1440x900 (guest, cookie-less) against frame `01 Landing` re-rendered in Chromium with webfonts loaded. Now an **exact** match: 82.05x36 at 13px, frame identical. The ledger's "the entire residual is text-base 13.5 vs 13" was wrong — a DOM range shows the *text* was already identical in both (46.05x16), so the 13.5->13px change alone left 84.05x38. Two causes: (1) no 13px step existed, so `--text-action: 13px` was added, derived in `type-scale-parity.test.ts` from frame `01 Landing`'s own header pill and section action link (the pill *shape* is drawn at 11.5/12.5/13px across all frames, so shape alone cannot fix a size); (2) the Button base's `border border-transparent` is an invisible but real 1px box on every side — the whole 2x2px residual — removed for `ink` only. `ink` is documented as the marketing header's sign-up and lives nowhere else, so no other control moved; `site-header.tsx` was NOT touched (#117-#123's lane). `text-action` also registered in `lib/utils.ts` PROJECT_FONT_SIZES — without it tailwind-merge groups an unknown `text-*` as a colour and silently drops `text-stone-50`, which it did until fixed. Checks read: `pnpm typecheck` 7/7, web suite 783 passed (69 files), type-scale-parity 35 passed. **Registering a new `--text-*` step in `lib/utils.ts` PROJECT_FONT_SIZES is mandatory, not optional** — tailwind-merge resolves `text-*` by name, an unrecognised one carries no unit to give it away, so it lands in the **colour** group and drops whichever colour class it meets. This is the same latent defect #198 found for the rest of the scale, and it caught this ticket too: the pill rendered dark-on-dark until `action` was registered. `utils.test.ts` reads the theme and fails if a step is added to one file and not the other. |
| **84** | **01 Landing — Hero `Search` button has the wrong box and padding** | **P1** | **M3** | **P2 Medium** | **Done** | `worktree-82` | **#74** | `core` | Parity sweep 2026-08-28, finding `PB1-3`, axis **Style** — **Done 2026-08-29 (lane 82).** Now an **exact** match: 102.2x44 at `padding:13px 28px`, 14px — frame identical. Re-derived the frame myself by rendering it in Chromium with webfonts loaded, per the correction that the ledger carries mis-transcriptions: the frame **is 44**, and my own first render said 43 only because the webfonts had not loaded, which is exactly the trap. Live was 92.55x38 from `sm:px-6 sm:py-2.75 sm:text-base` in `search-bar.tsx`; now `sm:px-7 sm:py-3.25 sm:text-cta`. Added `--text-cta: 14px` (no 14px step existed), derived in `type-scale-parity.test.ts` from frame `01 Landing`'s own clay submit, since a clay 999px pill is drawn at 10/11/12.5/13/14px across the frames; registered in `lib/utils.ts`. **Also closed the un-ticketed hero-bar regression for free**: the bar's height follows its tallest child, so it went 52px -> **58px**, the frame's value, the moment the button was right. Checks read: `pnpm typecheck` 7/7, web suite 786 passed (69 files). **A later `parity-checker` pass challenged this number, reporting the frame as 102.2x**43** with the bar at **57px** and calling this entry a mis-transcription. That challenge is wrong and should not be resurrected.** It measured an **extracted, programmatically-substituted copy** of the frame block in a standalone file (and injected `scrollbar-width:none`), not the frame in situ. Re-measured in situ with `document.fonts.ready` awaited, webfonts asserted loaded, no ancestor `transform`/`zoom` (checked) and `devicePixelRatio` 1, frame and app agree to three decimals: Search **102.203 x 44**, bar **727.594 x 58**. `browser-verifier`, driving its own Chromium independently, also measured 44. Two independent in-situ measurements against one extracted-copy measurement — the lesson is that a frame must be measured **where it lives**, since extracting a frame block changes its layout context. |
| **85** | **01 Landing — Hero badge renders 11px instead of 12px** | **P1** | **M3** | **P2 Medium** | **Done** | `worktree-82` | **#74** | `core` | Parity sweep 2026-08-28, finding `PB1-4`, axis **Font** — **Done 2026-08-29 (lane 82).** Now an **exact** match: badge measures 161.86x27 at 12px live, and the frame's own badge measures 161.86x27 at 12px — same width to the hundredth, same 5x5 dot, `padding:6px 12px`, `gap:7px`, `margin-bottom:18px`, colour `rgb(142,63,32)`. One-class change: `text-xs` (`--text-xs` is 11px) -> `text-meta`. No new token needed — #198 had already added `--text-meta: 12px` and the badge had simply never been moved onto it. Checks read: web suite 787 passed (69 files), `pnpm typecheck` 7/7. **A later `parity-checker` pass challenged this number, reporting the frame as the badge as 161.85x**26.5** and calling this entry a mis-transcription. That challenge is wrong and should not be resurrected.** It measured an **extracted, programmatically-substituted copy** of the frame block in a standalone file (and injected `scrollbar-width:none`), not the frame in situ. Re-measured in situ with `document.fonts.ready` awaited, webfonts asserted loaded, no ancestor `transform`/`zoom` (checked) and `devicePixelRatio` 1, frame and app agree to three decimals: badge **161.859 x 27**. `browser-verifier`, driving its own Chromium independently, also measured the badge unchanged. Two independent in-situ measurements against one extracted-copy measurement — the lesson is that a frame must be measured **where it lives**, since extracting a frame block changes its layout context. |
| **86** | **01 Landing — Hero `Search` and `All 11 categories →` are a half-step small** | **P1** | **M3** | **P2 Medium** | **Done** | `worktree-82` | **#74** | `core` | Parity sweep 2026-08-28, finding `PB1-5`, axis **Font** — **Done 2026-08-29 (lane 82).** Both halves now match the frame's sizes. `Search` 13.5px -> **14px** (`--text-cta`, landed with #84's padding in the same change, since the frame's 44px height needs both). `All 11 categories →` 12.5px -> **13px** (`--text-action`, added in #83). Confirmed from computed DOM styles: 13px/600, `letter-spacing:normal`, `rgb(163,74,40)`, height 16 — the frame's value exactly. The 13px and 14px steps did not exist; per the coordinator's ruling they were added as role-named steps following #198's convention and are **derived from frame `01 Landing` in `type-scale-parity.test.ts`**, not written down as numbers. Residual: live width 111.8 vs the frame's 110.47. Not a style divergence — string, family, size, weight and tracking are identical; the frame is **1 text node** and the app **5**, because React splits around `{categories.length}`, and shaping does not kern across node boundaries. Closing it would mean hard-coding the count, which `page.test.tsx` requires stay derived from the taxonomy. Checks read: web suite 788 passed (69 files), `pnpm typecheck` 7/7. |
| **87** | **01 Landing — Category card titles carry negative tracking the frame does not** | **P1** | **M3** | **P2 Medium** | **Done** | `worktree-82` | **#74** | `core` | Parity sweep 2026-08-28, finding `PB1-6`, axis **Font** — **Closed by re-measurement 2026-08-29 — no code written.** Re-measured by `parity-checker` against current main, and independently re-confirmed by this lane from computed DOM styles at 1440x900. All six category titles (`ul[aria-labelledby="categories-heading"] h3`) compute `letter-spacing: normal` — was `-0.425px` — matching frame `01 Landing`'s `.sh`. Family/size/colour also match exactly (`400 17px "Instrument Serif"`, `rgb(35,32,28)`), and rendered text widths are identical (189px content box in both). Closed by #165, which removed the `globals.css` `h1,h2,h3 { @apply font-display tracking-tight; }` rule. NOTE: `line-height` on the same node is a separate, still-open divergence (25.5px vs the frame's `normal`=22px, ticket #235's arbitrary-`text-[17px]` class) — #87 is closed on tracking only. |
| **88** | **01 Landing — Hero City field shows a placeholder where the frame has a literal** | **P1** | **M3** | **P2 Medium** | **Backlog** | — | **Human ruling — hero city seed value** | `core` | Parity sweep 2026-08-28, finding `PB1-7`, axis **Text** — **BLOCKED 2026-08-29 (lane 82): needs a product ruling, not code.** Verified the divergence is real from computed DOM styles at 1440x900: frame `01 Landing` hard-codes the literal `Austin, TX` in the City segment (15px, `rgb(35,32,28)`), while live is `input.value === ''` with `placeholder="Anywhere"` (`hero-search.tsx`, `EMPTY_QUERY = { category:'', city:'', date:'' }`). Note the frame **templates** the vendor type (`{{ searchValue }}`) but **hard-codes** the city, so this is a genuine literal mismatch rather than a placeholder the canvas filled in. **The question a human must answer: should an untouched hero search bar arrive pre-filled with `Austin, TX`?** It is not written into the plan either way. It is not cosmetic — pre-filling a city seeds the query a visitor submits, so it changes results and intent, and `LAUNCH_CITY`/`LAUNCH_REGION` already exist in `page.tsx` to render it if the answer is yes. Not guessed at, per defer-rather-than-guess. |
| **89** | **01 Landing — Hero search segments share one bar-level focus ring, so the focused segment is unidentifiable** | **P1** | **M3** | **P1 High** | **Done** | `worktree-82` | **None** | `core` | Parity sweep 2026-08-28, finding `PB1-8`, axis **Access** — **Done 2026-08-29 (lane 82).** Access defect confirmed and fixed, measured in a real browser after the 150ms `transition-all` settled (measuring early gives every ringed element a false negative). **Before:** each of the three segments resolved its own ring to `0px` spread while only the *bar* painted `oklab(clay/0.2) 0 0 0 3px`, so focusing `Vendor type` and focusing `City` were pixel-identical and a keyboard user could not tell which held focus. **After, proven by driving Tab and reading computed backgrounds:** focusing `Vendor type` tints the type segment only (`oklab(clay/0.1)`) with City and Event date at `rgba(0,0,0,0)`; focusing `City` tints City only, with the other two transparent. A tint, not a ring: the component documents that a rectangular ring around one segment breaks past the pill's edge and reads as a second misaligned box, so the bar's halo is kept for "the bar has focus" and the tint answers "which segment". Covers all three — the `Vendor type` trigger lives in `category-select.tsx`, the other two are `<label>`s in `search-bar.tsx`. Checks read: web suite 790 passed (69 files), `pnpm typecheck` 7/7. |
| **90** | **02 Search — Header is inset 40px while everything below it is inset 26px** | **P1** | **M3** | **P1 High** | **Done** | `worktree-90` | **#74** | `core` | Parity sweep 2026-08-28, finding `PB1-9`, axis **Layout** — Done in lane `worktree-90`, commit `91a9f96`. `parity-checker` re-measured at 1440x900 in a guest context 2026-08-29: `nav[aria-label="Main"]` computes `padding: 0px 26px` and the logo rect is `x=26`, against frame `02`'s `.hd padding:0 26px` and logo `x=26` — was 40px/`x=40`. Frames `17` and `18` draw the same 26px; the landing header is untouched at 40px, asserted. Checks read: typecheck 7/7, eslint clean, web suite 787/787 |
| **91** | **02 Search — Header search bar is undersized** | **P1** | **M3** | **P2 Medium** | **Done** | — | **#74** | `core` | Parity sweep 2026-08-28, finding `PB1-10`, axis **Layout** — **Closed 2026-08-29 as superseded — no code written.** Measured live at 1440x900: the compact bar rect is **560x42**, against frame `02`'s 582x45. But frames `17 Search loading` and `18 Search no results` both draw `height:42px` on this bar, and the three 1024 search frames draw 40px — the live 42px is exactly what five frames specify. Filed against a frame already ruled stale: superseded by #57's recorded ruling, `3324a79`, restated at `search-bar.tsx:224` — *"five against one is a stale frame, not a decision to escalate"* |
| **92** | **02 Search — The `Style` filter chip is missing from the Refine bar** | **P1** | **M3** | **P1 High** | **Blocked** | — | **#74** | `core` | Parity sweep 2026-08-28, finding `PB1-11`, axis **Layout** — **BLOCKED 2026-08-29 by lane `worktree-90` — duplicate of #25, and not a rendering change.** `refine-bar.tsx:320-328` already records this as a named deviation from the frame and names #25 (`Style Tags — Category-Specific Refine Chip`) as its owner. `11-search.md:123` defines `Style ▾` as *category-specific* tags whose option set changes with the selected vendor type; `tagCategoryEnum` is a Postgres enum with no `style` member and no tag→vendor-category link, so this needs an enum migration plus a style taxonomy invented for eleven categories. **Question: close as a duplicate of #25, or is #92 meant to be the rendering half once #25 has seeded the data?** **Independently corroborated 2026-08-29 by lane 82's frame-02 pass**: live Refine bar renders `REFINE · $500 – $3,200 ▾ · 4★ &amp; up ✕ · Languages ▾ · Cultural ▾ · Dietary ▾ · Clear` — 6 chips where the frame draws 7 — and the knock-on is that `Clear` sits at x **615.7** against the frame's **670.28**. Confirms this is a real frame-axis gap blocked on data-model work, not a rendering bug. The question below still stands. |
| **93** | **02 Search — The 4-column result grid only exists at exactly ≥1440** | **P1** | **M3** | **P1 High** | **Done** | — | **#74** | `core` | Parity sweep 2026-08-28, finding `PB1-12`, axis **Layout** — Re-measured 2026-08-29 by `parity-checker` against current main (#74/#165/#198 landed). At exactly 1440x900 the results grid computes `grid-template-columns: 335px 335px 335px 335px`, `gap: 16px`, grid rect `{x:26, w:1388}` — identical to frame `02 Search`, whose grid computes the same from `repeat(4,1fr)`. MATCH at the 1440 acceptance viewport. `GRID_COLUMNS` in `search-shell.tsx` is unchanged (`lg:grid-cols-3 min-[90rem]:grid-cols-4`) and 1439px still yields 3 columns at `457px`/`gap:14px`, but `search-shell.tsx:38-46` cites frame `25 Search results — 1024` for that behaviour, so the sub-1440 column count is a plan question, not a 1440 parity failure. **Closed by re-measurement — no code written** |
| **94** | **02 Search — Header submit is a 32x32 icon button where the frame specifies a text pill** | **P1** | **M3** | **P1 High** | **Done** | `worktree-90` | **#74** | `core` | Parity sweep 2026-08-28, finding `PB1-13`, axis **Style** — **Re-scoped and half-closed 2026-08-29.** The *style/text* half — the frame `02` text pill versus the 32px clay circle — is **closed as superseded**: superseded by #57's recorded ruling, `3324a79`, restated at `search-bar.tsx:224` — *"five against one is a stale frame, not a decision to escalate"*, and #57 implemented the circle to the five frames (30px at 1024, 32px from 1280). The circle stays. The **Access half was never settled by #57 and is the half that was built**: `04-laws.md:133` requires an icon-only control to carry a 44x44 hit area with no exemption, and it is independent of which frame wins the shape. Commit `0674d19`. The paint is unchanged at `size-7.5`/`xl:size-8`; a centred `after:size-11` pseudo-element grows the target to 44x44 past the circle, verified in the browser at 1440x900: the painted circle is still 32x32 at (629.7, 15.5), `::after` computes 44x44, and `elementFromPoint` resolves to the button at all four corners of the target and at its centre, while 23.5px out resolves to the nav. At 1440 the target's left edge and the date field's right edge both sit at 623.7, abutting with **0px overlap**, and both inputs remain clickable at their centres and edges. `diff-reviewer` then showed that clearance is exact rather than general — (44 − 32) / 2 is precisely the `ml-1.5` gap, so it holds only where the circle is 32px. Between `lg` and `xl` the circle is 30px and the target covers the date label's last pixel column. One pixel, and the 44x44 law is the harder constraint, so the hit area stands; the comment was corrected to record the overlap rather than claim clearance at every width (`0a9a1f1`, `b5ad1aa`) The separate `ring-offset-0` defect on the same control is **#240** |
| **95** | **02 Search — Header bar border and shadow are off-token** | **P1** | **M3** | **P2 Medium** | **Done** | — | **#74** | `core` | Parity sweep 2026-08-28, finding `PB1-14`, axis **Style** — **Closed 2026-08-29 as superseded — no code written.** Measured live at 1440x900: border `rgb(228,221,209)` = `#E4DDD1` = `stone-300`, shadow `rgba(35,32,28,0.06) 0 2px 10px` = `--shadow-sm`. Frames `17` and `18` draw `border:1px solid #E4DDD1` and `box-shadow:0 2px 10px rgba(35,32,28,.04)`'s sibling `0 2px 10px rgba(35,32,28,.06)` — i.e. the live values are byte-exact to the five ruled frames, and it is frame `02`'s `#DDD5C7` / `0 1px 3px rgba(35,32,28,.04)` that is the outlier. `#DDD5C7` appears twice in the whole bundle and has no token. Filed against a frame already ruled stale: superseded by #57's recorded ruling, `3324a79`, restated at `search-bar.tsx:224` — *"five against one is a stale frame, not a decision to escalate"* |
| **96** | **02 Search — Vendor card radius is 18px, not 16px** | **P1** | **M3** | **P2 Medium** | **Done** | `worktree-90` | **#74** | `core` | Parity sweep 2026-08-28, finding `PB1-15`, axis **Style** — Done in lane `worktree-90`, commit `636c1a8`. `article.group/card` computes `border-radius: 16px` on all 11 rendered cards, against frame `02`'s `.card border-radius:16px` — was 18px. `--radius-2xl` is left at 18px deliberately: the frames genuinely draw 18px on modals, panels and three overridden cards, so repointing the token would have moved those to fix this. Web suite 787/787 |
| **97** | **02 Search — Card avatar is 34px where the frame is 32px + a 2px ring** | **P1** | **M3** | **P2 Medium** | **Done** | `worktree-90` | **#74** | `core` | Parity sweep 2026-08-28, finding `PB1-16`, axis **Style** — Done in lane `worktree-90`, commit `070bb16`. The card `[role=img]` computes 36x36 with `border: 2px solid rgb(255,253,249)` and `font-size: 13px`, at `(40, 388.08)` against the frame's `(40, 388)` — pixel-exact on all 11 cards. The frame is content-box, so its 32px circle plus a 2px ring occupies 36; the app is border-box, so `sm` becomes 36 and the fill comes out at the frame's 32. Was 34x34 with a 30px fill and a 14.28px glyph. `sm` is the vendor card's size and nothing else uses it. Web suite 787/787 |
| **98** | **02 Search — Sort is a native select where the frame specifies a chip** | **P1** | **M3** | **P2 Medium** | **Done** | `worktree-90` | **#74** | `core` | Parity sweep 2026-08-28, finding `PB1-17`, axis **Style** — Done in lane `worktree-90`, commit `9d0e398`. No `<select>` remains on the screen (`querySelectorAll("select").length === 0`); the control is now a `Chip` whose trigger is `button[aria-label="Sort: Most relevant"]` with `padding: 7px 13px`, `font-size 12.5px`, `font-weight 600`, `color rgb(35,32,28)`, on a chip with `border-radius: 8px`, `border 1px solid rgb(228,221,209)`, `background rgb(255,253,249)` — every token the frame sets, and its right edge lands on 1414.0 against the frame's 1414. Options are a radio group, single-choice like the control they replace. The two residual deltas are other tickets: height 34.75 vs 31 is #235, width 120.28 vs 92 is the `Most relevant`/`Top rated` label in #102. **Three defects in this work were then found and fixed.** `browser-verifier` found that tabbing out of the open panel stranded focus on `<body>`, so the next Tab restarted at "Skip to content" — the panel is portalled to the end of `<body>` and only a single-tab-stop panel reaches that boundary, so the fix went into the shared `Chip` (`938bf3b`) and covers every chip; re-verified in the browser, Tab now lands on the trigger and the Tab after it on `/vendors/kessler-co`. `diff-reviewer` found the behaviour had **no test at all** — replacing the radio `onChange` with a no-op passed all 121 tests — and that the parity assertions were hardcoded while citing the frame. Both fixed in `4a176a0`: all five options now assert the state they write, the panel dismisses on choice as the `<select>` did, and the parity numbers are read from frame `02` at test time. The same mutation now fails five tests. Web suite 795/795 |
| **99** | **02 Search — Vendor-card clay monogram is off-token** | **P1** | **M3** | **P2 Medium** | **Blocked** | — | **None** | `core` | Parity sweep 2026-08-28, finding `PB1-18`, axis **Colour** — **BLOCKED 2026-08-29 by lane `worktree-90` — needs a palette decision.** The frame draws `#EADCCB` and does so systematically: 19 of its 30 uses are `border-radius:50%;background:#EADCCB`, i.e. the clay avatar fill across the whole file. But `03-components.md:99-103` says the opposite — *"Initials fallback: Instrument Serif on `clay-100` (`clay-600` text) or `sage-100`"* — and `clay-100` **is** the `#F7E7E0` now rendering, so the plan endorses the current code. `#EADCCB` has no token: `theme.css:19-25` runs `clay-50 #fdf4ef → clay-100 #f7e7e0 → clay-200 #efd8cc`, and it is not on that ramp. The codebase contains **zero** arbitrary hex colours, so this cannot be a class swap. The sage variant is already byte-exact (`#E4E9DE`/`#4B5940`), so only clay is in question. **Question: add a token for `#EADCCB` — and under what name, since it is not a step on the clay ramp — or correct the plan and keep `clay-100`?** **New evidence 2026-08-29 from lane 82's frame-02 pass, and it points at the frame rather than the app.** The other search frames **agree with the current code**: `17 Search loading` and `27 Search results — 1024` both draw the card avatar as `#F7E7E0`/`#8E3F20` — exactly what ships. Frame `02` alone carries `#EADCCB`. Measured contrast also favours the app: `clay-100`/`clay-600` = **6.06:1**, the frame's `#EADCCB`/`#8E3F20` = **5.41:1**. So the live value is on-token, higher-contrast, endorsed by `03-components.md` and consistent with three of four frames. **Recommendation: do not add a token and do not change the app — correct frame `02` in the design pass.** Sage is already byte-exact. |
| **100** | **02 Search — Card meta line is small and splits the rating into a second weight** | **P1** | **M3** | **P2 Medium** | **Done** | `worktree-90` | **#74** | `core` | Parity sweep 2026-08-28, finding `PB1-19`, axis **Font** — Done in lane `worktree-90`, commit `a39608a`. With the sr-only expansion stripped the visible line is byte-identical to the frame — `★ 4.9 (127) · Austin, TX` — and every part computes `font-weight: 400` and `rgb(107,100,89)` on a `font-size: 12px` / `line-height: normal` line. The `font-semibold text-stone-700` span carried nothing else, so it was removed rather than emptied. Web suite 787/787 |
| **101** | **02 Search — Header date label reads `DATE`, not `EVENT DATE`** | **P1** | **M3** | **P2 Medium** | **Done** | — | **None** | `core` | Parity sweep 2026-08-28, finding `PB1-20`, axis **Text** — **Closed 2026-08-29 as superseded — no code written.** Measured live at 1440x900: the third micro-label renders `DATE` (source `Date` plus `uppercase`). Frames `17` and `18` and all three 1024 search frames draw `Date`; only frame `02` draws `Event date`. `search-bar.tsx:218-226` already carries the ruling in a comment. Filed against a frame already ruled stale: superseded by #57's recorded ruling, `3324a79`, restated at `search-bar.tsx:224` — *"five against one is a stale frame, not a decision to escalate"* |
| **102** | **02 Search — Header values render raw instead of formatted** | **P1** | **M3** | **P2 Medium** | **Done** | `lane-82-public-routes` | **None** | `core` | Parity sweep 2026-08-28, finding `PB1-21`, axis **Text**. Re-scoped 2026-08-29: the sort and city halves are frame *states*, not defects, and were dropped. **Done 2026-08-29 (`fcbf2be`, merged `44948a9`).** The date segment rendered the native picker; the fix extends the existing empty-state overlay to the filled state, so the native field stays transparent while unfocused and focusing hands the picker straight back. Spelling follows the ruled majority — **`Sep 13, 2026` at 1440** (frames `17`, `18`), **`Sep 13` at 1024** (the three `27`s, `14 mobile`); frame `02`'s `Sun, Jun 14` is one frame against five. Both spellings render and width chooses, so nothing changes under the reader after mount. Date parsed as **UTC** per `shared-contracts.md`, and guarded — `not-a-date`, `2026-13-45`, `0000-00-00` assert non-throwing, since `?date=` is attacker-writable and `Intl` throws `RangeError` on a bad value. Browser-verified at both widths; native input colour `rgba(0,0,0,0)`, value intact. Tests read the expected literals **out of the design bundle** rather than duplicating them; removing the overlay fails three. |
| **103** | **03 Vendor profile — Profile uses a centred `max-w-7xl` container where the frame is full-bleed** | **P1** | **M3** | **P1 High** | **Done** | `worktree-103` | **#74** | `core` | Parity sweep 2026-08-28, finding `PB1-22`, axis **Layout** **Done 2026-08-29.** Shell is full-bleed: the `mx-auto max-w-7xl` container is gone from both `page.tsx` and `profile-header.tsx`, replaced by the frame's own gutters (`lg:px-10` = 40px, `lg:gap-x-7` = 28px, rail `380px`). **Measured live at 1440x900, guest, from computed styles:** content column x=40, rail x=1020 w=380 (right edge 1400) — the frame exactly; was 112/948/1328. `Recent work` row now 40..720, matching the frame. Test `frame-03-parity.test.ts` derives the rail width and both gutters from `Orla - Screens.dc.html` at test time, so a design re-import fails the test rather than passing silently. **Re-verified MATCH 2026-08-29** by lane 82's frame-03 `parity-checker` pass, re-measured after #74/#165/#198/#251 landed: grid x=0 w=1440, `gridTemplateColumns: "952px 380px"`, no `max-w-7xl`. |
| **104** | **03 Vendor profile — Booking rail starts 82px too low** | **P1** | **M3** | **P1 High** | **Done** | `worktree-103` | **#74** | `core` | Parity sweep 2026-08-28, finding `PB1-23`, axis **Layout** **Done 2026-08-29.** The frame opens both columns directly under the banner, so `ProfileHeader` now owns the two-column row and takes the tabs and the rail as slots; the rail column carries the frame's own `padding-top: 20px` (`lg:pt-5`). **Measured live at 1440x900, guest:** rail card top is now cover-bottom **+20px** exactly (was +102.8px). The banner, identity row and rail all sit inside the one non-clipping wrapper, so the overlap guarantee #65/#53 established is preserved — asserted directly by a new ordering test. **Re-verified MATCH 2026-08-29** by lane 82's frame-03 `parity-checker` pass, re-measured after #74/#165/#198/#251 landed: rail card top 280 = cover bottom 260 + 20; frame 282 = 262 + 20, delta **0**. **DESIGN DROP 2026-08-29:** superseded by **#287** — the rail no longer opens under a banner, because there is no banner. |
| **105** | **03 Vendor profile — Avatar overlaps the cover by 34px instead of 14px** | **P1** | **M3** | **P1 High** | **Done** | `worktree-103` | **#74** | `core` | Parity sweep 2026-08-28, finding `PB1-24`, axis **Layout** **Done 2026-08-29.** The frame builds the overlap from two declarations — content column `padding-top: 18px`, identity row `margin-top: -34px` — netting **16px**. The shipped page copied the -34 and dropped the 18. Added `pt-[18px]` to the content column. **Measured live at 1440x900, guest:** overlap is now **16px** (was 34), and the business name starts at y=267 against a cover bottom of 260 — **7px clear of the photograph**, where it previously rendered 11.3px inside it. That also clears the Access failure `parity-checker` raised: 33px Serif over unscrimmed vendor-supplied imagery has no guaranteeable contrast. **LEDGER CORRECTION:** the sweep recorded this as a **14px** overlap; rendering `Orla - Screens.dc.html` headless at 1440x900 gives **16px**, and the frame is the contract. **DUPLICATE — #65 is the same defect.** #65 (Backlog, "identity row overlaps the cover by 34px, not 16px", reported by the user 2026-08-28) reaches the identical 16px number and the identical `pt-[18px]` fix by injection. #65 is not this lane's to touch and was left alone. **I believe #105 should survive and #65 should be closed as a duplicate of it** — #105 carries the frame-derived regression test and is part of the frame-03 parity set, whereas #65 is a standalone user report of the same measurement; whoever reconciles the board decides. **Also flagged, not actioned:** `design/design-plan/12-vendor-profile.md` states the avatar "overlaps the banner by 34px", transcribing the CSS `margin-top` as if it were the rendered overlap. It contradicts the frame and should be corrected by a design pass — nothing under `design/` was edited here. **Re-verified MATCH 2026-08-29** by lane 82's frame-03 `parity-checker` pass, re-measured after #74/#165/#198/#251 landed: **16.00px in the app and 16.00px in the frame** — see #65, which measured the same thing against a stale caption. **DESIGN DROP 2026-08-29:** superseded by **#287**; the avatar no longer overlaps anything. |
| **106** | **03 Vendor profile — `See all 34 →` is missing from the `Recent work` header** | **P1** | **M3** | **P2 Medium** | **BLOCKED — needs demo data** | — | **#74** | `core` | Parity sweep 2026-08-28, finding `PB1-25`, axis **Layout** **BLOCKED 2026-08-29 — the code is already correct; the gap is seed data.** `portfolio-strip.tsx` renders `See all {items.length} →` whenever `items.length > 4`, styled `text-[12.5px] font-semibold text-clay-500` — and `clay-500` is `#a34a28`, which is byte-identical to the frame's `rgb(163,74,40)`. The header row is `max-w-[680px]` with `items-baseline justify-between`, and **measured live it now spans 40..720, matching the frame exactly** after #103. The link does not render because `GET /vendors/june-harlow` returns **1 portfolio item**, not the 34 the frame depicts, so there is correctly nothing more to see. `seed-marketing.ts` seeds no portfolio images at all — **#14 owns that** ("Still open here: ... portfolio images"). No code change would make this MATCH without fabricating gallery content, which the MVP law forbids. **Question for whoever unblocks:** should #106 wait on #14 seeding portfolio images, or be closed as "already implemented" and its parity re-check folded into #14? **Re-confirmed blocked 2026-08-29 by lane 82's frame-03 pass:** all 16 seeded vendors carry **exactly 1** portfolio item, and `PortfolioStrip` renders the link only when `items.length > 4`. The unblock is a seed change, same shape as #113's. |
| **107** | **03 Vendor profile — Booking rail is missing the `Event date` + `Guests` field pair** | **P1** | **M3** | **P1 High** | **Done** | `worktree-103` | **#74** | `core` | Parity sweep 2026-08-28, finding `PB1-26`, axis **Layout** **Done 2026-08-29.** `Event date` and `Guests` now share a row above `Package`, at the frame's `flex: 1` / `flex: .7` with a 10px gap. **Measured live at 1440x900, guest:** the two fields are **194.13px and 135.88px with a 10px gap** — the frame's numbers to two decimals — and sit above the package select. Both answers travel to `/vendors/[slug]/request` in the query string, so nothing collected here is asked again on frame `04`: `?date=` was already supported, and `?guests=` is new and **parsed at the route boundary** per `.claude/rules/web-route-boundaries.md` — a non-integer, zero, negative or over-cap value is dropped rather than rendered. `min={today}` stops a past date being requested. Test derives the ratio, the gap and the three-label order from `Orla - Screens.dc.html` at test time. **Re-verified MATCH 2026-08-29** by lane 82's frame-03 `parity-checker` pass, re-measured after #74/#165/#198/#251 landed: one row, gap 10px, `flex-1` 194.13px + `flex-[0.7]` 135.88px — identical to the frame to 0.01px. |
| **108** | **03 Vendor profile — Package control uses stone-0 where the frame specifies the `.inp` token** | **P1** | **M3** | **P2 Medium** | **Done** | `worktree-103` | **#74** | `core` | Parity sweep 2026-08-28, finding `PB1-27`, axis **Style** **Done 2026-08-29.** All three rail controls now carry the frame's `.inp` token, read from the frame's own stylesheet: `.inp{background:#F1ECE4;border:1px solid #E4DDD1;border-radius:10px;padding:10px 13px;font-size:13.5px}`. The fill is `stone-150`, whose theme comment is literally "input fill" — the shipped control drew `stone-0`, the card colour, on an input. **Measured live at 1440x900, guest:** background `rgb(241,236,228)`, padding `10px 13px`, radius 10px, border `rgb(228,221,209)`, font 13.5px — and **height 38px, the frame exactly**. **The height delta the sweep attributed to #235 was not #235:** it was the native select's own box, and `appearance-none` removes it. **LEDGER CORRECTION:** the sweep recorded `.inp` as **h39**; the rendered frame is **38**. **Deliberate deviation, recorded:** the element stays a real `<select>` — only the OS-drawn arrow is replaced by the frame's `▾` glyph (`aria-hidden`, `pointer-events-none`) — so the keyboard, the screen reader and the mobile picker are unchanged. Rebuilding it as the frame's styled `div` would trade the Access axis for the Style axis. **One residual, 1.5px:** the `Event date` input measures 39.5px against 38 because Chrome's `::-webkit-calendar-picker-indicator` sets its own intrinsic height; the `Guests` input and the select are both exactly 38. **Follow-up from the final `parity-checker` pass:** that pass measured the `Event date` input at **39.5px** against `Guests` and `Package` at 38 — Chromium's `type=date` carries an intrinsic height from its own calendar sub-control — leaving the frame's paired row with bottom edges 1.5px out of line. The shared field class now pins **`h-[38px]`**, which is the frame's own arithmetic (16px line box + 10px padding twice + 1px border twice). **Re-measured live at 1440x900, guest: all three controls 38.00px, and the pair's bottoms align exactly.** A test derives that 38 from the frame's `.inp` padding and border and asserts all three controls share one class so they cannot drift apart again. **Re-verified MATCH 2026-08-29** by lane 82's frame-03 `parity-checker` pass, re-measured after #74/#165/#198/#251 landed: `select` background `rgb(241,236,228)` = `#F1ECE4` = stone-150 = the frame's `.inp`. |
| **109** | **03 Vendor profile — Attribute chips and portfolio tiles are 2px over-rounded** | **P1** | **M3** | **P2 Medium** | **Done** | `worktree-103` | **#74** | `core` | Parity sweep 2026-08-28, finding `PB1-28`, axis **Style** **Done 2026-08-29.** Both were 2px over-rounded because both reached for the nearest token instead of the frame's number. Chips move from `rounded-md` (8px, the table-control step) to **`rounded-sm`** — 6px, and its theme comment names this exact use, "badges, category chips, small pills". Strip tiles move from `rounded-xl` (14px, the card step) to a literal **`rounded-[12px]`**, since 12px sits between the 10px and 14px steps and has no token; that is the same call #41 made for the stat tiles on this screen. **Measured live at 1440x900, guest:** chip `border-radius: 6px`, tile `border-radius: 12px`. Tile box also confirmed at **161x118**, matching the frame's 4x161 grid and its intended 118px height — the frame's raw rect reads 138 only because the `.ph` placeholder class adds `padding:10px`. **Scope note:** the Portfolio *tab* pane keeps `rounded-xl`; frame `03` draws only the About tab's strip, and that pane is a different surface. **Re-verified MATCH 2026-08-29** by lane 82's frame-03 `parity-checker` pass, re-measured after #74/#165/#198/#251 landed: chip `border-radius:6px` and tile `12px` both match the frame. **A different 2px is still open**: the chip row is 38px vs 36 because each chip is wrapped in a block `<li>` whose line box adds 2px above the inline-block span. |
| **110** | **03 Vendor profile — `Send a message` is disabled where the frame shows it enabled** | **P1** | **M3** | **P1 High** | **BLOCKED — needs a product decision** | — | **#74** | `core` | Parity sweep 2026-08-28, finding `PB1-29`, axis **Style** **BLOCKED 2026-08-29 — the control has no destination to be enabled towards.** The ticket's premise has half-changed: **#8 Messaging is Done**, so the shipped copy "Messaging opens shortly." is stale. But messaging has **no entry point from a vendor profile**. `messaging.routes.ts` exposes only `GET /conversations`, `GET **Facts re-measured 2026-08-29 by lane 82's frame-03 pass, no decision taken.** Live: `<button disabled>` with `disabled:opacity-50`, `cursor:default`, **skipped entirely by keyboard Tab**, effective contrast **3.19:1**. Nothing on the page explains why — the "Messaging opens shortly." prefix that used to was removed under #114. The frame draws it **enabled** (`.btnS`, opacity 1, `#23201C` on `#FFFDF9`, 9.47:1, in the Tab order). Disabled controls are exempt from 1.4.3, but this one is disabled unconditionally for every visitor on every vendor, so the exemption is carrying a permanent state rather than a transient one. |POST /conversations/:id/messages` and `POST /conversations/:id/read` — there is **no `POST /conversations`**. The single place a conversation is ever created is `booking-requests.dao.ts:328`, as a side effect of submitting a booking request. So a customer who has not yet requested a booking has no conversation with this vendor and no way to open one. Enabling the button today would either 404 or land on an empty `/messages` — a control that opens nothing, which is the exact failure #31 ruled against and the reason it was disabled in the first place. Enabling it properly needs a new "start a conversation from a profile" capability (endpoint + DAO + the pre-booking conversation state), which is a product decision and new API surface, not a parity fix. **Also note:** #114 removes the `Messaging opens shortly.` prefix from the reassurance line, because frame `03` does not carry it — which leaves this disabled control with no explanation anywhere. `40-states.md` wants the blocker named next to the control it blocks, so **whoever unblocks #110 must place that explanation on the button itself** (`aria-describedby` plus a visible line), not back in the shared reassurance sentence. **Question:** should `Send a message` get a real pre-booking conversation (new endpoint), or should it stay disabled with the blocker named next to it until that capability is scheduled? **Confirmed user-visible by `browser-verifier` 2026-08-29**, driving the page as a guest: the control is natively `disabled` with `opacity: 0.5` and `pointer-events: none`, a full **29-stop keyboard walk never reaches it**, and there is **no `title`, no `aria-describedby` and no `[title]` attribute anywhere on the page** — the only nearby copy is the payment reassurance, which is about something else. A user sees a greyed-out button with no reason given. This is the `40-states.md` gap #114 opened and must be closed when #110 is unblocked. |
| **111** | **03 Vendor profile — Vendor name and `Recent work` carry excess negative tracking** | **P1** | **M3** | **P2 Medium** | **Done** | — | **#74** | `core` | Parity sweep 2026-08-28, finding `PB1-30`, axis **Font** **Done 2026-08-29 by re-measurement — no code was written.** The finding was measured against an app that no longer exists: **#74, #165 and #198 have since landed** and changed the computed font metrics. A fresh `parity-checker` pass at 1440x900, signed out, reading computed styles off both the live page and `Orla - Screens.dc.html` rendered headless, reports **MATCH on both halves**: the business name `h1.font-display.text-[33px]` computes `letter-spacing: normal` (frame: `normal`) at font-size 33px, line-height 36.3px, Instrument Serif, `rgb(35,32,28)`; `Recent work` `h2.display-heading.text-[20px]` computes `letter-spacing: -0.2px` (frame: `-0.2px`) at font-size 20px. The sweep's observed `-0.825px` / `-0.5px` are both gone. The **Font axis is a clean MATCH for the whole screen** on that pass. The h2's rect is 30px against the frame's 26px, which is `line-height: 1.5` inheriting into a `text-[Npx]` arbitrary utility — **that is #235, not this ticket**, and it is not a letter-spacing defect. **Re-verified MATCH 2026-08-29** by lane 82's frame-03 `parity-checker` pass, re-measured after #74/#165/#198/#251 landed: h1 `letter-spacing: normal` (frame sets none); `Recent work` `-0.2px` = `-.01em` = the frame's `.h2`. |
| **112** | **03 Vendor profile — Rail is missing the `Free on <date>` availability line** | **P1** | **M3** | **P1 High** | **Done** | `worktree-103` | **None** | `core` | Parity sweep 2026-08-28, finding `PB1-31`, axis **Text** **Done 2026-08-29.** The rail now draws the frame's availability line on the `From` row, for the date chosen in the `Event date` field #107 added. **Measured live at 1440x900, guest, driving the field:** a future free date renders **"Free on December 5"** in `rgb(75,89,64)` — `sage-600`, byte-identical to the frame's `#4B5940` — at font-size 12px, weight 600, baseline-aligned with `From` and right-aligned to the card's 20px padding (right edge 1380 of a card ending at 1400). A **blocked** date and a **past** date each render nothing. **Availability is read the way the request form reads it:** a vendor publishes only the days they are *not* free, so a date absent from the calendar is available (`calendar[date] ?? 'available'`) — the same expression `booking-request-screen.tsx:166` uses, so the two surfaces can never disagree about a date. The date is formatted from its parts, not `new Date(value)`, which reads a bare `YYYY-MM-DD` as UTC midnight and would name the day before in any western timezone. **Recorded gap:** an unavailable date draws *nothing* here rather than a negative line — frame `03` has no such state and inventing the copy would breach the MVP law; the request form names it in `40-states.md` copy on the next screen. **Re-verified MATCH 2026-08-29** by lane 82's frame-03 `parity-checker` pass, re-measured after #74/#165/#198/#251 landed: renders `Free on September 20`, 12px/600/`rgb(75,89,64)`, right edge x=1380 — the frame's exact position and token. Conditional on a searched date, which a static frame cannot distinguish. |
| **113** | **03 Vendor profile — Rail is missing the `· N hour coverage` duration suffix** | **P1** | **M3** | **P2 Medium** | **Done** | `lane-82-public-routes` | **None** | `core` | **Done 2026-08-29 (`cf03fbf`, merged `d782ef1`).** Was never a missing feature — `duration_hours` was **null on all 48 seeded packages**, so the rail's existing conditional never fired. The hours were in the seed all along as free text in `inclusions`, which the rail does not read. **Populating it immediately turned `/vendors/:slug` into a 500 for every vendor with a package**: `duration_hours` is a `decimal`, the driver returns those as strings, and `publicVendorProfileSchema` declares a number — null had been satisfying the nullable schema and hiding the mismatch, which would have shipped the first time a real vendor set a duration. Coerced in the DAO (same idiom the profile already uses for `avgRating`) so every caller gets the contract's type. Browser-verified: rail renders **`· 4 hour coverage`** beside `$1,450`. API tests assert both the number **and** that the null case still returns 200; reverting the coercion turns the first into a 500. |
| **114** | **03 Vendor profile — Reassurance line is prefixed with copy the frame does not carry** | **P1** | **M3** | **P2 Medium** | **Done** | `worktree-103` | **None** | `core` | Parity sweep 2026-08-28, finding `PB1-33`, axis **Text** **Done 2026-08-29.** `Messaging opens shortly.` is gone from the reassurance line, which now reads exactly the frame's sentence: `You won't be charged yet — <vendor> confirms the date first.` **Measured live at 1440x900, guest:** the rendered string is `You won't be charged yet — June Harlow confirms the date first.`, and it is back to **one line** (the prefix had wrapped an 11.5px helper onto two, 34.5px against the frame's 17.25px). The test reads the sentence out of `Orla - Screens.dc.html` and substitutes the vendor for the frame's persona name, so a re-import that rewords it fails rather than drifts. **Coupling recorded — read with #110:** that sentence was the *only* explanation the disabled `Send a message` button had. #110 is BLOCKED (no way exists to start a conversation from a profile), so the control is currently disabled with no explanation anywhere. `40-states.md` wants the blocker named beside the control it blocks, **not** folded back into the shared reassurance sentence — that requirement is recorded on #110 and must be satisfied when it is unblocked. **Re-verified MATCH 2026-08-29** by lane 82's frame-03 `parity-checker` pass, re-measured after #74/#165/#198/#251 landed: `You won't be charged yet — June Harlow confirms the date first.` No prefix. |
| **115** | **03 Vendor profile — Curly quotes where the frame uses straight** | **P1** | **M3** | **P3 Low** | **Done** | `worktree-103` | **None** | `core` | Parity sweep 2026-08-28, finding `PB1-34`, axis **Text** **Done 2026-08-29.** Three curly characters replaced with the frame's straight marks: the pull-quote's `&ldquo;`/`&rdquo;` around the tagline, and `&rsquo;` in both `won't be charged yet` and the empty-bio line. **The code comment justifying the curly marks was factually wrong about the frame** — it claimed "the quotation marks are the frame's, and they are curly". Byte-checked: the frame's pull-quote opens on `3e 22 51` (`>"Q`, **U+0022**), and frame `03` contains **zero** curly characters. Comment corrected rather than deleted, so the next reader does not re-introduce it. **Measured live at 1440x900, guest:** a TreeWalker over every rendered text node outside `<script>`/`<style>` finds **no curly characters at all**, and the pull-quote's first code point is **34**. **Tradeoff recorded:** the original rationale was real — a straight quote *inside* a tagline now reads ambiguously (`"They said "unforgettable" and meant it."`, covered by an existing test) — but the frame is the acceptance criterion and screen-wide consistency is worth more. **Out of scope, observed:** one curly apostrophe survives in an RSC script payload for the **not-found** route (`This page isn't here`) — a different screen's copy, not frame `03`, and not touched. **Re-verified MATCH 2026-08-29** by lane 82's frame-03 `parity-checker` pass, re-measured after #74/#165/#198/#251 landed: straight `"` U+0022 and `'` U+0027. Frame 03's entire non-ASCII set is `· — → ▾ ★` — **zero curly codepoints**. |
| **116** | **03 Vendor profile — Signed-out `Request booking` loses the destination** | **P1** | **M3** | **P1 High** | **Done** | `worktree-103` | **None** | `core` | Parity sweep 2026-08-28, finding `PB1-35`, axis **Interaction** **Done 2026-08-29.** A signed-out `Request booking` now preserves the destination. `requireCurrentUser()` takes an explicit `returnTo` and redirects to `/sign-in?redirect_url=<path>`; the sign-in page forwards it to `/after-sign-in`, which honours it over the role default. The destination is passed **by the caller, not sniffed from a header** — the page knows its own URL exactly, including the package/date/guests query, and a header would have to be trusted and reassembled. **Measured live at 1440x900, guest, in a fresh cookie-less context** (header confirmed `Sign in`/`Sign up`): clicking `Request booking` with a package, `2026-12-05` and 120 guests lands on `/sign-in` carrying `redirect_url=/vendors/june-harlow/request?package=76122fb5…&date=2026-12-05&guests=120`. At the HTTP layer the cookie-less request answers **307** with that same `location`, against a bare `/sign-in` and an empty `location.search` before. **Open-redirect boundary, treated as one:** `safeReturnPath` accepts only a same-origin *path* — never a URL, not even one on our own origin, because a path cannot express an origin — and rejects absolute URLs, scheme-relative `//host`, encoded `%2f%2f`, backslash and mixed slash-backslash forms, `javascript:`/`data:`, control characters (the header-splitting vector), malformed encoding, over-length values, and any path that loops back into the auth flow. **Re-validated in `/after-sign-in` itself**, the handler that actually performs the redirect, rather than trusted because an earlier screen looked at it. **23 unit tests** cover the rejections; verified live that `?redirect_url=https://evil.test/steal` does not leave the origin, and that the hostile value reaches no href, action or redirect target (it appears only inside Next's RSC flight payload as the serialised request URL, JSON-escaped in a script, which is framework behaviour for any query string). **SECURITY REVIEW FOUND TWO DEFECTS IN THE FIRST CUT; both fixed here, tests fail before and pass after.** **(1) `redirect_url` is Clerk's reserved query key.** Verified in the installed source — `@clerk/shared` `redirectUrls.mjs` `#getRedirectUrl` does `result ||= this.fromSearchParams.redirectUrl` **before** consulting `fallbackRedirectUrl`, and `#parseSearchParams` reads it as `camelToSnake('redirectUrl')` = `redirect_url`. So clerk-js consumed the destination itself and **skipped `/after-sign-in` entirely**, taking the role resolution, the suspended-account branch and this module's own re-validation with it — leaving Clerk's `isAllowedRedirect` as the only guard. The param is now the app-owned **`returnTo`**, which is in none of Clerk's reserved keys, so `fallbackRedirectUrl` is honoured and the app's own path through the flow is restored. **(2) `safeReturnPath` validated a different string than it returned.** It decoded, checked the un-normalised pathname, then returned the decoded value — so dot segments walked past the loop guard (`/x/../sign-in`, `/x/%2e%2e/sign-in`) and encoded `%26`/`%3D` were promoted into structural delimiters, injecting parameters into a destination already reported safe. It now parses with the WHATWG URL parser against a placeholder origin and returns `pathname + search + hash`, so **what is validated is exactly what is redirected to**; it no longer decodes at all, which is what keeps `%2f` from becoming a slash. A **post-normalisation re-check** was added because `/x/..//evil.test` passes the leading test as written and resolves to `//evil.test` — returning that would have created the very open redirect the leading check prevents. **32 validator tests** (8 of them written failing first), plus **5 new `/after-sign-in` boundary tests** covering destination-wins-over-role-default, four hostile values falling back, suspended, and signed-out. `?guests=` parsing extracted to `parseGuestCountParam` with **16 tests** — the route-boundary rule requires a test asserting the hostile-input outcome and there was none. **Re-verified live, guest, cookie-less:** 307 to `/sign-in?returnTo=<full destination>`; `fallbackRedirectUrl` renders `/after-sign-in?returnTo=…` for a safe path and bare `/after-sign-in` for `https://evil.test/steal`, `//evil.test`, `/x/..//evil.test` and `/x/../sign-in`. **FILED, NOT FIXED (separate ticket, shared file):** `allowedRedirectOrigins` is unset on `ClerkProvider` in `apps/web/src/app/layout.tsx`, so Clerk defaults to a `https://*.<domain>` subdomain wildcard for its own redirect handling — one subdomain takeover would be an open redirect there. Out of this lane's scope and in a file another lane may hold. **Verified end to end by `browser-verifier` 2026-08-29.** Guest: `Request booking` lands on `/sign-in?returnTo=%2Fvendors%2Fjune-harlow%2Frequest%3Fpackage%3D…%26date%3D2026-12-05%26guests%3D80`. Signed in: straight to the request form with **`EVENT DATE` and `GUEST COUNT` prefilled** and the matching package in the summary — the prefill is the point of the change and it works. Every hostile value (`https://evil.test/steal`, `//evil.test/steal`, `https://localhost:3030.evil.test/x`, `/\evil.test`, `/x/../sign-in`, `javascript:`, `data:`) yields a bare `after-sign-in` with **no `returnTo`**, and none leaves localhost; only the legitimate relative path carries one. No 500s on any hostile URL. **Known residual, not fixed:** a visitor who is **already signed in** and opens `/sign-in?returnTo=<path>` lands on `/` and loses the destination, because `redirectIfSignedIn()` runs before `returnTo` is consumed. Not reachable from the flow this ticket fixes — a signed-in customer clicking `Request booking` never passes through `/sign-in` — so it is recorded rather than fixed here. |
| **117** | **08/09/11 shared — Header is missing the `Vendor` chip on every vendor screen** | **P1** | **M3** | **P2 Medium** | **Done** | `worktree-117` | **None** | `core` | Parity sweep 2026-08-28, finding `PB2-S1`, axis **Text** **Done 2026-08-29 (`7c9c689`, `53ce575`), lane 117.** Re-measured first: **still failing**, not self-closed. `RoleChip` renders beside the wordmark for the vendor role only, read from the local account record rather than Clerk metadata. Measured at 1440x900: 11px/600/.66px/uppercase, `rgb(75,89,64)` on `rgb(237,240,233)`, radius 5, padding 4px 8px, box **67.3 x 22** against the frame's **67.33 x 22**. **Took two attempts, and the browser caught both:** `leading-none` rendered it **19px** tall and removing it rendered **24.5px** (the inherited `line-height: 1.5` #198 flagged). The frame declares no line-height, so its 11px text takes the browser's *normal* leading — about 14px — and only `leading-[normal]` reproduces the frame's 22px. **A third defect was found by the diff review, not the browser:** the chip sat **4px** from the wordmark where the frame draws **13px** — the frame's cluster is a flex with `gap:9px` holding mark, wordmark and chip, and the chip carries `margin-left:4px` on top, so the chip is a *child* of that gapped row rather than a sibling of it. Now 13px, measured. It also renders only from `lg`, which is the frames' own split: drawn on `08`/`09`/`10`/`11`, `20` and both `27 … 1024` frames, absent from `14 Vendor dashboard mobile`, `14 Vendor profile mobile` and `14 Messaging tablet`. Test derives every value from the bundle at run time; it matches the chip on the sage pair **plus** the .06em tracking, because keying on the colour alone finds the vendor card's `Free Jun 14` pill |
| **118** | **08/09/11 shared — Header padding and logo size differ from the frame** | **P1** | **M3** | **P2 Medium** | **Done** | `worktree-117` | **#74** | `core` | Parity sweep 2026-08-28, finding `PB2-S2`, axis **Layout** **Done 2026-08-29 (`668cb0f`), lane 117.** Re-measured: **still failing**. Padding **40px → 32px** (`lg:px-10` → `lg:px-8`; `.hd` is the single header class all 36 frames use). Wordmark **24px → 23px**. The logo half was not a one-frame slip — `WORDMARK_SIZE_RATIO` was simply the wrong constant. Measuring every wordmark in the bundle: the frames pair a 15px mark with **23px** in **24** desktop headers, 14px with 21px on mobile, 19px with 29px on sign-up — all 23/15 to within half a pixel, where 1.6 gives 24/22.4/30.4. Frame `01 Landing` is the lone 24px outlier, so correcting the constant moves three surfaces onto the contract rather than special-casing one. The mark's 0.25px width difference (21.75 vs a declared 22) is left alone: out of scope. **PARTIAL — the padding half shipped, the logo half is BLOCKED on a human.** The ratio change was reverted before landing: `design/design-plan/02-brand-and-logo.md` states **"wordmark size 1.60 D"** as a law, and a lane may not edit the plan. The frames and the plan genuinely disagree — ten desktop frames pair a 15px mark with a **23px** wordmark (1.533), while frame `01 Landing` draws the **24px** that 1.60 produces — so this is a design pass, not a parity fix. **The question for a human: should `02-brand-and-logo.md` change the law to 23/15 (which also moves the sign-up panel 30.4→29.1px onto frame `12`'s 29px, and the mobile header 22.4→21.5px onto the frames' 21px), or do the vendor frames' 23px yield to the plan's 1.60?** Until that is answered the wordmark stays **24px** and the app matches the plan. Padding is verified: **32px** on `/vendor/*` and `/messages`, with `/` still **40px** and `/search` still **26px** |
| **119** | **08/09/11 shared — Sidebar and rail footprints are short because the frame boxes are not border-box** | **P1** | **M3** | **P1 High** | **Done** | `worktree-117` | **#74** | `core` | Parity sweep 2026-08-28, finding `PB2-S3`, axis **Layout** **Done 2026-08-29 (`eb03fb3`, `c33e00d`), lane 117.** Could not be re-measured at first — see the storefront note below — so it was implemented against the frame and verified once the route opened. **One cause, as the ticket title says:** the frames are content-box, Tailwind is border-box, confirmed by rendering the bundle in Chromium (`.side` and both rails all compute `box-sizing: content-box`; there is no global reset). `box-content` is the whole fix wherever the element declares its own width, and is right at **both** sidebar steps from one declaration — 200+25=225 (frame `09`) and 240+25=265 (frames `08`/`11`). **Two things it could not fix.** The availability rail is a grid *track*, so the track sizes the aside and box-sizing never gets a say; its column carries the 41px instead, and `--list-pane` keeps its 300px value because the messaging list is sized from the same token and has no gutters or border. And `box-content` can only add padding the element itself declares — the 12px gutters were on the inner `<ul>`, so the nav measured **241px** until they moved onto the nav where the frame's `.side` puts them. Verified at 1440x900: sidebar **265**, content column **x=265**, first heading **x=289**, dashboard rail **381**, availability rail **341** — every one the frame's own number |
| **120** | **08/09/11 shared — Header `Messages` / `Dashboard` links and the Clerk user button focus with no visible ring** | **P1** | **M3** | **P1 High** | **Done** | `worktree-117` | **None** | `core` | Parity sweep 2026-08-28, finding `PB2-S4`, axis **Access** **Done 2026-08-29 (`33e03db`, `16a5426`), lane 117. The only finding on this frame that partly self-closed.** Re-measuring found the header `Messages`/`Dashboard` links **already correct** — a global `:focus-visible` rule in `globals.css` landed between the sweep and this lane, so that half needed no code. Clerk's `Open user menu` still drew a single 4px clay at 50% alpha with no offset ring. **The fix took two attempts and the failure mode is worth keeping:** restating the rule against `.cl-userButtonTrigger` did nothing, and doubling the class for specificity did nothing either. **Clerk injects its styles into a later cascade layer, and a later layer beats an earlier one whatever the selector's specificity** — so no amount of weight inside `@layer base` can reach it. Moving both Clerk rules *out* of the layer is the fix, since unlayered rules outrank every layer. `focus-ring.test.ts` now asserts that placement, because putting them back inside the layer restores the bug silently while every other assertion still passes |
| **121** | **08/09/11 shared — Four icon-only controls are under the 44x44 hit area** | **P1** | **M3** | **P1 High** | **Done** | `worktree-117` | **None** | `core` | Parity sweep 2026-08-28, finding `PB2-S5`, axis **Access** **Done 2026-08-29 (`10d7ee3`, `e98bec5`, `16a5426`), lane 117.** Re-measured: **still failing**. All four now measure **44x44** at 1440x900 — `Open user menu`, `Notifications`, `Show earlier months`, `Show later months`. The button's `icon-sm` variant (36px) was the root of three and is **retired rather than resized**: all three of its callers were icon-only controls that had to grow, so keeping the name at 44px would make "sm" meaningless and keeping it at 36px would leave the trap for the next caller. There is now one icon size, compliant by construction. `input-group.tsx` has an unrelated variant of the same name, deliberately untouched. Clerk's trigger is grown in CSS — **the same cascade-layer trap as #120**: the diagnostic signal was that `min-width` applied while `min-height` did not, from a single rule declaring both, because Clerk sets `min-height` and no `min-width`. Only the hit area changes; the avatar keeps Clerk's size, so the control still looks as the frames draw it, which is what the law's own wording ("hit area", not icon size) asks for. **Closing browser pass (2026-08-29, lane 117) drove the whole flow and found no regression**: bell and user menu both 44x44 with an even 16px gap and a 32px inset, vertical centres 31.5 against a header centre of 32; Clerk's menu opens, closes on Escape and on outside click, its card aligned to 1px, avatar still 28x28 so only the target grew; focus rings visibly render on all six tab stops. **Regression risk checked and cleared:** frame `11` draws the month stepper as two bare inline chevron `<span>`s in a 13px baseline row, not a button pair, so growing them to 44x44 was a real threat to the 1.0x scroll budget `04-laws.md` puts on availability. Measured after the change: `scrollHeight` **900** = `clientHeight` **900**, no horizontal scroll, stepper row 44px — the pane absorbed it and the page still does not scroll. Dashboard likewise 900=900 |
| **122** | **08/09/11 shared — Notifications popover does not close on Escape** | **P1** | **M3** | **P1 High** | **Done** | `worktree-117` | **None** | `core` | Parity sweep 2026-08-28, finding `PB2-S6`, axis **Access** **Done 2026-08-29 (`ad0396b`), lane 117.** Re-measured: **still failing** — confirmed statically before touching it, there was no `keydown` handler at all, only a `mousedown` outside-click listener. A keyboard user who opened the panel had no way to shut it, and the empty state holds nothing focusable so there was not even a tab-out. Escape now closes it and restores focus to the trigger, which is held in a ref because closing unmounts the panel and focus would otherwise land on `<body>`. The listener is bound only while open, so Escape is not swallowed elsewhere. Driven in a real browser: `aria-expanded` true → false, focus back on the bell, and outside-click still works. Tests drive the DOM rather than the source; one presses keys that do **not** activate the trigger, because Enter and Space are the button's own toggle and would make a handler bound to every keydown look correct |
| **123** | **08/09/11 shared — Notification copy renders a raw ISO date** | **P1** | **M3** | **P2 Medium** | **Done** | `worktree-117` | **None** | `core` | Parity sweep 2026-08-28, finding `PB2-S7`, axis **Text** **Done 2026-08-29 (`c002aae`), lane 117 — closed by re-measurement, test-only.** All three notification bodies already route their date through `readableDate` (named month, `timeZone: 'UTC'`), so no production change was needed; an earlier ticket fixed it. **Not verified in the browser, and that is recorded honestly:** the e2e vendor has zero notification rows, so the panel renders empty and proves nothing. The regression guard was instead validated by reverting the interpolation to `${row.eventDate}` and watching it go red on both the bare-field and formatter assertions, then restoring it. It also pins `timeZone: 'UTC'` — `eventDate` is a date-only column and reading it locally slides it a day, which would put the wrong date in front of a vendor. **The frame carries no vendor notification panel**, so unlike the rest of this frame's findings the expected string cannot be read out of the bundle; what the frames do establish is that dates are written for a reader, never as ISO |
| **124** | **08 Vendor dashboard — `View my public profile` moved out of the header into the content column** | **P1** | **M3** | **P2 Medium** | **Blocked** | `worktree-124` | **#74** | `core` | **BLOCKED 2026-08-29 by lane 124 — needs a product decision, no code written.** Confirmed FAIL: the link renders in the content column at 12.5px/600 `rgb(163,74,40)`, where the frame puts it in the **app header** at 13.5px/500 `rgb(74,68,60)` beside the avatar. The fix is not local. That header slot is **per-screen** across the vendor frames — `08` draws `View my public profile`, `09` `Preview as customer`, `10` and `11` both `Dashboard` — so it is one contextual slot in `site-header.tsx`, which sits in the **root layout** and is shared chrome that frames 09/11 lanes are editing concurrently. It would also need the vendor's slug fetched in the root layout on every page. **Question: should `SiteHeader` gain a per-route contextual link slot (owned by one lane, filled per screen), or should each vendor surface keep rendering its own link and frames 08-11 be treated as deviating?** |
| **125** | **08 Vendor dashboard — Dashboard rail is 41px narrow** | **P1** | **M3** | **P1 High** | **Done** | `worktree-124` | **#74** | `core` | **Closed by re-measurement 2026-08-29 — no code written.** The rail already measures a **381px footprint / 340px content**, `box-sizing: content-box`, `padding: 20px`, `border-left: 1px`, exactly the frame. The ledger's 340/300 predates the shared-chrome merge `43ce159`, which added `xl:box-content` to `publish-checklist.tsx`. Lane 124, worktree `worktree-124` on `43ce159`, measured at 1440x900 against `[data-screen-label="08 Vendor dashboard"]` read in situ after `document.fonts.ready`; **every `expected` value in the ledger re-derived independently and confirmed correct for this frame**. Zero console errors. |
| **126** | **08 Vendor dashboard — Empty request pane has no panel, glyph or CTA** | **P1** | **M3** | **P1 High** | **Done** | `worktree-124` | **#74** | `core` | **Done 2026-08-29 (`789a880`, corrected by `1410e7d`).** The pane is now a frame-`20` panel: `bg rgb(255,253,249)`, `border 1px dashed rgb(213,206,194)`, `border-radius 18px`, `padding 0 40px`, flex column centred, **filling its column at 572.5px** where it was a 237px top-aligned stub. Adds `EmptyStateGlyph` (58x36, a filled 36px `stone-150` circle and a 1.5px-dashed `stone-400` circle offset 22px) and switches the CTA to the frame's `.btnS` secondary. `1410e7d` corrected the glyph to 1.5px and set the frame's 18/9/18 stack rhythm. Panel is opt-in so the other eight `EmptyState` call sites are untouched. Verified in the browser at 1440x900 from computed styles; 7 component tests; `pnpm test` 866 passing. Lane 124, worktree `worktree-124` on `43ce159`, measured at 1440x900 against `[data-screen-label="08 Vendor dashboard"]` read in situ after `document.fonts.ready`; **every `expected` value in the ledger re-derived independently and confirmed correct for this frame**. Zero console errors. |
| **127** | **08 Vendor dashboard — `See all N →` is missing beside `Requests waiting on you`** | **P1** | **M3** | **P2 Medium** | **Blocked** | `worktree-124` | **#74** | `core` | **BLOCKED 2026-08-29 by lane 124 — the control has no destination, no code written.** Confirmed FAIL: absent from the markup. But there is **no `/vendor/requests` route** (`apps/web/src/app/vendor/` holds only `dashboard`, `profile/edit`, `packages`, `portfolio`, `availability`) and no Requests entry in `vendor-nav.tsx`. Frame `08`'s sidebar draws `Requests 4`, `Bookings`, `Messages` and `Payments`, none of which exist. The dashboard already lists **every** pending request in a scrolling pane, so `See all N →` would either 404 or link to the page it is already on. **Question: should a `/vendor/requests` index be built (a new surface, well beyond a parity ticket), or should the dashboard cap its list at the frame's three rows and `See all N →` link there once that route exists?** |
| **128** | **08 Vendor dashboard — Stat card radius is 14px, not 12px** | **P1** | **M3** | **P2 Medium** | **Done** | `worktree-124` | **#74** | `core` | **Done 2026-08-29 (`2499d14`).** Stat cards now compute `border-radius: 12px`; `rounded-xl` resolved to 14px. The scale has no 12px step (`--radius-lg` 10px, `--radius-xl` 14px) so the value is literal, as `RoleChip` does for its 5px. Verified in the browser; test asserts all four cards. Lane 124, worktree `worktree-124` on `43ce159`, measured at 1440x900 against `[data-screen-label="08 Vendor dashboard"]` read in situ after `document.fonts.ready`; **every `expected` value in the ledger re-derived independently and confirmed correct for this frame**. Zero console errors. |
| **129** | **08 Vendor dashboard — Stat micro-labels use `text-xs` instead of the 10.5px micro-label** | **P1** | **M3** | **P2 Medium** | **Done** | `worktree-124` | **#74** | `core` | **Closed by re-measurement 2026-08-29 — no code written.** The stat micro-label already computes `600 / 10.5px / letter-spacing 0.525px / uppercase / rgb(107,100,89)` Instrument Sans. The ledger's `text-xs` (11px) predates `43ce159`, which moved it to the `text-label` + `tracking-label` tokens. Lane 124, worktree `worktree-124` on `43ce159`, measured at 1440x900 against `[data-screen-label="08 Vendor dashboard"]` read in situ after `document.fonts.ready`; **every `expected` value in the ledger re-derived independently and confirmed correct for this frame**. Zero console errors. |
| **130** | **08 Vendor dashboard — Stat delta line is 11px, not 11.5px** | **P1** | **M3** | **P3 Low** | **Done** | `worktree-124` | **#74** | `core` | **Done 2026-08-29 (`712740e`).** The delta line computes `11.5px`; `text-xs` resolved to 11px. Swapped to the existing `--text-helper` token rather than a new value. Verified in the browser on all four cards. Lane 124, worktree `worktree-124` on `43ce159`, measured at 1440x900 against `[data-screen-label="08 Vendor dashboard"]` read in situ after `document.fonts.ready`; **every `expected` value in the ledger re-derived independently and confirmed correct for this frame**. Zero console errors. |
| **131** | **08 Vendor dashboard — Rail label renders in Instrument Serif at 11px** | **P1** | **M3** | **P1 High** | **Done** | `worktree-124` | **#74** | `core` | **Closed by re-measurement 2026-08-29 — no code written.** The rail date heading already computes Instrument **Sans** `600 / 10.5px / 0.525px / uppercase / rgb(107,100,89)` — not Instrument Serif at 11px. Fixed by `43ce159`. Verified on both rail branches (published schedule label and the publish-checklist label). Lane 124, worktree `worktree-124` on `43ce159`, measured at 1440x900 against `[data-screen-label="08 Vendor dashboard"]` read in situ after `document.fonts.ready`; **every `expected` value in the ledger re-derived independently and confirmed correct for this frame**. Zero console errors. |
| **132** | **08 Vendor dashboard — Empty-state headline is 21px, not 26px** | **P1** | **M3** | **P2 Medium** | **Done** | `worktree-124` | **#74** | `core` | **Done 2026-08-29 (`555b473`).** The empty-state headline computes `26px` Instrument Serif, `letter-spacing normal`; it was `text-display-sm` (21px). Fixed in the shared component because `40-states.md` states the rule for **every** in-app empty state and a dashboard-only override is the drift that rule exists to prevent — nine call sites inherit it, none pinned the old size. Also widened the sentence to the frame's 420px measure. The residual gap on frame `18` (30px marketing step) is filed as **#255**. Verified in the browser; `/search` and `/messages` empty branches driven and clean. Lane 124, worktree `worktree-124` on `43ce159`, measured at 1440x900 against `[data-screen-label="08 Vendor dashboard"]` read in situ after `document.fonts.ready`; **every `expected` value in the ledger re-derived independently and confirmed correct for this frame**. Zero console errors. |
| **133** | **08 Vendor dashboard — `Requests waiting on you` carries tracking the frame does not** | **P1** | **M3** | **P2 Medium** | **Done** | `worktree-124` | **#74** | `core` | **Closed by re-measurement 2026-08-29 — no code written.** `Requests waiting on you` already computes Instrument Serif 21px with **`letter-spacing: normal`**. It carries `font-display` (family only), not `.display-heading` (which adds -0.01em), so the -0.525px the ledger recorded is gone. Lane 124, worktree `worktree-124` on `43ce159`, measured at 1440x900 against `[data-screen-label="08 Vendor dashboard"]` read in situ after `document.fonts.ready`; **every `expected` value in the ledger re-derived independently and confirmed correct for this frame**. Zero console errors. |
| **134** | **08 Vendor dashboard — `Vendor` chip string absent** | **P1** | **M3** | **P2 Medium** | **Done** | `worktree-124` | **None** | `core` | **Closed by re-measurement 2026-08-29 — no code written.** The header `Vendor` chip renders and computes `600 / 11px / letter-spacing 0.66px / uppercase / rgb(75,89,64)` on `rgb(237,240,233)`, radius 5px, padding 4px 8px — the frame exactly. `RoleChip` was added by `43ce159`. **Caveat:** the whole header cluster renders signed-out on the first load in a fresh browser context (present on 7 of 8 loads, the miss always the first) — filed separately as **#254**; it is not a chip defect. Lane 124, worktree `worktree-124` on `43ce159`, measured at 1440x900 against `[data-screen-label="08 Vendor dashboard"]` read in situ after `document.fonts.ready`; **every `expected` value in the ledger re-derived independently and confirmed correct for this frame**. Zero console errors. |
| **135** | **08 Vendor dashboard — `See all 4 →` string absent** | **P1** | **M3** | **P2 Medium** | **Blocked** | `worktree-124` | **None** | `core` | **BLOCKED 2026-08-29 by lane 124 — same blocker as #127, no code written.** Confirmed FAIL: the literal `See all 4 →` is absent from the DOM. The string cannot be added before its destination exists; see #127 for the question. Once answered, this is the text half (exact literal, the `→` glyph, the live count and its behaviour at zero) of the same control. |
| **136** | **08 Vendor dashboard — `Bookings this month` shows a wrong-month statement instead of a delta** | **P1** | **M3** | **P2 Medium** | **Done** | `worktree-124` | **None** | `core` | **Done 2026-08-29 (`e034898`).** `Bookings this month` now states a delta in every state, in the frame's `+2 vs April` shape; the `None in <month>` fallback is deleted, so a vendor with no bookings in either month reads `+0 vs July`. **Correcting the sweep's note: the month was never wrong** — `previous` is derived as the month before `today`, so an August dashboard naming July was correct. The defect was solely that the line was a statement about last month under a label reading `this month`, and not a comparison. Sage stays reserved for an actual increase. Three tests including the zero case. Lane 124, worktree `worktree-124` on `43ce159`, measured at 1440x900 against `[data-screen-label="08 Vendor dashboard"]` read in situ after `document.fonts.ready`; **every `expected` value in the ledger re-derived independently and confirmed correct for this frame**. Zero console errors. |
| **137** | **09 Vendor profile editor — The cover image drop zone is missing entirely** | **P1** | **M3** | **P0 Critical** | **Blocked** | `worktree-137` | **#74** | `core` | Parity sweep 2026-08-28, finding `PB2-14`, axis **Layout** **BLOCKED 2026-08-29, lane 137 — the design contract contradicts itself; not a lane's call.** Frame `09` renders a `Cover image` drop zone beside the photo (862x130 border-box, `1px dashed #D5CEC2`, radius 14px, strings `cover 21:9 — 1600×686 min` / `Drop an image or browse`), and `17-vendor-profile-editor.md` §1 requires it: "Profile photo … and cover image (128px tall, `aspect-21/9` drop zone) **side by side**, photo first", with "Media pair on one row" in its acceptance list. But `40-states.md` line 100 states the opposite rule for the whole product: "**Cover** is a designation on an existing tile (drag to first slot), **never a second uploader**." `vendor-profile-form.tsx` already omits the zone deliberately, citing that line in a source comment. **Question for the design owner: does frame 09's cover drop zone override `40-states.md`'s "never a second uploader" rule, or should the frame's cover slot be re-cut as a designation on the first portfolio tile?** Both readings are internally consistent, so implementing either silently overrules the other. Note the frame's zone measures 862x128 content (~6.7:1), not literally 21:9 — "21:9" appears only inside the mono placeholder string. Infrastructure is already present either way (`ImageUpload` accepts `prefix: 'vendor-cover'` and `aspectClassName`, and `vendor_profiles.cover_image_url` exists), so this is a decision, not an effort, problem. Blocks the cover strings in #151 for the same reason. **Why the standing tie-breaker does not settle this:** `.claude/rules/web-design-parity.md` says "where the two disagree, build the frame and correct the plan", which would mean building the zone — but the same rule elevates `40-states.md` to "a law, not a screen file… it binds every ticket, **including ones whose frames predate it**", which would mean not building it. So this is law-versus-frame, not plan-versus-frame, and the tie-breaker points both ways at once. That precedence is the decision needed. **DESIGN DROP 2026-08-29:** the contradiction is resolved — `17-vendor-profile-editor.md` now specifies the cover field as a **216×144, 3:2** drop zone. **Unblocked by #288**, which carries the whole editor rework; close this into it rather than building it twice. |
| **138** | **09 Vendor profile editor — Two undocumented fields inserted into the form** | **P1** | **M3** | **P2 Medium** | **Blocked** | `worktree-137` | **#74** | `core` | Parity sweep 2026-08-28, finding `PB2-15`, axis **Layout** **BLOCKED 2026-08-29, lane 137 — deleting these fields removes the only editing surface for data another frame requires.** Confirmed both are absent from frame `09` and from `17-vendor-profile-editor.md`'s ordered field list, so the finding is accurate as far as it goes. But both feed frame `03`: `12-vendor-profile.md:62` specifies "**About** — tagline as a Serif italic pull-quote, bio at max 640px, **three** stat tiles", its layout sketch (line 21) carries `tagline (Serif italic 20px)`, and frame `03` itself renders an `Experience` tile reading `10 yrs`, which is `yearsInBusiness`. `vendor_profiles.tagline` and `.years_in_business` are real columns whose schema comments name exactly those two consumers. Removing the inputs makes required public-profile content permanently unsettable — a regression dressed as a parity fix. **Question for the design owner: should `Your line` and `Years in business` be deleted outright (accepting that frame 03 loses its pull-quote and Experience tile), or relocated — most plausibly into the `About your business` section, which is where their content belongs — rather than removed?** Relocating also serves #141's scroll budget without destroying data. Not a lane's call, so no code written. |
| **139** | **09 Vendor profile editor — Three section headings inserted into a pane the frame gives none** | **P1** | **M3** | **P2 Medium** | **Done** | `worktree-137` | **#74** | `core` | Parity sweep 2026-08-28, finding `PB2-16`, axis **Layout** **Done 2026-08-29 (`24ecc75`), lane 137.** Re-measured first: **two of the three were already correct**. `Business` and `Location & service area` were `sr-only`; only `Tags` rendered visibly, as `font-display text-display-sm text-stone-900` — measured at **21px Instrument Serif** in the live editor at 1440x900. Frame `09`'s form pane uses the visible pane-heading class `.h2` exactly once, for `Your storefront`, and gives the fields no section headings at all. Fixed by making the `Tags` `<h2>` `sr-only`, matching its two siblings. **Deliberately not deleted:** the nav rail's anchors target these sections, so the headings stay in the accessibility tree — the Access axis is a hard gate, and an unnamed landmark is a worse trade than a heading no sighted vendor sees. Evidence: new `apps/web/src/components/vendor-profile-editor-parity.test.ts` derives its expectations from the frame file itself (9 tests); confirmed **2 assertions fail before the change and all 9 pass after**. `tsc --noEmit` clean, `eslint` clean on both files, prettier unchanged. |
| **140** | **09 Vendor profile editor — Section nav is missing `Payouts` and its gold dot** | **P1** | **M3** | **P3 Low** | **Blocked** | `worktree-137` | **#9**, **#74** | `core` | Parity sweep 2026-08-28, finding `PB2-17`, axis **Layout** **BLOCKED 2026-08-29 on #9, lane 137 — the finding itself calls this "scope-deferrable", and it is.** Confirmed the gap is real: frame `09` lists seven nav rows ending `Payouts` with a `#C99A2E` dot, and the live nav renders six, stopping at `Portfolio`. But nothing behind it exists yet — there is **no `/vendor/payouts` route** (`apps/web/src/app/vendor/` holds only availability, dashboard, packages, portfolio, profile) and **no `payouts` key in `PUBLISH_BLOCKERS`** (`packages/shared/src/constants/index.ts:57`), so the API cannot report the blocker the dot is supposed to represent. Shipping the row now yields a link to a 404 and a gold dot the vendor can never clear — which `40-states.md`'s gold-means-waiting semantics make actively misleading, since nothing is actually waiting on them. `vendor-profile-form.tsx:93` already records this decision in a source comment. **Unblock condition: #9 (Stripe Connect Vendor Onboarding, M4) lands the payouts surface and its blocker key; then this is a three-line change to `SECTION_ORDER`.** Note for whoever does it: the frame's submit-bar summary reads "**2 things** left before you can publish — response time and payouts", so that string only becomes reproducible once payouts is a real blocker — it is the other half of #151. |
| **141** | **09 Vendor profile editor — Form pane exceeds its scroll budget** | **P1** | **M3** | **P1 High** | **Backlog** | — | **#74** | `core` | Parity sweep 2026-08-28, finding `PB2-18`, axis **Layout** |
| **142** | **09 Vendor profile editor — Inputs are 7px short, unpadded and transparent** | **P1** | **M3** | **P1 High** | **Done** | `worktree-137` | **#74** | `core` | Parity sweep 2026-08-28, finding `PB2-19`, axis **Style** **Done 2026-08-29 (`1d05ba0`), lane 137.** **Corrected the finding's number:** the frame's `.inp` is **38px**, not "~39px" — `.inp{padding:10px 13px;border:1px solid #E4DDD1;font-size:13.5px}` gives 10+10+16+2. App measured **32px, `padding:4px 10px`, transparent** over the `#F8F5EF` pane. Fixed `h-8 → h-[38px]` and `px-2.5 py-1 → px-[13px] py-2.5` in the shared `ui/input.tsx`, and `INPUT_TOUCH_HEIGHT` `lg:h-8 → lg:h-[38px]` so the touch variant cannot drift from it. Radius (`rounded-lg` = 10px), border (`stone-300` = `#E4DDD1`) and font (`text-base` = 13.5px) were **already correct**. **Background deliberately left off the shared primitive:** across the frames `.inp` is `#F1ECE4` by default and overridden to `#FFFDF9` on 26 of 38 instances — it tracks the surface, not the control — so frame 09's seven fields get `bg-stone-0` at the call site and frames 03/04/23/26 keep the filled default. Also raised the two `SelectTrigger`s from `sm:h-9` to `sm:h-[38px]` to match. **Cross-cutting: `ui/input.tsx` is shared app-wide** — ran the whole web suite, **78 files / 871 tests pass**, no regressions. New assertions in `vendor-profile-editor-parity.test.ts` read `.inp` out of the frame file; **4 fail before the change, all 17 pass after**. `tsc --noEmit` clean, `eslint` clean, prettier clean. |
| **143** | **09 Vendor profile editor — Profile photo zone is oversized with the wrong dashed border** | **P1** | **M3** | **P2 Medium** | **Done** | `worktree-137` | **#74** | `core` | Parity sweep 2026-08-28, finding `PB2-20`, axis **Style** **Done 2026-08-29 (`6517fb6`), lane 137.** Finding confirmed exactly. Frame: `width:128px;height:128px` (**130x130** border-box), `border:1px dashed #D5CEC2`, hatched `repeating-linear-gradient(135deg,#E6DFD3 0 9px,#EFE9DF 9px 18px)`. App measured **160x160, `2px dashed #EFE9E0`** (stone-200, not stone-400) over flat `#F8F5EF`. **Both values it needed were already in the design system and simply unused:** `--color-stone-400` *is* `#d5cec2`, and `@utility placeholder-hatch` (`theme.css:355`) already carries the frame's exact gradient. Fixed in `image-upload.tsx`: `border-2 border-dashed border-stone-200` → `border border-dashed border-stone-400`; flat `bg-stone-50` → `placeholder-hatch` while empty (the uploaded image covers it once set); `sm:size-40` → `sm:size-32`. The editor's wrapper `sm:w-40` → `sm:w-32` too, or it would re-crop the circle. Touches `customer-profile-form.tsx`'s avatar as well — the only other `ImageUpload` caller — which no frame contradicts. Evidence: 6 new assertions parsing the frame's own photo-zone node; **3 fail before, all 23 pass after**; whole web suite **78 files / 877 tests** green; `tsc` / `eslint` / prettier clean. |
| **144** | **09 Vendor profile editor — Category chips have the wrong border weight, padding and icon circle** | **P1** | **M3** | **P2 Medium** | **Done** | `worktree-137` | **#74** | `core` | Parity sweep 2026-08-28, finding `PB2-21`, axis **Style** **Done 2026-08-29 (`92f448b`), lane 137.** **Correcting the finding on border weight: there is no deviation there.** The frame's inline `border:1.5px` **computes to `1px`** in Chromium at DPR 1 — measured on the frame node itself — and the app already renders `1px solid #B4552F`. Chasing 1.5px would have chased a value the frame does not produce. The real deviations, all fixed: padding `6px 16px 6px 6px` → **`7px 13px 7px 8px`**; type `text-sm` (12.5px) → **`text-action` (13px)**, the token that already existed for it; selected weight 500 → **600**; unselected border `stone-200` (`#EFE9E0`) → **`stone-300` (`#E4DDD1`)**; icon badge **28px → 22px**, which is what brings the chip from 42px to the frame's **38px**. Updated `category-icon.test.tsx`, which pinned the old 28px. **One sub-point deliberately left alone:** the frame's selected badge fill is `#F3D6C8` and the unselected `#F1ECE4`, while the app paints both `clay-100` (`#F7E7E0`); neither frame value is a token (`clay-200` is `#efd8cc`), so introducing a raw hex or minting a token is a design-system change beyond a parity lane. Worth a follow-up if the badge is meant to read distinctly against the chip fill. Evidence: 10 new assertions parsed from the frame's three chip nodes, **4 fail before / 32 pass after**; whole web suite **78 files / 886 tests** green; `tsc` and prettier clean. |
| **145** | **09 Vendor profile editor — Submit-bar buttons are a size class below the frame** | **P1** | **M3** | **P1 High** | **Done** | `worktree-137` | **#74** | `core` | Parity sweep 2026-08-28, finding `PB2-22`, axis **Style** **Done 2026-08-29 (`3deb775`), lane 137.** **Correcting the finding's number: the buttons measured 29px, not 33px.** The ticket title is exactly right, though — the cause was literally a size class: both controls carried `size="sm"`, which is `px-3 py-1.5 text-sm rounded-md` and computes to 12.5px/600 on a **29px** control with an **8px** radius, against the frame's 13.5px/600 on **38px** with a **10px** radius. **Fixed without touching the shared primitive:** the `default` size (`px-5 py-2.5`, `text-base`, `rounded-lg`) already *is* the frame's button, so the fix was dropping `size="sm"` from `Save changes` / `Create profile` and `Preview`. Both land on 38px by the same arithmetic the frame uses — `.btnP` gets there with 11px padding and no border, `.btnS` with 10px and a 1px border, and the app's `border border-transparent` base makes 10+10+16+2 = 38 for both variants. Evidence: 5 new assertions reading `.btnP`/`.btnS` out of the frame's stylesheet, **1 fails before / 37 pass after**; whole web suite **78 files / 891 tests** green; `tsc` and prettier clean. |
| **146** | **09 Vendor profile editor — Service radius is an unstyled native range input** | **P1** | **M3** | **P2 Medium** | **Done** | `worktree-137` | **#74** | `core` | Parity sweep 2026-08-28, finding `PB2-23`, axis **Style** **Done 2026-08-29 (`047defd`), lane 137.** Finding confirmed: `className="h-6 w-full accent-clay-400"` — a **24px** browser-drawn control, where the frame draws a **4px `#EFE9E0` track, a `#B4552F` fill, and a 14px `#FFFDF9` thumb ringed 2px `#B4552F`** (18px across). `accent-color` cannot express that; it tints the control but keeps the browser's track height and thumb. Added `@utility range-slider` to `packages/config/tailwind/theme.css` with the frame's exact geometry, covering both `::-webkit-` and `::-moz-` pseudo-elements. **Kept the native `input[type=range]`** rather than adopting a custom widget, so keyboard stepping, the value announcement and the step arithmetic stay the browser's — the Access axis is a hard gate. The fill is a gradient stop on the track (a native range has no element between track and thumb to colour), fed by `--range-fill` from the new exported `serviceRadiusFillPercent()`. The frame's authored `width:46%` at 60 miles is a hand-rounded figure; the derived value is **45.8%** — `(60-5)/(125-5)` — a **0.2px** difference on the frame's 502px track, and it now tracks the bounds instead of being pinned. **Verified in the browser, not just in source:** computed `appearance:none` on an 18px box with `--range-fill: 20.8%` at the seeded 30 miles, plus a 3x screenshot showing the clay fill, pale remainder and ringed thumb — a CSS utility that failed to compile would pass source assertions silently, so this one was checked as rendered. Evidence: 5 unit tests on the percentage helper + 7 frame-derived assertions, **4 fail before / 44 pass after**; whole web suite **78 files / 902 tests** green; `tsc` and prettier clean. |
| **147** | **09 Vendor profile editor — Selected category chip label is stone-900, not clay-600** | **P1** | **M3** | **P2 Medium** | **Done** | `worktree-137` | **None** | `core` | Parity sweep 2026-08-28, finding `PB2-24`, axis **Colour** **Done 2026-08-29 (`6071377`), lane 137.** Finding confirmed and its root cause is sharper than "stone-900": the class was **`text-stone-800`, a step this theme's ramp never defines** (it runs stone-0/50/100/150/200/300/400/500/600/700/900), so it fell through to Tailwind's stock cool stone — which is why it measured as a neutral `oklch(0.268 0.007 34.298)` belonging to no token here rather than to `stone-900`. Frame's selected chip is **`#8E3F20`**, and `--color-clay-600: #8e3f20` is documented in `theme.css` as "text on clay-100 surfaces, pressed fill" — precisely a selected chip. Changed to `text-clay-600`; unselected chips keep `stone-700` (`#4A443C`), which is what the frame's other two carry. Evidence: 6 new assertions, **2 fail before / 49 pass after**; whole web suite **78 files / 907 tests** green. **Note for other lanes:** `brand-literals.test.ts` scans *comments* too — a code comment naming the product by name fails it, which briefly broke this commit's suite. |
| **148** | **09 Vendor profile editor — Field labels are stone-900, not stone-600** | **P1** | **M3** | **P2 Medium** | **Done** | `worktree-137` | **None** | `core` | Parity sweep 2026-08-28, finding `PB2-25`, axis **Colour** **Done 2026-08-29 (`f21987f`), lane 137.** Finding confirmed: measured `rgb(35,32,28)` against the frames' `.lbl{color:#6B6459}`. Root cause is that **`ui/label.tsx` set no colour at all** — it inherited whatever ink surrounded it, which is stone-900 here — so this was one shared defect showing on every form rather than a per-screen slip. Added `text-stone-600`, the token the ramp itself annotates as "MUTED TEXT — the minimum for any real label". **Cross-cutting by design: 30 `<Label>` usages across 9 files** (booking, checkout, packages, portfolio, customer profile, search, tags). That is the right blast radius — frames `03`/`04`/`05` draw their labels with the same `.lbl` rule, so this moves them toward their frames too rather than away. Whole web suite **78 files / 910 tests** green. Evidence: 3 new assertions reading `.lbl`'s colour out of the frame stylesheet and the token out of `theme.css`; **1 fails before, 52 pass after**. |
| **149** | **09 Vendor profile editor — Field labels are sentence-case 12.5px/500 instead of uppercase micro-labels** | **P1** | **M3** | **P1 High** | **Done** | `worktree-137` | **#74** | `core` | Parity sweep 2026-08-28, finding `PB2-26`, axis **Font** **Done 2026-08-29 (`7d6a052`), lane 137.** Finding confirmed exactly: measured **12.5px/500 sentence case** against `.lbl{font:600 10.5px;letter-spacing:.05em;text-transform:uppercase}`. **Every token already existed and was already the app's idiom** — `--text-label: 10.5px`, `--tracking-label: 0.05em` (annotated in `theme.css` as "`.lbl`, `.tl` — the uppercase micro-label"), and the exact four classes `text-label font-semibold tracking-label text-stone-600 uppercase` are hand-rolled in `rail.tsx`, `dashboard-shell.tsx`, `vendor-surface.tsx`, `site-footer.tsx` and `not-found.tsx`. `ui/label.tsx` was the one place not using them, so the primitive now agrees with its own design system. **Also caught in the browser and fixed:** `image-upload.tsx` renders its own bare `<label>` (it labels a file input it owns) and stayed sentence case — the frame draws `Profile photo` as a `.lbl` like the rest, so it takes the same treatment. Verified live at 1440x900: label computes **10.5px/600, letter-spacing 0.525px, uppercase, `rgb(107,100,89)`** — an exact match for the frame rule. Evidence: 7 new assertions, **2 fail before / 58 pass after**; whole web suite **78 files / 917 tests** green; `tsc` and prettier clean. Same 30-call-site blast radius as #148, and for the same reason it is the right one. |
| **150** | **09 Vendor profile editor — Tag group headings render in Instrument Serif at 12.5px** | **P1** | **M3** | **P1 High** | **Done** | `worktree-137` | **#74** | `core` | Parity sweep 2026-08-28, finding `PB2-27`, axis **Font** **Done 2026-08-29 by re-measurement, lane 137 — no code written.** The defect does not reproduce. Measured the live editor at 1440x900 with a populated storefront, vendor session, after `document.fonts.ready`: the tag group headings `Languages spoken`, `Cultural specialties` and `Dietary` compute to **`Instrument Sans` 12.5px/500**, not the `Instrument Serif` 12.5px the finding records. Fixed upstream by `bf525f9` ("Rebuild the storefront editor and calendar to their Orla frames"), already on `main` at `43ce159`. The one remaining serif heading on the screen is the **section** heading `Tags` (21px `Instrument Serif`), which is #139's scope (the frame's form pane carries no section headings at all), not this ticket's. |
| **151** | **09 Vendor profile editor — Six frame strings are missing and the slug preview has an extra path segment** | **P1** | **M3** | **P1 High** | **Done** | `worktree-137` | **None** | `core` | Parity sweep 2026-08-28, finding `PB2-28`, axis **Text** **Done 2026-08-29 (`d70d105`), lane 137 — three strings landed, three split out with reasons.** **Landed:** the radius label now carries its value as one phrase, `Service radius — 60 miles`, instead of a label plus a separate `60 miles` span (it also reads better to a screen reader, which now announces the number with the control); the slider ends in the frame's two bounds `5 mi` / `125 mi`, `aria-hidden` since the input announces its own min and max; and a filled photo zone is labelled **`Replace`**, which the app had no equivalent for at all — a vendor with a photo previously saw no visible way to change it. **Deliberately not reproduced — `portrait`:** the frame's mono `portrait` line is *labelled placeholder art*, and `.claude/rules/web-design-parity.md` lists "real photography in place of the labelled placeholders" among the only three things allowed to differ. The frame depicts a filled zone; the app's empty zone honestly says `Add photo`. Reproducing `portrait` would print a fake caption over an empty circle. **Split out, not dropped:** the three cover strings (`Cover image`, `cover 21:9 — 1600×686 min`, `Drop an image or browse`) belong to the cover zone and ride on **#137**'s blocked design question; the slug's `/vendors/` segment became **#257** because the frame's `orla.com/kessler-co` is not a route the app serves and printing it would show every vendor a 404; `Saved 30 seconds ago` became **#258** because it is a persistent relative timestamp, a behaviour rather than a string. Evidence: 4 new frame-derived assertions; whole web suite **78 files / 921 tests** green; `tsc` and `eslint` clean. |
| **152** | **09 Vendor profile editor — Eight helper strings appear with no frame or content-voice source** | **P1** | **M3** | **P2 Medium** | **Blocked** | `worktree-137` | **#138** | `core` | Parity sweep 2026-08-28, finding `PB2-29`, axis **Text** **PARTLY DONE, then BLOCKED on #138 — 2026-08-29, lane 137 (`06446f7`).** Classified all eight rather than deleting the list wholesale, and they are not one kind of thing. **Removed (2):** `How far you will travel for an event.` — superseded by the frame's own `5 mi` / `125 mi` bounds, added in #151, which say the same thing in the frame's words; and `A couple of paragraphs is plenty.` — decoration the frame has no equivalent for. **Not an offender (1):** `JPG or PNG · 12 MB each · min 1200px wide · 20 files per upload` is **required verbatim** by `40-states.md` ("Constraints, stated before the picker opens… The same line appears in the drop zone and the requirements rail"), so the finding is wrong to count it. **Blocked on #138 (2):** `One sentence, in your own words.` and `Counted from when you started…` are the helpers for `Your line` and `Years in business` — the two fields #138 asks whether to delete. Removing a helper for a field that may itself go is premature. **Needs a decision (3):** the counters `0 / 80`, `57 / 1200` and `1 of 5 chosen.` are affordances, not prose — they sit on `maxLength`-capped inputs and a 5-category limit, where silent truncation is the alternative, and `03-components.md:92` explicitly provides for a helper line under a field ("11.5px `stone-600`; when it names a publish blocker, `gold-600`"). The frame shows no counter, but it also shows no vendor mid-typing. **Question: do capped fields keep a live character counter, or does frame parity mean removing them and letting the cap bite silently?** Frame 09's pane carries exactly one helper — the gold `Required before you can publish` — which is kept. Evidence: 6 new assertions; whole web suite **78 files / 926 tests** green; `tsc` and `eslint` clean. |
| **153** | **11 Availability — Availability rail is 41px narrow and the month columns absorb it** | **P1** | **M3** | **P1 High** | **Done** | `worktree-153` | **#74** | `core` | Parity sweep 2026-08-28, finding `PB2-30`, axis **Layout**. **Closed by re-measurement 2026-08-29 — no code written.** Frame re-derived in situ at 1440x900 (`[data-screen-label="11 Availability"]`, fonts settled): rail **341px** footprint / **300px** content (300px + 20px padding each side + 1px `border-left`, content-box); months grid **786px**, gap **20px**, columns **248.656px**. Live now measures rail **341px** / **300px** content (`xl:grid-cols-[1fr_calc(var(--list-pane)+41px)]` with `--list-pane: 18.75rem` = 300px, border-box) and months grid **786px**, gap **20px**, columns **248.656px** — identical on both halves of the finding. Fixed upstream by the frames 08/09/11 shared chrome (`43ce159`) |
| **154** | **11 Availability — Selected panel radius and padding are both 2px/1px over** | **P1** | **M3** | **P2 Medium** | **Done** | `worktree-153` | **#74** | `core` | Parity sweep 2026-08-28, finding `PB2-31`, axis **Style**. Frame draws the rail panel at `border-radius:12px` / `padding:13px`; live was `rounded-xl` (`--radius-xl: 14px`) / `p-3.5` (14px). Now `rounded-[12px] p-[13px]`. There is no 12px step in the radius scale (6/8/10/14/18) though the frames use 12px **69 times** — token gap filed separately |
| **155** | **11 Availability — Market-note panel radius is 14px, not 12px** | **P1** | **M3** | **P2 Medium** | **Done** | `worktree-153` | **#74** | `core` | Parity sweep 2026-08-28, finding `PB2-32`, axis **Style**. Frame draws it at `border-radius:12px`; live was `rounded-xl` (14px). Now `rounded-[12px]`. Padding already matched at 12px. The panel **copy** deliberately differs — `19-availability.md` defers the market statistic Post-MVP and instructs stating only this vendor own numbers — so only the radius was in scope |
| **156** | **11 Availability — `Block these` button is under-padded** | **P1** | **M3** | **P2 Medium** | **Done** | `worktree-153` | **#74** | `core` | Parity sweep 2026-08-28, finding `PB2-33`, axis **Style**. Frame draws `padding:8px 14px`; Button `size="sm"` is `px-3 py-1.5` (6px 12px). Overridden at the call site with `px-3.5 py-2` rather than changing the shared `sm` size that every small button in the product uses. The `shadow-sm` the frame flat span does not carry is a separate finding, filed |
| **157** | **11 Availability — Month nav uses circular icon buttons where the frame uses inline glyphs** | **P1** | **M3** | **P2 Medium** | **Done** | `worktree-153` | **#74** | `core` | Parity sweep 2026-08-28, finding `PB2-34`, axis **Style**. Frame draws bare `‹` / `›` at 13px in `#6B6459`; live drew two **44x44** `size-11` icon buttons in clay `#A34A28` (the ledger said 36px — corrected, that variant was deleted). Now bare glyphs at `text-action` / `text-stone-600`, with a centred `before:size-11` pseudo-element keeping the 44x44 hit area `04-laws.md` requires. Also closes the ledger PB2-34 colour half. **`19-availability.md` says "no month navigation" twice and the frame contradicts it — plan correction filed separately** |
| **158** | **11 Availability — `Clear` is clay where the frame is stone** | **P1** | **M3** | **P2 Medium** | **Done** | `worktree-153` | **None** | `core` | Parity sweep 2026-08-28, finding `PB2-35`, axis **Colour**. Frame draws `Clear` in `#4A443C` (stone-700); live rendered `#A34A28` (clay-500) from the `ghost` variant. Now `text-stone-700 hover:text-stone-900` at the call site. Semantics, not just the hex: `40-states.md` makes clay the action colour, and `Clear` only drops a selection. Its **padding/radius** also differ from the frame (`6px 12px` + `rounded-lg` vs `8px 6px`, no radius) — filed separately |
| **159** | **11 Availability — Calendar day cells render 11px, not 12px** | **P1** | **M3** | **P2 Medium** | **Done** | `worktree-153` | **#74** | `core` | Parity sweep 2026-08-28, finding `PB2-36`, axis **Font**. Frame day grid is `font-size:12px`; live used `text-xs` (`--text-xs: 11px`) on all 92 cells. Now **`text-meta`** (`--text-meta: 12px`), which is the token `19-availability.md` names and which carries `--text-meta--line-height: normal`, so the cell keeps the frame 29px height rather than inheriting a 1.5 leading the way an arbitrary `text-[12px]` would |
| **160** | **11 Availability — Page title carries `-0.65px` tracking against the frame's `-0.26px`** | **P1** | **M3** | **P2 Medium** | **Done** | `worktree-153` | **#74** | `core` | Parity sweep 2026-08-28, finding `PB2-37`, axis **Font**. **Closed by re-measurement 2026-08-29 — no code written.** Frame `.h2` is Instrument Serif 26px / `letter-spacing:-.01em` = **-0.26px**; live title now computes **-0.26px** at 26px in Instrument Serif. Closed upstream by **#165** (`8a14155`), which this ticket was named a downstream symptom of |
| **161** | **11 Availability — Month names carry negative tracking the frame does not** | **P1** | **M3** | **P2 Medium** | **Done** | `worktree-153` | **#74** | `core` | Parity sweep 2026-08-28, finding `PB2-38`, axis **Font**. **Closed by re-measurement 2026-08-29 — no code written.** Frame `.sh` month name computes `letter-spacing: **normal**` at 18px Instrument Serif; live `h3` now computes `letter-spacing: **normal**` at 18px Instrument Serif. Closed upstream by **#165** (`8a14155`) |
| **162** | **11 Availability — Rail micro-labels render in Instrument Serif** | **P1** | **M3** | **P1 High** | **Done** | `worktree-153` | **#74** | `core` | Parity sweep 2026-08-28, finding `PB2-39`, axis **Font**. **Closed by re-measurement 2026-08-29 — no code written.** Frame `.lbl` is **Instrument Sans** 10.5px / 600 / `0.525px` / `#6B6459` / uppercase. All three live rail labels (`Selected`, `Legend`, `This quarter`) now compute **Instrument Sans** 10.5px / 600 / `0.525px` / `rgb(107,100,89)` / uppercase — every attribute matches. Closed upstream by **#165** (`8a14155`), the blanket serif rule that was making these `h2`s render in the display face |
| **163** | **11 Availability — Two instructions 40px apart contradict each other** | **P1** | **M3** | **P1 High** | **Done** | `worktree-153` | **None** | `core` | Parity sweep 2026-08-28, finding `PB2-40`, axis **Text**. The rail said a click **selects**, the pane said it **blocks**. The frame draws one instruction, in the pane, and no rail empty state at all; the rail line is now the status `No dates selected yet.` and the pane keeps the instruction. **The pane string still stops short of the frame** — the frame ends `…, and completed events stay on the calendar — click one to open it.`, which describes the `completed` state the app does not implement. Adopting it verbatim would promise behaviour that does not exist, so the clause is filed with the completed-state ticket rather than shipped as copy |
| **164** | **11 Availability — The page has no `<h1>`** | **P1** | **M3** | **P2 Medium** | **Done** | `worktree-153` | **None** | `core` | Parity sweep 2026-08-28, finding `PB2-41`, axis **Access**. Re-confirmed against the current DOM before implementing — `document.querySelectorAll("h1").length === 0`. The screen title is now an `h1`; the rail three section headings stay `h2`, so the hierarchy runs h1 -> h2 instead of three sibling `h2`s with no parent. Visually inert: `.display-heading` is a class role and **#165** removed the tag-level serif rule, so nothing keys off the element name |
| **165** | **One `globals.css` rule breaks the font axis on every screen in the product** | **P1** | **M3** | **P1 High** | **Done** | `worktree-165` | **None** | `core` | **Root cause** of #131, #150, #160, #161, #162 and every unswept frame (the row previously named #89/#109/#119/#121 — wrong numbers, corrected 2026-08-29). Highest-leverage fix in the sweep | **Merged 2026-08-29 (`8a14155`, PR #7), CI green.** Lane torn down.
| **166** | **Availability calendar — every cell state carries a shape, not just a fill** | **P1** | **M3** | **P1 High** | **Backlog** | — | **None** | `core` | **Change order A1.** Booked/pending/blocked were within ~2 points of luminance — unreadable in greyscale or with CVD. Adds Completed + Today. Resolves #164 |
| **167** | **Build the shared dropdown component — nothing rolls its own** | **P1** | **M3** | **P1 High** | **In Progress** | `worktree-167` | **None** | `core` | **Change order A2** + `42-dropdowns.md` + frames `28`. **Supersedes #69.** Closes the unreachable-panel and stays-open findings. **Started 2026-08-29 on `worktree-167` — the shell is built and tested (`cbfd2ee`), the seven call-site migrations are not, so this is NOT done.** Landed on the branch: the shell, both mounts, the keyboard model and the Apply footer, under 23 tests covering both mounts, dismissal by outside click / Escape / select, focus return, scroll repositioning rather than dismissing, the 360px cap, arrow movement with wraparound, type-ahead, Tab-closes, and that a multi-select commits nothing until Apply. Adds `--shadow-dropdown` with the frame's own `0 14px 44px rgba(35,40,38,.20)` — neither `shadow-xl` nor the `shadow-lg` the plan names matches it, and the frame outranks the plan. **Remaining:** the range and date bodies, and migrating `category-select`, the four `refine-bar` chips, the booking-request event type, the two vendor-profile selects and `tag-picker`. **Two conflicts with existing documented decisions, both settled by `42-dropdowns.md` and needing no ruling — but they are deletions, so they are recorded here:** the vendor-type select's typed filter and its `closestCategories` fallback go, because the spec says a single-select has "no search field"; and its deliberate `avoidCollisions={false}` pinning goes, because the spec flips above a field within 380px of the viewport bottom. Both have tests that will need rewriting. **Out of scope by the acceptance criterion, which names five surfaces:** `booking-rail`'s package select stays native — `frame-03-parity.test.ts` asserts it and the code documents why — as do `customer-profile-form`'s budget tier, `package-form`'s price type, and `CategoryPicker`, which carries its own documented exception |
| **168** | **Replace the page loader with the mark's two converging rings** | **P1** | **M3** | **P2 Medium** | **Done** | main | **None** | `core` | **Change order B3.** No wordmark — it renders before fonts are guaranteed. **Closed 2026-08-29 by verification, not by new code — it had already shipped out of band** (with frame `26`, alongside #165). Checked against every acceptance criterion rather than assumed: `page-loader.tsx` draws two `size-7.5` (30px) rings, `bg-clay-400` (`#b4552f`) and a `box-border` 2px `border-stone-900` (`#23201c`); `theme.css` defines `mark-converge-left` at `-9px -> 7px` and `mark-converge-right` at `9px -> -7px`, both `1.9s cubic-bezier(0.45, 0, 0.55, 1) infinite` — the ticket's values exactly. No wordmark and no webfont: the loader's only text is an `sr-only` "Loading", and a test asserts the source contains neither `BRAND_NAME` nor `font-display`. Motion is gated behind `motion-safe:` on both rings, asserted. Mounted only at the `/vendor` and `/customer` segment loading boundaries — never the root, which `loading-boundaries.test.ts` enforces because a root `loading.tsx` turns every `notFound()` into a soft 404; `/messages` and `/bookings` use skeletons instead, per `40-states.md`'s one-idiom-per-screen rule. Both required tests already exist. Evidence: `page-loader.test.tsx` + `loading-boundaries.test.ts`, 9 tests green |
| **169** | **Treat 1024 as a real breakpoint, height-constrained** | **P1** | **M3** | **P1 High** | **Backlog** | — | **None** | `core` | **Change order B4.** Seven `27 …` frames. "Due today" above the fold is a hard constraint |
| **170** | **Uploads — Customer profile photo upload is dead, and leaks an internal role message to the user** | **P1** | **M3** | **P0 Critical** | **Done** | `worktree-170` | **None** | `core` `storage` | Uploads pass 2026-08-28. **Done 2026-08-29 (`afa9c63`, PR #21).** Authorization is now per prefix via `STORAGE_PREFIX_ROLES`, typed `Record<StoragePrefix, readonly UserRole[]>` so a new namespace cannot ship without a role decision. Two further defects fixed with it: `assertRole` no longer interpolates the required role into a message ~11 surfaces render verbatim, and `avatarUrl` was migrated to `imageRefSchema` on **five** schemas — the fifth, `conversationSummarySchema`, would have 500d the conversations list of every vendor a photo-uploading customer had messaged, since a response schema is a second write boundary. Tests: all **12** (role, prefix) pairs derived from `STORAGE_PREFIXES` and `USER_ROLES` (admin refused everywhere), a new `image-upload.test.tsx` asserting the **rendered** DOM carries no internal sentence, and a PUT/GET round trip. Browser-verified at 1440x900 in five states: customer 201 and persisting across a real reload (`naturalWidth: 1600`), customer refused on all three vendor prefixes, vendor refused on `customer-profile`, signed out 401. CI green. Filed #293 (pre-existing UTC/local test failure). Left to their own tickets: #171 (preview renders the key), #175 (too-narrow should be gold) |
| **171** | **Uploads — A successful upload renders a broken image and a 500, while the toast says it worked** | **P1** | **M3** | **P1 High** | **In Progress** | `worktree-171` | **None** | `core` `storage` | Uploads pass 2026-08-28. Started 2026-08-29 in lane 171; #170 was skipped because a concurrent session holds its worktree lock. |
| **172** | **Uploads — The image format allow-list is bypassed by renaming the file** | **P1** | **M3** | **P1 High** | **Backlog** | — | **None** | `core` `storage` | Uploads pass 2026-08-28 |
| **173** | **Uploads — No Cancel control exists during an upload** | **P1** | **M3** | **P1 High** | **Backlog** | — | **None** | `core` `storage` | Uploads pass 2026-08-28 |
| **174** | **Uploads — Size refusal contradicts itself at the byte boundary** | **P1** | **M3** | **P2 Medium** | **Backlog** | — | **None** | `core` `storage` | Uploads pass 2026-08-28 |
| **175** | **Uploads — Below-minimum width is red on one uploader and gold on the other** | **P1** | **M3** | **P2 Medium** | **Backlog** | — | **None** | `core` `storage` | Uploads pass 2026-08-28 |
| **176** | **Uploads — The aggregate progress line counts bytes that are never sent** | **P1** | **M3** | **P2 Medium** | **Backlog** | — | **None** | `core` `storage` | Uploads pass 2026-08-28 |
| **177** | **Uploads — The failure banner claims "Everything else saved" while the batch is still queued** | **P1** | **M3** | **P2 Medium** | **Backlog** | — | **None** | `core` `storage` | Uploads pass 2026-08-28 |
| **178** | **Uploads — Deleting or replacing an image leaves its storage objects orphaned forever** | **P1** | **M3** | **P2 Medium** | **Backlog** | — | **None** | `core` `storage` | Uploads pass 2026-08-28 |
| **179** | **Uploads — Upload route validates before authenticating, leaking the prefix enum** | **P1** | **M3** | **P2 Medium** | **Backlog** | — | **None** | `core` `storage` | Uploads pass 2026-08-28 |
| **180** | **Uploads — The uploads bucket permits anonymous ListObjects** | **P1** | **M3** | **P2 Medium** | **Backlog** | — | **None** | `core` `storage` | Uploads pass 2026-08-28 |
| **181** | **Uploads — Batch-overflow banner has a grammar error** | **P1** | **M3** | **P3 Low** | **Backlog** | — | **None** | `core` `storage` | Uploads pass 2026-08-28 |
| **182** | **Uploads — Failure sentence starts lowercase for an extensionless file** | **P1** | **M3** | **P3 Low** | **Backlog** | — | **None** | `core` `storage` | Uploads pass 2026-08-28 |
| **183** | **Uploads — Header photo count goes stale after an upload but corrects after a delete** | **P1** | **M3** | **P3 Low** | **Backlog** | — | **None** | `core` `storage` | Uploads pass 2026-08-28 |
| **184** | **Uploads — A hard refresh mid-upload silently drops the in-flight file** | **P1** | **M3** | **P3 Low** | **Backlog** | — | **None** | `core` `storage` | Uploads pass 2026-08-28 |
| **185** | **Uploads — Sizes are reported in MB where the OS reports MiB** | **P1** | **M3** | **P3 Low** | **Backlog** | — | **None** | `core` `storage` | Uploads pass 2026-08-28 |
| **186** | **Landing hero cluster — one scale ladder, and removed means removed at 390** | **P1** | **M3** | **P1 High** | **Backlog** | — | **None** | `core` | Design update 2026-08-28. `14 Landing mobile` now carries **0** photo blocks. 768 is spec, not a drawn frame |
| **187** | **Bookings hub — `All categories` and `Soonest first` are dead controls** | **P1** | **M3** | **P1 High** | **Backlog** | — | **None** | `core` | Parity batch 3, 2026-08-28. **Functional** |
| **188** | **Bookings hub — the notifications bell opens nothing** | **P1** | **M3** | **P1 High** | **Backlog** | — | **None** | `core` | Parity batch 3, 2026-08-28. **Functional** |
| **189** | **Bookings hub renders the EMPTY-state rail on a hub with 11 bookings** | **P1** | **M3** | **P1 High** | **Backlog** | — | **None** | `core` | Parity batch 3, 2026-08-28. **Functional** |
| **190** | **Bookings hub — the count sentence contradicts the tab it sits above** | **P1** | **M3** | **P2 Medium** | **Backlog** | — | **None** | `core` | Parity batch 3, 2026-08-28. **Functional** |
| **191** | **Booking cards have no focus ring and link to the vendor profile, not the booking** | **P1** | **M3** | **P1 High** | **Backlog** | — | **None** | `core` | Parity batch 3, 2026-08-28. **Functional** |
| **192** | **Booking request — a marketing footer is appended below the app shell** | **P1** | **M3** | **P2 Medium** | **Backlog** | — | **None** | `core` | Parity batch 3, 2026-08-28. **Functional** |
| **193** | **Booking request — a form field was moved into the context rail** | **P1** | **M3** | **P2 Medium** | **Backlog** | — | **None** | `core` | Parity batch 3, 2026-08-28. **Functional** |
| **194** | **Sign up — the primary action reads `Continue`, not `Create my account`** | **P1** | **M3** | **P2 Medium** | **Blocked — needs a human** | — | **None** | `core` | **BLOCKED 2026-08-29 by lane 82 — needs a ruling, and the existing rationale is broken.** Frame `12` line 741 draws the submit as **`Create my account`**; Clerk renders **`Continue`** (plus a `cl-buttonArrowIcon` chevron the frame does not draw). Our markup renders no button at all — `sign-up-form.tsx` mounts `<SignUp>`, so the string is Clerk's. `layout.tsx:69-78` deliberately omits the key because `formButtonPrimary` is a **single global key shared by every flow**, and I confirmed the premise: `/sign-in`'s button is the same node (`cl-internal-15lsvo7`) and also reads `Continue`, so setting it globally would mislabel sign-in. **But the comment cites "the deviation note in `design/design-plan/21-sign-up.md`" and no such note exists** — grepped `21-sign-up.md` and `31-content-voice.md` for "deviation", "Create my account" and "Continue": zero hits. So the design contract still says `Create my account`, the code silently disagrees, and nothing records why. **Question: add the deviation note to `21-sign-up.md` and accept `Continue` (a design-pass edit this lane cannot make), or is a sign-up-scoped mechanism wanted?** Not guessed at, because a wrong string on `/sign-in` is worse than a generic one here. |
| **195** | **Sign up — the two primary inputs have no focus ring** | **P1** | **M3** | **P1 High** | **Done** | `lane-82-public-routes` | **None** | `core` | **Done 2026-08-29 (`e911fee`, merged `5806f73`).** The ticket's wording is wrong — there **was** a ring, it was the wrong one: Clerk drew a single 4px clay at **50%** alpha with **no offset layer**, where `04-laws.md` asks for 2px at 30% over a 2px stone-50 band. Same defect on the submit and the show-password button. Fixed the way `.cl-userButtonTrigger` already was — an **unlayered** rule, because Clerk injects into a later cascade layer. Two things only the browser caught: (1) the first attempt reset `box-shadow` to clear Clerk's ring, but Tailwind's `ring-*` utilities **are** a box-shadow, so the focused input rendered with **no** affordance; (2) the submit then still kept Clerk's ring because `.cl-internal-…[data-variant="solid"][data-color="primary"]` ties ours at specificity **(0,3,0)** and, being injected at runtime, wins every tie on source order — the class is now repeated to reach (0,4,0). Also gave the role cards `ring-offset-stone-50`; without it the band drew Tailwind's default **white** on a stone-50 panel. Verified with real keyboard focus past the 150ms transition: all three controls report the product ring. |
| **196** | **Sign up — the `Sign in` link reintroduces a banned colour pair** | **P1** | **M3** | **P1 High** | **Done** | `lane-82-public-routes` | **None** | `core` | **Done 2026-08-29 (`e911fee`, merged `5806f73`).** `.cl-footerActionLink` drew Clerk's `clay-400 #B4552F` on `stone-50`. The contrast table in `01-foundations.md` names **`clay-500` as the token** for clay as text on any cream and puts **`clay-400` in the Never column**; frame `12` draws this span `#A34A28` at weight 600. Measured **4.51:1** for the banned pair — it scrapes past 4.5 by **0.01**, which is exactly why the rule is a token pair and not a ratio; `clay-500` gives **5.41:1**. Fixed colour and weight, and the sibling `.cl-footerActionText` from `stone-600` to the frame's `stone-700`. Browser-verified: `rgb(163,74,40)` at weight 600, sibling `rgb(74,68,60)`. Guarded by a token test asserting clay-500 clears 5.3:1 and clay-400 falls under 4.6:1 on stone-50. |
| **197** | **Sign up — panel text over photography is not contrast-guaranteed** | **P1** | **M3** | **P1 High** | **Blocked — needs a human** | — | **None** | `core` | **BLOCKED 2026-08-29 by lane 82 — the frame and the access law disagree, and it is worse than "not guaranteed".** The **entire** panel content box (600x444 at x840,y456) sits over the photo. There is no per-node scrim, no text-shadow (`text-shadow: none` throughout) and no plate — only the full-panel wash, whose gradient **byte-matches both frames**. Measured against the real image pixels: the italic accent `#F3C98B` **already fails at 3.75:1** on the seeded photo (worst pixel `#666658`), with the headline clearing by only 0.12 (4.62:1) and the body by 0.39 (4.89:1). Forcing the image to white to get the floor the wash alone guarantees: headline **3.43:1**, italic **3.13:1**, body **3.91:1**, BOTH label **3.90:1**, VENDING **4.19:1** — **six of ten bands below 4.5:1**; only the three guarantee lines survive. The frames label this surface `vendor photograph — full bleed`, so a brighter photo is expected, not hypothetical. **Fixing it means changing something the frames draw exactly** — darkening the wash, adding a scrim the frames do not have, or moving `#F3C98B` off the frame's accent colour. **Question: which of those three, given the gradient currently matches the frame byte for byte?** Deferred rather than guessed because any of them is a visible design change. |
| **198** | **The app systematically renders five type steps off the frames' scale** | **P1** | **M3** | **P1 High** | **Done** | `worktree-198` | **None** | `core` | Parity batch 3, 2026-08-28. **Parity**. **Four of the five mappings were real; the fifth does not exist.** Scale gained `--text-label` 10.5px (`.lbl`/`.tl`), `--text-helper` 11.5px (`.tn`), `--text-meta` 12px (card meta) and `--tracking-label` .05em, all read from the frames by `type-scale-parity.test.ts`. `.inp` needed no step — `text-base` was already 13.5px and what broke it at 1440 was shadcn's `md:text-sm` on the shared `Input`/`Textarea`/`SelectTrigger`. **There is no 14px sub-heading in the frames** (`.sh` is 21px Serif with 17/18/19px overrides; the 33 uses of 14px are buttons, body copy and avatar initials), so no token was invented — recorded in `01-foundations.md`. **Found and fixed a latent `cn()` defect:** tailwind-merge classifies any unknown `text-*` as a *colour*, so every role token was silently dropped at `cn()` call sites — the `03` chip rendered 16px instead of 11.5px and the `01` hero label lost `stone-600`. `utils.ts` now registers the whole scale, including the pre-existing `display-*` and `md` steps that had the same latent collision. Browser-verified at 1440x900: `03` chip 24.00 = frame, `01` label 10.5px/.525px/stone-600, `02` card meta 12px, `.tn` 17.25, shared input 13.5px. **Left for #235:** the inherited `line-height: 1.5` on the 76 remaining `text-[Npx]` sites — the whole residual on the category card (+3.00), refine chip (+3.75) and card name (+3.50). Also noted: `/vendors/<slug>` body-scrolls (1174 vs 900) — needs adjudicating against 03's documented scroll budget; and the micro-label className recurs at ~20 sites, a consolidation candidate. **Merged 2026-08-29 (`b4b7d19`, PR #16), CI green. Lane torn down.** |
| **199** | **Two frame colours are absent from the foundations and were substituted, one at an accessibility cost** | **P1** | **M3** | **P2 Medium** | **Blocked — needs a human** | — | **A design ruling: adopt `#C4D6A8`/`#5C4A18` as foundation tokens, or correct the frames to sanctioned ones** | `core` | Parity batch 3, 2026-08-28. **Parity**. **Blocked 2026-08-29** — verified against the repository: `#C4D6A8` and `#5C4A18` are absent from `01-foundations.md`, and `apps/web/src/components/auth/auth-screen.tsx:76` renders `Vending` as `text-sage-200` (`#a8c08e`). **All three acceptance criteria require an edit under `design/`** — adopting the two colours means adding tokens to `01-foundations.md`; correcting the frames means editing `Orla - Screens.dc.html`; and criterion 3 explicitly says the frame's banned `#9A9184` must be corrected *in the frame*. `.claude/rules/web-design-parity.md` reserves that for a design pass — "design passes edit the plan, tickets write the code, never the reverse" — so no ticket can close this. The code-only route (repoint the app at some other sanctioned token that clears AA) is ruled out by the ticket's own text: these "belong in the plan, not silently in the components". **Note for whoever unblocks it:** the required test as written — every component colour resolves to a foundations token — would **not** have caught this defect. The app already uses a sanctioned token; the defect is that the token differs from the frame. A guard that bites would compare each component's resolved colour against the frame's, not against the token list |
| **210** | **The vendor has no surface anywhere that shows a confirmed booking** | **P1** | **M3** | **P0 Critical** | **Backlog** | — | **None** | `core` | Two-sided functional pass 2026-08-28 |
| **211** | **The vendor never learns who the customer is, before or after accepting** | **P1** | **M3** | **P0 Critical** | **Backlog** | — | **None** | `core` | Two-sided functional pass 2026-08-28 |
| **212** | **Accepting a booking labels the date `Pending request` on the vendor's own calendar, and the Booked counter stays at 0** | **P1** | **M3** | **P1 High** | **Backlog** | — | **None** | `core` | Two-sided functional pass 2026-08-28 |
| **213** | **Decline is one click, irreversible, with no confirmation and no undo** | **P1** | **M3** | **P1 High** | **Backlog** | — | **None** | `core` | Two-sided functional pass 2026-08-28 |
| **214** | **A customer cannot cancel, or even review, a request they sent** | **P1** | **M3** | **P1 High** | **Backlog** | — | **None** | `core` | Two-sided functional pass 2026-08-28 |
| **215** | **The Clerk session JWT is sent in a URL query string** | **P1** | **M3** | **P1 High** | **Backlog** | — | **None** | `core` | Two-sided functional pass 2026-08-28 |
| **216** | **Four different expiry promises for the same deadline, and the one shown at commitment is wrong** | **P1** | **M3** | **P2 Medium** | **Backlog** | — | **None** | `core` | Two-sided functional pass 2026-08-28 |
| **217** | **The two sides disagree about whether there is a platform fee** | **P1** | **M3** | **P2 Medium** | **Backlog** | — | **None** | `core` | Two-sided functional pass 2026-08-28 |
| **218** | **`Send quote` is dead on the default path, contradicting what the customer was promised** | **P1** | **M3** | **P2 Medium** | **Backlog** | — | **None** | `core` | Two-sided functional pass 2026-08-28 |
| **219** | **A new request opens no message thread, and the profile's message button is permanently dead** | **P1** | **M3** | **P2 Medium** | **Backlog** | — | **None** | `core` | Two-sided functional pass 2026-08-28 |
| **220** | **No booking can be created by anyone — accept is walled behind payout setup that does not exist** | **P1** | **M3** | **P0 Critical** | **Backlog** | - | **#9, #10** | `core` | Vendor onboarding + quote pass 2026-08-29 |
| **221** | **The customer cannot accept a quote — `Review quote` links to the vendor's marketing page** | **P1** | **M3** | **P0 Critical** | **Backlog** | - | **None** | `core` | Vendor onboarding + quote pass 2026-08-29 |
| **222** | **Vendor onboarding cannot be completed through the UI — a 400 is swallowed with no feedback at all** | **P1** | **M3** | **P0 Critical** | **In Progress** | `worktree-222` | **None** | `core` | Vendor onboarding + quote pass 2026-08-29. **Started 2026-08-29** in lane `worktree-222`; preflight `--ticket 222` passed 23/23 |
| **223** | **A below-minimum quote makes Send a dead control** | **P1** | **M3** | **P1 High** | **Backlog** | - | **None** | `core` | Vendor onboarding + quote pass 2026-08-29 |
| **224** | **An above-maximum quote shows the raw API error string to the vendor** | **P1** | **M3** | **P1 High** | **Backlog** | - | **None** | `core` | Vendor onboarding + quote pass 2026-08-29 |
| **225** | **The success toast covers the submit button it confirms** | **P1** | **M3** | **P2 Medium** | **Backlog** | - | **None** | `core` | Vendor onboarding + quote pass 2026-08-29 |
| **226** | **Sign-up returns to the role picker after email verification** | **P1** | **M3** | **P2 Medium** | **Blocked — needs a human** | - | **None** | `core` | **BLOCKED 2026-08-29 by lane 82 — needs a new dependency approved.** The required test is *"a browser test completing sign-up for both roles and asserting the landing route"*, and the repo has **no Playwright harness**: no `playwright.config.*` anywhere, and **`@clerk/testing` is not a dependency**. Clerk's own guidance is that `setupClerkTestingToken()` must run before navigating to an auth page or auth fails outright under automation. **My browser reproduction is therefore inconclusive and I am not claiming it.** Driving `/sign-up` with a `+clerk_test` address did return to the role picker — earlier than the ticket says, before any code step — but **Cloudflare Turnstile loads on this page** (`challenges.cloudflare.com/.../turnstile/...`, console `No available adapters.`), which is precisely the bot-protection `setupClerkTestingToken()` exists to bypass. So the observed reset may be Turnstile rejecting an automated browser rather than the defect the user hit. Distinguishing the two **requires** the harness. **Question: approve adding `@clerk/testing` (and a Playwright config) so this flow can be driven, or should #226 wait on the harness ticket?** Deferred rather than guessed, per the unattended-run rule on new dependencies. |
| **227** | **Unsaved profile edits are discarded silently** | **P1** | **M3** | **P2 Medium** | **Backlog** | - | **None** | `core` | Vendor onboarding + quote pass 2026-08-29 |
| **228** | **A newly onboarded vendor's public storefront shows placeholder copy** | **P1** | **M3** | **P2 Medium** | **Backlog** | - | **None** | `core` | Vendor onboarding + quote pass 2026-08-29 |
| **229** | **Messaging: one thread per pair, and new messages raise no notification in either direction** | **P1** | **M3** | **P2 Medium** | **Backlog** | - | **None** | `core` | Vendor onboarding + quote pass 2026-08-29 |
| **230** | **Avatar initials render Instrument Serif below the 16px floor at three of five sizes** | **P1** | **M3** | **P2 Medium** | **Blocked — needs a human** | - | **None** | `core` | Found 2026-08-29 implementing #165. Two parts of the design contract contradict each other; needs a ruling, not a guess |
| **231** | **`pnpm dev` inside a lane binds the web app to the lane's API port** | **P1.5** | **M4.5** | **P1 High** | **Done** | `worktree-231` | **None** | `core` | Found 2026-08-29 running lane 165. `next dev` reads `PORT`, which `lane:up` sets to the API port, so the API dies with EADDRINUSE. **Implemented 2026-08-29 on `worktree-231`.** `apps/web`'s dev script now passes `--port` only when `WEB_PORT` is set (`next dev ${WEB_PORT:+--port $WEB_PORT}`); an unconditional flag would have cost Next's retry-past-a-busy-3000 outside a lane. `WEB_PORT` added to the env registry, which is what puts it in `globalPassThroughEnv` — Turborepo strips anything absent from that array. `packages/preflight/turbo.json` names the five repository files this package's tests read from outside it, so a revert cannot come back a cache HIT. **Three of the four defects filed here were already fixed out of band**; only the port one was live. Verified: lane serves web 3018 / api 4018 both 200 with no EADDRINUSE, and outside a lane Next still steps 3000 -> 3001. **Merged 2026-08-29 (`0d53340`, PR #15), CI green.** Follow-up **#238** filed for the support tooling that still hardcodes 3000/4000. Lane worktree left in place for `/land-lanes` to tear down. |
| **232** | **Every lane worktree gets `node_modules` as a symlink to the main checkout** | **P1.5** | **M4.5** | **P1 High** | **Done** | main | **None** | `core` | Found 2026-08-29 by lanes 74 and 165 independently, hit again by lane 198. A lane's `pnpm install` writes into the tree its peers are reading — the one thing the orchestration policy names as forbidden. **Fixed 2026-08-29 on main (hotfix, no lane: using a lane to fix the lane mechanism would have run the destructive path).** Three parts: `worktree.symlinkDirectories` removed from `.claude/settings.json` so no new worktree inherits one; `adoptOwnModules` in `lane.ts` drops an inherited link before the in-process install; and `scripts/lane-bootstrap.mjs` does the same in plain Node *before* anything is installed, then runs the install — which also fixes the bootstrap this exposed, where a fresh worktree could not run `pnpm lane:up` at all because `tsx` resolves from the missing `node_modules`. Guards: an `lstat` test asserting the shared tree survives, and a test asserting `settings.json` never asks for the symlink again |
| **233** | **The E2E vendor account has no vendor profile, so four vendor screens cannot be browser-verified** | **P1.5** | **M4.5** | **P1 High** | **Backlog** | - | **None** | `core` | Found 2026-08-29 verifying #165. Dashboard, portfolio, packages and availability all redirect to the storefront editor |
| **234** | **Clerk's own sign-in card reads `vendor-marketplace` to the user** | **P1** | **M3** | **P2 Medium** | **Backlog** | - | **None** | `core` `auth` | Found 2026-08-29 verifying #165. The one user-facing string that says the repo name instead of the brand. Dashboard setting, not code |
| **236** | **The web search boundary re-declares the API's query schema instead of deriving from it** | **P1** | **M3** | **P2 Medium** | **Backlog** | - | **None** | `core` | Filed from #66 review 2026-08-29. `searchStateSchema` in `apps/web/src/components/search/search-state.ts` hand-copies every bound in `vendorSearchQuerySchema`. The constants are shared so values cannot disagree, but the composition can — `tags` was already more permissive on the client until #66 caught it. Export a field map from `packages/shared` that both build from. **Deliberately not done in #66:** that file was owned by a concurrent lane, which required additive changes only |
| **237** | **`page` is bounded below but not above, on both sides of the boundary** | **P1** | **M3** | **P3 Low** | **Backlog** | - | **None** | `core` | Filed from #66 review 2026-08-29. `paginationQuerySchema` and `vendorSearchQuerySchema` both cap `pageSize` and not `page`. Not a 500 — Zod's `.int()` caps at 2^53−1 and the offset stays inside `bigint` — but `?page=99999999` still makes Postgres sort the whole filtered set. Same class as #66's price cap. `tags` likewise has no array-length bound on either side |
| **238** | **The lane support tooling still hardcodes ports 3000 and 4000** | **P1.5** | **M4.5** | **P1 High** | **Done** | `worktree-238` | **None** | `core` `auth` | Filed from #231 review 2026-08-29. `preflight`, `hunt-bugs` and `e2e:auth` all assume the shared dev ports, so inside a lane they check, gate on, and authenticate against the wrong process. **Merged 2026-08-29 (`0b5bccb`, PR #18), CI green.** `DEV_PORTS` became `devPorts(env, processEnv)`; the two ports resolve from *different* places on purpose — `apps/api` calls `loadEnv()` before reading `PORT`, so the root `.env` moves it and preflight reads the merged `context.env`, while `apps/web`'s `next dev ${WEB_PORT:+--port $WEB_PORT}` is a shell expansion that never sees `.env`, so `WEB_PORT` is real-environment-only. `resolveBaseUrl` was split into `scripts/e2e-base-url.mjs` because `e2e-auth.mjs` launches a browser at import time and cannot be imported by a test. **`WEB_URL` is a comma-separated CORS allow-list** (`HTTP_URL_LIST`), so both consumers take only its first origin — passing the whole string to `page.goto` throws `Invalid URL`. Every guard is mutation-tested; `diff-reviewer` proved the resolver-only tests left `portsCheck.run` unpinned (re-hardcoding it kept 234/234 green), so it now has its own. Verified in lane 238: preflight reports `Port 3031`/`Port 4031`, `resolveBaseUrl()` returns `http://localhost:3031`. Also formatted two `.claude/agent-memory` files that were unformatted on `main` and failing `format:check` in CI there. Follow-up **#256** filed for the lane manifest keeping a stale `worktreePath`/`branch` on resume |
| **239** | **02 Search — Four header controls render no focus ring at all** | **P1** | **M3** | **P1 High** | **Backlog** | - | **None** | `core` | Filed by lane `worktree-90` from the 2026-08-29 `parity-checker` pass over frame `02 Search`. Tab-focused, the vendor-type button, the city input, the date input and the `Sign up` link each compute every `box-shadow` layer at 0px spread — and `Sign up` also computes its ring colour as `oklab(0 0 0 / 0)`. The parent `form` does not pick the ring up either: its `box-shadow` is unchanged while a child is focused. Four of 28 tab stops on the screen have no keyboard indicator; the other 24 compute the law correctly |
| **240** | **02 Search — The header submit is a 32x32 icon-only control with no 44x44 hit area** | **P1** | **M3** | **P1 High** | **Backlog** | - | **None** | `core` | Filed by lane `worktree-90` from the 2026-08-29 `parity-checker` pass over frame `02 Search`. Focused, `button[aria-label="Search"]` computes `ring-2` with its offset layer at **0px** — `search-bar.tsx` sets `focus-visible:ring-offset-0` on it, where `04-laws.md:133` asks for `ring-offset-2` and every other correct stop on the screen renders it. **Narrowed 2026-08-29: the 44x44 hit-area half of this finding moved to #94**, which was re-scoped to the Access axis and built it. This ticket is the focus offset only |
| **241** | **02 Search — The Rating popover stays open after a value is chosen** | **P1** | **M3** | **P2 Medium** | **Backlog** | - | **None** | `core` | Filed by lane `worktree-90` from the 2026-08-29 `parity-checker` pass over frame `02 Search`. Choosing a rating leaves `[role=dialog]` open at rect `{157,113,280,139}`, where it occludes the `<h1>` and the first result card — the two things the customer needs in order to see whether the filter did what they wanted |
| **242** | **02 Search — `free on …` sits inside the `<h1>`, so the accessible name runs together** | **P1** | **M3** | **P2 Medium** | **Backlog** | - | **None** | `core` | Filed by lane `worktree-90` from the 2026-08-29 `parity-checker` pass over frame `02 Search`. The `free on …` span is nested **inside** the `<h1>`, so the heading's accessible name concatenates with no separator: `10 photographers in Austinfree on Sun, Sep 13`. The frame draws them as siblings. The same nesting also makes the span inherit the heading's `letter-spacing: -0.22px` where the frame computes `normal` |
| **243** | **02 Search — The availability chip has one tone where the frame draws three** | **P1** | **M3** | **P2 Medium** | **Backlog** | - | **None** | `core` | Filed by lane `worktree-90` from the 2026-08-29 `parity-checker` pass over frame `02 Search`. `vendor-card.tsx:179-190` renders exactly one availability tone, `bg-sage-50 text-sage-600`. Frame `02` draws three: sage `Free Jun 14`, **gold `2 dates left`** (`#F5EEDC`/`#7A5A12`) and stone `New` (`#F0EAE1`/`#4A443C`). This is a missing semantic, not a missing string |
| **244** | **02 Search — The header logo lockup is a pixel large and a pixel and a half tight** | **P1** | **M3** | **P3 Low** | **Backlog** | - | **None** | `core` | Filed by lane `worktree-90` from the 2026-08-29 `parity-checker` pass over frame `02 Search`. Three small divergences that compound in the same direction: mark→wordmark `gap: 7.5px` vs the frame's `9px`, wordmark `font-size: 24px` vs `23px`, and the mark's outline circle 15x15 vs the frame's 17x17. The wordmark lands at `x=55.25` against the frame's `x=57` |
| **245** | **02 Search — The active-filter `✕` is under the 44x44 hit area** | **P1** | **M3** | **P3 Low** | **Backlog** | - | **None** | `core` | Filed by lane `worktree-90` from the 2026-08-29 `parity-checker` pass over frame `02 Search`. With a rating filter applied, the clear affordance inside the chip measures **24.5 x 32.8**. Its only visible content is a glyph, so `04-laws.md:133`'s 44x44 rule applies. It is correctly named — `✕` plus an sr-only `Clear 4★ & up` |
| **246** | **02 Search — The second row of results has fallen below the 900 fold** | **P1** | **M3** | **P2 Medium** | **Backlog** | - | **None** | `core` | Filed by lane `worktree-90` from the 2026-08-29 `parity-checker` pass over frame `02 Search`. `11-search.md:158` requires every second-row card's **price row** to be above the fold. The frame meets it by 2px (top 898 of 900). Live, the second-row price row starts at **904.08** and ends at 939.58 — entirely below it. The cause is accumulated line-height inflation, not any single element |
| **247** | **The `text-[Npx]` line-height defect also hits the `h1`, card `h3` and price span** | **P1** | **M3** | **P1 High** | **Backlog** | - | **None** | `core` | Filed by lane `worktree-90` from the 2026-08-29 `parity-checker` pass over frame `02 Search`. #235 covers the refine chip. The identical defect — an arbitrary `text-[Npx]` emitting `font-size` and inheriting Preflight's `html{line-height:1.5}` — is also on the search `h1` (33px vs `normal` 29px), the card `h3` (28.5 vs 25) and the price span (25.5 vs 20). Those three are unowned, and together they are what pushes #246 over the fold |
| **248** | **[DESIGN] Frame `02 Search` contradicts five sibling frames on the compact search bar** | **P1** | **M3** | **P2 Medium** | **Backlog** | - | **None** | `core` | Filed by lane `worktree-90`, 2026-08-29. Frame `02 Search` draws the compact search bar in a way five sibling frames contradict — a labelled `Search` pill vs a 32px clay circle, `Event date` vs `Date`, 582x45 vs 42px, `#DDD5C7`/`0 1px 3px` vs `#E4DDD1`/`0 2px 10px`. #57 ruled the five correct and the code follows them, but **frame 02 itself was never updated**, so every fresh parity sweep of that frame re-files the same three findings. #91/#95/#101 have now been filed and closed twice |
| **249** | **01 Landing — Photo-cluster cards 1 and 2 use an 18px radius where the frame draws 16px** | P1 | M3 | P2 Medium | Backlog | — | None | `core` | **Found by lane 82's parity pass 2026-08-29, measured from computed DOM styles at 1440x900 against the frame re-rendered in Chromium with webfonts loaded.** Frame `01 Landing` draws the three hero photo cards at `border-radius` **16px, 16px, 14px**; the app computes **18px, 18px, 14px**. Cards 1 and 2 carry `rounded-2xl` (18px) in `photo-cluster.tsx` CARDS[0..1]; card 3 is already correct at 14px, so only the first two move. Axis **Style**. Not fixed by lane 82 — outside its ticket list.  **Renumbered from #239** on merge — lane 90 filed a different #239. |
| **250** | **Logo geometry is off the frame: 7.5px gap and a 21.75px mark against 9px and 22px** | P1 | M3 | P2 Medium | Backlog | — | None | `core` | **Found by lane 82's parity pass 2026-08-29.** Frame `01 Landing`, re-rendered in Chromium, draws the logo row at `gap:9px` with a **22px** mark. `components/brand/logo.tsx` derives both from the diameter: `gap = size * WORDMARK_GAP_RATIO` and `markWidth = size * (1 + OFFSET_RATIO)`, which at the `desktopHeader` size of 15 give **7.5px** and **21.75px**. The 1.5px shortfall shifts the whole nav left — `Browse` measures x=138.7 live. Axis **Style**/**Layout**. **Touches the header, which is #117–#123's lane** — file only, and coordinate before changing `logo.tsx`. Note the ratios are the contract's own (`1.45 D`), so the fix is likely the rounding or the base size, not the ratios.  **Renumbered from #240** on merge — lane 90 filed a different #240. **Possible duplicate of #244**, which lane 90 filed for the same `Logo` component measured on `/search`. Both describe the same lockup geometry. Reconcile before working either. |
| **251** | **`-webkit-font-smoothing: antialiased` is applied app-wide, which `01-foundations.md` explicitly forbids** | P1 | M3 | P1 High | **Done** | `lane-82-public-routes` | None | `core` | **Done 2026-08-29 (`14a4267`, merged `12e229c`).** Removed from **both** sites — `layout.tsx:99` and `global-error.tsx:31`. Browser-measured at 1440x900: `body` and `h1` `-webkit-font-smoothing` now compute **`auto`**, matching the frame. `apps/web/src/app/font-smoothing.test.ts` guards both halves of the law — no `antialiased` anywhere in `apps/web/src`, and none in the frame bundle either, so the "both files or neither" escape hatch has to be taken deliberately. Guard proven: re-adding the class fails the test naming `src/app/layout.tsx`. |
| **252** | **Vendor card focus ring is clipped to nothing by the card's `overflow-hidden`** | P1 | M3 | P1 High | Backlog | — | None | `core` | **Found by lane 82's final parity pass 2026-08-29, confirmed from source.** This is the exact failure mode `04-laws.md` names: an outward ring on an element that exactly fills an `overflow:hidden` parent computes correctly and renders invisibly. `vendor-card.tsx:70` puts `group/card overflow-hidden rounded-2xl` on the card root; line 75 is `<Link href={...} className="block">` filling it at inset 0. The focus ring resolves to the correct token values and paints nothing. Observed on the four Featured vendor cards on `/`; **`VendorCard` is shared, so `/search` has it too**. Axis **Access** — a keyboard user gets no focus indication on a primary navigation target. Nothing else on `/` fails the ring law: 37 tab stops were walked and every other control computes `rgb(248,245,239) 0 0 0 2px, oklab(clay/0.3) 0 0 0 4px`.  **Renumbered from #242** on merge — lane 90 filed a different #242. **Possible duplicate of #73**, which lane 90 determined already owns the clipped vendor-card focus ring and therefore did not file it. Reconcile before working. |
| **253** | **01 Landing — hero Search button carries an 8px left margin the frame does not, narrowing all three segments** | P1 | M3 | P2 Medium | **Done** | `lane-82-public-routes` | None | `core` | **Done 2026-08-29 (`14a4267`, merged `12e229c`).** Dropped `sm:ml-2` from the hero submit. Browser-measured at 1440x900: margin-left **8px -> 0px**, segments **229.97/194.91/159.52 -> 233.33/197.48/161.58**, exactly the frame's numbers. Form width 727.594 and submit box 102.2x44 unchanged, so #84 still holds. The compact bar keeps its own `sm:ml-1.5`, asserted separately. |
| **254** | **Vendor profile tabs — the focus ring is clipped to a 1px sliver by `overflow-x-auto`** | **P1** | **M3** | **P1 High** | **Backlog** | — | **None** | `core` | **Found 2026-08-29 by the final `parity-checker` pass on frame `03 Vendor profile`, during lane #103-#116.** `profile-tabs.tsx` gives the `[role="tablist"]` `overflow-x-auto`, which makes `overflow-y` compute `auto` rather than `visible`. The focus ring itself is correct — every tab computes `box-shadow: rgb(248,245,239) 0 0 0 2px, oklab(...) 0 0 0 4px`, which is the `04-laws.md` token — but it is clipped to **0.00px above and 1.00px below** on all five tabs, and 0.00px to the left of `About`. A keyboard user tabbing the profile sees a 1px sliver where the law requires a 4px ring on all four sides. **Nothing is actually scrolling at 1440** (`scrollWidth === clientWidth === 952`); the clip is collateral from the <=390px overflow fix that file documents. **Not caused by #103-#116** — none of those fourteen touch `profile-tabs.tsx`; it was found because the parity pass gates the Access axis. Likely fix: drop the horizontal scroller above the breakpoint that needs it, or give the tablist vertical padding so the ring has room inside the clip. Verify with a real Tab traversal at 1440 and at 390. **TWO AGENTS DISAGREE — RE-MEASURE BEFORE FIXING.** `parity-checker` reports the ring **clipped** and gives geometry for it: tab rect `40,380.80,39.97,40.25` against tablist rect `40,380.80,952,41.25` — the tab's top edge is level with the tablist's, so a 4px outward ring has no room above it, measured as **0.00px top / 1.00px bottom** on all five. `browser-verifier`, tabbing the page for real, reports all five tabs **individually reachable with a clearly visible two-layer ring** and `:focus-visible` true — and notes it nearly filed a false defect here, because reading computed style immediately after `Tab` returns `NONE` until `transition-all` settles (~260ms). The two are not necessarily in conflict: the ring can be **painted** (computed `box-shadow` present, which is what the second agent measured) and still be **clipped** by the ancestor's overflow (which is what the first agent measured). **Settle it by measuring the painted extent against the tablist's client box with focus held and the transition finished**, not by reading `box-shadow`, and not from a screenshot. If it turns out unclipped, close this as not-a-defect and say so.  **Renumbered from #239** on merge — lanes 90 and 82 had already filed #239-#253. |
| **255** | **An expired session on `/messages` and the vendor request queue shows an empty state instead of sign-in** | P1 | M3 | P2 Medium | Backlog | — | None | `core` `auth` | **Found 2026-08-29 while writing #76's tests.** `getOwnConversations` (`apps/web/src/lib/messaging-data.ts`) and `getOwnBookingRequests` (`apps/web/src/lib/vendor-requests.ts`) degrade **every** read failure to `[]`, including a **401**. `customer-data.ts` special-cases 401 into a sign-in redirect; these two do not. A customer whose session expired is therefore told *No conversations yet* — the app claims they have no messages when it simply could not read them. Not changed in #76 because the empty state is a designed surface and #76 was about destinations; `apps/web/src/lib/data-auth-redirect.test.ts` pins the current behaviour, so the fix flips those two assertions. |
| **256** | **A resumed lane keeps a stale `worktreePath` and `branch` in its manifest** | P2 | M4.5 | P3 Low | Backlog | — | None | `core` | Found 2026-08-29 landing #238. `laneUp` returns an existing `state: 'active'` manifest verbatim, reconciling only the env file, so a lane first brought up from the wrong directory keeps that directory forever. `/land-lanes` reads exactly these two fields |
| **257** | **09 Vendor profile editor — the slug preview promises a vanity URL the router does not serve** | P1 | M3 | P2 Medium | Backlog | — | None | `core` | **Filed by lane 137 from #151, 2026-08-29.** Frame `09` renders the profile-link preview as `orla.com/kessler-co`, and `17-vendor-profile-editor.md` §2 agrees in words: "the slug preview renders live under its field as `{BRAND_DOMAIN}/kessler-co`". The app renders **`{BRAND_DOMAIN}/vendors/<slug>`** — the `/vendors/` segment appears in neither source, so on the Text axis the app is wrong. **But the frame's string is not currently a real URL:** the only public vendor route is `apps/web/src/app/vendors/[slug]/page.tsx`, and there is no top-level `[slug]` route, so `orla.com/kessler-co` 404s. Changing the preview text alone would show every vendor a link that does not resolve — worse than the parity break it fixes. **Decision needed: add a vanity route (a top-level `/[slug]` that renders or redirects to the vendor page) and then match the frame, or accept `/vendors/` and correct the frame and `17-vendor-profile-editor.md`?** A top-level catch-all is not free — every current and future static route (`/search`, `/bookings`, `/messages`, `/sign-in`, …) shadows a vendor slug, so it needs a reserved-slug list enforced at slug creation. Axis **Text**. |
| **258** | **09 Vendor profile editor — the submit bar never shows when the storefront was last saved** | P1 | M3 | P3 Low | Backlog | — | None | `core` | **Filed by lane 137 from #151, 2026-08-29.** Frame `09`'s submit bar reads **`Saved 30 seconds ago`** in 12.5px `#6B6459`, left of `Preview`. The app's `aria-live` region shows `Saving…` while in flight, `Saved` for `SAVED_NOTICE_MS` (2s), then `Unsaved changes` or nothing — so a vendor who returns to a clean form is told nothing about when it was last saved. `17-vendor-profile-editor.md` carries both halves: 'Right: save state ("Saved 30 seconds ago"), Preview, and Save changes' **and** 'Inline "Saved" fades after 2s', which read as two different elements — a transient confirmation *and* a persistent relative timestamp — but the plan never says so outright. **Confirm that reading before building it**, then render a relative time from the last successful save. Keep it deterministic in tests: inject the clock rather than reading `Date.now()` in the component, per `.claude/rules/testing.md`. Axis **Text**. |
| **259** | **Header renders its signed-out variant on the first navigation in a fresh browser context** | P1 | M3 | **P1 High** | Backlog | — | None | `core` | **Found by lane 124's closing parity pass 2026-08-29 on `/vendor/dashboard`.** On the first load in a fresh context the whole header cluster renders signed-out — wordmark row, the `Vendor` `RoleChip`, the Messages/Dashboard nav, the notification bell and the avatar — while the page body renders fully authenticated. Every later load in the same context is correct; measured **present on 7 of 8 loads, and the miss is always the first**. Clerk's client session resolves after first paint. Not a `RoleChip` bug — `role-chip.tsx` matches frame `08` exactly (600 11px, 0.66px, uppercase, `sage-600` on `sage-50`, radius 5, padding 4/8). It is a Layout/Text parity hole against frame `08`'s header and it makes any header parity measurement flaky. |
| **260** | **`18 Search no results` empty state is 26px/420px where the frame draws 30px/520px** | P1 | M3 | P2 Medium | Backlog | — | None | `core` | **Surfaced by #132 (lane 124, 2026-08-29).** `40-states.md` sets the empty-state headline at **26px in-app / 30px marketing**, and the shared `EmptyState` now renders 26px for every call site. Frame `18` draws the search no-results headline at **30px** with a **520px** body measure against the component's 420px. 26 is closer than the 21 it replaced, so this is a residual gap rather than a regression, but the component has no marketing step. Needs a marketing variant, not a per-screen override. |
| **261** | **The two-circle empty-state glyph is absent from seven of the nine `EmptyState` call sites** | P1 | M3 | P2 Medium | Backlog | — | None | `core` | **Found by lane 124 while implementing #126, 2026-08-29.** `40-states.md` names the muted two-circle glyph (one dashed, `stone-400`) as *the* empty-state glyph, not one option among several. #126 shipped it as `EmptyStateGlyph` and wired it to the vendor dashboard only; it was left opt-in deliberately so a parallel lane's screens would not shift underneath them. `search-shell` passes its own lucide icons (2 sites); the remaining **7** — `packages-pane`, `portfolio-pane`, `customer-history` (x2), `messages-screen`, `vendors/[slug]`, and the dashboard's published branch — render with no glyph at all. |
| **200** | **[PLATFORM] Local development runs on the Docker Postgres, upgraded to 18** | **INFRA** | **M-OPS** | **P0 Critical** | **Done** | main | **None** | `core` | **Platform / cost.** Filed 2026-08-28. `pnpm dev` holds a connection pool open, so the Neon compute never scales to zero: the `dev` branch logged **103,692s active (~12h/day)** across 2.4 days, pacing ~375h/month against a **100 CU-hour** free cap (400h at the 0.25 CU floor). Exhausting it **suspends the compute until the next billing period** — a production outage caused by local work. Fix: bump `docker-compose.yml` `postgres:16-alpine` → **`postgres:18-alpine`** (Neon runs PG18; 16 is silent version drift), point local `DATABASE_URL` at it, leave `DATABASE_URL_UNPOOLED` unset per `migration-url.ts`. Update the compose header comment and README, which both still describe the container as offline-only. Keep `--wait storage` in `pnpm start`; drop `--wait postgres` only if the container stays optional **Human gate: none.** Fully agent-executable — compose file, local `.env`, README. **Implemented 2026-08-28.** Compose on **postgres:18-alpine**; local `DATABASE_URL` repointed, Neon values kept commented in `.env`. **PG18 also moved the data mount** — 18+ images abort when the volume is at `/var/lib/postgresql/data`, so it is now `/var/lib/postgresql` (docker-library/postgres#1259); the old volume was recreated (verified empty of tables first). New `optionalFor` field on the env registry makes `DATABASE_URL_UNPOOLED` and `NEON_BRANCH` optional for `baseline`/`local` and still required for `production`. **Verified:** PostgreSQL 18.6, 8 migrations, 11 categories + 43 tags seeded, **preflight 21/21**, typecheck + lint + build green, drift test proven to fail on drift. Full suite: **1 pre-existing failure**, filed as #207. **Not committed** — the pre-commit hook refuses a partial stage and the tree carries 28 unrelated in-flight files. **Merged to main 2026-08-28** (4dc4159). |
| **201** | **[PLATFORM] Split development onto its own Neon project** | **INFRA** | **M-OPS** | **P1 High** | **Done** | — | **None** | `core` | **Platform / cost.** Filed 2026-08-28. The 100 CU-hour allowance is **per project**, and `dev` + `production` currently share one — development spends production's budget and can suspend it. Free plan allows 100 projects. Create `vendor-marketplace-dev`, move the `dev` branch's role there, repoint `.env`. Complements #200: Docker for day-to-day, the dev project for Neon-specific behaviour (pooling, SSL, cold starts). Production keeps its own untouched 100 **Human gate: a confirmation only.** Project creation runs through the Neon MCP; it changes account structure, so the agent must ask before creating. **Closed 2026-08-28 without work — #200 removed the cause.** The 100 CU-hour cap is per project and the burn was a `pnpm dev` pool holding a Neon compute awake ~12h/day. Local now runs on Docker, so the remaining Neon consumers are the staging deploy, CI migrations and short-lived preview branches — nowhere near the cap. A second project would be an unused thing to maintain. **Revisit only if staging compute ever threatens production's quota**; #206 removes the cap entirely. |
| **202** | **[PLATFORM] Cut a `production` git branch and repoint Vercel's production deploy** | **INFRA** | **M-OPS** | **P0 Critical** | **Done** | main | **None** | `core` | **Platform / release process.** Filed 2026-08-28. `origin/main` is the **only** remote branch and Vercel deploys it, so every merged ticket ships to users immediately — there is no batching and no staging gate. Add a `production` branch that advances **only by fast-forward from `main`** at release time, tagged `vX.Y.Z`; flip Vercel's Production Branch setting `main` → `production`; `main` becomes the staging deploy. Extend `ci.yml` triggers (currently `[main]` only). Deliberately **not** Git Flow — no `develop`, no `release/*`, no hotfix branches; that ceremony is built for teams cutting quarterly releases. **Repo is not linked to Vercel locally** (`vercel env ls` errors), so confirm which branch and which `DATABASE_URL` production currently holds before changing anything **Human gate: two dashboard actions.** (1) Vercel → Project → Settings → Git → **Production Branch** `main` → `production`. (2) GitHub → branch protection on `production` (no direct pushes, fast-forward only). The agent can create the branch and extend `ci.yml`; it cannot complete the ticket without those two. **Done 2026-08-28:** `production` branch created at main and pushed; `ci.yml` triggers extended to `[main, production]`; **branch protection applied to both** — deletions blocked, force pushes blocked, linear history required, `Typecheck, lint, build, test` required. **Outstanding:** flip Vercel Production Branch `main` -> `production`. **Reconciliation 2026-08-29 — filed without reading `D10` or the plan.** The runtime split (web on Vercel, API on **Railway**) is decided in `vendor-marketplace-decisions.md` D10, and the release pipeline is already ticketed as **#20 Deploy Pipeline** (P0, blocked by #18, #19, #30). Treat this row as the git/branch-protection slice of #20, not a new ticket. **Done 2026-08-29.** Vercel Production Branch flipped `main` -> `production`, confirmed by reading `link.productionBranch: production` from the API. `production` branch exists and is protected alongside `main` (no deletions, no force pushes, linear history, CI required). `main` now produces previews; the live site advances only on a deliberate fast-forward. |
| **203** | **[PLATFORM] Create the Neon `staging` branch and point the staging deploy at it** | **INFRA** | **M-OPS** | **P0 Critical** | **Done** | — | **None** | `core` | **Platform / environments.** Filed 2026-08-28. Gives `main` a database that is not production. Branch `staging` off `production`, seed it, point the staging deploy's `DATABASE_URL` at it. Establishes the intended lineage: `production` (root) → `staging` → per-PR branches (#205). Define and document the reset cadence — staging is refreshed **from** production, never the reverse. Anonymise on reset once real user data exists **Human gate: one env-var change.** Branch creation runs through the Neon MCP; setting the staging deployment `DATABASE_URL` is a Vercel dashboard/CLI action, and per project law the value is never pasted into a command or Claude config. **Done 2026-08-28:** Neon `staging` branch created off `production` (`br-weathered-voice-axipsv3f`, compute 0.25-1 CU). **Outstanding:** point a staging deployment at it. **Reconciliation 2026-08-29:** a staging *web* deploy is only half of staging — the API runs on Railway (D10), so staging needs a second Railway service or environment with its own `DATABASE_URL` pointed at the `staging` branch. Until then a staging web app calls the production API. Belongs with **#19 Production Environment Provisioning**. **Done 2026-08-29.** Neon `staging` branch (`br-weathered-voice-axipsv3f`) plus a full Railway `staging` environment with its own service instance and 29 variables — DB pooled and unpooled both verified against the staging compute (`ep-jolly-poetry-ax8noqyz`), Clerk on matching test keys. Deployed and healthy: `/ready` returns `database: up, storage: up`, and `/vendors` returns 0, matching the `production` branch it forked from rather than `dev`. Domain `vendor-marketplace-staging.up.railway.app`. Vercel Preview `NEXT_PUBLIC_API_URL` and `API_URL` repointed at it. |
| **204** | **[PLATFORM] Run migrations from CI, with production behind a required approval** | **INFRA** | **M-OPS** | **P0 Critical** | **Done** | main | **None** | `core` | **Platform / safety.** Filed 2026-08-28. **The single largest risk in the current setup:** no workflow in `.github/workflows/` runs `db:migrate`, so schema changes reach any database only when a human runs it from a laptop against whatever `DATABASE_URL` sits in their `.env`. That is the literal mechanism by which local tinkering can alter production. Add: merge to `main` → migrate **staging**; merge to `production` → migrate **prod**, gated behind a **GitHub Environment with a required reviewer**. `resolveMigrationUrl()` already prefers the unpooled endpoint and is correct for this — it is simply never invoked by CI. Store the two connection strings as GitHub Environment secrets (never in the repo, per project law). Document **expand/contract** in the decisions file: add + backfill, then stop writing, then drop — three releases, never one, because rollback is a redeploy of the previous version and that version still expects the column **Human gate: secrets entry.** The two connection strings must be added by the account owner as GitHub Environment secrets, and the `production` environment given a required reviewer. **The agent must never handle these values** — project law. Workflow YAML is agent-executable; the secrets and the reviewer rule are not. **Done 2026-08-28:** migrate-staging and migrate-production jobs added to `ci.yml`, both `needs: verify` and both opting out of cancel-in-progress; GitHub Environments **`db-staging`** and **`db-production`** created, the latter with a required reviewer. **Named `db-*` deliberately:** Vercel owns an environment called `Production` and GitHub matches environment names case-insensitively — writing to `production` put a reviewer and an empty branch policy on Vercel's environment, which would have blocked every deploy. Caught and reverted the same session; `Production` is back to zero protection rules and its latest deploy reports `success`. **Outstanding:** add `DATABASE_URL_UNPOOLED` to both environments. **Reconciliation 2026-08-29 — likely redundant, needs a decision.** `railway.json` already carries `preDeployCommand: node .../migrate.js`, so **Railway migrates on every deploy** before the new container takes traffic, and the plan's intended pipeline is `migrate (unpooled) -> deploy api (Railway) -> deploy web (Vercel) -> smoke /ready` in a `deploy.yml` that does not exist yet. The CI jobs added here are a third path to the same DDL. Idempotent and advisory-locked, so not dangerous, but **one of the two should own migrations** — either drop the `preDeployCommand` or drop these jobs. Fold into **#20**. **Resolved 2026-08-29 — Railway owns migrations; the CI jobs are deleted.** User ruling. `railway.json`'s `preDeployCommand` runs the compiled migrator before a new container takes traffic: atomic with the deploy that needs the schema, and unskippable. The CI jobs were a second path, and the first real run of the sibling preview workflow proved them broken anyway (`ERR_MODULE_NOT_FOUND` — install then migrate with no build, fixed in 05c2c32 before removal). `DATABASE_URL_UNPOOLED` is therefore **not** needed in GitHub Environments. The `db-staging` and `db-production` environments and the `DB_MIGRATIONS` variable are now unused. |
| **205** | **[PLATFORM] Ephemeral Neon branch per pull request** | **INFRA** | **M-OPS** | **P1 High** | **Done** | — | **None** | `core` | **Platform / environments.** Filed 2026-08-28. Wire Neon's Vercel integration or `neondatabase/create-branch-action` so each PR gets a copy-on-write branch off `staging`, deleted on merge. Gives every PR preview a full-fidelity database to run its migrations against in isolation — the capability self-managed Postgres cannot offer, and the strongest reason this stack is on Neon. Watch the **10 branches/project** free-plan ceiling; set a TTL so abandoned PRs do not hold slots **Human gate: an OAuth install.** Authorising Neon against the Vercel or GitHub account is an interactive consent screen. Once installed, configuration is agent-executable. **Done 2026-08-28:** `.github/workflows/preview-branch.yml` added — creates a branch off `staging` per PR, applies that PR's migrations to it, deletes on close, with a 7-day `expires_at` as a backstop against the 10-branch ceiling. Both Neon actions are **pinned to commit SHAs**, not tags: each receives `NEON_API_KEY`, so a retagged release would hand over a project-wide credential. Gated behind a repository variable so it stays inert. **Outstanding:** add the `NEON_API_KEY` secret and set `NEON_PREVIEW_BRANCHES=on`. **Done 2026-08-29 — proven end to end on PR #1, not asserted.** Project-scoped Neon key (id 3294733, Editor on this project only) piped straight into `gh secret set` so the value never touched a transcript; `NEON_PREVIEW_BRANCHES=on`. The first real run **failed** with `ERR_MODULE_NOT_FOUND` — `migrate.ts` imports the shared package's build output and the workflow never built it; fixed in 05c2c32, which also repaired the same defect in the CI jobs. Re-run: branch `preview/pr-1` created off `staging` (`creation_source: github`, 7-day TTL), `Migrations applied.`, and deleted on PR close. Both Neon actions pinned to commit SHAs because each receives `NEON_API_KEY`. |
| **206** | **[PLATFORM] Upgrade production to Launch and give it a real recovery story** | **INFRA** | **M-OPS** | **P3 Low** | **Deferred — needs a human** | — | **Launch prep — not current work** | `core` | **Platform / durability.** Filed 2026-08-28. Free-plan production is not launch-safe: **6-hour** history window, **zero** snapshots taken, `protected: false` on the production branch, scale-to-zero **cannot be disabled** (cold start for the first visitor after 5 min idle), 0.5 GB storage cap whose breach makes **inserts/updates/deletes fail**, 5 GB/month account-wide egress, community support, no SLA. Launch is pay-as-you-go with no minimum — roughly **$5–25/month** here. On upgrade: enable **protected branches** on `production`, widen the history window to **7 days**, set a **scheduled backup**, disable scale-to-zero once real traffic exists, and set a **spending notification**. Separately and regardless of plan: **`pg_dump` to R2 on a schedule** — PITR and snapshots protect against your mistakes, an off-platform dump protects against the platform's (lockout, billing failure). Keeping that habit from self-managed Postgres is the point **Human gate: billing.** Entering payment details and selecting the Launch plan is the account owner's action alone. Every post-upgrade setting — protected branch, 7-day history, backup schedule, spending notification — is agent-executable afterwards. **Reconciliation 2026-08-29:** overlaps **#19**, which already covers external-account provisioning and is `Deferred — needs a human`. The plan's launch checklist also requires the pooled string on Railway and the unpooled one on Railway *and* GitHub Actions. **Deferred to launch prep 2026-08-29 (user ruling).** Free is the correct plan while there is no real data — usage is **8.9 of 100 CU-hours**, 34 MB of 512 MB, 3 of 10 branches. Nothing here blocks development. **The checklist moved to `docs/pre-launch.md` §3.2**, which is where launch-gated work belongs; this row is a pointer, not a queue item. Do not re-surface it as active work. |
| **207** | **`nearby-availability` computes "today" in two timezones — the suite fails every evening** | **P1** | **M3** | **P1 High** | **Backlog** | — | **None** | `core` | **Found 2026-08-28** running the gate for #200; **pre-existing**, reproduced with that ticket's source changes stashed. `never suggests a past date when the wanted date is today` asserts `expected '2026-08-28' to be '2026-08-30'`: the test helper `dayFromToday` and the route disagree about which day it is once local time passes UTC midnight (failure observed at 22:26 local = 05:26 UTC the next day). Violates the deterministic-test law — the suite reads the real clock, so it is green all morning and red all evening. **Root cause corrected 2026-08-29 while running the gate for #235** — this is a production defect, not a flaky test, and the remedy first written here would have hidden it. `apps/api/src/modules/vendors/nearby-availability.dao.ts:51` floors the search window at `GREATEST(${target}::date - ${windowDays}::int, CURRENT_DATE)`. `CURRENT_DATE` resolves in the **database session's timezone**, while every date the endpoint accepts and returns is a UTC `YYYY-MM-DD` string. West of UTC the two disagree between local midnight and UTC midnight, and the endpoint answers with a date that has already gone. Re-observed at 20:58 EDT / 00:58 UTC: `apps/api/src/modules/vendors/nearby-availability.routes.test.ts:178` got `2026-08-29` where the contract's today was `2026-08-30`. Directly violates `.claude/rules/shared-contracts.md`. **Injecting a fixed clock would make the suite green and ship the bug** — the test is reporting a real defect, so fix the floor, not the clock. **CI can never catch it**: runners are UTC, so `CURRENT_DATE` and the UTC date always agree there. `isUniversallyPastDate` is *not* the bug — its yesterday-UTC floor is deliberately lenient and correctly named. **Fix:** floor on the same UTC date the contract uses, passed in rather than read from the session. **Test:** run the case with the session timezone set west of UTC, which is the only way this fails. **Filed independently three times** — here, by lane 82 (2026-08-29, as a real-clock test dependency), and by lane 235, which folded its own filing into this row on merge. Three lanes reaching the same test from different tickets is the measure of how often it fires locally, and of how completely a UTC-only CI hides it. |
| **235** | **The app's inherited line-height is 1.5, so every arbitrary `text-[Npx]` renders loose against its frame** | **P1** | **M3** | **P1 High** | **Done** | `worktree-235` | **#165** | `core` | **Found by #74's browser measurement 2026-08-29, with compiled-CSS evidence.** #74 set every `--text-*--line-height` to `normal`, which only reaches elements sized by a named scale step. 96 sites across 40 files use an arbitrary `text-[Npx]`, which emits `font-size` and nothing else, so they inherit Preflight's `html{line-height:1.5}`. **Three of #74's five acceptance controls still fail because of this.** Owns the one-line fix #165 declined to absorb. Work before #198. **Done 2026-08-29 on `worktree-235`.** One declaration — `line-height: normal` on `html` in `globals.css`'s base layer, the CSS keyword and not Tailwind's `leading-normal`, which is the 1.5 being removed. `parity-checker` re-measured frames `01`, `02` and `03` at 1440x900 against the frames rendered in the same Chromium after `document.fonts.ready`: **all six named controls MATCH at 0.00 delta** — category card 157.00, its `.sh` title 22.00, its description 14.00, refine chip 31.00, `.lbl` micro-label 13.00, frame `03` rail price 47.00 — plus ten further type sizes checked as corroboration, all zero delta. **One regression, fixed:** `suspended/page.tsx`'s paragraph was the only wrapped prose in the app living on the inherited 1.5 and measured 1.25 once it was gone; it now asks for `leading-prose` explicitly, which is the rule `theme.css:82-85` already states ("a ratio belongs to the element that wraps, not to the step"). `browser-verifier` then swept all eight authenticated screens at both roles — **zero further regressions**; `theme.css` pairs every `text-*` step with its own `line-height: normal`, so `html` is load-bearing only for the arbitrary sites this ticket targeted. No horizontal overflow on any screen. **The ticket's second required test was not implemented as written** — it asks that every `text-[Npx]` ship with a `leading-*`, which contradicts this ticket's own first acceptance criterion and `theme.css`'s law; the inherited default is pinned instead. Findings filed: **#280**, **#281**, **#282** |
| **262** | **11 Availability — The calendar has no `completed` cell state** | P1 | M3 | P1 High | Backlog | — | None | `core` | **Filed by lane 153, frame `11 Availability` re-run 2026-08-29.** Frame `11 Availability` and `19-availability.md` both specify `completed` as an **MVP** state: `sage-50` fill, `sage-600` numeral, a **check glyph**, `padding:5px 0 10px`, and clickable — it opens the past booking. `AvailabilityStatus` has four members and `completed` is not one. So the cell state, its legend row (`Completed · check`), its `This quarter` row (`Completed` / `2 events`) and the instruction clause `and completed events stay on the calendar — click one to open it.` are all absent. Nothing in the Post-MVP section defers it. **Blocks the Text axis closing on #163**, which deliberately stopped short of the frame's full instruction rather than promise behaviour that does not exist |
| **263** | **11 Availability — The legend renders flat colour chips, not the actual marks** | P1 | M3 | P1 High | Backlog | — | None | `core` | **Filed by lane 153, frame `11 Availability` re-run 2026-08-29.** Frame draws each legend swatch **22x22, radius 6px**, containing the numeral at 10px/600 in that state's own text colour, plus the real mark — dot, dashed border, hatch + strikethrough, check. Live draws **18x18, radius 5px**, empty and `aria-hidden`, and **5 rows where the frame has 7**. Labels also drop the frame's qualifier suffixes (`Available — no mark`, `Booked — locked · dot`). `19-availability.md`: *"The legend renders the actual marks, not plain colour chips. A legend of flat swatches is the one place the distinction would be invisible."* Pairs with #166 |
| **264** | **11 Availability — `Today` is a clay ring where the frame draws an ink border** | P1 | M3 | P2 Medium | Backlog | — | None | `core` | **Filed by lane 153, frame `11 Availability` re-run 2026-08-29.** Frame and the plan's revised state table both draw today as **`1.5px solid #23201C`** on the cell, `font-weight:600`, `padding:5.5px 0`. Live uses `ring-2 ring-clay-400` at weight 400 — an outward ring in the *selecting* colour, so today and an in-progress drag share a colour family. **`19-availability.md` contradicts itself here**: its prose says a `clay-400` ring while its revised table says the ink border. The frame agrees with the table, so the prose is the line to correct |
| **265** | **11 Availability — Month range and quarter rows render 13.5px against the frame's 13px** | P1 | M3 | P2 Medium | Backlog | — | None | `core` | **Filed by lane 153, frame `11 Availability` re-run 2026-08-29.** Frame sets the month-nav row and the `This quarter` rows at **13px**; live uses `text-base` (`--text-base: 13.5px`). `--text-action: 13px` already exists in the scale and carries `line-height: normal`, so this is a token swap. Axis **Font** |
| **266** | **11 Availability — Helper line and market note inherit a 1.5 line-height** | P1 | M3 | P2 Medium | Backlog | — | None | `core` | **Filed by lane 153, frame `11 Availability` re-run 2026-08-29.** Frame helper line is `line-height: normal` (16px); live renders **20.25px** from `leading-normal`. Frame market note is 1.55 (19.375px); live is `leading-relaxed`, 1.625 (**20.3125px**). Separate from **#235**: the month heading (27px vs 24px) and the selected range (30px vs 26px) are loose for #235's reason — arbitrary `text-[18px]` / `text-[20px]` emit no line-height — but these two are explicit leading utilities that simply do not match the frame. Axis **Font** |
| **267** | **11 Availability — Focus ring is clipped on controls flush with the pane edge** | P1 | M3 | P1 High | Backlog | — | None | `core` | **Filed by lane 153, frame `11 Availability` re-run 2026-08-29.** Both panes are `overflow: auto` (`section.app-pane` at `y:86`, `aside.app-pane` at `y:86`). A control whose box sits flush with the top edge has its **outward 4px focus ring clipped**. Pixel-sampled from a screenshot with the control focused: ring absent 3px above, present 3px below/left/right. The ring token itself computes correctly everywhere — this is the failure mode `04-laws.md` warns about, where it computes right and renders invisible. The frame specifies `overflow: hidden` on the rail, and **neither pane needs to scroll** (`scrollHeight === clientHeight` on both), so `overflow:auto` is buying nothing. Same class as ledger finding `P1-3`. #157 removed the two controls that were sitting on the edge, so the hazard is currently latent rather than firing — fix the container, not just the symptom. Axis **Access** |
| **268** | **11 Availability — Weekday headers announce as blank and the month tables are unnamed** | P1 | M3 | P2 Medium | Backlog | — | None | `core` | **Filed by lane 153, frame `11 Availability` re-run 2026-08-29.** Each weekday header is `<th scope="col"><span aria-hidden="true">S</span></th>` — the only content is hidden from assistive technology and nothing replaces it, so all seven `columnheader`s have an **empty accessible name** and the `scope="col"` association conveys nothing. Separately, all three `<table>`s have no `<caption>`, `aria-label` or `role`, so three sibling grids of bare numerals give no way to tell which month you are in. The frame uses plain spans in a CSS grid and has no table semantics to satisfy; if the table stays, the headers need real names. Axis **Access** |
| **269** | **11 Availability — Day grid uses `border-spacing`, adding an outer gutter the frame has not** | P1 | M3 | P2 Medium | Backlog | — | None | `core` | **Filed by lane 153, frame `11 Availability` re-run 2026-08-29.** Frame draws the day grid as a CSS grid with `gap:4px` and **no outer gutter**, cell width **32.09px**. Live uses a `<table>` with `border-spacing:4px`, which also applies *outside* the edge cells — insetting the grid 4px on all sides and narrowing every cell to **31.03px**. Separately the frame draws adjacent-month numerals (June shows `31` in `stone-500`, no background) where live renders empty `<td>`s in every month. Axis **Layout** |
| **270** | **11 Availability — The rail fill starts 22px below the header** | P1 | M3 | P2 Medium | Backlog | — | None | `core` | **Filed by lane 153, frame `11 Availability` re-run 2026-08-29.** Frame's rail box begins flush with the header (`y:66`), so its cream fill and 1px left border run the full height of the shell. Live begins at `y:86` — `pt-5.5` on the page wrapper leaves a **22px stone-50 band** above the rail, so both the fill and the border stop short of the header. Axis **Layout** |
| **271** | **11 Availability — Past day cells have no fill** | P1 | M3 | P2 Medium | Backlog | — | None | `core` | **Filed by lane 153, frame `11 Availability` re-run 2026-08-29.** Frame draws a past date as `background:#F8F5EF` with `border-radius:7px`. Live `PAST_STYLE` sets only `cursor-not-allowed text-stone-500`, so `backgroundColor` computes `rgba(0,0,0,0)` and past days sit as bare text on the page ground rather than as filled inert cells. Axis **Style** |
| **272** | **11 Availability — `Clear` padding and radius differ from the frame** | P1 | M3 | P2 Medium | Backlog | — | None | `core` | **Filed by lane 153, frame `11 Availability` re-run 2026-08-29.** Frame draws `Clear` at `padding:8px 6px` with no radius and no background. Live renders `6px 12px` with `rounded-lg`, from Button `size="sm"`. The **colour** half of this control was closed by #158; this is the remaining Style half, split out rather than folded into a Colour ticket. Axis **Style** |
| **273** | **11 Availability — `Block these` carries a shadow and border the frame does not draw** | P1 | M3 | P3 Low | Backlog | — | None | `core` | **Filed by lane 153, frame `11 Availability` re-run 2026-08-29.** The `primary` variant adds `shadow-sm` (`rgba(35,32,28,.06) 0 2px 10px`) and the Button base adds `border border-transparent` (1px on every side). The frame draws a flat span with neither. Deliberately **not** folded into #156, which was scoped to padding: `03-components.md` may intend the shadow on every primary button, in which case the frame is the thing to reconcile rather than this call site. Axis **Style** |
| **274** | **11 Availability — Two rail strings are in neither the frame nor the voice guide** | P1 | M3 | P2 Medium | Backlog | — | None | `core` | **Filed by lane 153, frame `11 Availability` re-run 2026-08-29.** `No dates selected yet.` — added by **#163** to replace a rail instruction that contradicted the pane — and `Open these up`, the primary label when the selection is already blocked. Neither appears in frame `11 Availability` nor in `31-content-voice.md`. The frame draws no empty state and no blocked-selection state, so it cannot settle either. Both need approving into the voice guide or replacing with approved copy. Axis **Text** |
| **275** | **[DESIGN] Frame `11 Availability` draws a designer's rationale note that should not ship** | P1 | M3 | P2 Medium | Backlog | — | None | `core` | **Filed by lane 153, frame `11 Availability` re-run 2026-08-29.** The frame's rail draws, as styled UI: *"Every state carries a shape as well as a colour, so the calendar still reads in greyscale and for colour-blind vendors. Fill alone is never the signal."* That is process commentary explaining change order **A1** to a reader of the design, not copy addressed to a vendor using the product. **QUESTION — do not build until answered:** confirm it is an annotation and is excluded from the build. Filed rather than silently ignored, because a parity pass otherwise reports it as a missing element on every future run. **#166 is the ticket that implements what the sentence describes** |
| **276** | **[DESIGN] `19-availability.md` says "no month navigation" twice while the frame draws it** | P1 | M3 | P2 Medium | Backlog | — | None | `core` | **Filed by lane 153, frame `11 Availability` re-run 2026-08-29.** The plan says *"three months across ... which covers a typical booking horizon **with no month navigation**"* and repeats it in its own acceptance checklist (*"Three months visible at 1440 with no month navigation"*). Frame `11 Availability` draws `‹ June — August 2026 ›`, and the app implements paging. **#157** built the frame's glyphs under the standing rule *"where the two disagree, build the frame and correct the plan"*. The plan is the half still to correct, by whoever owns it — tickets write code, design passes edit the plan |
| **277** | **The frames use a 12px radius 69 times and the radius scale has no 12px step** | P1 | M3 | P2 Medium | Backlog | — | None | `core` | **Filed by lane 153, frame `11 Availability` re-run 2026-08-29.** `--radius-*` is 6 / 8 / 10 / 14 / 18. **12px is the second most common radius in the frame bundle — 69 uses, against 50 for 14px** — and has no token, so #154 and #155 both had to reach for `rounded-[12px]`. Either the scale is missing a step or those 69 frame uses should be 14px; that is a foundations decision, not a per-screen one. Note the *type* scale has no such gap: `--text-meta: 12px` already exists and #159 used it |
| **278** | **[DESIGN] The frame's blocked hatch puts text on a band that fails AA** | P1 | M3 | P3 Low | Backlog | — | None | `core` | **Filed by lane 153, frame `11 Availability` re-run 2026-08-29.** The blocked cell's hatch alternates `#EFE9E0` / `#E0D8CA` every 3px under `#6B6459` text. Against the dark band alone that is **4.13:1**, below AA. Over the alternation the perceived ground is roughly `#E7E0D5`, which clears, so the frame reads acceptably — but a verbatim implementation puts glyph strokes directly on the failing band. Worth resolving against `19-availability.md` before **#166** builds the hatch, rather than after |
| **279** | **`availability-calendar.test.tsx` asserts class tokens with `toContain`, which a longer token satisfies** | P2 | M3 | P3 Low | Backlog | — | None | `core` | Filed 2026-08-29 while merging lane 153. Residue of the reviewer finding in `lane-handoff-2026-08-29.md` §2. The specific `toContain('py-2')` defect is **gone** — `4aedac7` introduced an exact-token `hasClass` helper — but ~10 assertions still compare class strings with `toContain`, where `bg-clay-400` is satisfied by `bg-clay-400/30`. Convert them to `hasClass`. Also §2's third finding: three assertions near the `FRAME_11_RAIL` slice helpers assert literals their own slice starts with, and one is unreachable because the IIFE throws at module load when the slice is empty |
| **280** | **01 Landing — the six category cards are keyboard-focusable and draw no focus ring at all** | P1 | M3 | **P1 High** | Backlog | — | None | `core` | Found 2026-08-29 by the `parity-checker` re-measurement for **#235**. `apps/web/src/app/page.tsx:318` — the card `<Link className="block h-full overflow-hidden rounded-xl bg-stone-0 shadow-sm …">` carries no `focus-visible:` classes. Measured: tabbing to it gives `el.matches(':focus-visible') === true`, `outline-style: none`, and a `box-shadow` resolving to the card's own shadow only, ring width **0**. Distinct from **#252** (vendor card, ring computes correctly then is clipped by an `overflow-hidden` parent) — here no ring is emitted in the first place. All six cards affected. Violates `04-laws.md`'s focus-ring law |
| **281** | **02 Search — the frame's `Style ▾` refine chip has no group in the data model** | P1 | M3 | P2 Medium | Backlog | — | None | `core` | Found 2026-08-29 by the `parity-checker` re-measurement for **#235**. Frame `02` and `11-search.md` lines 78 and 123 both draw six refine chips; live renders five. `Style ▾` is absent because `TAG_CATEGORIES` in `packages/shared/src/constants/index.ts:224` is `['language', 'cultural', 'dietary']` — there is no `style` group at all, so this is a data-model gap rather than a missing control. Needs a ruling on whether `style` becomes a fourth tag group (and what seeds it) or the frame and plan are corrected |
| **282** | **01/02 — three residual style and text deltas the #235 re-measurement surfaced** | P2 | M3 | P3 Low | Backlog | — | None | `core` | Found 2026-08-29 by the `parity-checker` re-measurement for **#235**, all pre-existing and none caused by it. (1) Frame `01` hero collage tiles 1 and 2 draw `border-radius: 16px`; live uses `rounded-[18px]`. Tile 3 is 14px in both. (2) Frame `01` draws the Event date field as plain text `Add a date`; live renders a native `<input type="date">`, so Chrome paints a calendar glyph inside the hero pill. (3) Frame `02`'s search-bar label is `Event date`; live says `Date` — note `11-search.md:76`'s sketch also says "Date", but the frame wins per `04-laws.md`. Frame `02`'s default sort is `Top rated ▾` against live's `Most relevant ▾`; "Top rated" exists and renders correctly when chosen, so this is a default-state choice and the weakest of the four |
| **283** | **[DESIGN] Frame `03`'s caption and `12-vendor-profile.md` both say the avatar overlaps by 34px; the markup renders 16px** | P1 | M3 | P2 Medium | Backlog | — | None | `core` | **Found 2026-08-29 by lane 82 while closing #65.** Frame `03`'s rendered markup overlaps the cover by **16.00px** (cover bottom 262, avatar top 246) because the identity row's `margin-top:-34px` is cancelled by the column's `padding-top:18px`. But frame `03`'s `sc-d` caption says *"overlap its lower edge by 34px"* and `12-vendor-profile.md` repeats 34px in both its composition diagram and its acceptance box. Two non-authoritative sources against the markup, and `04-laws.md` precedence puts the markup first. This cost a ticket (#65, user-reported) that turned out to be measuring the caption. **Correct the caption and the plan line to 16px.** Design pass only — no app code changes. **DESIGN DROP 2026-08-29:** **moot — close as superseded.** The overlap this argues about is removed at every width by #287; there is no avatar over a cover for the caption and the plan to disagree on. |
| **284** | **The vendor profile's sticky rail slides 22px under the header at max scroll** | P1 | M3 | P2 Medium | Backlog | — | None | `core` | **Found 2026-08-29 by lane 82's frame-03 pass.** `lg:top-[calc(var(--header-height)+16px)]` computes to `80px`, but at maximum scroll `aside.getBoundingClientRect().y` is **42.1** — 22px of the card sits behind the 64px sticky header, on all five tabs (packages 41.7; portfolio/reviews/availability 42.0). Cause: the grid's `pb-14` puts the sticky containing block's content bottom at 544.3, and 544.3 − 522.25 (wrapper height) = 22.05, which clamps the offset before it reaches 80. `12-vendor-profile.md` says the rail is *"offset by the header so it never slides under it"*. The frame's 900px shell cannot show this, so no frame contradicts the fix. |
| **285** | **The rating star renders as a filled clay SVG where every frame draws a text glyph** | P1 | M3 | P3 Low | Backlog | — | None | `core` | **Found 2026-08-29 by lane 82's frame-03 pass.** Live: a 14px lucide `Star` SVG with `fill: rgb(180,85,47)` (clay-400). Frame: a `★` text glyph at 13px inheriting `#4A443C`. **All 19 `★` occurrences in the entire frame file are text glyphs** inheriting `#6B6459`/`#4A443C`; no frame anywhere draws a filled star icon. Affects the profile and every vendor card, so it is a systemic Style/Colour miss rather than one screen's. Note clay-400 as an icon fill is not the same rule as clay-400 as text, which is banned — check `01-foundations.md` before choosing the replacement colour. |
| **286** | **The vendor profile tabs implement `role=tablist` without the keyboard pattern it promises** | P1 | M3 | P2 Medium | Backlog | — | None | `core` | **Found 2026-08-29 by lane 82's frame-03 pass.** All five tabs sit in the Tab order with `tabindex` unset and `ArrowRight` from `About` does nothing — there is no roving tabindex. Announcing `role=tablist` while behaving like five plain links is worse than not announcing it: a screen-reader user is told to expect arrow-key navigation that is not there. Either implement the ARIA tabs pattern (roving tabindex, Arrow/Home/End) or drop the tablist roles. Pairs with **#254**, which is the same row's focus ring being clipped by its `overflow-x-auto`. |
| **287** | **Vendor profile header — retire the banner and the overlapping avatar; the search card persists as the header** | P1 | M3 | **P0 Critical** | Backlog | — | None | `core` `storage` | **Change order `CHANGE-ORDER-2026-08-29.md`, design drop 2026-08-29.** Frames `03 Vendor profile` (changed), `27 Vendor profile — 1024` (new), `27 Vendor profile — 768` (new), `14 Vendor profile mobile` (changed) + the rewritten `12-vendor-profile.md`. The full-bleed 196px banner and the 82px avatar overlapping it are **removed at every width** — this deliberately unships **#53**, **#65**, **#104** and **#105**, so read the new spec before reusing any measurement from them. The header becomes the vendor's *search card unpacked horizontally*: identity left, **one 3:2 cover flush to the card's top, right and bottom edges**, the sage `Free Jun 14` chip persisting from the search card. The cover carries **no link, no counter, no gallery affordance** — Portfolio is reached only by its tab. Card min-height 200 / 187 / 179 at 1440 / 1024 / 768, cover 300 / 280 / 268px flush right, rail 380 / 320px sticky then a bottom bar at 768 and 390. **390 is the only width that stacks, and it stacks identity *above* cover.** The five rules in the change order are the acceptance criteria; rule 2 (identity never on the photograph) and rule 5 (nothing sticky covers content) are the ones prior builds broke. Parity gate at **1440 / 1024 / 768 / 390**. |
| **288** | **Vendor profile editor — 3:2 cover field and the 308px preview rail** | P1 | M3 | **P1 High** | Backlog | — | None | `core` `storage` | **Change order `CHANGE-ORDER-2026-08-29.md`.** Frames `09 Vendor profile editor` (changed), `27 Vendor profile editor — 768` (new), `14 Profile editor mobile` (new), `14 Profile editor preview sheet` (new) + the rewritten `17-vendor-profile-editor.md`. **Unblocks #137**, which was blocked because the design contract contradicted itself on this field. Media row first: 128px circle profile photo beside a **216×144, 3:2** cover drop zone reading *"Drop a photo or browse · landscape · 1200×800 or larger"* — the old `21:9, 1600×686 min` ask is retired. The card preview is **never a field**: a **308px right-edge rail** at ≥1024 (`stone-100`, `stone-300` left border) holding a mono `PREVIEW` label with "Updates as you type", an **In search / Your profile** segmented toggle, the vendor's real card at full size, and one line of explanation — **no link out**, because `Preview` in the sticky submit bar already goes there. Rail 280px at 1280; a panel **above** the fields at 768; a preview strip that opens a **bottom sheet** at 390. **There is no separate profile-banner field and there must never be one** — one file, two placements, per #287. Parity gate at 1440 / 1024 / 768 / 390. |
| **289** | **Vendor profile About pane — drop the tagline pull-quote and the Recent-work strip, add "What's included"** | P1 | M3 | P2 Medium | Backlog | — | **#287** | `core` | **Change order `CHANGE-ORDER-2026-08-29.md`**, `12-vendor-profile.md`. The tagline moves into the identity card, so the About pane stops repeating it. The **4-up "Recent work" strip is removed** — the header cover and the Portfolio tab already carry the photography. About becomes: bio at max 640px, **three** stat tiles (Experience / Events / Travels), then **"What's included"** as three sage-dot lines and a `See all packages →` link into the Packages tab. Blocked on **#287** only because both edit the same screen; there is no data dependency. |
| **290** | **Landing at 768 — the first tablet frame the landing page has ever had** | P1 | M3 | **P1 High** | Backlog | — | None | `core` | **New frame `14 Landing tablet`, design drop 2026-08-29** — `30-responsive.md` previously said 768 was *"specified here but not yet drawn"*, and now it is drawn. This **overrides the old "the cluster never sheds a card" rule**: the frame draws **two hero cards at 0.62**, because the third would be 105×85 and the floor is *no hero card below ~140px on its short edge*. Also at 768: the **search bar drops below the split** so it runs the full frame width, and **categories go three across in two rows**. Rotated art needs ~30px clearance on both axes, not a flush fit — see the new `### Rotated art needs clearance on both axes` section. Does **not** change 1024, which keeps all three cards at 0.73. Parity gate at 768 against the new frame. |
| **291** | **[DESIGN] The tab-swap threshold contradicts the 1024 frame it ships beside** | P1 | M3 | P2 Medium | Backlog | — | None | `core` | **Found 2026-08-29 merging the design drop.** The rewritten `12-vendor-profile.md` moves the tab threshold from `≥1024` to **`≥1280`** ("below 1280 they become anchored sections"), but the drop's own new frame **`27 Vendor profile — 1024` draws all five tabs and a 320px rail**, and `30-responsive.md` §1024 states that *1024 renders the desktop composition, not a tablet one* — the rule change order **B4** exists to enforce. Three parts of the contract disagree. **The repo law is that the frame is the tiebreak**, which would keep `≥1024`; the prose change may still be deliberate. Needs a ruling, not a guess — resolve before **#287** builds the tab row. |
| **292** | **[DESIGN] Frame `28 Dropdown open — hero` hardcodes the brand name where every peer frame uses the token** | P1 | M3 | P3 Low | Backlog | — | None | `core` | **Found 2026-08-29 merging the design drop.** The 2026-08-29 export regressed `28 Dropdown open — hero`'s wordmark from `{{ brandName }}` to the literal `Orla`; nine sibling frames still carry the token. The `.dc.html` is **left byte-identical to the export on purpose** so the next import diffs cleanly, so this is a note against the source design project, not a file to patch here. (`15 404` and `16 Server error` carried the literal before this drop too.) **The code law is unchanged and binding: the user-facing name is read from `BRAND_NAME` and never written as a literal** — no ticket may copy this frame's string. |
| **293** | **`nearby-availability` builds test dates in UTC while the route reads server-local time, so the suite fails locally every evening** | P1 | M3 | P2 Medium | Backlog | — | None | `core` | **Found 2026-08-29 by lane 170** while running the API suite. Not caused by any diff — reproduced on a clean tree with `git stash`. See detail section |

Rows are ordered by build sequence, not by ticket number. **291 rows — 143 Done, 4 In Progress, 122 Backlog, 4 Deferred, 18 Blocked (9 plain, 7 needing a human, 1 needing demo data, 1 needing a product decision).** Recounted 2026-08-29 after the design drop added #287–#292.

**Phase `INFRA` / Milestone `M-OPS` marks platform work, not product work.** A row
carrying them — and the **`[PLATFORM]`** title prefix — changes how the application is
built, deployed, backed up or paid for, and ships **no user-facing behaviour**. It is not
a feature, not a defect, and not a parity finding, so it is exempt from the design-parity
gate (there is no frame to compare) and from the MVP scope rule, which governs product
surface only. It still carries the full engineering bar: tests where there is logic to
test, the pre-commit gate, and a `diff-reviewer` pass. Feature and defect tickets keep
their `P0`–`P3` phases and `M0`–`M6` milestones.

### The `M-OPS` sequence is complete

Closed 2026-08-29. Nothing in #200-205 is waiting on anyone: local development
runs on Docker Postgres 18 (#200), the Neon `staging` branch and the Railway
`staging` environment are live (#203), the `production` branch is cut and
protected and Vercel deploys from it (#202), and per-PR Neon branches are proven
on a real pull request (#205). #201 closed without work once #200 removed its
cause, and #204 closed by handing migrations to Railway's `preDeployCommand`.

**#206 is launch prep, not current work.** The Neon Free plan is correct while
there is no real data. Its checklist lives in `docs/pre-launch.md` §3.2 with the
other launch-gated items.

**The API runs on Railway, not Vercel** — decision `D10`. `railway.json` builds
`apps/api/Dockerfile`, health-checks `/ready`, and **owns migrations** via
`preDeployCommand`. The release pipeline proper is **#20**.

**Do not create a GitHub environment named `production` or `staging`.** Vercel
owns `Production` and GitHub matches environment names case-insensitively, so
writing to that name silently reconfigures Vercel's deployment gate. The unused
`db-staging` / `db-production` environments are left over from #204.

**Cleared already:** the `production` branch exists and is protected against
deletion and force pushes alongside `main`; the Neon `staging` branch exists;
the migration and preview workflows are written; the `db-staging` and
`db-production` environments exist, the latter with a required reviewer.

**The API runs on Railway, not Vercel** — decision `D10`. `railway.json` builds
`apps/api/Dockerfile`, health-checks `/ready`, and **already runs migrations via
`preDeployCommand`**. Any migration work must reconcile with that rather than
assume CI is the only path. The release pipeline proper is **#20**.

**Do not create a GitHub environment named `production` or `staging`.** Vercel
owns `Production` and GitHub matches environment names case-insensitively, so
writing to that name silently reconfigures Vercel's deployment gate. The
migration environments are `db-`prefixed for exactly this reason.

Everything else — compose and `.env` changes, branch creation, workflow YAML,
protected-branch and history-window settings, backup schedules, spending
notifications — is agent-executable once the gate above it is cleared.

**#200 depends on nothing and needs no gate**, so the CU-hour burn can be stopped
today without waiting on any of this.

**Design revision — imported 2026-08-27.** `design/` now holds the final export of
the Claude Design project. **1024 is a standard design viewport** (1024 × 640), drawn
as seven frames, and it joins 1440 / 1280 / 768 / 390 in every adaptation sweep.

Five existing frames changed in that import, and **the source file numbers two
different frame sets `25`** — so a ticket must reference a frame by its full
`data-screen-label`, never by number alone.

| Frame | What changed | Shipped ticket now out of parity | Redesign |
|---|---|---|---|
| `02 Search` | vendor card cover **4:3 → 3:2** | #23, #6a | **#52** |
| `18 Search no results` | vendor card cover **4:3 → 3:2** | #29 | **#52** |
| `14 Search tablet` / `14 Landing mobile` … | vendor card cover **4:3 → 3:2** | #6c, #45 | **#52** |
| `03 Vendor profile` | banner **196px**; **82px** avatar overlaps it by **34px** | #6b | **#53** |
| `26 State library` | page loader is the mark's **two rings**, no wordmark | #28 | **#54** |

Frames `01`, `04`–`13`, `15`–`17`, `19`–`24` and `25 Upload failures` are **unchanged**
by this import — tickets already verified against them stay verified.

**The `Orla screens` note in the Notes column is scope, not a hint.** A ticket carrying a
screen is not Done until that screen matches its frame in `design/Orla - Screens.dc.html` —
see the parity gate in `design/design-plan/04-laws.md`.

**Capabilities** are declared in `packages/shared/src/env/tickets.ts` (built in #17) and
enforced by `pnpm preflight --ticket <n>`, which refuses to let a ticket start until
every variable in its capabilities is present, non-placeholder, and correctly shaped.
The `e2e` capability is implicit on every ticket — browser verification is mandatory.

This column replaces the prose `PREREQ:` notes that previously sat here. A note in a
table cell is not a gate; #3 shipped needing `storage` with no note at all.

---

## Build Order

**Critical path — shipped:** #0 → #1 → #2 → #3 → #17 → #21 → #4 → #6a → #23 → #24 →
#6c → #31 → #28 → #29 → #6b → #16 → #7 → #22b → #22a → #8 → #30 ✅

**Critical path — remaining:** **#9 ◄── NEXT, and it needs a human (Stripe dashboard)**
→ #10 → #19 → #20 → #12 → #11 → #14 → #15

```
PHASE 0-1: Foundation  ✅ complete
  #0 → #1 → #2 → #3 → #17 → #21 → #4 → #6a → #23 → #6c → #24 → #18

PHASE 2: Repair what is already serving users  ✅ complete
  #31 Shipped-Surface Defect Sweep
  #28 Application States Foundation     frames 15, 16, 26
   └► #29 States Retrofit               frames 17, 18, 24, 25

PHASE 3: Close the funnel        ◄── you are here — one ticket left, and it is gated
  #6b Public Vendor Profile     frame 03                        ✅
   ├► #7   Booking Request      frames 04 + 22                  ✅
   ├► #22b Bookings Hub         frames 07 + 19                  ✅
   ├► #22a Vendor Dash          frames 08 + 20                  ✅
   ├► #8   Messaging            frames 10 + 23                  ✅
   └► #10  Payment              frames 05, 06 + 21     needs #9 ◄── build once #9 clears
  #16 Customer Profile          (parallel-safe)                 ✅

PHASE 4: Design parity debt   #25 (deferred — needs a human) · #26 ✅

PHASE 5: Ship it
  #30 Launch Hardening ✅ ──┐
  #19 Prod Provisioning ────┴► #20 Deploy Pipeline
      #19 is deferred — needs a human; it also gates #48.

PHASE 6: Trust & operations
  #12 Reviews → #14 Demo Dataset + E2E → #15 Admin + Sentry
  #11 Email (parallel with #12) — deferred, needs a Resend API key

UNBLOCKED RIGHT NOW — no human, no open dependency:
  #61 Preflight accepts a live key against a local target   (In Progress)
  #63 The ticket capability map stops at #37
  #64 Flaky test in packages/preflight under parallel Turbo
  #65 Vendor profile — identity row overlaps the cover by 34px, not 16px

WAITING ON A HUMAN (6):
  #9  Stripe Connect onboarding      Stripe dashboard
  #11 Transactional email            Resend API key
  #19 Production provisioning        hosting + env decisions
  #25 Style tags refine chip         product decision
  #46 Clerk webhooks -> CLI relay    secret rotation (Clerk dashboard)
  #62 Stripe business name "VendYou" Stripe dashboard
```

## MVP vs Post-MVP — the line

**Every open ticket in the Status Board is MVP.** There is no "nice to have" row in
that table. If a ticket is listed, it ships before launch; if it does not ship, the
product is incomplete in a way a first customer would notice.

The **Post-MVP Backlog** at the foot of this file is the complete list of what is
deliberately *not* being built, each with the condition that unblocks it. **No MVP
ticket may implement any of it** — not behind a flag, not stubbed, not half-built.

What makes each open ticket MVP, in one line:

| # | Why it cannot be cut |
| --- | --- |
| #31 | Internal ticket IDs and a broken greeting are rendering to users **right now** |
| #28 | A stale vendor URL renders Next's stock 404; an unhandled render error has no boundary |
| #29 | Search has no loading state and uploads have no progress or failure handling |
| #6b | Every search result and featured card links here and 404s |
| #16 | Customers cannot see or edit their own details |
| #7 | The product is a booking marketplace that cannot take a booking |
| #22b / #22a | Neither side can see what they have booked or been asked for |
| #8 | Two-sided marketplaces fail on the reply path |
| #9 / #10 | Money does not move |
| #11 | A vendor who gets a request and no email never answers it |
| #12 | The landing page promises "Reviews from real bookings" and cards render ratings |
| #14 | The catalogue is 11 photographers with no photographs, and there is no E2E suite |
| #15 | `/suspended` exists, so something must be able to suspend |
| #25 / #26 | Named parity deviations from the frames, and a Clerk upgrade that will break the auth screen |
| #30 | No security headers, and a marketplace that cannot be crawled or shared |
| #19 / #20 | It is not deployed |

## What can start today

Verified against `pnpm preflight` on **2026-08-28**. **Stripe test keys are now real** —
`pnpm preflight --ticket 9` passes 35/35, including `STRIPE_SECRET_KEY`,
`NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET` and the `stripe listen`
forwarder — so the payment chain is **no longer credential-blocked**. `RESEND_API_KEY`
and `SENTRY_DSN` are still the shipped placeholders, and that is what holds #11, #15
and #19.

Ready now — nothing outside the repo is needed:

| Order | # | Priority | Why here |
| --- | --- | --- | --- |
| 1 | **#9** | P0 Critical | Newly unblocked, and back on the critical path. Connect onboarding opens #10 → #12 → #14 → #15 |
| 2 | **#61** | P1 High | Already `In Progress` — preflight accepts a live key against a local target |
| 3 | **#63** | P1 High | The capability map stops at #37, so `--ticket` under-checks every newer ticket |
| 4 | **#65** | P1 High | Vendor-profile identity row overlaps the cover by 34px where frame `03` overlaps by 16px — user-reported, one-line fix, measured |
| 5 | **#64** | P2 Medium | Flaky test in `packages/preflight` under parallel Turbo |

Everything else open is waiting on one of these:

| # | Waiting on |
| --- | --- |
| #10 | #9 |
| #12 → #14 → #15 | #10, then each other. #15 additionally needs `SENTRY_DSN` |
| #11 | `RESEND_API_KEY` — still the placeholder `re_...` |
| #19 | `RESEND_API_KEY` and `SENTRY_DSN`, plus the hosting decisions |
| #20, #48 | #19 |
| #25 | a product decision on the style taxonomy |
| #46 | a Clerk secret rotation |
| #62 | the Stripe dashboard business name |

The ordering rationale below is **historical** — it records why the shipped sequence ran
as it did, and every ticket it names is now `Done`.

**Every one of these passes the five-axis parity gate before it is `Done`,** verified in
a real browser at 1440×900 and then at 1280 / 1024 / 768 / 390. A ticket whose frame is marked
*unchanged* is still gated — unchanged means "build it as drawn", not "skip the check".

**Why #31 comes before #28.** #31 touches no new surfaces and adds no dependencies; it
deletes scaffolding that is visible to users today. Shipping it first means the product
stops embarrassing itself while the larger work proceeds.

**Why #28 comes before every remaining screen.** It owns the state vocabulary — banners,
skeleton variants, dialogs, the error boundaries, the toast contract. A screen built
before it lands invents its own empty state and its own error copy, and has to be
rebuilt rather than restyled once the shared set exists. This is the same argument that
put #21 before every frontend ticket, applied to the second half of the design system.

**Why #18–#20 land after #10.** Deploying only once everything is built concentrates
every deployment unknown into one session, at maximum surface area and minimum remaining
schedule. Deploying right after the booking loop works means the first release carries a
thin, well-understood product.

**Design note (2026-08-27, second import).** The design project added **twelve frames,
`15`–`26`**, covering error, loading and empty states, plus one new spec file,
`design/design-plan/40-states.md`. **The existing fourteen frames are unchanged** —
`03-components.md` is byte-identical to the remote, and no token, screen or component
spec moved. The states work is therefore purely additive, and it is scoped as: one
foundation ticket (#28), one retrofit ticket for shipped surfaces (#29), and a frame
folded into each screen ticket that does not exist yet (#7, #22b, #22a, #8, #10).

> **Frames `15`–`26` are local and the parity gate is live for them.** Imported
> 2026-08-27 via the design MCP, byte-exact. Every ticket carrying a new frame can run
> its gate against the markup in `design/Orla - Screens.dc.html` exactly as the shipped
> screens did — there is no remaining design prerequisite on any ticket.

**Consolidation note (2026-08-27).** The live-app audit found 21 distinct defects across
the shipped surfaces. Rather than 21 tickets, they are batched into **four**: #31 (copy,
scaffold and a11y in shipped web surfaces), #29 (search and upload states plus the two
search-API correctness bugs), #30 (platform hardening and metadata), and #28 (the state
foundation the rest compose from). Per-screen states are folded into the ticket that owns
the screen rather than tracked separately — a screen and its states ship together or the
screen ships twice. 30 → 34 rows, of which 4 are new and 6 gained a frame.

**Consolidation note (2026-08-27, second pass).** A backlog audit over the 22 open tickets
found the batching sound and merged the two remaining splits that did not earn their
separation. **#7a + #7b → #7** — a layer split whose API half shipped no screen and could
not clear the browser-verification gate alone, leaving an intermediate state nobody could
use; every other screen ticket here is already a vertical slice. **#26 + #27 → #26** — two
small P2 parity deviations in shipped chrome, where #26's mandatory re-verify sweep of all
13 screens at 768/390 already contains #27's check on frame `12`, so batching them runs
that browser pass once instead of twice. Kept separate on purpose: **#25** (carries an
unresolved product decision on the style vocabulary, and merging it would block ready work
behind an agreement), **#9 / #10** (same credential unblock, but Connect onboarding plus
PaymentIntents, refunds and three frames exceeds one execution context), **#28 / #29**
(setup-then-use, but #28 feeds six downstream tickets and the pair spans seven frames),
**#19 / #20** (#19 is a human's checklist that must start early — Stripe live activation
is a review that can take days — and merging would hide that), and **#11** (folding email
into #7 would block the booking API on a Resend key it does not need, defeating the
capability isolation #17 exists to provide). 34 → 32 rows, 22 → 20 open.

---

## Ticket Details

### #31: Shipped-Surface Defect Sweep — scaffold, copy & a11y

**Milestone:** M3 | **Priority:** P0 Critical | **Status:** Done | **Capabilities:** `core` `auth`

**Design:** `design/design-plan/03-components.md` (Toasts), `31-content-voice.md`,
`40-states.md` (Validation). **No new frame** — this ticket removes things that should
never have rendered and fixes strings that contradict the specs already written.

**User value:** the product stops showing users its own issue tracker, stops calling
every one of them "there", and stops explaining prices in cents.

**Why it is first:** zero blockers, zero new dependencies, zero new surfaces. Every item
is in code that is serving users right now. Found by driving the live app on 2026-08-27.

**Scope — eleven defects, all confirmed in a real browser.**

*1. Internal ticket IDs render on both dashboards.* `/customer/dashboard` shows
"TICKET #6", "TICKETS #7 AND #10", "TICKET #8" — on the customer's home screen.
`/vendor/dashboard` shows "Ticket #9" under "Getting paid".
- `apps/web/src/app/customer/dashboard/page.tsx:12,22`
- `apps/web/src/app/vendor/dashboard/page.tsx:36`
- rendered by `apps/web/src/components/dashboard-shell.tsx` via the `arrivesIn` prop
- **`apps/web/src/components/dashboard-shell.test.tsx:40` asserts `'Ticket #9'` renders** — the test encodes the bug and must change with it.
- Remove the `arrivesIn` prop from the component contract entirely. A card that is not
  ready either links somewhere useful or is not drawn. Do not replace it with "Coming soon".

*2. Every user is greeted "Welcome back, there".* `${user.firstName || 'there'}` at
`customer/dashboard/page.tsx:32` and `vendor/dashboard/page.tsx:55`. **The sign-up form
collects only email and password**, so Clerk never captures a name and `firstName` is
`null` for 100% of accounts — this is the default path, not an edge case. Drop the name
from the heading rather than adding a name field to the auth form (`21-sign-up.md`
forbids that explicitly: "Do not add a business-name or any other profile field").

*3. The customer dashboard's three cards are inert.* "Find vendors", "Booking requests"
and "Messages" are not links. "Find vendors" should link to `/search`, which exists.

*4. `/customer/dashboard` is titled "Your events".* The Event entity was cut on
2026-08-27 (`98-post-mvp.md`). `customer/dashboard/page.tsx:6`.

*5. Money validation errors leak cents.* A vendor entering $24 sees
**"Price must be at least 2500 cents"** while the field's own helper line reads
"Between $25 and $100,000."
- `packages/shared/src/schemas/index.ts:74-75` — both messages interpolate raw cents.
- Surfaced verbatim by `toast.error(parsed.error.issues[0]?.message)` in
  `apps/web/src/components/packages/package-form.tsx:155` and
  `apps/web/src/components/vendor-profile-form.tsx:293`.
- Violates the repo convention "Convert at the display boundary with `formatPrice`".

*6. The price field has no client-side bounds.* `min`/`max` are absent, so an
out-of-range value passes native validation and fails only at the server, as a toast.
Per `40-states.md`, the error belongs **on the field after a submit attempt**, not in a
toast.

*7. Toasts are in the wrong place.* `apps/web/src/app/layout.tsx:96` renders
`position="top-center"`; `03-components.md` specifies **bottom-right, `shadow-xl`,
`rounded-xl`, a 4px left accent by type (sage success, steel info, error), 5s
auto-dismiss**.

*8. The sign-up hint is orphaned.* "Pick one above to continue" renders **below** the
"Already with us? Sign in" link, the "Secured by Clerk" footer and a divider — roughly
150px beneath the disabled **Continue** button it explains. `21-sign-up.md` places it
directly under that button.

*9. City and Event date inputs have no accessible name.* On the landing hero and the
search header bar, the visible `CITY` / `EVENT DATE` micro-labels are presentational
text with no `<label for>`, `aria-label` or `aria-labelledby`. These are the primary
conversion controls on the site. WCAG 1.3.1 / 4.1.2.

*10. The search `Sort` select has no accessible name.* Same failure, same fix.

*11. No skip-to-content link.* Keyboard users tab the full header on every page.

**Non-goals:**
- **Do not rebuild either dashboard.** #22a and #22b replace both wholesale; this ticket
  only strips what must not ship in the meantime.
- No new components, no new routes, no dependency changes.
- Do not add a name field to sign-up.

**Behavioral requirements:**
- A vendor entering `24` in Price sees "$25" in the message, on the field, after submitting.
- A screen reader announces "City" and "Event date" on both the landing and search bars.
- Tab from page load reaches a visible "Skip to content" control before the nav.
- Toasts appear bottom-right and auto-dismiss in 5s.
- **Design parity gate** on frames `01`, `02`, `12` at 1440×900, then 1280 / 1024 / 768 / 390 —
  this ticket touches the **text** and **colour** axes on those three frames.

**Acceptance:**
- [ ] `grep -rniE "ticket #[0-9]+|tickets #" apps/web/src --include='*.tsx' | grep -v '\.test\.'` returns nothing
- [ ] `grep -rn "arrivesIn" apps/web/src` returns nothing
- [ ] `grep -rn "|| 'there'" apps/web/src` returns nothing
- [ ] `grep -rn "cents" packages/shared/src/schemas/index.ts | grep -i "must be"` returns nothing
- [ ] `grep -n "Your events" apps/web/src/app/customer/dashboard/page.tsx` returns nothing
- [ ] `grep -n 'position="bottom-right"' apps/web/src/app/layout.tsx` matches
- [ ] Every `input`/`select` on `/` and `/search` resolves a non-empty accessible name — assert it in a test, not by eye
- [ ] `pnpm test` green, including the rewritten `dashboard-shell.test.tsx`

**Blocked by:** none

---

### #32: Imagery — landing category cards, and the covers the seed points at

**Milestone:** M3 | **Priority:** P0 Critical | **Status:** Done | **Capabilities:** `core`

**Frame `01`** (revised again in `639ea2e`). Two halves of one question — where the
product's imagery lives, and which of it is the platform's to own.

**User value:** the landing matches its frame, and the vendor grid stops rendering
sixteen broken images on every machine except the one the files were downloaded on.

---

**Updated 2026-08-27, after `639ea2e`.** The design project adopted the six category
images into the contract: frame `01` now renders them from `design/uploads/`, and those
files are tracked. That settles where the *category* imagery lives and adds a second,
larger half to this ticket — the shipped landing no longer matches its frame.

It also states the ownership rule this ticket must respect:

> *the six category images are the only imagery the platform owns; every vendor-side
> cover stays a labelled placeholder, because that photography comes from the vendor at
> publish time.*

The markup backs it: the only `<img>` tags in the file are the **six landing category photographs**, and
the same six again in the `25 Landing — 1024` frame — twelve in total, one set of six
photographs. Everything else is a placeholder: **23** `cover 3:2`, two `cover 21:9`
and one `cover · full-bleed banner`. **This does not invalidate the
seeded vendor covers.** The parity gate in `04-laws.md` explicitly permits *"real
photography in place of the labelled placeholders"* as one of its three allowed
differences — a placeholder stands for photography a vendor would supply, and demo stock
standing in for it is exactly that. The rule constrains what the **platform ships as its
own**, not what seeded demo vendors display. Keep the distinction visible in whatever
copy this ticket writes; it is the difference between a fixture and a claim.

---

**Half (a) — the landing is out of parity.**

Frame `01` draws each category card as a photograph with a 94px cover, `overflow:hidden`
on a 14px radius, and the label block beneath it. `apps/web/src/app/page.tsx` renders
`CategoryIconBadge` — a 36px clay glyph on a cream disc. That is a Layout and Style
failure on two of the five axes, on a screen already marked Done.

- The six files are already tracked at `design/uploads/`. Copy them into the app rather
  than re-sourcing; they are byte-identical to `public/marketing/categories/` today, and
  sha256 is the check.
- They are platform-owned imagery in the same sense as `public/stock`, so `public/stock`
  is where they belong — **not** `public/marketing/`, which is the untracked staging area
  half (b) is about. `StockPhoto` already exists for exactly this and is the component to
  use; it takes `sizes` and crops to fill.
- `CATEGORY_SEEDS` carries no image field. Six files keyed by slug need no column — the
  landing maps slug → `/stock/categories/<slug>.jpg`. Do not add a database column for
  imagery the platform owns and ships in its own bundle.
- Only six of the eleven categories have art. The landing features exactly
  `LANDING_CATEGORY_COUNT` cards, so decide what `/search`'s category control does with
  the other five before assuming the six are enough.

---

**Half (b) — the seeded covers are untracked.**

**What happened, in order.**

1. `e9d8a56` added `public/marketing/` to `apps/web/.gitignore`. The reasoning is in the
   commit message and was correct when written: *"Nothing imports any of it — the app
   reads `public/stock` — and everything under `public/` is served publicly, so
   committing it would publish 3MB of unused assets and a browsable index."*
2. `ef8b341` added `pnpm db:seed:marketing`, which writes
   `vendor_profiles.cover_image_url = '/marketing/vendors/<slug>.jpg'` for all sixteen
   demo vendors (`packages/db/src/marketing-seed-data.ts`, `MARKETING_COVER_BASE`).

The first commit's premise — *nothing imports any of it* — is no longer true. The files
are now referenced data, and they are untracked.

**The consequence is not cosmetic.** The seed is deterministic and idempotent, so anyone
can run it; the covers it points at exist only in one working tree. A fresh clone, CI, a
preview deploy or a second machine gets sixteen `404`s in the search grid, and
`VendorCard` deliberately skips `next/image`, so there is no loader to fall back to — the
browser renders a broken image, not a placeholder.

**Verify the problem before fixing it:**

```
git stash list                      # nothing to preserve
git ls-files apps/web/public/marketing | wc -l    # → 0, the files are untracked
grep -rn "MARKETING_COVER_BASE" packages/db/src   # → the seed depends on them
```

---

**Decide first — two defensible answers, and they are not equal.**

***Option A — track the covers in the repo (recommended).***
The sixteen files are 1.9MB. They are demo fixtures, they never change, and a
repo-relative path works in every environment with no host to configure.

- Narrow the ignore rule so only what is genuinely unreferenced stays ignored.
  `public/marketing/vendors/` becomes tracked; the category cards stay ignored until a
  surface actually reads them (the landing still renders `CategoryIconBadge`, not
  photographs — see `apps/web/src/app/page.tsx`).
- **Do not commit `public/marketing/index.html`.** The second half of `e9d8a56`'s
  reasoning still stands: it is a browsable contact sheet, and everything under
  `public/` is served. Move it to `design/marketing-contact-sheet.html`, or delete it —
  it is a review aid, not a product surface.

***Option B — push the covers to the bucket.***
Architecturally the more consistent answer, and worth reading before choosing A.
`apps/web/src/components/ui/stock-photo.tsx` documents the rule the repo already holds:
stock imagery in `public/stock` is *"not for vendor content: a vendor's own cover,
portfolio and avatar come out of the bucket"*. A demo vendor's cover is vendor content.

The cost is that the bucket host differs per environment, so a seeded absolute URL is
wrong the moment it is used anywhere but where it was seeded — which is the same class
of bug as the one being fixed, relocated. It also makes the seed depend on `storage`
credentials, so `pnpm db:seed:marketing` stops working offline.

**Recommendation: A now, B when #14 needs portfolio images too.** #14 already owns the
wider demo-asset problem and will have to upload portfolios to the bucket regardless;
that is the moment to move covers with them, as one decision rather than two.

---

**Scope, if Option A is taken:**

- `apps/web/.gitignore` — replace the blanket `public/marketing/` rule with one that
  ignores only what nothing reads. Keep a comment saying *why* the vendors directory is
  the exception, or the next person will re-broaden it.
- Relocate or delete `apps/web/public/marketing/index.html` so no browsable index ships.
- `git add` the sixteen covers under `public/marketing/vendors/`.
- Confirm the tracked filenames are exactly the sixteen slugs the seed derives.
  `ef8b341` already fixed a mismatch here — the seed's slugs come from `generateSlug`,
  so `Atlas & Thorn` is `atlas-thorn`, **not** `atlas-and-thorn`.

**Behavioral requirements:**

- `git ls-files apps/web/public/marketing/vendors | wc -l` → **16**.
- A test asserts every `MARKETING_VENDORS` slug has a cover file on disk, so a vendor
  added to the seed without art fails the suite instead of shipping a broken card. This
  is the guard that stops the whole class of defect recurring, and it is the part of this
  ticket most worth keeping.
- `git ls-files apps/web/public/marketing | grep index.html` → empty.
- Search at 1440×900 renders sixteen covers with no broken images, verified in a real
  browser per the parity gate.

**Out of scope:** category-card photography (nothing reads it yet), portfolio images,
and the other ten categories' vendors — all #14.

**Blocked by:** None. No new dependencies, no new surfaces, no external credentials.

---

### #28: Application States Foundation — 404, 500, boundaries & state library

**Milestone:** M3 | **Priority:** P0 Critical | **Status:** Done | **Capabilities:** `core`

**Status: Done** (a97001a). **Design:** `design/design-plan/40-states.md` (**new**), `03-components.md`.
**Frames: `15` 404, `16` 500, `26` State library — all new.**

**User value:** every failure the product can have is a designed screen that says what
happened, whether money moved, whether the date survived, and what to do next — instead
of Next.js's stock black-on-white error page.

**Current state, confirmed 2026-08-27:** `apps/web/src/app` contains **no `not-found.tsx`,
no `error.tsx`, no `global-error.tsx`, and no `loading.tsx`**. Navigating to
`/vendors/june-harlow` — which every search result links to — renders
"404 / This page could not be found." in the browser default font, with no Orla chrome
and no route back. Any unhandled render error in production shows Next's default page.

**Scope.**

*Error routes:*
- `app/not-found.tsx` — frame `15`. **Marketing shell retained.** Recovery is category
  links, because most 404s are stale vendor URLs. Not a bare "go home". Copy as drawn:
  "This page isn't here" / "The link may be old, or a vendor may have taken their listing
  down. Nothing is wrong with your account." / **Browse vendors** + **Back to home** /
  "OR START WITH A CATEGORY" chips.
  **⚠ One frame-set inconsistency to resolve here:** frame `15` draws the header link as
  **"Log in"**; every other frame and the shipped header say **"Sign in"**. Build
  **"Sign in"** — one deviant instance of a string used everywhere else is a slip in the
  frame, not a redesign — and record the deviation in the Notes column.
- `app/error.tsx` and `app/global-error.tsx` — frame `16`. Sage money-position banner
  ("No payment was taken") plus a **selectable monospace incident id**. The incident id
  must be real — generate and log it; a decorative one is worse than none.
- `app/loading.tsx` — page-scope loader: wordmark in Instrument Serif `clay-500`, opacity
  pulse 0.4 → 1 → 0.4 over 2s. **First paint and auth redirects only.**

*State library (frame `26`) — the shared vocabulary every later ticket composes from:*
- **Banner** — one component, four tones keyed to the colour semantics table in
  `40-states.md`: steel = neutral/self-resolving, gold = waiting on someone, red = it
  failed, sage = settled. **Red is never used for `pending`; gold is never used for a
  failure.** Enforce with a type, not a convention.
- **Skeletons** — variants for vendor card, list row, table row and message bubble,
  each mirroring its real geometry. `stone-200` shimmer over 1.5s, **minimum 200ms
  display** so fast loads do not flash. Extends the existing `ui/skeleton.tsx`.
  **A generic grey box is a bug.**
- **Element loader** — 16px spinner, 2px `clay-400` ring with a transparent quarter,
  label dims to 60%. **Buttons and single controls only.**
- **One idiom per screen.** Never a spinner and a skeleton on the same screen — assert it.
- **Empty state** — extends the existing `ui/empty-state.tsx` to the `40-states.md`
  contract: two-circle `stone-400` glyph (one dashed), Instrument Serif headline at 26px
  in-app / 30px marketing, one `stone-700` sentence, **one** CTA. Surrounding chrome
  (grouping, filters, rail) stays drawn. **Rails are never blanked** — they carry
  mechanism copy or a setup checklist.
- **Four dialogs**, each interrupting only when the user cannot continue without
  deciding: availability conflict (gold pill, money position, two alternate dates);
  session expired (states the draft is saved, re-auth in place); listing removed
  (**410, not 404** — existing bookings explicitly unaffected); destructive confirm
  (exact refund split in dollars, what is released, irreversibility, `error-500` fill on
  the destructive button only, always an escape hatch).
- **403 and rate-limit surfaces** — the API already returns both
  (`@fastify/rate-limit` is registered; a customer token gets 403 on every vendor route).
  Neither has a designed surface today.
- **Validation model** — the three tiers from `40-states.md` as a reusable hook:
  red on the wrong field, gold on a valid-but-costly field, and a **counted summary at
  the submit bar linking to each field**. Errors appear **after a submit attempt, never
  while typing**, and clear per-field on correction. Primary button goes `clay-300`
  while blockers exist and **stays visible**, with its helper line explaining the block.

**Non-goals:**
- Do not retrofit these onto search or the uploaders — that is #29.
- Do not build the per-screen empty states for bookings, dashboard, messaging or
  checkout — those ship inside #22b, #22a, #8 and #10.
- No Sentry wiring; #15 owns it. The incident id here is local and logged.

**Behavioral requirements:**
- Every error copy block answers the four questions in `40-states.md` §1. Copy is **one
  sentence per job** — no apology paragraphs, no "Oops", no exclamation marks.
- A thrown error in a nested route segment is caught by `error.tsx` without taking down
  the shell; a thrown error in the root layout is caught by `global-error.tsx`.
- **Design parity gate** on frames `15`, `16`, `26` at 1440×900, then 1280 / 1024 / 768 / 390.
  Frames `15`, `16` and `26` are in `design/Orla - Screens.dc.html` — gate against the markup, not `40-states.md`, wherever the two could disagree.

**Acceptance:**
- [ ] `ls apps/web/src/app/{not-found,error,global-error,loading}.tsx` — all four exist
- [ ] `/vendors/does-not-exist` renders the Orla marketing shell with category recovery links, not Next's stock page
- [ ] A deliberately thrown error renders frame `16` with a copyable incident id that also appears in the server log
- [ ] The banner component rejects `tone="error"` on a pending status at the type level
- [ ] A test asserts no screen renders both a spinner and a skeleton
- [ ] `pnpm build` succeeds and `/_not-found` is no longer Next's default

**Blocked by:** #21

---

### #29: States Retrofit — search, uploads & search-API correctness

**Milestone:** M3 | **Priority:** P0 Critical | **Status:** Done | **Capabilities:** `core` `auth` `storage`

**Design:** `design/design-plan/40-states.md` (**new**), `11-search.md`, `17-vendor-profile-editor.md`.
**Frames: `17` search loading, `18` search no-results, `24 Image upload` upload in progress, `25 Upload failures` upload failures — all new.**

**User value:** search says "Searching…" instead of a fake count, a no-result page names
the filter that is probably at fault and offers a one-tap fix, and a vendor uploading
twenty photographs can watch them arrive, keep working, and lose none of them when one
fails.

**Scope.**

*Search states (frames `17`, `18`) — retrofit onto the shipped `/search`:*
- Loading: **chrome stays real** — the query bar and Refine bar the user already filled
  in are **never** skeletons. Six card skeletons in the results pane. The count line
  reads **"Searching…"**, not a stale or invented number.
- No results (frame `18`): name the **likely-at-fault filter**, offer one-tap
  relaxations, and offer nearby-date alternatives. Today the empty state is generic
  ("Nothing here yet — try a different vendor type or city"), which is correct but does
  not diagnose. This replaces it.

*Image upload states (frames `24 Image upload`, `25 Upload failures`) — the only uploads in the product:*
- Current implementation is a boolean. `apps/web/src/components/image-upload.tsx:48`
  holds `isUploading` and nothing else — **no per-file progress, no queue, no partial
  success, no per-file failure reason**. Same for
  `apps/web/src/components/portfolio/portfolio-manager.tsx`.
- **Never modal, never blocking.** Tiles appear the moment files are picked; the vendor
  keeps editing other sections and may leave the page — images save as they finish.
- **Determinate progress only.** Per-tile percentage ring plus a 3px bottom bar; queued
  tiles get a **skeleton, not a spinner**. One aggregate line in steel
  (`Uploading 4 of 8 — 18.2 MB of 29.4 MB`) and a compact count in the header.
- **Partial success is the normal case.** Successful files stay and are already saved;
  a failure never rolls back a sibling.
- **Cover is a designation on an existing tile** (drag to first slot), never a second
  uploader. This replaces the separate "Cover image" drop zone in the storefront editor.
- Four failure modes, **each with its own sentence and matching fix**: unsupported
  format / over size (red → **Replace file** plus exact export advice, "JPG at 2400px
  wide"); connection dropped (red → **Retry**, resumes, says the file is fine); below
  minimum dimensions (gold → **Replace file**, explains it would look soft, not that it
  is "invalid"); too many files in one batch (gold → trims and says which were held back).
- **A failed file keeps its tile/row** so the vendor can tell which shot it was. The
  banner counts failures and offers one *Retry all that can*; the header aggregate turns
  red rather than adding a second alert. **Never a bare "Upload failed" toast** — which
  is exactly what `image-upload.tsx:57` and `portfolio-manager.tsx:57` do today.

*Upload constraints changed — the app is stale:*
- Spec is now **JPG or PNG · 12 MB each · min 1200px wide · 20 files per upload**.
- App says "JPEG, PNG, or WebP, up to 10MB" in three places
  (`image-upload.tsx:150`, `vendor-profile-form.tsx:421`, `portfolio-manager.tsx:190`)
  and enforces **no minimum dimension and no batch limit** at all.
- The same constraint line must appear in **both** the drop zone and the requirements rail.
- WebP is being dropped from the accepted set — confirm against the API's own allowlist
  (`apps/api/src/lib/images.ts`) and change both ends together, or the client will offer
  what the server refuses.

*Search-API correctness — two defects the audit found:*
- **LIKE wildcards are not escaped.** `apps/api/src/modules/vendors/vendor-search.dao.ts:67`
  interpolates user input straight into a LIKE pattern:
  `` sql`lower(${vendorProfiles.businessName}) LIKE ${`%${query.name.toLowerCase()}%`}` ``.
  Verified: `?name=%` and `?name=_` each return **all 11 vendors**; `?name=zzz` returns 0.
  Parameterised, so **not** injection — but a business whose name contains `%` or `_`
  cannot be found literally, and a bare `%` dumps the directory. Escape `%`, `_` and `\`
  and add `ESCAPE '\'`.
- **A past `date` is accepted.** `GET /vendors?date=2020-01-01` returns 200 with results.
  The web layer already strips it (verified — `/search?date=2020-01-01` rewrites the URL
  and explains it in copy), so this is API-only, but #7 will book against this field.

**Non-goals:**
- Do not build the state library — #28 owns it and this ticket consumes it.
- Do not touch the search query, filters, facets or card component — #23 shipped those
  and they are correct.
- No new upload backend; the presigned-URL flow in `apps/api/src/modules/uploads` stands.

**Behavioral requirements:**
- Uploading 8 files where 2 fail leaves 6 saved, 2 tiles visible with their own reasons,
  and one banner offering "Retry all that can".
- Navigating away mid-upload does not lose completed files.
- `?name=%` returns only vendors whose name literally contains `%`.
- **Design parity gate** on frames `17`, `18`, `24 Image upload`, `25 Upload failures` at 1440×900, then 1280 / 1024 / 768 / 390.
  Frames `17`, `18`, `24 Image upload` and `25 Upload failures` are in `design/Orla - Screens.dc.html`.

**Acceptance:**
- [ ] `grep -rn "Upload failed" apps/web/src` returns nothing
- [ ] `grep -rn "WebP" apps/web/src` agrees with the API allowlist, or both are updated together
- [ ] A route test asserts `?name=%25` returns 0 when no business name contains `%`
- [ ] A route test asserts a past `date` is rejected with 400
- [ ] Search renders 6 card skeletons and the literal string "Searching…" while in flight, with the query bar never skeletonised
- [ ] A test drives an 8-file upload with 2 induced failures and asserts 6 rows persist

**Blocked by:** #28

---

### #30: Launch Hardening — headers, SEO & share metadata

**Milestone:** M4.5 | **Priority:** P0 Critical | **Status:** Done | **Capabilities:** `core`

**Design:** none — this is platform work. `02-brand-and-logo.md` supplies the mark for
the OG image and icons.

**User value:** the site can be found, shared and trusted. A marketplace whose growth
model is vendor profiles ranking in search cannot ship uncrawlable.

**Current state, confirmed 2026-08-27:**
- `apps/web/next.config.ts` is `const nextConfig: NextConfig = {}` — **no `headers()`,
  so the web tier serves zero security headers**: no CSP, HSTS, X-Frame-Options,
  X-Content-Type-Options, Referrer-Policy or Permissions-Policy. `curl -I localhost:3000`
  returns none of them. The **API is properly hardened** — `@fastify/helmet`,
  `@fastify/cors` and `@fastify/rate-limit` are all registered in
  `apps/api/src/server.ts:68-74` — so this is a web-tier-only gap.
- **No `robots.ts`, `sitemap.ts`, `opengraph-image.tsx`, `icon.tsx`, `apple-icon.tsx` or
  `manifest.ts`** anywhere in `apps/web/src/app`. Only `favicon.ico`.
- Root `metadata` (`layout.tsx:38`) carries **only `title` and `description`** — no
  `metadataBase`, `openGraph`, `twitter`, or canonical. Every page has a title
  (`pageTitle()` is used consistently, which is good) and none has a description or OG.

**Scope.**
- **Security headers** via `headers()` in `next.config.ts`: CSP (start report-only —
  Clerk and the object-store origin both need allowing, and a CSP that breaks auth is
  worse than none), HSTS, `X-Content-Type-Options: nosniff`, `Referrer-Policy:
  strict-origin-when-cross-origin`, `X-Frame-Options: DENY`, a minimal
  `Permissions-Policy`. Note the API sets `contentSecurityPolicy: false` under helmet —
  decide deliberately whether the API needs one and record the answer.
- **`robots.ts`** — allow the public surfaces, **disallow `/vendor/*`, `/customer/*`,
  `/dashboard`, `/after-sign-in`, `/suspended`**, and point at the sitemap.
- **`sitemap.ts`** — generated from the database at request time: the landing page, the
  eleven category searches, and **every published vendor profile**. This is the growth
  surface; it must be dynamic, not a static list.
- **`opengraph-image.tsx`** at the root and a `generateMetadata` OG per vendor profile
  once #6b exists — a shared vendor link is the primary referral path and currently
  renders a blank card.
- **`icon.tsx` / `apple-icon.tsx` / `manifest.ts`** from the brand mark.
- **`metadataBase`** plus per-page `description` and canonical.
- **`outputFileTracingRoot`** — Next currently infers the workspace root as
  `/Users/humza` because of a stray `package-lock.json` there, and warns on every build.
  This affects standalone output tracing in deployment, so pin it to the repo root.

**Also fix, same area:** `pnpm dev` and `pnpm build` share `apps/web/.next` and corrupt
each other — running `pnpm build` against a live dev server fails with
`Cannot find module for page: /_document`, while a clean build succeeds. Give dev its
own `distDir` or document it in `CLAUDE.md`. **This is not a code defect** and CI is
unaffected, but it cost this audit a false alarm and will cost the next one too.

**Non-goals:**
- No analytics, no consent banner, no Sentry — #15 owns error reporting.
- Do not add structured data / JSON-LD for vendors until #6b exists to attach it to.

**Behavioral requirements:**
- `curl -I` against the deployed web origin returns every header above.
- `/robots.txt` and `/sitemap.xml` resolve, and the sitemap lists every published vendor.
- Sharing `/` and a vendor profile into Slack renders a real card.
- The CSP does not break Clerk, the object store, or the auth screens — verify each in a
  real browser before promoting it out of report-only.

**Acceptance:**
- [ ] `curl -sI $URL | grep -ciE "strict-transport|x-content-type|referrer-policy|x-frame"` returns 4
- [ ] `/robots.txt` disallows `/vendor/`, `/customer/`, `/dashboard`
- [ ] `/sitemap.xml` contains one entry per published vendor, generated from the DB
- [ ] `pnpm build` emits no workspace-root warning
- [ ] Auth, upload and search all work in a real browser with the CSP enforced

**Blocked by:** none. Parallel-safe with every other ticket.

---

### #0: Repo Init + GitHub Link ✅

**Milestone:** M0 | **Priority:** P0 Critical | **Status:** Done

**User value:** Project exists on disk and on GitHub, ready for ticket #1 to scaffold the monorepo.

**Scope:**
- Create directory at `~/Documents/vendor-marketplace`
- `git init`, `.gitignore`, `README.md`
- Initial commit + push to GitHub

**Behavioral requirements:**
- `git remote -v` shows the GitHub remote
- `git log` shows one commit
- GitHub repo has the initial commit

**Blocked by:** None

---

### #1: Monorepo Foundation + Database Schema ✅

**Milestone:** M1 | **Priority:** P0 Critical | **Status:** Done | **Capabilities:** `core`

**User value:** Infrastructure that enables all subsequent features. Not user-visible but produces a buildable, testable, deployable skeleton.

**Scope:**
- Turborepo + pnpm workspace scaffold with all 5 packages
- Shared TypeScript, ESLint (flat config), and Tailwind configs in `packages/config`
- `packages/db`: Full Drizzle schema for all 16 tables (users through notifications + tags, vendor_tags, tag_suggestions), indexes, enums — users table includes customer profile fields (`bio`, `city`, `state`, `budget_tier` enum, `typical_guest_count_min/max`, derived stats: `avg_customer_rating`, `customer_review_count`, `total_bookings_count`, `completed_bookings_count`, `cancelled_bookings_count`); reviews table includes `is_public` boolean
- `packages/db`: Drizzle Kit migration config, initial migration generation
- `packages/db`: Seed script — categories (Photography, DJ/Music, Makeup/Beauty, Decoration, Catering, Floristry, Videography, Event Planning, Lighting, Rentals/Equipment) and tags:
  - Languages: English, Spanish, French, Portuguese, Mandarin, Cantonese, Hindi, Urdu, Punjabi, Arabic, Korean, Japanese, Tagalog, Vietnamese, Italian, German, Russian, Polish, Turkish, Swahili, Yoruba, Haitian Creole, ASL/Sign Language
  - Cultural: South Asian, East Asian, Southeast Asian, Middle Eastern, West African, East African, Caribbean, Latin American, Mediterranean, Eastern European, Jewish, Filipino, Korean, Japanese, Chinese, Polynesian
  - Dietary: Halal, Kosher, Vegan, Vegetarian
- `packages/shared`: Zod schemas for all domain entities, inferred TypeScript types, constants (booking statuses, category slugs, error codes), utility functions (slug generation, price formatting, date helpers)
- `docker-compose.yml` for local Postgres
- `.env.example` with all variables documented
- Root `package.json` with workspace scripts (`dev`, `build`, `test`, `lint`, `typecheck`)
- `turbo.json` pipeline config
- Project-level `CLAUDE.md` with build/test/lint commands and architecture overview

**Non-goals:**
- No application code (API routes, frontend pages)
- No Clerk, Stripe, or R2 integration
- No CI/CD pipeline (added with #2)

**Behavioral requirements:**
- `pnpm install` succeeds
- `pnpm build` compiles all packages without errors
- `pnpm typecheck` passes
- `pnpm lint` passes
- `docker compose up -d` starts Postgres
- `pnpm --filter db migrate` applies all migrations
- `pnpm --filter db seed` populates categories
- Zod schemas in `packages/shared` correctly validate sample data and reject invalid data
- Types inferred from Zod schemas match the Drizzle schema column types

**Edge cases:**
- Seed script is idempotent (running twice doesn't duplicate categories)
- Migration handles existing database (doesn't fail if tables exist)
- All enum values in Drizzle match enum values in Zod schemas and constants

**Affected packages:** `packages/db`, `packages/shared`, `packages/config`, root config files

**Blocked by:** #0

---

### #2: Authentication + App Shell ✅

**Milestone:** M1 | **Priority:** P0 Critical | **Status:** Done | **Capabilities:** `core` `auth`

**User value:** Users can sign up as customer or vendor, sign in, and see a role-appropriate dashboard shell. The foundation for all protected features.

**Scope:**
- `apps/web`: Next.js 15 scaffold with App Router, Tailwind CSS 4, shadcn/ui setup
- `apps/web`: Clerk integration — `<ClerkProvider>`, sign-in page, sign-up page (with role selection)
- `apps/web`: Root layout with responsive header (logo, nav, auth state), footer
- `apps/web`: Middleware for route protection
- `apps/web`: Customer dashboard shell + Vendor dashboard shell
- `apps/web`: API client wrapper (`lib/api-client.ts`) with Clerk token injection
- `apps/api`: Fastify 5 setup with Pino logger, CORS, helmet, rate limiting
- `apps/api`: Clerk auth plugin (verify session token, resolve local user, lazy-create)
- `apps/api`: Role guard middleware + structured error handler plugin
- `apps/api`: Health check (`GET /health`), user routes (`GET/PUT /users/me`)
- `apps/api`: Clerk webhook handler (`POST /webhooks/clerk`)
- `.github/workflows/ci.yml` — GitHub Actions CI pipeline

**Non-goals:**
- No vendor profile creation (#3)
- No Stripe integration
- No Sentry (deferred to #15)

**Behavioral requirements:**
- Sign up → role selection → Clerk webhook creates local user record
- Lazy sync if webhook delayed
- Sign-in redirects to role-appropriate dashboard
- Unauthenticated `/dashboard` → redirect to sign-in
- Customer cannot access `/vendor/*`, vendor cannot access `/customer/*`
- `GET /users/me` returns profile with role; `PUT /users/me` updates name/phone/avatar
- Invalid/expired/missing Clerk token → 401; wrong role → 403
- Health check returns 200 with DB connectivity status

**Implementation details:**

Clerk integration (frontend):
- `apps/web/app/layout.tsx`: Wrap in `<ClerkProvider>`. Load Instrument Serif / Instrument Sans / JetBrains Mono per `design/design-plan/01-foundations.md`.
- Sign-up page (`/sign-up`): Clerk `<SignUp>` component with `unsafeMetadata: { role }` for role selection (customer/vendor). After sign-up, Clerk fires webhook.
- Sign-in page (`/sign-in`): Clerk `<SignIn>` component, redirect to role-based dashboard.
- Middleware (`apps/web/middleware.ts`): Use `clerkMiddleware()` + `auth()` to protect `/dashboard/*`, `/vendor/*`, `/customer/*`. Public routes: `/`, `/sign-in`, `/sign-up`, `/vendors/*`, `/categories/*`.
- Role-based routing: after auth, check user's role from local DB (not Clerk metadata alone). Customer → `/customer/dashboard`, vendor → `/vendor/dashboard`.

Clerk integration (backend):
- Fastify plugin (`apps/api/src/plugins/clerk-auth.ts`): `onRequest` hook that verifies Clerk session token via `@clerk/fastify` or manual JWKS verification. Attaches `request.userId` (local UUID) and `request.userRole`.
- Lazy user sync: if Clerk user ID not found in local `users` table, create user row (webhook may be delayed). Use `ON CONFLICT (clerk_user_id) DO NOTHING`.
- Clerk webhook handler (`POST /webhooks/clerk`): handle `user.created` event — extract `clerk_user_id`, `email`, `first_name`, `last_name`, role from `unsafe_metadata` → insert into `users` table.
- Role guard: `preHandler` hook factory — `requireRole('vendor')` returns a hook that checks `request.userRole` and returns 403 if mismatch.

API client (frontend → backend):
- `apps/web/lib/api-client.ts`: thin wrapper around `fetch` that injects Clerk token via `await auth().getToken()` in server components or `useAuth().getToken()` in client components. Base URL from `NEXT_PUBLIC_API_URL` env var.
- Typed response handling: parse JSON, check for error shape, throw typed errors.

Structured error handler:
- Fastify `setErrorHandler`: catch Zod validation errors → 400 `VALIDATION_ERROR`, auth errors → 401/403, `NotFoundError` → 404, unhandled → 500 `INTERNAL_ERROR` (no stack in response).
- All errors follow `{ statusCode, error: ErrorCode, message, details? }` shape from `apiErrorSchema`.

CI pipeline (`.github/workflows/ci.yml`):
- Trigger: push to main, PR to main
- Steps: checkout, setup Node 20, pnpm install, typecheck, lint, build, test (all packages)
- Cache: pnpm store, turbo cache

**Edge cases:**
- Race condition: webhook vs first API call → lazy sync with `ON CONFLICT (clerk_user_id) DO NOTHING`
- Clerk outage → SDK caches last-known JWKS keys automatically
- User deletes Clerk account → handle `user.deleted` webhook, soft-delete local user
- Multiple roles → not supported in MVP; role is immutable after sign-up

**Blocked by:** #1

---

### #3: Vendor Registration + Profile Management ✅

**Milestone:** M2 | **Priority:** P1 High | **Status:** Done | **Capabilities:** `core` `auth` `storage`

**User value:** A vendor can create and edit their business profile including business name, bio, location, photos, tags, and control public visibility.

**Scope:**
- `apps/api`: Vendor profile routes — `POST/PUT /vendor/profile`
- `apps/api`: Image upload route — `POST /upload/image` (R2 + Sharp processing)
- `apps/api`: R2 storage client, image processing (resize, thumbnail, WebP, strip EXIF)
- `apps/api`: Tag routes — `GET /tags` (list active tags grouped by category), `PUT /vendor/tags` (replace vendor's tag selection), `POST /tags/suggest` (submit tag suggestion with dedup)
- `apps/web`: Vendor onboarding page, profile edit page, image upload component
- `apps/web`: `TagPicker` component — three-section grouped multi-select (Languages, Cultural Specialties, Dietary), searchable dropdowns with checkboxes, removable pills, per-category max 5. Inline tag suggestion form per section.
- `apps/web`: Vendor dashboard — profile completeness, publish/unpublish toggle
- `packages/shared`: Vendor profile Zod schemas, tag suggestion schema, `tagSuggestionResponseSchema` (discriminated union for dedup outcomes)

**Non-goals:**
- No service packages (#4), no portfolio gallery (#4), no availability (#4), no public vendor page (#6)
- No tag moderation UI (handled by #15 Admin Portal)
- No tag-based search filtering (#6a / #23)

**Behavioral requirements:**
- Vendor signs up → redirected to profile creation
- Required: business name, at least one category, city, state
- Slug auto-generated from business name, editable, uniqueness validated
- Image upload: drag-and-drop, processed server-side before R2 upload
- Publish toggle with extensible validation (needs package from #4)
- Tags: vendor selects from preset active tags, max 5 per category (15 total max)
- Tags displayed as pills on profile (grouped by category label)
- **Design parity gate** — the built screen matches its frame in `design/Orla - Screens.dc.html` at 1440×900, verified in a real browser with Playwright per the parity procedure in `design/design-plan/04-laws.md`. Then the desktop review checklist in the same file, then the adaptation checklist at 1280px / 768px / 390px in `design/design-plan/30-responsive.md`
- Tag suggestion: two-layer dedup to protect data integrity for filtering:
  1. **Client-side (optimistic):** Check the already-loaded tag list for a case-insensitive name match in the same category. If found, auto-select it and toast "Already available — we've selected it for you."
  2. **Server-side (authoritative):** `POST /tags/suggest` normalizes input (trim, collapse whitespace, lowercase compare), checks `tags` table for active match on `(category, lower(name))`, then checks `tag_suggestions` for pending dupe on `(category, lower(suggested_name))`. Three outcomes:
     - `exists` → return matching tag, frontend auto-selects + toast
     - `already_suggested` → toast "Already submitted for review"
     - `submitted` → insert into `tag_suggestions` with `status = 'pending'`, toast "Submitted for review — we'll notify you when it's approved"
- Tag suggestions are not visible to anyone until admin approves (status = approved → creates tag in `tags` table)

**Prerequisite — tag category rename (source code currently says `religious_dietary`):**
1. `packages/shared/src/constants/index.ts`: Change `TAG_CATEGORIES` from `['language', 'cultural', 'religious_dietary']` to `['language', 'cultural', 'dietary']`
2. `packages/shared/src/constants/index.ts`: In `TAG_SEEDS`, remove 6 religious tags (Muslim, Hindu, Sikh, Buddhist, Christian, Non-denominational), keep 4 dietary (Halal, Kosher, Vegan, Vegetarian), change category to `'dietary'`, update slugs from `religious-dietary-*` to `dietary-*`, renumber displayOrder 1-4
3. `packages/db`: Generate custom migration via `pnpm --filter @vendor-marketplace/db exec drizzle-kit generate --custom` → fill with `ALTER TYPE "public"."tag_category" RENAME VALUE 'religious_dietary' TO 'dietary';`
4. Update tests: `packages/shared/src/constants/index.test.ts` — change assertions to `dietary`, length 4, spot-check `Halal`
5. Update seed.ts comment: "religious/dietary specialties" → "dietary preferences"
6. Run `pnpm db:migrate && pnpm db:seed` to verify, then `pnpm test`

**Tag picker implementation plan:**

API endpoints:
- `GET /tags` — public, returns all active tags ordered by category + displayOrder. Uses `tags_category_display_order_idx` partial index. Cacheable.
- `PUT /vendor/tags` — auth: vendor owns profile. Request: `setVendorTagsSchema` (`{ tagIds: uuid[] }`, max 15). Service resolves each ID, rejects non-existent or inactive tags, enforces per-category max of 5, then delete-all + insert in one transaction. Response: 200 with resolved tag objects.
- `POST /tags/suggest` — auth: any vendor. Request: `createTagSuggestionSchema` (`{ suggestedName, category }`). Response: `tagSuggestionResponseSchema` (discriminated union on `status`). Rate-limited 10/hr per user.

Frontend components:
- `TagPicker` (client) — controlled component, props: `selectedTagIds`, `onTagsChange`, `allTags`. Renders three `TagCategorySection`s. Parent form owns state.
- `TagCategorySection` (client) — shadcn Popover + Command for searchable multi-select. Disables unchecked items at max. Pill colours per `design/design-plan/03-components.md`.
- `TagSuggestionForm` (client) — inline form below each section. Client-side dedup first, then API call. Toast feedback per outcome.
- `allTags` fetched once in server component via `GET /tags`, passed down. Tag selection saved with profile form via `PUT /vendor/tags`.

New shared schema:
- `tagSuggestionResponseSchema` — `z.discriminatedUnion('status', [{ status: 'exists', tag }, { status: 'already_suggested' }, { status: 'submitted', suggestionId }])`

**Edge cases:**
- Unicode in business name → slug handles gracefully
- Upload failure → profile retains previous image
- Image >10MB → reject; non-image → reject with MIME validation
- Concurrent updates → last-write-wins
- Tag at max (5 per category) → dropdown items visually disabled, "(limit reached)" hint
- Duplicate tag IDs in `PUT /vendor/tags` input → deduped server-side, no constraint violation
- Empty tag array in `PUT /vendor/tags` → clears all vendor tags (valid)
- Tag suggestion for deactivated tag with same name → does NOT auto-match (only active tags match)
- Stale tag list after admin approval → acceptable for MVP, vendor refreshes to see new tags

**Testing:**
- Unit: tag suggestion dedup logic (exact match, case-insensitive, whitespace variants, pending dupe, genuinely new, deactivated tag skip)
- Unit: setVendorTags service (valid, non-existent ID, inactive ID, per-category max exceeded, empty array, duplicate IDs)
- Integration (PGlite): PUT /vendor/tags round-trip, POST /tags/suggest dedup against seeded tags, GET /tags returns only active
- Frontend (RTL): TagPicker renders 3 sections, select/deselect toggles pills, max disables remaining, search filters, suggestion form client-side dedup

**Blocked by:** #2

---

### #21: Orla Design Foundation, Brand & Reskin

**Milestone:** M1.8 | **Priority:** P0 Critical | **Status:** Done | **Capabilities:** `core` `auth`

**Design:** `design/design-plan/01-foundations.md`, `02-brand-and-logo.md`, `03-components.md`, `04-laws.md`, `21-sign-up.md`, `31-content-voice.md`. Frames: `12 Sign up` in `design/Orla - Screens.dc.html`.

**User value:** Every surface in the product looks like one designed thing rather than a default Tailwind app, and the brand name lives in one constant so it can change without a rewrite.

**Why this gates every frontend ticket:** it owns the token layer, the type stack and the shared component vocabulary. Screens built before it land on the wrong palette and the wrong fonts and have to be rebuilt, not restyled.

**Scope:**

*Tokens — `packages/config/tailwind/theme.css`:*
- Replace the `primary-*` terracotta ramp with `clay-*` per `01-foundations.md`. Clay is a **fill**: `clay-400 #B4552F` behind white text, `clay-500 #A34A28` for clay as text on cream. This is an accessibility rule, not a preference.
- Add `sage`, `gold`, `steel`, `error` semantic ramps with their text-safe steps (`sage-600`, `gold-600 #7A5A12` — not `#8A6716`, which fails AA — `steel-600`, `error-500`).
- Replace the warm-stone ramp with the new values, including `stone-0 #FFFDF9` (never pure white) and `stone-600 #6B6459` as the floor for any real label.
- Radius scale becomes five steps (`sm 6` / `md 8` / `lg 10` / `xl 14` / `2xl 18` / `full`); shadows become the five warm-tinted values.
- Layout variables per `01-foundations.md`: `--rail-booking`, `--rail-summary`, `--rail-context`, `--list-pane` join the existing set.
- Delete `hero-gradient`'s old definition in favour of the landing gradient in `10-landing.md`.

*Type — `apps/web/src/app/layout.tsx`:*
- Fraunces → **Instrument Serif** (display), Albert Sans → **Instrument Sans** (body), JetBrains Mono stays. Load with `next/font/google`; the fallback stays inside `var()` or the whole stack drops.
- Implement the two-density scale from `01-foundations.md`. `text-md` (15px) is new.

*Brand — `packages/shared/src/constants/brand.ts` (new):*
- `BRAND_NAME = 'Orla'`, `BRAND_DOMAIN = 'orla.com'`.
- `apps/web/src/components/brand/logo.tsx` — two equal circles, left clay fill, right ink stroke at 8% of diameter, overlapping by 45%. Props `{ size?: number; variant?: 'full' | 'mark'; tone?: 'light' | 'dark' | 'mono' }`; `size` is D and everything derives from it. Wordmark text reads `BRAND_NAME`, never a literal.
- Retire all 20+ hardcoded `VenMatch` strings: page metadata, `site-header`, `site-footer`, `suspended`, sign-up copy, the slug preview in `vendor-profile-form.tsx` (`venmatch.com/vendors/…` → `{BRAND_DOMAIN}/vendors/…`), `apps/web/README.md`, the `globals.css` comment, and the `noreply@venmatch.com` default in `packages/shared/src/env/registry.ts` (regenerate `.env.example` with `pnpm env:example`).
- Favicon and app icon from the mark alone — below 16px the wordmark drops.

*Component vocabulary — `03-components.md`, built once and imported everywhere:*
- `Button` — five variants (primary / secondary / ghost / ink / destructive) with the specified hover and active transforms. Copy rule: imperative, 2–4 words, never "Submit", never bare "Continue".
- `StatusPill` — the seven-status vocabulary. Status is never colour alone; the pill text is always present.
- `VendorCard` — `rounded-2xl bg-stone-0 shadow-sm`, no border, **`aspect-ratio: 3/2`** cover full-bleed to the top corners, 34px avatar overlapping the seam by 17px, chips, hairline rule, from-price row. Hover lifts 2px and scales the cover to 1.03 under `overflow:hidden`.
- `Input` / `Label` / helper / error — including the **blocking-field variant** (`border-gold-400` + gold helper) that #4's editor needs.
- `Avatar` — initials fallback in Instrument Serif on `clay-100` or `sage-100`, alternating by hash so a list isn't one colour. Sizes 30 / 34 / 38 / 64 / 80.
- `SidebarNav` — active item `bg-clay-100 text-clay-600` with `inset 3px 0 0 clay-400`; counts right-aligned, urgent counts as a clay pill, unread as a 7px clay dot.
- `Rail` — `bg-stone-0`, 1px `stone-300` inner border, 18–20px padding, 10.5px uppercase section label. Scrolls internally, never the page.
- `Placeholder` — the 135° repeating-linear-gradient with a 9px JetBrains Mono label naming the shot. Never an illustration, never stock.
- `EmptyState` — glyph, Serif headline, one sentence, one CTA. Never a blank pane.
- `Skeleton` set — one variant per content type mirroring real dimensions, 1.5s shimmer, 200ms minimum so fast loads don't flash. Plus the element spinner and the full-page loader — **the mark's two rings converging and parting, 1.9s, geometry only with no wordmark** (frame `26 State library`; see **#54**). Never a spinner and a skeleton on the same screen.
- `Toast` — bottom-right, 4px left accent by type, 5s auto-dismiss.

*Utilities and shadcn binding:*
- `app-shell` / `app-pane` / `field-grid` updated to `01-foundations.md`'s values.
- Rebind the shadcn slots in `globals.css` to the new tokens; extend `theme-tokens.test.ts` so a future refactor can't silently unpick the binding.

*Screen `21` — sign up / sign in:*
- Split screen at ≥1280: auth panel on `stone-50` capped at 460px, 600px full-bleed vendor photograph under the specified 200° wash on the right.
- Role cards **side by side at every width above 640** — it's a comparison, and stacking turns a choice into a scroll. Selected: `clay-100` + 2px `clay-400`.
- The whole panel — role choice and form — fits inside 836px with no scroll.
- **Marketing panel is mechanism, not metrics — do not build a stats endpoint.** Headline "Prices on the label. Dates you can trust." (Serif 38px); one line — "Every review comes from a booking that actually happened — and payment is held until your event is done."; then three guarantees with pale-sage dots above a hairline: *Real availability, not a contact form* · *Payment held until the event is complete* · *No service fee, ever*. Each is true on day one and beats a small number. The last thing a hesitant sign-up reads is the worst possible place for a placeholder. Stats are deferred — they need real booking and review volume, which does not exist until #10 and #12 have run. See `design/design-plan/21-sign-up.md` and `98-post-mvp.md`.
- `<ClerkProvider appearance={{ theme: shadcn }}>` inherits the bound slots. Never hand-write brand hexes into a Clerk appearance object.

*Reskin of the seven shipped surfaces — tokens and vocabulary only, no re-composition:*
`dashboard-shell`, `vendor-nav`, `site-header`, `site-footer`, the vendor profile editor, availability, packages, portfolio, the landing page as it stands, and the customer dashboard stub all move to the new tokens and the shared components in the same commit. Re-composing them to their frames belongs to #4, #6 and #22.

**Old-design debt this ticket clears (all shared and global debt, so later tickets inherit a clean base):**
- `packages/config/tailwind/theme.css` — all 12 `--color-primary-*` tokens deleted, not aliased. Also `--color-success` / `--warning` / `--error-light` / `--info` / `--info-light`, the four `--container-*` ceilings, the 4-step radius scale, the old shadow set and the old stone ramp values.
- `apps/web/src/app/layout.tsx` — Fraunces / Albert Sans imports and their variables.
- `apps/web/src/app/globals.css` (5 sites), `theme-tokens.test.ts` (asserts the terracotta ramp by name), `components/ui/button.tsx` + `button.test.tsx` (4 sites, the `cta` variant).
- Shared chrome: `dashboard-shell.tsx` (3), `vendor-nav.tsx`, `vendor-surface.tsx`, `form-section-nav.tsx`, `image-upload.tsx`, `category-icon.tsx`, `category-icon.test.tsx`.
- All 26 `VenMatch` / `venmatch.*` literals across 22 files, including `apps/web/README.md`, the `noreply@venmatch.com` default in `packages/shared/src/env/registry.ts` (plus `pnpm env:example`), and the `venmatch.app` fixtures in `apps/api/src/config/env.test.ts` and `packages/preflight/src/checks/environment.test.ts`.
- `apps/web/src/app/sign-up/[[...sign-up]]/page.tsx` and `sign-in` — both literals and tokens, since screen `21` is re-composed here anyway.

**A `primary-*` alias is forbidden.** Deleting the tokens outright means a missed call site fails the build instead of silently rendering the old palette. That is the point.

**Non-goals:**
- No screen re-composition beyond `21` — landing stays as shipped until #6c, the editor until #4.
- No dark mode. The warm cream identity is the brand; a true inversion is post-MVP.
- No public stats endpoint and no numbers on the marketing panel (post-MVP; blocked on real volume from #10 and #12).
- No Framer Motion choreography beyond the button and card transitions; entrance staggers land with the screens that use them.

**Behavioral requirements:**
- A grep for a literal brand string in `apps/web/src` returns zero hits outside `brand.ts`.
- Every text node clears **4.5:1**. `stone-500` is the single exception, reserved for genuinely inert content (out-of-month calendar days).
- The logo renders correctly at all six sizes in `02-brand-and-logo.md` and in all three colourways.
- Focus ring everywhere is `ring-2 ring-clay-400/30 ring-offset-2` — never browser blue.
- Icon-only controls carry `aria-label` and a 44×44 hit area.
- All motion respects `prefers-reduced-motion`: functional transitions survive, decorative ones don't.
- **Design parity gate** — screen `21` matches frame `12 Sign up` at 1440×900, verified in a real browser with Playwright per the parity procedure in `design/design-plan/04-laws.md`. Then the desktop review checklist in the same file, then the adaptation checklist at 1280px / 768px / 390px in `design/design-plan/30-responsive.md`
- Every reskinned surface is re-verified in the browser after the token swap — a contrast regression is the expected failure mode here.

**Edge cases:**
- A token rename that misses a call site fails the build, not silently falls back — do not add a `primary-*` compatibility alias.
- Clerk's own components must inherit the palette through the bound slots; if one fights the layout, override that element only.
- The marketing panel renders no zeros and no placeholder numbers. Until the stats block lands, the mechanism lines are the panel — not a stats block waiting on data.
- `BRAND_DOMAIN` appears in the slug preview and in email; both read the constant.

**Tests:**
- `theme-tokens.test.ts` extended: every shadcn slot resolves to a token, and the contrast pairs in `01-foundations.md`'s rules table are asserted numerically.
- `logo.test.tsx`: renders `BRAND_NAME`, geometry derives from `size`, all three tones.
- Component tests per variant for `Button`, `StatusPill`, `Avatar` fallback hashing.
- A repo-wide test asserting no literal brand string outside `brand.ts`.

**Blocked by:** #17 | **Blocks:** every frontend ticket

---

### #4: Vendor Service Setup (Packages, Portfolio + Availability)

*Consolidation: merges old #4 (Service Packages + Portfolio) and old #5 (Availability Management).*

**Milestone:** M2 | **Priority:** P1 High | **Status:** Done | **Capabilities:** `core` `auth` `storage`

**Design:** `design/design-plan/17-vendor-profile-editor.md`, `19-availability.md`. Frames: `09 Vendor profile editor`, `11 Availability`.

**Orla screens `17` + `19` — the vendor's storefront and calendar:**

*Screen `17`, the profile editor.* `app-shell`: 200px section nav + form pane + sticky submit bar, ≤1.5 viewports. It's a form, but it's also the pitch — setting up a storefront, not filing a tax return. Title "Your storefront" with the framing line "This is what a customer sees before they decide to message you."
- **Section nav** — Business · Location · Tags · Response time · Packages · Portfolio · Payouts. A **gold dot** marks any section holding an unmet publish requirement, with the legend "Gold dots block publishing." at the bottom. The same blocker shows in **three places at once** — the field, the nav, and the submit bar — so the vendor sees *what* and *where* without scrolling.
- **Fields ordered by consequence.** (1) Media pair on the first row: profile photo (128px dashed circle) and cover (`aspect-21/9` drop zone) **side by side, photo first** — they describe one thing, and a full-width cover above a lone circle wastes a third of the screen. (2) Business name + profile link on one row, slug preview rendering live as `{BRAND_DOMAIN}/kessler-co`. (3) About, full width, real placeholder copy. (4) Categories as icon chips — lucide glyph in a `clay-100` circle plus name; selected fills `clay-100` with a 1.5px `clay-400` border. (5) **Location before tags** — where a vendor works decides whether they're ever seen, a harder question than a taste tag. Address full width; city + state one row; **service radius in miles** (slider 5–125, 5-mile steps, value in the label) beside typical response time. (6) Tags — languages, cultural, dietary as three peer multi-selects on one row, in seed `displayOrder`, never alphabetical.
- **Sticky submit bar** — left: blocker summary with a gold dot ("**2 things** left before you can publish — response time and payouts"); right: save state, Preview, Save changes. **Explicit save, not autosave**, so the vendor can leave knowingly. Inline "Saved" fades after 2s.
- Radius stores `service_radius_km` and converts at the display boundary. Miles at every boundary — slider, label, profile, search.

*Screen `19`, availability.* `app-shell`: **three months side by side** at ≥1280 (two at 1024–1439, one below), which covers a typical booking horizon with **no month navigation**. Month name Serif 18px, weekday initials 10px, day cells 12px with 7px radius.
- Cell states: Available `stone-0` (click to block) · Booked `clay-100`/`clay-600` bold, locked, tooltip shows the booking · Pending request `gold-50`/`gold-600`, locked · Blocked `stone-200`/`stone-600` struck through (click to clear) · Selecting `clay-400`/white · Out of month `stone-500`. Today carries a `clay-400` ring. **Colour is never the only signal** — booked is bold, blocked is struck through.
- Click toggles; click-and-drag selects a range, including across a month boundary.
- 300px rail: **Selected** (the range in Serif, what it currently is, "Block these" + Clear) · **Legend** with all five states · **This quarter** counts with open-Saturdays in `clay-600` because it's the number that drives behaviour · **Market note**, one `stone-150` panel with a real insight. Real data or it doesn't ship.

**User value:** A vendor can create service packages with pricing, manage a portfolio gallery, and control their availability calendar — everything needed to appear in search and accept bookings.

**Scope:**
- `apps/api`: Package CRUD routes, Portfolio routes (upload, delete, reorder)
- `apps/api`: Availability routes — `GET/PUT /vendor/availability` (bulk update)
- `apps/web`: Package manager page, package form, portfolio manager (grid, drag-to-reorder)
- `apps/web`: Availability calendar page (12-month view, click to toggle, bulk actions)
- `packages/shared`: Package, portfolio, and availability Zod schemas

**Old-design debt this ticket clears:** every surface #4 shipped in `61cc5b6` was built against the pre-Orla system. Structure holds (3-month calendar, 300px rail, master–detail packages, sticky bars, 1.0× shell, verified at 1440/1280/768/390) but tokens and copy do not, so this ticket re-composes rather than restyles:
- `vendor-profile-form.tsx` (2 sites + the `venmatch.com/vendors/` slug preview → `{BRAND_DOMAIN}`), `app/vendor/profile/edit/page.tsx`, `category-picker.tsx` (2), `tags/tag-display.ts`.
- `availability/availability-calendar.tsx` (2), `packages/package-manager.tsx` (2), `portfolio/portfolio-manager.tsx`.
- The five `· VenMatch` page-title literals on `vendor/{dashboard,packages,portfolio,availability,profile/edit}`.
- Copy debt, not just colour: the editor gains the "Your storefront" framing line, the calendar gains struck-through blocked cells, the pending-request state, the This-quarter counts and the Market note. Old copy that reads as a form rather than a storefront goes.

**Non-goals:**
- No public vendor page (#6b), no booking requests (#7)
- No Stripe integration (vendor payment setup is #9)

**Behavioral requirements:**

*Packages:*
- Package: name, description, price (dollars→cents), price type (fixed/starting_at/hourly), optional duration/max guests
- Inclusions: dynamic list of text items
- Deactivate (soft-delete), reorder via display_order
- Minimum one active package to publish profile
- Price range: $25 min, $100K max

*Portfolio:*
- Upload, caption, reorder; thumbnails auto-generated

*Availability:*
- 12-month forward view
- Click or range-select to toggle available/blocked
- Visual indicators: available (green), booked (red, non-editable), blocked (gray)
- `PUT` accepts `{date, status}[]` — upserts via `ON CONFLICT`
- Default: no record = available
- Only future dates modifiable
- Booked dates non-editable

*All surfaces:*
- **Design parity gate** — the built screen matches its frame in `design/Orla - Screens.dc.html` at 1440×900, verified in a real browser with Playwright per the parity procedure in `design/design-plan/04-laws.md`. Then the desktop review checklist in the same file, then the adaptation checklist at 1280px / 768px / 390px in `design/design-plan/30-responsive.md`

**Edge cases:**
- Deactivating last active package → warn vendor profile will unpublish
- Price $0 → rejected ($25 min enforced)
- Block booked date → reject
- Past dates in bulk update → ignore silently
- Dates stored as `DATE` type (no timezone conversion)

**Blocked by:** #3, #17 | **Parallel with:** #16, #9

---

### #6a: Vendor Search API + Search Screen ✅ — *screen superseded*

**Milestone:** M3 | **Priority:** P1 High | **Status:** Done (da38e01) | **Capabilities:** `core` `auth` `storage`

Shipped `GET /vendors` (public, unauthenticated, AND-combined filters, facet counts,
30 route tests) and the `02 Search` screen as it was then drawn — 280px filter rail,
free-text `q`, 3-column grid.

**The screen half is superseded by the 2026-08-27 design revision.** What survives:
the endpoint, its tests, the `VendorCard` component, the skeletons, the empty states,
`nuqs` URL state, and `vendorNoun` on the category seeds. What goes: the `q` parameter
end to end, `search-filter-rail.tsx`, the category chip strip, and the 3-column density.
**#23 owns the rebuild.**

---

### #23: Search Redesign — Category-First Query + Refine Bar

**Milestone:** M3 | **Priority:** P0 Critical | **Status:** Done | **Capabilities:** `core` `auth` `storage`

**Design:** `design/design-plan/11-search.md` (rewritten), `10-landing.md`,
`03-components.md` (card densities), `04-laws.md` (the rail law now yields here),
`design/design-plan/CLAUDE-CODE-PROMPT.md` Change 2. **Frame: `02 Search & browse` — revised.**

**User value:** a customer can only ever ask a question the platform can answer, and
they see eight vendors at once instead of three.

**Why this is first.** `/search` is shipped and is now the furthest-from-parity surface
in the product. Every later screen inherits the `SearchBar` this ticket rewrites, so
building #6c or #6b against the old one means building it twice.

**Scope — `packages/shared`:**
- `vendorSearchQuerySchema`: **remove `q`**. Add `name` (optional, trimmed, max 200) as the deliberately-secondary vendor-name search. Keep `category`, `city`, `state`, price, `date`, `minRating`, `tags`, `sort`, pagination.
- Update `packages/shared/src/schemas/index.test.ts` — a query carrying `q` must now fail or be stripped, and `name` must round-trip. Assert specific values.

**Scope — `apps/api`:**
- `vendor-search.dao.ts` / `vendors.service.ts` / `vendors.routes.ts`: drop every `q` code path; add the `name` filter as an `ILIKE` on `business_name` only — it must not search bios, taglines or categories, because it exists for the referral case.
- Facet counts stay, but they are consumed inside the Refine popovers now rather than a rail; no API shape change is needed for that.
- Route tests: delete the `q` cases, add `name` cases (exact, partial, no-match, and that `name` does not match a bio).

**Scope — `apps/web`:**
- `components/search/search-bar.tsx` — rewrite. `SearchBarValues` becomes `{ category, city, date }`. Segment 1 is a **select/combobox over the eleven categories** with a `▾` affordance and flex `1.3`; it **cannot hold an unrecognised value** — typing filters, a non-match renders "No matching type" plus the three closest categories, and the field resolves to a category id or stays empty. Segment 2 label `City`, flex `1`. Segment 3 label `Event date`, flex `.8`, "Add a date" in `stone-600` when empty. Keep the `compact` / `hero` sizes — #6c consumes `hero`.
- **Delete `components/search/search-filter-rail.tsx`** and every import of it.
- New `components/search/refine-bar.tsx` — a `REFINE` micro-label then dropdown-trigger chips: `$500 – $3,200 ▾` (dual-handle range popover, live label), rating (`4★ & up ✕`, active = `clay-100` fill / `clay-600` text, `✕` clears), `Style ▾` (category-specific tags; **the option set changes with the selected vendor type**), `Languages ▾`, `Cultural ▾`, `Dietary ▾`, a `Clear` ghost link that appears only when a filter is set, and Sort at the far right of the same row. Wraps to a second row rather than scrolling.
- **No date chip in the Refine bar, at any width.**
- **No category chip strip.** Category is selectable in exactly one control.
- **No separate active-filter pill row** — an active filter is shown by its own chip's filled state and label value.
- `search-shell.tsx` — grid goes to **3 col at 1024–1439, 4 at ≥1440, 5 at ≥1728** (two columns belong to 768, not 1024 — see **#55**). Cards at the compact density from `03-components.md`: 132px cover, 12px padding, 19px name, availability chip only.
- Count sentence: `24 photographers in Austin · free on Sun, Jun 14`, with `Prices are what they charge — no quotes needed` beside it.
- `Search by name` — a plain `clay-500` link beside the query bar opening a name typeahead. **The smallest affordance on the screen.**
- Loading swaps **8** skeletons (was 6).
- `search-state.ts` / `.test.ts`: URL shape `?category=photography&city=austin-tx&date=2026-06-14`; all three are ids, not strings. Filter changes reset `page` to 1.

**Non-goals:**
- No semantic or free-text search over profile text — deferred, `98-post-mvp.md`.
- No map view, no saved searches.
- Do not touch the landing page — #6c owns it. This ticket only ships the `hero` variant of `SearchBar` so #6c can consume it.

**Behavioral requirements:**
- Submitting the bar with an empty vendor type is allowed and returns all categories; submitting with a typed non-match is not — the field will not resolve.
- Back/forward navigation restores category, city and date.
- Removing the last Refine chip removes `Clear`.
- Changing vendor type re-derives the `Style ▾` option set.
- **Design parity gate — 1:1 on layout, style, colour, font and the literal text**, verified with Playwright at 1440×900 against frame `02`, then the desktop review checklist in `04-laws.md`, then 1280 / 1024 / 768 / 390 per `30-responsive.md`.

**Acceptance:**
- [ ] `grep -rn "FilterRail\|filter-rail" apps/web/src` returns nothing
- [ ] `grep -rn "\bq\b" packages/shared/src/schemas/index.ts` shows no search `q`
- [ ] Vendor type cannot submit an unrecognised value
- [ ] Category is selectable in exactly one control; no chip strip exists
- [ ] No date chip in the Refine bar; no active-filter pill row
- [ ] **8 cards visible at 1440 × 900 with none sliced** — assert each first- and second-row card's `getBoundingClientRect().bottom <= pane.bottom`
- [ ] Page height is exactly one viewport; only the results grid scrolls
- [ ] Count sentence and positioning line match the frame word for word
- [ ] All existing route tests still pass; `q` tests replaced by `name` tests

**Old-design debt this ticket clears:** everything remaining in
`apps/web/src/components/search/*` and `apps/web/src/app/search/*`. The whole surface
comes across — a part-migrated search page is worse than none.

**Blocked by:** #6a

---

### #24: Sign-Up Marketing Panel Copy ✅

**Milestone:** M3 | **Priority:** P0 Critical | **Status:** Done | **Capabilities:** `core` `auth`

> **Shipped out of band 2026-08-27 — the tracker was stale.** Commit `a40600d` landed the
> copy; `29d30ce` then forked the panel by role and `f769767` gave it a neutral default,
> which is the superset this ticket asked for. Verified in the live app on 2026-08-27:
> `apps/web/src/components/auth/auth-screen.tsx:67,84` carries **both** headlines —
> the neutral "Clear prices. / Open calendars. / *No back-and-forth.*" and the customer
> "See the price. / See the open dates. / *Then decide.*" — matching `21-sign-up.md:95`
> and `:128`. One defect remains and is carried by **#31**: the "Pick one above to
> continue" hint renders below the Clerk footer rather than under the disabled button.

**Design:** `design/design-plan/21-sign-up.md` (Marketing panel section, rewritten),
`31-content-voice.md`, `CLAUDE-CODE-PROMPT.md` Change 4. **Frame: `12 Sign up` — copy revised.**

**User value:** the last thing a hesitant sign-up reads states the actual premise —
published prices *and* published availability — instead of a slogan.

**Scope:** copy only, in the sign-up marketing panel.
- Headline, Serif 38px, three lines, the last italic in `#F3C98B`:
  `See the price.` / `See the open dates.` / *`Then decide.`*
- Body, one line: "Every vendor publishes what they charge and when they're free — before you talk to anyone, and without asking for a quote."
- The three guarantee lines, in order:
  1. Live calendars — if a date shows open, it is
  2. Payment held until the event is complete
  3. Published prices, and no service fee on top

**Non-goals:** **no layout, token, class or component change.** The split screen, the
gradient wash, the type sizes and the pale-sage dots are already correct. If the diff
touches a class name, the scope is wrong.

**Behavioral requirements:**
- The panel still contains no numbers.
- The word "transparent" appears nowhere.
- Update the copy test if one asserts the old strings; add one asserting the new three lines.
- **Design parity gate** against frame `12` at 1440×900 — this ticket is almost entirely the **text** axis, so diff the strings out of the frame markup rather than eyeballing the screenshot. Then 1280 / 1024 / 768 / 390.

**Acceptance:**
- [ ] `grep -rn "Prices on the label\|No service fee, ever\|Real availability, not a contact form" apps/web/src` returns nothing
- [ ] The three-line headline renders with the third line italic in `#F3C98B`
- [ ] `git diff --stat` touches the sign-up panel and its test, and nothing else

**Blocked by:** #21

---

### #6b: Public Vendor Profile

**Milestone:** M3 | **Priority:** P1 High | **Status:** Done | **Capabilities:** `core` `auth` `storage`

**Status: Done** (acb3bba). **Design:** `design/design-plan/12-vendor-profile.md` (revised), `40-states.md`. **Frame: `03 Vendor profile` — revised.**

**User value:** the page where the decision happens — the most important surface in the product.

> **This route does not exist, and three shipped surfaces already link to it.** Verified
> 2026-08-27: every vendor card in `/search`, every "Featured vendors" card on `/`, the
> storefront editor's **Preview** button and its `orla.com/vendors/…` helper line all
> navigate to `/vendors/[slug]` and land on a stock 404. Closing this ticket closes the
> single largest hole in the funnel. Its loading and empty states compose from **#28**;
> a 410 for a removed listing uses #28's "listing removed" dialog, not a 404.

**Scope — `apps/api`:** `GET /vendors/:slug` (404 on unpublished or deleted),
`GET /vendors/:slug/availability`, `GET /categories`.

**Scope — `apps/web`:** `/vendors/[slug]`.
- **Header — SUPERSEDED by the 2026-08-27 design import; rebuilt in #53.** As shipped: cover 21:9, **`height:150px` with `box-sizing: border-box`**, avatar fully below it. Frame `03 Vendor profile` now specifies a **196px** banner with the **82px** avatar overlapping by **34px**. The content column below opens with `padding-top:18px`. The identity row is `display:flex; gap:16px; align-items:center` carrying a **72px** avatar and the name — **no negative margin, no overlap**. The earlier `margin-top:-32px` crossed a pane's `overflow:hidden` boundary and the browser sliced the avatar's top edge; if an overlap is ever wanted back it must live inside one positioned wrapper holding both the cover and the identity row.
- **Tabs, not anchors.** At ≥1280 the five tabs (About / Packages / Portfolio / Reviews / Availability) swap the content pane. State in `?tab=`. Below 1280 they become anchored sections with a scroll-spy.
- About: tagline as a Serif italic pull-quote, bio max 640px, four stat tiles, a 4-up recent-work strip. Packages: 2 columns, checklist inclusions with `clay-400` checks, a 3px left border in `clay-200/300/400` per tier, "Select this package" pre-fills the rail. Portfolio: CSS-columns masonry, 4 at ≥1280, lightbox with `stone-900/90` backdrop, arrow keys and Escape. Reviews: the tab and its empty state only — content is #12. Availability: current + next month side by side; clicking a free date pre-fills the rail.
- **Booking rail, 380px, sticky through the whole page.** Fixed order: from-price (Serif 36px) with the availability line · date + guests on one row, package select below · **Request booking** then **Send a message** · "You won't be charged yet — [Vendor] confirms the date first." · three trust lines with sage dots. On scroll past the header a slim sticky bar appears with the vendor name and both CTAs.
- SEO: meta, Open Graph, LocalBusiness structured data for the profile.

**Behavioral requirements:**
- Non-existent, unpublished or deleted slug → 404 page.
- No packages → "Contact for pricing" plus the message CTA.
- **Design parity gate — 1:1 on layout, style, colour, font and the literal text** against frame `03` at 1440×900, then 1280 / 1024 / 768 / 390.

**Acceptance:**
- [x] ~~Cover is 150px and `box-sizing: border-box`~~ — superseded, see **#53** (banner is now 196px)
- [x] ~~Avatar is 72px and sits entirely below the cover~~ — superseded, see **#53** (82px, overlapping by 34px)
- [ ] Nothing clipped by the cover or by a pane boundary
- [ ] Name, rating, from-price and both CTAs visible without scrolling
- [ ] Rail sticky through the whole page; tabs swap the pane at ≥1024 and write to `?tab=`
- [ ] Document height ≤ 2.5 viewports on the longest tab

**Blocked by:** #6a

---

### #6c: Landing Re-composition

**Milestone:** M3 | **Priority:** P1 High | **Status:** Done | **Capabilities:** `core`

**Design:** `design/design-plan/10-landing.md` (revised). **Frame: `01 Landing` — revised.**

**User value:** a visitor can start a real search without scrolling, and the page never
claims a scale the product doesn't have.

**Scope:**
- Hero is a 56/44 split at ≥1024 and **never stacks above that**: badge, H1 54px Serif, sub-line, the search bar and the top of the category row all inside the first 836px.
- H1 is two lines — "Book your vendors" in ink over *"without the back-and-forth."* in Instrument Serif italic `clay-500`. **That pattern repeats nowhere else in the product.**
- **Search bar is the `hero` variant of the category-first `SearchBar` from #23** — segments labelled `Vendor type` (select, flex 1.3, `▾`), `City` (flex 1), `Event date` (flex .8), then a `clay-400` pill button. `bg-stone-0 rounded-full shadow-lg`, 7px padding, 24px left inset, 1px × 32px `stone-300` dividers.
- **Below the bar: "Or jump straight to" + four category pills** — Photography, Florals, Catering, Entertainment. `stone-0` fill, 1px `stone-300` border, `rounded-full`, 12.5px / 600 ink, 6px × 12px padding. Each sets `?category=` and navigates. **The old "Popular: Florals · Taco carts · Live bands" link row is deleted** — it pointed at free-text queries that no longer exist.
- Badge reads **"Now booking in Austin"** with a 5px `clay-400` dot — no vendor count.
- Photo cluster: three placeholder cards at 236×292 (−4°), 254×316 (+3°), 188×150 (+2°), shadows increasing with elevation, plus a floating vendor chip. One `rgba(180,85,47,.06)` 440px circle behind it — **one blob per page maximum**.
- Category row: six cards by `displayOrder`, each with a plain description — "Photo & film", "DJs, bands, hosts", "Food, bar, carts", "Halls & outdoor", "Bouquets & decor", "Hair & makeup". **Not a count and not a from-price.** Cards become clickable here.
- **No stats band.** Below the fold: featured vendors → how it works on `stone-100` → three trust signals → split CTA on `stone-900` → footer.
- SEO: meta, Open Graph, LocalBusiness structured data.

**Old-design debt this ticket clears:** `apps/web/src/app/page.tsx` and its test in full.
The page shipped in `872804a` against a pre-Orla composition — the generic hero, the
bordered category cards and the CTA row are all re-composed to frame `01`.

**Behavioral requirements:**
- Auth-aware CTAs: hero and footer hide "Get started" / "Sign in" when signed in. A signed-in vendor never reaches `/` — `redirectVendorToDashboard()` sends them onward.
- Submitting the hero bar lands on `/search` with the params set.
- **Design parity gate — 1:1 including the literal text** against frame `01`, then 1280 / 1024 / 768 / 390.

**Acceptance:**
- [ ] Search bar fully visible at 1440 × 900 without scrolling; category row's top edge inside the first 836px
- [ ] Segment labels read exactly `Vendor type`, `City`, `Event date`
- [ ] "Or jump straight to" + four pills present; `grep -rn "Popular:" apps/web/src` returns nothing
- [ ] No free-text query field on the page
- [ ] No number on the page that isn't read from the database — in MVP, no platform stats at all
- [ ] Document height ≤ 4 viewports

**Blocked by:** #23

---

### #25: Style Tags — Category-Specific Refine Chip

**Milestone:** M3 | **Priority:** P2 Medium | **Status:** Deferred — needs a human | **Capabilities:** `core` `auth`

**Design:** `design/design-plan/11-search.md` (Refine bar). **Frame: `02 Search` — the `Style ▾` chip.**

**User value:** a customer who knows they want documentary rather than editorial
photography can say so, instead of opening eleven profiles to find out.

**Why it is deferred behind a decision:** #23 shipped the Refine bar without this chip and
recorded the deviation. The blocker is not code — **the data model has no `style` tag
category and no link from a tag to a vendor category**, and *choosing the style vocabulary
for eleven categories is a product decision*. Photography styles are not florist styles.
**Agree the vocabulary before writing any migration.**

**Proposed vocabulary, for approval — not implemented.** Recorded so this needs a yes
rather than a working session. Three to five words per category, each one a thing a
customer would actually say out loud:

| Category | Proposed styles |
|---|---|
| Photography | Documentary · Editorial · Fine art · Film · Traditional |
| Videography | Documentary · Cinematic · Highlight-led · Single-camera |
| DJ | Open format · House · Top 40 · Throwback · Latin |
| Live music | Acoustic · Jazz · Cover band · String ensemble |
| Catering | Plated · Family style · Buffet · Grazing · Food truck |
| Florals | Garden · Modern · Minimal · Wildflower |
| Venue | Indoor · Outdoor · Industrial · Historic · Garden |
| Planning | Full service · Month-of · Day-of |
| Cake & desserts | Classic · Sculptural · Dessert table |
| Beauty | Natural · Editorial · Bridal classic |
| Rentals | Modern · Vintage · Boho |

Two rules behind the list: no style appears under a category where it means something
different, and none of them is a quality claim — "Fine art" is a genre, "Premium" would
be a rating in disguise and is exactly what the Refine bar's rating chip already does.

**Scope — `packages/db` + `packages/shared`:**
- Add `style` to the `tag_category` enum (`packages/shared/src/constants` first — the enum
  lives once and both `pgEnum` and `z.enum` derive from it).
- Add a **nullable** `category_id` to `tags`. Nullable because existing tag categories
  (languages, cultural, dietary) are category-agnostic and must stay that way.
- Generate the migration with `pnpm db:generate`. Never hand-edit `packages/db/drizzle/`.
- Seed the agreed style vocabulary per vendor category, in the successor-migration style
  #17 established.

**Scope — `apps/api`:** extend the vendor-search filter to accept `style` tag ids, ANDed
with the existing filters exactly as the other tag groups are. Facet counts follow the
same rule already in place — drop the filter being counted so the number answers "what if
I picked this instead".

**Scope — `apps/web`:** the `Style ▾` chip in the Refine bar. **Its option set changes with
the selected vendor type**, and it is **absent entirely when no vendor type is selected** —
a style filter with no category is meaningless and would list all eleven vocabularies.

**Non-goals:**
- Do not make `category_id` non-null or backfill the existing tag groups into a category.
- Do not add a second control for category. The vendor-type select owns that value.
- No free-text style entry — this is an enumerable set, like the vendor type.

**Behavioral requirements:**
- Selecting Photography then opening `Style ▾` lists only photography styles.
- Changing the vendor type resets any style selection that does not exist under the new
  type, rather than silently filtering to zero.
- The chip does not render when vendor type is empty.
- **Design parity gate** on frame `02` at 1440×900, then 1280 / 1024 / 768 / 390.

**Acceptance:**
- [ ] `style` appears in the tag-category enum in `packages/shared/src/constants`, and `pgEnum`/`z.enum` both derive from it
- [ ] A migration exists under `packages/db/drizzle/` generated by `pnpm db:generate`
- [ ] A route test asserts a style filter ANDs with category and price
- [ ] A component test asserts the chip is absent with no vendor type and re-scoped when the type changes
- [ ] The agreed vocabulary is recorded in `.claude/plans/vendor-marketplace-decisions.md`

**Blocked by:** #23, **and a product decision on the style vocabulary**

---

### #26: Chrome Parity — Responsive Header & Clerk Pin

*Consolidation 2026-08-27: merges old #26 (Responsive Header) and old #27 (Clerk
Structural CSS). Both are shipped chrome deviating from the frames, both are P2, both are
ready now, and **#26's mandatory re-verify sweep of all 13 screens at 768/390 already
contains #27's parity check on frame `12`** — running that browser pass once rather than
twice is the reason they are one ticket.*

**Milestone:** M3 | **Priority:** P2 Medium | **Status:** Done | **Capabilities:** `core` `auth`

**Design:** `design/design-plan/30-responsive.md` (row `Header`), `21-sign-up.md`.
**Frames: `14 Adaptations` — build it as drawn — and `12 Sign up` — must not change.**

**User value:** the navigation exists on a phone, and the auth screen keeps the
composition frame `12` specifies after Clerk ships a component update instead of silently
regaining the chrome that was removed.

---

#### Part A — Responsive header & drawer

**Current state, confirmed live 2026-08-27:** the header measures **64px at 390** where
`30-responsive.md` specifies **56px**, and **no drawer exists at any width** — the shipped
header simply drops its nav below `md`. #21 verified frame `12 Sign up` at 768 and 390
without catching it, because that frame's header holds no nav. #6c found it when it added
the landing marketing nav and had nowhere to put it on mobile.

**Why it is not folded into a screen ticket:** it changes the header on **all 13 screens**,
so #6c correctly declined to absorb it.

**Scope:**
- The drawer component: hamburger trigger at 768 and below, opening the nav as a drawer.
- **The `Sign up` pill stays in the header beside the hamburger at 390** — `CLAUDE-CODE-PROMPT.md`
  Change 3 is explicit: *"Do not bury sign-up in the drawer."*
- Header height becomes **56px at 390**. `--header-height` is currently a **single value**
  and every app shell is measured against it — make it responsive and **check no shell
  overflows by the 8px difference**. #4 already had to fix a 1px version of exactly this.
- Re-verify **every shipped screen** at 768 and 390 afterwards.

**Non-goals:**
- No change to the desktop header. Frames `01`, `02` and the app frames are correct.
- Do not move the marketing nav's `/`-scoping — #6c scoped it deliberately, because frame
  `01` is the only frame that draws it.

**Behavioral requirements:**
- The drawer traps focus, closes on Escape and on route change, and is reachable by keyboard.
- The trigger is at least 44px — #23 already had to fix a 33px trigger on this screen.
- No horizontal overflow at 390 on any of the 13 screens.

---

#### Part B — Pin `@clerk/ui`

**Current state, confirmed live 2026-08-27:** Clerk logs
`code=structural_css_pin_clerk_ui` on **every auth page load**, naming 16 selectors. The
chrome-suppression rules in `apps/web/src/app/globals.css` target Clerk's internal DOM —
`[data-auth-screen] .cl-rootBox`, `.cl-cardBox`, `.cl-card`, `.cl-main`, `.cl-form` and 11
more. Introduced by #21. **These will break when Clerk ships a component update**, and the
failure is silent: the screen simply grows a card frame back.

**Scope:** Clerk's documented fix — install `@clerk/ui` and pass `ui` to `ClerkProvider` in
`apps/web/src/app/layout.tsx`, so the class contract is versioned rather than reverse-engineered.

```ts
import { ui } from '@clerk/ui'
<ClerkProvider ui={ui} …>
```

Then **delete the structural selectors from `globals.css`** and re-achieve the frame
through the supported appearance API. Deleting them is the point — leaving them alongside
`@clerk/ui` keeps the fragility and adds a dependency.

**Non-goals:**
- **No visual change.** Frame `12` is correct as shipped; this is the same screen on a
  supported foundation. If the screenshot differs, the scope is wrong.
- Do not touch the Clerk localisation object (`CLERK_COPY`) or the role fork — #24 owns those.
- Do not suppress the warning without fixing it.

**Behavioral requirements:**
- No `structural_css_pin_clerk_ui` warning in the console on `/sign-in` or `/sign-up`.
- The `avatarBox` clay override survives. **Known Clerk limitation to preserve, not
  "fix":** the UserButton's default avatar is a server-generated image from
  `img.clerk.com`, so it stays indigo for an account with no photo.

---

**Design parity gate — one sweep covering both parts.** Frame `14 Adaptations` at 768 and
390, then a re-verify pass of **every shipped screen** at 1440×900, 1280, 768 and 390.
Frame `12` is measured by the screenshot being *identical* to the pre-change one, and it
is one of the screens that sweep already visits.

**Acceptance:**
- [ ] `document.querySelector('header').getBoundingClientRect().height === 56` at 390
- [ ] A `Sign up` control is visible in the header at 390 without opening the drawer
- [ ] `documentElement.scrollWidth === innerWidth` on every shipped route at 390 and 768
- [ ] Focus is trapped in the open drawer and returns to the trigger on close
- [ ] `grep -n "cl-rootBox\|cl-cardBox\|cl-card\|cl-main\|cl-form" apps/web/src/app/globals.css` returns nothing
- [ ] A browser pass over `/sign-in` and `/sign-up` logs zero Clerk warnings other than the development-keys notice
- [ ] Screenshots of frame `12` before and after are pixel-identical at 1440×900

**Blocked by:** #6c, #21

---

### #7: Booking Request — API, Lifecycle & Screen

*Consolidation 2026-08-27: **re-joins old #7a and #7b**, which an earlier pass had split
into an API ticket and a screen ticket. The split did not hold: #7a shipped no screen and
its own acceptance conceded it was "verified by route tests and by driving #7b once that
lands" — so it could never clear this project's mandatory browser-verification gate on its
own, and it produced an intermediate state nobody could use. Every other screen ticket in
this tracker (#22a, #22b, #8) is already a vertical slice; #7 was the outlier. Preflight is
unaffected — `tickets.ts` already mapped both letters to `--ticket 7`.*

**Milestone:** M4 | **Priority:** P0 Critical | **Status:** Done | **Capabilities:** `core` `auth`

**Design:** `design/design-plan/13-booking-request.md`, `20-customer-bookings-hub.md`
(for the fields the hub renders), `40-states.md` (Validation), `98-post-mvp.md` (why there
is no Event entity).
**Frames: `04 Booking request` — unchanged, build it as drawn — and `22 Request validation` — new.**

**User value:** the customer gives the vendor everything needed to quote in one pass, so
the thread that follows is a confirmation rather than an interrogation. The vendor can
review, quote, accept, or decline.

**Old-design debt:** these surfaces are new, so they are built on Orla tokens and the
`03-components.md` vocabulary from the first commit — no `primary-*`, no brand literal, no
inline hex. Any pre-Orla file this ticket edits in passing comes across whole rather than
part-migrated; anything it cannot clear without leaving scope is named in the Notes column.

**Validation (frame `22`), from the 2026-08-27 states import.** Three tiers together, per
`40-states.md`: **red** on the wrong field, **gold** on the field that is valid but costly
(a date the vendor has blocked), and a **counted summary at the submit bar linking to each
field**. Errors appear **after a submit attempt, never while typing**, and clear per-field
on correction. The primary button goes `clay-300` while blockers exist and **stays
visible**, its helper line naming the block. The shared validation hook comes from
**#28** — do not write a second one.

> **The new frame is local.** `design/Orla - Screens.dc.html` carries all 27 frames as of
> 2026-08-27, so this ticket's parity gate runs against the markup. Where `40-states.md`
> and the frame could disagree, the frame wins — the plan explains it, the frame defines it.

**Orla screen `13` — booking request:** collect everything the vendor needs to quote **in one pass**, so the thread that follows is a confirmation rather than an interrogation. **A page, not a modal** — the vendor and package stay in a rail while the form is filled. Scroll budget ≤1.5×.
- Two columns: form (flexible) + 400px summary rail. Three-state stepper across the top of the form column — `1 Event details` (current, `clay-400` filled) → `2 Review & send` → `3 Vendor confirms`.
- Fields in a two-column grid **ordered by what the vendor needs first**: row 1 event date (pre-filled from search/rail, validated against the vendor calendar) + event type; row 2 start time + guest count; row 3 venue spanning both; row 4 "Anything else she should know?" textarea spanning both. **Nothing is a single-field row except the two textareas.**
- The date field carries a `sage-600` confirmation under it — "Maya is free on this date" — because that's the question the customer is actually asking. If taken, it becomes a `gold-600` line offering the nearest free dates.
- Summary rail: vendor mini-card · selected package with inclusions on one line · estimated total in Serif 26px · then the reassurance block — a `gold-50` panel: "You're requesting, not paying. [Vendor] has 48 hours to confirm or send a revised quote — you approve before any card is charged." **It sits directly above the primary action.** Then **Continue to review** and "Ask a question first" as the escape hatch that stops a hesitant customer bouncing to email.
- Step 2 keeps the same shell; the form column becomes a read-only summary with a per-section Edit affordance and the primary becomes "Send request". After submission, a success panel naming what happens next and the median response time, with a link into the thread — **not a dead-end confirmation page**.
- For a custom request the rail's package block is replaced by a required "Describe what you need" textarea.

**User value:** Customer can request a booking (package or custom). Vendor can review, quote, accept, or decline.

**⚠ REVERSED by the 2026-08-27 design revision — there is no `events` entity.**

An earlier revision of this ticket added an `events` table and a `bookings.event_id`
foreign key, because screen `20` grouped bookings under named events. **That grouping is
gone.** There is no way to create an event in the product, `/bookings` groups by **month
derived from the booking date**, and nothing may assume an Event object exists.

- **Do not create an `events` table, a migration, a model, or a foreign key.**
- The occasion is the existing **`event_type`** field on the booking — a controlled vocabulary (Wedding / Birthday / Corporate / …), captured in the request form and rendered by #22b as "Photography · Wedding". Confirm the vocabulary rather than leaving it free text: `99-open-questions.md` question 6.
- The **venue** is a plain field on the booking, rendered in the hub card's sub-line ("$1,450 paid · Barr Mansion").
- Both are collected by frame `04`'s form, which is unchanged, so no new field work is needed beyond making sure they persist and are returned by `GET /bookings`.
- Events as a real object with their own page are recorded in `98-post-mvp.md` with an unblock condition. Do not build toward them.

**Scope:**
- `apps/api`: Booking request routes (create, list, quote, accept, decline, cancel — customer + vendor)
- `apps/api`: State machine enforcement, price locking, auto-create conversation + notification
- `packages/shared`: booking request Zod schemas, including `event_type` and `venue`, derived from the constants in `packages/shared/src/constants`
- `apps/web`: the request screen itself — see **Screen scope** below. The two command centres are #22a / #22b.

**Behavioral requirements:**
- Package request → price locked at current package price
- Custom request → vendor quotes → customer accepts quote → price locked
- Validation: vendor published, future date, not booked/blocked
- Auto-create conversation on request. **No event is attached or created.**
- `expires_at` = now + 7 days
- State machine strictly enforced
- Either party can cancel PENDING/QUOTED
- **Design parity gate — 1:1 on layout, style, colour, font and the literal text** against frames `04` and `22` at 1440×900, then 1280 / 1024 / 768 / 390. The API half is verified by route tests and by driving the screen that sits on it.

**State machine — valid transitions:**
```
PENDING   → QUOTED     (vendor quotes a custom request)
PENDING   → ACCEPTED   (vendor accepts a package request at locked price)
PENDING   → DECLINED   (vendor declines)
PENDING   → CANCELLED  (customer cancels)
PENDING   → EXPIRED    (auto, when now > expires_at)
QUOTED    → ACCEPTED   (customer accepts the quote, locking quoted price)
QUOTED    → DECLINED   (vendor withdraws quote)
QUOTED    → CANCELLED  (customer cancels)
QUOTED    → EXPIRED    (auto, when now > expires_at)
ACCEPTED  → next ticket #10 handles payment → CONFIRMED booking
```
Any transition not listed above is rejected with `INVALID_STATE_TRANSITION`. Expiry is checked lazily — any read of a PENDING/QUOTED request past `expires_at` sets status to EXPIRED and returns the updated record.

**Implementation details:**
- Service method `transitionRequest(requestId, action, actorId)` — validates current state + actor role + action → applies transition or throws
- Price locking: `locked_price_cents` set on creation (package request) or on QUOTED (custom request). Once set, immutable.
- On ACCEPTED: validate vendor `stripe_onboarded = true`, validate event date not already BOOKED in `availability` table
- On request creation: auto-create `conversations` row with `(customer_id, vendor_id)` using `ON CONFLICT DO NOTHING` (idempotent if conversation exists)
- Auto-create notification for the other party on every transition

**Edge cases:**
- Same vendor/date requested twice → allowed, vendor manages
- Package price changes after request → locked price unaffected
- Vendor not Stripe-onboarded tries to accept → reject with `PAYMENT_REQUIRED` error and message directing to Stripe setup
- Date booked between request and acceptance → reject accept with `CONFLICT` error
- Expired request → treated as EXPIRED on next access (lazy check)
- Quote <$25 → rejected by `MIN_BOOKING_AMOUNT_CENTS` validation
- Customer cancels ACCEPTED request → no refund (payment hasn't happened), just state change

**Screen scope — `apps/web`.**

**Scope:** `/booking/request` — the two-column page above (form + 400px summary rail),
the three-state stepper, the two-column field grid, the date-availability confirmation
line, the `gold-50` reassurance panel directly above the primary action, step 2's
read-only review with per-section Edit, and the success panel that links into the thread.

**Non-goals:** no payment (#10), no events, no command-centre surfaces (#22a / #22b).

**Behavioral requirements:**
- **A page, not a modal** — the vendor and package stay in the rail while the form is filled. Scroll budget ≤ 1.5×.
- The date field shows "Maya is free on this date" in `sage-600`, or a `gold-600` line offering the nearest free dates when taken.
- A custom request replaces the rail's package block with a required "Describe what you need" textarea.
- Submitting lands on the success panel, never a dead-end confirmation page.
- **Design parity gate — 1:1 on layout, style, colour, font and the literal text** against frame `04` at 1440×900, then 1280 / 1024 / 768 / 390.

**Acceptance:**

*API and lifecycle:*
- [ ] `grep -rn "events" packages/db/src/schema` shows no events table and no `event_id`
- [ ] `GET /bookings` returns `event_type` and `venue` on every booking
- [ ] Every listed transition is covered by a route test asserting status + body shape
- [ ] Every unlisted transition returns `INVALID_STATE_TRANSITION`

*Screen:*
- [ ] Nothing is a single-field row except the two textareas
- [ ] The reassurance panel sits directly above the primary action, word for word as the frame has it
- [ ] Document height ≤ 1.5 viewports
- [ ] `event_type` and `venue` persist and come back on the booking

**Blocked by:** #6b, #28

---

### #22b: Customer Bookings Hub

*Split out of #22. Frame `07` was **rebuilt** by the 2026-08-27 revision, so it is scoped on its own and lands before the vendor dashboard.*

**Milestone:** M4 | **Priority:** P1 High | **Status:** Done | **Capabilities:** `core` `auth`

**Design:** `design/design-plan/20-customer-bookings-hub.md` (rewritten),
`98-post-mvp.md` (Events deferral), `CLAUDE-CODE-PROMPT.md` Change 1.
**Frames: `07 Customer bookings hub` — rebuilt — and `19 Bookings hub empty` — new.**

**Added by the 2026-08-27 states import:** frame `19` is this screen with no bookings, and
it ships with it. **The month grouping stays drawn** so the user learns the shape of the
feature, and **the rail is never blanked** — it carries the four mechanism promises. One
primary CTA. Composes from #28's empty-state component.

**Also replaces the placeholder `/customer/dashboard`,** whose scaffold #31 strips in the
meantime — see #31 items 1–4.

> **The new frame is local.** `design/Orla - Screens.dc.html` carries all 27 frames as of
> 2026-08-27, so this ticket's parity gate runs against the markup. Where `40-states.md`
> and the frame could disagree, the frame wins — the plan explains it, the frame defines it.


**User value:** one standing home for every vendor booking the customer ever makes, with
no new object to learn and no obligation invented for them.

**⚠ There is no Event entity. Nothing in this screen may assume one.**

An earlier draft grouped bookings under named events ("Nandakumar wedding") with an
"Event details →" link, a `/events` route and a "My events" sidebar item. **All of it is
removed.** There is no way to create an event in the product.

**Scope — `apps/api`:**
- `GET /bookings` with the Upcoming / History / All split, a category filter and a sort. **No event join, no `event_id`, no `/events` routes.**
- The response carries each booking's `event_type` (the occasion) and `venue`, both plain fields from #7.

**Scope — `apps/web`: `/bookings`**
- `app-shell`, sidebar + content + 340px rail. **No page scroll.**
- **The word "dashboard" appears nowhere.** Title is "Your bookings". Summary: "4 upcoming bookings. Next up is **Kessler & Co.** in 49 days." — derived from the nearest future booking.
- **Tabs** — Upcoming (booking date in the future, any status) / History (completed, cancelled, declined, expired) / All (everything, soonest first). Counts beside each label, state in `?tab=`. Beside them: **All categories ▾** and **Soonest first ▾** — *not* "All events" and "Date".
- **Grouping is by month, derived from the booking date** — `groupBy(startOfMonth(booking.eventDate))`. Group header: uppercase micro-label (`JUNE 2026`), a hairline rule filling the remaining width, and the count right-aligned ("3 bookings"). Purely presentational.
- **Booking card** — thumbnail, status pill, vendor name (Serif 17px), then `Category · Occasion` ("Photography · Wedding"), then the date in Serif 21px with the weekday ("Sun, Jun 14"), then a sub-line carrying amount, state and venue ("$1,450 paid · Barr Mansion", or "$3,840 quoted · expires in 3d"). **The date is the largest element on the card** because it is what gets scanned.
- **"Book another vendor"** — a dashed peer at the end of the last group, sub-line "Search Sept 5 in Austin", linking into search pre-filled with that month's date and the customer's city. An invitation, not a checklist. This is what replaced "Still to book".
- Rail: "Needs you" clay panels with the action inline ("Casa Verde sent a quote — $3,840 for 120 guests, expires in 3 days" + Review quote / Decline), gold panels for softer nudges, then three recent messages and "View all".
- Sidebar: My bookings (count, active) · Messages (unread dot) · Saved vendors · My profile. Bottom card: "Booking for something new? Search by vendor type, city and date — availability is live." → **Find a vendor**. **No "My events" item, no "New event" CTA.**
- **Booking master–detail** at ≥1280: 380px list + detail pane, independent scroll, selection in the URL so the detail is linkable. Below 1280 they are separate pages. Detail: status stepper, full price breakdown, cancellation policy in plain sentences, link into the thread. Contextual actions by status — Quoted → Review quote + Decline · Accepted → Pay now · Confirmed → Message + Cancel · Completed → Leave a review.

**Old-design debt this ticket clears:** `app/customer/dashboard/page.tsx` — a pre-Orla
stub carrying a `· VenMatch` title and old tokens. It comes across whole.

**Non-goals:**
- No state transitions — #7 owns the machine; this calls it.
- No payment (#10), no review submission (#12), no messaging thread (#8).
- **No events**, no event templates, no suggested-category rows, no shared events, no budget tracking. All in `98-post-mvp.md`.
- No platform statistics.

**Behavioral requirements:**
- The page does not scroll at 1440×900; only the panes scroll.
- Zero bookings: the sidebar prompt and an empty-state CTA render — never a blank pane.
- No copy anywhere assumes a wedding, a couple, or a single event.
- Verified signed in as a customer against seeded data that actually populates the surface.
- **Design parity gate — 1:1 on layout, style, colour, font and the literal text** against frame `07` at 1440×900, then 1280 / 1024 / 768 / 390.

**Acceptance:**
- [ ] `grep -ri "still to book\|my events\|event details\|new event" apps/web/src` returns nothing
- [ ] No route, link or component references an event by id; `/events` does not exist
- [ ] Group headers render `JUNE 2026` + rule + "3 bookings", derived from booking dates alone
- [ ] Cards render `Category · Occasion`, `Sun, Jun 14`, and the amount·state·venue sub-line
- [ ] Controls read "All categories ▾" and "Soonest first ▾"
- [ ] The word "dashboard" appears nowhere in the UI
- [ ] Tab split asserts exact status membership for Upcoming / History / All

**Tests:**
- Route tests asserting status + body shape, including the zero-data shape.
- The month-grouping helper: a booking on the 1st and one on the 30th of the same month share a group; December 31 and January 1 do not.
- Component tests for contextual actions per status — that mapping is the bug-prone part.

**Blocked by:** #7, #16 | **Parallel with:** #22a, #8

---

### #22a: Vendor Dashboard

*Split out of #22. Frame `08` is **unchanged** by the 2026-08-27 revision — build it as drawn.*

**Milestone:** M4 | **Priority:** P1 High | **Status:** Done | **Capabilities:** `core` `auth`

**Design:** `design/design-plan/16-vendor-dashboard.md`, `40-states.md`.
**Frames: `08 Vendor dashboard` — unchanged — and `20 Vendor dashboard empty` — new.**

**Added by the 2026-08-27 states import:** frame `20` is the reference for cause-naming
empty states. A vendor's empty request list is almost always an **unpublished profile**,
so the state **names that cause and makes the CTA fix it**: a gold blocker banner plus the
setup checklist, with the empty pane naming the reason rather than shrugging. Gold means
waiting on someone — **never red**, this is not a failure. Composes from #28.

**Also replaces the placeholder `/vendor/dashboard`,** whose "Ticket #9" card #31 strips
in the meantime.

> **The new frame is local.** `design/Orla - Screens.dc.html` carries all 27 frames as of
> 2026-08-27, so this ticket's parity gate runs against the markup. Where `40-states.md`
> and the frame could disagree, the frame wins — the plan explains it, the frame defines it.


**User value:** a vendor sees and acts on every incoming request without navigating away from one screen.

**Scope — `apps/api`:** vendor dashboard aggregates — bookings this month, response rate,
rating, earnings, publish-checklist state, today's schedule. These are the vendor's **own**
numbers on a private surface, so they stay in MVP.

**Scope — `apps/web`: `/vendor/dashboard`**
- `app-shell`, sidebar 240px + content + 340px rail. **The page never scrolls**; the requests list scrolls internally.
- Header carries a `sage-50` "Vendor" chip and "View my public profile".
- **Title states the number:** "Maya, you have 4 new requests" — not "Dashboard". **Nothing sits beside it** — see the reply-time omission below.
- Stats row: four cards across, never stacked at ≥1024. Serif 30px number over a 10.5px uppercase label with a delta line.
- Requests list is the working surface. Each row: avatar · name + status pill · one line of event facts · price and expiry · two contextual actions. A package request gets Accept + Send quote; a custom request gets Send quote + Ask a question. **Accepting from the row must not require opening the request.** Topmost row carries `inset 3px 0 0 clay-400` and a "Needs you" pill.
- Rail while unpublished: the publish checklist — progress bar, six rows with sage checks or open circles, the unmet row bold with a `clay-500` "Finish →", then a `gold-50` panel stating the consequence. Once published it becomes today's schedule.

**RESOLVED — reply time is omitted from the MVP.** Frame `08` renders
"Median reply time 2h · keep it under 4h to stay ranked" beside the title. **Do not build
it.** This is the one deliberate deviation from this frame and it is already written down
in `16-vendor-dashboard.md` and `98-post-mvp.md`, so the parity gate reads it as correct
rather than as drift.

It failed twice over: the median needs message history a new vendor does not have, so the
figure would be invented on their own dashboard; and "to stay ranked" promises a ranking
signal that does not exist. Softening to a plain nudge was considered and **rejected** —
the nudge still needs the median.

**Nothing replaces it.** The title already carries the request count, which is the number
that drives the vendor's next action.

**Response rate stays** in the stats row — it is the vendor's own private metric, it
starts at an honest zero, and it makes no ranking claim.

**Old-design debt this ticket clears:** `app/vendor/dashboard/page.tsx` — a pre-Orla stub
carrying a `· VenMatch` title and old tokens. It comes across whole.

**Behavioral requirements:**
- The page does not scroll at 1440×900; only the requests list scrolls.
- The request count in the page title and the sidebar agree — one source, not two queries.
- The publish checklist state matches the real publish gate exactly; a checklist that disagrees with the gate is worse than no checklist.
- Vendor with zero requests: the title reads a true zero state; the rail still shows the checklist or the schedule.
- A request expiring while the page is open reflects EXPIRED on the next fetch rather than offering a dead Accept.
- Accepting from the row when the date has since been booked: inline error on the row, not a toast, and the row refreshes.
- **Design parity gate — 1:1 on layout, style, colour, font and the literal text** against frame `08` at 1440×900, then 1280 / 1024 / 768 / 390.

**Non-goals:** the booking request lifecycle itself (#7); messaging (#8); any reply-time
figure or ranking claim; earnings charts and payout history, which are post-MVP.

**Tests:**
- Aggregate route tests asserting status + body shape, including the zero-data shape.
- Vendor stats derive from source rows and are never incremented.
- Component tests for contextual actions per status.

**Acceptance:**

- [ ] Page does not scroll at 1440 × 900; only the requests list scrolls internally
- [ ] Request count in the page title and the sidebar agree — asserted to come from one query, not two
- [ ] Every request row is actionable without navigating away; accepting a package request from the row works
- [ ] Contextual actions match status: package → Accept + Send quote; custom → Send quote + Ask a question
- [ ] Topmost row carries `inset 3px 0 0 clay-400` and a "Needs you" pill
- [ ] Stats are one row at every width ≥1024, never stacked
- [ ] Publish checklist state matches the **real** publish gate exactly — tested against a vendor failing each blocker in turn
- [ ] Unpublished vendor sees the checklist and the `gold-50` consequence panel; published vendor sees today's schedule
- [ ] Zero requests renders a true zero state, and the rail still renders
- [ ] A request expiring while the page is open shows EXPIRED on next fetch, not a dead Accept
- [ ] Accepting a row whose date was since booked shows an **inline** error on the row and refreshes it — not a toast
- [ ] **No reply-time figure and no ranking claim anywhere** — `grep` for "reply", "ranked" and "4h" in this surface returns nothing
- [ ] Response rate renders from real data and shows an honest zero for a new vendor
- [ ] Stats are recomputed from source rows, never incremented
- [ ] The pre-Orla `/vendor/dashboard` stub and its `· VenMatch` title are gone
- [ ] **Design parity gate** against `08 Vendor dashboard` and `20 Vendor dashboard empty` at 1440×900, then 1280 / 1024 / 768 / 390, plus `25 Vendor dashboard — 1024` and `25 Vendor dashboard — empty · 1024` at 1024 × 640

**Blocked by:** #7 | **Parallel with:** #22b, #8

---

### #8: Messaging + Notification Center

*Consolidation: merges old #8 (Messaging System) and old #13 (Notification Center). Shared SSE infrastructure delivers both message and notification events in real time.*

**Milestone:** M4 | **Priority:** P1 High | **Status:** Done | **Capabilities:** `core` `auth`

**Design:** `design/design-plan/18-messaging.md`, `40-states.md`.
**Frames: `10 Messaging` — unchanged — and `23 Messaging offline` — new.**

**Added by the 2026-08-27 states import:** frame `23` is the disconnected state, and for a
realtime surface it is not optional. **Steel** banner (neutral, self-resolving — never
red), **the composer stays usable**, and a failed bubble renders at 55% opacity with
**Retry / Delete**. A dropped SSE connection is the normal case on mobile, not an
exception. Composes from #28's banner.

> **The new frame is local.** `design/Orla - Screens.dc.html` carries all 27 frames as of
> 2026-08-27, so this ticket's parity gate runs against the markup. Where `40-states.md`
> and the frame could disagree, the frame wins — the plan explains it, the frame defines it.


**Old-design debt:** these surfaces are new, so they are built on Orla tokens and the `03-components.md` vocabulary from the first commit — no `primary-*`, no brand literal, no inline hex. Any pre-Orla file this ticket edits in passing comes across whole rather than part-migrated; anything it cannot clear without leaving scope is named in the Notes column.

**Orla screen `18` — messaging:** keep the negotiation attached to the booking. **The context rail is what makes this a booking tool rather than a chat app.** `app-shell`, three panes, none of which scroll the page.
- 300px conversation list · flexible thread · 320px booking context rail. Three panes at ≥1280; context collapses to a toggle at 1024–1279.
- Each conversation item carries a **booking context line** in 10.5px uppercase ("Re: Jun 14 wedding") — that line is what makes a list of names navigable when a vendor has thirty threads. Unread: bold name + `clay-400` dot. Active: `clay-100` with `inset 3px 0 0 clay-400`.
- Thread header: avatar, name, the booking one-liner and the status pill, so state is visible while reading. Day dividers centred in 11.5px `stone-600`.
- Bubbles: own messages `clay-100` with `rounded-[14px_14px_4px_14px]`, other party `stone-0` with the mirror radius, max width 62%, timestamp below and outside the bubble. **Marketplace, not iMessage** — the tail is a subtle corner, not a pointer.
- Composer: auto-resizing textarea in `stone-150`, then Attach · **Insert package** · Send. "Insert package" drops a formatted package card into the thread — the single highest-leverage thing on this screen for a vendor closing a deal.
- Context rail: the linked request with the date in Serif 24px, the event facts, the price lines including any adjustment being negotiated, the revised total, then **the actions available in this status** — Send revised quote (primary), Accept as-is with the original amount named, Decline politely (ghost). **A quote can be sent without leaving the thread.** Below it, "About [customer]" — member since, bookings, completion rate, rating from other vendors, one quoted review. A vendor deciding whether to hold a Saturday wants to know who they're holding it for.
- Auto-scroll to newest; a "New messages ↓" chip appears if scrolled up. The composer never blocks on delivery.

**User value:** Customers and vendors can exchange messages in the context of a booking, and receive real-time in-app notifications for all important events (booking updates, reviews, etc.) via a bell icon with unread badge.

**Scope:**
- `apps/api`: Message routes (conversations list, messages, send)
- `apps/api`: Notification routes (list, mark read, mark all read)
- `apps/api`: Unified SSE stream delivering both message and notification events
- `apps/web`: Messages page, conversation list sidebar, message thread view
- `apps/web`: SSE client hook (shared by messages and notifications)
- `apps/web`: Header: unread message count + notification bell with badge
- `apps/web`: Notification dropdown/panel with mark-as-read on click

**Non-goals:**
- Email notifications (#11)
- Notification preferences (post-MVP)

**Behavioral requirements:**

*Messaging:*
- 1:1 conversations (created in #7), participants-only access
- Messages paginated (50/page), ordered by created_at asc
- `read_at` set when conversation opened
- Max 5000 chars per message

*Notifications:*
- Fetched on page load, paginated (20/page), newest first
- Each notification: title, body, timestamp, read/unread, link
- Click → mark read + navigate to linked page
- "Mark all read" action

*Real-time (shared SSE):*
- SSE: authenticated, auto-reconnect with exponential backoff
- Delivers both `new_message` and `new_notification` event types through one stream
- Header updates in real-time: unread message count + notification badge

*All surfaces:*
- **Design parity gate** — the built screen matches its frame in `design/Orla - Screens.dc.html` at 1440×900, verified in a real browser with Playwright per the parity procedure in `design/design-plan/04-laws.md`. Then the desktop review checklist in the same file, then the adaptation checklist at 1280px / 768px / 390px in `design/design-plan/30-responsive.md`

**Implementation details:**

API routes (messaging):
- `GET /conversations` — list user's conversations with last message preview, unread count, other participant name+avatar. Ordered by last_message_at desc.
- `GET /conversations/:id/messages?page=1` — paginated messages (50/page), ordered by created_at asc. Validate current user is a participant.
- `POST /conversations/:id/messages` — send message. Validate participant, enforce `MESSAGE_MAX_LENGTH` (5000). Set `conversations.last_message_at = now()`.
- `PUT /conversations/:id/read` — sets `read_at` on all unread messages in this conversation.

API routes (notifications):
- `GET /notifications?page=1` — paginated notifications (20/page), ordered by created_at desc. Returns title, body, type, link, read/unread, timestamp.
- `PUT /notifications/:id/read` — mark single notification as read.
- `PUT /notifications/read-all` — mark all unread notifications as read.

Unified SSE endpoint:
- `GET /events/stream` — single SSE endpoint. Auth via Clerk token in query param (SSE doesn't support custom headers). Sends typed events: `{ type: 'new_message', conversationId, message }` and `{ type: 'new_notification', notification }`.

SSE implementation (Fastify):
- Use `reply.raw` to write SSE frames directly: `data: ${JSON.stringify(event)}\n\n`
- Keep connections in a `Map<userId, Set<Response>>` — one user can have multiple tabs
- On new message insert: look up both participant userIds in the map, push event to all their connections
- On new notification insert: push `new_notification` event to the target user's connections
- Heartbeat: send `:heartbeat\n\n` comment every 30s to detect dead connections
- On connection close: remove from map

Frontend SSE client (`useEventStream` hook):
- Single `EventSource` with Clerk token appended as query param
- Routes events by `type` to the appropriate state updater (messages or notifications)
- `onerror`: exponential backoff reconnect (1s, 2s, 4s, 8s, max 30s)
- On reconnect: fetch messages since `lastMessageTimestamp` + latest notifications to fill gaps

Header integration:
- Unread message count: fetched on initial load via `GET /conversations` (sum of unread counts), updated in real-time via SSE
- Notification bell badge: fetched on initial load via `GET /notifications` (count where `read_at IS NULL`), updated in real-time via SSE

**Edge cases:**
- SSE drop → reconnect + fetch missed messages/notifications since last known timestamp
- Non-participant → 403 on all conversation routes
- XSS → plain text storage only, React auto-escapes on render
- Very long message (>5000 chars) → rejected by Zod at API boundary
- Conversation with no messages yet (just created by booking request) → empty state "Start the conversation"
- Multiple tabs open → all receive SSE events, all update in real-time
- Zero notifications → empty state "No notifications yet"

**Acceptance:**

- [ ] A non-participant gets **403** on every conversation route — asserted per route, not just the list
- [ ] Messages paginate at 50/page, ordered `created_at asc`
- [ ] `read_at` is set when the conversation is opened, not when it is merely listed
- [ ] A message over 5000 chars is rejected at the Zod boundary
- [ ] Message bodies are stored as **plain text**; a script tag round-trips as literal text
- [ ] One SSE stream carries both `new_message` and `new_notification` — not two connections
- [ ] SSE reconnects with exponential backoff and **fetches what it missed** since the last known timestamp — tested by dropping the connection mid-session
- [ ] Multiple open tabs all receive events and all update
- [ ] Header unread count and notification badge update in real time and agree with the API
- [ ] Clicking a notification marks it read **and** navigates to its link
- [ ] "Mark all read" clears the badge
- [ ] A conversation created by a booking request with no messages shows "Start the conversation"
- [ ] Zero notifications shows "No notifications yet"
- [ ] The composer never blocks on delivery
- [ ] A quote can be sent without leaving the thread
- [ ] **No email is sent for `new_message`** — that boundary belongs to #11
- [ ] **Design parity gate** against frames `10 Messaging` and `23 Messaging offline` at 1440×900, then 1280 / 1024 / 768 / 390

**Blocked by:** #7 | **Can parallel with:** #10

---

### #9: Stripe Connect Vendor Onboarding

**Unblocked — verified against the live Stripe test account 2026-08-29.** An earlier
assessment in this sweep claimed #9 needed a human to supply credentials. **That was wrong.**
`.env` already carries `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`,
`STRIPE_WEBHOOK_SECRET` and `STRIPE_PLATFORM_FEE_RATE`, all in **test** mode. Probed directly:

| Probe | Result |
| --- | --- |
| `GET /v1/account` | **200** — `acct_1ThejeFAZlti5JuH` |
| `GET /v1/accounts` | **200** — Connect is enabled, **1 connected account already exists** |
| `POST /v1/accounts` | **400** — *"Stripe no longer recommends Accounts v1 for new Connect integrations. Create connected accounts with `POST /v2/core/accounts` instead."* |

**So the only decision left is an API-version one, and it is agent-executable:** build on
**Accounts v2** (`POST /v2/core/accounts`), which is what Stripe now recommends, rather than
enabling v1 compatibility in the Dashboard (which would be a human action). Choose v2.

**The Stripe and Clerk agent skills are installed and wired up** (2026-08-29). `npx skills`
puts them in `.agents/skills/`, which **Claude Code does not read** — it loads
`.claude/skills/`. The six the queue needs are symlinked across and are gitignored, so they
are local-only and cost nothing in the repo:

| Skill | For |
| --- | --- |
| `connect-recommend` | Connect configuration, charge types, account types — read this first |
| `connect-required-verification-information` | What a connected account must supply before it can be paid |
| `stripe-best-practices` | Current API idioms, in place of pre-trained memory |
| `clerk-nextjs-patterns`, `clerk-webhooks`, `clerk-testing` | #46, #226 and the auth work |

**Skills load at session start**, so a session that was already open when they were linked
will not see them — start the overnight run in a fresh session.

**This ticket is the critical path.** It unblocks #10, #68, #220 and #221 — the entire
transaction half of the product, and the reason `accept` returns 402 for every vendor today.


**Milestone:** M4 | **Priority:** P0 Critical | **Status:** Backlog | **Capabilities:** `core` `auth` `stripe`

**User value:** Vendor can connect their bank account via Stripe to receive payouts.

**Scope:**
- `apps/api`: Stripe Connect routes (`POST /vendor/stripe/connect`, `GET /vendor/stripe/status`)
- `apps/api`: Stripe webhook (`account.updated`), Stripe client setup
- `apps/web`: "Set up payments" button, status indicator, redirect flow, return page, dashboard banner

**Behavioral requirements:**
- Creates Express account (or new Account Link for existing incomplete)
- Redirects to Stripe hosted onboarding → redirect back on completion
- `account.updated` webhook updates `stripe_onboarded` based on `charges_enabled` + `payouts_enabled`
- Cannot accept bookings until onboarded
- **Design parity gate** — the built screen matches its frame in `design/Orla - Screens.dc.html` at 1440×900, verified in a real browser with Playwright per the parity procedure in `design/design-plan/04-laws.md`. Then the desktop review checklist in the same file, then the adaptation checklist at 1280px / 768px / 390px in `design/design-plan/30-responsive.md`

**Implementation details:**
- Stripe client: `packages/shared` or `apps/api/src/lib/stripe.ts` — initialized with `STRIPE_SECRET_KEY` from env. Use `stripe.accounts.create({ type: 'express' })` for new accounts, `stripe.accountLinks.create(...)` for onboarding redirect.
- `POST /vendor/stripe/connect`:
  1. If vendor has no `stripe_account_id` → `stripe.accounts.create({ type: 'express', metadata: { vendorId } })` → save `stripe_account_id` to `vendor_profiles`
  2. Create Account Link: `stripe.accountLinks.create({ account, refresh_url, return_url, type: 'account_onboarding' })`
  3. Return `{ url }` — frontend redirects to Stripe hosted onboarding
- `GET /vendor/stripe/status` → return `{ stripeAccountId, stripeOnboarded, chargesEnabled, payoutsEnabled }` from local DB (don't hit Stripe API on every check)
- Webhook `POST /webhooks/stripe` (or extend existing):
  - Verify signature with `STRIPE_WEBHOOK_SECRET`
  - Handle `account.updated`: extract `charges_enabled` + `payouts_enabled` → set `stripe_onboarded = (charges_enabled && payouts_enabled)` on matching vendor profile
- Return page (`/vendor/stripe/return`): check `GET /vendor/stripe/status`, show success or "still processing" with refresh prompt
- Dashboard banner: if `stripe_onboarded = false`, show persistent banner "Set up payments to start accepting bookings" with CTA

**Edge cases:**
- Abandoned onboarding → `POST /vendor/stripe/connect` detects existing `stripe_account_id`, creates new Account Link for same account
- Account disabled after onboarding → `account.updated` webhook sets `stripe_onboarded = false`, dashboard shows re-onboarding banner
- Multiple clicks → idempotent (same account, new Account Link each time — Stripe allows this)
- Webhook arrives before return page load → status already updated, return page shows success
- Webhook never arrives → return page polls `GET /vendor/stripe/status` once, shows "processing" if not yet onboarded

**Non-goals:** taking payment (#10); payout scheduling; multi-account or platform-fee
configuration; any vendor-facing fee claim, which stays deferred per `98-post-mvp.md`.

**Acceptance:**

- [ ] `POST /vendor/stripe/connect` creates an Express account on first call and stores `stripe_account_id`
- [ ] A second call reuses the same account and issues a **new** Account Link — no duplicate accounts
- [ ] `GET /vendor/stripe/status` reads local state and does **not** hit the Stripe API
- [ ] `account.updated` sets `stripe_onboarded = charges_enabled && payouts_enabled` — both flags, not either
- [ ] An account disabled after onboarding flips `stripe_onboarded` back to false and the banner returns
- [ ] Webhook signature verified with `STRIPE_WEBHOOK_SECRET`; an unsigned POST is rejected
- [ ] A vendor who is not onboarded **cannot accept bookings** — enforced server-side, not just hidden in the UI
- [ ] Return page shows success when the webhook already landed, and "still processing" when it has not
- [ ] Abandoned onboarding resumes cleanly from the dashboard banner
- [ ] Dashboard banner appears only while `stripe_onboarded` is false
- [ ] **No fee claim appears on any vendor-facing surface in this flow**
- [ ] **Design parity gate** at 1440×900, then 1280 / 1024 / 768 / 390

**Blocked by:** #2, #17 | **Can parallel with:** #4, #16

---

### #10: Payment + Booking Completion Lifecycle

**Milestone:** M4 | **Priority:** P0 Critical | **Status:** Backlog | **Capabilities:** `core` `auth` `stripe`

**Design:** `design/design-plan/14-checkout.md`, `15-confirmed.md`, `40-states.md`.
**Frames: `05 Checkout`, `06 Booking confirmed` — unchanged — and `21 Checkout declined` — new.**

**Added by the 2026-08-27 states import:** frame `21` is the declined-payment state and it
is the highest-stakes error in the product. It must answer all four questions from
`40-states.md` §1 explicitly: **"You haven't been charged"** (money position), **the 24h
date hold** (is my date still mine), and **no-third-attempt guidance** (what do I do now).
A generic "Payment failed" here loses the booking. Composes from #28's banner and its
availability-conflict dialog.

> **The new frame is local.** `design/Orla - Screens.dc.html` carries all 27 frames as of
> 2026-08-27, so this ticket's parity gate runs against the markup. Where `40-states.md`
> and the frame could disagree, the frame wins — the plan explains it, the frame defines it.


**Old-design debt:** these surfaces are new, so they are built on Orla tokens and the `03-components.md` vocabulary from the first commit — no `primary-*`, no brand literal, no inline hex. Any pre-Orla file this ticket edits in passing comes across whole rather than part-migrated; anything it cannot clear without leaving scope is named in the Notes column.

**Orla screens `14` + `15`:**

*Screen `14`, checkout.* Take payment with **no ambiguity** about what's being bought or what happens if plans change. ≤1.5×, summary rail sticky at 420px.
- The header strips back to the logo plus "Secure checkout · encrypted by Stripe" with a sage dot. **No nav** — nothing competes with finishing.
- Left: "Confirm and pay" (Serif 26px) and one context line — "Maya accepted your request on May 2. Paying now locks June 14 in her calendar." Fields max 620px: card number with the brand mark right-aligned · expiry + CVC on one row · name on card · country + ZIP on one row. Stripe Elements styled to match — Instrument Sans 15px, `#23201C`, placeholder `#6B6459`.
- **"If plans change"** in a bordered `stone-0` panel below the fields: the cancellation terms in plain sentences, **not a policy link**. It sits above the fold because it is the last real objection.
- Summary rail: vendor mini-card · date / venue / guests · breakdown where **"Service fee: None" is stated in `sage-600`, not omitted** — it's a trust signal · total today in Serif 30px above a hairline. Then **"Pay $1,450 — confirm June 14"** full width: the button names both the amount and the outcome, never bare "Pay". Then "Held by Stripe until the event is complete."
- Card errors appear inline under the field, **never as a toast**. Double-submit is impossible: the button disables and shows an inline spinner on click.

*Screen `15`, booking confirmed.* The one celebration moment in the product — then straight back to something useful. **Fits one viewport with no scroll.**
- Full-bleed `linear-gradient(150deg,#7A9468,#5E7A4E 55%,#49613D)` with two low-opacity white circles. This is the only gradient on any non-marketing surface and the only place sage becomes a full field.
- Sequence: 70px translucent circle with a white check, spring in (damping 20 / stiffness 300) → **"June 14 is yours."** Serif 48px white — *names the date, not the transaction; "Booking confirmed" is a receipt, the date is what they bought* → one line on what was paid and when the vendor is next in touch → detail card on `stone-0` with the booking id in JetBrains Mono, copyable → **Message [vendor]** + **View booking** → divider, then **"Still need someone for [date]?"** with four category chips — **names only, no counts** — linking into search pre-filtered to this event's date and city. The old "Couples who booked Maya also booked" framing is cut: it needs pairing data the app does not have, and it assumed a wedding. Frame `06 Booking confirmed` carries a *Revised* badge for this.
- **One sparkle burst, not continuous.** Respects `prefers-reduced-motion`: the check appears without spring and the burst is skipped.
- It is a **state, not a one-shot page** — reachable again from the booking detail.

**User value:** Customer pays for accepted booking via Stripe. On event completion, vendor receives payout. Cancellation with appropriate refunds.

**Scope:**
- `apps/api`: Payment route (`POST /customer/bookings/:id/pay`), completion (`PUT /vendor/bookings/:id/complete`), cancellation (`PUT /customer/bookings/:id/cancel`)
- `apps/api`: Stripe webhook (`payment_intent.succeeded`), payment service, booking DAO
- `apps/web`: Payment page (Stripe Elements), confirmation page, booking detail page, cancel UI, "Mark Complete" button

**Behavioral requirements:**
- Pay → creates PaymentIntent with `application_fee_amount` + `transfer_data.destination`
- `payment_intent.succeeded` → single DB transaction: create booking + update request + mark availability BOOKED
- If DB fails after Stripe payment → log to Sentry for manual reconciliation (no auto-refund)
- Complete → Transfer to vendor Connect account
- Cancel CONFIRMED >48h → 100% refund; <48h → 50% refund; COMPLETED → cannot cancel
- **Design parity gate** — the built screen matches its frame in `design/Orla - Screens.dc.html` at 1440×900, verified in a real browser with Playwright per the parity procedure in `design/design-plan/04-laws.md`. Then the desktop review checklist in the same file, then the adaptation checklist at 1280px / 768px / 390px in `design/design-plan/30-responsive.md`

**Implementation details:**

Payment flow (`POST /customer/bookings/:requestId/pay`):
1. Validate: request status = ACCEPTED, customer is the request owner
2. Create PaymentIntent: `stripe.paymentIntents.create({ amount: locked_price_cents, currency: 'usd', application_fee_amount: Math.round(locked_price_cents * platformFeeRate), transfer_data: { destination: vendor.stripe_account_id }, metadata: { requestId, vendorId, customerId }, idempotency_key: requestId })`
3. Return `{ clientSecret }` — frontend uses Stripe Elements `<PaymentElement>` to confirm
4. Frontend confirms via `stripe.confirmPayment({ elements, confirmParams: { return_url } })`

Webhook (`payment_intent.succeeded`):
1. Verify Stripe signature
2. Extract `requestId` from `metadata`
3. **Single DB transaction:**
   - Insert `bookings` row (status = `confirmed`, `payment_intent_id`, `amount_cents`, `platform_fee_cents`, `vendor_payout_cents`)
   - Update `booking_requests` set status = `confirmed` (or a post-payment state)
   - Insert `availability` row (vendor_id, date, status = `booked`) — `UNIQUE(vendor_id, date)` constraint prevents double-booking; if constraint fails → entire transaction rolls back
4. If transaction fails → log to Sentry with `{ requestId, paymentIntentId, error }` for manual reconciliation. Do NOT auto-refund — manual review required.
5. Create notifications for both parties

Completion (`PUT /vendor/bookings/:id/complete`):
1. Validate: booking status = `confirmed`, event date is today or past, vendor owns booking
2. Update booking status = `completed`
3. Transfer is automatic via Stripe Connect (funds held in platform → released on `transfer_data.destination`)
4. Create notification for customer to leave review

Cancellation (`PUT /customer/bookings/:id/cancel`):
1. Validate: booking status = `confirmed`, customer owns booking
2. Calculate refund:
   - `event_date - now >= FULL_REFUND_CUTOFF_HOURS (48h)` → 100% refund
   - `event_date - now < 48h` → 50% refund (`LATE_CANCELLATION_REFUND_RATE`)
3. `stripe.refunds.create({ payment_intent: paymentIntentId, amount: refundAmountCents })`
4. **DB transaction:** Update booking status = `cancelled`, record refund details, delete `availability` row for that date (vendor date freed)
5. Create notifications for both parties

Platform fee rate: `STRIPE_PLATFORM_FEE_RATE` env var, falls back to `DEFAULT_PLATFORM_FEE_RATE` (0.12 = 12%)

**Edge cases:**
- Double-pay → idempotent PaymentIntent (same `idempotency_key` = requestId)
- Concurrent same-date bookings → first `payment_intent.succeeded` transaction wins on `UNIQUE(vendor_id, date)` constraint; second transaction fails → log for manual refund
- Webhook never arrives → reconciliation: on booking detail page load, if request is ACCEPTED and has a `payment_intent_id` but no booking row, call `stripe.paymentIntents.retrieve()` to check status
- Transfer fails → log to Sentry with booking context, admin manually retries
- Refund fails → log to Sentry, booking stays `confirmed`, admin manually processes
- Cancel COMPLETED booking → reject (cannot cancel after completion)
- Vendor marks complete before event date → reject (event date must be today or past)

**Non-goals:** deposit/balance splits, saved payment methods and instalments (all
post-MVP); auto-refund on a failed post-payment transaction, which stays a manual
reconciliation by design.

**Acceptance:**

- [ ] PaymentIntent carries `application_fee_amount` and `transfer_data.destination`
- [ ] **Double-pay is impossible** — the same `requestId` idempotency key returns the same PaymentIntent, tested by firing the call twice
- [ ] `payment_intent.succeeded` performs booking creation, request update and availability marking in **one** transaction
- [ ] A DB failure after a successful charge logs to Sentry with booking context and does **not** auto-refund
- [ ] Concurrent bookings on the same date: the first transaction wins on `UNIQUE(vendor_id, date)`, the second fails and is logged for manual refund — tested concurrently
- [ ] A webhook that never arrives is reconciled on booking-detail load via `paymentIntents.retrieve()`
- [ ] Cancel >48h → 100% refund; <48h → 50%; COMPLETED → rejected. All three asserted with exact cent amounts
- [ ] Vendor cannot mark complete before the event date
- [ ] A vendor who is not Stripe-onboarded cannot be paid — enforced server-side
- [ ] Money is handled as **integer cents** end to end; no float appears in the payment path
- [ ] The pay button names the amount and the outcome, never a bare "Pay"
- [ ] Double-submit is impossible: the button disables and shows an inline spinner
- [ ] Card errors render **inline under the field**, never as a toast
- [ ] Every error on this path states the money position explicitly, per `40-states.md`
- [ ] **Design parity gate** against frames `05 Checkout`, `21 Checkout declined` and `06 Booking confirmed` at 1440×900, then 1280 / 1024 / 768 / 390, plus `25 Checkout — 1024` at 1024 × 640 with **Due today above the fold**

**Blocked by:** #7, #9

---

### #11: Transactional Email Notifications

**Milestone:** M6 | **Priority:** P2 Medium | **Status:** Deferred — needs a human | **Capabilities:** `core` `auth` `email`
**Blocked by:** #7 | **Can parallel with:** #12

**User value:** As a user, the events I cannot afford to miss reach me by email, in the
product's voice, with the one action I need.

**The event set is not open to interpretation.** It is `NOTIFICATION_TYPES` in
`packages/shared/src/constants` — the same enum the in-app notification centre uses. Email
is a **subset** of it, decided per row below, so the two cannot drift.

| Event | Emails whom | Why / why not |
|---|---|---|
| `new_request` | vendor | The one event where a slow reply loses the work |
| `request_quoted` | customer | They are waiting on a number |
| `request_accepted` | vendor | Their calendar is about to be committed |
| `request_declined` | customer | Dead end; they need to search again |
| `request_expired` | customer | The 48h window closed without a reply |
| `request_cancelled` | vendor | Frees a held date |
| `booking_confirmed` | both | Money moved and a date is locked |
| `booking_completed` | customer | Carries the review prompt |
| `booking_cancelled` | both | Money position must be stated explicitly |
| `payout_sent` | vendor | Money arriving |
| `stripe_onboarding_complete` | vendor | Unblocks taking payment |
| `new_review` | vendor | Not time-critical, but it is about them |
| `new_message` | **no email** | Per-message email is how a product teaches people to mute it. In-app only in MVP; a digest is post-MVP |

**Brand comes from `BRAND_NAME`.** Every template reads it from
`packages/shared/src/constants/brand.ts` — never a literal. The name has already moved
twice and a stale hardcoded name in an email is worse than one in the UI, because it is
archived in an inbox. (An earlier version of this ticket said "VenMatch branding"; that is
exactly the failure the constant exists to prevent.)

**Voice and content rules** come from `31-content-voice.md` and `40-states.md`:

- Subject lines name the thing, not the system: *"June 14 is confirmed"*, not
  *"Booking status update"*.
- Every email that touches money **states the money position explicitly**, even when the
  answer is "nothing was charged".
- One primary action per email, as a button, pointing at the exact surface — never the
  bare homepage.
- No exclamation marks, no "Oops", no apology paragraphs.
- US English per the spelling rule.

**Scope:**

- `apps/api`: a Resend-backed email service, layered route → service → DAO like everything
  else, with one template per row above.
- Integration into the existing service methods that already emit notifications — email
  hangs off the same call site, so an event cannot notify in-app and not by email by
  accident.
- The booking-request expiry check (lazy, on vendor dashboard load) that produces
  `request_expired`.

**Behavioral requirements:**

- Email is sent **after** the database operation commits, never inside its transaction.
- **Email failure must not fail the operation** — log to Sentry and continue. A booking
  that succeeded must not appear to fail because an email bounced.
- Sending is idempotent per event: a retried operation does not double-send.
- Templates render correctly at 390 / 768 / 1440 and in a plain-text fallback.
- No email contains a platform statistic, per `98-post-mvp.md`.
- No email makes a fee claim on a vendor surface, per the deferred fee language.

**Non-goals:** per-message email for `new_message`; a digest; marketing or lifecycle
campaigns; user-configurable notification preferences (that is #16's surface); SMS.

**Edge cases:**

- A user deleted in Clerk between the event and the send — skip, do not crash.
- `booking_cancelled` reaching both parties must state the **same** refund figure in both.
- An expired request that is expired lazily on dashboard load must email once, not once
  per dashboard visit.
- Resend outage: the operation still succeeds and the failure is visible in Sentry.

**Acceptance:**

- [ ] Every row in the table above sends (or deliberately does not send) exactly as specified
- [ ] `new_message` sends **no** email
- [ ] `grep` for a literal brand name in the email templates returns nothing — all read `BRAND_NAME`
- [ ] Every money-touching email states the money position, including when nothing was charged
- [ ] A forced send failure leaves the booking operation successful and logs to Sentry — tested
- [ ] Emails are sent after commit, never inside the transaction
- [ ] A retried operation does not double-send — idempotency tested
- [ ] Lazy expiry emails once per request, not once per dashboard load
- [ ] `booking_cancelled` shows an identical refund figure to both parties
- [ ] Every template renders at 390 / 768 / 1440 and has a plain-text fallback
- [ ] No template contains a platform statistic or a vendor-side fee claim

---

### #12: Review System

**Milestone:** M5 | **Priority:** P1 High | **Status:** Backlog | **Capabilities:** `core` `auth`

**Design:** `design/design-plan/12-vendor-profile.md` (Reviews tab), `03-components.md`. Frame: `03 Vendor profile`.

**Old-design debt:** these surfaces are new, so they are built on Orla tokens and the `03-components.md` vocabulary from the first commit — no `primary-*`, no brand literal, no inline hex. Any pre-Orla file this ticket edits in passing comes across whole rather than part-migrated; anything it cannot clear without leaving scope is named in the Notes column.

**Orla scope — the Reviews tab on frame `03`:** #6b builds the tab and its empty state; this fills it. Overall rating as a large Serif number with gold stars beside a **five-bar distribution chart** with `clay-400` fill. Review cards carry reviewer first name + initial, star row, date, title, body, and an event-type badge. "Show more reviews" **appends — no page numbers**. "Write a review" appears only for a user with a completed booking with this vendor. Star inputs use a **radio-group pattern** for accessibility, never a row of buttons. The prompt reads "How was your experience?", never "Create review".

**User value:** After a completed booking, both parties can leave reviews. Customer reviews are public with star ratings.

**Scope:**
- `apps/api`: Review routes (create, get by booking, get by vendor)
- `apps/api`: Eligibility validation, profanity filter, rating aggregation
- `apps/web`: Review submission modal, review display on vendor profile, rating summary + distribution chart

**Behavioral requirements:**
- Only COMPLETED booking participants can review
- One review per user per booking (unique constraint)
- Customer→vendor: **public**, affects vendor `avg_rating`. Vendor→customer: **not public** — per the resolved question 3 in `99-open-questions.md` it is visible to the customer themselves and to a vendor **only once that vendor has been requested**, surfaced in the messaging context rail. Affects `avg_customer_rating`. Enforcement is server-side; #16 owns the tiered-visibility rule and this ticket must not widen it
- Rating 1-5, content 10-2000 chars, profanity filtered
- Rating recalculation: derived from source data (not increment), idempotent
- **Design parity gate** — the built screen matches its frame in `design/Orla - Screens.dc.html` at 1440×900, verified in a real browser with Playwright per the parity procedure in `design/design-plan/04-laws.md`. Then the desktop review checklist in the same file, then the adaptation checklist at 1280px / 768px / 390px in `design/design-plan/30-responsive.md`

**Implementation details:**

`POST /reviews`:
- Request: `{ bookingId, rating (1-5), title? (max 200), content (10-2000 chars) }`
- Validation: booking status = `completed`, user is customer or vendor on this booking, no existing review by this user for this booking (`UNIQUE(booking_id, reviewer_id)`)
- Review type auto-determined: if reviewer is the customer → `customer_to_vendor`, if reviewer is the vendor's user → `vendor_to_customer`
- **DB transaction:**
  1. Insert `reviews` row
  2. Recalculate derived stats on the reviewed party:
     - For customer→vendor reviews: `UPDATE vendor_profiles SET avg_rating = (SELECT AVG(rating) FROM reviews WHERE vendor_id = :vendorId AND type = 'customer_to_vendor'), review_count = (SELECT COUNT(*) FROM reviews WHERE vendor_id = :vendorId AND type = 'customer_to_vendor') WHERE id = :vendorId`
     - For vendor→customer reviews: same pattern on `users` table for `avg_customer_rating`, `customer_review_count`
  3. Create notification for the reviewed party

Rating recalculation:
- Always derived from source data (`SELECT AVG/COUNT`), never incremented/decremented — this makes it idempotent and safe under concurrent writes
- On review deletion (admin, #15): same recalculation query. If zero reviews remain → `avg_rating = 0`, `review_count = 0`

Profanity filter:
- Use a lightweight word list (e.g., `bad-words` npm package or custom list)
- Check title + content before insert. If flagged → reject with `VALIDATION_ERROR` and message "Review contains inappropriate language"
- Not a hard blocker for MVP — can start with a basic list and refine

`GET /vendors/:slug/reviews?page=1&limit=10`:
- Public customer→vendor reviews, ordered by created_at desc
- Response includes rating distribution: `{ 1: count, 2: count, 3: count, 4: count, 5: count }`

**Edge cases:**
- Whitespace-only content → rejected by Zod (`trim()` + `min(10)`)
- Concurrent reviews from both parties → no race condition (each inserts a separate row, recalculates different derived columns)
- Review for non-completed booking → rejected
- Duplicate review → caught by `UNIQUE(booking_id, reviewer_id)` constraint → return `CONFLICT` error

**Non-goals:** admin moderation (#15); review editing after submission; vendor responses
to reviews, which are post-MVP.

**Acceptance:**

- [ ] Only participants in a **completed** booking can review — enforced server-side
- [ ] One review per user per booking, enforced by `UNIQUE(booking_id, reviewer_id)`; a duplicate returns `CONFLICT`
- [ ] Review type is derived from who the reviewer is, never sent by the client
- [ ] **A vendor→customer review is not publicly readable** — asserted by requesting it as an unrelated vendor and as an anonymous user
- [ ] A vendor who has been requested by that customer **can** read it
- [ ] `avg_rating` and `review_count` are **recomputed from source rows**, never incremented — asserted by a concurrent double-insert test
- [ ] Deleting a review recomputes; zero remaining reviews gives `avg_rating = 0`, `review_count = 0`
- [ ] Rating constrained 1–5; content 10–2000 chars; whitespace-only rejected
- [ ] Profanity filter rejects with `VALIDATION_ERROR` and the specified message
- [ ] `GET /vendors/:slug/reviews` returns the five-bucket distribution
- [ ] "Show more reviews" **appends** — no page numbers anywhere
- [ ] "Write a review" appears only for a user with a completed booking with that vendor
- [ ] Star input uses a **radio-group** pattern, keyboard operable
- [ ] The prompt reads "How was your experience?"
- [ ] **Design parity gate** against the Reviews tab of frame `03 Vendor profile` at 1440×900, then 1280 / 1024 / 768 / 390

**Blocked by:** #10

---

---

### #14: Demo Dataset + Playwright E2E

**Milestone:** M6 | **Priority:** P1 High | **Status:** Backlog | **Capabilities:** all

**User value:** Fully populated realistic marketplace for stress testing. All testing is agentic via Playwright.

**Scope:**
- `packages/db`: `seed:demo` script — deterministic, idempotent full dataset
- 1 admin, 3 customers, 12-15 vendors across all **11** categories
- 29+ bookings across all statuses, conversations with messages, 20+ reviews
- Programmatic Stripe test accounts + Clerk test mode accounts
- 8 Playwright E2E test suites covering all critical user journeys

**Demo data specification:**
- **Users:** 1 admin, 3 customers (varying profiles: new member, active booker, power user with reviews), 12-15 vendors across all **11** categories from `CATEGORY_SEEDS` (at least 1 per category, some in multiple)
- **Vendor profiles:** Realistic business names, bios, cities (mix of NYC, LA, Chicago, Miami, Houston), tags (mix of languages/cultural/dietary), profile images (placeholder URLs or local test images)
- **Packages:** 2-4 per vendor, varying price types and amounts ($500-$15K range)
- **Portfolios:** 3-6 images per vendor (placeholder URLs)
- **Availability:** Random future dates blocked/booked, most dates available
- **Booking requests:** 29+ across all statuses — pending (3), quoted (2), accepted (2), declined (2), expired (2), cancelled (2), confirmed (8), completed (6), disputed (2)
- **Conversations:** 1 per booking request, each with 3-10 messages back and forth
- **Reviews:** 20+ reviews — mix of 3-5 star ratings, realistic content, both customer→vendor and vendor→customer
- **Notifications:** Matching the booking lifecycle events
- **Deterministic:** Use seeded PRNG (e.g., `seedrandom` with fixed seed) so data is identical across runs. Fixed UUIDs for key entities to enable stable Playwright selectors.

**Playwright E2E suites (8):**
1. **Auth flow:** Sign up as customer, sign up as vendor, sign in, role-based redirects
2. **Vendor profile:** Create profile, upload image, select tags, publish
3. **Search + discovery:** Browse categories, apply filters, view vendor profile
4. **Booking request:** Customer requests booking, vendor quotes, customer accepts
5. **Payment:** Customer pays (Stripe test mode), booking confirmed
6. **Messaging:** Send messages, verify real-time updates
7. **Reviews:** Complete booking, leave review, verify rating update
8. **Admin:** Ban user, moderate tag suggestion, view dashboard metrics

**Behavioral requirements:**
- `pnpm --filter db seed:demo` completes in <60s, idempotent (uses `ON CONFLICT` patterns from existing seed functions)
- `pnpm --filter web test:e2e` — all 8 suites pass, E2E tests run at the reference viewport (1440×900) plus 768px and 390px
- Handles missing Clerk/Stripe credentials gracefully (skips external service calls, seeds local DB only)
- Clerk test mode: use `@clerk/testing` package for programmatic sign-in without real OAuth
- Stripe test mode: use `pm_card_visa` test payment method, test webhook events via `stripe trigger`

**Non-goals:** load or performance testing; visual-regression snapshots (the design
parity gate is a human/Playwright comparison against the frames, not a pixel diff);
seeding the Neon `production` branch, which stays empty until launch (**#48**).

**Edge cases:**

- Re-running `seed:demo` over an existing dataset must not duplicate rows.
- A suite must fail loudly if a fixed UUID it selects on has drifted, rather than
  silently selecting nothing.
- Missing Clerk/Stripe credentials must skip external calls, not fail the seed.

**Acceptance:**

- [ ] `pnpm --filter db seed:demo` completes in **<60s** and is idempotent — asserted by running it twice and diffing row counts
- [ ] Deterministic: two fresh runs produce identical data, verified by comparing a hash of key tables
- [ ] All **11** categories from `CATEGORY_SEEDS` have at least one vendor
- [ ] 29+ booking requests covering **every** status in `BOOKING_REQUEST_STATUSES` and `BOOKING_STATUSES`
- [ ] Reviews cover both directions per the resolved asymmetry in `99-open-questions.md` #3 — customer→vendor public, vendor→customer private
- [ ] All 8 Playwright suites pass at 1440×900, and the responsive suites at 1024 / 768 / 390
- [ ] Suites use the fixed UUIDs, not text selectors that copy changes will break
- [ ] Seeding works with Clerk/Stripe credentials absent — external calls skipped, local DB still seeded
- [ ] Derived columns (`avg_rating`, `review_count`) are **recomputed** by the seed, never written directly
- [ ] Seed points only at a non-production branch — it must refuse to run against `production`

**Blocked by:** #12

---

### #15: Admin Portal + Sentry Integration

**Milestone:** M6 | **Priority:** P1 High | **Status:** Backlog | **Capabilities:** `core` `auth` `sentry`

**Design:** `design/design-plan/22-admin.md`. Frame: `13 Admin`.

**Old-design debt:** these surfaces are new, so they are built on Orla tokens and the `03-components.md` vocabulary from the first commit — no `primary-*`, no brand literal, no inline hex. Any pre-Orla file this ticket edits in passing comes across whole rather than part-migrated; anything it cannot clear without leaving scope is named in the Notes column.

**Orla screen `22` — admin:** an operations tool. Same typography and palette, **denser layout** — scannability beats airiness, and the whitespace moves to the gutters.
- The header **inverts to `stone-900`** with a translucent "Admin" chip — an unmistakable signal you're on the ops side of the product. Sidebar 210px: Overview · Vendors · Customers · Bookings · Payments · Reviews (count) · Categories & tags.
- Title row: "Vendors" (Serif 23px) with a count line in `stone-600` ("412 total · 38 awaiting review · updated 2m ago").
- **Filter bar above the table, never a modal**: search input, the active saved filter as a `clay-400` filled button ("Awaiting review (38)"), Category / City / Payouts dropdowns, then "Export CSV" as a right-aligned ghost link.
- Table: `bg-stone-0`, 1px `stone-300`, 12px radius, `overflow:hidden`. Header row `bg-stone-100`, 10.5px uppercase, **fixed**; the body scrolls internally; the page does not scroll. Rows 44px, zebra with `#FDFAF4`. Row-select checkbox first column, overflow menu last. Columns: Business · Category · City · Rating · Bookings · Status · actions, with the standard status pills — Live (sage), Review (gold), Flagged (clay), Paused (stone).
- **Fifteen rows fit at 1440×900. Count them against the real header height before claiming a number** — a table that promises eighteen and clips three is a bug, and this was the most common defect in design review.
- Bulk actions appear only when rows are selected. Overview: four metric cards then Recharts line charts colour-coded by meaning — revenue gold, bookings clay, users steel, completion sage. Every destructive action goes through an AlertDialog naming the consequence.

**User value:** Platform operator has a control plane for oversight + Sentry catches errors.

**Scope:**
- `apps/api`: Admin route group (`/admin/*`), admin service + DAOs, ban middleware
- `apps/api`: Sentry integration (`@sentry/node`)
- `apps/api`: Tag moderation routes — `GET /admin/tag-suggestions` (list pending), `PUT /admin/tag-suggestions/:id` (approve/reject)
- `apps/web`: Admin layout, dashboard (metrics + charts), vendor/user/booking/review management pages, category management
- `apps/web`: Tag moderation page — list pending suggestions with vendor name, suggested tag, category. Actions: Approve (creates tag in `tags` table, sets `resolved_tag_id`, notifies vendor), Reject (with optional admin note), Merge (link to existing similar tag). Shows approved/rejected history.
- `apps/web`: Tag management — view all active tags by category, deactivate tags, edit display names, reorder
- `apps/web`: Sentry integration (`@sentry/nextjs`)
- `packages/db`: Migration for `is_banned`, `banned_at` columns

**Behavioral requirements:**
- Only `role = 'admin'` can access admin routes → others get 403
- Dashboard: total revenue, bookings, active vendors, users, signups, charts (30 days), pending tag suggestions count
- Ban → `is_banned = true`, auto-cancel confirmed bookings with refunds, unpublish profile
- Unban → `is_banned = false`, vendor must re-publish manually
- Review deletion → recalculate vendor avg_rating + review_count
- Tag approve → creates new active tag in `tags` table, auto-assigns to the suggesting vendor, updates suggestion status to `approved`
- Tag reject → updates suggestion status to `rejected`, stores admin note
- Tag merge → if suggestion is near-duplicate of existing tag, link suggestion to existing tag, auto-assign vendor to that tag
- Tag deactivate → soft-remove from selection UI, existing vendor associations preserved but hidden from search
- Sentry: captures unhandled errors, user context, payment errors tagged critical
- **Design parity gate** — the built screen matches its frame in `design/Orla - Screens.dc.html` at 1440×900, verified in a real browser with Playwright per the parity procedure in `design/design-plan/04-laws.md`. Then the desktop review checklist in the same file, then the adaptation checklist at 1280px / 768px / 390px in `design/design-plan/30-responsive.md`

**Tag moderation implementation details:**

`GET /admin/tag-suggestions?status=pending&page=1`:
- Returns suggestions with vendor name, suggested tag name, category, created_at
- Filterable by status (pending/approved/rejected), sortable by created_at

`PUT /admin/tag-suggestions/:id` — actions via `{ action, adminNote? }`:
- **approve**:
  1. Generate slug: `${category}-${slugify(suggestedName)}` (lowercase, strip non-alphanumeric)
  2. Check `tags` table for slug collision → if collision, reject with note "A similar tag already exists: [existing tag name]"
  3. Check `tags` table for `(category, lower(name))` match → if match, treat as merge (see below)
  4. **DB transaction:** Insert new `tags` row (isActive=true, displayOrder=max+1), insert `vendor_tags` row for suggesting vendor, update suggestion (status=approved, resolved_tag_id, resolved_at, admin_note)
  5. Create notification for vendor: "Your tag suggestion '[name]' has been approved"
- **reject**:
  1. Update suggestion: status=rejected, resolved_at=now(), admin_note (required for rejection)
  2. No notification (avoid discouraging future suggestions)
- **merge** (suggestion matches an existing tag):
  1. Admin selects existing tag to merge into
  2. Update suggestion: status=approved, resolved_tag_id=existing tag id, resolved_at, admin_note="Merged with [existing tag name]"
  3. Insert `vendor_tags` row linking suggesting vendor to the existing tag (ON CONFLICT DO NOTHING)
  4. Create notification: "Your suggestion '[name]' matched our existing tag '[existing name]' — it's been added to your profile"

Tag management page:
- Table grouped by category, showing: name, slug, vendor count (from `vendor_tags`), isActive, displayOrder
- Actions: edit display name (updates name + regenerates slug), toggle isActive, drag to reorder (updates displayOrder)
- Deactivate: soft-disable — tag hidden from picker UI, existing `vendor_tags` rows preserved (vendors keep their tags, but tag won't appear in search filters). Show confirmation with vendor count.

**Ban implementation details:**
- `PUT /admin/users/:id/ban` — **DB transaction:**
  1. Set `is_banned = true`, `banned_at = now()` on users table
  2. If vendor: set `is_published = false` on vendor_profiles
  3. Find all `bookings` where this user is customer or vendor AND status = `confirmed` AND event_date > today
  4. For each: cancel booking, process refund via Stripe, create notifications
  5. Revoke Clerk session: `clerk.users.revokeSession(clerkUserId)` or ban via Clerk API
- `PUT /admin/users/:id/unban` — set `is_banned = false`, `banned_at = null`. Vendor must manually re-publish.

**Edge cases:**
- Admin self-ban → rejected (check `actorId !== targetId`)
- Delete only review → `avg_rating` resets to 0, `review_count` = 0 (derived from source data via `SELECT AVG/COUNT`)
- Ban mid-payment → any PENDING/QUOTED/ACCEPTED requests auto-declined, CONFIRMED bookings cancelled with full refund
- Zero data state → zeros and "No data" empty states across all dashboard widgets
- Approving a tag with a name that now conflicts (another admin approved a similar one) → slug collision check on `tags` unique index, reject with note
- Deactivating a popular tag → confirmation dialog shows "This tag is used by X vendors. Deactivating will hide it from the tag picker but won't remove it from existing vendor profiles."
- Concurrent admin actions on same suggestion → first wins (check status=pending before applying action)

**Non-goals:** cohort/retention analytics, automated flag triage, vendor quality scoring
and bulk messaging — all post-MVP.

**Acceptance:**

- [ ] A non-admin gets **403** on every `/admin/*` route — asserted per route
- [ ] An admin cannot ban themselves (`actorId !== targetId`)
- [ ] Ban sets `is_banned`, auto-declines PENDING/QUOTED/ACCEPTED requests, cancels CONFIRMED bookings **with full refund**, and unpublishes the profile — all asserted
- [ ] Unban clears the flag but does **not** auto-republish; the vendor must publish manually
- [ ] Deleting a review **recomputes** `avg_rating`/`review_count` from source rows; deleting the last one yields 0 / 0
- [ ] Tag approve creates an active tag, auto-assigns the suggesting vendor, and marks the suggestion `approved`
- [ ] Tag reject stores the admin note; tag merge links to the existing tag and assigns the vendor
- [ ] Tag deactivate hides it from the picker and from search while preserving existing associations
- [ ] Deactivating a tag used by N vendors shows a confirmation naming N — a real count, read at request time
- [ ] A slug collision on approve is rejected with a note, not silently merged
- [ ] Concurrent actions on one suggestion: first wins, second is rejected on a `status = pending` check
- [ ] Zero-data state renders zeros and "No data" across every dashboard widget — no blank panes
- [ ] **Fifteen rows fit at 1440 × 900** — counted against the real header height, not assumed
- [ ] Table header is fixed, the body scrolls, and the page does not
- [ ] Sentry captures unhandled errors with user context, and payment errors are tagged critical
- [ ] Every status uses the shared pill vocabulary from `03-components.md`
- [ ] **Design parity gate** against frame `13 Admin` at 1440×900, then 1280 / 1024 / 768 / 390

**Blocked by:** #12, #14

---

### #16: Customer Profile + Preferences + History

**Milestone:** M2 | **Priority:** P1 High | **Status:** Done | **Capabilities:** `core` `auth` `storage`

**Design:** `design/design-plan/03-components.md`. The "About [customer]" block this ticket's data feeds is composed in #8's context rail; the customer bookings hub and `/bookings` moved to **#22**.

**Scope boundary:** this ticket owns the customer profile record, preferences, saved vendors, and the history *data* — not the dashboard surface that displays it. Building `/dashboard` or `/bookings` here would collide with #22.

**Old-design debt:** any profile surface this ticket adds is built on Orla tokens from the start — it must not introduce new `primary-*` or brand literals. If it touches `app/suspended/page.tsx` (two `VenMatch` literals), that file comes across whole.

**User value:** Customers have a profile that vendors can evaluate when deciding whether to accept a booking. Customers can manage their preferences, view booking history, and see reviews written about them. Builds trust symmetry — vendors have rich profiles, customers should too.

**Scope:**
- `apps/api`: Customer profile routes — `PUT /users/me/profile` (bio, city, state, budget tier, guest count range), `GET /users/me/profile` (full own profile with stats)
- `apps/api`: Customer public profile route — `GET /customers/:id/profile` (tiered visibility: limited pre-booking-acceptance, full post-acceptance)
- `apps/api`: Customer review history — `GET /customers/:id/reviews` (vendor→customer reviews, public)
- `apps/web`: "My Profile" page in the bookings-hub sidebar — edit bio, city, state, profile photo (reuses upload route from #3), budget tier selector, typical guest count range
- `apps/web`: Budget tier display as `$` / `$$` / `$$$` / `$$$$` with price range labels (Budget: under $500, Mid-range: $500–$2K, Premium: $2K–$10K, Luxury: $10K+)
- `apps/web`: Booking history tab — cards with vendor cover image thumbnails, event dates (display font), status badges, action buttons. Tabs: "Active" (pending/quoted/accepted/confirmed) | "Past" (completed/cancelled/declined/expired). Empty state when no bookings yet.
- `apps/web`: Review history tab — reviews written about the customer by vendors, with star ratings and content. Empty state when no reviews yet.
- `apps/web`: Customer mini-profile card component — inline card shown to vendors on booking request view (used by #7). Shows: first name, member since, booking count, completion rate, recent review excerpts (2-3), bio, email-verified badge.
- `packages/shared`: Customer profile Zod schemas, budget tier enum, profile visibility types

**Tiered visibility (vendor sees customer profile):**
- **Pre-acceptance** (vendor reviewing a booking request): First name only, member since date, booking count, completion rate, 2-3 recent review excerpts, bio, email-verified badge. No photo, no full name, no phone.
- **Post-acceptance** (vendor accepted the booking): Full name, profile photo, phone, email, all vendor→customer reviews, cancellation history.

**Non-goals:**
- No customer-side review submission (handled by #12)
- No notification preferences (handled by #8)
- No saved payment methods (Stripe handles at checkout)
- No ID verification (post-MVP)

**Behavioral requirements:**
- Profile fields are optional — customer can use the platform without filling out profile
- Budget tier shows as dollar signs on FE: $ (Budget) / $$ (Mid-range) / $$$ (Premium) / $$$$ (Luxury), with price range tooltip
- Guest count stored as min/max range (e.g., 50–150)
- Profile photo upload reuses `POST /upload/image` route from #3
- Derived stats (`avg_customer_rating`, `customer_review_count`, `total_bookings_count`, `completed_bookings_count`, `cancelled_bookings_count`) are read-only — updated transactionally by booking and review services in #7, #10, #12
- Booking history shows empty state with "Browse vendors" CTA when no bookings exist
- Review history shows empty state with "Reviews from vendors will appear here after completed events" when no reviews exist
- Mini-profile card renders inline on the vendor's booking request view (no separate customer profile page for vendors to navigate to)
- **Design parity gate** — the built screen matches its frame in `design/Orla - Screens.dc.html` at 1440×900, verified in a real browser with Playwright per the parity procedure in `design/design-plan/04-laws.md`. Then the desktop review checklist in the same file, then the adaptation checklist at 1280px / 768px / 390px in `design/design-plan/30-responsive.md`

**Edge cases:**
- Customer with zero bookings → show "New member" badge instead of stats
- Customer with zero reviews → hide review section, show "No reviews yet"
- Completion rate calculation: `completed / (completed + cancelled)` — if denominator is 0, don't show rate
- Profile photo upload failure → retain previous photo (or Clerk default avatar)
- Tiered visibility: API enforces visibility level based on whether the requesting vendor has an accepted/confirmed/completed booking with this customer
- Bio with only whitespace → rejected by Zod (trim + minLength)

**Design:** `design/design-plan/03-components.md` for the shared vocabulary. The customer bookings hub and its surfaces belong to #22b, not here.

**Affected packages:** `apps/web`, `apps/api`, `packages/shared`

**Acceptance:**

- [ ] Every profile field is optional — a customer with an empty profile can use the platform end to end
- [ ] **Tiered visibility enforced server-side**: pre-acceptance returns first name only, no photo, no full name, no phone
- [ ] Post-acceptance returns the full set — asserted by the same request before and after acceptance
- [ ] A vendor with **no** booking relationship to a customer gets neither tier
- [ ] Derived stats are read-only on this surface and recomputed by #7/#10/#12, never written here
- [ ] Zero bookings → "New member" badge instead of stats
- [ ] Zero reviews → review section hidden with the specified empty copy
- [ ] Completion rate is hidden when `completed + cancelled = 0`, not shown as 0%
- [ ] Budget tier renders as `$`–`$$$$` with the price-range labels
- [ ] Guest count stored as a min/max range
- [ ] Photo upload reuses `POST /upload/image`; a failed upload retains the previous photo
- [ ] Whitespace-only bio rejected by Zod
- [ ] This ticket adds **no** `/dashboard` or `/bookings` surface — that boundary belongs to #22b
- [ ] No new `primary-*` token or brand literal is introduced
- [ ] **Design parity gate** at 1440×900, then 1280 / 1024 / 768 / 390

**Blocked by:** #3, #17 (reuses image upload infrastructure) | **Parallel with:** #4, #9

---

### #17: Environment Contract + Preflight Gate

**Milestone:** M1.5 | **Priority:** P0 Critical | **Status:** Done | **Capabilities:** `core`
**Blocked by:** #3 | **Gates:** every ticket after it

**User value:** As the operator, starting a ticket tells me — before I write any code —
exactly which credentials and services it needs, whether they are configured, and the
literal command to fix each one that is not. Configuration failures stop appearing
mid-feature as opaque SDK errors.

**Problem being solved.** Three symptoms, one cause: nothing owns the environment
variable list.

1. **Four hand-maintained copies drift.** `.env.example`, the Zod schema in
   `apps/api/src/config/env.ts`, `globalPassThroughEnv` in `turbo.json`, and `.env`
   each carry the list. `DATABASE_URL_UNPOOLED` and `NEON_BRANCH` are in `.env` and in
   none of the other three.
2. **Validation checks presence, not validity.** `z.string().min(1)` accepts
   `STRIPE_SECRET_KEY=sk_test_...`, so the placeholder passes startup validation and
   fails later, deep inside a feature.
3. **Prerequisites are unenforceable prose.** #9, #11, and #15 carry `PREREQ:` notes in
   a table cell no tool reads, and #3 shipped needing `storage` with no note at all.

**Scope:**

- `packages/shared/src/env/registry.ts` — the single declarative list. One entry per
  variable: `key`, `capability`, `audience` (`server` | `browser`), `environments`
  (`shared` | `per-environment`), `shape` (RegExp for a real value), `placeholder`,
  `description`, and `setup: { url, steps[] }`.
- `packages/shared/src/env/capabilities.ts` — the `Capability` union
  (`core` | `auth` | `storage` | `stripe` | `email` | `sentry` | `e2e`) and the
  derived capability → variables index.
- `packages/shared/src/env/tickets.ts` — ticket number → required capabilities,
  matching the Capabilities column of the status board.
- `packages/shared/src/env/generate.ts` — renders `.env.example` and the
  `globalPassThroughEnv` array from the registry.
- `packages/shared/src/env/generate.test.ts` — asserts the committed `.env.example` and
  `turbo.json` equal the generated output. This is the drift gate.
- `packages/shared` gains an `./env` subpath export (matching the `./schema` and
  `./testing` pattern in `@vendor-marketplace/db`).
- `packages/preflight` — new `@vendor-marketplace/preflight` workspace package exposing the
  `preflight` binary. Depends on `@vendor-marketplace/shared` and `@vendor-marketplace/db`; nothing
  depends on it, so the one-way `apps → packages` direction is unaffected.
- `apps/api/src/config/env.ts` — build the existing Zod schema from the registry rows
  where `audience === 'server'` instead of restating them, and apply each row's `shape`.
- `apps/web/src/config/env.ts` — new. Validates browser-facing rows at build time in
  `next.config.ts` (where the full `process.env` is available) and exports a typed
  accessor for `NEXT_PUBLIC_*` values. `apps/web` currently validates nothing.
- Root `package.json` — `preflight` and `env:example` scripts.
- Neon: create a `dev` branch, repoint local `.env`, and correct `.env.example`,
  `docker-compose.yml` commentary, `CLAUDE.md`, and the plan's Local Development Setup,
  all of which describe a Docker-Postgres setup that is not in use.

**Behavioral requirements:**

- `pnpm preflight` with no arguments checks `core` and `e2e` only.
- `pnpm preflight --ticket <n>` resolves the ticket to its capabilities and checks only
  those. A ticket that does not declare `stripe` is never blocked on Stripe credentials.
- `pnpm preflight --env production` checks toolchain, environment, and storage against a
  production value set, applying the same `shape` regexes — so a `sk_test_` key
  configured on the production platform fails.
- Every check prints one line: `✓`/`✗`, the check name, and on failure the literal
  command or URL that fixes it, drawn from the registry's `setup` field.
- Output groups by capability, and reports every failure in one run rather than exiting
  at the first — fixing five credentials should take one run, not five.
- Exit code 0 on all-pass, non-zero otherwise.
- `pnpm env:example` rewrites `.env.example` and `turbo.json`'s passthrough list;
  running it twice is a no-op.

**The ten checks:**

| # | Check | Hard-fails when |
|---|-------|-----------------|
| 1 | Toolchain | Node < 20, pnpm ≠ `packageManager`, or Docker not running while a required capability needs a compose service |
| 2 | Environment | A variable for a required capability is absent, equals its placeholder, or fails its `shape` |
| 3 | DB safety | `NEON_BRANCH` resolves to `production` while `NODE_ENV=development` |
| 4 | DB reachability | The pooled URL will not connect |
| 5 | DB migrations | `drizzle/meta/_journal.json` has entries absent from `__drizzle_migrations` |
| 6 | DB seed | Reference data (categories, tags) missing |
| 7 | Object storage | Bucket absent or not readable |
| 8 | Webhook forwarding | A required capability has inbound webhooks and its forwarding CLI is not installed |
| 9 | Browser verification | Playwright browsers not installed, or `.env.e2e.local` absent |
| 10 | Ports | 3000 or 4000 held by a foreign process |

**Non-goals:**

- Gating `pnpm dev`. Feature-scoped checks cannot know which code path a dev server will
  reach, and a dev server that refuses to start over a credential the current work never
  touches trains the operator to bypass the gate — after which it protects nothing.
- Secret scanning and the drift test as *local* gates. The drift test rides in `pnpm test`;
  `gitleaks` belongs on push, where the irreversible step happens. Both are CI concerns.
- Any product feature, and any deployment work (#18–#20).
- Migrating `apps/api` off its current runtime env handling beyond deriving the schema.

**Edge cases:**

- **`.env` absent entirely** → check 2 fails with `cp .env.example .env` rather than a
  stack trace from `dotenv`.
- **A variable is set in the real process environment but not `.env`** → passes.
  `loadEnv()` never overwrites real environment variables, and preflight must read the
  same merged view the apps do, or it will disagree with them.
- **Docker not installed at all** (as opposed to not running) → distinct message; check 1
  must not confuse "no Docker" with "Docker stopped".
- **Migrations pending because the dev branch was just reset** → check 5 fails with
  `pnpm db:migrate`, which is the correct fix, not an error.
- **`NEON_BRANCH` unset while `DATABASE_URL` points at a Neon host** → check 3 must
  resolve the branch from the connection string rather than trusting an absent variable,
  or the guard is trivially bypassed by deleting one line.
- **A registry entry has no `shape`** (a free-form value such as `EMAIL_FROM`) →
  presence and non-placeholder still apply; absence of a shape must not silently skip
  the row.
- **`--ticket` given an unknown number** → fail loudly. Silently checking nothing would
  be the worst possible behaviour for a gate.
- **Two variables share a capability but only one is set** → both reported, not just the
  first.

**Verification:**

- Unit: registry integrity (no duplicate keys; every capability referenced by
  `tickets.ts` exists; every `placeholder` fails its own `shape` — the property that
  makes the gate work, asserted rather than assumed).
- Unit: `generate.ts` output is deterministic and idempotent.
- Integration: the drift test fails when a registry entry is added without regenerating.
- Integration: preflight against a fixture environment with a known-bad value reports
  exactly that value and exits non-zero.
- Manual: `pnpm preflight --ticket 9` on the current machine reports the Stripe
  capability as unconfigured, with the setup URL — the case that motivated the ticket.
- Manual: pointing `.env` at the Neon `production` branch causes check 3 to fail.

---

### #18: API Containerization + Release Readiness

**Milestone:** M4.5 | **Priority:** P0 Critical | **Status:** Done | **Capabilities:** `core`
**Blocked by:** #17 | **Parallel with:** #19

**User value:** As the operator, `apps/api` can run somewhere other than my laptop, and
the platform hosting it can tell the difference between "restart this process" and
"stop sending it traffic".

**Scope:**

- `apps/api/Dockerfile` — multi-stage build for a pnpm workspace.
- `apps/api/.dockerignore`.
- `apps/api/src/modules/health/health.routes.ts` — split `/health` and add `/ready`.
- `packages/db/drizzle.config.ts` and `packages/db/src/scripts/migrate.ts` — prefer
  `DATABASE_URL_UNPOOLED`.
- `packages/shared/src/env/registry.ts` — add `DATABASE_URL_UNPOOLED` (currently in
  `.env` and nowhere else).
- `railway.json` or equivalent service config: probes, restart policy, release command.

**Behavioral requirements:**

*Container*
- Multi-stage: install with the full lockfile → build → `pnpm deploy --filter @vendor-marketplace/api`
  a pruned production tree into a slim runtime stage. The image must not ship
  devDependencies or the rest of the monorepo.
- Runs as a non-root user.
- Binds `HOST=0.0.0.0`. Binding `localhost` inside a container makes the service
  unreachable while every log line looks healthy — the most expensive trivial mistake
  available here.
- Handles `SIGTERM` by closing the Fastify instance, so deploys drain in-flight
  requests instead of dropping them.
- `docker build` succeeds from a clean checkout with no network access to the host.

*Probes*
- `GET /health` — liveness. No I/O of any kind. `200 { status, timestamp }`.
- `GET /ready` — readiness. Round-trips the database *and* object storage, reporting
  each separately: `{ status, database, storage, timestamp }`. Answers `503` when either
  is down, so the platform withholds traffic rather than routing into failures.
- Neither requires auth. Both are excluded from rate limiting — a limiter that throttles
  the health probe takes the service down by itself.

*Migrations*
- `drizzle.config.ts` and `migrate.ts` use `DATABASE_URL_UNPOOLED` when present and fall
  back to `DATABASE_URL` only when it is absent. Neon's pooled endpoint is PgBouncer in
  transaction mode; Drizzle's migrator takes a session-level advisory lock and issues
  DDL, neither of which survives a pooler that does not pin sessions. It succeeds often
  enough to look correct and fails non-deterministically under concurrency.

**Non-goals:** provisioning any production account (#19); the deploy workflow (#20);
autoscaling or multi-region.

**Edge cases:**

- **Storage reachable but the bucket is missing** → `/ready` reports `storage: "down"`.
  A credentials check that only proves the endpoint answers would pass here and is not
  sufficient.
- **`/ready` called while the database is failing over** → returns `503`, does not throw,
  does not hang. It needs its own short timeout, well below the platform's probe timeout,
  or a stalled dependency turns a readiness failure into a probe timeout and a restart
  loop.
- **Both `DATABASE_URL_UNPOOLED` and `DATABASE_URL` absent** → migrate fails with a
  message naming both, not a `undefined` connection-string error.
- **`pnpm deploy` and workspace `link:` protocol** — the pruned tree must resolve
  `@vendor-marketplace/shared` and `@vendor-marketplace/db` from their built `dist/`, so `^build` must have
  run. A container that builds but crashes on a missing `dist/` at start is the expected
  failure if this is wrong.
- **Probe endpoints and CORS** — probes are server-to-server and must not depend on
  `WEB_URL` being correct.

**Verification:**

- Unit: config selects the unpooled URL when both are present; falls back when only one
  is; fails with a clear message when neither is.
- Integration: `/health` returns 200 with the database stopped (liveness must not depend
  on it); `/ready` returns 503 in the same condition, naming `database`.
- Integration: `/ready` returns 503 when the storage bucket is unreachable, naming
  `storage`.
- Manual: `docker build` from a clean checkout, then `docker run` with local env, then
  `curl /health` and `curl /ready` — both correct.
- Manual: `docker stop` drains rather than drops an in-flight request.

---

### #38: Tab Identity — Orla favicon and the title it sits beside

**Milestone:** M3 | **Priority:** P1 High | **Status:** Done | **Capabilities:** `core`
**Blocked by:** None

**User value:** the tab, the bookmark and the history entry all say Orla — with
the product's own mark, and a title short enough to survive a narrow tab.

**Requested directly on 2026-08-27.** Both halves are visible on every page.

---

**Half (a) — the favicon is still Next's.**

`apps/web/src/app/favicon.ico` is 25,931 bytes and has not been touched since
**abd3d0d**, the commit that scaffolded the app shell. It is the Next.js starter
icon. Every browser tab, bookmark, history row and pinned-tab tile therefore
shows Next's mark on a product that has had its own since #21.

This needs no design work — **the contract already specifies it**:

- `design/design-plan/02-brand-and-logo.md:31-37` gives the sizes: app icon on a
  52px tile at `r=12` with D=24, favicon 32/16 at D=16/14.
- `LOGO_SIZES` in `apps/web/src/components/brand/logo.tsx` already carries
  `favicon: 16` and `appIcon: 24`.
- `variant="mark"` exists **for this caller** — its own doc comment says "The
  favicon and the app icon use it, because below 16px the wordmark stops being
  legible."

So the mark is two equal circles overlapping by 45% of D, `clay-400` fill and a
`stone-900` stroke at 8% of D. The `mono` colourway exists for one-colour
contexts and is the safer choice at 16px, where an 1.3px stroke disappears.

**Next.js resolves these from `app/`** — `icon.svg`, `apple-icon.png`, and
`favicon.ico` — so this is a file-placement question, not a `<head>` one. An
SVG icon is preferred: the mark is two circles and a stroke, it scales to every
tile without a second asset, and it can carry the dark-mode variant.

**Do not** hand-draw a second copy of the mark. Whatever ships must derive from
the same ratios `logo.tsx` holds, or the two drift the next time the mark moves.

---

**Half (b) — the landing title is the only one off-pattern.**

Every page composes its title through `pageTitle()` — `Find a vendor · Orla`,
`Your storefront · Orla`, `Packages · Orla`. The landing does not: it sets

```
title: { absolute: `${BRAND_NAME} — book event vendors without the back-and-forth` }
```

which is **51 characters**. A browser tab shows roughly 15-25 before truncating,
so what a user actually reads on a normal tab is `Orla — book ev…` and on a
pinned tab, nothing but the favicon — the half this ticket is also fixing.

The same 51-character literal is repeated **three times** in that one metadata
block: `title.absolute`, `openGraph.title` and `twitter.title`. `brand.ts` opens
by saying the name "lives here and no component, page title, or email template
may render it from a literal"; the tagline beside it deserves the same rule.

**The replacement string is a voice decision, not a rendering one** — agree it
before building. The candidates:

| Option | Tab reads | Note |
| --- | --- | --- |
| `Orla` | `Orla` | Matches the root layout default; says nothing |
| `Book event vendors · Orla` | `Book event ven…` | Matches every other page's pattern |
| `Orla · Book event vendors` | `Orla · Book ev…` | Brand first, survives truncation |

The long form is still right for the **share card**, where there is room — so
whatever is chosen, `openGraph.title` and `twitter.title` may keep the sentence
while `title` gets the short one. Hoist the sentence to a named constant either
way.

**Non-goals:**

- `robots.ts`, `sitemap.ts`, `opengraph-image`, `manifest.ts` — all of that is
  **#30**, which owns share metadata and crawlability. This ticket is the tab:
  the icon in it and the text beside it. If #30 lands first, this becomes its
  icon half.
- No change to `pageTitle()` itself, and no change to any other page's title.

**Behavioral requirements:**

- `/favicon.ico` and the `app/` icon route serve the Orla mark, not Next's.
- The mark renders legibly at 16px — verified as an image, not by trusting SVG.
- The landing `<title>` is under 30 characters.
- The tagline sentence exists once in the source.

**Acceptance:**

- [ ] `shasum` of the shipped icon differs from the `abd3d0d` favicon
- [ ] Every page's `<title>` is under 30 characters, asserted in a test
- [ ] The landing title composes through the same helper as every other page
- [ ] Playwright reads the tab title and the resolved icon URL on `/` at 1440x900
- [ ] The icon is verified on Vercel, not only locally

---

### #19: Production Environment Provisioning

**Milestone:** M4.5 | **Priority:** P0 Critical | **Status:** Deferred — needs a human | **Capabilities:** all
**Blocked by:** #17 | **Parallel with:** #18 | **Schedule after:** #10

**User value:** As the operator, production has its own credentials for every service,
verified by the same gate that checks my local machine — so the first real user does not
discover the configuration mistakes.

**Note on shape.** This ticket is almost entirely external account configuration rather
than repository code. Its deliverable is a provisioned environment plus a passing
`pnpm preflight --env production`, not a diff. It is a ticket because it has a
verifiable outcome and because leaving it implicit is how launches slip.

**Why every value is new.** Development and production do not share these. Reusing a
development value fails *silently*, which is what makes this worth a checklist:

| Reused value | Symptom |
|---|---|
| Clerk dev keys | Production authenticates against the development user pool; sessions break on the real domain |
| Clerk dev webhook secret | Every production webhook fails signature verification — `users` rows are never created, and no error reaches the UI |
| Stripe test keys | Real bookings charge nothing, or test cards are accepted in production |
| Stripe dev webhook secret | Payment confirmations never land; customers are charged with no booking record |
| Dev `DATABASE_URL` | Production writes to the dev branch |
| Dev `S3_*` | Uploads succeed into a bucket nothing serves |

**Scope — the provisioning checklist** (mirrored in the plan's Deployment section):

*Neon* — `production` branch as deploy target; pooled string → `DATABASE_URL`; direct
string → `DATABASE_URL_UNPOOLED` on Railway and in GitHub Actions secrets.

*Clerk* — create the **production instance** (separate instance, separate user pool);
`pk_live_`/`sk_live_` to Vercel and Railway; production domain + DNS records; register
the webhook at `https://api.<domain>/webhooks/clerk`; copy **that endpoint's** signing
secret to `CLERK_WEBHOOK_SECRET`.

*Stripe* — activate the account; enable Connect (Express) in **live** mode; live keys to
Railway and Vercel; register the webhook at `https://api.<domain>/webhooks/stripe`
subscribed to `account.updated`, `payment_intent.succeeded`, `charge.refunded`; copy
**that endpoint's** signing secret; confirm `STRIPE_PLATFORM_FEE_RATE` matches the
commission in the plan's §6.

*Cloudflare R2* — production bucket; scoped API token → `S3_ACCESS_KEY_ID` /
`S3_SECRET_ACCESS_KEY`; public domain → `S3_PUBLIC_URL`; CORS allowing uploads from the
production web origin.

*Resend* — verify the sending domain (DKIM + SPF); production key → `RESEND_API_KEY`;
`EMAIL_FROM` on the verified domain.

*Sentry* — separate projects for `apps/web` and `apps/api` → DSNs; `SENTRY_AUTH_TOKEN`
for release creation and sourcemap upload.

*Platform + DNS* — Vercel project linked, env set, domain attached; Railway service from
`apps/api/Dockerfile` with `/health` and `/ready` probes; `WEB_URL` / `API_URL` /
`NEXT_PUBLIC_API_URL` set to production origins on both platforms (API CORS is derived
from `WEB_URL`); DNS for both subdomains.

**Behavioral requirements:**

- `pnpm preflight --env production` passes against the production value set.
- A real sign-up on the production domain creates a `users` row in the production
  database — the end-to-end proof that the Clerk instance, its webhook endpoint, and its
  signing secret all match.
- A Stripe test event delivered to the production endpoint verifies successfully.
- An uploaded image is retrievable through `S3_PUBLIC_URL`.

**Non-goals:** the deploy workflow (#20); DNS provider migration beyond pointing records;
Stripe account activation review time, which is outside our control and should be started
early for that reason.

**Edge cases:**

- **Resend before domain verification** delivers only to the account owner. Testing with
  your own address gives a false pass; verify with a second address.
- **Stripe live-mode activation is a review, not a toggle** — it can take days. Start it
  before the rest of M4.5 or it becomes the critical path.
- **Clerk production instances require DNS records** that must propagate before the
  instance works. Not instant.
- **R2 CORS omitted** → uploads fail only from the browser, and only in production, while
  every server-side test passes.
- **Secrets pasted into the wrong platform** — `CLERK_SECRET_KEY` belongs on the API, not
  in the Vercel client bundle. Any `NEXT_PUBLIC_` prefix on a secret publishes it; the
  registry's `audience` field is the authority on which side each value belongs.

**Acceptance:**

- [ ] `pnpm preflight --env production` passes against the production value set
- [ ] A real sign-up on the production domain creates a `users` row in the **production** database — the end-to-end proof that the Clerk instance, its endpoint and its signing secret all agree
- [ ] A Stripe test event delivered to the production endpoint verifies successfully
- [ ] An uploaded image is retrievable through `S3_PUBLIC_URL` **from a browser**, proving CORS
- [ ] Resend verified with a **second** address, not the account owner's — the owner-only path gives a false pass
- [ ] Every value is production-specific; no development key appears in the production set — checked against the table above, row by row
- [ ] No secret carries a `NEXT_PUBLIC_` prefix; each value sits on the side its `audience` field in the registry specifies
- [ ] `STRIPE_PLATFORM_FEE_RATE` matches the commission in the plan's §6
- [ ] Stripe live-mode activation **started early** — it is a review, not a toggle, and it is the likeliest critical path
- [ ] Deploy target is the Neon `production` branch, and it is re-seeded per **#48** before launch

---

### #20: Deploy Pipeline

**Milestone:** M4.5 | **Priority:** P0 Critical | **Status:** Backlog | **Capabilities:** `core`
**Blocked by:** #18, #19

**User value:** As the operator, merging to `main` ships — migrations first, both
services after, and a failed readiness check stops the release instead of leaving a
half-deployed system.

**Scope:**

- `.github/workflows/deploy.yml` — runs on push to `main`, gated on `ci.yml` succeeding.
- `.github/workflows/ci.yml` — add `gitleaks` secret scanning.
- GitHub Actions secrets: `DATABASE_URL_UNPOOLED`, `RAILWAY_TOKEN`, `VERCEL_TOKEN`,
  Vercel org/project IDs.
- Documentation of the release path in `CLAUDE.md`.

**Behavioral requirements:**

```
migrate (unpooled) → deploy api (Railway) → deploy web (Vercel) → poll GET /ready
```

- **Migrations run first, before either deploy.** The schema must be ahead of the code
  that reads it. This makes every migration necessarily backwards-compatible with the
  currently-running release — additive columns, no destructive rename in a single step —
  which is the discipline that makes zero-downtime deploys possible. Adopt it at the
  first deploy rather than discovering it during an outage.
- **Migrations use `DATABASE_URL_UNPOOLED`.** The workflow supplies only the unpooled
  URL to that step, so a regression cannot silently route DDL through the pooler.
- **A failed migration aborts the run** before anything deploys.
- **The smoke check polls `GET /ready`, not `/health`.** Liveness passes while the
  database is unreachable; readiness is what would catch a broken connection string.
  Poll with a bounded timeout and fail the workflow on timeout.
- **`gitleaks` runs on every push.** `.env` is gitignored, but gitignore protects only
  against the accident it anticipates — a credential pasted into a test fixture, a
  migration, or a commit message is not covered. This is the one failure that cannot be
  repaired locally: once pushed, the credential must be rotated. Gate it where the
  irreversible step happens.
- The workflow never prints a secret, including in a failure path.

**Non-goals:** rollback automation and preview environments (recorded as deferred
decisions D6 and D7 in the plan); blue-green or canary releases.

**Edge cases:**

- **Two merges in quick succession** → concurrency group on the workflow so deploys
  serialize. Two concurrent migration runs against one database is the failure this
  prevents.
- **Migration succeeds, API deploy fails** → the database is ahead of the code. This is
  survivable precisely because migrations are backwards-compatible; the runbook is
  "re-run the deploy", not "roll back the migration".
- **The smoke check fails** → the workflow fails loudly. It does not auto-rollback (D6),
  so the failure must be unmissable rather than a red mark in a log.
- **`ci.yml` skipped or cancelled** → treated as not-passing. A gate that treats "did not
  run" as success is not a gate.
- **A first deploy against an empty production database** → migrations apply from zero;
  reference seed data must be applied too, or `/ready` passes while the app is unusable.

**Acceptance:**

- [ ] Order is exactly `migrate → api → web → poll /ready`; a failed migration aborts **before** any deploy
- [ ] A deliberate bad migration on a scratch branch aborts the run — tested, not assumed
- [ ] Migrations receive **only** `DATABASE_URL_UNPOOLED`, so DDL cannot route through the pooler
- [ ] The smoke check polls `GET /ready` with a bounded timeout, and a **timeout fails** the workflow
- [ ] A deliberately broken `DATABASE_URL` on the API fails the workflow at the poll step
- [ ] `gitleaks` flags a planted fake credential in a test fixture
- [ ] A concurrency group serializes deploys — two rapid merges do not run two migrations at once
- [ ] `ci.yml` skipped or cancelled is treated as **not passing**
- [ ] A first deploy against an empty production database applies migrations from zero **and** the reference seed, so `/ready` cannot pass on an unusable app
- [ ] No secret is printed in any path, including failures
- [ ] The release path is documented in `CLAUDE.md`
- [ ] **#35 is retired** once this lands — it is explicitly interim
- [ ] End to end: a trivial merge to `main` reaches production and the smoke check passes

### #33: Front-Door Resilience — reference reads must degrade, not 500

**Milestone:** M3 | **Priority:** P0 Critical | **Status:** Done | **Capabilities:** `core`
**Blocked by:** None

**User value:** As a visitor, a partial API failure costs me the section that failed, not
the whole site. The front door still renders its search bar and I can still reach a vendor.

**This is not hypothetical.** On 2026-08-27 the API returned 500 on every route for
roughly 19 hours. Every web route returned 500 with it — landing, search, sign-in,
sign-up — because `getCategories` propagates its `ApiClientError`. `getFeaturedVendors`
came through the same outage untouched, and its docstring already states the rule the
other readers ignore: *"the front door must still render its search bar when one
section's data is unavailable"*. The fix is to generalise the instinct that is already
in the file.

**Scope:**

- `apps/web/src/lib/vendor-data.ts` — `getCategories` and `getActiveTags`.
- The header search consumer, which since b402b0b runs on **every** route and is what
  turned one failed section into a site-wide outage.
- Any navigation that derives its links from the category list.

**Behavioral requirements:**

- **An `ApiClientError` from `/categories` or `/tags` never propagates out of a public
  route render.** These are public reference reads with no session; there is no 401/403
  case to preserve, unlike the protected vendor reads.
- **"Unavailable" and "empty" are different states and must not collapse into one.** An
  empty taxonomy is a real, if unlikely, product state; an unreachable API is a failure.
  A reader that returns `[]` for both makes the outage invisible.
- **The failure is still reported.** Degrading the surface must not swallow the error —
  log it server-side so #15's Sentry integration has something to attach to. A silent
  fallback converts a loud outage into a slow, unexplained decline in conversion.
- **The degraded surface follows `40-states.md`.** Steel is information, red is failure,
  and gold is never used here. Compose #28's state vocabulary once that ticket lands;
  until then the degraded render must still not invent an idiom `40-states.md` forbids.
- **Prefer stale over nothing.** Both reads already carry `revalidate: 3600`. A
  revalidation that fails should keep serving the last good taxonomy rather than
  replacing it with an error state.

**Non-goals:** the protected vendor reads, where the 401 → `/sign-in` and 403 →
`/suspended` redirects are correct and must stay; a general-purpose retry or circuit
breaker; the error boundaries themselves, which are #28.

**Edge cases:**

- **The header renders with no categories** → it must still render its search input.
  The header is chrome on every route; it cannot be the thing that takes a route down.
- **`/search` with no taxonomy** → the query still runs; the refine chips degrade.
- **A revalidation failure on a warm cache** → serve stale, do not poison the cache with
  an error state that then persists for the full hour.
- **The API returns 200 with a malformed body** → the Zod parse fails, not the request.
  That path must degrade the same way, not throw.

**Verification:**

- Point `API_URL` at a closed port and confirm `/`, `/search`, `/sign-in` and `/sign-up`
  all render **200** with a usable search bar. This exact scenario returned 500 on
  2026-08-27 and is the regression under test.
- Restore the URL and confirm the taxonomy returns without a restart.
- A test that asserts the degraded path is distinguishable from a genuinely empty
  taxonomy.
- Playwright at 1440×900 against frames `01` and `02` in both the healthy and the
  degraded state.

---

### #34: API Runtime Target — Vercel serverless vs container, and its limits

**Milestone:** M4.5 | **Priority:** P0 Critical | **Status:** Done | **Capabilities:** `core` `storage`
**Blocked by:** #18

**User value:** As the operator, the API has **one** documented runtime, and the limits
that runtime imposes are either honoured in code or removed by choosing the other one.

**The conflict is live.** #18 built a container image and #20's pipeline specifies
`deploy api (Railway)`. Production runs on **Vercel**, root directory `apps/api`,
framework preset **Fastify** — which is why the service needed the `(req, res)` default
export added on 2026-08-27 (e13363d). Two deployment stories for one service, and the
Vercel one was never designed for, which is how it shipped broken and stayed broken.

**Scope:** the decision, recorded in `vendor-marketplace-decisions.md`; then whichever
branch follows from it. Touches `apps/api/src/server.ts`, `MAX_UPLOAD_BYTES`, the
rate-limit strategy, and `createDatabase` pool sizing.

**Behavioral requirements — if Vercel is chosen:**

- **Uploads must fit the platform.** Vercel caps a function request body at **4.5MB**;
  `MAX_UPLOAD_BYTES` is **10MB**. Today a 6MB upload fails in production and passes every
  test, because the route suites use `app.inject()` and never cross the boundary. Either
  lower the constant *and* the UI copy that quotes it, or move uploads to presigned
  direct-to-R2 `PUT`s so the function never carries the bytes. **Presigned is the better
  answer** and composes with #29, which already owns upload states.
- **The rate limiter must be honest.** `@fastify/rate-limit` is in-memory, so on
  serverless it limits per instance, which is not a limit. Either back it with a shared
  store or document explicitly that it is per-instance defence only.
- **Pool sizing must suit the invocation model.** `createDatabase` opens `max: 10` per
  instance. Confirm `DATABASE_URL` is Neon's **pooled** string and consider dropping
  `max` for the serverless path.
- **Nothing relies on graceful shutdown.** `app.close()` and `client.end()` never run on
  serverless; confirm no cleanup is load-bearing.

**Behavioral requirements — if the container is chosen:**

- Point `API_URL` and `NEXT_PUBLIC_API_URL` at it and **delete the Vercel `api`
  project**, so there is no second origin serving a stale build.
- The `(req, res)` default export in `server.ts` becomes dead code — remove it and its
  tests rather than leaving a second entrypoint nobody exercises.

**Non-goals:** multi-region; the deploy pipeline itself (#20).

**Edge cases:**

- **A 6MB upload** — the concrete failure today.
- **Concurrent cold starts** — the memoised bootstrap promise must not open several pools.
- **Neon scale-to-zero** — the first query after idle must resolve inside the function
  timeout.

**Verification:**

- A 6MB upload succeeds end to end against the deployed URL, not `app.inject()`.
- A burst of concurrent requests behaves as the chosen rate-limit strategy documents.
- `/ready` reports `database: up` under concurrency after an idle period.

---

### #35: Post-Deploy Smoke Check — catch a green build that serves 500s

**Milestone:** M4.5 | **Priority:** P1 High | **Status:** Done | **Capabilities:** `core`
**Blocked by:** None

**User value:** As the operator, I learn from CI that production is broken, not from
looking at the site.

**Why it exists.** The API served **500 on every route for ~19 hours** while Vercel
reported the deployment **Ready**. A build that compiles but never invokes a route cannot
see a broken runtime export. Both failures on 2026-08-27 — first no default export, then
a default export that returned the app instead of answering, so every request hung to the
platform's 300s ceiling — would have been caught by a single request to `/ready`.

**Scope:** a check that runs after a **production** deploy of either project. A GitHub
Actions workflow on `main` or a Vercel deploy hook; whichever lands, it is interim and
retired by #20.

**Behavioral requirements:**

- **Polls `GET /ready`, not `/health`.** Readiness round-trips the database and storage;
  liveness can pass while a dependency is unreachable.
- **Bounded timeout, and a timeout is a failure.** The second outage this session
  presented as a hang, not an error — a check that waits forever reproduces the bug
  instead of reporting it.
- **The web check asserts content, not just status.** A 200 that renders an error
  boundary is still a broken front door. **This becomes essential once #33 lands:** after
  reference reads degrade gracefully, the site returns 200 during an API outage, so
  status alone stops being evidence of health. Assert on a string the page can only
  render with real data.
- **Fails loudly.** No auto-rollback — that is deferred decision D6.

**Non-goals:** rollback automation; continuous uptime monitoring; replacing #20, which
supersedes this once its gated pipeline exists.

**Edge cases:**

- **A deploy that is still building** → poll with a bounded retry rather than checking
  once and reporting a false failure.
- **Only one of the two projects redeploys** → the check must cover whichever changed.

**Acceptance:**

- [ ] The check polls `GET /ready`, not `/health`
- [ ] A **timeout is a failure** — verified by pointing the check at a deliberately hanging endpoint
- [ ] The check is bounded and retries while a deploy is still building, rather than reporting a false failure
- [ ] The web check asserts on a string the page can only render with **real data**, not just HTTP status
- [ ] Breaking the API export on a scratch deploy fails the check
- [ ] A good deploy passes
- [ ] With #33 landed, stopping the API still fails the **web** check even though the page returns 200
- [ ] The check covers whichever project redeployed, including when only one did
- [ ] It fails loudly and does **not** attempt rollback (deferred decision D6)
- [ ] Retired by #20 when its gated pipeline lands — recorded as interim in the ticket

---

### #36: Landing Category Cards — real photography

**Milestone:** M3 | **Priority:** P1 High | **Status:** Done | **Capabilities:** `core`
**Blocked by:** None

**User value:** As a visitor, the six category cards show me what each category
actually looks like, instead of an abstract glyph that tells me nothing.

**Frame `01` was revised on 2026-08-27** and the local bundle now carries the revision.
The card changed shape, not just fill:

| | Before | After |
|---|---|---|
| Card | `padding:14px; border-radius:14px` | `border-radius:14px; overflow:hidden` |
| Media | 36px `#F7E7E0` circle holding a geometric `#A34A28` glyph | `<img>` at `width:100%; height:94px; object-fit:cover` |
| Text | inside the card padding | inner `<div style="padding:11px 13px 13px">` |

`overflow:hidden` on the card is what makes the radius clip the photograph — without
it the image corners escape the card.

**The imagery rule this establishes.** The six category images are **the only
photography the platform owns**. Every vendor-side cover, portfolio item and avatar
stays a labelled placeholder, because that photography arrives from the vendor at
publish time. A ticket that "fixes" a hatched vendor placeholder by dropping stock art
into it has broken this rule, not satisfied it. The frame's own note now says so.

**Scope:**

- `apps/web/src/app/page.tsx` and the category card component.
- The six images: `beauty`, `catering`, `florals`, `music`, `photography`, `venues` —
  already in the design bundle at `design/uploads/`, verified byte-identical to the
  design project.
- **`design/design-plan/10-landing.md` is already corrected** — its category-row
  section now specifies the photograph, the `overflow-hidden` clip, and the
  platform-owned-imagery rule, and the same correction was pushed to the design project
  so the frame and the plan no longer disagree. Read it as spec; no doc work here.

**Asset placement — read this before moving files.** The six images currently sit in
`apps/web/public/marketing/`, which is **gitignored** (e9d8a56) precisely because that
directory is an unreferenced staging area whose contact sheet would otherwise be served
publicly. These six are different: they are referenced, platform-owned, and must ship.
Move them to a tracked path beside the existing `public/stock/` — `public/categories/`
is the obvious choice — rather than un-ignoring `public/marketing/` wholesale. Overlaps
**#32**, which owns the wider question of which demo imagery is tracked; settle the two
together so one directory does not get both rules.

**Behavioral requirements:**

- Cards render through `next/image` with the crop the frame draws — 94px tall, cover,
  clipped by the card radius.
- **Alt text is empty.** These are decorative: the category name sits directly beneath
  each image, so a description would be read twice. This matches `StockPhoto`'s existing
  and documented reasoning.
- The images are local to `public/`, so no remote loader pattern is needed and the page
  renders offline.
- Only the **first six by `displayOrder`** appear, unchanged from today. If a seventh
  category is promoted, it needs an image before it can be promoted — the card has no
  glyph fallback any more.

**Non-goals:** vendor covers, portfolio imagery and avatars, all of which stay
placeholders; the eleven-category grid on `/search`; per-category counts or from-prices,
which stay deferred.

**Edge cases:**

- **A category with no image** → this is now a content gap, not a styling one. Decide
  and document the behaviour rather than letting a broken `<img>` ship.
- **A slow image on the hero fold** → the category row's top edge must stay visible in
  the first 836px, which is an existing acceptance criterion on this screen.

**Verification:**

- Playwright at 1440×900 against frame `01`, on all five parity axes. The card is a
  **composition** change, so layout and style are both in scope, not just the fill.
- The category row's top edge is still inside the first 836px.
- The two acceptance boxes added to `10-landing.md` both pass: every card carries its
  photograph, and no vendor-side cover, portfolio item or avatar has been given stock art.

---

### #57: Compact search header — three parity gaps found during #37

**Milestone:** M4.5 | **Priority:** P3 Low | **Status:** Done | **Capabilities:** `core`
**Blocked by:** None

Found 2026-08-28 while verifying #37 against frames `02`, `17`, `18` and `25`. None
was in #37's scope; all three are recorded rather than fixed eagerly.

1. **The bar does not scale between 1024 and 1440.** It measures 45px at both, where
   the frames draw 42px at 1440 and 40px at 1024. The circle was left at 32px to match,
   because scaling the glyph inside a bar that does not scale would look worse than
   either. Fix the bar and the circle together or not at all.
2. **The circle has no loading state.** Frames `17` and `25` put a spinner in it while a
   search is in flight; ours keeps the magnifier. `SearchScreen` owns `isLoading` and
   `HeaderQuery` is rendered by the site header, so nothing carries the flag across that
   boundary today. Needs shared state, which is header chrome — see **#26**.
3. **The date label disagrees across frames.** Ours says "Event date", matching frame
   `02`; frames `17`, `18` and `25` say "Date". The frames contradict each other, so
   this needs a decision before it needs code.

**Acceptance:**

- [ ] The compact bar and its circle match the frame at both 1024 and 1440
- [ ] The circle shows the spinner while a search is in flight, and the magnifier otherwise
- [ ] One date label is chosen, recorded as a decision, and used in every frame's implementation

### #58: The booking request draft is not saved anywhere

**Milestone:** M4.5 | **Priority:** P2 Medium | **Status:** Done | **Capabilities:** `core`
**Blocked by:** None

**Found 2026-08-28** while building #39's session-expired dialog, which cannot ship
without this.

**User value:** As a customer part-way through a booking request, I do not lose what I
typed because I reloaded, navigated back, or was signed out.

**Context.** `booking-request-screen.tsx` holds the whole draft in component state. There
is no `localStorage`, no server draft, nothing. Every one of these loses it: a reload, a
back-navigation, an expired session, a crashed tab. The form is long — occasion, date,
guest count, custom details — so this is not a small loss.

It also blocks **#39**: frame `26`'s session-expired dialog reads "Your draft request is
saved — signing back in returns you to it." Shipping that sentence today would state
something untrue at the exact moment the customer is most likely to check it.

**Scope:**

- Persist the draft **per vendor**, so two requests in progress do not overwrite each other.
- Restore on mount, and only when the stored draft is for the vendor being viewed.
- Clear it on a successful send, and on an explicit abandon.

**Behavioral requirements:**

- A restored draft is **announced**, not silently filled — a form that fills itself is
  unsettling, and the customer needs to know why the fields are not empty.
- Storage failure is never an error the customer sees: a private window with storage
  blocked should degrade to today's behaviour, not break the form.
- Nothing sensitive beyond what the customer typed; no ids or tokens.

**Edge cases:**

- A stored draft for a vendor who has since unpublished.
- A stored draft older than the event date it names.
- Two tabs open on the same vendor.

**Acceptance:**

- [ ] A reload mid-request restores every field, and says that it did
- [ ] Two vendors' drafts do not collide
- [ ] A successful send clears the draft, so the next request starts empty
- [ ] Storage being unavailable degrades silently to the current behaviour
- [ ] #39's session-expired dialog can then state that the draft is saved, truthfully

---

### #37: Clay Search Button — pill vs circle discipline

**Milestone:** M3 | **Priority:** P2 Medium | **Status:** Done | **Capabilities:** `core`
**Blocked by:** None

**User value:** As a visitor, the search control reads as a button everywhere it
appears, and the one place it shrinks to an icon still says what it does.

**The rule — and it is deliberately not "one shape everywhere":**

| Context | Control |
|---|---|
| The bar is the page's **primary object** — the hero, screen `02`'s search bar, mobile full-width | Labelled clay **Search** pill |
| **Compact secondary header bars**, where a text label would cost the date field its width | Clay circle with a **magnifier glyph** |

**The defect was never the two shapes.** `03-components.md` already documented this
split correctly. The actual inconsistency was that the circles in the **loading** and
**no-results** frames carried no glyph at all, so they read as decoration rather than as
a control — and the film's hero showed a bare ring instead of the documented pill.
Frame `18` is revised in the local bundle: its circle now holds a 11px ring with a 5px
45° stem in `#FFFDF9`, centred via flex.

**Scope:**

- The search bar component shared by the hero and `/search`.
- The compact header variant introduced by b402b0b, which is the one legitimate circle.
- Any loading or empty state that renders a search control — overlaps **#29**, which
  owns the search states themselves; if #29 lands first, this becomes its parity check.
- Overlaps **#26** on header chrome; the header's search control is the shared surface.

**Behavioral requirements:**

- **A circle without a glyph is a defect.** An icon-only control with no icon is not a
  reduced control, it is an unlabelled one.
- The icon-only variant carries an accessible name — the visual label is what was
  dropped, not the semantic one.
- The pill's label is the literal string the frame draws. Per the parity gate, the words
  are part of the design.
- The choice is driven by **context, not breakpoint**: mobile full-width still gets the
  pill, so a media query alone cannot express this rule.

**Non-goals:** restyling the clay token; changing the search bar's segments or its
category-first behaviour; the responsive header work in #26.

**Edge cases:**

- **A narrow desktop viewport** where the header bar is compact but the window is wide →
  the rule follows the bar's role, not the window width.
- **The loading state** → the control keeps its glyph while disabled; it must not fall
  back to a bare ring.

**Acceptance:**

- [ ] Every search control in the app is either a labelled pill or a circle **with** a glyph — **no bare rings survive the sweep**
- [ ] The hero, `/search` and mobile full-width all render the labelled **pill**
- [ ] Only the compact secondary header bar renders the circle
- [ ] The circle carries the 11px ring with a 5px 45° stem in `#FFFDF9`, centred via flex, per frame `18`
- [ ] The icon-only variant has an accessible name
- [ ] The pill's label is the literal string the frame draws
- [ ] The variant is chosen by the bar's **role**, not by a media query — asserted by a narrow-window/compact-bar case
- [ ] The loading state keeps its glyph while disabled and does not fall back to a bare ring
- [ ] **Design parity gate** against frames `02 Search` and `18 Search no results` at 1440×900, then 1280 / 1024 / 768 / 390

---

---

### #52: Vendor card covers — 4:3 → 3:2

**Milestone:** M3 | **Priority:** P1 High | **Status:** Done | **Capabilities:** `core`
**Blocked by:** None

**User value:** As a vendor, the cover I upload crops the same way everywhere my card
appears, so I can actually design for it.

**What changed.** The 2026-08-27 design import moved every vendor-card cover from
**4:3** to **3:2**. Frames `02 Search`, `18 Search no results`, the `14` adaptation set
and `25 Search results — 1024` all label it "cover 3:2", and the markup declares
`aspect-ratio:3/2` directly. This also **retires the 132px fixed height** that
`03-components.md` previously specified for the compact search card.

**Why it is a ratio and not a height:** a fixed height against a fluid card width crops
the same photo differently at every breakpoint, which a vendor cannot design a cover
against. 3:2 is the native ratio of essentially every camera, so an uploaded portfolio
image needs no re-crop. The cover height now *follows* the column width — 4 columns at
1440 and 3 at 1024 both land near 207px.

**Scope:**

- The vendor card component in both densities — compact (search grid) and landing/featured.
- Every surface that renders one: `/search` results, the landing featured row, the
  no-results fallback row, and the tablet/mobile adaptations.
- **Not** the landing *category* cards. Their image is the content and they stay 94px —
  frame `01 Landing` is unchanged by this import.
- **Not** the vendor-profile banner, which is #53.

**Behavioral requirements:**

- Covers declare `aspect-ratio: 3/2`. A fixed `height` on a cover is a defect.
- The image fills under `object-fit: cover`; the card keeps `overflow: hidden` so the
  radius still clips it.
- **Bottom-padding consequence:** a full-width mobile card's cover is ~245px on a 390pt
  screen, so any pane with a fixed bottom action bar needs bottom padding equal to the
  bar's height (**76px** on the mobile search screen) or the last card's price row lands
  underneath it.
- The 8-cards-at-1440 acceptance criterion in `11-search.md` still has to hold.

**Non-goals:** changing card copy, chips, or the grid's column counts; re-cropping seeded
imagery; the 1024 layout pass (#55).

**Acceptance:**

- [ ] Every vendor-card cover declares `aspect-ratio: 3/2`; a `height` on a cover is a review failure
- [ ] `grep` for a fixed cover height in the card component returns nothing
- [ ] Cover height follows column width — measured near 207px at both 4 columns (1440) and 3 columns (1024)
- [ ] 8 cards still visible at 1440 × 900 with none sliced — the existing `11-search.md` criterion still holds
- [ ] Landing **category** cards are untouched and still 94px
- [ ] Mobile search pane has bottom padding equal to its action bar (**76px**) so the last card's price row is not covered
- [ ] Card covers render correctly on the no-results fallback row and both tablet/mobile adaptations
- [ ] Images still fill under `object-fit: cover` with the radius clipping them

- **Design parity gate** on frames `02 Search`, `18 Search no results` and the `14`
  adaptation set at 1440×900, then 1280 / 1024 / 768 / 390.

---

### #53: Vendor profile — 196px banner and the 82px avatar overlap

**Milestone:** M3 | **Priority:** P1 High | **Status:** Done | **Capabilities:** `core` `storage`
**Blocked by:** #6b

**User value:** As a visitor, the vendor's identity reads as one block against their
banner, the way it already does on tablet and mobile.

**What changed.** Frame `03 Vendor profile` **reinstates the avatar overlap** that the
previous revision deliberately flattened. This is a reversal, and it is safe now because
the frame implements it the way `12-vendor-profile.md` always said it had to be done.

| Element      | Value                                                            |
| ------------ | ---------------------------------------------------------------- |
| Banner       | full-bleed, `height: 196px`, `box-sizing: border-box`            |
| Identity row | `margin-top: -34px`, `position: relative`, `z-index: 2`          |
| Avatar       | 82px circle, `4px solid stone-50` ring, `box-sizing: border-box` |

**Read the history before building this.** #6b flattened the overlap because a negative
margin pulled the avatar out through a pane's `overflow: hidden` boundary and the browser
sliced its top edge. **That failure mode is still real.** What makes the frame's version
safe is that the negative margin lives *inside* one positioned wrapper containing both the
banner and the identity row, and the row is lifted with `position: relative; z-index: 2`.
Those two declarations are load-bearing — drop them and the old defect returns.

**Scope:** the profile header on `/vendors/[slug]`, and the avatar size token (72 → 82px)
wherever the profile header consumes it.

**Non-goals:** the tabs, the booking rail, the stat tiles (#41), or the meta line.

**Edge cases:**

- A vendor with no cover: the banner still occupies 196px on its placeholder treatment;
  the avatar still overlaps it.
- Long business names must not push the identity row's height into the banner.

**Behavioral requirements:**

- Nothing is clipped at any width — assert the avatar's `getBoundingClientRect().top` is
  above the banner's bottom edge **and** that its full height renders inside the viewport.
- The 4px ring is `stone-50`, matching the page ground, not `stone-0`.

**Acceptance:**

- [ ] Banner is **196px** with `box-sizing: border-box`
- [ ] Avatar is **82px** with a `4px solid stone-50` ring
- [ ] Identity row carries `margin-top: -34px`, `position: relative` **and** `z-index: 2` — all three asserted, they are what make the overlap safe
- [ ] The avatar's rendered top is above the banner's bottom edge **and** its full height is visible — assert both, not just the overlap
- [ ] Nothing is clipped at 1440 / 1280 / 1024 / 768 / 390 — this is the exact defect that caused the original flattening
- [ ] The negative margin does not cross a clipping ancestor — the wrapper contains both banner and identity row
- [ ] Name, rating, from-price and both CTAs still visible without scrolling
- [ ] A vendor with no cover renders the placeholder banner at 196px with the overlap intact

- **Design parity gate — 1:1 on layout, style, colour, font and the literal text** against
  frame `03 Vendor profile` at 1440×900, then 1280 / 1024 / 768 / 390.

---

### #54: Page loader — the mark's two rings, no wordmark

**Milestone:** M3 | **Priority:** P2 Medium | **Status:** Done | **Capabilities:** `core`
**Blocked by:** #28

**User value:** As a visitor on a cold load, the first thing I see is the brand's shape
rather than a word that may render in the wrong typeface.

**What changed.** Frame `26 State library` replaces the full-page wordmark opacity pulse
with **the logo's two rings converging and parting, 1.9s**. `40-states.md` now states the
reason plainly: the page loader is **geometry only, no wordmark, since it renders before
fonts are guaranteed**. A wordmark in a fallback serif is a worse first impression than
no wordmark at all.

**Scope:** the full-page loading state only — first paint and auth redirects. Element
spinners and content skeletons are unchanged.

**Non-goals:** the skeleton variants and dialogs still owed by **#39**.

**Behavioral requirements:**

- Two rings, the mark's own construction, converging and parting on a 1.9s loop.
- No text of any kind in the loader.
- Respects `prefers-reduced-motion` — the rings settle to their static overlapped
  position rather than animating.
- Still "never a spinner and a skeleton on the same screen".

**Acceptance:**

- [ ] The page loader is the mark's two rings converging and parting on a 1.9s loop
- [ ] **No text of any kind** in the loader — `grep` for the wordmark in the loader component returns nothing
- [ ] It renders correctly before webfonts load — verified with fonts blocked
- [ ] `prefers-reduced-motion` settles the rings to their static overlapped position instead of animating
- [ ] Used on first paint and auth redirects only — not as an element or content loader
- [ ] No screen shows the page loader together with a skeleton

- **Design parity gate** against frame `26 State library` at 1440×900, then
  1280 / 1024 / 768 / 390.

---

### #55: 1024 parity — the shipped screens

**Milestone:** M3 | **Priority:** P1 High | **Status:** Done | **Capabilities:** `core` `auth`
**Blocked by:** #52

**User value:** As someone on a 13" laptop, the product gives me the desktop layout rather
than a stretched tablet one.

**What changed.** 1024 is now a **standard design viewport** with seven drawn frames at
**1024 × 640** — a 13" laptop's usable area once browser chrome is subtracted. **Height is
the binding constraint at this width, not width**, which is why it gets its own rules
instead of inheriting a squeezed 1440.

**The three rules that hold across every 1024 frame:**

- Sidebars keep their labels — **220px, no icon rail.** An icon rail was considered and
  rejected: it returns ~150px of width on screens whose problem is vertical, and costs
  label recognition on a product a vendor uses weekly.
- Right rails narrow 420 → **340px** and **never stack**.
- Grids lose a column before a card loses information.
- Page padding 40 → **24px**; display type 54 → 40px, body 15 → 13.5px, nothing below 11px.

**This ticket owns the four shipped surfaces:**

| Frame | Surface | Note |
|---|---|---|
| `25 Landing — 1024` | `/` | **Both hero portraits stay beside the headline** at 124px, 3:4 — they are only dropped at 768 and below, where they would fall *under* it. The category row is the fold marker and must be visible at 640 |
| `25 Search results — 1024` | `/search` | **3 columns**, 14px gaps, 310px cards, 3:2 cover 207px tall. One full row plus the next row's top edge — that peek is the scroll affordance. Refine stays **one row**; Sort is the only right-aligned item |
| `25 Search — loading · 1024` | `/search` loading | Skeletons mirror the 3-column geometry, not the 4-column one |
| `25 Search — no results · 1024` | `/search` empty | Same 3-column grid for the fallback row |

**Checkout and the vendor dashboard are not in this ticket** — they are unbuilt, and their
1024 frames are scope inside **#10** and **#22a** respectively.

**Scope:** layout only at 1024. Every screen *not* drawn in section 25 inherits the 1440
composition with padding reduced and has no 1024-specific rules — do not invent any.

**Non-goals:** the cover ratio change (#52, which this depends on); any 1280/768/390
behaviour; the messaging three-pane collapse, which is specified in `18-messaging.md` and
is the one screen that genuinely cannot hold its desktop composition at this width.

**Behavioral requirements:**

- No horizontal overflow at 1024, and no vertical overflow of any fixed-height pane.
- **No sidebar becomes an icon rail and no rail wraps under content at 1024.** Either is a
  bug, not an adaptation.
- Verify at **1024 × 640**, not 1024 × 768 — the shorter height is the whole point.

**Acceptance:**

- [ ] Verified at **1024 × 640** specifically — not 1024 × 768; the shorter height is the point
- [ ] No horizontal overflow, and no fixed-height pane overflows vertically
- [ ] **No sidebar becomes an icon rail** at 1024 — labels intact at 220px
- [ ] **No right rail wraps under content** at 1024 — they narrow to 340px instead
- [ ] Search renders **3 columns** at 14px gaps, ~310px cards, 3:2 cover ~207px
- [ ] One full result row plus the next row's top edge is visible — the scroll affordance
- [ ] Landing keeps **both** hero portraits beside the headline at 124px, 3:4
- [ ] Landing's category row is visible within 640px — it is the fold marker
- [ ] Page padding is 24px, display type 40px, body 13.5px, nothing below 11px
- [ ] Loading and no-results skeletons mirror the **3-column** geometry, not the 4-column one
- [ ] A screen not drawn in section 25 has no 1024-specific rules invented for it

- **Design parity gate — 1:1 on layout, style, colour, font and the literal text** against
  each frame above at **1024 × 640**, plus the existing 1440×900 gates for the same screens.

---

### #39: State Library — skeletons, dialogs, validation & the 403 surfaces

**Milestone:** M3 | **Priority:** P1 High | **Status:** Done | **Capabilities:** `core`
**Blocked by:** #28

**User value:** As any user, every waiting, blocking and refused moment is a designed
surface rather than a blank pane or a raw error.

**Context.** #28 shipped the error routes and `Banner`. What remains is the half of
frame `26 State library` that **nothing consumes yet**. That is why it was split: built
speculatively it ships untested against a real screen.

**Build each piece with its first consumer.** This ticket is a checklist that closes
across #7, #8, #10 and #29 — it is not a single sitting. A piece may only be marked done
once a real screen renders it.

| Piece | First consumer | Contract |
|---|---|---|
| Skeleton: list row | #22b bookings list | mirrors real row geometry, `stone-200` shimmer 1.5s, 200ms minimum |
| Skeleton: table row | #15 admin table | 44px dense row |
| Skeleton: message bubble | #8 messaging thread | 62% max width, mirrored radii |
| Element loader (16px) | #7 submit buttons | 2px `clay-400` ring, transparent quarter, label dims to 60% |
| `empty-state.tsx` extension | #22b empty hub | glyph · Serif headline · one sentence · **one** CTA; chrome stays drawn |
| Dialog: availability conflict | #7 / #10 | gold pill, money position, two alternate dates |
| Dialog: session expired | #7 | states the draft is saved; re-auth in place |
| Dialog: listing removed | #6b | **410, not 404**; existing bookings explicitly unaffected |
| Dialog: destructive confirm | #10 / #22b cancel | exact refund split in dollars, what is released, irreversibility |
| Validation hook (three-tier) | #7 request form | red wrong · gold valid-but-costly · counted summary at the submit bar |
| 403 surface | #15 admin, any role gate | designed page, not a raw error |
| Rate-limit surface | API 429 | says what to do and when to retry |

**The page loader is not in this ticket** — it is #54.

**Scope:** `apps/web/src/components/states/*` and the validation hook. Each piece lands in
the PR of its consumer, or in a follow-up that renders it on a real screen.

**Behavioral requirements:**

- **Never a spinner and a skeleton on the same screen.** One idiom per screen.
- Skeletons mirror **real** dimensions; a generic grey box is a defect.
- Minimum 200ms skeleton display so a fast load does not flash.
- Dialogs trap focus, close on Escape, and restore focus to their trigger.
- The destructive button is `error-500` **only inside its dialog** — never the screen's
  primary elsewhere, and always with an escape hatch.
- Validation errors appear **after a submit attempt**, never while typing, and clear
  per-field on correction.
- Every message says how to fix it: "Needs 10 digits — you're two short", not "Invalid".

**Non-goals:** the page loader (#54); the upload states, which #29 already shipped; new
error routes.

**Edge cases:**

- A dialog opened from inside a scrolling pane must not scroll the page behind it.
- The counted validation summary must stay accurate when a field is fixed without a
  re-submit.
- 403 must be distinguishable from 404 for a signed-in user who simply lacks the role.

**Progress 2026-08-28 — 5 of 12 rows closed, 7 deferred with reasons.**

**Closed:**

- **Skeleton: list row** — `apps/web/src/app/bookings/loading.tsx`. Chrome stays drawn; only
  the cards are skeletons, carrying `BookingCard`'s own 14px radius, 9.5 avatar tile and
  type sizes so the grid does not shift when data lands.
- **Skeleton: message bubble** — `apps/web/src/app/messages/loading.tsx`. Keeps the 62% cap
  and the single squared corner on the sender's side, and alternates sides so a thread
  reads as a conversation.
- **Element loader (16px)** — moved into `Button` as `loading`, consumed by #7's request
  submit and #8's message composer. Label dims to 60% and says "Sending…", per frame `26`.
- **`empty-state.tsx`** — already met the contract exactly (glyph · Serif headline · one
  sentence · **one** CTA); `EmptyBookings` is frame `19`'s richer variant of it. No change.
- **Validation hook (three-tier)** — already shipped as `lib/use-submit-validation.ts` and
  rendered by #7's form: `costly` shows immediately, `blocker` only after a submit attempt,
  a counted summary sits at the submit bar, and issues clear per field on correction.

**Deferred, each with the reason:**

1. **Skeleton: table row** — its only consumer is #15's admin table, which is Backlog.
   Building it now is exactly the speculative build this ticket was split to avoid.
2. **Dialog: availability conflict** — the API has no 409 on booking-request creation, so
   there is nothing to trigger it. Owned by **#10**, which is Backlog.
3. **Dialog: destructive confirm** — cancelling a confirmed booking, with its refund split,
   belongs to **#10**. No cancel action exists on any shipped screen.
4. **Dialog: session expired** — **blocked on a prerequisite, not on a consumer.** The
   frame's copy promises "Your draft request is saved", and the booking request draft is
   currently held in component state only: nothing persists it. Shipping the dialog first
   would make the product state something untrue at the exact moment the customer is most
   likely to test it. See **#58**.
5. **Dialog: listing removed (410)** — needs a deliberate reversal of a recorded decision.
   `vendor-profile.dao.ts` returns **404** for unpublished *and* deleted vendors on purpose,
   so a draft is indistinguishable from a listing that never existed. The frame's 410 names
   the vendor and says they paused, which discloses that they exist. That is a product
   call about disclosure, not a defect to fix in passing.
6. **403 surface** — role mismatch is a **redirect** by design (`requireRole` sends the
   caller to their own dashboard), and the frame's 403 is about *resource ownership*
   ("You don't have access to this booking"), for which no route exists: bookings are only
   ever reached through `getOwnBookings`. Its named consumer is #15, which is Backlog.
7. **Rate-limit surface** — the frame's copy is about failed sign-ins, which Clerk owns and
   throttles; our own API 429 is not reachable from any screen a user drives. Belongs with
   #15's Sentry work, where 429s become visible.

**Acceptance:**

- [x] Every row in the table above is either built **and rendered by its named consumer**, or explicitly deferred in this ticket's notes with the reason
- [ ] No skeleton variant is a generic box — each mirrors its content's real geometry
- [ ] No screen shows a spinner and a skeleton together
- [ ] All four dialogs trap focus, close on Escape and restore focus
- [ ] The listing-removed dialog is reached from a **410**, not a 404
- [ ] Validation fires only after a submit attempt, and the submit-bar count matches the number of invalid fields
- [ ] 403 and 429 both render a designed surface — asserted by driving the API to return each
- [ ] **Design parity gate** against frame `26 State library` at 1440×900, then 1280 / 1024 / 768 / 390

---

### #56: Vendor profile — identity row vertical rhythm (reported by the user)

**Milestone:** M3 | **Priority:** P2 Medium | **Status:** Done | **Capabilities:** `core`
**Blocked by:** None

**Reported by the user 2026-08-28**, after #53 reinstated the overlap: on `/vendors/[slug]` the identity block (avatar + business name) sits **slightly lower**, with the name still vertically centred against the avatar. Recorded rather than acted on — the user asked explicitly not to change it eagerly.

**What #53 shipped, for reference:** the row is `align-items: flex-start` with the name block offset `margin-top: 23px`, which is what frame `03` draws — the name's cap-height lines up with the avatar's middle rather than its top. Confirm against the frame whether the observed position is the intended one before changing anything; if it is, close this as no-change.

**Acceptance:**

- [ ] Compared against frame `03 Vendor profile` at 1440x900 before any edit
- [ ] If it already matches the frame, closed as no-change with the measurement recorded

---

### #41: Vendor profile — the tagline and the experience figure

**Milestone:** M3 | **Priority:** P2 Medium | **Status:** Done | **Capabilities:** `core`
**Blocked by:** #6b

**User value:** As a vendor, my profile opens with my own words rather than a gap where a
pull-quote should be.

**Context.** Frame `03 Vendor profile` opens the About tab with a Serif italic pull-quote
— *"Quiet, documentary, never asks you to pose."* — and a stat tile reading
**Experience · 10 yrs**. **Neither has a data source.** There is no `tagline` and no
years-experience column in `vendor_profiles`, in `packages/shared/src/schemas`, or in the
storefront editor. #6b shipped the About tab from real data only rather than inventing
either, per "no number on a page that isn't read from the database".

**Decisions — taken here so this is buildable; overrule in the ticket if you disagree:**

1. **Tagline is a free-text column**, `varchar(80)`, optional, collected in the storefront
   editor under "About your business". 80 characters is roughly the frame's line and a
   hard cap is what stops it becoming a second bio. It is **not** a publish blocker — a
   vendor without one gets no pull-quote and the bio moves up.
2. **Experience is self-declared**, as `years_in_business` (integer, 0–75), also in the
   editor. The alternative — deriving it from the first completed booking — is *wrong for
   an established vendor joining today*, which is most of the first cohort. Self-declared
   is unverifiable but honest about being the vendor's claim, and it matches the other two
   tiles, which are already vendor-entered.
3. **Three stat tiles, not four.** Frame `03` draws three; `12-vendor-profile.md` already
   says three (Experience / Events / Travels). The "four" reference is stale.

**Scope:**

- `packages/db` migration adding `tagline` and `years_in_business` to `vendor_profiles`,
  generated with `pnpm db:generate`.
- `packages/shared` schema + type updates, derived from the same source of truth.
- The storefront editor (#17's surface) gains both fields in the Business section.
- `/vendors/[slug]` About tab renders the pull-quote and the Experience tile.
- Seed data gains plausible values so the parity gate has something to render.

**Behavioral requirements:**

- Absent tagline → **no empty pull-quote block**; the bio simply starts the tab.
- Absent `years_in_business` → the Experience tile is **omitted**, not rendered as "0 yrs".
  Two tiles is a valid state.
- Tagline renders as Serif italic 20px per `12-vendor-profile.md`, exactly as entered —
  never truncated mid-word, never title-cased.
- Both fields are optional and neither blocks publishing.

**Non-goals:** verified credentials; any derived or platform-computed experience figure;
the Events and Travels tiles, which already work.

**Edge cases:**

- A tagline of exactly 80 characters must render on the frame's line without clipping.
- `years_in_business` of 0 (a vendor starting this year) is valid and renders "Less than a
  year" rather than "0 yrs".
- A tagline containing quotes must not break the pull-quote's own quotation styling.

**Acceptance:**

- [ ] Migration generated by `pnpm db:generate`, never hand-edited
- [ ] `tagline` capped at 80 chars, enforced in the Zod schema **and** the column
- [ ] `years_in_business` constrained 0–75 in the schema
- [ ] Both fields editable in the storefront editor and persisted
- [ ] Vendor with no tagline renders no empty block; vendor with no experience renders two tiles
- [ ] `years_in_business = 0` renders "Less than a year"
- [ ] Neither field appears in the publish-blocker checklist
- [ ] Seed provides both so the frame can be verified
- [ ] **Design parity gate** against frame `03 Vendor profile` About tab at 1440×900, then 1280 / 1024 / 768 / 390

---

### #42: Soft 404 — `notFound()` returns HTTP 200 in production

**Milestone:** M4.5 | **Priority:** P1 High | **Status:** Done | **Capabilities:** `core`
**Blocked by:** #28

**User value:** As a search engine — and therefore as every future organic visitor — a
removed vendor URL is a dead page, not a live one.

**Context, confirmed in production 2026-08-27.**
`/vendors/no-such-vendor-at-all` serves the correct #28 404 **body** with HTTP **200**.
A path matching no route at all correctly returns 404, so Next's routing is fine — it is
`notFound()` **called from a page** that loses the status. Reproduced with a bare page
whose only statement is `notFound()`, so it is **not** #6b's code. The dev response
carries `x-middleware-rewrite` to the same path, which points at `clerkMiddleware()` in
`apps/web/src/middleware.ts`: a middleware rewrite makes Next serve the rendered body
with a 200.

**Why it matters:** a marketplace whose organic traffic is vendor profiles will
accumulate delisted URLs. Search engines treat a soft 404 as duplicate thin content, and
it undercuts #30's SEO work directly.

**Scope:** `apps/web/src/middleware.ts` and any page calling `notFound()`. Investigation
first — this is a diagnosis ticket with a fix attached, not a known one-liner.

**Approach, in order:**

1. Confirm the interaction against the **Clerk + Next 15.5** combination specifically.
   Check whether the matcher can be scoped so public content routes are not rewritten.
2. If the matcher cannot avoid it, have the route return a real 404 response rather than
   relying on `notFound()` alone.
3. Whichever path is taken, the fix must hold for **every** page that calls `notFound()`,
   not just `/vendors/[slug]`.

**Behavioral requirements:**

- `notFound()` from any page produces HTTP **404**.
- The 404 body stays exactly as #28 built it — the body has been correct throughout.
- A genuinely unmatched path keeps returning 404.
- Authenticated routes keep their Clerk protection; narrowing the matcher must not open a
  protected path.

**Non-goals:** redesigning the 404 page; the 410 listing-removed dialog (#39); the broader
SEO work in #30.

**Edge cases:**

- A signed-in user hitting a missing vendor gets 404, not a redirect to sign-in.
- Static and dynamic routes must both be checked — the rewrite may only affect one.

**Acceptance:**

- [ ] **Assert the status code, not the body** — the body has been correct throughout, so a body assertion proves nothing
- [ ] A test drives a bare page whose only statement is `notFound()` and asserts 404
- [ ] `/vendors/<missing-slug>` returns 404 in a production build, verified against the deployed URL
- [ ] An unmatched path still returns 404
- [ ] A protected route still redirects an anonymous visitor to sign-in — assert the matcher change did not open anything
- [ ] The regression is covered by a test that fails without the fix

---

### #46: Clerk webhooks point at a CLI relay, not the API

**Milestone:** M4.5 | **Priority:** P1 High | **Status:** Blocked — needs a human | **Capabilities:** `core` `auth`
**Blocked by:** None

**User value:** As a user who changes their name or email in Clerk, the marketplace shows
the new one.

**Context, found 2026-08-27 during the Railway cutover.** The only Svix endpoint on the
Clerk app was `https://webhooks.clerk.com/in/c_2BrebQnWkQ/` — a **`clerk webhooks listen`
relay token** (`c_` + 10 base62 chars), i.e. a local-development target. Production Clerk
webhooks have therefore **never** reached the deployed API.

**This was not an outage.** `users.service.ts:78` lazily creates the user row on the first
authenticated request, so sign-up always worked. What was silently lost is
**`user.updated` and `user.deleted`** — stale names and emails locally, and users deleted
in Clerk left behind in the database.

**Already done during cutover:** the endpoint was repointed at
`https://vendor-marketplace-production.up.railway.app/webhooks/clerk` and verified live —
an unsigned POST returns **401**, so the route exists and svix verification is enforced.

**This ticket is the three things that repointing did not fix.**

**Scope:**

1. **Reconciliation.** A one-off pass that re-reads Clerk for every local `users` row and
   corrects name/email drift, plus handles users deleted in Clerk while the webhook was
   misrouted. Run once, but written as a re-runnable script — this is not the last time a
   webhook will be misconfigured.
2. **A guard.** Nothing today asserts the configured endpoint is a real API origin, which
   is why this failed silently for the entire life of the deployment. Add a startup or
   preflight check that fails when the Clerk webhook endpoint is a relay token
   (`webhooks.clerk.com/in/c_…`) rather than the deployment's own origin.
3. **Rotate `CLERK_WEBHOOK_SECRET`.** The value was pasted into a chat transcript on
   2026-08-27. Per `CLAUDE.md`, a leaked value is **rotated, not merely deleted**.

**Behavioral requirements:**

- Reconciliation is **idempotent** — running it twice changes nothing the second time.
- A Clerk-deleted user is handled by the same path `user.deleted` would have taken, so
  there is one deletion behaviour, not two.
- The guard fails **loudly at startup or in preflight**, not at the first missed webhook.
- Signature verification stays enforced; the guard is additional, not a replacement.

**Non-goals:** redesigning the webhook handler; adding new Clerk event types; the
`normalizeRole` narrowing, which is correct and unchanged.

**Edge cases:**

- A local row whose Clerk user no longer exists — delete or tombstone, consistently with
  `user.deleted`.
- A Clerk user with no local row: reconciliation must **not** create one, since rows are
  created lazily on first authenticated request by design.
- Rate limits on the Clerk API during a bulk reconciliation pass.

**Acceptance:**

- [ ] Reconciliation script exists, is re-runnable, and is idempotent — asserted by running it twice in a test
- [ ] Name/email drift is corrected for every existing row
- [ ] A user deleted in Clerk is handled identically to a live `user.deleted` event
- [ ] Reconciliation does **not** create rows for Clerk users with no local record
- [ ] The guard rejects a `webhooks.clerk.com/in/c_…` relay endpoint and passes a real API origin — both directions tested
- [ ] `CLERK_WEBHOOK_SECRET` **rotated**, and the old value invalid
- [ ] An unsigned POST to `/webhooks/clerk` still returns 401

---

### #47: Image URLs persist absolute — the CDN domain cannot change without a migration

**Milestone:** M4.5 | **Priority:** P1 High | **Status:** Done | **Capabilities:** `core` `storage`
**Blocked by:** None

**User value:** As the operator, moving the image CDN is a config change, not a database
migration and a split-host outage.

**Context, found 2026-08-27.** `storage.ts:41` `publicUrlFor` returns
`${S3_PUBLIC_URL}/${key}`, and that **absolute** string is what the upload route returns
and what the profile, cover and portfolio columns store. Changing `S3_PUBLIC_URL`
therefore **does not** repoint existing images — it affects only new ones, leaving a
database split across two hosts.

Production currently uses the R2 **public development URL**
(`https://pub-f0933b41….r2.dev`), which Cloudflare rate-limits, excludes from its cache,
and does not recommend for production. No caching means slower LCP and more billed Class B
operations on exactly the image-heavy vendor pages #30 depends on for organic traffic.

**The bucket is empty today, which makes this the cheapest possible moment.**

**Decision — take the second option:** **store the object key and resolve the base URL at
render time.** The alternative (attach a Cloudflare custom domain now) fixes today's
symptom but leaves the coupling in place, so the next domain move is another migration.
Storing keys removes the coupling permanently. It touches every image-bearing column and
its wire schema, which is precisely why it should happen while the bucket is empty rather
than after vendors have uploaded.

Attaching a custom domain is still worth doing — it is just no longer load-bearing.

**Scope:**

- `publicUrlFor` and the upload route in `apps/api`.
- Every image-bearing column in `packages/db` — profile photo, cover, portfolio items.
- The wire schemas in `packages/shared` that carry those values.
- Every web consumer that renders an image URL.
- A migration for any rows that already hold absolute URLs (seed data).

**Behavioral requirements:**

- The database stores an **object key**, never a host.
- Resolution happens at the render boundary, from `S3_PUBLIC_URL`, in one helper — a
  second resolution site is a second source of truth.
- Changing `S3_PUBLIC_URL` repoints **every** image with no data change. This is the
  ticket's whole point and must be tested.
- Seeded rows are migrated, not left absolute.

**Non-goals:** image resizing or transformation; a signed-URL scheme; choosing the custom
domain itself, which is an infrastructure task.

**Edge cases:**

- A row already holding an absolute URL must migrate cleanly, including one pointing at
  the `.r2.dev` host.
- An empty or null image column must resolve to no URL, not to a bare host.
- The key must never begin with a slash, or the join produces a double slash.

**Acceptance:**

- [ ] No image-bearing column stores a host — asserted by a test that greps persisted values for `https://`
- [ ] Changing `S3_PUBLIC_URL` repoints every image with **zero** database writes — the defining test
- [ ] Exactly one resolution helper exists; a second is a review failure
- [ ] Existing seeded absolute URLs are migrated by a generated migration
- [ ] Null/empty image columns render no image rather than a bare host
- [ ] Upload → persist → render round-trips correctly against real object storage
- [ ] **Decided before any vendor uploads** — after that this becomes a data migration with real user content

---

### #48: The Vercel "production" API was serving the Neon `dev` branch

**Milestone:** M4.5 | **Priority:** P1 High | **Status:** Backlog | **Capabilities:** `core`
**Blocked by:** #19

**User value:** As the operator, "production" means production data — and preflight
enforces that in both directions, not one.

**Context, found 2026-08-27 by comparing the two APIs.** The Neon `production` branch
returns **0 vendors / 10 categories**; the Vercel API returned **16 vendors / 11
categories** — byte-identical to the local `dev` branch. The deployed "production" API has
been reading **`dev`** since it was first deployed.

This is the mirror of the rule in `CLAUDE.md` ("local development must never point at
`production`"), which preflight enforces in **one direction only**.

**It also explains `docs/pre-launch.md` §1.1:** the 16 fabricated vendors and 918
fabricated reviews on the live site were never in a production database.

**Railway is deliberately pointed at `dev` too**, by decision, so the deployment stays a
demo/staging environment with working design-parity data until launch. The `production`
branch is reserved and empty. **That decision stands — this ticket does not undo it.**

**Scope — three separable pieces:**

1. **Close the missing preflight direction.** Preflight must refuse a *production* target
   that reads a non-production branch, exactly as it already refuses a local target
   reading `production`.
2. **Re-seed the stale `production` branch.** It has 10 categories where `dev` has 11, so
   its reference seed is out of date and must be re-run before launch.
3. **The cutover itself** is a launch-gate item in `docs/pre-launch.md` §1.1 and §3.2 —
   tracked there, executed at launch, not now.

**Behavioral requirements:**

- Preflight's branch check works in both directions and names which direction failed.
- The check reads the actual connection target, not an environment label — a label is what
  failed here.
- Re-seeding `production` is idempotent and touches reference data only, never user rows.
- The intentional `dev` pointing of the demo deployment must **not** trip the new check —
  it is a staging target, and the check must distinguish "production deployment" from
  "deployment that happens to be public".

**Non-goals:** performing the launch cutover; changing the demo deployment's data source;
migrating fabricated demo content into production.

**Edge cases:**

- A branch renamed in Neon must fail the check loudly rather than silently passing.
- A preview deployment should not be treated as production.

**Acceptance:**

- [ ] Preflight refuses a production target reading a non-production branch, with a message naming the direction
- [ ] Preflight still refuses a local target reading `production` — the existing direction is not regressed
- [ ] The demo deployment pointing at `dev` passes, deliberately, and there is a test asserting that
- [ ] `production` reference seed re-run and verified at **11** categories
- [ ] `production` still contains **0** vendors — re-seeding must not import demo content
- [ ] The cutover remains tracked in `docs/pre-launch.md` §1.1 and §3.2

---

### #49: A signed-in visitor's front door still 500s when `/users/me` fails

**Milestone:** M4.5 | **Priority:** P1 High | **Status:** Done | **Capabilities:** `core` `auth`
**Blocked by:** None

**User value:** As a signed-in visitor, a public page still renders when the API cannot
read my own record.

**Context, found while verifying #33 on 2026-08-27.** With the API stopped, every public
route now renders for a **signed-out** visitor. A **signed-in** one still gets the 500
boundary on `/`: `redirectVendorToDashboard` → `getCurrentUserOrSuspend` →
`getCurrentUser` propagates the failure.

**This was deliberately left out of #33.** `getCurrentUser` is an **authorization** read —
the vendor redirect and the suspension gate both hang off it, and degrading it fails
**open**. Making it resilient is a product decision, not a `try/catch`.

**Decision — take the split that #33's note already anticipated:**

| Route class | When `getCurrentUser` fails |
|---|---|
| **Public** (`/`, `/search`, `/vendors/[slug]`, marketing) | Render **signed-out chrome** and **skip the convenience redirect**. The page is public; its content does not depend on identity |
| **Protected** (dashboards, bookings, messages, editor, admin) | **Keep propagating.** A protected route that cannot resolve identity must not render |

The reasoning: on a public route the identity read buys only a convenience (the vendor
redirect) and a suspension check that has no protected content to guard, because the page
is public either way. On a protected route it is load-bearing and failing open would be a
security defect.

**Scope:** `getCurrentUser` / `getCurrentUserOrSuspend` and their callers; the public
route group's layout. The distinction must be **explicit in code** — a route is public
because it is declared public, never because a `try/catch` happens to be nearby.

**Behavioral requirements:**

- A public route with an unreadable user record renders **signed-out chrome** — no user
  menu, no vendor redirect, no crash.
- A protected route with an unreadable user record **still fails**. This is the security
  boundary and it must have a test that fails if someone later "fixes" it.
- **The suspension gate never degrades on a protected route.** A suspended user must not
  gain access because a read failed.
- The convenience redirect is skipped, not retried in a loop.

**Non-goals:** caching the user record; retry logic; the `/suspended` page itself;
anything in #33, which is done.

**Edge cases:**

- A **suspended** vendor on a public page during an API outage: renders signed-out chrome
  rather than the suspension notice. Acceptable — the page is public and shows them
  nothing they could not see anonymously.
- A partial failure where Clerk resolves but the local row does not.
- The redirect must not fire once the API recovers mid-session in a way that loses the
  visitor's place.

**Acceptance:**

- [ ] With the API stopped, a **signed-in** visitor loads `/`, `/search` and `/vendors/[slug]` — no 500
- [ ] Those pages render signed-out chrome, not a half-populated user menu
- [ ] With the API stopped, a signed-in visitor hitting a **protected** route still gets the boundary — asserted, so it cannot be regressed
- [ ] A suspended user cannot reach protected content during an API failure
- [ ] Public-ness is declared explicitly, not inferred from where a `try/catch` sits
- [ ] Tests cover both directions; the protected-route test must fail if the guard is removed

---

### #50: Search no-results — the nearby-date alternatives band

**Milestone:** M3 | **Priority:** P2 Medium | **Status:** Done | **Capabilities:** `core`
**Blocked by:** #29

**User value:** As a customer whose date has nothing, I am shown who is free **near** that
date instead of a dead end.

**Context, split out of #29 on 2026-08-27.** Frame `18 Search no results` closes with
**"Free on a nearby date instead"** over three cards, each showing the vendor's nearest
free date, plus **"See all N in the region"**. #29 built everything above it — the
headline, the diagnosis and the one-tap relaxations, all browser-verified.

**This band needs a capability that exists nowhere.** `GET /vendors?date=` answers **one**
date, and the vendor card carries no availability dates. So this is a **new API shape**,
not a component.

**Decide the shape first — and note #7 will want the same thing** when a booking request
lands on a blocked date. Build it once.

**Recommended shape: nearest-free-date per vendor.** Given a category, city and target
date, return matching vendors each annotated with their nearest available date within a
window (default ±14 days). A date-window search returning every free date is more data
than either consumer needs, and the card only renders one date.

**Scope:**

- `apps/api`: the new query, layered route → service → DAO like everything else.
- `packages/shared`: the response schema.
- `apps/web`: the alternatives band on the no-results screen, and the "See all N in the
  region" link.
- The same endpoint is what #7 uses for its blocked-date suggestions — do not build a
  second one.

**Behavioral requirements:**

- An empty result is normal: nobody free nearby means the band is **absent**, not empty.
  The screen above it already stands on its own.
- Dates respect the `DATE`-as-string rule — never round-tripped through a local-time
  `Date`.
- The window is a parameter with a sane default, not a magic number in the DAO.
- Results stay ordered by nearest date, then by the search's existing ordering.
- Nearest-free-date must respect vendor blocks and existing bookings, i.e. the same
  availability truth the calendar uses.

**Non-goals:** a full date-window search; notifying customers when a date frees up; map or
region browsing beyond the "See all N" link.

**Edge cases:**

- The target date is **today** — the window must not suggest dates in the past (see the
  past-date rules in `11-search.md`).
- A vendor free on the target date should never appear here; they would have been in the
  main results.
- "See all N in the region" must render the real N or not render at all — no invented
  count.

**Acceptance:**

- [ ] One endpoint serves both this band and #7's blocked-date suggestions
- [ ] Returns each vendor's **nearest** free date within a configurable window, default ±14 days
- [ ] Never suggests a past date, including when the target is today
- [ ] A vendor free on the target date is excluded
- [ ] No nearby availability → the band is absent, and the screen still passes its parity gate
- [ ] "See all N in the region" shows a real count read at request time
- [ ] Availability matches the calendar's truth, including vendor blocks — tested against a blocked date
- [ ] **Design parity gate** against frame `18 Search no results` at 1440×900, then 1280 / 1024 / 768 / 390, including `25 Search — no results · 1024`

---

### #51: Cover is a designation, not a second uploader

**Milestone:** M3 | **Priority:** P2 Medium | **Status:** Done | **Capabilities:** `core` `storage`
**Blocked by:** #29

**User value:** As a vendor, I pick my cover by putting a photo first, instead of
uploading the same image twice.

**Context, split out of #29 on 2026-08-27.** `40-states.md` states: *"Cover is a
designation on an existing tile (drag to first slot), never a second uploader."* That
deletes the separate "Cover image" drop zone in the storefront editor and makes the first
portfolio tile the cover.

#29 left it because it is a **portfolio-ordering and data-model change**, not an upload
state — folding it in would have merged a schema question into a states retrofit. The
portfolio already reorders by drag, so **the interaction exists**; what is undecided is
what `coverImageUrl` means once it is derived from position.

**Decision — keep `coverImageUrl` as a stored column, maintained from position.** Deriving
it as "portfolio position 0" at read time is tempting and wrong: the cover is referenced
from search cards, the profile banner and share metadata, and making all three depend on a
join into portfolio ordering couples hot read paths to a list. Instead, reordering the
portfolio **writes** the new first item's key into `coverImageUrl` in the same
transaction. One column, one write, no join.

**This interacts with #47.** If #47 lands first, the column stores an object key rather
than a URL and this ticket follows that shape. If this lands first, #47 migrates it with
the rest.

**Scope:**

- The storefront editor: remove the separate cover drop zone; the first portfolio tile is
  the cover, labelled as such.
- Reorder handler writes `coverImageUrl` transactionally with the new order.
- `packages/db` migration only if the column's meaning or nullability changes.
- Backfill: existing vendors whose `coverImageUrl` is not their first portfolio item.

**Behavioral requirements:**

- The first tile carries a visible **Cover** designation — a vendor must be able to tell
  which image is their cover without reading documentation.
- Reordering updates the cover **in the same transaction** as the order; a failure leaves
  neither changed.
- A vendor with an empty portfolio has **no cover**, and the profile renders its
  placeholder treatment. This is a valid state, not an error.
- Deleting the first portfolio item promotes the next one to cover, atomically.
- Publishing rules are unchanged — this ticket must not make a cover a new publish blocker
  unless it already was.

**Non-goals:** the upload queue and its states, which #29 shipped; cropping or a 3:2 crop
tool; the card cover ratio, which is #52.

**Edge cases:**

- Portfolio reduced to zero items → cover cleared, profile falls back to placeholder.
- A vendor whose current cover is **not** in their portfolio at all — the backfill must
  decide: adopt it as the first portfolio item, or drop it. Recommended: adopt it, so no
  vendor silently loses their chosen cover.
- Two rapid reorders must not interleave into an inconsistent cover.

**Acceptance:**

- [ ] The separate cover drop zone is gone from the storefront editor
- [ ] The first portfolio tile is visibly designated as the cover
- [ ] Drag-to-first updates `coverImageUrl` in the **same transaction** as the reorder — asserted by a failure test that rolls back both
- [ ] Deleting the first item promotes the next one atomically
- [ ] Empty portfolio → cover cleared, profile renders the placeholder, no error
- [ ] Backfill adopts an orphaned existing cover rather than discarding it
- [ ] Search cards, profile banner and share metadata all still resolve the cover without a join into portfolio ordering
- [ ] Shape agrees with #47 — object key or URL, whichever landed first

---

## Live-App Audit — 2026-08-27

Full passthrough of the running app at 1440×900 and 390, signed out, signed in as the
vendor E2E account, and signed in as the customer E2E account, plus a direct API probe.
Recorded so the next session does not re-derive it.

### Verified healthy — do not re-audit

- **Test suite green: 952 tests across 5 packages** — web 371, api 224, shared 200,
  preflight 105, db 52. `pnpm typecheck`, `pnpm lint`, `pnpm format:check` and
  `pnpm build` (from clean) all pass.
- **No pre-Orla design debt.** `primary-*`, `VenMatch`, Fraunces and the old token
  aliases are all gone; the residual grep hits are shadcn `--primary-foreground` slots,
  the brand-literal test guard, and history comments. #21 did its job.
- **Hygiene clean.** Zero `TODO`/`FIXME`/`HACK`, zero stray `any`, `console.*` only in
  the two CLI scripts where it belongs.
- **Authorization is solid on both tiers.** Unauthenticated → 401 on every protected
  route; a **customer token gets 403 on every vendor endpoint, including with a
  well-formed body** (the schema-before-guard ordering leaks nothing); web routes
  redirect by role in both directions. `@fastify/helmet`, `@fastify/cors` and
  `@fastify/rate-limit` are all registered.
- **`/ready` reports `database: up`, `storage: up`** — the MinIO bucket mismatch #18
  flagged is resolved.
- **Availability calendar is sound.** Past dates disabled with correct accessible labels,
  "Show earlier months" disabled, This-quarter counts arithmetically correct.
- **Search behaves.** Empty state, past-date clearing (with an explanatory line), the
  category combobox's no-match state, and the dual query-bar instance (the hidden copy is
  `display:none`, so it is correctly out of the accessibility tree) all work as specified.
- **Toasts render correctly** — an early reading to the contrary was a timing artifact.

### Things that are *not* defects, recorded to stop the next audit chasing them

- The `<section aria-label="Notifications alt+T">` that looks empty is Sonner's wrapper;
  the toast `<ol>` mounts and unmounts around it.
- A portfolio photo with no caption renders `alt=""`. That is correct for a decorative
  image, though a caption-less shot would read better as "Portfolio photo 2".
- The Clerk avatar's `alt="'s logo"` and the dotted "Development mode" band are Clerk
  development artifacts, not our markup.
- `pnpm build` fails with `Cannot find module for page: /_document` **only** when a dev
  server is live and sharing `apps/web/.next`. A clean build succeeds; CI is unaffected.
  #30 carries the fix.

### Defects found, and where each is tracked

| # | Defect | Ticket |
|---|---|---|
| 1 | `TICKET #6` / `#8` / `#10` render on `/customer/dashboard`; `Ticket #9` on `/vendor/dashboard` | **#31** |
| 2 | Every user greeted "Welcome back, there" — sign-up never collects a name | **#31** |
| 3 | Customer dashboard's three cards are inert; "Find vendors" does not link to `/search` | **#31** |
| 4 | `/customer/dashboard` titled "Your events" after the Event entity was cut | **#31** |
| 5 | "Price must be at least 2500 cents" shown to vendors | **#31** |
| 6 | Price field has no `min`/`max`; out-of-range fails only server-side, as a toast | **#31** |
| 7 | Toasts render `top-center`; `03-components.md` specifies bottom-right with type accents | **#31** |
| 8 | "Pick one above to continue" renders below the Clerk footer, not under the button | **#31** |
| 9 | City and Event date inputs have no accessible name (landing + search) | **#31** |
| 10 | Search `Sort` select has no accessible name | **#31** |
| 11 | No skip-to-content link | **#31** |
| 12 | No `not-found.tsx`, `error.tsx` or `global-error.tsx` anywhere | **#28** |
| 13 | No page-scope loading state | **#28** |
| 14 | 403 and rate-limit have no designed surface | **#28** |
| 15 | Search has no loading state | **#29** |
| 16 | Uploads are a boolean — no progress, no queue, no partial success, no per-file failure | **#29** |
| 17 | Upload constraint copy is stale (10MB/WebP vs the spec's 12MB/JPG-PNG/1200px/20-per-batch) | **#29** |
| 18 | LIKE wildcards unescaped: `?name=%` returns the whole directory | **#29** |
| 19 | API accepts a past `date`; the web layer strips it but the API does not | **#29** |
| 20 | Web tier serves zero security headers | **#30** |
| 21 | No robots, sitemap, OG image, manifest, icons or `metadataBase` | **#30** |
| 22 | Every vendor card links to `/vendors/[slug]`, which 404s | **#6b** |
| 23 | Header is 64px at 390 where the spec says 56px, and there is no drawer | **#26** |
| 24 | Clerk logs `structural_css_pin_clerk_ui` on every auth page | **#26** |
| 25 | All 11 seeded vendors are photography; 5 of 6 landing categories lead to an empty search; no vendor has a cover or portfolio image | **#14** |

### Lower-confidence observation

After completing Clerk's new-device verification, the app sat on `/sign-in` still
rendering the form for at least four seconds while the session was in fact established.
Could not be cleanly reproduced without a fresh device fingerprint. **Re-test the
post-verification redirect during #31's browser pass**; if it reproduces, it belongs in
`/after-sign-in`.
### #61: Preflight accepts a live key against a local target

**Milestone:** M4.5 | **Priority:** P1 High | **Status:** In Progress | **Capabilities:** `core` `auth` `stripe`
**Blocked by:** None

Found 2026-08-28 while unblocking #9 with sandbox credentials.

**Root cause.** `shapeFor()` in `packages/shared/src/env/registry.ts` returns
`productionShape` only when the target is `production`, and falls back to the permissive
`shape` for `local`. Four variables declare a `shape` that admits **both** modes:

| Variable | Its `shape` admits |
| --- | --- |
| `STRIPE_SECRET_KEY` | `sk_test_` **and** `sk_live_` |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | `pk_test_` **and** `pk_live_` |
| `CLERK_SECRET_KEY` | `sk_test_` **and** `sk_live_` |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | `pk_test_` **and** `pk_live_` |

So `pnpm preflight --ticket 9` prints `set, shape ok` for a **live** key, and the local
app runs against real Stripe money or the real Clerk user directory with nothing said.

**This is the mirror of #48.** `CLAUDE.md` states that local development must never point
at `production`; preflight enforces that for the Neon branch and for nothing else. The
guard is one-directional in exactly the same way, for exactly the same reason — the rule
was written as a production-safety rule and read as if it were symmetric.

**Scope — `packages/shared` + `packages/preflight`:**
- Give the registry a `localShape` alongside `productionShape`, so the mode restriction is
  declared per variable in one place rather than special-cased per key in the checker.
- `shapeFor()` selects `localShape` for `local` and `productionShape` for `production`,
  each falling back to `shape` when absent.
- The failure message must name the mode — "this is a **live** key and the target is
  local" — not just report a shape mismatch, or the developer will paste it back in.

**Non-goals:** widening the check beyond credentials that carry a mode in their prefix;
scanning for live keys in git (`packages/preflight/src/secrets/` already has
`stripe-live`); changing any variable's production behaviour.

**Edge cases:**
- A variable with no mode in its prefix (`DATABASE_URL`, `S3_*`) must be unaffected.
- `whsec_` carries no mode and must keep passing.
- Absent credentials must still fail as "unset", not as "wrong mode".

**Acceptance:**

- [ ] A `sk_live_` or `pk_live_` value **fails** `pnpm preflight` against the `local` target
- [ ] The failure message names the mode, not just the regex
- [ ] Test keys still pass locally, and still fail against `production`
- [ ] All four variables above are covered, driven by the registry rather than four special cases
- [ ] A test asserts **both** directions for every variable declaring a `productionShape`
- [ ] `.env.example` and `turbo.json` are unchanged — this adds no variable

---

### #63: The ticket capability map stops at #37

**Milestone:** M4.5 | **Priority:** P1 High | **Status:** Backlog | **Capabilities:** `core`
**Blocked by:** None

**Found 2026-08-28**, running the pre-ticket gate for #61: `pnpm preflight --ticket 61`
exits 2 with `Unknown ticket #61. Known tickets: 0 … 37.`

`TICKET_CAPABILITIES` in `packages/shared/src/env/tickets.ts` mirrors the Capabilities
column of the Status Board, and it stopped being updated after **#37**. Every ticket filed
since — **#38 through #62, twenty-five rows** — has no entry, so the gate the project
convention requires before a ticket moves to `In Progress` cannot be run for any of them.

**Why it cannot be fixed one row at a time.** `registry.test.ts` asserts the registered
ticket numbers are contiguous from `0` — deliberately, so a live board ticket with no
registry row is caught. Adding only `61` fails that test. The whole range comes across at
once or none of it does.

**Scope — `packages/shared/src/env/tickets.ts`:**
- Add rows `38`–`62`, each mirroring its Capabilities column on the Status Board.
- Carry the existing conventions: lettered splits share the parent number, `core` and
  `e2e` are implicit and omitted, retired numbers keep a row labelled `RETIRED`.
- Comment any row whose capabilities are not obvious from its title, as the file already
  does for `#26`, `#32` and `#34`.

**The class of defect, not just this instance.** The map drifts because nothing ties it to
the board. Close it with an executable guard rather than a note: a test that fails when the
highest registered ticket falls behind the highest ticket on the Status Board, or a
generator that reads the board. A written reminder is what already failed here.

**Acceptance:**

- [ ] `pnpm preflight --ticket <n>` runs for every open ticket on the Status Board
- [ ] Each added row matches its Capabilities column exactly
- [ ] The contiguity test passes without being weakened
- [ ] A guard fails when a new board ticket is filed with no registry row

---

### #62: Stripe public business name is "VendYou", not Orla

**Milestone:** M4.5 | **Priority:** P1 High | **Status:** Blocked — needs a human | **Capabilities:** `core` `stripe`
**Blocked by:** Stripe dashboard — only the account holder can change it

**Found 2026-08-28**, from `stripe config --list` while setting up #9's credentials:
`display_name = 'VendYou'` on `acct_1Thej…`. The account was created long ago and carries
a business name that is not the product's.

Stripe renders the **platform's** public business name on hosted surfaces this MVP sends
real people to:

- the **hosted Connect Express onboarding page** a vendor is redirected to in **#9**
- **Checkout** in **#10**
- the **statement descriptor** on a cardholder's bank statement

The user-facing name is **Orla**, read from `BRAND_NAME` — a vendor being asked to hand
over bank details on a page branded with a different company is a trust failure, not a
cosmetic one.

**Three distinct fields, and they are not equally easy:**

| Field | Where it shows | Difficulty |
| --- | --- | --- |
| Account name | Dashboard label only, internal | Settings → Account details. Free to edit |
| **Public business name** | Checkout, Connect onboarding, receipts | Settings → Business → Public details. Editable — **this is the one that matters** |
| Legal business name | Verification, payouts, tax | Needs re-verification, often Stripe Support with documents |

**Not a blocker for local work.** The sandbox renders the same wrong name harmlessly, and
#9 and #10 can both be built and browser-verified with it in place. This is a **launch
prerequisite** and belongs with **#19**, not ahead of it.

**Acceptance:**

- [ ] Public business name reads **Orla** on the hosted Connect onboarding page, verified by opening a real test Account Link — not by reading the settings form back
- [ ] Checkout renders Orla
- [ ] Statement descriptor is set deliberately and recorded in the decisions file
- [ ] `stripe config --list` no longer reports `display_name = 'VendYou'` (re-login; the CLI caches it)
- [ ] Legal entity name checked, and either correct or a support ticket is open

---

### #65: Vendor profile — the identity row overlaps the cover by 34px, not 16px (reported by the user)

**Milestone:** M3 | **Priority:** P1 High | **Status:** Backlog | **Capabilities:** `core`
**Blocked by:** None

**Reported by the user 2026-08-28** on `/vendors/june-harlow`: the avatar circle does not
sit right against the business name, and the name creeps into the cover image.

**Measured at 1440x900, live against frame `03` rendered from `Orla - Screens.dc.html`:**

| | Live | Frame `03` |
| --- | --- | --- |
| Avatar overlaps the banner | **34px** | **16px** |
| Name box top vs banner bottom | **11px inside** the image | **7px clear** below it |
| Name mid − avatar mid | +0.15px | +0.15px |

**The centering is already correct** and is not what to change — the name's first line is
centred on the avatar to within 0.15px in both, exactly as **#56** measured. The whole row
rides **18px too high**, which buries the circle in the photograph and drags the name's
line box up across the banner's bottom edge. That is what reads as bad alignment.

**Cause.** Frame `03` separates the banner from the identity row with a wrapper carrying
`padding-top: 18px`, and only then pulls the row up by `-34px` — a net overlap of **16px**.
The app copied the `-34px` and not the 18px:

```
FRAME    banner(196) -> wrapper[padding-top:18px] -> row[margin-top:-34px]   = -16
LIVE     cover(196)  -> container[px-4 ... no pt]  -> row[-mt-[34px]]        = -34
```

The container is `apps/web/src/components/vendors/profile/profile-header.tsx:80`
(`mx-auto w-full max-w-7xl overflow-visible px-4 sm:px-6 lg:px-8`). **Fix verified by
injection before filing:** setting `padding-top: 18px` on it reproduces the frame exactly —
`overlap 16 · name 7px clear · centering 0.15`.

**Why the two prior tickets missed it, which is the part that must not repeat.**
**#53** asserted "overlap exactly **34px**" — but 34 is the *margin-top value*, not the
avatar's rendered relationship to the banner's bottom edge, and in the frame those differ
by precisely the 18px it never accounted for. **#56** then measured the centering
(correctly) and closed as no-change without measuring the banner relationship at all. Both
verified a number the frame's own layout does not produce. **The regression test must
assert the rendered overlap — cover bottom minus avatar top — not the margin value**, or
the same blind spot returns with the next revision.

**Acceptance:**

- [ ] `pt-[18px]` (or equivalent) on the identity-row container, so the avatar overlaps the cover by **16px**, not 34px
- [ ] The business name's box sits **7px clear** below the cover's bottom edge — no part of it over the image
- [ ] Name-mid to avatar-mid stays within **0.5px**, so #56's centering is not traded away for the fix
- [ ] A test asserts the **rendered overlap** (`cover.bottom - avatar.top === 16`), never the margin value
- [ ] Re-measured at 1440 / 1280 / 1024 / 768 / 390 — the overlap holds and the avatar is never clipped, per #53's structural test
- [ ] Checked on a vendor **with** a cover photo and one **without** (the placeholder banner), since the defect is only visible against real imagery
- [ ] Parity gate re-run on frame `03` at 1440x900

---

### #66: Unvalidated URL input crashes six ways into a 500

**Milestone:** M3 | **Priority:** P0 Critical | **Status:** Done | **Capabilities:** `core`
**Blocked by:** None

Found by adversarial sweep 2026-08-28, passes 1 and 2. **Every one of these is a URL a
person can paste into Slack**, and every one returns HTTP 500 with the generic "Something
broke on our end" page.

| URL | Status | Root cause |
| --- | --- | --- |
| `/search?date=not-a-date` | **500** | `search-shell.tsx:240` |
| `/search?date=2026-13-45` | **500** | same |
| `/search?date=0000-00-00` | **500** | same |
| `/search?date=2026-08-28T12:00:00Z` | **500** | same — a plausible ISO timestamp |
| `/vendors/JUNE-HARLOW` | **500** | `vendor-data.ts:256` — uppercase alone |
| `/vendors/<script>`, `/vendors/%00`, `/vendors/..%2F..%2Fetc`, 300-char slug | **500** | same |
| `/search?minPriceCents=2147483648` | **500** | int4 overflow; `2147483647` returns 200 |

**Cause 1 — date.** `search-shell.tsx:240` runs
`AVAILABILITY_DATE_FORMATTER.format(new Date(\`${state.date}T00:00:00Z\`))`. An unparseable
string yields `Invalid Date` and `Intl.DateTimeFormat.format` throws
`RangeError: Invalid time value`. Line 255 repeats the pattern for `droppedPastDate`.

**Cause 2 — slug.** `vendor-data.ts:256` maps only `statusCode === 404` to `null`. The API
returns **400** for a slug that fails its schema, which rethrows into the error boundary.
An identifier that cannot exist is a 404, not a 500.

**Cause 3 — price.** Zod bounds `minPriceCents` below (`-500` gives a clean 400) but not
above, so the value reaches Postgres and overflows `int4`. The filter chip also renders the
incoherent `$21,474,836.48 – $10,000+`.

The governing rule is now `.claude/rules/web-route-boundaries.md`, added 2026-08-28.

**Acceptance:**

- [ ] Every URL in the table above returns **200** (or 404 for a genuinely absent vendor), never 500
- [ ] `searchParams` and `params` are parsed with the screen's Zod schema **before** any component formats, compares or queries with them
- [ ] An invalid filter value is **dropped and the screen renders without it**, with a line saying it was cleared — matching how a past date is already handled correctly today
- [ ] A 400 caused by an identifier that cannot exist maps to `notFound()`; decided in the data function, not the page
- [ ] `minPriceCents` / `maxPriceCents` are bounded above by `MAX_PACKAGE_PRICE_CENTS` in the shared schema, so the API returns 400 rather than 500
- [ ] The heading is derived from the **same parsed value** the body used — no more "0 vendors free on Mon, Mar 2" above "the request failed"
- [ ] No raw upstream error string reaches the user (see #72)

**Tests (required):**

- [ ] A table-driven route test asserting the **status code** for every hostile input above. This is the class of defect no happy-path test covers, so the test must be the table, not one example.
- [ ] A unit test for the date guard: `Invalid Date` never reaches an `Intl` formatter.
- [ ] A unit test asserting a 400 from `getPublicVendorProfile` returns `null` (→ `notFound()`), and a 500 still throws.
- [ ] A shared-schema test asserting `minPriceCents` above the cap fails validation.

---

### #67: `POST /booking-requests` has no idempotency — three clicks created three bookings

**Milestone:** M3 | **Priority:** P0 Critical | **Status:** In Progress | **Capabilities:** `core` `auth`
**Blocked by:** None

Found by adversarial sweep 2026-08-28, pass 2 (H1). On
`/vendors/wren-field/request?package=…`, three `click()` calls in a single tick produced
**three `POST /booking-requests` → three `201`**, and `/bookings` then rendered
`MARCH 2027 · 3 bookings` with three byte-identical cards.

**The existing mitigation and its exact limit.** The submit button unmounts synchronously on
first click, so a *physical* double-click is safe — verified: a 40ms `clickCount:2` and, with
the POST delayed 1.5s, a 400ms-apart two-click both produced exactly **one** POST. **The
defect is entirely server-side.** Nothing dedupes, so any client retry, a mobile
touch+click double-fire, or a network-level retry creates duplicates. There is no
customer-side withdraw route (see #68), so all three sit in the vendor's queue permanently.

This is the highest-severity finding in the sweep: it is silent, it is user-visible on the
vendor side, and it corrupts the vendor's most important surface.

**Acceptance:**

- [ ] `POST /booking-requests` is idempotent. Prefer a natural key — one pending request per `(customerId, vendorId, eventDate, packageId)` — enforced by a **unique partial index**, so concurrency is settled by the database rather than by application timing
- [ ] A duplicate returns the **existing** request (200 with the original id), not a second 201 and not a 500 from a constraint violation
- [ ] The unique index is added in a Drizzle migration generated with `pnpm db:generate`, never hand-edited
- [ ] The three duplicate Wren & Field bookings and the `9999-12-31` booking created during testing are cleared from the dev database

**Tests (required):**

- [ ] An API test firing **concurrent** identical requests with `Promise.all` and asserting exactly one row is created and every response carries the same id. A sequential test does not exercise the race and does not count.
- [ ] A test asserting the constraint violation surfaces as the existing record, not a 500.
- [ ] A DAO test asserting the partial index only covers pending requests, so a customer may legitimately rebook the same vendor for the same date after a withdrawal.

---

### #68: An accepted, priced booking dead-ends — no detail, no quote approval, no checkout

**Milestone:** M3 | **Priority:** P0 Critical | **Status:** Backlog | **Capabilities:** `core` `auth` `stripe`
**Blocked by:** #9, #10

Found by adversarial sweep 2026-08-28, pass 2 (M5). On `/bookings`, the `ACCEPTED`
Northgate Sound booking (`$1,200 · Fair Market`) links to `/vendors/northgate-sound` — the
**marketing profile**. All 11 booking cards link to `/vendors/<slug>`; the only other links
on the page are `?tab=`, `/customer/profile` and `/search`.

The product promises, in copy already shipped: "**Payment is held.** Your money reaches the
vendor after the event" and "you approve before any card is charged". **There is no
affordance anywhere in the customer surface to view a booking, approve a quote, or pay.**

Consequence for the sweep: frames `05 Checkout`, `06 Booking confirmed` and
`21 Checkout declined` have **no live screen to compare against**, so parity on three
frames is currently unprovable. Also blocks any customer-side withdraw, which is why #67's
duplicates cannot be cleaned up from the UI.

This is feature work that #9 and #10 already own. Filed so the **dead end on an accepted,
priced booking is tracked as a user-visible state today**, not only as unbuilt scope.

**Acceptance:**

- [ ] A booking detail route exists and every booking card links to it rather than to the vendor's marketing profile
- [ ] From detail, a customer can approve a quote and reach checkout
- [ ] A customer can withdraw a pending request
- [ ] Frames `05`, `06` and `21` become drivable and are added to the parity sweep ledger

**Tests (required):**

- [ ] A route test asserting a booking card's `href` resolves to the booking detail route, not `/vendors/<slug>`.
- [ ] An authorization test: a customer cannot open another customer's booking detail.
- [ ] A browser pass driving request → accept → approve → checkout → confirmed.

---

### #69: Filter popovers are unreachable below 1440 and stay open after use

**Milestone:** M3 | **Priority:** P1 High | **Status:** Backlog | **Capabilities:** `core`
**Blocked by:** None

Found by adversarial sweep 2026-08-28, passes 1, 2 and parity batch 1. The Languages
popover is **719px tall with no `max-height` and no internal scroll** (`overflow: visible`,
zero scrollable descendants), and `/search` sets `overflow: hidden` on both `html` and
`body`, so there is no page scroll to compensate.

| Viewport | Behaviour | Measured |
| --- | --- | --- |
| **1024x768** | Bottom-clipped | Panel spans y=113→832 in a 768px viewport. `Haitian Creole` bottom 793, `ASL/Sign Language` bottom 822 — both below the fold. Wheel does nothing (`scrollY` stays 0). A real `click()` on `ASL/Sign Language` **times out**; the URL never changes |
| **390x844** | Top-clipped | Radix flips the panel to **y=-77**; `English` measures y=-40/bottom=-19. Clicking it **times out**. First legible row is a half-cut "Spanish" |
| **1440x900** | Fits (832 < 900) | Any browser chrome eating 70px reproduces the 1024 failure at desktop size |

The landing page's vendor-type combobox already does this correctly (`max-h-72`,
`overflow-y: auto`), so the fix is to apply the existing pattern.

**Separately** (parity batch 1): choosing a value in the **Rating** or **Price** popover
applies it but **leaves the panel open**, and the 280x147 panel then occludes the results
heading and the first result card.

**Acceptance:**

- [ ] Every popover caps its height against the viewport and scrolls internally — same idiom as the vendor-type combobox
- [ ] Every option in every filter is clickable at **1440, 1024, 768 and 390**
- [ ] A single-select popover closes on selection; a multi-select stays open deliberately and says so
- [ ] No popover renders with a negative `x` or `y`

**Tests (required):**

- [ ] A component test asserting the panel's `max-height` is bounded and `overflow-y` is `auto`.
- [ ] A browser assertion, at all four viewports, that every filter option's rect is fully inside the viewport and a real click changes the URL. Assert the **rect**, not merely that the element exists — every one of these options existed in the DOM while being unclickable.

---

### #70: The app is broken below 768px — messaging is a dead end, notifications render off-screen

**Milestone:** M3 | **Priority:** P1 High | **Status:** Backlog | **Capabilities:** `core`
**Blocked by:** None

Found by adversarial sweep 2026-08-28, pass 2 (H4, H5). 390x844 is a **designed
breakpoint** — frames `14 Landing mobile`, `14 Search mobile`, `14 Vendor profile mobile`,
`14 Vendor dashboard mobile` all exist.

**H4 — `/messages` locks the customer into one thread.** The conversation list is
`<aside class="… max-md:hidden">` with `display: none`. All three conversation buttons
measure `width: 0` and `offsetParent === null`. There is no back button and no thread
switcher; the hamburger opens the Clerk account menu, not the list. Boundary confirmed: at
767px `convClickable: 0`, at 768px `convClickable: 2`.

**H5 — notifications panel renders at `x = -80`.** A fixed 360px panel right-aligned to a
trigger whose right edge is at x=280. Measured clipped nodes at x=-63: title renders as
**"ons"**, item as **"ccepted"**, body as **"is held. Payment confirms the booking."** —
**the date is the part cut off**, so the user is told a date is held without being told
which. Fits at 768, 1024, 1440.

**Acceptance:**

- [ ] Below 768px `/messages` offers a thread list or a back affordance — no state is reachable with no way out
- [ ] The notifications panel is constrained to the viewport (`max-width`, collision-aware placement) and never renders at negative `x`
- [ ] Every designed mobile frame is driven and no content is clipped off any edge

**Tests (required):**

- [ ] A browser assertion at 390x844 that every interactive element's rect is fully within `[0, innerWidth] x [0, innerHeight]`. This catches both defects and the whole class.
- [ ] A test asserting `/messages` at 390 exposes a control that reaches a second thread.

---

### #71: Long tokens are never broken — one pasted link overflows its bubble

**Milestone:** M3 | **Priority:** P1 High | **Status:** Backlog | **Capabilities:** `core`
**Blocked by:** None

Found by adversarial sweep 2026-08-28, passes 1 and 2 (H6, P1-8).

**Message bubbles.** Computed style is `overflow-wrap: normal; word-break: normal`.
- A 160-char Google-Photos share URL: the `<p>` measures `clientWidth 680 / scrollWidth 768` — it overflows its own bubble by 88px and visibly runs past the rounded edge.
- 5000 `Q`s: `<p>` `scrollWidth 53677` in a 680px bubble; the ancestor with `overflow-x: auto` reports `clientWidth 1140 / scrollWidth 54116`.

**Pasting a gallery link to a photographer is the single most likely message in this
product.**

**Search heading.** A 600-char `?city=` produces an `h1` measuring **5386.13px wide** in a
1440px viewport, with no `word-break` or truncation.

**Both are invisible to a page-level overflow assertion** — `document.scrollWidth` stays
1440 because an ancestor clips them. That is why the existing checks never caught either.

**Acceptance:**

- [ ] Message bubbles set `overflow-wrap: anywhere` (or `break-words`) so no content escapes its bubble at any length
- [ ] Any user- or URL-supplied string rendered into a heading has a truncation or wrapping rule
- [ ] The composer has a `maxLength` matching `MESSAGE_MAX_LENGTH` (5000), a visible counter, and a server-side cap — today it has none of the three, and the textarea grows to 907px, taller than a 900px viewport

**Tests (required):**

- [ ] A component test asserting `scrollWidth <= clientWidth` on the bubble for a 5000-char unbroken token **and** for a long URL. Assert on the **element**, not the document — the page-level assertion passes while the bubble is broken.
- [ ] An API test asserting a message over `MESSAGE_MAX_LENGTH` is rejected with 400.

---

### #72: Error and empty-state copy violates `40-states.md` in five places

**Milestone:** M3 | **Priority:** P1 High | **Status:** Backlog | **Capabilities:** `core`
**Blocked by:** None

Found by adversarial sweep 2026-08-28, passes 1 and 2. `40-states.md` requires every error
to say **what happened in the user's words — not the exception**, to say **how to fix it**,
and to offer **one primary action**.

| # | Where | Observed | Required |
| --- | --- | --- | --- |
| 1 | `/search` with any invalid filter | Raw API string **"Request validation failed"**, no action, under a heading claiming success | Approved copy from `31-content-voice.md` + one action |
| 2 | `/search?minPriceCents=2147483648` | **"Internal server error"** verbatim, no Retry, no "clear filters" | ditto |
| 3 | Tag/language/dietary empty state | Names a **"style" filter that does not exist** on the screen (chip reads "Languages · 2") | Name the filter actually at fault, as city/price/rating/date already do correctly |
| 4 | `?name=` no results | **"No vendors listed yet"** — false, 17 exist — blames vendor type and city, which the user never touched, and offers **no CTA at all** | Name the name filter, offer one-tap relaxation. Same gap on `?category=` |
| 5 | `/customer/profile` City > 100 chars | Bare **`Invalid input`** at the submit bar, after the Guests fields, no field named, no counter, no `maxLength` | A counted summary linking to the field — the same form's guest-range message ("The smaller number goes first — swap them and this will save.") is exemplary and shows the intended standard |

Also: the notifications panel renders a **raw ISO date** — "`2026-12-19` is held" — where
every other date in the product is formatted ("Sat, Dec 19").

**Acceptance:**

- [ ] No upstream error string reaches a user-facing surface; the detail is logged instead
- [ ] Every empty state names the filter actually responsible and offers at least one recovery action
- [ ] Every validation message names its field and says how to fix it
- [ ] Every user-facing date is formatted
- [ ] `City` carries a `maxLength` matching the API's 100-char cap, so the error cannot be reached by typing

**Tests (required):**

- [ ] A test asserting no rendered error string matches the upstream shapes (`/^Request validation failed$/`, `/^Internal server error$/`, `/^Invalid input$/`).
- [ ] A test per empty state asserting the named filter matches the filter actually applied.
- [ ] A test asserting no user-facing node matches `/\d{4}-\d{2}-\d{2}/`.

---

### #73: The six accessibility laws are violated and nothing was checking them

**Milestone:** M3 | **Priority:** P1 High | **Status:** Backlog | **Capabilities:** `core`
**Blocked by:** None

`04-laws.md` fixes six accessibility laws and `01-foundations.md` carries a contrast table
headed *"these were failures we already fixed, do not regress"*. **Neither had any
checker** — `parity-checker` covered five axes, none of them access. A sixth `Access` axis
was added 2026-08-28; these are what it and the sweep found first.

| # | Law | Violation |
| --- | --- | --- |
| 1 | Focus ring `ring-2 ring-clay-400/30 ring-offset-2 ring-offset-stone-50` | **Invisible on every vendor card**, landing and search. The ring is entirely outward on an `<a>` that exactly fills an `overflow:hidden` `<article>` (both rects `331.25 x 357.23`), so it is 100% clipped. `:focus-visible` is `true` and nothing renders — the primary interaction of the whole app has no keyboard indicator |
| 2 | Focus ring | Hero search segments **suppress their own ring** (`focus-visible:ring-0`) for one bar-level `ring-3 clay/0.2 offset-0`. A keyboard user cannot tell which of Vendor type / City / Event date has focus |
| 3 | Icon-only controls carry `aria-label` **and a 44x44 hit area** | `/search` header submit is **32x32**. It is the query's submit, and the frame specifies a text pill reading `Search`, so this is one fix across Access, Style and Text |
| 4 | Modals trap focus, close on Escape, restore focus | **Escape dismisses neither** the Filters drawer nor the Notifications panel (verified at 1440, 1024, 768, 390). The drawer has no `role="dialog"`, no focus trap and no in-panel close; focus never enters it |
| 5 | Contrast ≥ 4.5:1 | Landing `How it works` numerals are `clay-200 #EFD8CC` on `stone-100 #F4F0E8` = **1.20:1**. They are `aria-hidden` and `10-landing.md:116` specifies clay-200, but `04-laws.md` grants no decorative exemption — **needs an explicit ruling, then either an exemption clause or a token change** |
| 6 | Tabs | Vendor profile tablist is not a roving tabstop: all five `role="tab"` buttons are individual Tab stops |

**Acceptance:**

- [ ] The card focus ring is visible — inset ring, ring on the `overflow:hidden` element itself, or clearance for the outward ring
- [ ] Each hero search segment shows its own focus ring at the law's exact value
- [ ] Every icon-only control is ≥44x44 with an `aria-label`
- [ ] Escape closes the Filters drawer and the Notifications panel; the drawer gets `role="dialog"`, a focus trap and a close control
- [ ] `04-laws.md` states explicitly whether `aria-hidden` decorative text is exempt from 4.5:1 — and the numerals then either comply or are covered by the written exemption
- [ ] The tablist is a roving tabstop with arrow-key navigation

**Tests (required):**

- [ ] A browser assertion that a focused element's ring is **within its nearest `overflow:hidden` ancestor's rect**. Computing the correct `box-shadow` is what already passes today while rendering nothing, so the test must assert visibility, not the value.
- [ ] A test asserting every element with an `aria-label` and no text has a rect ≥ 44x44.
- [ ] A test per overlay asserting Escape closes it and focus returns to the trigger.
- [ ] A contrast test over the rendered tree asserting every non-`aria-hidden` text node clears 4.5:1, seeded with the exact pairs in `01-foundations.md` that already failed once.

---

### #74: Adopt the frames' line-height — the app's type scale contradicts every frame

**Milestone:** M3 | **Priority:** P1 High | **Status:** In Progress | **Capabilities:** `core`
**Blocked by:** None

**Ruled by the user 2026-08-28: follow whichever matches the HTML screens most accurately.
The frames win.**

The frames set no `line-height` on any UI class, so every control computes `normal`. The app
applies the `01-foundations.md` scale ratios. Measured from the frame's `<style>` block:

| Frame class | font-size | line-height |
| --- | --- | --- |
| `.inp` `.nav` `.btnP` `.btnS` | 13.5px | **normal** |
| `.pill` | 10px | **normal** |
| `.lbl` `.tl` | 10.5px | **normal** |
| `.h2` | 26px | **normal** |
| `.sh` | 21px | **normal** |
| `.tn` | 11.5px | 1.5 |

Of the frame's UI classes only `.tn` sets a line-height. (`.sc-t` 1.2 and `.sc-d` 1.4 are
canvas chrome — the screen title and description outside the frames — not UI.)

Consequence today: every pill, chip, button and card is **3–7px taller than its frame
counterpart** — landing pills 33 vs 29, category cards 164 vs 158, search chips 35 vs 31,
`Request booking` 50 vs 43, profile chip 27 vs 24. This currently blocks a clean parity
verdict on **every screen in the product**.

**Acceptance:**

- [ ] `01-foundations.md`'s scale table records the frames' values, `.tn`'s 1.5 included, and notes it was derived from the frame markup on 2026-08-28
- [ ] The Tailwind/theme type scale matches, so control heights equal their frame counterparts
- [ ] The five measured controls above match the frame exactly at 1440x900
- [ ] Long-form prose keeps a readable measure — if any body copy needs a ratio the frames do not set, it is recorded as a named exception with its reason, not applied silently

**Tests (required):**

- [ ] A parity assertion comparing the rendered height of `.btnP`, `.pill`, `.lbl`, `.inp` and the card against the same class rendered from `Orla - Screens.dc.html`. Derive the expectation from the frame at test time rather than hard-coding pixels, so the test cannot drift from the contract.

**Outcome 2026-08-29 — delivered, criteria half-met. Do not close as fully met.**

Shipped: every `--text-*--line-height` is `normal`, matching the frames; `display-xl`
corrected 1.08 → 1.04; `--leading-prose: 1.6` added as the one named exception, with
`.tn`'s 1.5 left as Tailwind's existing `leading-normal` rather than given a second
name; 21 long-form prose sites given an explicit measure; all 16 arbitrary
`leading-[1.6]`/`leading-[1.5]` literals normalised.

Browser-measured at 1440x900, frame vs live, `getBoundingClientRect`:

| Control | Frame | Live | Verdict |
| --- | --- | --- | --- |
| Landing pill | 29.00 | 29.00 | closed (was 33) |
| `Request booking` `.btnP` | 42.50 | 44.50 | line-height closed exactly; +2.00 is a transparent border the frame lacks |
| Category card | 157.50 | 163.75 | **not closed, +6.25** |
| Search refine chip | 31.00 | 34.75 | **not closed, +3.75** |
| Vendor-profile chip | 24.00 | 27.25 | **not closed, +3.25** |

**Every control that closed uses a named scale step; every one that did not uses an
arbitrary `text-[Npx]`,** which emits `font-size` alone and inherits Preflight's
`html{line-height:1.5}`. That is **#235**, filed with the compiled-CSS evidence, and
it is the remainder of this ticket's third acceptance bullet. The hero was confirmed
at exactly 1.040 and no prose collapsed — all measured at 1.600.

**The required test was substituted, deliberately.** A rendered-height assertion is
not reachable in CI: `ci.yml` installs no browsers, there is no Playwright runner in
the repo, and the web suite is jsdom, which performs no layout. `apps/web/src/app/
type-scale-parity.test.ts` instead derives every expectation from the frame file at
test time — a stronger guard against design re-import drift than a pixel snapshot,
but it does **not** discharge the acceptance bullet, which is why the browser
measurement above is recorded rather than asserted. #235 should carry the
call-site guard (`text-[<n>px]` must ship with a `leading-*`), which fails on 96
sites today and so cannot land before the fix.

**Frame `02 Search` was not parity-checked** — a lane CORS misconfiguration blocked
the result grid. See `.claude/plans/lane-infrastructure-findings.md`.

---

### #75: ROLLUP — Landing, Search and Vendor profile parity (35 findings)

**Milestone:** M3 | **Priority:** P0 Critical | **Status:** Backlog | **Capabilities:** `core`
**Blocked by:** #74

**This is a rollup, not a unit of work.** Each of the 35 findings is now its own ticket with
its own acceptance criterion and test: **#82 – #116**. Fix those; close this when they are all
closed. Full `expected` vs `observed` tables are in `.claude/plans/parity-sweep-ledger.md`.

Verdicts from parity batch 1, six axes at 1440x900 signed out:
`01 Landing` **FAIL (8)** — #82–#89 · `02 Search` **FAIL (13)** — #90–#102 ·
`03 Vendor profile` **FAIL (14)** — #103–#116.

**Acceptance:**

- [ ] #82 – #116 are all closed
- [ ] `parity-checker` returns PASS on all six axes for frames `01`, `02`, `03`
- [ ] Only real content, real data volume and real photography differ

---

### #76: Sign-in redirect discards the destination

**Milestone:** M3 | **Priority:** P1 High | **Status:** Backlog | **Capabilities:** `core` `auth`
**Blocked by:** None

Found by pass 2 (L5) and parity batch 1 (PB1-35). Signed out, `Request booking` on a vendor
profile → `/vendors/june-harlow/request?package=…` → redirects to **`/sign-in` with no
`redirect_url`** (verified `location.search === ""`). After authenticating the visitor lands
on `/` and the booking they started is gone. Same for `/bookings`, `/messages`,
`/customer/profile` and `/dashboard`.

Requesting a booking is the vendor profile's entire purpose per `12-vendor-profile.md`, and
this drops the user at the exact moment of intent.

**Acceptance:**

- [ ] Every auth redirect carries the originating path **and its query string**, and returns there after sign-in
- [ ] The return target is validated as a relative in-app path — an absolute or protocol-relative URL is rejected, never used as an open redirect
- [ ] A customer landing on a vendor-only route still redirects by role, not to the attempted path

**Tests (required):**

- [ ] A test per guarded route asserting the redirect preserves path + query.
- [ ] **An open-redirect test**: `?redirect_url=https://evil.example` and `//evil.example` must not be honoured. This is a security boundary, so it is not optional.

---

### #77: Event date has no upper bound — a booking for the year 9999 goes through

**Milestone:** M3 | **Priority:** P2 Medium | **Status:** Backlog | **Capabilities:** `core`
**Blocked by:** None

Found by pass 2 (M3). Setting Event date `9999-12-31` on
`/vendors/june-harlow/request?package=…`: the form asserts "**June Harlow is free on this
date**", the review step reads "December 31, 9999", the request is created (**201**), and it
now sits in `/bookings` under a `DECEMBER 9999` group and in the vendor's queue. The hub
then offers "Search Dec 31" → `/search?date=9999-12-31` → "**17 vendors free on Fri, Dec
31**" — every vendor claimed available 7,973 years out.

The lower bound is handled well by contrast (`min="2026-08-28"` on the input; a past date in
the URL is cleared with good copy), which is what makes the missing upper bound an
oversight rather than a design choice.

**Acceptance:**

- [ ] The event date is bounded above in the **shared Zod schema**, so the API rejects it regardless of client — derive the horizon from a named constant (e.g. `MAX_BOOKING_HORIZON_DAYS`), not a literal
- [ ] The input carries the matching `max` attribute
- [ ] Availability copy never claims a vendor is free beyond the horizon
- [ ] The `9999-12-31` booking created during testing is cleared from the dev database

**Tests (required):**

- [ ] A shared-schema test asserting a date beyond the horizon fails validation, and the day before it passes — assert both sides of the boundary.
- [ ] An API test asserting `POST /booking-requests` rejects it with 400.

---

### #78: `DrizzleQueryError` is logged without its cause

**Milestone:** M3 | **Priority:** P2 Medium | **Status:** Backlog | **Capabilities:** `core`
**Blocked by:** None

Observed 2026-08-28 during the sweep: seven `"level":50` entries on `GET /vendors` and the
category-facet query. Every one logs `err.message` — the SQL text — and **`cause` is
absent**, so the actual Postgres error is discarded. The queries succeed on retry, so the
failures look transient; there is currently **no way to find out what they were**.

This is the `async-and-errors` defect class: the handler catches, logs something, and throws
away the half that would let anyone diagnose it.

**Acceptance:**

- [ ] The error serializer records `cause` — its `code`, `detail`, `constraint` and `message` — for any wrapped driver error
- [ ] A wrapped error's chain is logged to full depth, not just the outermost layer
- [ ] No credential or connection string can reach the log through the cause

**Tests (required):**

- [ ] A unit test on the serializer: given an error wrapping a cause, the output contains the cause's `code` and `detail`.
- [ ] A test asserting a cause carrying a connection string is redacted.

---

### #79: Vendor nav labels and order diverge from frame 08

**Milestone:** M3 | **Priority:** P2 Medium | **Status:** Backlog | **Capabilities:** `core`
**Blocked by:** None

| | Entries |
| --- | --- |
| Frame `08` | `Dashboard, Requests, Bookings, Messages, Availability, Packages, Edit profile, Payments` |
| Live (`vendor-nav.tsx:23-27`) | `Dashboard, Business profile, Packages, Portfolio, Availability` |

**`Edit profile` vs `Business profile` is a text-axis failure** and the ordering is a
layout-axis failure — both are in scope now. The **missing** entries (Requests, Bookings,
Messages, Payments) map to deferred work (#9 Stripe, #10 payments, #12 reviews), so their
absence may be correct; `Portfolio` is live but appears in the frame only as a tab inside
frame `09`.

**Acceptance:**

- [ ] The label reads exactly what frame `08` says
- [ ] Present entries appear in the frame's relative order
- [ ] Each frame entry with no route is recorded against its deferring ticket, or added
- [ ] `Portfolio` as a separate route rather than a tab in the editor is either ruled an approved deviation or aligned to frame `09`

**Tests (required):**

- [ ] A component test asserting the rendered nav labels and their order equal the expected list, derived from frame `08`'s markup rather than hard-coded.

---

### #80: Five live routes have no design frame, so parity is unprovable on them

**Milestone:** M3 | **Priority:** P2 Medium | **Status:** Backlog | **Capabilities:** `core`
**Blocked by:** None

Frame-to-route mapping, 2026-08-28: **38 frames against 15 routes**. These five ship to
users with **no acceptance criterion at all**:

`/customer/profile` · `/sign-in` · `/suspended` · `/vendor/packages` · `/vendor/portfolio`

`/vendor/packages` and `/vendor/portfolio` do appear as **tabs inside frame `09`** — the app
split them into routes, which is itself a composition divergence (see #79). `/sign-in` may
be legitimately Clerk-hosted. `/customer/profile` and `/suspended` have no coverage of any
kind, and `/customer/profile` already produced a finding (#72 item 5).

Frame `13 Admin` correctly has no route — that is ticket #15.

**Acceptance:**

- [ ] Each of the five is given a frame, or recorded in the design plan as deliberately unframed with the reason
- [ ] `.claude/plans/parity-sweep-ledger.md` reaches full coverage in both directions — no live route without a frame, no frame without a route or a ticket
- [ ] The ledger's route column is regenerated so the mapping is checked, not assumed

**Tests (required):**

- [ ] A test enumerating `apps/web/src/app/**/page.tsx` and asserting each route appears in the ledger with a frame or a recorded exemption. This makes the next unframed route fail CI instead of shipping unnoticed.

---

### #81: Nine smaller defects found in the adversarial sweep

**Milestone:** M3 | **Priority:** P2 Medium | **Status:** Backlog | **Capabilities:** `core`
**Blocked by:** None

Grouped because each is a few lines; split any that grows. All found 2026-08-28.

| # | Where | Defect |
| --- | --- | --- |
| 1 | `/vendors/[slug]` | Price panel keeps the **`From`** qualifier after a specific package is chosen — reads "From $3,900" while the search card says "From $1,450" for the same vendor. Once a package is selected the price is exact |
| 2 | `/bookings` | Every card renders `<span aria-hidden class="size-9.5 rounded-[9px] bg-stone-150">` — a **blank grey swatch never populated**, on all 11 cards. `coverImageUrl` exists in the API response and initials avatars already render on `/search` and `/messages`. `40-states.md`: "a generic grey box is a bug" |
| 3 | `/messages` | **One thread per vendor**, subtitled with one arbitrary booking. A customer asking about their Jun 11 fundraiser sends it into a thread the vendor reads as "Mar 15 birthday" |
| 4 | `/search?page=2` | Blank results pane, HTTP 200, while `h1` claims "17 vendors". 17 vendors, `pageSize=20`, and **no pagination control exists** |
| 5 | `/customer/profile` | **State accepts `ZZZZZZZZZZ`** (10 chars, placeholder "TX"); `PUT /users/me` returns 200 and it survives reload |
| 6 | `/vendors/[slug]` | Tabs use history **`replace`** — one Back skips the whole page. `/search`'s Sort control correctly pushes, so this is inconsistent within the app |
| 7 | Signed-out 500 page | Secondary CTA is **"Go to my bookings"**, offered to a visitor who by definition has none |
| 8 | `/search` | Results `h1` accessible text runs on: **"17 vendorsfree on Fri, Dec 31"** — `<span>` separated only by `ml-2.5` |
| 9 | `/bookings` | Rail's `aria-label="What needs your attention"` but its content is the static "How booking works here" copy |

Also: `/search?date=2020-01-01` recovers with excellent copy but **still fires the request**,
landing a 400 in the console; and "Wed, Jan 1" omits the year for a date six years past.

**Acceptance:**

- [ ] Each row above is fixed or explicitly closed with a reason
- [ ] Seed data uses one location format — "Austin, TX" and "Austin, Texas" currently appear in one grid

**Tests (required):**

- [ ] Item 1: a test asserting the qualifier disappears once a package is selected.
- [ ] Item 2: a test asserting the card renders the vendor's image or initials, never an empty node.
- [ ] Item 4: a test asserting an out-of-range page renders an empty state whose heading agrees with the body.
- [ ] Item 5: a schema test bounding `state`.
- [ ] Item 8: a test asserting the heading's `textContent` contains a separator.

---

### #82: 01 Landing — `All 11 categories →` is rendered as a padded pill, not a plain span

**Milestone:** M3 | **Priority:** P2 Medium | **Status:** Backlog | **Capabilities:** `core`
**Blocked by:** #74

Parity sweep 2026-08-28, finding `PB1-1`. Frame **`01 Landing`** vs `/`, measured at
1440x900 from computed styles on both sides — the frame rendered from
`design/Orla - Screens.dc.html`, the live screen in the same browser.

**Axis: Style**

| | Value |
| --- | --- |
| **Expected** (frame) | plain span, `110x16`, no padding, no radius |
| **Observed** (live) | `<a>` `134x33`, `padding 6px 12px`, `border-radius 8px` |

Blocked by #74: the line-height ruling changes this element's expected metrics, so fixing it first would mean measuring twice.

**Acceptance:**

- [ ] The live element matches the frame value above, read from the DOM rather than judged from a screenshot
- [ ] `parity-checker` reports **MATCH** on the **Style** axis for frame `01 Landing`
- [ ] No other element on the screen regresses on any of the six axes as a result
- [ ] The row for `PB1-1` in `.claude/plans/parity-sweep-ledger.md` is updated to PASS

**Test (required):**

- [ ] a parity assertion comparing the element's computed `border-radius` / `padding` / `border` / `box-shadow` against the same element in the frame. Read both from the DOM; never assert a hard-coded pixel value.

---

### #83: 01 Landing — Header `Sign up` pill is 8px too tall

**Milestone:** M3 | **Priority:** P2 Medium | **Status:** Backlog | **Capabilities:** `core`
**Blocked by:** #74

Parity sweep 2026-08-28, finding `PB1-2`. Frame **`01 Landing`** vs `/`, measured at
1440x900 from computed styles on both sides — the frame rendered from
`design/Orla - Screens.dc.html`, the live screen in the same browser.

**Axis: Style**

| | Value |
| --- | --- |
| **Expected** (frame) | `82x36`, `padding 10px 18px` |
| **Observed** (live) | `86x44`, same padding — the box is taller |

Blocked by #74: the line-height ruling changes this element's expected metrics, so fixing it first would mean measuring twice.

**Acceptance:**

- [ ] The live element matches the frame value above, read from the DOM rather than judged from a screenshot
- [ ] `parity-checker` reports **MATCH** on the **Style** axis for frame `01 Landing`
- [ ] No other element on the screen regresses on any of the six axes as a result
- [ ] The row for `PB1-2` in `.claude/plans/parity-sweep-ledger.md` is updated to PASS

**Test (required):**

- [ ] a parity assertion comparing the element's computed `border-radius` / `padding` / `border` / `box-shadow` against the same element in the frame. Read both from the DOM; never assert a hard-coded pixel value.

---

### #84: 01 Landing — Hero `Search` button has the wrong box and padding

**Milestone:** M3 | **Priority:** P2 Medium | **Status:** Backlog | **Capabilities:** `core`
**Blocked by:** #74

Parity sweep 2026-08-28, finding `PB1-3`. Frame **`01 Landing`** vs `/`, measured at
1440x900 from computed styles on both sides — the frame rendered from
`design/Orla - Screens.dc.html`, the live screen in the same browser.

**Axis: Style**

| | Value |
| --- | --- |
| **Expected** (frame) | `102x43`, `padding 13px 28px` |
| **Observed** (live) | `93x44`, `padding 11px 24px` |

Blocked by #74: the line-height ruling changes this element's expected metrics, so fixing it first would mean measuring twice.

**Acceptance:**

- [ ] The live element matches the frame value above, read from the DOM rather than judged from a screenshot
- [ ] `parity-checker` reports **MATCH** on the **Style** axis for frame `01 Landing`
- [ ] No other element on the screen regresses on any of the six axes as a result
- [ ] The row for `PB1-3` in `.claude/plans/parity-sweep-ledger.md` is updated to PASS

**Test (required):**

- [ ] a parity assertion comparing the element's computed `border-radius` / `padding` / `border` / `box-shadow` against the same element in the frame. Read both from the DOM; never assert a hard-coded pixel value.

---

### #85: 01 Landing — Hero badge renders 11px instead of 12px

**Milestone:** M3 | **Priority:** P2 Medium | **Status:** Backlog | **Capabilities:** `core`
**Blocked by:** #74

Parity sweep 2026-08-28, finding `PB1-4`. Frame **`01 Landing`** vs `/`, measured at
1440x900 from computed styles on both sides — the frame rendered from
`design/Orla - Screens.dc.html`, the live screen in the same browser.

**Axis: Font**

| | Value |
| --- | --- |
| **Expected** (frame) | `12px` |
| **Observed** (live) | `11px` |

Blocked by #74: the line-height ruling changes this element's expected metrics, so fixing it first would mean measuring twice.

**Acceptance:**

- [ ] The live element matches the frame value above, read from the DOM rather than judged from a screenshot
- [ ] `parity-checker` reports **MATCH** on the **Font** axis for frame `01 Landing`
- [ ] No other element on the screen regresses on any of the six axes as a result
- [ ] The row for `PB1-4` in `.claude/plans/parity-sweep-ledger.md` is updated to PASS

**Test (required):**

- [ ] a parity assertion comparing computed `font-family`, `font-size`, `font-weight` and `letter-spacing` against the frame's values for the same element.

---

### #86: 01 Landing — Hero `Search` and `All 11 categories →` are a half-step small

**Milestone:** M3 | **Priority:** P2 Medium | **Status:** Backlog | **Capabilities:** `core`
**Blocked by:** #74

Parity sweep 2026-08-28, finding `PB1-5`. Frame **`01 Landing`** vs `/`, measured at
1440x900 from computed styles on both sides — the frame rendered from
`design/Orla - Screens.dc.html`, the live screen in the same browser.

**Axis: Font**

| | Value |
| --- | --- |
| **Expected** (frame) | `14px` and `13px` |
| **Observed** (live) | `13.5px` and `12.5px` |

Blocked by #74: the line-height ruling changes this element's expected metrics, so fixing it first would mean measuring twice.

**Acceptance:**

- [ ] The live element matches the frame value above, read from the DOM rather than judged from a screenshot
- [ ] `parity-checker` reports **MATCH** on the **Font** axis for frame `01 Landing`
- [ ] No other element on the screen regresses on any of the six axes as a result
- [ ] The row for `PB1-5` in `.claude/plans/parity-sweep-ledger.md` is updated to PASS

**Test (required):**

- [ ] a parity assertion comparing computed `font-family`, `font-size`, `font-weight` and `letter-spacing` against the frame's values for the same element.

---

### #87: 01 Landing — Category card titles carry negative tracking the frame does not

**Milestone:** M3 | **Priority:** P2 Medium | **Status:** Backlog | **Capabilities:** `core`
**Blocked by:** #74

Parity sweep 2026-08-28, finding `PB1-6`. Frame **`01 Landing`** vs `/`, measured at
1440x900 from computed styles on both sides — the frame rendered from
`design/Orla - Screens.dc.html`, the live screen in the same browser.

**Axis: Font**

| | Value |
| --- | --- |
| **Expected** (frame) | `letter-spacing: normal` |
| **Observed** (live) | `-0.425px` |

Blocked by #74: the line-height ruling changes this element's expected metrics, so fixing it first would mean measuring twice.

**Acceptance:**

- [ ] The live element matches the frame value above, read from the DOM rather than judged from a screenshot
- [ ] `parity-checker` reports **MATCH** on the **Font** axis for frame `01 Landing`
- [ ] No other element on the screen regresses on any of the six axes as a result
- [ ] The row for `PB1-6` in `.claude/plans/parity-sweep-ledger.md` is updated to PASS

**Test (required):**

- [ ] a parity assertion comparing computed `font-family`, `font-size`, `font-weight` and `letter-spacing` against the frame's values for the same element.

---

### #88: 01 Landing — Hero City field shows a placeholder where the frame has a literal

**Milestone:** M3 | **Priority:** P2 Medium | **Status:** Backlog | **Capabilities:** `core`
**Blocked by:** None

Parity sweep 2026-08-28, finding `PB1-7`. Frame **`01 Landing`** vs `/`, measured at
1440x900 from computed styles on both sides — the frame rendered from
`design/Orla - Screens.dc.html`, the live screen in the same browser.

**Axis: Text**

| | Value |
| --- | --- |
| **Expected** (frame) | the literal `Austin, TX` (frame markup line 96) |
| **Observed** (live) | placeholder `Anywhere` |

**Acceptance:**

- [ ] The live element matches the frame value above, read from the DOM rather than judged from a screenshot
- [ ] `parity-checker` reports **MATCH** on the **Text** axis for frame `01 Landing`
- [ ] No other element on the screen regresses on any of the six axes as a result
- [ ] The row for `PB1-7` in `.claude/plans/parity-sweep-ledger.md` is updated to PASS

**Test (required):**

- [ ] a test asserting the rendered literal equals the frame's literal, with the expected string read out of `Orla - Screens.dc.html` rather than duplicated into the test.

---

### #89: 01 Landing — Hero search segments share one bar-level focus ring, so the focused segment is unidentifiable

**Milestone:** M3 | **Priority:** P1 High | **Status:** Backlog | **Capabilities:** `core`
**Blocked by:** None

Parity sweep 2026-08-28, finding `PB1-8`. Frame **`01 Landing`** vs `/`, measured at
1440x900 from computed styles on both sides — the frame rendered from
`design/Orla - Screens.dc.html`, the live screen in the same browser.

**Axis: Access**

| | Value |
| --- | --- |
| **Expected** (frame) | per-segment `ring-2 ring-clay-400/30 ring-offset-2` |
| **Observed** (live) | segments set `focus-visible:ring-0`; one bar-level `ring-3 clay/0.2 offset-0`. **A keyboard user cannot tell which of Vendor type / City / Event date has focus** |

**Acceptance:**

- [ ] The live element matches the frame value above, read from the DOM rather than judged from a screenshot
- [ ] `parity-checker` reports **MATCH** on the **Access** axis for frame `01 Landing`
- [ ] No other element on the screen regresses on any of the six axes as a result
- [ ] The row for `PB1-8` in `.claude/plans/parity-sweep-ledger.md` is updated to PASS

**Test (required):**

- [ ] a browser assertion covering this law directly — and asserting the *rendered* result, not the computed value, since a correct computed value is exactly what passes today while rendering wrong.

---

### #90: 02 Search — Header is inset 40px while everything below it is inset 26px

**Milestone:** M3 | **Priority:** P1 High | **Status:** Backlog | **Capabilities:** `core`
**Blocked by:** #74

Parity sweep 2026-08-28, finding `PB1-9`. Frame **`02 Search`** vs `/search`, measured at
1440x900 from computed styles on both sides — the frame rendered from
`design/Orla - Screens.dc.html`, the live screen in the same browser.

**Axis: Layout**

| | Value |
| --- | --- |
| **Expected** (frame) | header padding `26px` (logo x=26, search bar x=107) |
| **Observed** (live) | `40px` (logo x=40, bar x=121). The Refine bar and results pane correctly use 26px |

Blocked by #74: the line-height ruling changes this element's expected metrics, so fixing it first would mean measuring twice.

**Acceptance:**

- [ ] The live element matches the frame value above, read from the DOM rather than judged from a screenshot
- [ ] `parity-checker` reports **MATCH** on the **Layout** axis for frame `02 Search`
- [ ] No other element on the screen regresses on any of the six axes as a result
- [ ] The row for `PB1-9` in `.claude/plans/parity-sweep-ledger.md` is updated to PASS

**Test (required):**

- [ ] a parity assertion comparing the element's `getBoundingClientRect()` against the same element rendered from `Orla - Screens.dc.html`. Derive the expected box from the frame at test time so the test cannot drift from the contract.

---

### #91: 02 Search — Header search bar is undersized

**Milestone:** M3 | **Priority:** P2 Medium | **Status:** Backlog | **Capabilities:** `core`
**Blocked by:** #74

Parity sweep 2026-08-28, finding `PB1-10`. Frame **`02 Search`** vs `/search`, measured at
1440x900 from computed styles on both sides — the frame rendered from
`design/Orla - Screens.dc.html`, the live screen in the same browser.

**Axis: Layout**

| | Value |
| --- | --- |
| **Expected** (frame) | `582x45` |
| **Observed** (live) | `560x42` |

Blocked by #74: the line-height ruling changes this element's expected metrics, so fixing it first would mean measuring twice.

**Acceptance:**

- [ ] The live element matches the frame value above, read from the DOM rather than judged from a screenshot
- [ ] `parity-checker` reports **MATCH** on the **Layout** axis for frame `02 Search`
- [ ] No other element on the screen regresses on any of the six axes as a result
- [ ] The row for `PB1-10` in `.claude/plans/parity-sweep-ledger.md` is updated to PASS

**Test (required):**

- [ ] a parity assertion comparing the element's `getBoundingClientRect()` against the same element rendered from `Orla - Screens.dc.html`. Derive the expected box from the frame at test time so the test cannot drift from the contract.

---

### #92: 02 Search — The `Style` filter chip is missing from the Refine bar

**Milestone:** M3 | **Priority:** P1 High | **Status:** Backlog | **Capabilities:** `core`
**Blocked by:** #74

Parity sweep 2026-08-28, finding `PB1-11`. Frame **`02 Search`** vs `/search`, measured at
1440x900 from computed styles on both sides — the frame rendered from
`design/Orla - Screens.dc.html`, the live screen in the same browser.

**Axis: Layout**

| | Value |
| --- | --- |
| **Expected** (frame) | `Price · Rating · **Style** · Languages · Cultural · Dietary` |
| **Observed** (live) | `Style` absent |

Blocked by #74: the line-height ruling changes this element's expected metrics, so fixing it first would mean measuring twice.

**Acceptance:**

- [ ] The live element matches the frame value above, read from the DOM rather than judged from a screenshot
- [ ] `parity-checker` reports **MATCH** on the **Layout** axis for frame `02 Search`
- [ ] No other element on the screen regresses on any of the six axes as a result
- [ ] The row for `PB1-11` in `.claude/plans/parity-sweep-ledger.md` is updated to PASS

**Test (required):**

- [ ] a parity assertion comparing the element's `getBoundingClientRect()` against the same element rendered from `Orla - Screens.dc.html`. Derive the expected box from the frame at test time so the test cannot drift from the contract.

---

### #93: 02 Search — Confirm the 4→3 column transition width (NOT a defect — sanctioned by B4)

**Milestone:** M3 | **Priority:** P3 Low | **Status:** Backlog | **Capabilities:** `core`
**Blocked by:** None

**Corrected 2026-08-28 after the design change order landed.** Originally filed as a P1
layout failure ("the 4-column grid only exists at exactly ≥1440"). `CHANGE-ORDER-2026-08-28.md`
Part B4 explicitly sanctions this:

> Grids lose a column before a card loses information (results 4 → 3, 14px gaps)

So dropping to three columns below the 1440 frame is **correct behaviour**, not drift. The
frame shows 4 at 1440 and the 1024 frame shows 3; the app's `lg:grid-cols-3` up to
`min-[90rem]` produces exactly that.

**What is still worth confirming** is only the *transition width* and the gap value — B4
specifies 14px gaps at 1024, and the sweep measured gap 16 at 1440.

**Acceptance:**

- [ ] The grid is 4 columns at 1440 and 3 at 1024, matching frames `02` and `27 Search results — 1024`
- [ ] Gap is 16px at 1440 and **14px** at 1024 per B4
- [ ] No card loses information at either width

**Test (required):**

- [ ] A responsive assertion at 1440 and 1024 checking column count and computed `gap` against the two frames.

---

### #94: 02 Search — Header submit is a 32x32 icon button where the frame specifies a text pill

**Milestone:** M3 | **Priority:** P1 High | **Status:** Backlog | **Capabilities:** `core`
**Blocked by:** #74

Parity sweep 2026-08-28, finding `PB1-13`. Frame **`02 Search`** vs `/search`, measured at
1440x900 from computed styles on both sides — the frame rendered from
`design/Orla - Screens.dc.html`, the live screen in the same browser.

**Axis: Style**

| | Value |
| --- | --- |
| **Expected** (frame) | clay pill `81x35`, `padding 10px 20px`, radius-full, literal text `Search` |
| **Observed** (live) | icon-only circle **32x32**, no text. Also breaches the 44x44 icon-only law |

Blocked by #74: the line-height ruling changes this element's expected metrics, so fixing it first would mean measuring twice.

**Acceptance:**

- [ ] The live element matches the frame value above, read from the DOM rather than judged from a screenshot
- [ ] `parity-checker` reports **MATCH** on the **Style** axis for frame `02 Search`
- [ ] No other element on the screen regresses on any of the six axes as a result
- [ ] The row for `PB1-13` in `.claude/plans/parity-sweep-ledger.md` is updated to PASS

**Test (required):**

- [ ] a parity assertion comparing the element's computed `border-radius` / `padding` / `border` / `box-shadow` against the same element in the frame. Read both from the DOM; never assert a hard-coded pixel value.

---

### #95: 02 Search — Header bar border and shadow are off-token

**Milestone:** M3 | **Priority:** P2 Medium | **Status:** Backlog | **Capabilities:** `core`
**Blocked by:** #74

Parity sweep 2026-08-28, finding `PB1-14`. Frame **`02 Search`** vs `/search`, measured at
1440x900 from computed styles on both sides — the frame rendered from
`design/Orla - Screens.dc.html`, the live screen in the same browser.

**Axis: Style**

| | Value |
| --- | --- |
| **Expected** (frame) | border `1px #DDD5C7`, shadow `0 1px 3px rgba(35,32,28,.04)` |
| **Observed** (live) | `1px #E4DDD1`, `0 2px 10px rgba(35,32,28,.06)` |

Blocked by #74: the line-height ruling changes this element's expected metrics, so fixing it first would mean measuring twice.

**Acceptance:**

- [ ] The live element matches the frame value above, read from the DOM rather than judged from a screenshot
- [ ] `parity-checker` reports **MATCH** on the **Style** axis for frame `02 Search`
- [ ] No other element on the screen regresses on any of the six axes as a result
- [ ] The row for `PB1-14` in `.claude/plans/parity-sweep-ledger.md` is updated to PASS

**Test (required):**

- [ ] a parity assertion comparing the element's computed `border-radius` / `padding` / `border` / `box-shadow` against the same element in the frame. Read both from the DOM; never assert a hard-coded pixel value.

---

### #96: 02 Search — Vendor card radius is 18px, not 16px

**Milestone:** M3 | **Priority:** P2 Medium | **Status:** Backlog | **Capabilities:** `core`
**Blocked by:** #74

Parity sweep 2026-08-28, finding `PB1-15`. Frame **`02 Search`** vs `/search`, measured at
1440x900 from computed styles on both sides — the frame rendered from
`design/Orla - Screens.dc.html`, the live screen in the same browser.

**Axis: Style**

| | Value |
| --- | --- |
| **Expected** (frame) | `16px` (inline override on `.card`) |
| **Observed** (live) | `18px` (`rounded-2xl`) |

Blocked by #74: the line-height ruling changes this element's expected metrics, so fixing it first would mean measuring twice.

**Acceptance:**

- [ ] The live element matches the frame value above, read from the DOM rather than judged from a screenshot
- [ ] `parity-checker` reports **MATCH** on the **Style** axis for frame `02 Search`
- [ ] No other element on the screen regresses on any of the six axes as a result
- [ ] The row for `PB1-15` in `.claude/plans/parity-sweep-ledger.md` is updated to PASS

**Test (required):**

- [ ] a parity assertion comparing the element's computed `border-radius` / `padding` / `border` / `box-shadow` against the same element in the frame. Read both from the DOM; never assert a hard-coded pixel value.

---

### #97: 02 Search — Card avatar is 34px where the frame is 32px + a 2px ring

**Milestone:** M3 | **Priority:** P2 Medium | **Status:** Backlog | **Capabilities:** `core`
**Blocked by:** #74

Parity sweep 2026-08-28, finding `PB1-16`. Frame **`02 Search`** vs `/search`, measured at
1440x900 from computed styles on both sides — the frame rendered from
`design/Orla - Screens.dc.html`, the live screen in the same browser.

**Axis: Style**

| | Value |
| --- | --- |
| **Expected** (frame) | `32x32` + 2px `#FFFDF9` ring = 36 outer |
| **Observed** (live) | `34x34` outer |

Blocked by #74: the line-height ruling changes this element's expected metrics, so fixing it first would mean measuring twice.

**Acceptance:**

- [ ] The live element matches the frame value above, read from the DOM rather than judged from a screenshot
- [ ] `parity-checker` reports **MATCH** on the **Style** axis for frame `02 Search`
- [ ] No other element on the screen regresses on any of the six axes as a result
- [ ] The row for `PB1-16` in `.claude/plans/parity-sweep-ledger.md` is updated to PASS

**Test (required):**

- [ ] a parity assertion comparing the element's computed `border-radius` / `padding` / `border` / `box-shadow` against the same element in the frame. Read both from the DOM; never assert a hard-coded pixel value.

---

### #98: 02 Search — Sort is a native select where the frame specifies a chip

**Milestone:** M3 | **Priority:** P2 Medium | **Status:** Backlog | **Capabilities:** `core`
**Blocked by:** #74

Parity sweep 2026-08-28, finding `PB1-17`. Frame **`02 Search`** vs `/search`, measured at
1440x900 from computed styles on both sides — the frame rendered from
`design/Orla - Screens.dc.html`, the live screen in the same browser.

**Axis: Style**

| | Value |
| --- | --- |
| **Expected** (frame) | chip: `bg #FFFDF9`, `1px #E4DDD1`, radius 8, `92x31` |
| **Observed** (live) | native `<select>` `148x33` with the browser chevron |

Blocked by #74: the line-height ruling changes this element's expected metrics, so fixing it first would mean measuring twice.

**Acceptance:**

- [ ] The live element matches the frame value above, read from the DOM rather than judged from a screenshot
- [ ] `parity-checker` reports **MATCH** on the **Style** axis for frame `02 Search`
- [ ] No other element on the screen regresses on any of the six axes as a result
- [ ] The row for `PB1-17` in `.claude/plans/parity-sweep-ledger.md` is updated to PASS

**Test (required):**

- [ ] a parity assertion comparing the element's computed `border-radius` / `padding` / `border` / `box-shadow` against the same element in the frame. Read both from the DOM; never assert a hard-coded pixel value.

---

### #99: 02 Search — Vendor-card clay monogram is off-token

**Milestone:** M3 | **Priority:** P2 Medium | **Status:** Backlog | **Capabilities:** `core`
**Blocked by:** None

Parity sweep 2026-08-28, finding `PB1-18`. Frame **`02 Search`** vs `/search`, measured at
1440x900 from computed styles on both sides — the frame rendered from
`design/Orla - Screens.dc.html`, the live screen in the same browser.

**Axis: Colour**

| | Value |
| --- | --- |
| **Expected** (frame) | `#EADCCB` |
| **Observed** (live) | `#F7E7E0` (clay-100). The sage variant `#E4E9DE` matches exactly, so only the clay branch is wrong |

**Acceptance:**

- [ ] The live element matches the frame value above, read from the DOM rather than judged from a screenshot
- [ ] `parity-checker` reports **MATCH** on the **Colour** axis for frame `02 Search`
- [ ] No other element on the screen regresses on any of the six axes as a result
- [ ] The row for `PB1-18` in `.claude/plans/parity-sweep-ledger.md` is updated to PASS

**Test (required):**

- [ ] a parity assertion resolving the element's computed colour and comparing it to the frame's token value. Assert the resolved `rgb()`, not the class name.

---

### #100: 02 Search — Card meta line is small and splits the rating into a second weight

**Milestone:** M3 | **Priority:** P2 Medium | **Status:** Backlog | **Capabilities:** `core`
**Blocked by:** #74

Parity sweep 2026-08-28, finding `PB1-19`. Frame **`02 Search`** vs `/search`, measured at
1440x900 from computed styles on both sides — the frame rendered from
`design/Orla - Screens.dc.html`, the live screen in the same browser.

**Axis: Font**

| | Value |
| --- | --- |
| **Expected** (frame) | `12px`, weight 400, uniform `#6B6459` |
| **Observed** (live) | `11px`, rating split to weight 600 `#4A443C` |

Blocked by #74: the line-height ruling changes this element's expected metrics, so fixing it first would mean measuring twice.

**Acceptance:**

- [ ] The live element matches the frame value above, read from the DOM rather than judged from a screenshot
- [ ] `parity-checker` reports **MATCH** on the **Font** axis for frame `02 Search`
- [ ] No other element on the screen regresses on any of the six axes as a result
- [ ] The row for `PB1-19` in `.claude/plans/parity-sweep-ledger.md` is updated to PASS

**Test (required):**

- [ ] a parity assertion comparing computed `font-family`, `font-size`, `font-weight` and `letter-spacing` against the frame's values for the same element.

---

### #101: 02 Search — Header date label reads `DATE`, not `EVENT DATE`

**Milestone:** M3 | **Priority:** P2 Medium | **Status:** Backlog | **Capabilities:** `core`
**Blocked by:** None

Parity sweep 2026-08-28, finding `PB1-20`. Frame **`02 Search`** vs `/search`, measured at
1440x900 from computed styles on both sides — the frame rendered from
`design/Orla - Screens.dc.html`, the live screen in the same browser.

**Axis: Text**

| | Value |
| --- | --- |
| **Expected** (frame) | `EVENT DATE` |
| **Observed** (live) | `DATE` |

**Acceptance:**

- [ ] The live element matches the frame value above, read from the DOM rather than judged from a screenshot
- [ ] `parity-checker` reports **MATCH** on the **Text** axis for frame `02 Search`
- [ ] No other element on the screen regresses on any of the six axes as a result
- [ ] The row for `PB1-20` in `.claude/plans/parity-sweep-ledger.md` is updated to PASS

**Test (required):**

- [ ] a test asserting the rendered literal equals the frame's literal, with the expected string read out of `Orla - Screens.dc.html` rather than duplicated into the test.

---

### #102: 02 Search — Header values render raw instead of formatted

**Milestone:** M3 | **Priority:** P2 Medium | **Status:** Backlog | **Capabilities:** `core`
**Blocked by:** None

Parity sweep 2026-08-28, finding `PB1-21`. Frame **`02 Search`** vs `/search`, measured at
1440x900 from computed styles on both sides — the frame rendered from
`design/Orla - Screens.dc.html`, the live screen in the same browser.

**Axis: Text**

| | Value |
| --- | --- |
| **Expected** (frame) | date `Sun, Jun 14`; city `Austin, TX`; sort default `Top rated` |
| **Observed** (live) | native `09/19/2026`; raw param `Austin`; `Most relevant` |

**Acceptance:**

- [ ] The live element matches the frame value above, read from the DOM rather than judged from a screenshot
- [ ] `parity-checker` reports **MATCH** on the **Text** axis for frame `02 Search`
- [ ] No other element on the screen regresses on any of the six axes as a result
- [ ] The row for `PB1-21` in `.claude/plans/parity-sweep-ledger.md` is updated to PASS

**Test (required):**

- [ ] a test asserting the rendered literal equals the frame's literal, with the expected string read out of `Orla - Screens.dc.html` rather than duplicated into the test.

---

### #103: 03 Vendor profile — Profile uses a centred `max-w-7xl` container where the frame is full-bleed

**Milestone:** M3 | **Priority:** P1 High | **Status:** Backlog | **Capabilities:** `core`
**Blocked by:** #74

Parity sweep 2026-08-28, finding `PB1-22`. Frame **`03 Vendor profile`** vs `/vendors/[slug]`, measured at
1440x900 from computed styles on both sides — the frame rendered from
`design/Orla - Screens.dc.html`, the live screen in the same browser.

**Axis: Layout**

| | Value |
| --- | --- |
| **Expected** (frame) | full-bleed: main column `x=0 w=1020`, content 40→992 (952px), rail `380px` at `x=1021..1401`, right gutter 39px |
| **Observed** (live) | `mx-auto max-w-7xl px-8` → **1216px centred, 112px gutters**; main content `112..916` (**804px**), rail `948..1328`. Everything shifts ~72px inward on both sides |

Blocked by #74: the line-height ruling changes this element's expected metrics, so fixing it first would mean measuring twice.

**Acceptance:**

- [ ] The live element matches the frame value above, read from the DOM rather than judged from a screenshot
- [ ] `parity-checker` reports **MATCH** on the **Layout** axis for frame `03 Vendor profile`
- [ ] No other element on the screen regresses on any of the six axes as a result
- [ ] The row for `PB1-22` in `.claude/plans/parity-sweep-ledger.md` is updated to PASS

**Test (required):**

- [ ] a parity assertion comparing the element's `getBoundingClientRect()` against the same element rendered from `Orla - Screens.dc.html`. Derive the expected box from the frame at test time so the test cannot drift from the contract.

---

### #104: 03 Vendor profile — Booking rail starts 82px too low

**Milestone:** M3 | **Priority:** P1 High | **Status:** Backlog | **Capabilities:** `core`
**Blocked by:** #74

Parity sweep 2026-08-28, finding `PB1-23`. Frame **`03 Vendor profile`** vs `/vendors/[slug]`, measured at
1440x900 from computed styles on both sides — the frame rendered from
`design/Orla - Screens.dc.html`, the live screen in the same browser.

**Axis: Layout**

| | Value |
| --- | --- |
| **Expected** (frame) | rail card `y=282`, level with the avatar row |
| **Observed** (live) | `y=364`, level with the tab bar |

Blocked by #74: the line-height ruling changes this element's expected metrics, so fixing it first would mean measuring twice.

**Acceptance:**

- [ ] The live element matches the frame value above, read from the DOM rather than judged from a screenshot
- [ ] `parity-checker` reports **MATCH** on the **Layout** axis for frame `03 Vendor profile`
- [ ] No other element on the screen regresses on any of the six axes as a result
- [ ] The row for `PB1-23` in `.claude/plans/parity-sweep-ledger.md` is updated to PASS

**Test (required):**

- [ ] a parity assertion comparing the element's `getBoundingClientRect()` against the same element rendered from `Orla - Screens.dc.html`. Derive the expected box from the frame at test time so the test cannot drift from the contract.

---

### #105: 03 Vendor profile — Avatar overlaps the cover by 34px instead of 14px

**Milestone:** M3 | **Priority:** P1 High | **Status:** Backlog | **Capabilities:** `core`
**Blocked by:** #74

Parity sweep 2026-08-28, finding `PB1-24`. Frame **`03 Vendor profile`** vs `/vendors/[slug]`, measured at
1440x900 from computed styles on both sides — the frame rendered from
`design/Orla - Screens.dc.html`, the live screen in the same browser.

**Axis: Layout**

| | Value |
| --- | --- |
| **Expected** (frame) | avatar `y=246` — a 14px overlap of the 196px cover |
| **Observed** (live) | `y=226` — a 34px overlap. (The frame's own caption says 34px; its markup renders 14px, and per precedence the markup wins) |

Blocked by #74: the line-height ruling changes this element's expected metrics, so fixing it first would mean measuring twice.

**Acceptance:**

- [ ] The live element matches the frame value above, read from the DOM rather than judged from a screenshot
- [ ] `parity-checker` reports **MATCH** on the **Layout** axis for frame `03 Vendor profile`
- [ ] No other element on the screen regresses on any of the six axes as a result
- [ ] The row for `PB1-24` in `.claude/plans/parity-sweep-ledger.md` is updated to PASS

**Test (required):**

- [ ] a parity assertion comparing the element's `getBoundingClientRect()` against the same element rendered from `Orla - Screens.dc.html`. Derive the expected box from the frame at test time so the test cannot drift from the contract.

**Superseded target, 2026-08-28.** `CHANGE-ORDER-2026-08-28.md` Part B2 fixes the intended
value explicitly: the avatar overlaps the banner by **16px (20%)**, produced by
`margin-top:-34px` against the content column's **18px `padding-top`**. The clipping ancestor
must be `overflow: visible` with the banner at `z-index:0` and the header row at `z-index:2`,
keeping `overflow:hidden` on the inner tab pane. Name block offset **23px**.

**This is the same defect as #65** — fix it there and close this as a duplicate. Use B2's
16px, not the 14px the pre-change frame markup rendered.

---

### #106: 03 Vendor profile — `See all 34 →` is missing from the `Recent work` header

**Milestone:** M3 | **Priority:** P2 Medium | **Status:** Backlog | **Capabilities:** `core`
**Blocked by:** #74

Parity sweep 2026-08-28, finding `PB1-25`. Frame **`03 Vendor profile`** vs `/vendors/[slug]`, measured at
1440x900 from computed styles on both sides — the frame rendered from
`design/Orla - Screens.dc.html`, the live screen in the same browser.

**Axis: Layout**

| | Value |
| --- | --- |
| **Expected** (frame) | `See all 34 →` at `x=651`, `12.5px/600`, `#A34A28` |
| **Observed** (live) | absent |

Blocked by #74: the line-height ruling changes this element's expected metrics, so fixing it first would mean measuring twice.

**Acceptance:**

- [ ] The live element matches the frame value above, read from the DOM rather than judged from a screenshot
- [ ] `parity-checker` reports **MATCH** on the **Layout** axis for frame `03 Vendor profile`
- [ ] No other element on the screen regresses on any of the six axes as a result
- [ ] The row for `PB1-25` in `.claude/plans/parity-sweep-ledger.md` is updated to PASS

**Test (required):**

- [ ] a parity assertion comparing the element's `getBoundingClientRect()` against the same element rendered from `Orla - Screens.dc.html`. Derive the expected box from the frame at test time so the test cannot drift from the contract.

---

### #107: 03 Vendor profile — Booking rail is missing the `Event date` + `Guests` field pair

**Milestone:** M3 | **Priority:** P1 High | **Status:** Backlog | **Capabilities:** `core`
**Blocked by:** #74

Parity sweep 2026-08-28, finding `PB1-26`. Frame **`03 Vendor profile`** vs `/vendors/[slug]`, measured at
1440x900 from computed styles on both sides — the frame rendered from
`design/Orla - Screens.dc.html`, the live screen in the same browser.

**Axis: Layout**

| | Value |
| --- | --- |
| **Expected** (frame) | the two fields paired on one row above `Package` (frame lines 225-227) |
| **Observed** (live) | **both absent**; the rail has only `Package` |

Blocked by #74: the line-height ruling changes this element's expected metrics, so fixing it first would mean measuring twice.

**Acceptance:**

- [ ] The live element matches the frame value above, read from the DOM rather than judged from a screenshot
- [ ] `parity-checker` reports **MATCH** on the **Layout** axis for frame `03 Vendor profile`
- [ ] No other element on the screen regresses on any of the six axes as a result
- [ ] The row for `PB1-26` in `.claude/plans/parity-sweep-ledger.md` is updated to PASS

**Test (required):**

- [ ] a parity assertion comparing the element's `getBoundingClientRect()` against the same element rendered from `Orla - Screens.dc.html`. Derive the expected box from the frame at test time so the test cannot drift from the contract.

---

### #108: 03 Vendor profile — Package control uses stone-0 where the frame specifies the `.inp` token

**Milestone:** M3 | **Priority:** P2 Medium | **Status:** Backlog | **Capabilities:** `core`
**Blocked by:** #74

Parity sweep 2026-08-28, finding `PB1-27`. Frame **`03 Vendor profile`** vs `/vendors/[slug]`, measured at
1440x900 from computed styles on both sides — the frame rendered from
`design/Orla - Screens.dc.html`, the live screen in the same browser.

**Axis: Style**

| | Value |
| --- | --- |
| **Expected** (frame) | `.inp`: `bg #F1ECE4` (stone-150), `1px #E4DDD1`, radius 10, `padding 10px 13px`, h39 |
| **Observed** (live) | native `<select>`: `bg #FFFDF9` (stone-0), `padding 10px 14px`, h41 |

Blocked by #74: the line-height ruling changes this element's expected metrics, so fixing it first would mean measuring twice.

**Acceptance:**

- [ ] The live element matches the frame value above, read from the DOM rather than judged from a screenshot
- [ ] `parity-checker` reports **MATCH** on the **Style** axis for frame `03 Vendor profile`
- [ ] No other element on the screen regresses on any of the six axes as a result
- [ ] The row for `PB1-27` in `.claude/plans/parity-sweep-ledger.md` is updated to PASS

**Test (required):**

- [ ] a parity assertion comparing the element's computed `border-radius` / `padding` / `border` / `box-shadow` against the same element in the frame. Read both from the DOM; never assert a hard-coded pixel value.

---

### #109: 03 Vendor profile — Attribute chips and portfolio tiles are 2px over-rounded

**Milestone:** M3 | **Priority:** P2 Medium | **Status:** Backlog | **Capabilities:** `core`
**Blocked by:** #74

Parity sweep 2026-08-28, finding `PB1-28`. Frame **`03 Vendor profile`** vs `/vendors/[slug]`, measured at
1440x900 from computed styles on both sides — the frame rendered from
`design/Orla - Screens.dc.html`, the live screen in the same browser.

**Axis: Style**

| | Value |
| --- | --- |
| **Expected** (frame) | chips radius `6px`; portfolio tiles `12px` |
| **Observed** (live) | `8px`; `14px` |

Blocked by #74: the line-height ruling changes this element's expected metrics, so fixing it first would mean measuring twice.

**Acceptance:**

- [ ] The live element matches the frame value above, read from the DOM rather than judged from a screenshot
- [ ] `parity-checker` reports **MATCH** on the **Style** axis for frame `03 Vendor profile`
- [ ] No other element on the screen regresses on any of the six axes as a result
- [ ] The row for `PB1-28` in `.claude/plans/parity-sweep-ledger.md` is updated to PASS

**Test (required):**

- [ ] a parity assertion comparing the element's computed `border-radius` / `padding` / `border` / `box-shadow` against the same element in the frame. Read both from the DOM; never assert a hard-coded pixel value.

---

### #110: 03 Vendor profile — `Send a message` is disabled where the frame shows it enabled

**Milestone:** M3 | **Priority:** P1 High | **Status:** Backlog | **Capabilities:** `core`
**Blocked by:** #74

Parity sweep 2026-08-28, finding `PB1-29`. Frame **`03 Vendor profile`** vs `/vendors/[slug]`, measured at
1440x900 from computed styles on both sides — the frame rendered from
`design/Orla - Screens.dc.html`, the live screen in the same browser.

**Axis: Style**

| | Value |
| --- | --- |
| **Expected** (frame) | enabled `.btnS` |
| **Observed** (live) | `disabled`, `opacity .5`, `pointer-events: none`. The blocker is explained only inside the shared payment reassurance sentence — `40-states.md` wants it named next to the control it blocks |

Blocked by #74: the line-height ruling changes this element's expected metrics, so fixing it first would mean measuring twice.

**Acceptance:**

- [ ] The live element matches the frame value above, read from the DOM rather than judged from a screenshot
- [ ] `parity-checker` reports **MATCH** on the **Style** axis for frame `03 Vendor profile`
- [ ] No other element on the screen regresses on any of the six axes as a result
- [ ] The row for `PB1-29` in `.claude/plans/parity-sweep-ledger.md` is updated to PASS

**Test (required):**

- [ ] a parity assertion comparing the element's computed `border-radius` / `padding` / `border` / `box-shadow` against the same element in the frame. Read both from the DOM; never assert a hard-coded pixel value.

---

### #111: 03 Vendor profile — Vendor name and `Recent work` carry excess negative tracking

**Milestone:** M3 | **Priority:** P2 Medium | **Status:** Backlog | **Capabilities:** `core`
**Blocked by:** #74

Parity sweep 2026-08-28, finding `PB1-30`. Frame **`03 Vendor profile`** vs `/vendors/[slug]`, measured at
1440x900 from computed styles on both sides — the frame rendered from
`design/Orla - Screens.dc.html`, the live screen in the same browser.

**Axis: Font**

| | Value |
| --- | --- |
| **Expected** (frame) | name `letter-spacing: normal`; `Recent work` `-0.2px` |
| **Observed** (live) | `-0.825px`; `-0.5px` |

Blocked by #74: the line-height ruling changes this element's expected metrics, so fixing it first would mean measuring twice.

**Acceptance:**

- [ ] The live element matches the frame value above, read from the DOM rather than judged from a screenshot
- [ ] `parity-checker` reports **MATCH** on the **Font** axis for frame `03 Vendor profile`
- [ ] No other element on the screen regresses on any of the six axes as a result
- [ ] The row for `PB1-30` in `.claude/plans/parity-sweep-ledger.md` is updated to PASS

**Test (required):**

- [ ] a parity assertion comparing computed `font-family`, `font-size`, `font-weight` and `letter-spacing` against the frame's values for the same element.

---

### #112: 03 Vendor profile — Rail is missing the `Free on <date>` availability line

**Milestone:** M3 | **Priority:** P1 High | **Status:** Backlog | **Capabilities:** `core`
**Blocked by:** None

Parity sweep 2026-08-28, finding `PB1-31`. Frame **`03 Vendor profile`** vs `/vendors/[slug]`, measured at
1440x900 from computed styles on both sides — the frame rendered from
`design/Orla - Screens.dc.html`, the live screen in the same browser.

**Axis: Text**

| | Value |
| --- | --- |
| **Expected** (frame) | `Free on June 14` in `#4B5940` on the `From` row |
| **Observed** (live) | absent |

**Acceptance:**

- [ ] The live element matches the frame value above, read from the DOM rather than judged from a screenshot
- [ ] `parity-checker` reports **MATCH** on the **Text** axis for frame `03 Vendor profile`
- [ ] No other element on the screen regresses on any of the six axes as a result
- [ ] The row for `PB1-31` in `.claude/plans/parity-sweep-ledger.md` is updated to PASS

**Test (required):**

- [ ] a test asserting the rendered literal equals the frame's literal, with the expected string read out of `Orla - Screens.dc.html` rather than duplicated into the test.

---

### #113: 03 Vendor profile — Rail is missing the `· N hour coverage` duration suffix

**Milestone:** M3 | **Priority:** P2 Medium | **Status:** Backlog | **Capabilities:** `core`
**Blocked by:** None

Parity sweep 2026-08-28, finding `PB1-32`. Frame **`03 Vendor profile`** vs `/vendors/[slug]`, measured at
1440x900 from computed styles on both sides — the frame rendered from
`design/Orla - Screens.dc.html`, the live screen in the same browser.

**Axis: Text**

| | Value |
| --- | --- |
| **Expected** (frame) | `· 6 hour coverage` beside the price |
| **Observed** (live) | absent |

**Acceptance:**

- [ ] The live element matches the frame value above, read from the DOM rather than judged from a screenshot
- [ ] `parity-checker` reports **MATCH** on the **Text** axis for frame `03 Vendor profile`
- [ ] No other element on the screen regresses on any of the six axes as a result
- [ ] The row for `PB1-32` in `.claude/plans/parity-sweep-ledger.md` is updated to PASS

**Test (required):**

- [ ] a test asserting the rendered literal equals the frame's literal, with the expected string read out of `Orla - Screens.dc.html` rather than duplicated into the test.

---

### #114: 03 Vendor profile — Reassurance line is prefixed with copy the frame does not carry

**Milestone:** M3 | **Priority:** P2 Medium | **Status:** Backlog | **Capabilities:** `core`
**Blocked by:** None

Parity sweep 2026-08-28, finding `PB1-33`. Frame **`03 Vendor profile`** vs `/vendors/[slug]`, measured at
1440x900 from computed styles on both sides — the frame rendered from
`design/Orla - Screens.dc.html`, the live screen in the same browser.

**Axis: Text**

| | Value |
| --- | --- |
| **Expected** (frame) | `You won't be charged yet — <vendor> confirms the date first.` |
| **Observed** (live) | prefixed with `Messaging opens shortly.`, turning a one-line helper into two |

**Acceptance:**

- [ ] The live element matches the frame value above, read from the DOM rather than judged from a screenshot
- [ ] `parity-checker` reports **MATCH** on the **Text** axis for frame `03 Vendor profile`
- [ ] No other element on the screen regresses on any of the six axes as a result
- [ ] The row for `PB1-33` in `.claude/plans/parity-sweep-ledger.md` is updated to PASS

**Test (required):**

- [ ] a test asserting the rendered literal equals the frame's literal, with the expected string read out of `Orla - Screens.dc.html` rather than duplicated into the test.

---

### #115: 03 Vendor profile — Curly quotes where the frame uses straight

**Milestone:** M3 | **Priority:** P3 Low | **Status:** Backlog | **Capabilities:** `core`
**Blocked by:** None

Parity sweep 2026-08-28, finding `PB1-34`. Frame **`03 Vendor profile`** vs `/vendors/[slug]`, measured at
1440x900 from computed styles on both sides — the frame rendered from
`design/Orla - Screens.dc.html`, the live screen in the same browser.

**Axis: Text**

| | Value |
| --- | --- |
| **Expected** (frame) | straight `"` and `'` |
| **Observed** (live) | curly `“ ”` and `’` |

**Acceptance:**

- [ ] The live element matches the frame value above, read from the DOM rather than judged from a screenshot
- [ ] `parity-checker` reports **MATCH** on the **Text** axis for frame `03 Vendor profile`
- [ ] No other element on the screen regresses on any of the six axes as a result
- [ ] The row for `PB1-34` in `.claude/plans/parity-sweep-ledger.md` is updated to PASS

**Test (required):**

- [ ] a test asserting the rendered literal equals the frame's literal, with the expected string read out of `Orla - Screens.dc.html` rather than duplicated into the test.

---

### #116: 03 Vendor profile — Signed-out `Request booking` loses the destination

**Milestone:** M3 | **Priority:** P1 High | **Status:** Backlog | **Capabilities:** `core`
**Blocked by:** None

Parity sweep 2026-08-28, finding `PB1-35`. Frame **`03 Vendor profile`** vs `/vendors/[slug]`, measured at
1440x900 from computed styles on both sides — the frame rendered from
`design/Orla - Screens.dc.html`, the live screen in the same browser.

**Axis: Interaction**

| | Value |
| --- | --- |
| **Expected** (frame) | redirect preserves the intended path + query |
| **Observed** (live) | redirects to `/sign-in` with **no `redirect_url`** (`location.search === ""`); the booking in progress is lost |

**Acceptance:**

- [ ] The live element matches the frame value above, read from the DOM rather than judged from a screenshot
- [ ] `parity-checker` reports **MATCH** on the **Interaction** axis for frame `03 Vendor profile`
- [ ] No other element on the screen regresses on any of the six axes as a result
- [ ] The row for `PB1-35` in `.claude/plans/parity-sweep-ledger.md` is updated to PASS

**Test (required):**

- [ ] a browser test driving the interaction end to end and asserting the resulting URL and DOM state.

---

### #117: 08/09/11 shared — Header is missing the `Vendor` chip on every vendor screen

**Milestone:** M3 | **Priority:** P2 Medium | **Status:** Backlog | **Capabilities:** `core`
**Blocked by:** None

Parity sweep 2026-08-28, finding `PB2-S1`. Frame **`08/09/11 shared`** vs `vendor screens`, measured at
1440x900 from computed styles on both sides — the frame rendered from
`design/Orla - Screens.dc.html`, the live screen in the same browser.

**Axis: Text**

| | Value |
| --- | --- |
| **Expected** (frame) | `Vendor` chip: `#EDF0E9` fill, `#4B5940` text, 11px/600/uppercase/.06em, `4px 8px`, radius 5 |
| **Observed** (live) | absent on all three vendor screens |

**Acceptance:**

- [ ] The live element matches the frame value above, read from the DOM rather than judged from a screenshot
- [ ] `parity-checker` reports **MATCH** on the **Text** axis for frame `08/09/11 shared`
- [ ] No other element on the screen regresses on any of the six axes as a result
- [ ] The row for `PB2-S1` in `.claude/plans/parity-sweep-ledger.md` is updated to PASS

**Test (required):**

- [ ] a test asserting the rendered literal equals the frame's literal, with the expected string read out of `Orla - Screens.dc.html` rather than duplicated into the test.

---

### #118: 08/09/11 shared — Header padding and logo size differ from the frame

**Milestone:** M3 | **Priority:** P2 Medium | **Status:** Backlog | **Capabilities:** `core`
**Blocked by:** #74

Parity sweep 2026-08-28, finding `PB2-S2`. Frame **`08/09/11 shared`** vs `vendor screens`, measured at
1440x900 from computed styles on both sides — the frame rendered from
`design/Orla - Screens.dc.html`, the live screen in the same browser.

**Axis: Layout**

| | Value |
| --- | --- |
| **Expected** (frame) | padding `0 32px`, logo 23px |
| **Observed** (live) | `0 40px`, logo 24px |

Blocked by #74: the line-height ruling changes this element's expected metrics, so fixing it first would mean measuring twice.

**Acceptance:**

- [ ] The live element matches the frame value above, read from the DOM rather than judged from a screenshot
- [ ] `parity-checker` reports **MATCH** on the **Layout** axis for frame `08/09/11 shared`
- [ ] No other element on the screen regresses on any of the six axes as a result
- [ ] The row for `PB2-S2` in `.claude/plans/parity-sweep-ledger.md` is updated to PASS

**Test (required):**

- [ ] a parity assertion comparing the element's `getBoundingClientRect()` against the same element rendered from `Orla - Screens.dc.html`. Derive the expected box from the frame at test time so the test cannot drift from the contract.

---

### #119: 08/09/11 shared — Sidebar and rail footprints are short because the frame boxes are not border-box

**Milestone:** M3 | **Priority:** P1 High | **Status:** Backlog | **Capabilities:** `core`
**Blocked by:** #74

Parity sweep 2026-08-28, finding `PB2-S3`. Frame **`08/09/11 shared`** vs `vendor screens`, measured at
1440x900 from computed styles on both sides — the frame rendered from
`design/Orla - Screens.dc.html`, the live screen in the same browser.

**Axis: Layout**

| | Value |
| --- | --- |
| **Expected** (frame) | `.side` = 240 + 24 padding + 1 border = **265px**, content column starts x=290. Frame 08 rail = 381px (340 inner); frame 11 rail = 341px (300 inner) |
| **Observed** (live) | nav **240px** total, content starts x=264. Rail 08 = 340px (300 inner); rail 11 = 300px (260 inner) |

Blocked by #74: the line-height ruling changes this element's expected metrics, so fixing it first would mean measuring twice.

**Acceptance:**

- [ ] The live element matches the frame value above, read from the DOM rather than judged from a screenshot
- [ ] `parity-checker` reports **MATCH** on the **Layout** axis for frame `08/09/11 shared`
- [ ] No other element on the screen regresses on any of the six axes as a result
- [ ] The row for `PB2-S3` in `.claude/plans/parity-sweep-ledger.md` is updated to PASS

**Test (required):**

- [ ] a parity assertion comparing the element's `getBoundingClientRect()` against the same element rendered from `Orla - Screens.dc.html`. Derive the expected box from the frame at test time so the test cannot drift from the contract.

---

### #120: 08/09/11 shared — Header `Messages` / `Dashboard` links and the Clerk user button focus with no visible ring

**Milestone:** M3 | **Priority:** P1 High | **Status:** Backlog | **Capabilities:** `core`
**Blocked by:** None

Parity sweep 2026-08-28, finding `PB2-S4`. Frame **`08/09/11 shared`** vs `vendor screens`, measured at
1440x900 from computed styles on both sides — the frame rendered from
`design/Orla - Screens.dc.html`, the live screen in the same browser.

**Axis: Access**

| | Value |
| --- | --- |
| **Expected** (frame) | `ring-2 ring-clay-400/30 ring-offset-2 ring-offset-stone-50` |
| **Observed** (live) | tabbed with a real keyboard: **every box-shadow layer transparent and `outline-style:none`** on both header links; Clerk's `Open user menu` computes `box-shadow: oklab(0 0 0 / 0) 0 0 0 0` |

**Acceptance:**

- [ ] The live element matches the frame value above, read from the DOM rather than judged from a screenshot
- [ ] `parity-checker` reports **MATCH** on the **Access** axis for frame `08/09/11 shared`
- [ ] No other element on the screen regresses on any of the six axes as a result
- [ ] The row for `PB2-S4` in `.claude/plans/parity-sweep-ledger.md` is updated to PASS

**Test (required):**

- [ ] a browser assertion covering this law directly — and asserting the *rendered* result, not the computed value, since a correct computed value is exactly what passes today while rendering wrong.

---

### #121: 08/09/11 shared — Four icon-only controls are under the 44x44 hit area

**Milestone:** M3 | **Priority:** P1 High | **Status:** Backlog | **Capabilities:** `core`
**Blocked by:** None

Parity sweep 2026-08-28, finding `PB2-S5`. Frame **`08/09/11 shared`** vs `vendor screens`, measured at
1440x900 from computed styles on both sides — the frame rendered from
`design/Orla - Screens.dc.html`, the live screen in the same browser.

**Axis: Access**

| | Value |
| --- | --- |
| **Expected** (frame) | every icon-only control >=44x44 |
| **Observed** (live) | `Open user menu` **28x28**; `Notifications, 1 unread` **36x36**; `Show earlier months` **36x36**; `Show later months` **36x36**. All carry `aria-label`; all fail the hit area |

**Acceptance:**

- [ ] The live element matches the frame value above, read from the DOM rather than judged from a screenshot
- [ ] `parity-checker` reports **MATCH** on the **Access** axis for frame `08/09/11 shared`
- [ ] No other element on the screen regresses on any of the six axes as a result
- [ ] The row for `PB2-S5` in `.claude/plans/parity-sweep-ledger.md` is updated to PASS

**Test (required):**

- [ ] a browser assertion covering this law directly — and asserting the *rendered* result, not the computed value, since a correct computed value is exactly what passes today while rendering wrong.

---

### #122: 08/09/11 shared — Notifications popover does not close on Escape

**Milestone:** M3 | **Priority:** P1 High | **Status:** Backlog | **Capabilities:** `core`
**Blocked by:** None

Parity sweep 2026-08-28, finding `PB2-S6`. Frame **`08/09/11 shared`** vs `vendor screens`, measured at
1440x900 from computed styles on both sides — the frame rendered from
`design/Orla - Screens.dc.html`, the live screen in the same browser.

**Axis: Access**

| | Value |
| --- | --- |
| **Expected** (frame) | Escape closes it and restores focus |
| **Observed** (live) | keeps `aria-expanded="true"` on Escape; outside-click works |

**Acceptance:**

- [ ] The live element matches the frame value above, read from the DOM rather than judged from a screenshot
- [ ] `parity-checker` reports **MATCH** on the **Access** axis for frame `08/09/11 shared`
- [ ] No other element on the screen regresses on any of the six axes as a result
- [ ] The row for `PB2-S6` in `.claude/plans/parity-sweep-ledger.md` is updated to PASS

**Test (required):**

- [ ] a browser assertion covering this law directly — and asserting the *rendered* result, not the computed value, since a correct computed value is exactly what passes today while rendering wrong.

---

### #123: 08/09/11 shared — Notification copy renders a raw ISO date

**Milestone:** M3 | **Priority:** P2 Medium | **Status:** Backlog | **Capabilities:** `core`
**Blocked by:** None

Parity sweep 2026-08-28, finding `PB2-S7`. Frame **`08/09/11 shared`** vs `vendor screens`, measured at
1440x900 from computed styles on both sides — the frame rendered from
`design/Orla - Screens.dc.html`, the live screen in the same browser.

**Axis: Text**

| | Value |
| --- | --- |
| **Expected** (frame) | a locale-formatted date at the display boundary |
| **Observed** (live) | `"A customer asked about 2026-12-19. You have a week to reply."` |

**Acceptance:**

- [ ] The live element matches the frame value above, read from the DOM rather than judged from a screenshot
- [ ] `parity-checker` reports **MATCH** on the **Text** axis for frame `08/09/11 shared`
- [ ] No other element on the screen regresses on any of the six axes as a result
- [ ] The row for `PB2-S7` in `.claude/plans/parity-sweep-ledger.md` is updated to PASS

**Test (required):**

- [ ] a test asserting the rendered literal equals the frame's literal, with the expected string read out of `Orla - Screens.dc.html` rather than duplicated into the test.

---

### #124: 08 Vendor dashboard — `View my public profile` moved out of the header into the content column

**Milestone:** M3 | **Priority:** P2 Medium | **Status:** Backlog | **Capabilities:** `core`
**Blocked by:** #74

Parity sweep 2026-08-28, finding `PB2-1`. Frame **`08 Vendor dashboard`** vs `/vendor/dashboard`, measured at
1440x900 from computed styles on both sides — the frame rendered from
`design/Orla - Screens.dc.html`, the live screen in the same browser.

**Axis: Layout**

| | Value |
| --- | --- |
| **Expected** (frame) | in the header, 13.5px/500 `#4A443C` |
| **Observed** (live) | in the content column at `x=947,y=101`, 12.5px/600 `#A34A28` |

Blocked by #74: the line-height ruling changes this element's expected metrics, so fixing it first would mean measuring twice.

**Acceptance:**

- [ ] The live element matches the frame value above, read from the DOM rather than judged from a screenshot
- [ ] `parity-checker` reports **MATCH** on the **Layout** axis for frame `08 Vendor dashboard`
- [ ] No other element on the screen regresses on any of the six axes as a result
- [ ] The row for `PB2-1` in `.claude/plans/parity-sweep-ledger.md` is updated to PASS

**Test (required):**

- [ ] a parity assertion comparing the element's `getBoundingClientRect()` against the same element rendered from `Orla - Screens.dc.html`. Derive the expected box from the frame at test time so the test cannot drift from the contract.

---

### #125: 08 Vendor dashboard — Dashboard rail is 41px narrow

**Milestone:** M3 | **Priority:** P1 High | **Status:** Backlog | **Capabilities:** `core`
**Blocked by:** #74

Parity sweep 2026-08-28, finding `PB2-2`. Frame **`08 Vendor dashboard`** vs `/vendor/dashboard`, measured at
1440x900 from computed styles on both sides — the frame rendered from
`design/Orla - Screens.dc.html`, the live screen in the same browser.

**Axis: Layout**

| | Value |
| --- | --- |
| **Expected** (frame) | 381px footprint / 340px content |
| **Observed** (live) | 340px / 300px |

Blocked by #74: the line-height ruling changes this element's expected metrics, so fixing it first would mean measuring twice.

**Acceptance:**

- [ ] The live element matches the frame value above, read from the DOM rather than judged from a screenshot
- [ ] `parity-checker` reports **MATCH** on the **Layout** axis for frame `08 Vendor dashboard`
- [ ] No other element on the screen regresses on any of the six axes as a result
- [ ] The row for `PB2-2` in `.claude/plans/parity-sweep-ledger.md` is updated to PASS

**Test (required):**

- [ ] a parity assertion comparing the element's `getBoundingClientRect()` against the same element rendered from `Orla - Screens.dc.html`. Derive the expected box from the frame at test time so the test cannot drift from the contract.

---

### #126: 08 Vendor dashboard — Empty request pane has no panel, glyph or CTA

**Milestone:** M3 | **Priority:** P1 High | **Status:** Backlog | **Capabilities:** `core`
**Blocked by:** #74

Parity sweep 2026-08-28, finding `PB2-3`. Frame **`08 Vendor dashboard`** vs `/vendor/dashboard`, measured at
1440x900 from computed styles on both sides — the frame rendered from
`design/Orla - Screens.dc.html`, the live screen in the same browser.

**Axis: Layout**

| | Value |
| --- | --- |
| **Expected** (frame) | frame `20`: flex-filled panel, `1px dashed #D5CEC2`, radius 18, a two-circle glyph (36px `#F1ECE4` + 36px dashed `#D5CEC2`), and a `.btnS` CTA |
| **Observed** (live) | `flex flex-col items-center gap-3 px-6 py-12` — no panel, no glyph, no CTA, leaving **~470px of undrawn space** in an 812x594 region |

Blocked by #74: the line-height ruling changes this element's expected metrics, so fixing it first would mean measuring twice.

**Acceptance:**

- [ ] The live element matches the frame value above, read from the DOM rather than judged from a screenshot
- [ ] `parity-checker` reports **MATCH** on the **Layout** axis for frame `08 Vendor dashboard`
- [ ] No other element on the screen regresses on any of the six axes as a result
- [ ] The row for `PB2-3` in `.claude/plans/parity-sweep-ledger.md` is updated to PASS

**Test (required):**

- [ ] a parity assertion comparing the element's `getBoundingClientRect()` against the same element rendered from `Orla - Screens.dc.html`. Derive the expected box from the frame at test time so the test cannot drift from the contract.

---

### #127: 08 Vendor dashboard — `See all N →` is missing beside `Requests waiting on you`

**Milestone:** M3 | **Priority:** P2 Medium | **Status:** Backlog | **Capabilities:** `core`
**Blocked by:** #74

Parity sweep 2026-08-28, finding `PB2-4`. Frame **`08 Vendor dashboard`** vs `/vendor/dashboard`, measured at
1440x900 from computed styles on both sides — the frame rendered from
`design/Orla - Screens.dc.html`, the live screen in the same browser.

**Axis: Layout**

| | Value |
| --- | --- |
| **Expected** (frame) | `See all 4 →` |
| **Observed** (live) | absent from the markup |

Blocked by #74: the line-height ruling changes this element's expected metrics, so fixing it first would mean measuring twice.

**Acceptance:**

- [ ] The live element matches the frame value above, read from the DOM rather than judged from a screenshot
- [ ] `parity-checker` reports **MATCH** on the **Layout** axis for frame `08 Vendor dashboard`
- [ ] No other element on the screen regresses on any of the six axes as a result
- [ ] The row for `PB2-4` in `.claude/plans/parity-sweep-ledger.md` is updated to PASS

**Test (required):**

- [ ] a parity assertion comparing the element's `getBoundingClientRect()` against the same element rendered from `Orla - Screens.dc.html`. Derive the expected box from the frame at test time so the test cannot drift from the contract.

---

### #128: 08 Vendor dashboard — Stat card radius is 14px, not 12px

**Milestone:** M3 | **Priority:** P2 Medium | **Status:** Backlog | **Capabilities:** `core`
**Blocked by:** #74

Parity sweep 2026-08-28, finding `PB2-5`. Frame **`08 Vendor dashboard`** vs `/vendor/dashboard`, measured at
1440x900 from computed styles on both sides — the frame rendered from
`design/Orla - Screens.dc.html`, the live screen in the same browser.

**Axis: Style**

| | Value |
| --- | --- |
| **Expected** (frame) | `12px` (the frame overrides `.card`'s 16px) |
| **Observed** (live) | `14px` |

Blocked by #74: the line-height ruling changes this element's expected metrics, so fixing it first would mean measuring twice.

**Acceptance:**

- [ ] The live element matches the frame value above, read from the DOM rather than judged from a screenshot
- [ ] `parity-checker` reports **MATCH** on the **Style** axis for frame `08 Vendor dashboard`
- [ ] No other element on the screen regresses on any of the six axes as a result
- [ ] The row for `PB2-5` in `.claude/plans/parity-sweep-ledger.md` is updated to PASS

**Test (required):**

- [ ] a parity assertion comparing the element's computed `border-radius` / `padding` / `border` / `box-shadow` against the same element in the frame. Read both from the DOM; never assert a hard-coded pixel value.

---

### #129: 08 Vendor dashboard — Stat micro-labels use `text-xs` instead of the 10.5px micro-label

**Milestone:** M3 | **Priority:** P2 Medium | **Status:** Backlog | **Capabilities:** `core`
**Blocked by:** #74

Parity sweep 2026-08-28, finding `PB2-6`. Frame **`08 Vendor dashboard`** vs `/vendor/dashboard`, measured at
1440x900 from computed styles on both sides — the frame rendered from
`design/Orla - Screens.dc.html`, the live screen in the same browser.

**Axis: Font**

| | Value |
| --- | --- |
| **Expected** (frame) | `.lbl` = 10.5px/600/`0.525px`/uppercase/`#6B6459` |
| **Observed** (live) | **11px**/600/`0.55px` |

Blocked by #74: the line-height ruling changes this element's expected metrics, so fixing it first would mean measuring twice.

**Acceptance:**

- [ ] The live element matches the frame value above, read from the DOM rather than judged from a screenshot
- [ ] `parity-checker` reports **MATCH** on the **Font** axis for frame `08 Vendor dashboard`
- [ ] No other element on the screen regresses on any of the six axes as a result
- [ ] The row for `PB2-6` in `.claude/plans/parity-sweep-ledger.md` is updated to PASS

**Test (required):**

- [ ] a parity assertion comparing computed `font-family`, `font-size`, `font-weight` and `letter-spacing` against the frame's values for the same element.

---

### #130: 08 Vendor dashboard — Stat delta line is 11px, not 11.5px

**Milestone:** M3 | **Priority:** P3 Low | **Status:** Backlog | **Capabilities:** `core`
**Blocked by:** #74

Parity sweep 2026-08-28, finding `PB2-7`. Frame **`08 Vendor dashboard`** vs `/vendor/dashboard`, measured at
1440x900 from computed styles on both sides — the frame rendered from
`design/Orla - Screens.dc.html`, the live screen in the same browser.

**Axis: Font**

| | Value |
| --- | --- |
| **Expected** (frame) | `11.5px` |
| **Observed** (live) | `11px` |

Blocked by #74: the line-height ruling changes this element's expected metrics, so fixing it first would mean measuring twice.

**Acceptance:**

- [ ] The live element matches the frame value above, read from the DOM rather than judged from a screenshot
- [ ] `parity-checker` reports **MATCH** on the **Font** axis for frame `08 Vendor dashboard`
- [ ] No other element on the screen regresses on any of the six axes as a result
- [ ] The row for `PB2-7` in `.claude/plans/parity-sweep-ledger.md` is updated to PASS

**Test (required):**

- [ ] a parity assertion comparing computed `font-family`, `font-size`, `font-weight` and `letter-spacing` against the frame's values for the same element.

---

### #131: 08 Vendor dashboard — Rail label renders in Instrument Serif at 11px

**Milestone:** M3 | **Priority:** P1 High | **Status:** Backlog | **Capabilities:** `core`
**Blocked by:** #74

Parity sweep 2026-08-28, finding `PB2-8`. Frame **`08 Vendor dashboard`** vs `/vendor/dashboard`, measured at
1440x900 from computed styles on both sides — the frame rendered from
`design/Orla - Screens.dc.html`, the live screen in the same browser.

**Axis: Font**

| | Value |
| --- | --- |
| **Expected** (frame) | `Friday, August 28` as `.lbl`, Instrument **Sans** 10.5px |
| **Observed** (live) | `<h2>` in **Instrument Serif** 11px — serif below the 16px floor. Caused by `globals.css:162-166` |

Blocked by #74: the line-height ruling changes this element's expected metrics, so fixing it first would mean measuring twice.

**Acceptance:**

- [ ] The live element matches the frame value above, read from the DOM rather than judged from a screenshot
- [ ] `parity-checker` reports **MATCH** on the **Font** axis for frame `08 Vendor dashboard`
- [ ] No other element on the screen regresses on any of the six axes as a result
- [ ] The row for `PB2-8` in `.claude/plans/parity-sweep-ledger.md` is updated to PASS

**Test (required):**

- [ ] a parity assertion comparing computed `font-family`, `font-size`, `font-weight` and `letter-spacing` against the frame's values for the same element.

---

### #132: 08 Vendor dashboard — Empty-state headline is 21px, not 26px

**Milestone:** M3 | **Priority:** P2 Medium | **Status:** Backlog | **Capabilities:** `core`
**Blocked by:** #74

Parity sweep 2026-08-28, finding `PB2-9`. Frame **`08 Vendor dashboard`** vs `/vendor/dashboard`, measured at
1440x900 from computed styles on both sides — the frame rendered from
`design/Orla - Screens.dc.html`, the live screen in the same browser.

**Axis: Font**

| | Value |
| --- | --- |
| **Expected** (frame) | 26px serif (`40-states.md`: "Instrument Serif headline at 26px in-app") |
| **Observed** (live) | 21px (`text-display-sm`) |

Blocked by #74: the line-height ruling changes this element's expected metrics, so fixing it first would mean measuring twice.

**Acceptance:**

- [ ] The live element matches the frame value above, read from the DOM rather than judged from a screenshot
- [ ] `parity-checker` reports **MATCH** on the **Font** axis for frame `08 Vendor dashboard`
- [ ] No other element on the screen regresses on any of the six axes as a result
- [ ] The row for `PB2-9` in `.claude/plans/parity-sweep-ledger.md` is updated to PASS

**Test (required):**

- [ ] a parity assertion comparing computed `font-family`, `font-size`, `font-weight` and `letter-spacing` against the frame's values for the same element.

---

### #133: 08 Vendor dashboard — `Requests waiting on you` carries tracking the frame does not

**Milestone:** M3 | **Priority:** P2 Medium | **Status:** Backlog | **Capabilities:** `core`
**Blocked by:** #74

Parity sweep 2026-08-28, finding `PB2-10`. Frame **`08 Vendor dashboard`** vs `/vendor/dashboard`, measured at
1440x900 from computed styles on both sides — the frame rendered from
`design/Orla - Screens.dc.html`, the live screen in the same browser.

**Axis: Font**

| | Value |
| --- | --- |
| **Expected** (frame) | `letter-spacing: normal` |
| **Observed** (live) | `-0.525px` |

Blocked by #74: the line-height ruling changes this element's expected metrics, so fixing it first would mean measuring twice.

**Acceptance:**

- [ ] The live element matches the frame value above, read from the DOM rather than judged from a screenshot
- [ ] `parity-checker` reports **MATCH** on the **Font** axis for frame `08 Vendor dashboard`
- [ ] No other element on the screen regresses on any of the six axes as a result
- [ ] The row for `PB2-10` in `.claude/plans/parity-sweep-ledger.md` is updated to PASS

**Test (required):**

- [ ] a parity assertion comparing computed `font-family`, `font-size`, `font-weight` and `letter-spacing` against the frame's values for the same element.

---

### #134: 08 Vendor dashboard — `Vendor` chip string absent

**Milestone:** M3 | **Priority:** P2 Medium | **Status:** Backlog | **Capabilities:** `core`
**Blocked by:** None

Parity sweep 2026-08-28, finding `PB2-11`. Frame **`08 Vendor dashboard`** vs `/vendor/dashboard`, measured at
1440x900 from computed styles on both sides — the frame rendered from
`design/Orla - Screens.dc.html`, the live screen in the same browser.

**Axis: Text**

| | Value |
| --- | --- |
| **Expected** (frame) | see PB2-S1 |
| **Observed** (live) | absent |

**Acceptance:**

- [ ] The live element matches the frame value above, read from the DOM rather than judged from a screenshot
- [ ] `parity-checker` reports **MATCH** on the **Text** axis for frame `08 Vendor dashboard`
- [ ] No other element on the screen regresses on any of the six axes as a result
- [ ] The row for `PB2-11` in `.claude/plans/parity-sweep-ledger.md` is updated to PASS

**Test (required):**

- [ ] a test asserting the rendered literal equals the frame's literal, with the expected string read out of `Orla - Screens.dc.html` rather than duplicated into the test.

---

### #135: 08 Vendor dashboard — `See all 4 →` string absent

**Milestone:** M3 | **Priority:** P2 Medium | **Status:** Backlog | **Capabilities:** `core`
**Blocked by:** None

Parity sweep 2026-08-28, finding `PB2-12`. Frame **`08 Vendor dashboard`** vs `/vendor/dashboard`, measured at
1440x900 from computed styles on both sides — the frame rendered from
`design/Orla - Screens.dc.html`, the live screen in the same browser.

**Axis: Text**

| | Value |
| --- | --- |
| **Expected** (frame) | `See all 4 →` |
| **Observed** (live) | absent |

**Acceptance:**

- [ ] The live element matches the frame value above, read from the DOM rather than judged from a screenshot
- [ ] `parity-checker` reports **MATCH** on the **Text** axis for frame `08 Vendor dashboard`
- [ ] No other element on the screen regresses on any of the six axes as a result
- [ ] The row for `PB2-12` in `.claude/plans/parity-sweep-ledger.md` is updated to PASS

**Test (required):**

- [ ] a test asserting the rendered literal equals the frame's literal, with the expected string read out of `Orla - Screens.dc.html` rather than duplicated into the test.

---

### #136: 08 Vendor dashboard — `Bookings this month` shows a wrong-month statement instead of a delta

**Milestone:** M3 | **Priority:** P2 Medium | **Status:** Backlog | **Capabilities:** `core`
**Blocked by:** None

Parity sweep 2026-08-28, finding `PB2-13`. Frame **`08 Vendor dashboard`** vs `/vendor/dashboard`, measured at
1440x900 from computed styles on both sides — the frame rendered from
`design/Orla - Screens.dc.html`, the live screen in the same browser.

**Axis: Text**

| | Value |
| --- | --- |
| **Expected** (frame) | a delta, as the frame's `+2 vs April` |
| **Observed** (live) | `None in July` on an **August 28** dashboard — a statement about the wrong month, and not a delta |

**Acceptance:**

- [ ] The live element matches the frame value above, read from the DOM rather than judged from a screenshot
- [ ] `parity-checker` reports **MATCH** on the **Text** axis for frame `08 Vendor dashboard`
- [ ] No other element on the screen regresses on any of the six axes as a result
- [ ] The row for `PB2-13` in `.claude/plans/parity-sweep-ledger.md` is updated to PASS

**Test (required):**

- [ ] a test asserting the rendered literal equals the frame's literal, with the expected string read out of `Orla - Screens.dc.html` rather than duplicated into the test.

---

### #137: 09 Vendor profile editor — The cover image drop zone is missing entirely

**Milestone:** M3 | **Priority:** P0 Critical | **Status:** Backlog | **Capabilities:** `core`
**Blocked by:** #74

Parity sweep 2026-08-28, finding `PB2-14`. Frame **`09 Vendor profile editor`** vs `/vendor/profile/edit`, measured at
1440x900 from computed styles on both sides — the frame rendered from
`design/Orla - Screens.dc.html`, the live screen in the same browser.

**Axis: Layout**

| | Value |
| --- | --- |
| **Expected** (frame) | a `grid-template-columns:158px 1fr; gap:20px` media row — a 128px circle then a 128px-tall 21:9 cover drop zone |
| **Observed** (live) | `display:block`, a single **160x160** circle with nothing beside it. **There is no cover image control at all.** Breaks law 9 and `17-vendor-profile-editor.md`'s "Media pair on one row" |

Blocked by #74: the line-height ruling changes this element's expected metrics, so fixing it first would mean measuring twice.

**Acceptance:**

- [ ] The live element matches the frame value above, read from the DOM rather than judged from a screenshot
- [ ] `parity-checker` reports **MATCH** on the **Layout** axis for frame `09 Vendor profile editor`
- [ ] No other element on the screen regresses on any of the six axes as a result
- [ ] The row for `PB2-14` in `.claude/plans/parity-sweep-ledger.md` is updated to PASS

**Test (required):**

- [ ] a parity assertion comparing the element's `getBoundingClientRect()` against the same element rendered from `Orla - Screens.dc.html`. Derive the expected box from the frame at test time so the test cannot drift from the contract.

---

### #138: 09 Vendor profile editor — Two undocumented fields inserted into the form

**Milestone:** M3 | **Priority:** P2 Medium | **Status:** Backlog | **Capabilities:** `core`
**Blocked by:** #74

Parity sweep 2026-08-28, finding `PB2-15`. Frame **`09 Vendor profile editor`** vs `/vendor/profile/edit`, measured at
1440x900 from computed styles on both sides — the frame rendered from
`design/Orla - Screens.dc.html`, the live screen in the same browser.

**Axis: Layout**

| | Value |
| --- | --- |
| **Expected** (frame) | fields as the frame and `17-vendor-profile-editor.md` list them |
| **Observed** (live) | `Your line` (span-2) and `Years in business` (half) inserted between `Profile link` and `About your business` — in neither source |

Blocked by #74: the line-height ruling changes this element's expected metrics, so fixing it first would mean measuring twice.

**Acceptance:**

- [ ] The live element matches the frame value above, read from the DOM rather than judged from a screenshot
- [ ] `parity-checker` reports **MATCH** on the **Layout** axis for frame `09 Vendor profile editor`
- [ ] No other element on the screen regresses on any of the six axes as a result
- [ ] The row for `PB2-15` in `.claude/plans/parity-sweep-ledger.md` is updated to PASS

**Test (required):**

- [ ] a parity assertion comparing the element's `getBoundingClientRect()` against the same element rendered from `Orla - Screens.dc.html`. Derive the expected box from the frame at test time so the test cannot drift from the contract.

---

### #139: 09 Vendor profile editor — Three section headings inserted into a pane the frame gives none

**Milestone:** M3 | **Priority:** P2 Medium | **Status:** Backlog | **Capabilities:** `core`
**Blocked by:** #74

Parity sweep 2026-08-28, finding `PB2-16`. Frame **`09 Vendor profile editor`** vs `/vendor/profile/edit`, measured at
1440x900 from computed styles on both sides — the frame rendered from
`design/Orla - Screens.dc.html`, the live screen in the same browser.

**Axis: Layout**

| | Value |
| --- | --- |
| **Expected** (frame) | no section headings in the pane |
| **Observed** (live) | `Business`, `Location & service area` (sr-only 1x1) and a visible serif `Tags` |

Blocked by #74: the line-height ruling changes this element's expected metrics, so fixing it first would mean measuring twice.

**Acceptance:**

- [ ] The live element matches the frame value above, read from the DOM rather than judged from a screenshot
- [ ] `parity-checker` reports **MATCH** on the **Layout** axis for frame `09 Vendor profile editor`
- [ ] No other element on the screen regresses on any of the six axes as a result
- [ ] The row for `PB2-16` in `.claude/plans/parity-sweep-ledger.md` is updated to PASS

**Test (required):**

- [ ] a parity assertion comparing the element's `getBoundingClientRect()` against the same element rendered from `Orla - Screens.dc.html`. Derive the expected box from the frame at test time so the test cannot drift from the contract.

---

### #140: 09 Vendor profile editor — Section nav is missing `Payouts` and its gold dot

**Milestone:** M3 | **Priority:** P3 Low | **Status:** Backlog | **Capabilities:** `core`
**Blocked by:** #74

Parity sweep 2026-08-28, finding `PB2-17`. Frame **`09 Vendor profile editor`** vs `/vendor/profile/edit`, measured at
1440x900 from computed styles on both sides — the frame rendered from
`design/Orla - Screens.dc.html`, the live screen in the same browser.

**Axis: Layout**

| | Value |
| --- | --- |
| **Expected** (frame) | seven items including `Payouts` |
| **Observed** (live) | six items; `Payouts` absent (scope-deferrable, but the gold dot is unbuilt) |

Blocked by #74: the line-height ruling changes this element's expected metrics, so fixing it first would mean measuring twice.

**Acceptance:**

- [ ] The live element matches the frame value above, read from the DOM rather than judged from a screenshot
- [ ] `parity-checker` reports **MATCH** on the **Layout** axis for frame `09 Vendor profile editor`
- [ ] No other element on the screen regresses on any of the six axes as a result
- [ ] The row for `PB2-17` in `.claude/plans/parity-sweep-ledger.md` is updated to PASS

**Test (required):**

- [ ] a parity assertion comparing the element's `getBoundingClientRect()` against the same element rendered from `Orla - Screens.dc.html`. Derive the expected box from the frame at test time so the test cannot drift from the contract.

---

### #141: 09 Vendor profile editor — Form pane exceeds its scroll budget

**Milestone:** M3 | **Priority:** P1 High | **Status:** Backlog | **Capabilities:** `core`
**Blocked by:** #74

Parity sweep 2026-08-28, finding `PB2-18`. Frame **`09 Vendor profile editor`** vs `/vendor/profile/edit`, measured at
1440x900 from computed styles on both sides — the frame rendered from
`design/Orla - Screens.dc.html`, the live screen in the same browser.

**Axis: Layout**

| | Value |
| --- | --- |
| **Expected** (frame) | <=1.5x (`17-vendor-profile-editor.md`) |
| **Observed** (live) | **1.92x** (`scrollHeight 1487 / clientHeight 774`) |

Blocked by #74: the line-height ruling changes this element's expected metrics, so fixing it first would mean measuring twice.

**Acceptance:**

- [ ] The live element matches the frame value above, read from the DOM rather than judged from a screenshot
- [ ] `parity-checker` reports **MATCH** on the **Layout** axis for frame `09 Vendor profile editor`
- [ ] No other element on the screen regresses on any of the six axes as a result
- [ ] The row for `PB2-18` in `.claude/plans/parity-sweep-ledger.md` is updated to PASS

**Test (required):**

- [ ] a parity assertion comparing the element's `getBoundingClientRect()` against the same element rendered from `Orla - Screens.dc.html`. Derive the expected box from the frame at test time so the test cannot drift from the contract.

---

### #142: 09 Vendor profile editor — Inputs are 7px short, unpadded and transparent

**Milestone:** M3 | **Priority:** P1 High | **Status:** Backlog | **Capabilities:** `core`
**Blocked by:** #74

Parity sweep 2026-08-28, finding `PB2-19`. Frame **`09 Vendor profile editor`** vs `/vendor/profile/edit`, measured at
1440x900 from computed styles on both sides — the frame rendered from
`design/Orla - Screens.dc.html`, the live screen in the same browser.

**Axis: Style**

| | Value |
| --- | --- |
| **Expected** (frame) | `.inp`: `padding:10px 13px`, bg `#FFFDF9`, radius 10, ~39px tall |
| **Observed** (live) | `padding:4px 10px`, **transparent** over `#F8F5EF`, **32px** tall |

Blocked by #74: the line-height ruling changes this element's expected metrics, so fixing it first would mean measuring twice.

**Acceptance:**

- [ ] The live element matches the frame value above, read from the DOM rather than judged from a screenshot
- [ ] `parity-checker` reports **MATCH** on the **Style** axis for frame `09 Vendor profile editor`
- [ ] No other element on the screen regresses on any of the six axes as a result
- [ ] The row for `PB2-19` in `.claude/plans/parity-sweep-ledger.md` is updated to PASS

**Test (required):**

- [ ] a parity assertion comparing the element's computed `border-radius` / `padding` / `border` / `box-shadow` against the same element in the frame. Read both from the DOM; never assert a hard-coded pixel value.

---

### #143: 09 Vendor profile editor — Profile photo zone is oversized with the wrong dashed border

**Milestone:** M3 | **Priority:** P2 Medium | **Status:** Backlog | **Capabilities:** `core`
**Blocked by:** #74

Parity sweep 2026-08-28, finding `PB2-20`. Frame **`09 Vendor profile editor`** vs `/vendor/profile/edit`, measured at
1440x900 from computed styles on both sides — the frame rendered from
`design/Orla - Screens.dc.html`, the live screen in the same browser.

**Axis: Style**

| | Value |
| --- | --- |
| **Expected** (frame) | 128x128, `1px dashed #D5CEC2`, hatched placeholder |
| **Observed** (live) | **160x160**, `2px dashed #EFE9E0` (stone-200 not stone-400), flat `#F8F5EF` |

Blocked by #74: the line-height ruling changes this element's expected metrics, so fixing it first would mean measuring twice.

**Acceptance:**

- [ ] The live element matches the frame value above, read from the DOM rather than judged from a screenshot
- [ ] `parity-checker` reports **MATCH** on the **Style** axis for frame `09 Vendor profile editor`
- [ ] No other element on the screen regresses on any of the six axes as a result
- [ ] The row for `PB2-20` in `.claude/plans/parity-sweep-ledger.md` is updated to PASS

**Test (required):**

- [ ] a parity assertion comparing the element's computed `border-radius` / `padding` / `border` / `box-shadow` against the same element in the frame. Read both from the DOM; never assert a hard-coded pixel value.

---

### #144: 09 Vendor profile editor — Category chips have the wrong border weight, padding and icon circle

**Milestone:** M3 | **Priority:** P2 Medium | **Status:** Backlog | **Capabilities:** `core`
**Blocked by:** #74

Parity sweep 2026-08-28, finding `PB2-21`. Frame **`09 Vendor profile editor`** vs `/vendor/profile/edit`, measured at
1440x900 from computed styles on both sides — the frame rendered from
`design/Orla - Screens.dc.html`, the live screen in the same browser.

**Axis: Style**

| | Value |
| --- | --- |
| **Expected** (frame) | selected `1.5px solid #B4552F` on `#F7E7E0`, `padding:7px 13px 7px 8px`, 22px `#F3D6C8` icon circle; unselected `1px solid #E4DDD1` |
| **Observed** (live) | selected `1px solid #B4552F`, `padding:6px 16px 6px 6px`; unselected border `#EFE9E0` |

Blocked by #74: the line-height ruling changes this element's expected metrics, so fixing it first would mean measuring twice.

**Acceptance:**

- [ ] The live element matches the frame value above, read from the DOM rather than judged from a screenshot
- [ ] `parity-checker` reports **MATCH** on the **Style** axis for frame `09 Vendor profile editor`
- [ ] No other element on the screen regresses on any of the six axes as a result
- [ ] The row for `PB2-21` in `.claude/plans/parity-sweep-ledger.md` is updated to PASS

**Test (required):**

- [ ] a parity assertion comparing the element's computed `border-radius` / `padding` / `border` / `box-shadow` against the same element in the frame. Read both from the DOM; never assert a hard-coded pixel value.

---

### #145: 09 Vendor profile editor — Submit-bar buttons are a size class below the frame

**Milestone:** M3 | **Priority:** P1 High | **Status:** Backlog | **Capabilities:** `core`
**Blocked by:** #74

Parity sweep 2026-08-28, finding `PB2-22`. Frame **`09 Vendor profile editor`** vs `/vendor/profile/edit`, measured at
1440x900 from computed styles on both sides — the frame rendered from
`design/Orla - Screens.dc.html`, the live screen in the same browser.

**Axis: Style**

| | Value |
| --- | --- |
| **Expected** (frame) | `.btnP` 13.5px/600 `padding:11px 20px` radius 10; `.btnS` `padding:10px 20px` radius 10 |
| **Observed** (live) | `Save changes` and `Preview` both 12.5px/600, `padding:6px 12px`, **radius 8**, 33px tall |

Blocked by #74: the line-height ruling changes this element's expected metrics, so fixing it first would mean measuring twice.

**Acceptance:**

- [ ] The live element matches the frame value above, read from the DOM rather than judged from a screenshot
- [ ] `parity-checker` reports **MATCH** on the **Style** axis for frame `09 Vendor profile editor`
- [ ] No other element on the screen regresses on any of the six axes as a result
- [ ] The row for `PB2-22` in `.claude/plans/parity-sweep-ledger.md` is updated to PASS

**Test (required):**

- [ ] a parity assertion comparing the element's computed `border-radius` / `padding` / `border` / `box-shadow` against the same element in the frame. Read both from the DOM; never assert a hard-coded pixel value.

---

### #146: 09 Vendor profile editor — Service radius is an unstyled native range input

**Milestone:** M3 | **Priority:** P2 Medium | **Status:** Backlog | **Capabilities:** `core`
**Blocked by:** #74

Parity sweep 2026-08-28, finding `PB2-23`. Frame **`09 Vendor profile editor`** vs `/vendor/profile/edit`, measured at
1440x900 from computed styles on both sides — the frame rendered from
`design/Orla - Screens.dc.html`, the live screen in the same browser.

**Axis: Style**

| | Value |
| --- | --- |
| **Expected** (frame) | 4px `#EFE9E0` track, 46% `#B4552F` fill, 14px `#FFFDF9` thumb ringed `2px #B4552F` |
| **Observed** (live) | native `input[type=range]` styled only by `accent-color`, 24px tall |

Blocked by #74: the line-height ruling changes this element's expected metrics, so fixing it first would mean measuring twice.

**Acceptance:**

- [ ] The live element matches the frame value above, read from the DOM rather than judged from a screenshot
- [ ] `parity-checker` reports **MATCH** on the **Style** axis for frame `09 Vendor profile editor`
- [ ] No other element on the screen regresses on any of the six axes as a result
- [ ] The row for `PB2-23` in `.claude/plans/parity-sweep-ledger.md` is updated to PASS

**Test (required):**

- [ ] a parity assertion comparing the element's computed `border-radius` / `padding` / `border` / `box-shadow` against the same element in the frame. Read both from the DOM; never assert a hard-coded pixel value.

---

### #147: 09 Vendor profile editor — Selected category chip label is stone-900, not clay-600

**Milestone:** M3 | **Priority:** P2 Medium | **Status:** Backlog | **Capabilities:** `core`
**Blocked by:** None

Parity sweep 2026-08-28, finding `PB2-24`. Frame **`09 Vendor profile editor`** vs `/vendor/profile/edit`, measured at
1440x900 from computed styles on both sides — the frame rendered from
`design/Orla - Screens.dc.html`, the live screen in the same browser.

**Axis: Colour**

| | Value |
| --- | --- |
| **Expected** (frame) | `#8E3F20` |
| **Observed** (live) | `oklch(0.268 0.007 34.298)` ≈ stone-900 |

**Acceptance:**

- [ ] The live element matches the frame value above, read from the DOM rather than judged from a screenshot
- [ ] `parity-checker` reports **MATCH** on the **Colour** axis for frame `09 Vendor profile editor`
- [ ] No other element on the screen regresses on any of the six axes as a result
- [ ] The row for `PB2-24` in `.claude/plans/parity-sweep-ledger.md` is updated to PASS

**Test (required):**

- [ ] a parity assertion resolving the element's computed colour and comparing it to the frame's token value. Assert the resolved `rgb()`, not the class name.

---

### #148: 09 Vendor profile editor — Field labels are stone-900, not stone-600

**Milestone:** M3 | **Priority:** P2 Medium | **Status:** Backlog | **Capabilities:** `core`
**Blocked by:** None

Parity sweep 2026-08-28, finding `PB2-25`. Frame **`09 Vendor profile editor`** vs `/vendor/profile/edit`, measured at
1440x900 from computed styles on both sides — the frame rendered from
`design/Orla - Screens.dc.html`, the live screen in the same browser.

**Axis: Colour**

| | Value |
| --- | --- |
| **Expected** (frame) | `.lbl` `#6B6459` |
| **Observed** (live) | `rgb(35,32,28)` |

**Acceptance:**

- [ ] The live element matches the frame value above, read from the DOM rather than judged from a screenshot
- [ ] `parity-checker` reports **MATCH** on the **Colour** axis for frame `09 Vendor profile editor`
- [ ] No other element on the screen regresses on any of the six axes as a result
- [ ] The row for `PB2-25` in `.claude/plans/parity-sweep-ledger.md` is updated to PASS

**Test (required):**

- [ ] a parity assertion resolving the element's computed colour and comparing it to the frame's token value. Assert the resolved `rgb()`, not the class name.

---

### #149: 09 Vendor profile editor — Field labels are sentence-case 12.5px/500 instead of uppercase micro-labels

**Milestone:** M3 | **Priority:** P1 High | **Status:** Backlog | **Capabilities:** `core`
**Blocked by:** #74

Parity sweep 2026-08-28, finding `PB2-26`. Frame **`09 Vendor profile editor`** vs `/vendor/profile/edit`, measured at
1440x900 from computed styles on both sides — the frame rendered from
`design/Orla - Screens.dc.html`, the live screen in the same browser.

**Axis: Font**

| | Value |
| --- | --- |
| **Expected** (frame) | 10.5px/600/uppercase/`.05em` |
| **Observed** (live) | **12.5px/500/sentence case** |

Blocked by #74: the line-height ruling changes this element's expected metrics, so fixing it first would mean measuring twice.

**Acceptance:**

- [ ] The live element matches the frame value above, read from the DOM rather than judged from a screenshot
- [ ] `parity-checker` reports **MATCH** on the **Font** axis for frame `09 Vendor profile editor`
- [ ] No other element on the screen regresses on any of the six axes as a result
- [ ] The row for `PB2-26` in `.claude/plans/parity-sweep-ledger.md` is updated to PASS

**Test (required):**

- [ ] a parity assertion comparing computed `font-family`, `font-size`, `font-weight` and `letter-spacing` against the frame's values for the same element.

---

### #150: 09 Vendor profile editor — Tag group headings render in Instrument Serif at 12.5px

**Milestone:** M3 | **Priority:** P1 High | **Status:** Backlog | **Capabilities:** `core`
**Blocked by:** #74

Parity sweep 2026-08-28, finding `PB2-27`. Frame **`09 Vendor profile editor`** vs `/vendor/profile/edit`, measured at
1440x900 from computed styles on both sides — the frame rendered from
`design/Orla - Screens.dc.html`, the live screen in the same browser.

**Axis: Font**

| | Value |
| --- | --- |
| **Expected** (frame) | sans |
| **Observed** (live) | `<h3>` in **Instrument Serif at 12.5px** — serif below the 16px floor. Caused by `globals.css:162-166` |

Blocked by #74: the line-height ruling changes this element's expected metrics, so fixing it first would mean measuring twice.

**Acceptance:**

- [ ] The live element matches the frame value above, read from the DOM rather than judged from a screenshot
- [ ] `parity-checker` reports **MATCH** on the **Font** axis for frame `09 Vendor profile editor`
- [ ] No other element on the screen regresses on any of the six axes as a result
- [ ] The row for `PB2-27` in `.claude/plans/parity-sweep-ledger.md` is updated to PASS

**Test (required):**

- [ ] a parity assertion comparing computed `font-family`, `font-size`, `font-weight` and `letter-spacing` against the frame's values for the same element.

---

### #151: 09 Vendor profile editor — Six frame strings are missing and the slug preview has an extra path segment

**Milestone:** M3 | **Priority:** P1 High | **Status:** Backlog | **Capabilities:** `core`
**Blocked by:** None

Parity sweep 2026-08-28, finding `PB2-28`. Frame **`09 Vendor profile editor`** vs `/vendor/profile/edit`, measured at
1440x900 from computed styles on both sides — the frame rendered from
`design/Orla - Screens.dc.html`, the live screen in the same browser.

**Axis: Text**

| | Value |
| --- | --- |
| **Expected** (frame) | `Cover image` label, `cover 21:9 — 1600x686 min` mono placeholder, `Drop an image or browse`, photo zone `portrait` + `Replace`, `Service radius — 60 miles`, slug `orla.com/kessler-co`, and `Saved 30 seconds ago` in the submit bar |
| **Observed** (live) | all missing. Photo zone reads `Add photo`; the radius value is split into a separate span plus an unsourced helper; slug renders `orla.com/vendors/northgate-sound` — the `/vendors/` segment is in **neither** source; `Saved N ago` exists in **no** state |

**Acceptance:**

- [ ] The live element matches the frame value above, read from the DOM rather than judged from a screenshot
- [ ] `parity-checker` reports **MATCH** on the **Text** axis for frame `09 Vendor profile editor`
- [ ] No other element on the screen regresses on any of the six axes as a result
- [ ] The row for `PB2-28` in `.claude/plans/parity-sweep-ledger.md` is updated to PASS

**Test (required):**

- [ ] a test asserting the rendered literal equals the frame's literal, with the expected string read out of `Orla - Screens.dc.html` rather than duplicated into the test.

---

### #152: 09 Vendor profile editor — Eight helper strings appear with no frame or content-voice source

**Milestone:** M3 | **Priority:** P2 Medium | **Status:** Backlog | **Capabilities:** `core`
**Blocked by:** None

Parity sweep 2026-08-28, finding `PB2-29`. Frame **`09 Vendor profile editor`** vs `/vendor/profile/edit`, measured at
1440x900 from computed styles on both sides — the frame rendered from
`design/Orla - Screens.dc.html`, the live screen in the same browser.

**Axis: Text**

| | Value |
| --- | --- |
| **Expected** (frame) | copy drawn from the frame or `31-content-voice.md` |
| **Observed** (live) | unsourced: `One sentence, in your own words. It opens your profile.`, `Counted from when you started, not when you joined here.`, `A couple of paragraphs is plenty.`, `How quickly customers can expect to hear back.`, `How customers find someone who fits their celebration.`, `1 of 5 chosen.`, `0 / 80`, `57 / 1200` |

**Acceptance:**

- [ ] The live element matches the frame value above, read from the DOM rather than judged from a screenshot
- [ ] `parity-checker` reports **MATCH** on the **Text** axis for frame `09 Vendor profile editor`
- [ ] No other element on the screen regresses on any of the six axes as a result
- [ ] The row for `PB2-29` in `.claude/plans/parity-sweep-ledger.md` is updated to PASS

**Test (required):**

- [ ] a test asserting the rendered literal equals the frame's literal, with the expected string read out of `Orla - Screens.dc.html` rather than duplicated into the test.

---

### #153: 11 Availability — Availability rail is 41px narrow and the month columns absorb it

**Milestone:** M3 | **Priority:** P1 High | **Status:** Backlog | **Capabilities:** `core`
**Blocked by:** #74

Parity sweep 2026-08-28, finding `PB2-30`. Frame **`11 Availability`** vs `/vendor/availability`, measured at
1440x900 from computed styles on both sides — the frame rendered from
`design/Orla - Screens.dc.html`, the live screen in the same browser.

**Axis: Layout**

| | Value |
| --- | --- |
| **Expected** (frame) | rail 341px footprint / 300px content; content column 786px; month columns 248.7px |
| **Observed** (live) | 300px / 260px; content column 852px; month columns 271px |

Blocked by #74: the line-height ruling changes this element's expected metrics, so fixing it first would mean measuring twice.

**Acceptance:**

- [ ] The live element matches the frame value above, read from the DOM rather than judged from a screenshot
- [ ] `parity-checker` reports **MATCH** on the **Layout** axis for frame `11 Availability`
- [ ] No other element on the screen regresses on any of the six axes as a result
- [ ] The row for `PB2-30` in `.claude/plans/parity-sweep-ledger.md` is updated to PASS

**Test (required):**

- [ ] a parity assertion comparing the element's `getBoundingClientRect()` against the same element rendered from `Orla - Screens.dc.html`. Derive the expected box from the frame at test time so the test cannot drift from the contract.

---

### #154: 11 Availability — Selected panel radius and padding are both 2px/1px over

**Milestone:** M3 | **Priority:** P2 Medium | **Status:** Backlog | **Capabilities:** `core`
**Blocked by:** #74

Parity sweep 2026-08-28, finding `PB2-31`. Frame **`11 Availability`** vs `/vendor/availability`, measured at
1440x900 from computed styles on both sides — the frame rendered from
`design/Orla - Screens.dc.html`, the live screen in the same browser.

**Axis: Style**

| | Value |
| --- | --- |
| **Expected** (frame) | radius 12, padding 13 |
| **Observed** (live) | radius 14, padding 14 |

Blocked by #74: the line-height ruling changes this element's expected metrics, so fixing it first would mean measuring twice.

**Acceptance:**

- [ ] The live element matches the frame value above, read from the DOM rather than judged from a screenshot
- [ ] `parity-checker` reports **MATCH** on the **Style** axis for frame `11 Availability`
- [ ] No other element on the screen regresses on any of the six axes as a result
- [ ] The row for `PB2-31` in `.claude/plans/parity-sweep-ledger.md` is updated to PASS

**Test (required):**

- [ ] a parity assertion comparing the element's computed `border-radius` / `padding` / `border` / `box-shadow` against the same element in the frame. Read both from the DOM; never assert a hard-coded pixel value.

---

### #155: 11 Availability — Market-note panel radius is 14px, not 12px

**Milestone:** M3 | **Priority:** P2 Medium | **Status:** Backlog | **Capabilities:** `core`
**Blocked by:** #74

Parity sweep 2026-08-28, finding `PB2-32`. Frame **`11 Availability`** vs `/vendor/availability`, measured at
1440x900 from computed styles on both sides — the frame rendered from
`design/Orla - Screens.dc.html`, the live screen in the same browser.

**Axis: Style**

| | Value |
| --- | --- |
| **Expected** (frame) | radius 12 |
| **Observed** (live) | radius 14 |

Blocked by #74: the line-height ruling changes this element's expected metrics, so fixing it first would mean measuring twice.

**Acceptance:**

- [ ] The live element matches the frame value above, read from the DOM rather than judged from a screenshot
- [ ] `parity-checker` reports **MATCH** on the **Style** axis for frame `11 Availability`
- [ ] No other element on the screen regresses on any of the six axes as a result
- [ ] The row for `PB2-32` in `.claude/plans/parity-sweep-ledger.md` is updated to PASS

**Test (required):**

- [ ] a parity assertion comparing the element's computed `border-radius` / `padding` / `border` / `box-shadow` against the same element in the frame. Read both from the DOM; never assert a hard-coded pixel value.

---

### #156: 11 Availability — `Block these` button is under-padded

**Milestone:** M3 | **Priority:** P2 Medium | **Status:** Backlog | **Capabilities:** `core`
**Blocked by:** #74

Parity sweep 2026-08-28, finding `PB2-33`. Frame **`11 Availability`** vs `/vendor/availability`, measured at
1440x900 from computed styles on both sides — the frame rendered from
`design/Orla - Screens.dc.html`, the live screen in the same browser.

**Axis: Style**

| | Value |
| --- | --- |
| **Expected** (frame) | `padding:8px 14px` |
| **Observed** (live) | `padding:6px 12px` |

Blocked by #74: the line-height ruling changes this element's expected metrics, so fixing it first would mean measuring twice.

**Acceptance:**

- [ ] The live element matches the frame value above, read from the DOM rather than judged from a screenshot
- [ ] `parity-checker` reports **MATCH** on the **Style** axis for frame `11 Availability`
- [ ] No other element on the screen regresses on any of the six axes as a result
- [ ] The row for `PB2-33` in `.claude/plans/parity-sweep-ledger.md` is updated to PASS

**Test (required):**

- [ ] a parity assertion comparing the element's computed `border-radius` / `padding` / `border` / `box-shadow` against the same element in the frame. Read both from the DOM; never assert a hard-coded pixel value.

---

### #157: 11 Availability — Month nav uses circular icon buttons where the frame uses inline glyphs

**Milestone:** M3 | **Priority:** P2 Medium | **Status:** Backlog | **Capabilities:** `core`
**Blocked by:** #74

Parity sweep 2026-08-28, finding `PB2-34`. Frame **`11 Availability`** vs `/vendor/availability`, measured at
1440x900 from computed styles on both sides — the frame rendered from
`design/Orla - Screens.dc.html`, the live screen in the same browser.

**Axis: Style**

| | Value |
| --- | --- |
| **Expected** (frame) | inline `‹` / `›` in `#6B6459` at 13px |
| **Observed** (live) | two 36px circular icon buttons (which also fail the 44x44 law — see PB2-S5) |

Blocked by #74: the line-height ruling changes this element's expected metrics, so fixing it first would mean measuring twice.

**Acceptance:**

- [ ] The live element matches the frame value above, read from the DOM rather than judged from a screenshot
- [ ] `parity-checker` reports **MATCH** on the **Style** axis for frame `11 Availability`
- [ ] No other element on the screen regresses on any of the six axes as a result
- [ ] The row for `PB2-34` in `.claude/plans/parity-sweep-ledger.md` is updated to PASS

**Test (required):**

- [ ] a parity assertion comparing the element's computed `border-radius` / `padding` / `border` / `box-shadow` against the same element in the frame. Read both from the DOM; never assert a hard-coded pixel value.

---

### #158: 11 Availability — `Clear` is clay where the frame is stone

**Milestone:** M3 | **Priority:** P2 Medium | **Status:** Backlog | **Capabilities:** `core`
**Blocked by:** None

Parity sweep 2026-08-28, finding `PB2-35`. Frame **`11 Availability`** vs `/vendor/availability`, measured at
1440x900 from computed styles on both sides — the frame rendered from
`design/Orla - Screens.dc.html`, the live screen in the same browser.

**Axis: Colour**

| | Value |
| --- | --- |
| **Expected** (frame) | `#4A443C` |
| **Observed** (live) | `#A34A28` |

**Acceptance:**

- [ ] The live element matches the frame value above, read from the DOM rather than judged from a screenshot
- [ ] `parity-checker` reports **MATCH** on the **Colour** axis for frame `11 Availability`
- [ ] No other element on the screen regresses on any of the six axes as a result
- [ ] The row for `PB2-35` in `.claude/plans/parity-sweep-ledger.md` is updated to PASS

**Test (required):**

- [ ] a parity assertion resolving the element's computed colour and comparing it to the frame's token value. Assert the resolved `rgb()`, not the class name.

---

### #159: 11 Availability — Calendar day cells render 11px, not 12px

**Milestone:** M3 | **Priority:** P2 Medium | **Status:** Backlog | **Capabilities:** `core`
**Blocked by:** #74

Parity sweep 2026-08-28, finding `PB2-36`. Frame **`11 Availability`** vs `/vendor/availability`, measured at
1440x900 from computed styles on both sides — the frame rendered from
`design/Orla - Screens.dc.html`, the live screen in the same browser.

**Axis: Font**

| | Value |
| --- | --- |
| **Expected** (frame) | `12px` |
| **Observed** (live) | `11px` |

Blocked by #74: the line-height ruling changes this element's expected metrics, so fixing it first would mean measuring twice.

**Acceptance:**

- [ ] The live element matches the frame value above, read from the DOM rather than judged from a screenshot
- [ ] `parity-checker` reports **MATCH** on the **Font** axis for frame `11 Availability`
- [ ] No other element on the screen regresses on any of the six axes as a result
- [ ] The row for `PB2-36` in `.claude/plans/parity-sweep-ledger.md` is updated to PASS

**Test (required):**

- [ ] a parity assertion comparing computed `font-family`, `font-size`, `font-weight` and `letter-spacing` against the frame's values for the same element.

---

### #160: 11 Availability — Page title carries `-0.65px` tracking against the frame's `-0.26px`

**Milestone:** M3 | **Priority:** P2 Medium | **Status:** Backlog | **Capabilities:** `core`
**Blocked by:** #74

Parity sweep 2026-08-28, finding `PB2-37`. Frame **`11 Availability`** vs `/vendor/availability`, measured at
1440x900 from computed styles on both sides — the frame rendered from
`design/Orla - Screens.dc.html`, the live screen in the same browser.

**Axis: Font**

| | Value |
| --- | --- |
| **Expected** (frame) | `-0.26px` |
| **Observed** (live) | `-0.65px`. Caused by `globals.css:162-166` |

Blocked by #74: the line-height ruling changes this element's expected metrics, so fixing it first would mean measuring twice.

**Acceptance:**

- [ ] The live element matches the frame value above, read from the DOM rather than judged from a screenshot
- [ ] `parity-checker` reports **MATCH** on the **Font** axis for frame `11 Availability`
- [ ] No other element on the screen regresses on any of the six axes as a result
- [ ] The row for `PB2-37` in `.claude/plans/parity-sweep-ledger.md` is updated to PASS

**Test (required):**

- [ ] a parity assertion comparing computed `font-family`, `font-size`, `font-weight` and `letter-spacing` against the frame's values for the same element.

---

### #161: 11 Availability — Month names carry negative tracking the frame does not

**Milestone:** M3 | **Priority:** P2 Medium | **Status:** Backlog | **Capabilities:** `core`
**Blocked by:** #74

Parity sweep 2026-08-28, finding `PB2-38`. Frame **`11 Availability`** vs `/vendor/availability`, measured at
1440x900 from computed styles on both sides — the frame rendered from
`design/Orla - Screens.dc.html`, the live screen in the same browser.

**Axis: Font**

| | Value |
| --- | --- |
| **Expected** (frame) | `letter-spacing: normal` |
| **Observed** (live) | `-0.45px` |

Blocked by #74: the line-height ruling changes this element's expected metrics, so fixing it first would mean measuring twice.

**Acceptance:**

- [ ] The live element matches the frame value above, read from the DOM rather than judged from a screenshot
- [ ] `parity-checker` reports **MATCH** on the **Font** axis for frame `11 Availability`
- [ ] No other element on the screen regresses on any of the six axes as a result
- [ ] The row for `PB2-38` in `.claude/plans/parity-sweep-ledger.md` is updated to PASS

**Test (required):**

- [ ] a parity assertion comparing computed `font-family`, `font-size`, `font-weight` and `letter-spacing` against the frame's values for the same element.

---

### #162: 11 Availability — Rail micro-labels render in Instrument Serif

**Milestone:** M3 | **Priority:** P1 High | **Status:** Backlog | **Capabilities:** `core`
**Blocked by:** #74

Parity sweep 2026-08-28, finding `PB2-39`. Frame **`11 Availability`** vs `/vendor/availability`, measured at
1440x900 from computed styles on both sides — the frame rendered from
`design/Orla - Screens.dc.html`, the live screen in the same browser.

**Axis: Font**

| | Value |
| --- | --- |
| **Expected** (frame) | `SELECTED` / `LEGEND` / `THIS QUARTER` in Instrument **Sans** |
| **Observed** (live) | **Instrument Serif** — size, weight, tracking and colour are all otherwise correct. Caused by `globals.css:162-166` |

Blocked by #74: the line-height ruling changes this element's expected metrics, so fixing it first would mean measuring twice.

**Acceptance:**

- [ ] The live element matches the frame value above, read from the DOM rather than judged from a screenshot
- [ ] `parity-checker` reports **MATCH** on the **Font** axis for frame `11 Availability`
- [ ] No other element on the screen regresses on any of the six axes as a result
- [ ] The row for `PB2-39` in `.claude/plans/parity-sweep-ledger.md` is updated to PASS

**Test (required):**

- [ ] a parity assertion comparing computed `font-family`, `font-size`, `font-weight` and `letter-spacing` against the frame's values for the same element.

---

### #163: 11 Availability — Two instructions 40px apart contradict each other

**Milestone:** M3 | **Priority:** P1 High | **Status:** Backlog | **Capabilities:** `core`
**Blocked by:** None

Parity sweep 2026-08-28, finding `PB2-40`. Frame **`11 Availability`** vs `/vendor/availability`, measured at
1440x900 from computed styles on both sides — the frame rendered from
`design/Orla - Screens.dc.html`, the live screen in the same browser.

**Axis: Text**

| | Value |
| --- | --- |
| **Expected** (frame) | one instruction |
| **Observed** (live) | rail says `Click a date to select it, or drag across several.` while the pane sub-line says `Click a date to block it...`. **Only one is true** (a click selects). Neither string is in the frame |

**Acceptance:**

- [ ] The live element matches the frame value above, read from the DOM rather than judged from a screenshot
- [ ] `parity-checker` reports **MATCH** on the **Text** axis for frame `11 Availability`
- [ ] No other element on the screen regresses on any of the six axes as a result
- [ ] The row for `PB2-40` in `.claude/plans/parity-sweep-ledger.md` is updated to PASS

**Test (required):**

- [ ] a test asserting the rendered literal equals the frame's literal, with the expected string read out of `Orla - Screens.dc.html` rather than duplicated into the test.

---

### #164: 11 Availability — The page has no `<h1>`

**Milestone:** M3 | **Priority:** P2 Medium | **Status:** Backlog | **Capabilities:** `core`
**Blocked by:** None

Parity sweep 2026-08-28, finding `PB2-41`. Frame **`11 Availability`** vs `/vendor/availability`, measured at
1440x900 from computed styles on both sides — the frame rendered from
`design/Orla - Screens.dc.html`, the live screen in the same browser.

**Axis: Access**

| | Value |
| --- | --- |
| **Expected** (frame) | a top-level heading |
| **Observed** (live) | the title is an `<h2>`, so the document has **no `<h1>`** |

**Acceptance:**

- [ ] The live element matches the frame value above, read from the DOM rather than judged from a screenshot
- [ ] `parity-checker` reports **MATCH** on the **Access** axis for frame `11 Availability`
- [ ] No other element on the screen regresses on any of the six axes as a result
- [ ] The row for `PB2-41` in `.claude/plans/parity-sweep-ledger.md` is updated to PASS

**Test (required):**

- [ ] a browser assertion covering this law directly — and asserting the *rendered* result, not the computed value, since a correct computed value is exactly what passes today while rendering wrong.

---

### #165: One `globals.css` rule breaks the font axis on every screen in the product

**Milestone:** M3 | **Priority:** P1 High | **Status:** In Progress | **Capabilities:** `core`
**Blocked by:** None

Found by parity batch 2, 2026-08-28. `apps/web/src/app/globals.css:162-166`:

```css
h1, h2, h3 { @apply font-display tracking-tight; }
```

Two consequences, both measured on all three vendor screens and almost certainly present on
every other screen in the product:

1. **Any `h2`/`h3` used as a micro-label renders in Instrument Serif** — observed at 10.5px,
   11px and 12.5px. `01-foundations.md` states Instrument Serif is **"Never below 16px"**.
   Confirmed hits: the dashboard rail label `Friday, August 28`; the editor's
   `Languages spoken` / `Cultural specialties` / `Dietary` group headings; the availability
   rail's `SELECTED` / `LEGEND` / `THIS QUARTER` micro-labels.
2. **`tracking-tight` (-0.025em) overrides the frames' `.h2` `letter-spacing: -.01em`**, so
   titles compute `-0.65px` where the frame computes `-0.26px`. The dashboard `h1` escapes
   only because it carries an explicit `tracking-[-.01em]` — which is the workaround this
   rule forces on every heading that wants the correct value.

**This is the highest-leverage fix in the sweep.**

**Correction, 2026-08-29, made while implementing this ticket.** The four dependent tickets
were originally written here as #89, #109, #119 and #121. Those numbers are wrong — they are
a hero focus ring, chip radii, sidebar border-box footprints and icon hit areas, none of
which are on the font axis. The tickets this one actually causes, matched by their own
descriptions against the board, are:

- **#131** — 08 Vendor dashboard: rail label renders in Instrument Serif at 11px
- **#150** — 09 Vendor profile editor: tag group headings render in Instrument Serif at 12.5px
- **#160** — 11 Availability: page title carries `-0.65px` tracking against the frame's `-0.26px`
- **#161** — 11 Availability: month names carry negative tracking the frame does not
- **#162** — 11 Availability: rail micro-labels render in Instrument Serif

It will be the cause of equivalent failures on every frame not yet swept.

The defect is using element type as a styling hook. Heading *level* is document structure;
serif display type is a *role*. A micro-label that is semantically an `h2` must not inherit
display type from its tag.

**Acceptance:**

- [ ] The blanket `h1, h2, h3` rule is removed; display type is applied by an explicit class or token, not by element type
- [ ] No text node below 16px renders in Instrument Serif anywhere in the app
- [ ] Headings compute the frames' `letter-spacing` without needing a per-element `tracking-[…]` override
- [ ] The five dependent tickets above are re-measured after this lands, and any that now pass are closed as fixed-by-#165
- [ ] Every screen already marked PASS in the sweep ledger is re-checked on the font axis

**Tests (required):**

- [ ] A test walking the rendered tree and asserting **no** element with `font-family` resolving to Instrument Serif has a `font-size` below 16px. This is a whole-class guard, not a per-element assertion, and it is what stops the next micro-label-as-heading from reintroducing it.
- [ ] A parity assertion that heading `letter-spacing` matches the frame without a local override.

**Implementation notes, 2026-08-29 (branch `worktree-165`).**

The hook is `.display-heading` in `globals.css`, in `@layer components` so a `tracking-[…]`
utility still beats it — that is what keeps the landing hero at `-.02em` and the error
screens at `-.015em` without an `!important`. It carries the family and the tracking and
leaves the size to the type scale, because **the frames apply `class="h2"` at 19, 20, 21, 22,
23 and 26px** and hold `-.01em` at all six, while eight inline serif spans sit at exactly 26px
with no tracking at all. Tracking follows the role, not the size step — which is also why
`--text-*--letter-spacing` companions must **not** be added to the scale in #74/#198.

A second defect was found and fixed in the same pass: `--font-heading: var(--font-display)`
in `@theme inline` was a second name for the same face, and shadcn's `DialogTitle` used it —
so **every dialog in the product rendered Instrument Serif at 13.5px**, below the floor and
invisible to any guard looking for `font-display`. Alias deleted, `DialogTitle` is sans.

**Measured in the browser at 1440x900**, ten screens, both auth states, by computed style
rather than by eye:

- **No element renders Instrument Serif below 16px** on any screen reached, except the 20
  avatar-initial spans at 14.28px — filed as **#230**, which needs a design ruling.
- Every `.display-heading` title computes exactly `-0.01em` (`-0.26px` at 26px, `-0.22px` at
  22px, `-0.2px` at 20px). The hero computes `-0.02em`, the 404 `-0.015em`.
- **Nothing computes `-0.025em` anywhere**, confirmed by walking the whole CSSOM, not just
  the elements.
- No horizontal overflow, no clipping, no new console errors.

**Four vendor screens could not be measured** — dashboard, portfolio, packages and
availability all redirect because the E2E vendor account has no vendor profile. Filed as
**#233**. Those four surfaces are therefore **unreached, not verified**, and the availability
rail micro-labels named in this ticket still want a look once #233 lands.

Also filed from this pass: **#231**, **#232** (lane infrastructure) and **#234** (Clerk's card
shows the repo name to users).

---

### #166: Availability calendar — every cell state carries a shape, not just a fill (change order A1)

**Milestone:** M3 | **Priority:** P1 High | **Status:** Backlog | **Capabilities:** `core`
**Blocked by:** None

`design/design-plan/CHANGE-ORDER-2026-08-28.md` Part A1. **Problem being fixed:** booked,
pending and blocked were three pale fills within ~2 points of luminance of one another —
indistinguishable in greyscale, at a glance, or with red-green colour deficiency.

**Rule: every cell state carries a shape as well as a fill. Fill alone is never the signal.**

| State | Fill | Shape | Number | Interactive |
| --- | --- | --- | --- | --- |
| Available | `#FFFDF9`, 1px `#E4DDD1` | none | `#23201C` | click / drag to block |
| Booked — locked | `#F7E7E0` | **4px solid `#B4552F` dot**, centred below the number | `#8E3F20`, 600 | opens the booking |
| Pending request | `#F5EEDC` | **1.5px dashed `#C99A2E` border** | `#7A5A12`, 600 | opens the request |
| Blocked by you | 45° hatch `repeating-linear-gradient(-45deg,#EFE9E0 0 3px,#E0D8CA 3px 6px)` | **line-through** on the number | `#6B6459` | click to unblock |
| **Completed** (new) | `#EDF0E9` | **check glyph** `#5E6B4F`, centred below the number | `#4B5940`, 600 | **yes — opens the past booking** |
| Selecting now | `#B4552F` | fill is the signal | `#FFFDF9`, 600 | drag continues |
| **Today** (new) | `#FFFDF9`, **1.5px solid `#23201C`** | ink outline | `#23201C`, 600 | normal for its state |
| Past, nothing booked | `#F8F5EF` | none | `#C9C1B5` | inert, no hover |

Implementation notes, verbatim from the change order:

- Cells carrying a dot or check need `padding: 5px 0 10px` (against `7px 0` elsewhere) so the number stays optically centred. Cells with a 1.5px border use `padding: 5.5px 0` to avoid a 3px height shift.
- Dot: `position:absolute; left:50%; bottom:4px; margin-left:-2px; width:4px; height:4px; border-radius:50%`
- Check: `position:absolute; left:50%; bottom:5px; margin-left:-4px; width:7px; height:4px; border-left:1.6px solid #5E6B4F; border-bottom:1.6px solid #5E6B4F; transform:rotate(-45deg)`
- **Do not use ✕ for blocked** — a cross means "close / dismiss" elsewhere in the product.
- **Completed cells are clickable and get a hover state.** Other past dates do not.
- The **legend must render the real marks**, not flat colour chips, and gains rows for Completed and Today. Caption: "Every state carries a shape as well as a colour, so the calendar still reads in greyscale and for colour-blind vendors."
- Sidebar summary splits "Booked" into **Booked ahead** and **Completed** (completed counted in `#4B5940`).
- Helper text becomes: "Click a date to block it, or drag across several. Booked dates are locked, and completed events stay on the calendar — click one to open it."

Screen 11 has no separate tablet/mobile frame; the same cell component serves every width.
Do not restyle other calendars (e.g. the dashboard week strip).

**This also resolves #164** (the contradictory rail/pane instruction), since the new helper
text replaces both strings.

**Acceptance:**

- [ ] All eight states render their specified fill **and** shape
- [ ] `Completed` and `Today` exist as states; completed cells are clickable with a hover state and open the past booking
- [ ] Padding compensations applied so no state shifts cell height
- [ ] Legend renders the real marks, gains Completed and Today rows, and carries the caption
- [ ] Sidebar splits Booked into Booked ahead and Completed
- [ ] Helper text replaces both current contradictory strings
- [ ] No ✕ used for blocked

**Tests (required):**

- [ ] A component test per state asserting **both** the fill and the presence of the shape element. Asserting fill alone reproduces the exact bug this ticket fixes.
- [ ] A greyscale assertion: with colour removed, every state remains distinguishable by shape.
- [ ] A test asserting completed cells are clickable and other past dates are inert.
- [ ] A test asserting cell height is identical across all eight states.

---

### #167: Build the shared dropdown component — nothing rolls its own (change order A2)

**Milestone:** M3 | **Priority:** P1 High | **Status:** In Progress | **Capabilities:** `core`
**Blocked by:** None

`CHANGE-ORDER-2026-08-28.md` Part A2 plus the new `design/design-plan/42-dropdowns.md`, and
two new frames: **`28 Dropdown open — hero`** and **`28 Dropdown variants`**.

**Currently every select is undesigned.** Build **one** component; nothing rolls its own.
**This supersedes #69** — that ticket described the symptoms (oversized, unreachable, stays
open); this is the specification that fixes them.

**Mounts** — ≥640px: anchored popover, 8px below the field, aligned to the field's **left
edge**. <640px: **bottom sheet** — full width, 48px rows, 34×4px grab handle, explicit
"Close", dismissing scrim, max **70% of viewport height**.

**Shell** — `#FFFDF9` fill, 1px `#E4DDD1`, **12px radius**, `0 14px 44px rgba(35,40,38,.20)`,
6px inner padding. Rows **44px** (38px from the compact header bar, 48px in the sheet), 8px
radius. Hover `#F1ECE4`; selected `#F7E7E0` with a clay check, label weight 600, colour
`#8E3F20`. Width **330px** from the hero bar, **258px** from the compact header bar; never
narrower than its field. **Max height 360px, scrolls, cut row left half-visible so the scroll
is legible.** Flips above the field when the field is within 380px of the viewport bottom.

**Bodies** — (1) **Single-select** (vendor type, city, event type): commits and closes on
click, **no search field**. (2) **Multi-select** (style, any "pick any" filter):
**checkboxes, not checkmarks**, 15px square, 4px radius, `#B4552F` when checked; footer
**Apply · n** + Clear. (3) **Range** (price): preset chips first, min/max inputs below,
slider as a *readout of the inputs* rather than the only control; footer Apply + Clear.
(4) **Date**: single-month popover reusing the **A1 cell marks**, mini legend, Clear.

**Multi-select and range panels never auto-apply** — a filter firing per keystroke makes the
results grid flicker under the user's hand.

**Behaviour** — dismiss on outside click, `Esc`, or select. **Scroll repositions, never
dismisses.** Keyboard: ↑↓ move, ↵ commits, type-ahead jumps to first letter, `Tab` closes and
moves on, focus returns to the field on close. Open field: value turns clay, caret flips; in
the compact header bar the open segment is the only clay element. Scrim `rgba(35,32,28,.16)`
desktop / `.34` mobile on **hero and mobile only** — never in the compact header. Empty body:
one row of `#6B6459` copy explaining why plus a single action, never a blank panel.

**Applies to:** hero search (landing), compact header bar, Refine bar filters,
booking-request event type, and vendor profile editor selects.

**Closes these sweep findings:** the 719px Languages panel unreachable at 1024 and 390 (max
height 360 + scroll), Rating/Price staying open (single-select closes; multi/range get an
explicit Apply), Escape not dismissing, and the Refine bar's inconsistent auto-apply.

**Acceptance:**

- [ ] One component; every select in the five named surfaces uses it
- [ ] Popover ≥640, bottom sheet <640, with every shell value above
- [ ] All four body types built to spec; multi-select uses checkboxes, not checkmarks
- [ ] Multi-select and range require an explicit Apply — no auto-apply
- [ ] Dismiss on outside click, Esc and select; **scroll repositions, never dismisses**
- [ ] Full keyboard model including type-ahead and focus return
- [ ] Max height 360px with a half-visible cut row; flips when within 380px of the viewport bottom
- [ ] Scrim on hero and mobile only
- [ ] Matches frames `28 Dropdown open — hero` and `28 Dropdown variants` on all six axes

**Tests (required):**

- [ ] At 1440, 1024, 768 and 390: every option's rect is fully inside the viewport and a real click changes state. Assert the **rect** — every unreachable option in the sweep existed in the DOM while being unclickable.
- [ ] A test asserting scroll repositions rather than dismisses.
- [ ] A test asserting multi-select and range do not apply until Apply is pressed.
- [ ] A keyboard test: ↑↓, ↵, type-ahead, Tab-closes, and focus returns to the field.
- [ ] A test asserting the bottom sheet appears below 640 and the popover at/above it.

---

### #168: Replace the page loader with the mark's two converging rings (change order B3)

**Milestone:** M3 | **Priority:** P2 Medium | **Status:** Done | **Capabilities:** `core`
**Blocked by:** None

`CHANGE-ORDER-2026-08-28.md` Part B3. Replace the wordmark pulse with the **mark's two rings
converging**: 30px circles, filled `#B4552F` and 2px `#23201C` outline, translating
−9px→+7px and +9px→−7px on a **1.9s `cubic-bezier(.45,0,.55,1)`** loop so they cross past
each other at mid-cycle.

**No wordmark** — this renders before fonts are guaranteed, which is the reason for the
change. Page loader is for **first paint and auth redirects only**.

**Acceptance:**

- [ ] Two 30px rings with the specified fill and outline, animating to the stated translations and timing
- [ ] No wordmark and no webfont dependency in the loader
- [ ] Used only for first paint and auth redirects — not as a general spinner
- [ ] Respects `prefers-reduced-motion` per `04-laws.md`

**Tests (required):**

- [ ] A test asserting the loader renders no text node and references no webfont family.
- [ ] A test asserting the animation is suppressed under `prefers-reduced-motion`.

---

### #169: Treat 1024 as a real breakpoint, height-constrained (change order B4)

**Milestone:** M3 | **Priority:** P1 High | **Status:** Backlog | **Capabilities:** `core`
**Blocked by:** None

`CHANGE-ORDER-2026-08-28.md` Part B4. **1024 is a real breakpoint, not compressed desktop;
the binding constraint at this width is height (640px usable), not width.** Seven frames
cover it, renumbered `27 …` in the current bundle.

- Page padding 40 → **24–28px**
- Sidebars stay **220px with labels** — no icon rail
- Right rails narrow 420 → **340px**, never stack
- Grids lose a column before a card loses information (results 4 → 3, **14px gaps**)
- Landing hero keeps **all three** overlapping photo cards beside the text at **0.73 scale**; display type 54 → **40px**
- **Checkout: "Due today" must stay above the fold. Hard constraint.**
- Vendor dashboard: right column **300px**, calendar shows the **booking week**, not the month

Related: B1's 3:2 card covers are already built, and B1 notes the consequence — **any pane
with a fixed bottom action bar needs bottom padding equal to the bar's height** (76px on
mobile search) or the last card's price row lands under it.

**Acceptance:**

- [ ] Every value above holds at 1024x768, measured from the DOM
- [ ] All seven `27 …` frames pass `parity-checker` on all six axes
- [ ] "Due today" is above the fold on checkout at 1024 — asserted, not eyeballed
- [ ] No pane with a fixed bottom bar clips its last row
- [ ] Height, not width, is treated as the binding constraint — no scroll budget regressions

**Tests (required):**

- [ ] A responsive assertion at 1024x768 for padding, sidebar width, rail width, grid columns and gap, hero photo scale and display size.
- [ ] A test asserting the checkout "Due today" element's rect bottom is ≤640.
- [ ] A test asserting the last card in a pane with a fixed bottom bar is fully above that bar.

---

### #170: Uploads — Customer profile photo upload is dead, and leaks an internal role message to the user

**Milestone:** M3 | **Priority:** P0 Critical | **Status:** Done | **Capabilities:** `core` `storage`
**Blocked by:** None

Uploads adversarial pass, 2026-08-28. **Where:** `/customer/profile`, customer.

| | |
| --- | --- |
| **Expected** | the photo uploads — the API defines a `customer-profile` storage prefix and the page ships an uploader for it |
| **Observed** | **every** upload fails. `403 POST /upload/image?prefix=customer-profile`. The failure line renders the server's internal message verbatim: `This endpoint requires the vendor role  JPG or PNG · under 12 MB · at least 1200px wide.` The advice is also wrong — the file met every stated constraint. Confirmed at API level: a customer token gets 403 `"This endpoint requires the vendor role"` on **all four** prefixes including `customer-profile` |

**Cause.** `apps/api/src/modules/uploads/uploads.routes.ts` gates the whole route with `preHandler: requireRole('vendor')`, so the `customer-profile` prefix it declares is unreachable by the only role that would use it. Consumer: `apps/web/src/components/customer/customer-profile-form.tsx`

**Acceptance:**

- [ ] The upload route authorizes **per prefix**, not per route — a customer may upload to `customer-profile` and to nothing else
- [ ] A vendor may upload to `vendor-profile`, `vendor-cover` and `portfolio`, and not to `customer-profile`
- [ ] No internal authorization message ever reaches a user-facing surface (see #72)
- [ ] The failure copy names the real reason and a real fix

**Tests (required):**

- [ ] An API test per (role, prefix) pair asserting the allowed matrix — this is a table, not one example, because the bug is a whole missing dimension.
- [ ] A test asserting no rendered upload error contains the string `requires the vendor role`.
- [ ] A browser test uploading a valid photo as a customer and asserting it persists across reload.

---

### #171: Uploads — A successful upload renders a broken image and a 500, while the toast says it worked

**Milestone:** M3 | **Priority:** P1 High | **Status:** In Progress | **Capabilities:** `core` `storage`
**Blocked by:** None

Uploads adversarial pass, 2026-08-28. **Where:** `/vendor/profile/edit`, vendor.

| | |
| --- | --- |
| **Expected** | the preview shows the uploaded photo immediately, using the resolved URL the upload returns |
| **Observed** | the API returns `201` with `imageUrl: "http://localhost:9000/vendor-marketplace-uploads/vendor-profile/<uuid>.webp"`, but the `<img>` renders the **storage key resolved against the current page path**: `src = http://localhost:3000/vendor/profile/vendor-profile/<uuid>.webp` → `naturalWidth = 0`, `500 GET`. The toast simultaneously reads **"Profile photo updated."** The circle goes blank — the `Add photo` invitation disappears because `value` is truthy, and nothing replaces it, so the vendor cannot tell whether it worked. **Reproduced 4/4** with different files |

**Cause.** `apps/web/src/components/image-upload.tsx` uses the returned **key** where it needs the resolved **URL**

**Acceptance:**

- [ ] The preview renders the resolved absolute URL the upload returns
- [ ] A failed image load is surfaced, never reported as success
- [ ] The success toast fires only after the image actually loads

**Tests (required):**

- [ ] A component test asserting the rendered `src` equals the API's `imageUrl`, not the key.
- [ ] A browser test asserting `naturalWidth > 0` after an upload completes — `complete === true` is true for a broken image and is the check that would pass today.

---

### #172: Uploads — The image format allow-list is bypassed by renaming the file

**Milestone:** M3 | **Priority:** P1 High | **Status:** Backlog | **Capabilities:** `core` `storage`
**Blocked by:** None

Uploads adversarial pass, 2026-08-28. **Where:** `/vendor/portfolio` and `/vendor/profile/edit`, vendor.

| | |
| --- | --- |
| **Expected** | refused. `ACCEPTED_IMAGE_MIME_TYPES = ['image/jpeg','image/png']`, and `images.ts` documents that the client type "is not trusted: `sharp` decodes the actual bytes, so a `.png` full of something else fails here" |
| **Observed** | a TIFF, a GIF and an SVG renamed `tif-renamed.jpg`, `fake-png-really-gif.png` and `evil-svg-as.jpg` were **all accepted, `201`, stored and persisted as portfolio rows**. The same bytes with honest extensions are correctly refused client-side. **The check is on the declared type only — the bytes are never compared to it**, so any format `sharp` can decode passes |

**Cause.** Mitigations confirmed present: output is re-encoded to WebP so an SVG `<script>` does not survive, and an SVG with `<image xlink:href="http://127.0.0.1:8899/ssrf-probe"/>` produced **no** outbound request — no SSRF. The gap is the allow-list itself, which the code's own comment claims is enforced and is not

**Acceptance:**

- [ ] The **decoded** format is compared against `ACCEPTED_IMAGE_MIME_TYPES`, not the declared one — `sharp().metadata().format` must be `jpeg` or `png`
- [ ] A renamed TIFF, GIF, SVG, BMP or AVIF is refused with the same message as an honest one
- [ ] `sharp` is configured to refuse SVG input outright
- [ ] The comment in `images.ts` describes what the code actually does

**Tests (required):**

- [ ] A test per disguised format asserting rejection — TIFF, GIF, SVG, BMP, AVIF, each renamed `.jpg` and `.png`. This is the exact class the current code claims to cover and does not.
- [ ] A test asserting `sharp` refuses SVG input.
- [ ] Keep the existing SSRF probe as a regression test.

---

### #173: Uploads — No Cancel control exists during an upload

**Milestone:** M3 | **Priority:** P1 High | **Status:** Backlog | **Capabilities:** `core` `storage`
**Blocked by:** None

Uploads adversarial pass, 2026-08-28. **Where:** `/vendor/portfolio`, vendor.

| | |
| --- | --- |
| **Expected** | frame `24 Image upload` draws **`Cancel`** directly under the aggregate progress line |
| **Observed** | zero matches for a cancel button or link anywhere on the page while `Uploading 2 of 6 — 0.7 MB of 2 MB` was on screen. Once a batch starts, the only way to stop it is to leave the page |

**Acceptance:**

- [ ] A `Cancel` control sits under the aggregate line while any upload is in flight, per frame 24
- [ ] Cancelling stops queued files and leaves already-completed ones saved — partial success is preserved
- [ ] The control disappears when the batch finishes

**Tests (required):**

- [ ] A browser test starting a batch, cancelling mid-flight, and asserting queued files stopped while completed files persisted across a reload.

---

### #174: Uploads — Size refusal contradicts itself at the byte boundary

**Milestone:** M3 | **Priority:** P2 Medium | **Status:** Backlog | **Capabilities:** `core` `storage`
**Blocked by:** None

Uploads adversarial pass, 2026-08-28. **Where:** `/vendor/portfolio` and `/vendor/profile/edit`, vendor.

| | |
| --- | --- |
| **Expected** | a refusal naming a size clearly over the limit |
| **Observed** | a JPG of exactly **12,587,008 bytes** (`MAX_UPLOAD_BYTES` + 4 KB) is refused with **`12 MB is over the 12 MB limit.`** — `formatMegabytes` rounds 12.0039 to one decimal. The vendor is told 12 MB is over a 12 MB limit and given no actionable number. The rule itself is correct: exactly 12,582,912 bytes is accepted, +4 KB refused |

**Cause.** `apps/web/src/lib/uploads.ts` (`tooLargeFailure` / `formatMegabytes`)

**Acceptance:**

- [ ] A refusal never states a size equal to the limit — round up, add a decimal, or state the excess
- [ ] The message gives the vendor a number they can act on

**Tests (required):**

- [ ] A unit test on the formatter at `MAX_UPLOAD_BYTES + 1`, `+ 4KB` and `+ 1MB` asserting the rendered sentence is never self-contradictory.

---

### #175: Uploads — Below-minimum width is red on one uploader and gold on the other

**Milestone:** M3 | **Priority:** P2 Medium | **Status:** Backlog | **Capabilities:** `core` `storage`
**Blocked by:** None

Uploads adversarial pass, 2026-08-28. **Where:** `/vendor/profile/edit` vs `/vendor/portfolio`, vendor.

| | |
| --- | --- |
| **Expected** | gold. `40-states.md`: "Below minimum dimensions | gold | **Replace file** — explains it would look soft, not that it's 'invalid'" |
| **Observed** | **red** on the profile photo. Measured: `class="text-xs text-error-500"`, computed `color = rgb(178, 58, 48)` — identical to the unsupported-format message. `/vendor/portfolio` gets it right: the same 680x450 file is gold there |

**Cause.** The profile uploader skips the client-side width screen, so the failure returns as the server's generic 400 and is classified as a red rejection

**Acceptance:**

- [ ] A below-minimum-width file is gold with a Replace action on **every** uploader
- [ ] Red is reserved for failures, per `40-states.md`'s colour semantics
- [ ] Both uploaders classify failures through the same path

**Tests (required):**

- [ ] A component test per uploader asserting the resolved colour token for each of the four failure modes in frame 25.

---

### #176: Uploads — The aggregate progress line counts bytes that are never sent

**Milestone:** M3 | **Priority:** P2 Medium | **Status:** Backlog | **Capabilities:** `core` `storage`
**Blocked by:** None

Uploads adversarial pass, 2026-08-28. **Where:** `/vendor/portfolio`, vendor.

| | |
| --- | --- |
| **Expected** | `Uploading 4 of 8 — 18.2 MB of 29.4 MB` describes the batch actually going up (frame 24) |
| **Observed** | selecting 3 valid ~0.34 MB JPGs plus one 66.8 MB JPG refused client-side produced **`Uploading 4 of 4 — 1 MB of 67.8 MB`**. The denominator includes the file refused before a byte left the browser, so the readout tops out near 1.5% and then vanishes |

**Acceptance:**

- [ ] The denominator counts only files actually being uploaded
- [ ] Client-side refusals are excluded from both numerator and denominator
- [ ] The percentage reaches 100% on success

**Tests (required):**

- [ ] A test with a mixed batch asserting the aggregate denominator equals the summed size of the accepted files only.

---

### #177: Uploads — The failure banner claims "Everything else saved" while the batch is still queued

**Milestone:** M3 | **Priority:** P2 Medium | **Status:** Backlog | **Capabilities:** `core` `storage`
**Blocked by:** None

Uploads adversarial pass, 2026-08-28. **Where:** `/vendor/portfolio`, vendor.

| | |
| --- | --- |
| **Expected** | the banner describes the state at the moment it is read |
| **Observed** | with 10 files where 2 fail client-side, the banner read **`2 photos didn't upload. Everything else saved.`** at ~800 ms — at that instant one file was uploading and **seven were still `Queued`**. Nothing had been saved |

**Acceptance:**

- [ ] The banner distinguishes in-flight from saved, and only claims saved once files are persisted
- [ ] The count updates as the batch progresses

**Tests (required):**

- [ ] A test asserting the banner text at a mid-batch checkpoint does not claim completion while any tile is `Queued` or `Uploading`.

---

### #178: Uploads — Deleting or replacing an image leaves its storage objects orphaned forever

**Milestone:** M3 | **Priority:** P2 Medium | **Status:** Backlog | **Capabilities:** `core` `storage`
**Blocked by:** None

Uploads adversarial pass, 2026-08-28. **Where:** storage lifecycle, vendor.

| | |
| --- | --- |
| **Expected** | the stored objects go with the row |
| **Observed** | 55 photos uploaded then deleted through the API (`204` on all 55, gallery back to seeded rows) left **114 keys** under `portfolio/` — each row leaks an image plus a `-thumb`. Nothing reaps them. Replacing a profile photo does the same: 5 successive picks accumulated 5 distinct `vendor-profile/<uuid>.webp` keys with only the last referenced |

**Cause.** Confirmed live: the bucket currently holds exactly 2 orphans from the sweep's final verification upload

**Acceptance:**

- [ ] Deleting a portfolio row deletes its image and its thumbnail
- [ ] Replacing a profile or cover image deletes the object it replaced
- [ ] Deletion failure is logged and retried, never silently dropped
- [ ] A reaper or a migration clears existing orphans

**Tests (required):**

- [ ] An integration test asserting the object count returns to baseline after create-then-delete.
- [ ] A test asserting replacement removes the prior key.

---

### #179: Uploads — Upload route validates before authenticating, leaking the prefix enum

**Milestone:** M3 | **Priority:** P2 Medium | **Status:** Backlog | **Capabilities:** `core` `storage`
**Blocked by:** None

Uploads adversarial pass, 2026-08-28. **Where:** `POST /upload/image`, unauthenticated.

| | |
| --- | --- |
| **Expected** | `401` for any unauthenticated request |
| **Observed** | `curl -X POST "http://localhost:4000/upload/image?prefix=../../etc"` with **no credentials** returns **`400`** with the full enum `"expected one of \"vendor-profile\"|\"vendor-cover\"|\"portfolio\"|\"customer-profile\""`. A *valid* prefix with no credentials correctly returns 401 — so the ordering leaks internal structure to anonymous callers |

**Acceptance:**

- [ ] Authentication runs before schema validation on every route, so an anonymous caller cannot distinguish a valid parameter from an invalid one
- [ ] No validation error enumerates internal values to an unauthenticated caller

**Tests (required):**

- [ ] An API test asserting an unauthenticated request with an invalid parameter returns 401, not 400.
- [ ] A sweep test across every authenticated route asserting the same ordering.

---

### #180: Uploads — The uploads bucket permits anonymous ListObjects

**Milestone:** M3 | **Priority:** P2 Medium | **Status:** Backlog | **Capabilities:** `core` `storage`
**Blocked by:** None

Uploads adversarial pass, 2026-08-28. **Where:** MinIO locally; verify the production R2 policy.

| | |
| --- | --- |
| **Expected** | read access to individual objects without the ability to enumerate them |
| **Observed** | `GET http://localhost:9000/vendor-marketplace-uploads?list-type=2` returns **every object key unauthenticated**. Anonymous `PUT` and `DELETE` are correctly `403`. This comes from `mc anonymous set download` in `docker-compose.yml` |

**Cause.** Local MinIO is not production, but the same policy shape is easy to carry over. Object keys are UUIDs so enumeration leaks no filenames — it does leak volume, timing and the full inventory

**Acceptance:**

- [ ] The production R2 policy grants public **read** without **list**
- [ ] The local MinIO policy matches production's shape so the difference is never discovered in production
- [ ] The policy is asserted, not assumed

**Tests (required):**

- [ ] A preflight check asserting the configured bucket policy denies anonymous list.
- [ ] An integration test asserting an anonymous list request is refused against the configured storage.

---

### #181: Uploads — Batch-overflow banner has a grammar error

**Milestone:** M3 | **Priority:** P3 Low | **Status:** Backlog | **Capabilities:** `core` `storage`
**Blocked by:** None

Uploads adversarial pass, 2026-08-28. **Where:** `/vendor/portfolio`, vendor.

| | |
| --- | --- |
| **Expected** | agreeing subject and verb |
| **Observed** | selecting 21 files gives `20 files upload at a time, so 1 file were held back: b21.jpg. Add them next.` — noun singular, verb plural. The cap behaviour itself is correct (20 accepted, 1 named and held back) |

**Acceptance:**

- [ ] The sentence agrees for 1 and for n held-back files

**Tests (required):**

- [ ] A test rendering the banner with 1 and with 3 held-back files and asserting both read correctly.

---

### #182: Uploads — Failure sentence starts lowercase for an extensionless file

**Milestone:** M3 | **Priority:** P3 Low | **Status:** Backlog | **Capabilities:** `core` `storage`
**Blocked by:** None

Uploads adversarial pass, 2026-08-28. **Where:** `/vendor/portfolio`, vendor.

| | |
| --- | --- |
| **Expected** | a sentence beginning with a capital |
| **Observed** | a valid JPG renamed `noextension` gives `file isn't a format we can publish.` |

**Acceptance:**

- [ ] Every failure sentence begins with a capital, including the extensionless branch

**Tests (required):**

- [ ] A test asserting every string returned by the failure-sentence helper starts uppercase.

---

### #183: Uploads — Header photo count goes stale after an upload but corrects after a delete

**Milestone:** M3 | **Priority:** P3 Low | **Status:** Backlog | **Capabilities:** `core` `storage`
**Blocked by:** None

Uploads adversarial pass, 2026-08-28. **Where:** `/vendor/portfolio`, vendor.

| | |
| --- | --- |
| **Expected** | the count tracks the gallery |
| **Observed** | 49 tiles / header `49 photos` → upload one → **50 tiles, header still `49 photos`**. Removing a photo calls `router.refresh()` and the count corrects; uploading does not |

**Acceptance:**

- [ ] The count refreshes on upload as it does on delete

**Tests (required):**

- [ ] A test asserting the header count equals the tile count after both an upload and a delete.

---

### #184: Uploads — A hard refresh mid-upload silently drops the in-flight file

**Milestone:** M3 | **Priority:** P3 Low | **Status:** Backlog | **Capabilities:** `core` `storage`
**Blocked by:** None

Uploads adversarial pass, 2026-08-28. **Where:** `/vendor/portfolio`, vendor.

| | |
| --- | --- |
| **Expected** | either the file survives, or the vendor is warned |
| **Observed** | a 3-file batch refreshed at ~1.2 s saved 2 and lost 1, with **no warning and no `beforeunload` prompt**. Soft navigation is fine — frame 24's "you can leave this page" promise holds for in-app navigation, verified |

**Acceptance:**

- [ ] A hard refresh during an upload warns via `beforeunload`, or the upload resumes

**Tests (required):**

- [ ] A test asserting `beforeunload` is registered while any upload is in flight and removed when the batch drains.

---

### #185: Uploads — Sizes are reported in MB where the OS reports MiB

**Milestone:** M3 | **Priority:** P3 Low | **Status:** Backlog | **Capabilities:** `core` `storage`
**Blocked by:** None

Uploads adversarial pass, 2026-08-28. **Where:** all uploaders.

| | |
| --- | --- |
| **Expected** | a number matching what the vendor sees in their file manager |
| **Observed** | a 70,062,643-byte file is reported as `66.8 MB`; Finder calls it 70.1 MB. Internally consistent but off by 4.8% against the number the vendor is looking at |

**Acceptance:**

- [ ] Displayed sizes use the same convention as the platform, or the unit is labelled unambiguously

**Tests (required):**

- [ ] A unit test pinning the chosen convention so it cannot drift.

---

### #186: Landing hero cluster — one scale ladder, and removed means removed at 390

**Milestone:** M3 | **Priority:** P1 High | **Status:** Backlog | **Capabilities:** `core`
**Blocked by:** None

Design update 2026-08-28 (third merge of the day): `30-responsive.md` gained a
**Landing hero imagery** section, `10-landing.md:136` moved its acceptance criterion, and the
**two-photo row was deleted from the `14 Landing mobile` frame**. Verified against the
bundle: `01 Landing` carries **3** `.ph` blocks, `14 Landing mobile` now carries **0**.

**The rule is binary:** the cluster sits *beside* the headline, or it does not ship. It never
falls underneath. That gives exactly one threshold, at 390 — the hero keeps its two-column
split from 1728 all the way down to 768, and the cluster **scales uniformly rather than
shedding a card**.

| Width | Hero | Cluster scale | Cluster box |
| --- | --- | --- | --- |
| 1440 | 56/44 | 1.0 | 444 x 392 |
| 1024 | 56/44 | **0.73** | 324 x 286 |
| 768 | 56/44 | **0.65** | 289 x 255 |
| **390** | 1 col | **removed** | — |

> "Removed means removed — not reduced to a stacked pair. Two photographs under the search
> card are the same failure as three: a screen of photography between the search the visitor
> came for and the categories that let them start."

At 390 the frame reads **headline → sub-line → search card → categories**, putting the first
category card's bottom edge at **612px** inside the 844 viewport.

**Note on 768:** `30-responsive.md` says it plainly — *"768 is specified here but not yet
drawn."* Section 14 has no landing frame at 768, so those numbers are **the spec, not a
measured frame**. A parity check at 768 asserts against the table above, not against a frame.

This refines #169's B4 line ("all three cards at 0.73 scale" at 1024) rather than replacing
it — 1024 is unchanged; 768 and 390 are new.

**Acceptance:**

- [ ] Hero is two columns at **≥768** (the criterion moved from ≥1024)
- [ ] The cluster keeps all three cards at every width that has a second column, scaling uniformly — never shedding a card
- [ ] Cluster box measures 444x392 at 1440, 324x286 at 1024, 289x255 at 768
- [ ] At 390 there is **no hero photography above or below the search card** — not a reduced pair, not one photo
- [ ] At 390 the order is headline → sub-line → search card → categories, with the first category card's bottom edge at 612px in an 844 viewport
- [ ] The cluster never renders underneath the headline at any width

**Tests (required):**

- [ ] A responsive assertion at 1440, 1024, 768 and 390 measuring the cluster's bounding box against the table. Derive 1440/1024/390 from the frames; assert 768 against the table, since no frame exists at that width.
- [ ] A test at 390 asserting **zero** hero image elements between the headline and the category row — count them, do not check the first one is absent, because the failure this replaces was a *reduced* pair rather than none.
- [ ] A test asserting the cluster's left edge is always to the right of the headline block at every width that has one.

---

### #187: Bookings hub — `All categories` and `Soonest first` are dead controls

**Milestone:** M3 | **Priority:** P1 High | **Status:** Backlog | **Capabilities:** `core`
**Blocked by:** None

Parity batch 3, 2026-08-28 — **Functional** finding. **Where:** `/bookings`, customer.

| | |
| --- | --- |
| **Expected** | working filter and sort controls, per `42-dropdowns.md` |
| **Observed** | both are bare `<span>` elements with `cursor: auto`, **no `<button>`/`<a>`/`<select>` ancestor and no `role`**. The page contains **zero `<select>` elements**. They are unreachable by keyboard, invisible to assistive tech, and clicking does nothing |

**Cause / context.** They render as chips and read as controls, so a user will click them and conclude the page is broken. `42-dropdowns.md` (added 2026-08-28) exists for exactly these.

**Acceptance:**

- [ ] Both are real controls built on the shared dropdown component (#167)
- [ ] Both are keyboard reachable and expose a role and an accessible name
- [ ] Filtering by category and changing sort both change the result set and the URL

**Tests (required):**

- [ ] A test asserting each control is focusable, has a role, and changes the URL on selection.
- [ ] A test asserting the rendered list changes when a category filter is applied.

---

### #188: Bookings hub — the notifications bell opens nothing

**Milestone:** M3 | **Priority:** P1 High | **Status:** Backlog | **Capabilities:** `core`
**Blocked by:** None

Parity batch 3, 2026-08-28 — **Functional** finding. **Where:** `/bookings`, customer.

| | |
| --- | --- |
| **Expected** | clicking the bell opens the notifications panel |
| **Observed** | `button[aria-label="Notifications, 1 unread"]` (36x36) produces **no `[role=dialog]`, no `[role=menu]`, no popper wrapper and no `[data-state=open]`**. Nothing opens at all |

**Cause / context.** On other routes the panel opens but ignores Escape (#73). On this route there is no panel, so this is either a regression or a route-specific wiring gap — the badge still advertises `1 unread`, so the user is told they have a notification they cannot read.

**Acceptance:**

- [ ] The bell opens the panel on every route that renders it
- [ ] The unread badge is only shown where the panel can actually be opened
- [ ] Escape closes it and returns focus (shared with #73)

**Tests (required):**

- [ ] A test per route rendering the bell asserting a click opens a panel containing the notification text.
- [ ] A test asserting the badge count matches the number of items the panel renders.

---

### #189: Bookings hub renders the EMPTY-state rail on a hub with 11 bookings

**Milestone:** M3 | **Priority:** P1 High | **Status:** Backlog | **Capabilities:** `core`
**Blocked by:** None

Parity batch 3, 2026-08-28 — **Functional** finding. **Where:** `/bookings`, customer.

| | |
| --- | --- |
| **Expected** | frame `07`'s `Needs you` rail: a `#F7E7E0` action card (clay dot, **`Review quote`** / **`Decline`**), a `#F5EEDC` gold card, then a `Recent messages` list of three avatar rows |
| **Observed** | the four mechanism paragraphs under `HOW BOOKING WORKS HERE` — **the empty-state rail from frame `19 Bookings hub empty`** — rendered on a hub carrying 11 bookings |

**Cause / context.** This is not only a parity failure. `Review quote` and `Decline` are the customer's only route to act on a quote, and they are absent — so this is part of why the transaction cannot complete (#68). The `Recent messages` list is missing too.

**Acceptance:**

- [ ] The populated hub renders frame `07`'s rail; the empty rail renders only when there are no bookings
- [ ] `Review quote` and `Decline` are present and functional on a quoted booking
- [ ] `Recent messages` renders the three most recent threads

**Tests (required):**

- [ ] A test rendering the hub with 0 bookings and with n>0 asserting a different rail in each case.
- [ ] A test asserting a quoted booking exposes both `Review quote` and `Decline`.

---

### #190: Bookings hub — the count sentence contradicts the tab it sits above

**Milestone:** M3 | **Priority:** P2 Medium | **Status:** Backlog | **Capabilities:** `core`
**Blocked by:** None

Parity batch 3, 2026-08-28 — **Functional** finding. **Where:** `/bookings?tab=history`, customer.

| | |
| --- | --- |
| **Expected** | a sentence describing the view being shown |
| **Observed** | on `?tab=history` the line still reads **`10 upcoming bookings. Next up is June Harlow in 78 days.`** above a single withdrawn October booking |

**Acceptance:**

- [ ] The count sentence is derived from the active tab's result set
- [ ] Each tab has approved copy for its empty and populated states

**Tests (required):**

- [ ] A test per tab asserting the sentence's numbers equal the rendered row count.

---

### #191: Booking cards have no focus ring and link to the vendor profile, not the booking

**Milestone:** M3 | **Priority:** P1 High | **Status:** Backlog | **Capabilities:** `core`
**Blocked by:** None

Parity batch 3, 2026-08-28 — **Functional** finding. **Where:** `/bookings`, customer.

| | |
| --- | --- |
| **Expected** | a visible focus ring, and a link to the booking |
| **Observed** | the whole card is an `<a>` (261x175) whose focused `box-shadow` is **entirely transparent** — no ring at all, and its ancestor is `overflow-y: auto` so even a correct outward ring would clip. Every card links to `/vendors/<slug>` |

**Cause / context.** The destination half is #68; the missing ring is a distinct a11y defect on the hub's primary interaction.

**Acceptance:**

- [ ] Cards show the law's focus ring, unclipped by the scrolling ancestor
- [ ] Cards link to the booking detail (#68)

**Tests (required):**

- [ ] A browser assertion that the focused card's ring is visible and within its clipping ancestor's rect.

---

### #192: Booking request — a marketing footer is appended below the app shell

**Milestone:** M3 | **Priority:** P2 Medium | **Status:** Backlog | **Capabilities:** `core`
**Blocked by:** None

Parity batch 3, 2026-08-28 — **Functional** finding. **Where:** `/vendors/[slug]/request`, customer.

| | |
| --- | --- |
| **Expected** | the frame is `overflow:hidden` with nothing after the grid; the app shell does not scroll |
| **Observed** | a 4-column dark footer (`Browse` / `Company` / `Account`) is appended, pushing `document.documentElement.scrollHeight` to **938** against a 900 viewport |

**Cause / context.** An app-shell screen inheriting the marketing footer. `04-laws.md`'s app-shell budget is 1.0x.

**Acceptance:**

- [ ] Signed-in app-shell routes do not render the marketing footer
- [ ] `scrollHeight` equals `innerHeight` at 1440x900 on this route

**Tests (required):**

- [ ] A test asserting the app-shell routes render no marketing footer and do not exceed a 1.0x scroll budget.

---

### #193: Booking request — a form field was moved into the context rail

**Milestone:** M3 | **Priority:** P2 Medium | **Status:** Backlog | **Capabilities:** `core`
**Blocked by:** None

Parity batch 3, 2026-08-28 — **Functional** finding. **Where:** `/vendors/[slug]/request`, customer.

| | |
| --- | --- |
| **Expected** | the rail holds five stacked sections including the package block; the form lives in the main pane |
| **Observed** | a `Describe what you need` label + 364x96 textarea (`#…-customDetails`) occupies the package block's slot **in the rail** |

**Cause / context.** `04-laws.md` law 4 says the rail holds what is *referenced while working in the main pane*; law 5 says forms are grids. An input in the rail is neither.

**Acceptance:**

- [ ] The field returns to the form grid in the main pane
- [ ] The rail renders the package block: name, price, and the detail line

**Tests (required):**

- [ ] A test asserting no form control renders inside the rail region.

---

### #194: Sign up — the primary action reads `Continue`, not `Create my account`

**Milestone:** M3 | **Priority:** P2 Medium | **Status:** Backlog | **Capabilities:** `core`
**Blocked by:** None

Parity batch 3, 2026-08-28 — **Functional** finding. **Where:** `/sign-up`, signed out.

| | |
| --- | --- |
| **Expected** | the frame's literal **`Create my account`** |
| **Observed** | Clerk's default **`Continue`** with a trailing chevron glyph. This is the primary action on the screen |

**Acceptance:**

- [ ] The submit button renders the frame's literal
- [ ] The Clerk appearance override covers the submit label

**Tests (required):**

- [ ] A test asserting the submit button's accessible name equals the frame's string.

---

### #195: Sign up — the two primary inputs have no focus ring

**Milestone:** M3 | **Priority:** P1 High | **Status:** Backlog | **Capabilities:** `core`
**Blocked by:** None

Parity batch 3, 2026-08-28 — **Accessibility** finding. **Where:** `/sign-up`, signed out.

| | |
| --- | --- |
| **Expected** | `ring-2 ring-clay-400/30 ring-offset-2 ring-offset-stone-50` |
| **Observed** | focused `#emailAddress-field` / `#password-field` compute `box-shadow: oklab(…/0.11) 0 0 0 1px, oklab(…/0.07) 0 0 1px 0` and `outline: rgba(0,0,0,0) solid 2px` — Clerk's own style, **no clay ring, no offset**. The submit button gets a 1px opaque clay-400 hairline rather than a 2px 30%-alpha ring. Role cards resolve their offset to **white** instead of `stone-50 #F8F5EF` |

**Cause / context.** Clerk's default appearance is not themed to the design system on this screen. The skip link and `Sign in` on the same page do compute the correct offset, so this is inconsistent rather than global.

**Acceptance:**

- [ ] Clerk's appearance config themes inputs, submit and cards to the law's ring
- [ ] Ring offset resolves to `stone-50`, never white
- [ ] Every focusable element on the screen shows the same ring

**Tests (required):**

- [ ] A test tabbing every focusable element on `/sign-up` and asserting the computed ring equals the law's value.

---

### #196: Sign up — the `Sign in` link reintroduces a banned colour pair

**Milestone:** M3 | **Priority:** P1 High | **Status:** Backlog | **Capabilities:** `core`
**Blocked by:** None

Parity batch 3, 2026-08-28 — **Accessibility** finding. **Where:** `/sign-up`, signed out.

| | |
| --- | --- |
| **Expected** | `#A34A28` (clay-500), weight 600 |
| **Observed** | **`rgb(180,85,47)` = `#B4552F` (clay-400)**, weight 500 — measured **4.51:1** on `stone-50` |

**Cause / context.** `01-foundations.md` lists clay-400-as-text-on-cream in its *"failures we already fixed, do not regress"* table. It clears 4.5:1 by 0.01, so it is a regression that a threshold test would only just catch.

**Acceptance:**

- [ ] The link uses `clay-500 #A34A28` at weight 600
- [ ] No banned pair from the contrast table appears anywhere on the screen

**Tests (required):**

- [ ] Extend the contrast test to fail on the five banned pairs **by value**, not only on the 4.5:1 threshold — this one passes the threshold and is still forbidden.

---

### #197: Sign up — panel text over photography is not contrast-guaranteed

**Milestone:** M3 | **Priority:** P1 High | **Status:** Backlog | **Capabilities:** `core`
**Blocked by:** None

Parity batch 3, 2026-08-28 — **Accessibility** finding. **Where:** `/sign-up`, signed out.

| | |
| --- | --- |
| **Expected** | text over an image guarantees 4.5:1 regardless of what the image contains |
| **Observed** | the overlap band is the **full 600x900 panel**, with text occupying a **348px** band (y=504–852). Against a worst-case bright pixel: body line `stone-0/82` **4.24 FAIL**, `BOOKING` `#F3C98B` **4.41 FAIL**, `VENDING` `#A8C08E` **3.68 FAIL**, `BOTH` `stone-0/55` **3.59 FAIL** |

**Cause / context.** The current seed photo is dark in that band so it reads fine today — but the vendor supplies this image and nothing constrains its luminance. **`VENDING` is a live-only regression**: the frame's `#C4D6A8` scores **4.70** at the same point; the substituted `sage-200 #A8C08E` scores **3.68**.

**Acceptance:**

- [ ] The scrim guarantees 4.5:1 for every text node at its darkest legal stop, or the text sits on a solid plate
- [ ] `VENDING` uses a value that clears 4.5:1 over the scrim
- [ ] A bright image cannot drop any node below 4.5:1

**Tests (required):**

- [ ] A contrast test modelling each panel text node against the scrim over a **white** backdrop — the worst case — not against the seed photo.

---

### #198: The app systematically renders five type steps off the frames' scale

**Milestone:** M3 | **Priority:** P1 High | **Status:** Backlog | **Capabilities:** `core`
**Blocked by:** None

Parity batch 3, 2026-08-28 — **Parity** finding. **Where:** every screen.

| | |
| --- | --- |
| **Expected** | the frames' values: `.lbl` 10.5px / `.05em`, `.inp` 13.5px, helper 11.5px, card meta 12px, sub-heading 14px |
| **Observed** | the app applies `01-foundations.md`'s `text-xs` / `text-sm` / `text-md` where the frames use off-scale intermediates: `.lbl` renders **11px / 0.55px**, `.inp` **12.5px**, helper **11px**, card meta **11px**, sub-heading **15px** |

**Cause / context.** Raised by parity batch 3 as a consolidation: this single mapping decision accounts for roughly thirty individual findings across `12`, `04` and `07`, and will account for more on every unswept frame. It is **one decision about five mappings**, not thirty edits. Related to but distinct from #74 (line-height) and #165 (the heading rule).

**Acceptance:**

- [ ] The five mappings are decided once and recorded in `01-foundations.md`
- [ ] Either the scale gains the frames' intermediate steps, or the components stop using the token where the frame uses an intermediate
- [ ] Every screen already swept is re-measured on the font axis afterwards

**Tests (required):**

- [ ] A parity assertion comparing computed `font-size` and `letter-spacing` for `.lbl`, `.inp`, helper, card meta and sub-heading against the frame, on at least three screens.

---

### #199: Two frame colours are absent from the foundations and were substituted, one at an accessibility cost

**Milestone:** M3 | **Priority:** P2 Medium | **Status:** Blocked — needs a human | **Capabilities:** `core`
**Blocked by:** A design ruling — adopt `#C4D6A8` and `#5C4A18` as foundation tokens, or correct the frames to sanctioned ones. Every acceptance criterion here edits `design/`, which only a design pass may do.

Parity batch 3, 2026-08-28 — **Parity** finding. **Where:** `12 Sign up`, `04 Booking request`.

| | |
| --- | --- |
| **Expected** | `#C4D6A8` on the sign-up panel's `VENDING` label and `#5C4A18` on the booking-request gold reassurance line |
| **Observed** | the app substituted the nearest token: `sage-200 #A8C08E` and `gold-600 #7A5A12`. The gold substitution is harmless (both clear AA; live is 5.50:1 and is the sanctioned token). **The sage substitution drops `VENDING` from 4.70:1 to 3.68:1** over a bright photo |

**Cause / context.** `04-laws.md` precedence says the frame wins and the plan gets corrected — so these belong in the plan, not silently in the components. Also noted: the frame's own disabled-submit colour `#9A9184` is **on the banned list** in `01-foundations.md`, so that one must be corrected in the frame rather than adopted.

**Acceptance:**

- [ ] `#C4D6A8` and `#5C4A18` are either added to `01-foundations.md` or the frames are corrected to sanctioned tokens
- [ ] `VENDING` clears 4.5:1 over the scrim either way
- [ ] The frame's `#9A9184` disabled colour is corrected in the frame, not adopted into the app

**Tests (required):**

- [ ] A test asserting every colour used in a component resolves to a token defined in the foundations.

---

### #210: The vendor has no surface anywhere that shows a confirmed booking

**Milestone:** M3 | **Priority:** P0 Critical | **Status:** Backlog | **Capabilities:** `core`
**Blocked by:** None

Two-sided functional pass, 2026-08-28 — the first pass to drive **customer -> vendor ->
customer** across account switches. **Where:** `/vendor/dashboard`, vendor.

| | |
| --- | --- |
| **Expected** | an accepted booking appears somewhere the vendor can find it |
| **Observed** | the card **vanishes** from `Requests waiting on you` and appears nowhere else. The dashboard has exactly two sections — the pending queue and `FRIDAY, AUGUST 28 · Nothing booked today`. `/bookings` as a vendor **302s to `/vendor/dashboard`**. `GET /bookings` with the vendor's own bearer token returns **`200 []`** *after* the accept. `GET /booking-requests` as vendor returns only still-pending rows — accepted and declined disappear from the vendor's list entirely |

**Context.** The customer sees the same booking correctly as `ACCEPTED · $1,200 · Zilker Park Clubhouse`. **The vendor has no way to answer "what am I booked for?"** The first real vendor to accept a booking will ask exactly that and there is no answer.

**Acceptance:**

- [ ] A vendor bookings surface exists and lists accepted bookings
- [ ] `GET /bookings` returns the vendor's accepted bookings when called with a vendor token
- [ ] Accepted and declined requests remain retrievable by the vendor, filtered by status rather than dropped
- [ ] Frame `08`'s sidebar `Bookings` entry (#79) points at it

**Tests (required):**

- [ ] An API test asserting `GET /bookings` as the vendor returns the booking immediately after accept.
- [ ] A two-sided browser test: customer requests, vendor accepts, vendor sees it listed.

---

### #211: The vendor never learns who the customer is, before or after accepting

**Milestone:** M3 | **Priority:** P0 Critical | **Status:** Backlog | **Capabilities:** `core`
**Blocked by:** None

Two-sided functional pass, 2026-08-28 — the first pass to drive **customer -> vendor ->
customer** across account switches. **Where:** `/vendor/dashboard` and `/messages`, vendor.

| | |
| --- | --- |
| **Expected** | the vendor can contact the customer they just committed to |
| **Observed** | every request card reads **`AC / A customer`**. After accepting a wedding, the message thread header still reads `A customer`, and `GET /conversations` returns `"otherPartyName":"A customer"`. **There is no name, email or phone anywhere** |

**Context.** A vendor who accepts a wedding has a date, a venue string and a guest count, and no idea who to contact. This makes the accepted booking unusable even once #210 gives them a place to see it.

**Acceptance:**

- [ ] The customer's name is shown on the request card and in the thread once a request exists
- [ ] Contact details are exposed at the point the booking is accepted, per whatever privacy rule the product wants — but the rule is explicit, not an accident
- [ ] `otherPartyName` resolves to a real name

**Tests (required):**

- [ ] An API test asserting `otherPartyName` is the customer's name, not a placeholder.
- [ ] A test asserting the accepted-booking view exposes a contact route.

---

### #212: Accepting a booking labels the date `Pending request` on the vendor's own calendar, and the Booked counter stays at 0

**Milestone:** M3 | **Priority:** P1 High | **Status:** Backlog | **Capabilities:** `core`
**Blocked by:** None

Two-sided functional pass, 2026-08-28 — the first pass to drive **customer -> vendor ->
customer** across account switches. **Where:** `/vendor/availability`, vendor.

| | |
| --- | --- |
| **Expected** | `2027-02-13 — Booked — locked` (the string is in the page's own legend), and `Booked 1 date` |
| **Observed** | `aria-label="2027-02-13 — Pending request"`. The cell is correctly `disabled`, so the lock works — but the summary reads **`11 of your Saturdays … alongside 0 booked and 0 blocked dates`**. The open count dropped by one while the booked count stayed at zero, so **the sentence contradicts itself**. The same mislabel appears on the pre-existing Dec 19 booking, which the customer sees as `ACCEPTED` and holds a notification for. Conversely the three genuinely *pending* requests showed as `— Available` |

**Context.** The label is one state out of step **in both directions** — accepted reads as pending, pending reads as available.

**Acceptance:**

- [ ] An accepted date reads `Booked — locked` and counts in `Booked`
- [ ] A pending request reads `Pending request`, not `Available`
- [ ] The summary sentence's numbers are derived from the same source as the cells
- [ ] This is verified together with #166, which restyles these states

**Tests (required):**

- [ ] A test per state asserting the cell's accessible name and the summary counters agree with the underlying row.
- [ ] A test asserting open + booked + blocked equals the total for the period.

---

### #213: Decline is one click, irreversible, with no confirmation and no undo

**Milestone:** M3 | **Priority:** P1 High | **Status:** Backlog | **Capabilities:** `core`
**Blocked by:** None

Two-sided functional pass, 2026-08-28 — the first pass to drive **customer -> vendor ->
customer** across account switches. **Where:** `/vendor/dashboard`, vendor.

| | |
| --- | --- |
| **Expected** | a destructive, customer-visible action is confirmed before it fires |
| **Observed** | clicking **Decline** fires `POST /booking-requests/<id>/decline → 200` immediately. No dialog, no undo. `POST …/accept` afterwards returns `409 INVALID_STATE_TRANSITION — "A declined request cannot become accepted"`, so **the vendor cannot recover from a misclick** — and the customer has already been notified (`Northgate Sound declined — The date is free again`) |

**Context.** The 409 guard is correct and should stay; the missing confirmation is the defect.

**Acceptance:**

- [ ] Decline requires a confirmation naming the customer and date
- [ ] Either an undo window exists, or the confirmation states plainly that it cannot be undone
- [ ] Accept and Decline are visually distinguished by weight, so the destructive one is not the easy misclick

**Tests (required):**

- [ ] A test asserting the decline POST does not fire until the confirmation is accepted.

---

### #214: A customer cannot cancel, or even review, a request they sent

**Milestone:** M3 | **Priority:** P1 High | **Status:** Backlog | **Capabilities:** `core`
**Blocked by:** None

Two-sided functional pass, 2026-08-28 — the first pass to drive **customer -> vendor ->
customer** across account switches. **Where:** `/bookings`, customer.

| | |
| --- | --- |
| **Expected** | a customer can open the request they sent and withdraw it |
| **Observed** | every booking card is a bare anchor to `/vendors/<slug>`. **There is no detail view, no cancel, and no "message about this booking".** The notes, time, guest count and venue the customer typed are unrecoverable. `POST /booking-requests/:id/cancel` **exists in the API and no UI reaches it** |

**Context.** This is why the junk row dated **31 Dec 9999** can never be removed by its owner, and it compounds #67 — duplicate requests cannot be withdrawn either. Overlaps #68's booking-detail route.

**Acceptance:**

- [ ] A booking detail view exists and shows everything the customer submitted
- [ ] A pending request can be cancelled from it, reaching the existing `/cancel` endpoint
- [ ] Cancelling notifies the vendor and frees the date

**Tests (required):**

- [ ] An API + browser test asserting a customer can cancel their own pending request and cannot cancel anyone else's.

---

### #215: The Clerk session JWT is sent in a URL query string

**Milestone:** M3 | **Priority:** P1 High | **Status:** Backlog | **Capabilities:** `core`
**Blocked by:** None

Two-sided functional pass, 2026-08-28 — the first pass to drive **customer -> vendor ->
customer** across account switches. **Where:** every authenticated page load, both roles.

| | |
| --- | --- |
| **Expected** | a bearer token travels in a header, never in a URL |
| **Observed** | every authenticated page load opens `GET http://localhost:4000/events/stream?token=<824-char JWT>`. Reproduced on both roles — one SSE request per page load, single param `token`, prefix `eyJhbGciOiJS` |

**Context.** Query strings land in access logs, proxy logs, browser history and `Referer` headers. EventSource cannot set headers, which is presumably why it was done — the fix is a short-lived single-use stream ticket exchanged for the session, not the session JWT itself.

**Confirmed reaching logfiles, 2026-08-29** (found while browser-verifying #66). This
is no longer only a "could leak via `Referer` or a proxy" risk: Fastify's request logger
writes the full URL, so the API's own log fills with

```
"req":{"method":"GET","url":"/events/stream?token=eyJhbGciOiJSUzI1NiIs…
```

**27 live session tokens** were counted in a single lane's dev log from one verification
session. Anything that captures API stdout — a terminal scrollback, a CI artifact, a log
shipper, an agent's job directory — is holding session credentials. The E2E accounts are
the affected subjects so far. The tokens observed were destroyed with their logfile, but
the mechanism reproduces on every authenticated page load until this ticket lands.

Redacting the query string in the logger is a **mitigation, not the fix** — the token is
still in the URL, so it still reaches proxies and browser history. It is worth doing
anyway, because it is minutes of work and it stops the bleeding until the ticket is done.

**Acceptance:**

- [ ] The SSE stream authenticates with a short-lived, single-use ticket scoped to that stream, or with a cookie — never the session JWT
- [ ] The ticket is not reusable and expires in minutes
- [ ] No credential appears in any URL the server or a proxy logs
- [ ] The API's request logger cannot write a credential even if one reaches a URL again

**Tests (required):**

- [ ] A test asserting no request URL in an authenticated session contains a JWT-shaped value.
- [ ] A test asserting a stream ticket cannot be replayed after use or after expiry.

---

### #216: Four different expiry promises for the same deadline, and the one shown at commitment is wrong

**Milestone:** M3 | **Priority:** P2 Medium | **Status:** Backlog | **Capabilities:** `core`
**Blocked by:** None

Two-sided functional pass, 2026-08-28 — the first pass to drive **customer -> vendor ->
customer** across account switches. **Where:** request flow, `/bookings`, notifications.

| | |
| --- | --- |
| **Expected** | one deadline, stated consistently |
| **Observed** | `/vendors/<slug>/request` review rail: **"48 hours to confirm or send a revised quote"** · success screen: **"closes on its own after a week"** · `/bookings` card: **"expires in 7d"** · vendor notification: **"You have a week to reply"**. The API is authoritative: `createdAt → expiresAt` is exactly **7 days**. **The 48-hour claim is the wrong one, and it is the one shown at the moment of commitment** |

**Acceptance:**

- [ ] Every surface derives the deadline from `expiresAt`, never from a literal
- [ ] The review rail states the real window
- [ ] `31-content-voice.md` carries one approved phrasing

**Tests (required):**

- [ ] A test asserting no user-facing string contains a hard-coded duration for this deadline.
- [ ] A test asserting the rendered deadline matches the row's `expiresAt`.

---

### #217: The two sides disagree about whether there is a platform fee

**Milestone:** M3 | **Priority:** P2 Medium | **Status:** Backlog | **Capabilities:** `core`
**Blocked by:** None

Two-sided functional pass, 2026-08-28 — the first pass to drive **customer -> vendor ->
customer** across account switches. **Where:** `/bookings` (customer) vs `/vendor/dashboard` (vendor).

| | |
| --- | --- |
| **Expected** | one consistent fee story |
| **Observed** | customer: **"No service fee. The price you're quoted is the price you pay."** Vendor: **"EARNINGS THIS MONTH · $0 · Your share, after the platform fee."** |

**Context.** Both may be literally true — a vendor-side commission with no customer-side markup — but as written they read as a contradiction, and the commission is 12% per the settled constraints. A beta user comparing notes with their vendor will notice.

**Acceptance:**

- [ ] One fee model is stated, and both surfaces describe it compatibly
- [ ] The vendor's share and the customer's total are both explained where each is shown

**Tests (required):**

- [ ] A test asserting the two strings are drawn from one shared source.

---

### #218: `Send quote` is dead on the default path, contradicting what the customer was promised

**Milestone:** M3 | **Priority:** P2 Medium | **Status:** Backlog | **Capabilities:** `core`
**Blocked by:** None

Two-sided functional pass, 2026-08-28 — the first pass to drive **customer -> vendor ->
customer** across account switches. **Where:** `/vendor/dashboard`, vendor.

| | |
| --- | --- |
| **Expected** | the vendor can send a revised quote, as the customer's review screen promises |
| **Observed** | the button renders `disabled` with `title="This request is already priced by its package"` — a **native tooltip is the only explanation**. The API agrees (`POST …/quote` → `400`), so it is consistent. But the vendor profile's only CTA is `Request booking` carrying `?package=<uuid>`, so **the default path every customer takes produces a request that can never be quoted** |

**Context.** The customer's review rail explicitly says the vendor may "send a revised quote". Either the promise or the restriction has to go.

**Acceptance:**

- [ ] Either a package-priced request can be re-quoted, or the customer is never promised it can
- [ ] The disabled reason is visible copy, not a native `title`
- [ ] The quote flow is drivable end to end and gets its own test

**Tests (required):**

- [ ] A browser test driving vendor quote -> customer approve on a request that supports it.
- [ ] A test asserting the customer-facing copy matches the actual capability.

---

### #219: A new request opens no message thread, and the profile's message button is permanently dead

**Milestone:** M3 | **Priority:** P2 Medium | **Status:** Backlog | **Capabilities:** `core`
**Blocked by:** None

Two-sided functional pass, 2026-08-28 — the first pass to drive **customer -> vendor ->
customer** across account switches. **Where:** `/vendors/<slug>` and `/messages`, customer.

| | |
| --- | --- |
| **Expected** | a customer who just sent a request can reach the vendor |
| **Observed** | `Send a message` on the profile is `disabled` under the caption **"Messaging opens shortly"**, while `/messages` is fully functional for pre-existing threads. After creating three requests, `/messages` still listed the same three threads and `GET /conversations` returned one row. **A customer who just sent a request has no way to reach the vendor on either surface** |

**Acceptance:**

- [ ] Creating a request opens (or links to) a thread for it
- [ ] The profile's message control is either enabled or replaced by copy that says what to do instead
- [ ] The thread is attributed to the booking it belongs to (see #193)

**Tests (required):**

- [ ] A test asserting a conversation exists and is reachable immediately after a request is created.

---

### #220: No booking can be created by anyone — accept is walled behind payout setup that does not exist

**Milestone:** M3 | **Priority:** P0 Critical | **Status:** Backlog | **Capabilities:** `core`
**Blocked by:** #9, #10

Vendor onboarding + quote-flow pass, 2026-08-29 — the first pass to drive vendor
onboarding from nothing and the quote path. **Where:** `/vendor/dashboard`, every vendor.

| | |
| --- | --- |
| **Expected** | accepting a request creates a booking |
| **Observed** | `POST /booking-requests/:id/accept` returns **`402 PAYMENT_REQUIRED — "Finish your payout setup before accepting bookings"`**. Independently verified: **all 17 vendor profiles are `is_published = true, stripe_onboarded = false`**, and there is **no Stripe onboarding entry point anywhere in the product** — no route, no link, no `accountLink`. The only occurrences of "payout" in the web tree are two source comments saying it is deliberately absent until #9 |

**Context.** The guard at `apps/api/src/modules/booking-requests/booking-requests.service.ts:558` is **correct** — a vendor must not accept money they cannot receive. The defect is that the UI publishes a storefront, tells the vendor they are `Ready to publish`, lets them receive requests, and only reveals the wall at the moment of accept, with an instruction pointing at a screen that does not exist. `40-states.md` requires every error to offer one primary action; this one names an action the product cannot perform.

**The 918 bookings in the database are seed data. Not one of them can be reproduced through the application.** Everything downstream — the date hold, payment capture, completion, reviews — is unreachable and therefore untested.

**Acceptance:**

- [ ] Either payout onboarding exists and is reachable from the dashboard and the publish checklist, or a vendor cannot publish without it
- [ ] The publish checklist counts payout setup as a blocker, so the wall is disclosed before a customer ever sends a request
- [ ] The 402 message links to the action it names
- [ ] No vendor-facing surface promises a capability gated behind an unbuilt screen

**Tests (required):**

- [ ] An API test asserting a vendor with `stripeOnboarded = true` can accept and a booking row is created — the accept path currently has no green test because it cannot succeed.
- [ ] A test asserting the publish checklist blocks on payout setup.
- [ ] A browser test driving request -> accept -> booking visible to both sides.

---

### #221: The customer cannot accept a quote — `Review quote` links to the vendor's marketing page

**Milestone:** M3 | **Priority:** P0 Critical | **Status:** Backlog | **Capabilities:** `core`
**Blocked by:** None

Vendor onboarding + quote-flow pass, 2026-08-29 — the first pass to drive vendor
onboarding from nothing and the quote path. **Where:** `/bookings`, customer.

| | |
| --- | --- |
| **Expected** | a quote review screen with Accept and Decline |
| **Observed** | the control is `<a href="/vendors/<slug>">` — the public storefront. On arrival, matching `/quote|accept|approve/i` against the page text returns **false**; the only CTAs there are `Request booking` and `Send a message`. Enumerating every `a`/`button` across `/bookings`, `/messages`, `/customer/profile` and `/dashboard` filtered for accept/approve/decline/counter/pay found **only** those two `Review quote` links, both pointing at the storefront |

**Context.** The customer's own notification contradicts the UI: `request_quoted :: "Open the request to see the price and accept it."` — it promises an action the product does not provide. This is #68's booking-detail gap surfacing on the quote path specifically.

**Acceptance:**

- [ ] A quote review surface exists, showing the quoted amount and what it covers
- [ ] The customer can accept a quote from it
- [ ] The notification's deep link lands on that surface, not the storefront

**Tests (required):**

- [ ] A browser test driving vendor quote -> customer accept.
- [ ] A test asserting the notification's link target renders the quote.

---

### #222: Vendor onboarding cannot be completed through the UI — a 400 is swallowed with no feedback at all

**Milestone:** M3 | **Priority:** P0 Critical | **Status:** In Progress | **Capabilities:** `core`
**Blocked by:** None

Vendor onboarding + quote-flow pass, 2026-08-29 — the first pass to drive vendor
onboarding from nothing and the quote path. **Where:** `/vendor/profile/edit`, vendor with no profile.

| | |
| --- | --- |
| **Expected** | the profile is created, or the vendor is told what is wrong |
| **Observed** | `POST /vendor/profile` returns **400 `"One or more selected categories are unavailable."`** and **nothing appears on screen** — no toast, no inline error, no `[role=alert]`, no `aria-invalid`, no focus move. The button reads as dead; the agent clicked it four times. Onboarding could only be completed by calling the API directly |

**Context.** **Two separable defects.** (1) The editor posted a stale category id while `GET /categories` returned a fresh one — `apps/web/src/lib/vendor-data.ts:197` caches categories with `revalidate: 3600`, so stale ids survive a hard reload for an hour after any reseed. That is environment-specific. (2) **Silently swallowing a 400 on the product's only onboarding form is not.** The booking-request form on the same site handles this correctly — counted summary, per-field messages, `aria-invalid` on exactly the wrong fields. That is the model this form should follow.

**Acceptance:**

- [ ] A failed profile save always renders an error naming the field and the fix
- [ ] Category ids are not served from a cache that can outlive a reference-data change, or a stale id is retried against fresh data
- [ ] A vendor can complete onboarding end to end in the browser with no API calls

**Tests (required):**

- [ ] A test asserting a 400 from `POST /vendor/profile` renders a visible, associated error.
- [ ] A test asserting the categories the form posts are the ones the API currently serves.
- [ ] A browser test completing onboarding from an empty profile.

---

### #223: A below-minimum quote makes Send a dead control

**Milestone:** M3 | **Priority:** P1 High | **Status:** Backlog | **Capabilities:** `core`
**Blocked by:** None

Vendor onboarding + quote-flow pass, 2026-08-29 — the first pass to drive vendor
onboarding from nothing and the quote path. **Where:** `/vendor/dashboard`, vendor.

| | |
| --- | --- |
| **Expected** | a message naming the $25 minimum |
| **Observed** | for `0`, `-500`, `24` and `24.99`: **no network request at all**, no toast, no inline error. The editor stays open with the bad value still in the field and nothing whatsoever happens. The input has `min="25"` but sits **outside a `<form>`**, so native validation never fires either |

**Context.** Note the asymmetry with the maximum (#224): the minimum blocks silently client-side, the maximum leaks a server exception string.

**Acceptance:**

- [ ] A below-minimum quote shows a visible message naming the minimum
- [ ] The control is never inert without explanation

**Tests (required):**

- [ ] A component test asserting each out-of-range value renders a message and fires no request.

---

### #224: An above-maximum quote shows the raw API error string to the vendor

**Milestone:** M3 | **Priority:** P1 High | **Status:** Backlog | **Capabilities:** `core`
**Blocked by:** None

Vendor onboarding + quote-flow pass, 2026-08-29 — the first pass to drive vendor
onboarding from nothing and the quote path. **Where:** `/vendor/dashboard`, vendor.

| | |
| --- | --- |
| **Expected** | "The most you can quote is $100,000." |
| **Observed** | `100001` produces a toast reading literally **`Request validation failed`**. The maximum is never stated and the field carries no `max` attribute, so the vendor has no way to learn what number is acceptable |

**Context.** Same class as #72 — an upstream error string reaching a user-facing surface.

**Acceptance:**

- [ ] The message names the maximum in the vendor's terms
- [ ] The field carries `max` so the browser can help
- [ ] No upstream validation string is rendered

**Tests (required):**

- [ ] Extend #72's test to assert no rendered error equals `Request validation failed`.

---

### #225: The success toast covers the submit button it confirms

**Milestone:** M3 | **Priority:** P2 Medium | **Status:** Backlog | **Capabilities:** `core`
**Blocked by:** None

Vendor onboarding + quote-flow pass, 2026-08-29 — the first pass to drive vendor
onboarding from nothing and the quote path. **Where:** `/vendor/profile/edit` and `/vendor/packages`, vendor.

| | |
| --- | --- |
| **Expected** | the confirmation does not obstruct the control that produced it |
| **Observed** | measured at 1440x900 on both screens: profile editor toast `x:1060 y:822 w:356 h:53` over a `Save changes` button at `x:1305 y:853`; packages toast `x:1060 y:823` over `Save package` at `x:1254 y:819`. `document.elementFromPoint` on the button centre returns the toast in both cases |

**Context.** sonner pauses auto-dismiss on hover, and the pointer is resting on the button that was just clicked — so it blocked the driver for **30 seconds** on both screens. A real vendor saving twice in a row hits the same trap.

**Acceptance:**

- [ ] Toasts do not overlap primary submit controls at any supported viewport
- [ ] Either the toast is repositioned, or the submit bar reserves space for it

**Tests (required):**

- [ ] A browser assertion that no toast's rect intersects a visible submit button's rect after a save.

---

### #226: Sign-up returns to the role picker after email verification

**Milestone:** M3 | **Priority:** P2 Medium | **Status:** Backlog | **Capabilities:** `core`
**Blocked by:** None

Vendor onboarding + quote-flow pass, 2026-08-29 — the first pass to drive vendor
onboarding from nothing and the quote path. **Where:** `/sign-up`, new user.

| | |
| --- | --- |
| **Expected** | the new user lands in the product |
| **Observed** | after choosing a role, entering email and password, and submitting the verification code, the app **returns to `/sign-up` showing the role step again**, with no fields and no progress indication. `window.Clerk.session` was in fact live — only manual navigation revealed it |

**Context.** This is the first thing every beta user does. It reads as a failed sign-up.

**Acceptance:**

- [ ] A verified user is routed into the product by role
- [ ] The verification step never returns to the role picker

**Tests (required):**

- [ ] A browser test completing sign-up for both roles and asserting the landing route.

---

### #227: Unsaved profile edits are discarded silently

**Milestone:** M3 | **Priority:** P2 Medium | **Status:** Backlog | **Capabilities:** `core`
**Blocked by:** None

Vendor onboarding + quote-flow pass, 2026-08-29 — the first pass to drive vendor
onboarding from nothing and the quote path. **Where:** `/vendor/profile/edit`, vendor.

| | |
| --- | --- |
| **Expected** | the vendor is warned before losing work |
| **Observed** | editing a field shows `Unsaved changes` in the submit bar; clicking a section-rail link navigates away with **no `beforeunload` and no in-app guard** (`dialogSeen: false`). Returning shows the old value |

**Acceptance:**

- [ ] Navigating away with unsaved changes prompts, in-app and on unload

**Tests (required):**

- [ ] A test asserting a guard fires when the form is dirty and not when it is clean.

---

### #228: A newly onboarded vendor's public storefront shows placeholder copy

**Milestone:** M3 | **Priority:** P2 Medium | **Status:** Backlog | **Capabilities:** `core`
**Blocked by:** None

Vendor onboarding + quote-flow pass, 2026-08-29 — the first pass to drive vendor
onboarding from nothing and the quote path. **Where:** `/vendors/<slug>`, public.

| | |
| --- | --- |
| **Expected** | a cover image or a designed empty state |
| **Observed** | the literal string **`COVER · FULL-BLEED BANNER`** renders in the cover band of every vendor without a cover image. `/vendors/kessler-co`, which has one, does not |

**Context.** Every vendor who completes onboarding has this on their live public page until they upload a cover — and #137 records that **there is no cover upload control**, so today they cannot remove it.

**Acceptance:**

- [ ] A vendor with no cover gets a designed empty state, never a placeholder label
- [ ] Resolved together with #137, which adds the missing cover control

**Tests (required):**

- [ ] A test asserting no public page renders a frame placeholder string.

---

### #229: Messaging: one thread per pair, and new messages raise no notification in either direction

**Milestone:** M3 | **Priority:** P2 Medium | **Status:** Backlog | **Capabilities:** `core`
**Blocked by:** None

Vendor onboarding + quote-flow pass, 2026-08-29 — the first pass to drive vendor
onboarding from nothing and the quote path. **Where:** `/messages`, both roles.

| | |
| --- | --- |
| **Expected** | a thread per booking, and a notification when a message arrives |
| **Observed** | a customer with two live requests against one vendor saw **exactly one thread**, headed `RE: DEC 31 WEDDING`, with no switcher — the DB has one `conversations` row bound to the *other* request. **There was no way to message the vendor about the request that carried the quote.** Separately, after a message was sent, `GET /notifications` was unchanged and the nav read plain `Messages` with no count — in **both** directions. The only unread signal is a chip inside `/messages` |

**Context.** Extends #209 and #193. The SSE delivery itself works correctly — the reply appeared without a reload.

**Acceptance:**

- [ ] A conversation is scoped so a customer can discuss a specific request
- [ ] A new message raises a notification and a nav badge for the recipient

**Tests (required):**

- [ ] A test asserting two requests from one customer to one vendor yield addressable threads.
- [ ] A test asserting an inbound message increments the recipient's notification count.

---
### #235: The app's inherited line-height is 1.5, so every arbitrary `text-[Npx]` renders loose

**Milestone:** M3 | **Priority:** P1 High | **Status:** Done | **Capabilities:** `core`
**Blocked by:** #165 (it owns `globals.css` this run; the file frees up when it merges)

Found by #74's browser measurement, 2026-08-29. Filed at #165's request after it
declined to absorb the fix — correctly, because the change needs a browser pass
over every screen and #165's acceptance criteria say nothing about leading.

**The mechanism, with compiled output rather than assertion.** #74 set every
`--text-*--line-height` to `normal` to match the frames. That reaches an element
only when its size comes from a **named scale step**, because Tailwind emits the
size and the line-height on the same rule. An element sized with an **arbitrary**
utility gets font-size and nothing else:

```
.text-\[10\.5px\]{font-size:10.5px}
```

So it inherits. `apps/web/node_modules/tailwindcss/preflight.css:28-30` sets
`html, :host { line-height: 1.5 }`, and `apps/web/src/app/layout.tsx:95-99` sets
no line-height on `<html>` or `<body>`. **96 arbitrary `text-[Npx]` occurrences
across 40 files therefore render at 1.5 where the frames draw `normal`** — led by
`text-[10.5px]` (20 sites) and `text-[12.5px]` (16).

**Measured consequence at 1440x900** (frame vs live, `getBoundingClientRect`):

| Control | Frame | Live | Delta |
| --- | --- | --- | --- |
| Category card (`01`) | 157.50 | 163.75 | **+6.25** |
| — its `.sh` title, `text-[17px]` | 22.50 | 25.50 | +3.00 |
| — its description, `text-[11.5px]` | 14.00 | 17.25 | +3.25 |
| Search refine chip (`02`) | 31.00 | 34.75 | **+3.75** |
| Vendor-profile chip (`03`) | 24.00 | 27.25 | **+3.25** |
| `.lbl` micro-label, `text-[10.5px]` | 12.50 | 15.75 | +3.25 |
| Rail price, `text-[36px]` | 46.50 | 54.00 | +7.50 |

Every control that closed under #74 uses a scale step; every one that did not uses
`text-[Npx]`. **These are three of #74's five acceptance controls**, which is why
#74 shipped with its criteria recorded as half-met rather than claimed.

The serif group is the highest-value target: `.h2` and `.sh` set no line-height in
the frames, and the sites carrying `text-[26px]`, `[22px]`, `[20px]` and `[19px]`
draw a ~39px line box against the frame's ~30px.

**Acceptance:**

- [ ] The inherited default agrees with the frames — one declaration,
      `html { line-height: normal }` in `globals.css`'s base layer, rather than a
      `leading-*` added to each of the 96 call sites. The per-call-site route
      cannot close the class: an element with **no** text utility still inherits
- [ ] The five controls #74 names all match their frame at 1440x900
- [ ] Any prose that regresses is given an explicit measure (`leading-prose`,
      `leading-normal`) rather than the default being widened back
- [ ] Every screen is driven in a browser afterwards — this changes computed
      leading product-wide, and #74's pass could not reach the four vendor
      surfaces blocked by #233

**Tests (required):**

- [ ] A test asserting the app sets an inherited line-height that matches the
      frames', so a future Tailwind upgrade reintroducing `1.5` fails here.
- [ ] A guard asserting no `className` carrying `text-[<n>px]` ships without an
      accompanying `leading-*`. It fails on 96 sites today, so it lands with the
      fix, not before.

**Sequencing.** Work **before #198**. Five sites use `text-[26px]` where
`--text-display-md: 26px` already exists; collapsing them to the token is only
safe once the inherited default is `normal`, otherwise it moves leading away from
the frame rather than toward it.

---



### #230: Avatar initials render Instrument Serif below the 16px floor at three of five sizes

**Milestone:** M3 | **Priority:** P2 Medium | **Status:** Blocked — needs a human
**Capabilities:** `core`
**Blocked by:** None — blocked on a design ruling, not on code

Found 2026-08-29 while implementing #165, which removed the blanket heading rule and added a
whole-class guard for the serif floor. The guard cannot cover this one, because the size is
not stated in a class.

`apps/web/src/components/ui/avatar.tsx:120` sizes the initials fallback from the avatar
diameter: `fontSize: ${pixels * 0.42}px`. Against `AVATAR_SIZES` that resolves to

| Size | Diameter | Initials | Verdict |
| ---- | -------- | -------- | ------- |
| `xs` | 30px | **12.6px** | below the floor |
| `sm` | 34px | **14.3px** | below the floor |
| `md` | 38px | **16.0px** | exactly on it |
| `lg` | 64px | 26.9px | fine |
| `xl` | 82px | 34.4px | fine |

`sm` is the default, so most avatars in the product are affected.

**This is a conflict inside the design contract, which is why it is not simply fixed.**

- `design/design-plan/01-foundations.md` states of Instrument Serif: **"Never below 16px."**
- `design/design-plan/03-components.md` § Avatars states: **"Initials fallback: Instrument
  Serif on `clay-100` (`clay-600` text) or `sage-100` (`sage-600`) — alternate by hash so a
  list doesn't read as one colour. Sizes: 30 / 34 / 38 / 64 / 80."**

Both cannot hold. Deciding one way silently would either put a rule in the foundations that
the component vocabulary ignores, or change the look of every avatar in the product. Per
`.claude/rules/web-design-parity.md`, where the frames and the plan disagree the frame wins —
but here the disagreement is between two plan files, and the frames draw initials without
stating a family, so they do not settle it.

**The ruling needed, one of:**

1. **Avatar initials are exempt from the floor.** Record the exemption in `01-foundations.md`
   next to the rule, so the next reader does not re-file this. `#165`'s guard already carries
   `avatar.tsx` in `SIZED_OUTSIDE_THE_CLASS_SYSTEM`; that list becomes the documented
   exemption rather than a gap.
2. **The floor wins.** Initials go to Instrument Sans below 16px — a visible change to every
   `xs` and `sm` avatar, and `03-components.md` is corrected.
3. **The ratio changes.** Raise `0.42` so `xs` clears 16px (0.54 would), which changes the
   optical weight of every avatar and needs a parity pass of its own.

**Tests (required, once ruled):** whichever option lands, assert it against `AVATAR_SIZES` so
adding a sixth size cannot reintroduce the problem — the defect here is a ratio applied to a
scale, not one bad value.

---

### #231: `pnpm dev` inside a lane binds the web app to the lane's API port

**Milestone:** M4.5 | **Priority:** P1 High | **Status:** Done | **Capabilities:** `core`
**Blocked by:** None

Found 2026-08-29 bringing up lane 165. `pnpm lane:up <n>` writes `.env.lane` with

```
PORT=4010
WEB_PORT=3010
```

`PORT` is the API's port. But `next dev` reads `PORT` too, and nothing reads `WEB_PORT` — so
`pnpm lane:exec 165 -- pnpm dev` starts **the web app on 4010** and the API then dies with
`listen EADDRINUSE: address already in use 0.0.0.0:4010`. Observed exactly that; worked
around by starting the two servers separately and passing `next dev --port 3010`.

This defeats the purpose of the lane allocator. `pnpm lane:up` prints
`Run everything through: pnpm lane:exec <ticket> -- <command>` and the documented next step is
`pnpm dev`, so the first thing every lane is told to do is the thing that breaks it. The
failure is also quiet in the wrong way: the web app comes up and answers, so a browser pass
against `localhost:3010` gets connection-refused while `4010` serves the web app, and the
obvious reading is "my change broke the app".

**Fix:** have `apps/web` take its port from the lane rather than from the ambient `PORT` —
either `"dev": "next dev --port ${WEB_PORT:-3000}"`, or drop `WEB_PORT` and let `lane:exec`
set `PORT` per package. The second is cleaner but needs `laneEnvFor` to know which package it
is spawning.

**Verified against the repository 2026-08-29 while implementing this ticket: three of the four
defects described here had already been fixed out of band, with tests.** `laneUp` no longer
short-circuits on a manifest alone — it gates on `state === 'active'` and reconciles the env file
through `ensureLaneEnv`. `baseDatabaseUrl` reads the worktree's own `.env` when the shell exported
none. `renderLaneEnv` writes `WEB_URL`, so the lane's API accepts the lane's own web origin. Only
the headline port defect was still live. The text below is left as filed, for the record.

**Two smaller defects found alongside it, same session, same file territory:**

- **`laneUp` short-circuits on a manifest alone.** `readManifest` returning a row makes it
  return early, so a lane whose manifest exists but whose `.env.lane`, `node_modules` and
  database do not is reported as `✓ Lane up` and then fails on the next command with
  `No .env.lane`. It should verify the artefacts it claims to have created, not just the
  manifest. Recovering needed a `lane:down` followed by `lane:up`.
- **`pnpm lane:up` requires `DATABASE_URL` in the ambient environment** and does not read the
  repository's own `.env`, so it exits 1 with "DATABASE_URL is not set" in a shell that has
  not sourced it — while every other command in the repo works fine. It should load the root
  `.env` the way the apps do.
- **The lane's API rejects the lane's own web origin, so every client-side fetch fails.**
  `.env.lane` sets `PORT` and `NEXT_PUBLIC_API_URL` but not the API's allowed origin, which
  stays at `http://localhost:3000`. Measured on lane 165:

  ```
  Origin: http://localhost:3010 → 200, no access-control-allow-origin header
  Origin: http://localhost:3000 → 200, access-control-allow-origin: http://localhost:3000
  ```

  In the browser this means `GET /vendors?...` fails with `net::ERR_FAILED`, `/notifications`
  fails, and the `/events/stream` SSE fails, on every signed-in screen of every lane. Search
  renders its error boundary. **This is the most damaging of the four**, because a browser
  pass in a lane sees a broken app and has to work out that the lane is broken rather than
  the ticket. `lane:up` must write the web origin into the lane env too.

**Tests (required).** The current `lane.test.ts` asserts the **manifest's contents** — the
lane's *intent*. Nothing asserts the lane's *reality*, which is exactly why this passed
review. So the test that matters is the reality one (lane 74's framing, and it is the right
one): after `lane:up`, something is actually listening on both `manifest.webPort` and
`manifest.apiPort`. Add alongside it a test that `laneUp` re-creates a lane whose `.env.lane`
is missing rather than reporting success from the manifest alone.

---

### #232: Every lane worktree gets `node_modules` as a symlink to the main checkout

**Milestone:** M4.5 | **Priority:** P1 High | **Status:** Done | **Capabilities:** `core`
**Blocked by:** None

Found 2026-08-29 by lanes 74 and 165 independently, on the same fleet run. All four lane
worktrees were created with:

```
$ ls -ld .claude/worktrees/<id>/node_modules
lrwxr-xr-x  node_modules -> /Users/humza/Documents/vendor-marketplace/node_modules
```

**This is the one thing `~/.claude/orchestration-policy.md` names as forbidden:** "Do not
symlink `node_modules` between lanes. A symlinked tree is shared mutable state, and the one
command that repairs a lane's resolution writes through it into every other lane." A lane
running `pnpm install` prints `Recreating /Users/humza/.../vendor-marketplace/node_modules`
and only that path's mtime moves — so a lane repairing itself mutates what three peers are
reading mid-run.

It is also the root cause under several of the symptoms filed separately. Lane 67 fixed two
of them — the `.gitignore` trailing slash (`node_modules/` matches a directory, and a symlink
to a directory is not one, so `git status` showed `?? node_modules` and the link was
stageable) and a missing `CI=true`. Both are real fixes, and neither stops a lane's install
from writing into its peers.

Lane 165 worked around it locally by deleting the link and running a real `pnpm install` in
the worktree (7.1s, fully content-addressed from the store, so the cost of doing this
properly is negligible).

**Fix:** whatever creates the worktrees should let each one install its own `node_modules`,
or `pnpm lane:up` should replace an inherited symlink with a real install before it does
anything else. The store is content-addressed, so per-lane installs are cheap.

**Tests (required):** assert that a lane worktree's `node_modules` is a directory and not a
symlink — `lstat` on it, not `stat`, since `stat` follows the link and reports a directory
either way. That distinction is why this was invisible.

---

### #233: The E2E vendor account has no vendor profile, so four vendor screens cannot be browser-verified

**Milestone:** M4.5 | **Priority:** P1 High | **Status:** Backlog | **Capabilities:** `core`
**Blocked by:** None

Found 2026-08-29 running the browser gate for #165.

Signed in with `.auth/vendor.json`, all four of these return HTTP 200 but land on
`/vendor/profile/edit`:

- `/vendor/dashboard`
- `/vendor/portfolio`
- `/vendor/packages`
- `/vendor/availability`

`GET /vendor/profile` answers **404**, so `getOwnVendorProfile()` returns `null` and
`apps/web/src/app/vendor/dashboard/page.tsx:37` redirects. Confirmed at the DOM level rather
than inferred: every field in the storefront editor is empty — `0 / 80`, `0 / 1200`,
`0 of 5 chosen`.

`pnpm db:seed:marketing` seeds 16 vendors, but none of them is tied to the E2E vendor's Clerk
id, so the account that browser verification signs in with is the one account with no
storefront.

**Why this matters more than it looks.** It is not a cosmetic fixture gap — it silently
removes four of the product's five vendor surfaces from every browser pass, on every ticket.
The availability rail micro-labels, the vendor dashboard rail label, and the portfolio and
package confirmation dialogs could not be measured for #165 for exactly this reason, and a
less careful pass would have reported them as clean rather than as unreached.

**Fix:** seed a vendor profile (with packages, portfolio items and calendar dates) for the
E2E vendor's Clerk id as part of `db:seed:marketing`, reading the id from `.env.e2e.local` —
never from a literal in the repo.

**Tests (required):** a check that the E2E vendor id resolves to a vendor profile after
seeding. Better as a `pnpm preflight` check than a unit test — the same class as the existing
"Demo data present" check, which passes today while the account that matters has nothing.

---

### #234: Clerk's own sign-in card reads `vendor-marketplace` to the user

**Milestone:** M3 | **Priority:** P2 Medium | **Status:** Backlog
**Capabilities:** `core` `auth`
**Blocked by:** None

Found 2026-08-29 running the browser gate for #165. On `/sign-in`, next to our own branded
`h1`, Clerk renders its own card heading:

> **Sign in to vendor-marketplace**

Project law is that infrastructure and packages take the repo name, and **anything a user
reads says Orla, from `BRAND_NAME`**. This is the one place the repo name reaches a user, and
`brand-literals.test.ts` cannot see it because the string is not in this repository — it is
the Clerk application name, served by Clerk.

**Fix:** rename the Clerk application in the Clerk dashboard. **Human gate:** it is a setting
in an external account, not a code change.

Worth checking the same setting for every other place Clerk uses the application name —
transactional email subjects and sender names most of all, since those reach a user outside
the product entirely.

---
### #236: The web search boundary re-declares the API's query schema instead of deriving from it

**Milestone:** M3 | **Priority:** P2 Medium | **Status:** Backlog | **Capabilities:** `core`
**Blocked by:** None

Filed from the #66 review, 2026-08-29. `searchStateSchema` in
`apps/web/src/components/search/search-state.ts` hand-copies every field rule in
`vendorSearchQuerySchema` (`packages/shared/src/schemas/index.ts`). The bounds
read from the same constants, so the two cannot disagree on a *value* — but they
can disagree on *composition*, and they already had: the client declared
`tags: z.array(z.string())` against the API's `z.array(uuidSchema)`, so the one
param with no bound was the one that still reached the API. #66 fixed that
instance; nothing stops the next one.

**Deliberately not done in #66.** `packages/shared/src/schemas/index.ts` was owned
by a concurrent lane for the duration, which required changes there to stay
additive and confined to a single hunk. Extracting a field map rewrites the file's
core.

**Acceptance:**

- [ ] `packages/shared` exports the per-field shapes `vendorSearchQuerySchema` is built from
- [ ] The web boundary derives its fields from that map rather than restating them
- [ ] The two deliberate client-side differences survive and are commented: `''`/`null` for absent values instead of `undefined`, and no universally-past-date refusal (that judgement is the viewer's local day, so it stays in the client effect)

**Tests (required):**

- [ ] A test asserting a value the client boundary accepts is not rejected by `vendorSearchQuerySchema` for being out of range, driven over every field rather than one example.

---

### #237: `page` is bounded below but not above, on both sides of the boundary

**Milestone:** M3 | **Priority:** P3 Low | **Status:** Backlog | **Capabilities:** `core`
**Blocked by:** None

Filed from the #66 review, 2026-08-29. `paginationQuerySchema` and
`vendorSearchQuerySchema` both cap `pageSize` at `MAX_PAGE_SIZE` and leave `page`
at `.int().min(1)`. The web boundary mirrors that.

**This is not a 500.** Zod's `.int()` caps at 2^53−1, and `page × pageSize` stays
inside Postgres' `bigint`, so it cannot overflow the way `minPriceCents` did.
What it costs is work: `OFFSET <huge>` still makes Postgres sort the whole
filtered set before discarding it, which is amplification bounded by table size —
identical to `?page=99999`, which a person can also type. Same class as #66's
price cap, well below it in severity.

`tags` has the same shape of gap: no array-length bound on either side. Node's
16KB header limit caps a URL at roughly 380 tag params today, so the protection
is the HTTP server's rather than the schema's.

**Acceptance:**

- [ ] `page` carries an upper bound alongside `pageSize`, in the shared schema and in the web boundary
- [ ] `tags` carries a maximum array length on both sides
- [ ] The bound is a named constant, not a literal

**Tests (required):**

- [ ] A shared-schema test asserting a `page` above the cap fails validation and the cap itself passes.
- [ ] A test asserting a tag list longer than the cap fails validation.

---

### #238: The lane support tooling still hardcodes ports 3000 and 4000

**Milestone:** M4.5 | **Priority:** P1 High | **Status:** Done | **Capabilities:** `core` `auth`
**Blocked by:** None

Filed from the #231 review, 2026-08-29. #231 fixed the app: `pnpm lane:exec <n> -- pnpm dev`
now brings the web app up on the lane's `WEB_PORT` and the API on its `PORT`. The tooling
*around* the app was not fixed, and three places still assume the shared dev ports. Each one
fails quietly, and each one makes a working lane look like a broken ticket.

**1. Preflight never checks the lane's ports.** `packages/preflight/src/checks/ports.ts`:

```ts
export const DEV_PORTS = [
  { port: 3000, service: 'apps/web' },
  { port: 4000, service: 'apps/api' },
];
```

`pnpm lane:exec 231 -- pnpm preflight --ticket 231` runs with `PORT=4018` and `WEB_PORT=3018`
in its own environment and still evaluates 3000 and 4000. So an abandoned server on the
lane's real port passes the gate and surfaces as `EADDRINUSE` mid-ticket, while the two
lines preflight *does* print describe ports the lane will never touch. Read `PORT` and
`WEB_PORT` from the environment, falling back to 3000/4000.

**2. `hunt-bugs` skips its whole browser phase inside a lane.** `.claude/workflows/hunt-bugs.js`
asks the readiness agent, verbatim: *"Is the web app serving on port 3000? Is the API serving
on port 4000? curl both"*, and returns `ready:true` only if both answer. Run in a lane with
the servers correctly on 3018/4018 the gate returns `ready:false`, and
`.claude/workflows/hunt-bugs.test.mjs` confirms a not-ready verdict skips the browser phase —
so seven flows are silently not driven and the sweep still reports as having run. `.env.lane`
already carries `WEB_PORT` and `WEB_URL`; the prompt should read them.

**3. `pnpm e2e:auth` in a lane signs in against the main checkout.** `scripts/e2e-auth.mjs`:

```js
const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3000';
```

Neither `WEB_PORT` nor `WEB_URL` is consulted, so a lane's `e2e:auth` drives the developer's
port-3000 server — backed by the *shared* database — and writes `.auth/customer.json` and
`.auth/vendor.json` into the lane's worktree. Every later browser pass in that lane then loads
a storage state minted against the wrong origin and the wrong data. If nothing is on 3000 it
instead fails at `page.goto` with a connection error that reads as a broken lane.

**This is the same class of defect as #231** — a lane allocates ports correctly and something
downstream ignores the allocation — which is why it is one ticket rather than three.

**Acceptance:**

- [ ] Preflight's port check reads `PORT` and `WEB_PORT` from the environment, defaulting to 4000/3000
- [ ] `hunt-bugs`' readiness gate resolves the ports from the environment rather than naming 3000/4000
- [ ] `scripts/e2e-auth.mjs` derives its base URL from `WEB_URL`/`WEB_PORT` before falling back to 3000
- [ ] No remaining hardcoded 3000/4000 in tooling a lane runs

**Tests (required):**

- [ ] A preflight test asserting the checked ports follow `PORT`/`WEB_PORT` when set, and default when unset.
- [ ] A test asserting `e2e-auth`'s base URL resolves from the lane environment, and still defaults to 3000 without one.
- [ ] Extend `hunt-bugs.test.mjs` to assert the readiness prompt names no literal port.

---

### #239: Four header controls render no focus ring at all

**Milestone:** M3 | **Priority:** P1 High | **Status:** Backlog | **Capabilities:** `core`
**Blocked by:** None

Filed by lane `worktree-90` from the 2026-08-29 `parity-checker` pass over frame `02 Search`, at 1440x900 from computed DOM styles in a guest context — the frame rendered from `design/Orla - Screens.dc.html`, the live screen in the same browser.

**Axis: Access**

Measured by tabbing and reading `box-shadow` at each stop, at 1440x900, guest.

| Element | `box-shadow` when focused |
| --- | --- |
| `button[aria-label="Vendor type"]` | all five layers **0px spread** |
| city `<input>` | all layers 0px spread |
| date `<input>` | all layers 0px spread |
| `a` "Sign up" | ring colour `oklab(0 0 0 / 0)` at 0px spread |

The three bar segments suppress their own ring on purpose — `search-bar.tsx` sets `focus-visible:ring-0 focus-visible:ring-offset-0` and delegates to a bar-level `has-[:focus-visible]:ring-3` — but that delegation is **not firing here**: the `form`'s computed `box-shadow` stays at its resting `rgba(35,32,28,.06) 0 2px 10px` while each child is focused. So the segments end up with neither their own ring nor the bar's.

This is the search-header sibling of #89, which covers the same suppression on the landing hero. #89 is about *which* control the one ring identifies; this is about **no ring rendering at all**, which is a different failure and a harder one.

The law is `ring-2 ring-clay-400/30 ring-offset-2 ring-offset-stone-50` (`04-laws.md:133`). The 24 correct stops compute `rgb(248,245,239) 0 0 0 2px, oklab(0.560981 0.100727 0.0885573 / 0.3) 0 0 0 4px`.

**Acceptance:**

- [ ] The live element matches the frame value above, read from the DOM rather than judged from a screenshot
- [ ] `parity-checker` reports **MATCH** on the **Access** axis for frame `02 Search`
- [ ] No other element on the screen regresses on any of the six axes as a result

**Test (required):**

- [ ] A browser assertion that tabs to each of the four controls and asserts a **rendered** ring — the computed value is what already passes while nothing is drawn.
- [ ] An assertion that the bar-level `has-[:focus-visible]` ring actually applies to the `form` when a segment holds focus.

---

### #240: The header submit renders its focus ring with no offset

**Milestone:** M3 | **Priority:** P2 Medium | **Status:** Backlog | **Capabilities:** `core`
**Blocked by:** None

Filed by lane `worktree-90` from the 2026-08-29 `parity-checker` pass over frame `02 Search`, at 1440x900 from computed DOM styles in a guest context.

**Axis: Access**

Focused, `button[aria-label="Search"]` computes
`oklab(0.560981 0.100727 0.0885573 / 0.3) 0 0 0 2px` — the ring is present, but its offset layer has 0px spread. `search-bar.tsx` sets `focus-visible:ring-offset-0` on the control explicitly.

The law is `ring-2 ring-clay-400/30 ring-offset-2 ring-offset-stone-50` (`04-laws.md:133`), and the 24 correct tab stops on this screen render both layers:
`rgb(248,245,239) 0 0 0 2px, oklab(0.560981 0.100727 0.0885573 / 0.3) 0 0 0 4px`.

**Scope note.** This finding was originally filed with the control's 44x44 hit-area breach. That half moved to **#94**, which was re-scoped to the Access axis and implemented it — the circle keeps the size #57 settled and a centred `after:size-11` grows the target. Only the focus offset is left here. The ring sits on a control whose paint is 32px inside a 42px bar, so an offset ring needs somewhere to go: check it does not clip against the bar's rounded edge.

**Acceptance:**

- [ ] The control renders both ring layers when focused, read from the DOM rather than judged from a screenshot
- [ ] `parity-checker` reports **MATCH** on the **Access** axis for frame `02 Search`
- [ ] No other element on the screen regresses on any of the six axes as a result

**Test (required):**

- [ ] A browser assertion that the focus ring **renders** with its offset, not merely that the class is present.

---

### #241: The Rating popover stays open after a value is chosen

**Milestone:** M3 | **Priority:** P2 Medium | **Status:** Backlog | **Capabilities:** `core`
**Blocked by:** None

Filed by lane `worktree-90` from the 2026-08-29 `parity-checker` pass over frame `02 Search`, at 1440x900 from computed DOM styles in a guest context — the frame rendered from `design/Orla - Screens.dc.html`, the live screen in the same browser.

**Axis: Layout**

A single-select popover has no reason to stay open: the choice is complete the moment it is made, and the result of the choice is behind the panel. The panel covers the count heading and card 1, so the customer has to dismiss it to read the outcome of their own action.

The rating popover is also, separately, three plain `<button>`s with no `role="radiogroup"` / `role="radio"` / `aria-checked` and no roving tabindex, so it announces as three unrelated buttons rather than one single-choice control. `04-laws.md` asks for a radio-group pattern for star ratings. Fix both together — they are the same control.

Focus handling itself is correct and should not regress: `Escape` closes the panel and returns focus to the `Rating ▾` trigger, and ten consecutive `Tab`s stay inside the dialog.

**Acceptance:**

- [ ] The live element matches the frame value above, read from the DOM rather than judged from a screenshot
- [ ] `parity-checker` reports **MATCH** on the **Layout** axis for frame `02 Search`
- [ ] No other element on the screen regresses on any of the six axes as a result

**Test (required):**

- [ ] A browser assertion that choosing a rating closes the panel and returns focus to the trigger.
- [ ] An assertion that the options expose a radio-group pattern with `aria-checked`.

---

### #242: `free on …` sits inside the `<h1>`, so the accessible name runs together

**Milestone:** M3 | **Priority:** P2 Medium | **Status:** Backlog | **Capabilities:** `core`
**Blocked by:** None

Filed by lane `worktree-90` from the 2026-08-29 `parity-checker` pass over frame `02 Search`, at 1440x900 from computed DOM styles in a guest context — the frame rendered from `design/Orla - Screens.dc.html`, the live screen in the same browser.

**Axis: Access**

Frame `02` draws two sibling spans inside the count row:

```html
<div><span class="h2" style="font-size:22px">24 photographers in Austin</span><span style="font-size:13px;color:#6B6459;margin-left:10px">free on Sun, Jun 14</span></div>
```

Live, the second span is a **child of the `h1`**. Two consequences, both measured:

1. **The heading's accessible name is `10 photographers in Austinfree on Sun, Sep 13`** — the two strings abut with no space, because accessible-name computation concatenates text nodes without inserting separators across inline boundaries. This is what a screen reader announces for the page's only `h1`.
2. **It inherits `-0.01em` tracking** from the heading, computing `letter-spacing: -0.22px` against the frame's `normal`. Everything else about the span already matches exactly: `13px`, weight `400`, `rgb(107,100,89)`, `margin-left: 10px`.

Moving the span out of the `h1` to be its sibling — which is what the frame draws — fixes both at once, which is why they are one ticket rather than two.

**Acceptance:**

- [ ] The live element matches the frame value above, read from the DOM rather than judged from a screenshot
- [ ] `parity-checker` reports **MATCH** on the **Access** axis for frame `02 Search`
- [ ] No other element on the screen regresses on any of the six axes as a result

**Test (required):**

- [ ] An assertion on the `h1`'s computed accessible name, not its `textContent`.
- [ ] A parity assertion that the sub-line's `letter-spacing` matches the frame's span.

---

### #243: The availability chip has one tone where the frame draws three

**Milestone:** M3 | **Priority:** P2 Medium | **Status:** Backlog | **Capabilities:** `core`
**Blocked by:** None

Filed by lane `worktree-90` from the 2026-08-29 `parity-checker` pass over frame `02 Search`, at 1440x900 from computed DOM styles in a guest context — the frame rendered from `design/Orla - Screens.dc.html`, the live screen in the same browser.

**Axis: Colour**

The three the frame draws, with the tokens they resolve to:

| Frame chip | Fill | Text | Token | Means |
| --- | --- | --- | --- | --- |
| `Free Jun 14` | `#EDF0E9` | `#4B5940` | `sage-50` / `sage-600` | settled — the date is open |
| `2 dates left` | `#F5EEDC` | `#7A5A12` | `gold-50` / `gold-600` | running out |
| `New` | `#F0EAE1` | `#4A443C` | — / `stone-700` | no signal either way |

`40-states.md` is a law and it makes gold correct here: **gold is waiting on someone / running out**, and scarcity is exactly that. `03-components.md:56-57` says the same in so many words — *"Availability chip is sage when free on the searched date, gold when scarce (\"2 dates left\"), absent when no date is in the query"* — so the sage and gold tones are settled contract and only the stone `New` tone is undocumented.

**Scarcity is a query result, not an invented number.** `11-search.md`'s no-invented-numbers rule is satisfied as long as the count comes from the vendor's real calendar; the data is already there (`112 calendar dates` in the marketing seed). The open question is only the threshold at which sage becomes gold.

Note the plan defines **two** tones and the frame draws **three**. The stone `New` tone needs a ruling before it ships.

**Acceptance:**

- [ ] The live element matches the frame value above, read from the DOM rather than judged from a screenshot
- [ ] `parity-checker` reports **MATCH** on the **Colour** axis for frame `02 Search`
- [ ] No other element on the screen regresses on any of the six axes as a result

**Test (required):**

- [ ] A test per tone, asserting the fill and text token against the frame at test time.
- [ ] A test that a vendor with no date in the query renders no chip at all.

---

### #244: The header logo lockup is a pixel large and a pixel and a half tight

**Milestone:** M3 | **Priority:** P3 Low | **Status:** Backlog | **Capabilities:** `core`
**Blocked by:** None

Filed by lane `worktree-90` from the 2026-08-29 `parity-checker` pass over frame `02 Search`, at 1440x900 from computed DOM styles in a guest context — the frame rendered from `design/Orla - Screens.dc.html`, the live screen in the same browser.

**Axis: Layout**

Measured at 1440x900 after #90 put the header inset at the frame's 26px, which is what made these visible — the lockup's left edge is now correct, so everything downstream of it is comparable for the first time.

| | Frame | Live |
| --- | --- | --- |
| mark → wordmark gap | `9px` | `7.5px` (`gap-8.5`) |
| wordmark | `23px` Instrument Serif, span width 34.0 | `24px`, `line-height 24px`, width 35.45 |
| outline circle | 15px content-box + 1.2px border = **17x17** | `box-border` 15x15 with a 1px border = **15x15** |
| mark overall span | 27px | 22px |
| wordmark x | 57 | 55.25 |

The circle is the content-box/border-box trap again: the frame has no `box-sizing` reset, so its border adds to the 15; `box-border` takes it out instead. Same shape of error as #97, and the same fix — declare the footprint, not the fill.

**Header chrome is #117–#123's territory**, so this is filed rather than fixed, and whoever takes it should check the logo against frame `01` too — the lockup is shared.

**Acceptance:**

- [ ] The live element matches the frame value above, read from the DOM rather than judged from a screenshot
- [ ] `parity-checker` reports **MATCH** on the **Layout** axis for frame `02 Search`
- [ ] No other element on the screen regresses on any of the six axes as a result

**Test (required):**

- [ ] A parity assertion deriving the gap, wordmark size and circle footprint from the frame at test time.

---

### #245: The active-filter `✕` is under the 44x44 hit area

**Milestone:** M3 | **Priority:** P3 Low | **Status:** Backlog | **Capabilities:** `core`
**Blocked by:** None

Filed by lane `worktree-90` from the 2026-08-29 `parity-checker` pass over frame `02 Search`, at 1440x900 from computed DOM styles in a guest context — the frame rendered from `design/Orla - Screens.dc.html`, the live screen in the same browser.

**Axis: Access**

The `✕` is a real button (`refine-bar.tsx`), correctly labelled, and it is the only way to clear a single filter without clearing all of them — so it is a primary affordance rendered at roughly a third of the required hit area.

It sits inside the chip, which is itself only 34.75px tall (#235), so the height cannot be fixed independently of that ticket: the chip has to grow, or the hit area has to extend beyond the chip's painted box. The frame draws the chip at 31px, which is **shorter** still — so satisfying both the frame and the law needs a hit area larger than the painted control, not a bigger chip.

Same class as #240, and the two should probably be resolved with one approach to hit areas that exceed their paint.

**Acceptance:**

- [ ] The live element matches the frame value above, read from the DOM rather than judged from a screenshot
- [ ] `parity-checker` reports **MATCH** on the **Access** axis for frame `02 Search`
- [ ] No other element on the screen regresses on any of the six axes as a result

**Test (required):**

- [ ] An assertion on the hit area rather than the painted box, for both the `✕` and the chip.

---

### #246: The second row of results has fallen below the 900 fold

**Milestone:** M3 | **Priority:** P2 Medium | **Status:** Backlog | **Capabilities:** `core`
**Blocked by:** None

Filed by lane `worktree-90` from the 2026-08-29 `parity-checker` pass over frame `02 Search`, at 1440x900 from computed DOM styles in a guest context — the frame rendered from `design/Orla - Screens.dc.html`, the live screen in the same browser.

**Axis: Layout**

Band-by-band, measured against the frame at 1440x900:

| Band | Frame h | Live h | Δ | Cause |
| --- | --- | --- | --- | --- |
| header | 65 | 64 | −1 | frame `.hd` is content-box 64 + 1px border; live is `box-border` 64 |
| Refine bar | 54 | 57.75 | +3.75 | chip `line-height: 18.75px` vs `normal` (#235) |
| count row | 55 | 59 | +4 | `h1` `line-height: 33px` vs `normal` (29px) |
| card title | 25 | 28.5 | +3.5 | `text-[19px]` `line-height: 28.5px` |
| price row | 30 | 35.5 | +5.5 | `text-[17px]` `line-height: 25.5px` |
| cover | 230 | 223.33 | −6.67 | allowed — true 3:2 vs the frame's padded placeholder |

Net: the second-row card top sits at 575.08 against the frame's 566, and its price row at 904.08 against 898.

**This ticket is the fold criterion, not the line-heights.** #247 owns the three `line-height` rows; fixing those three is expected to reclaim ~13px and put the price row back above 900 on its own. File this so the criterion is verified after #247 lands rather than assumed — the frame only clears it by 2px, so it is genuinely marginal and deserves its own check.

**Acceptance:**

- [ ] The live element matches the frame value above, read from the DOM rather than judged from a screenshot
- [ ] `parity-checker` reports **MATCH** on the **Layout** axis for frame `02 Search`
- [ ] No other element on the screen regresses on any of the six axes as a result

**Test (required):**

- [ ] A browser assertion at exactly 1440x900 that the second-row price row's bottom is ≤ 900, derived from the frame rather than hardcoded.

---

### #247: The `text-[Npx]` line-height defect also hits the `h1`, card `h3` and price span

**Milestone:** M3 | **Priority:** P1 High | **Status:** Backlog | **Capabilities:** `core`
**Blocked by:** None

Filed by lane `worktree-90` from the 2026-08-29 `parity-checker` pass over frame `02 Search`, at 1440x900 from computed DOM styles in a guest context — the frame rendered from `design/Orla - Screens.dc.html`, the live screen in the same browser.

**Axis: Font**

Measured on `/search` at 1440x900:

| Element | Live `line-height` | Frame |
| --- | --- | --- |
| `h1` count heading | `33px` | `normal` (29px) |
| card `h3` title (`text-[19px]`) | `28.5px` | `normal` (25px) |
| price span (`text-[17px]`) | `25.5px` | `normal` (20px) |
| refine chips (`text-[12.5px]`) | `18.75px` | `normal` (15px) — **already #235** |

Same root cause #235 documents: #74 set every `--text-*--line-height` to `normal`, which only reaches elements sized by a named scale step; an arbitrary `text-[Npx]` emits `font-size` alone and inherits 1.5.

#235's title and body scope it to the chip, so a reader taking #235 would fix the chip and stop. Either widen #235 to every `text-[Npx]` site on this screen, or take this ticket — but the three rows above must be owned by one of them. They are the direct cause of #246, and #235's own note says 96 sites across 40 files are affected, so the general fix probably belongs there and this is the search-screen verification of it.

**Acceptance:**

- [ ] The live element matches the frame value above, read from the DOM rather than judged from a screenshot
- [ ] `parity-checker` reports **MATCH** on the **Font** axis for frame `02 Search`
- [ ] No other element on the screen regresses on any of the six axes as a result

**Test (required):**

- [ ] A parity assertion that each of the three elements computes the frame's `line-height`, derived from the frame at test time.

---

### #248: [DESIGN] Frame `02 Search` contradicts five sibling frames on the compact search bar

**Milestone:** M3 | **Priority:** P2 Medium | **Status:** Backlog | **Capabilities:** `core`
**Blocked by:** None

Filed by lane `worktree-90`, 2026-08-29. **This is a change to the design bundle, not to the application.** No ticket in this run may edit `design/`, so it is for the bundle's owner.

#57 (`3324a79`) ruled on the compact search bar: *"five against one is a stale frame, not a decision to escalate"*, and implemented the bar to frames `17 Search loading`, `18 Search no results` and the three 1024 search frames. The application is correct. **Frame `02 Search` was never brought into line**, so the contradiction is still sitting in the contract.

What frame `02` draws, against what the other five draw and the app implements:

| Property | Frame `02 Search` | Frames `17`, `18`, three at 1024 | App |
| --- | --- | --- | --- |
| submit | `Search` text pill, 81.25x35, `padding:10px 20px` | 32px clay circle | circle |
| third label | `Event date` | `Date` | `Date` |
| bar height | 45 (560 content-box + padding + border) | `height:42px` (40 at 1024) | 42 |
| border | `#DDD5C7` | `#E4DDD1` (`stone-300`) | `stone-300` |
| shadow | `0 1px 3px rgba(35,32,28,.04)` | `0 2px 10px rgba(35,32,28,.06)` | `--shadow-sm` |

**The cost is recurring, which is why this is a ticket rather than a note.** #91, #95 and #101 were filed from a sweep of frame `02`, closed by #57, filed again by the 2026-08-28 sweep, and closed again by lane `worktree-90` on 2026-08-29. A third sweep of the unchanged frame will file them a third time. The ruling lives in a commit message, a board row and a source comment — none of which a parity sweep reads, because a sweep reads the frame.

Note `#DDD5C7` appears exactly twice in the whole bundle (this bar, and a dashed upload box in frame `07`) and has no token on the stone ramp, which is corroborating evidence that the frame `02` values are the stale ones rather than an intended deviation.

**Acceptance:**

- [ ] Frame `02 Search` draws the same compact search bar as frames `17` and `18`
- [ ] A sweep of frame `02` no longer reports the submit, the date label, the bar box, the border or the shadow
- [ ] `11-search.md` is reconciled too — it still names `Event date` at :9 and :21, and a labelled `[ Search ]`

**Test (required):**

- [ ] Not applicable — this changes the design bundle. The existing parity assertions in `apps/web/src/components/` derive their expectations from the frame at test time, so they will fail if the reconciliation moves a value the app relies on, which is the check that matters.

---


### #256: A resumed lane keeps a stale `worktreePath` and `branch` in its manifest

**Milestone:** M4.5 | **Priority:** P3 Low | **Status:** Backlog | **Capabilities:** `core`
**Blocked by:** None

Found 2026-08-29 while landing #238, and reproduced in that lane.

`laneUp` (`packages/preflight/src/lane/lane.ts`) short-circuits on an existing manifest:

```ts
if (alreadyUp?.state === 'active') {
  ensureLaneEnv(worktreePath, alreadyUp, () => laneUrl(worktreePath, alreadyUp));

  return alreadyUp;
}
```

It reconciles the **env file** against the worktree it was handed — which is why a
resumed lane does get a correct `.env.lane` — but returns the stored manifest
untouched. `worktreePath` and `branch` therefore keep whatever the *first*
`lane:up` recorded, forever.

The failure that surfaced it: `pnpm lane:up 238` was run once from the main
checkout by mistake, writing `"branch": "main"` and
`"worktreePath": "/Users/humza/Documents/vendor-marketplace"`. Re-running it from
inside `.claude/worktrees/238` fixed the env file and left both fields lying.
`pnpm lane:pr 238 <url>` then printed `branch main`, and the manifest still names
the main checkout.

This matters because `/land-lanes` reads exactly those two fields to decide what
to tear down and which branch a lane owns — so a lane can point a teardown at the
shared checkout. `lane:down` and `lane:exec` are unaffected: both take the
worktree from `process.cwd()`.

Note this is **not** the drift `.claude/memory/lane-manifest-branch-drifts.md`
records as fixed on 2026-08-29. That fix added `pnpm lane:pr` so the PR URL and
branch stop being hand-edited; it did not make `laneUp` refresh a resumed lane's
location.

**Acceptance:**

- [ ] `laneUp` refreshes `worktreePath` and `branch` on an active manifest before returning it
- [ ] The ports, database and `createdAt` a lane already claimed are preserved — this re-homes a lane, it does not reallocate one

**Tests (required):**

- [ ] A test that `laneUp` called with a different `worktreePath` for an already-active ticket returns a manifest naming the new path and branch, with the original ports and database intact.

---

### #255: An expired session shows an empty state instead of sending the user to sign in

**Milestone:** M3 | **Priority:** P2 Medium | **Status:** Backlog | **Capabilities:** `core` `auth`
**Blocked by:** None

Found 2026-08-29 while writing #76's tests, which now pin the behaviour as it is.

`getOwnConversations` (`apps/web/src/lib/messaging-data.ts`) and `getOwnBookingRequests`
(`apps/web/src/lib/vendor-requests.ts`) catch **every** read failure and return `[]`. That is
right for a 500 or an unreachable API — the screen's empty state is a designed surface and
the live stream refills it. It is wrong for a **401**: the session has expired, and the user
is told _No conversations yet_ when the app simply could not read them.

`apps/web/src/lib/customer-data.ts` already gets this right — it special-cases 401 into a
sign-in redirect before degrading. These two modules do not, and the inconsistency is the
defect. Observed live during #76's browser pass: `/messages` rendered "No conversations yet"
for a caller whose session had lapsed.

Not fixed in #76 because changing a designed empty state is a different question from
carrying a destination, and #76's scope was the destination.

**Acceptance:**

- [ ] A 401 from `/conversations`, `/notifications` and the vendor `/booking-requests` read
      redirects to sign-in carrying the current path, exactly as `customer-data.ts` does
- [ ] A 500, a schema drift and an unreachable API still degrade to the designed empty state
- [ ] A 403 still reaches `/suspended`

**Tests (required):**

- [ ] Flip the two `leaves %s showing its empty state instead of redirecting` assertions in
      `apps/web/src/lib/data-auth-redirect.test.ts` into the `REDIRECTS_ON_401` table
- [ ] A test asserting a 500 still returns `[]`, so the fix does not turn every outage into a
      forced sign-out

---

## Post-MVP Backlog

**Nothing here is a missing piece of the MVP.** Each was considered and deferred, and
each carries the condition that unblocks it. Source of truth is
`design/design-plan/98-post-mvp.md` plus the `## Post-MVP` section of each screen file.
**No MVP ticket may implement any of this.** Do not build it behind a flag, do not stub
it, do not leave a half-built surface — a deferred feature is absent, not hidden.

These are not tickets. They become tickets when their unblock condition is met.

### P1 — blocked on real volume

| Item | Was cut from | Unblock condition |
| --- | --- | --- |
| Vendor-count badge on the landing hero, scoped to the visitor's city | #6c / frame `01` | **~25+ live vendors** in the category and city being displayed |
| Category-card counts and from-prices, computed per city | #6c / frame `01` | same |
| Landing stats band (events booked · average rating · median reply) | #6c / frame `01` | same |
| Sign-up marketing panel stats + the public stats endpoint that feeds them | #24 / frame `12` | same. Keep at least one mechanism line even then — it outperforms a number for a first-time visitor |
| Counts on the confirmation cross-sell chips | #10 / frame `06` | same |
| "People who booked X also booked" pairing framing | #10 / frame `06` | enough completed multi-vendor events to see real pairings |
| Event templates / suggested-category rows | #22b / frame `07` | same — until then it is guesswork dressed as guidance |
| Availability "Market note" panel ("Saturdays are 80% booked across Austin") | #4 / frame `11` | real market data. Until then omit it, or state only this vendor's own numbers |
| Benchmark comparisons on the vendor dashboard ("vendors like you reply in 3h") | #22a / frame `08` | a cohort to compare against |

**The rule that outlives all of these:** every number on a public page is read from the
database at request time, or it does not ship. A hardcoded stat is a liability — it goes
stale silently and it is a lie the moment it does.

### P1 — blocked on a decision, not on data

| Item | Note |
| --- | --- |
| Reply-time ranking | Screen `16` says "keep it under 4h to stay ranked", which implies a ranking signal. **The signal must exist before that copy ships** — either build it or soften the line to a plain nudge. Tracked as open question #2. This one blocks a line of copy already in an MVP ticket, so resolve it during #22a |

### P2 — product scope

- **Multi-vendor booking** — one request to several vendors at once. The hub's month grouping is the seed of it; revisit once request→quote→pay is proven.
- **Events as a real entity** — a named container with a date, venue and guest count, its own page at `/events/[id]`, and bookings filed into it. **Cut on 2026-08-27**; `/bookings` groups by month derived from the booking date instead, and occasion and venue are plain fields on the booking. **Unblock:** enough customers with multiple bookings on the same date that month grouping stops being sufficient. Month grouping stays the default view even after events ship.
- **Free-text and semantic search** — a text query over profile copy ("someone who shoots on film"), as an *additional* entry point beside the three pickers, never replacing them. **Unblock:** enough profile copy to index. Name search already exists as the referral-case link.
- **Shared events** — co-planners on one event, with roles.
- **Budget tracking** across an event's bookings.
- **Saved event details** pre-filling every subsequent request for the same event.
- **Vendor discovery beyond search** — recommendations, "similar vendors", a personalised home feed. All need behavioural data; in MVP, the category-first query plus the Refine bar is the whole discovery surface.
- **"Similar vendors" strip** on the vendor profile and on an empty search result.
- **Saved searches** and email alerts for a date + category. **Map view** alongside the search grid.

### P2 — surface depth

- Checkout: deposit + balance split payments, saved payment methods, instalment plans.
- Messaging: canned replies, read receipts, non-image attachments, vendor-to-vendor referrals.
- Availability: recurring blocks, two-way calendar sync, demand-based pricing suggestions.
- Editor: AI-assisted bio drafting, portfolio bulk upload with auto-crop, package duplication, completeness scoring beyond the binary publish gate.
- Vendor dashboard: earnings trend chart, payout history, calendar sync.
- Profile: video in the portfolio lightbox, vendor response to a review.
- Confirmation: add-to-calendar, shareable event summary.
- Admin: cohort and retention analytics, automated flag triage, vendor quality scoring, bulk messaging to vendor segments.
- Landing: city picker in the hero, once there is more than one live market.

### Deferred from the states design (`40-states.md` § Not built yet)

- **Upload failure detail view** — a per-file diagnostic screen beyond the inline row reason.
- **Partial-refund dispute flow.**
- **Vendor-side payout failure.**

All three follow the same rules when they land: name the cause, state the money position, say whether the date survived, offer one action.

### Deferred platform work

- **Dark mode.** The warm cream identity is the brand; a true inversion is post-MVP.
- **Vendor-doesn't-reply path** — open question #1, and the one I would resolve *inside* MVP. The 48-hour expiry is specified but the customer-side experience is not designed, and it is the most common failure path in a two-sided marketplace.

### #239: Vendor profile tabs — the focus ring is clipped to a 1px sliver by `overflow-x-auto`

**Milestone:** M3 | **Priority:** P1 High | **Status:** Backlog | **Capabilities:** `core`
**Blocked by:** None

Found 2026-08-29 by the final `parity-checker` pass over frame `03 Vendor profile`,
run at the end of the #103-#116 parity lane. **Not caused by that lane** — none of
those fourteen tickets touches `profile-tabs.tsx`. It surfaced because the parity
gate covers the Access axis, and no other checker looks at ring clipping.

**Axis: Access**

| | Value |
| --- | --- |
| **Expected** (`04-laws.md`) | the focus ring visible on all four sides — `ring-2 ring-clay-400/30 ring-offset-2 ring-offset-stone-50`, 4px beyond the control |
| **Observed** (live, 1440x900) | **0.00px above and 1.00px below** on all five tabs, and 0.00px to the left of `About` |

The ring itself is correct. Every tab computes
`box-shadow: rgb(248,245,239) 0 0 0 2px, oklab(0.560981 0.100727 0.0885573 / 0.3) 0 0 0 4px`,
which is the law's token exactly. What removes it is the container: the
`[role="tablist"]` in `apps/web/src/components/vendors/profile/profile-tabs.tsx`
carries `overflow-x-auto`, and setting `overflow-x` to anything but `visible`
forces `overflow-y` to compute `auto` rather than `visible`. The ring is drawn
and then clipped away.

**Nothing is actually scrolling at 1440** — `scrollWidth === clientWidth === 952`.
The scroller exists for the <=390px case that file's own comment documents, so
the clip is pure collateral at desktop widths.

A keyboard user tabbing through the profile sees a 1px sliver where the law
requires a 4px ring. This is silent: it fails no unit test, and a screenshot
looks correct until something has focus.

**Acceptance:**

- [ ] Every tab shows the full ring on all four sides at 1440, read from the DOM
- [ ] The <=390px horizontal scroll the container exists for still works
- [ ] `parity-checker` reports **MATCH** on the **Access** axis for frame `03 Vendor profile`
- [ ] No other element on the screen regresses on any of the six axes

**Test (required):**

- [ ] a test that focuses each tab and asserts the ring is not clipped by an
      ancestor — compare the ring's painted extent against the container's
      client box, so the assertion fails if `overflow` is reintroduced.


---

### #262: 11 Availability — The calendar has no `completed` cell state

**Milestone:** M3 | **Priority:** P1 High | **Status:** Backlog | **Capabilities:** `core`
**Blocked by:** None

Filed by lane 153 during the frame `11 Availability` re-run on 2026-08-29. The
frame was rendered **in situ** from the whole `Orla - Screens.dc.html` at
1440x900 with `document.fonts.ready` awaited and read off the
`[data-screen-label="11 Availability"]` node; the live screen was measured in the
same browser at the same viewport. Every number below is from computed styles on
both sides, never from a screenshot.

Frame `11 Availability` and `19-availability.md` both specify `completed` as an **MVP** state: `sage-50` fill, `sage-600` numeral, a **check glyph**, `padding:5px 0 10px`, and clickable — it opens the past booking. `AvailabilityStatus` has four members and `completed` is not one. So the cell state, its legend row (`Completed · check`), its `This quarter` row (`Completed` / `2 events`) and the instruction clause `and completed events stay on the calendar — click one to open it.` are all absent. Nothing in the Post-MVP section defers it. **Blocks the Text axis closing on #163**, which deliberately stopped short of the frame's full instruction rather than promise behaviour that does not exist

**Acceptance:**

- [ ] The live element matches the frame value above, read from the DOM rather than judged from a screenshot
- [ ] `parity-checker` reports **MATCH** on the affected axis for frame `11 Availability`
- [ ] No other element on the screen regresses on any of the six axes as a result

**Test (required):**

- [ ] a parity assertion reading the expected value out of `Orla - Screens.dc.html` at test time rather than duplicating it into the test

---

### #263: 11 Availability — The legend renders flat colour chips, not the actual marks

**Milestone:** M3 | **Priority:** P1 High | **Status:** Backlog | **Capabilities:** `core`
**Blocked by:** None

Filed by lane 153 during the frame `11 Availability` re-run on 2026-08-29. The
frame was rendered **in situ** from the whole `Orla - Screens.dc.html` at
1440x900 with `document.fonts.ready` awaited and read off the
`[data-screen-label="11 Availability"]` node; the live screen was measured in the
same browser at the same viewport. Every number below is from computed styles on
both sides, never from a screenshot.

Frame draws each legend swatch **22x22, radius 6px**, containing the numeral at 10px/600 in that state's own text colour, plus the real mark — dot, dashed border, hatch + strikethrough, check. Live draws **18x18, radius 5px**, empty and `aria-hidden`, and **5 rows where the frame has 7**. Labels also drop the frame's qualifier suffixes (`Available — no mark`, `Booked — locked · dot`). `19-availability.md`: *"The legend renders the actual marks, not plain colour chips. A legend of flat swatches is the one place the distinction would be invisible."* Pairs with #166

**Acceptance:**

- [ ] The live element matches the frame value above, read from the DOM rather than judged from a screenshot
- [ ] `parity-checker` reports **MATCH** on the affected axis for frame `11 Availability`
- [ ] No other element on the screen regresses on any of the six axes as a result

**Test (required):**

- [ ] a parity assertion reading the expected value out of `Orla - Screens.dc.html` at test time rather than duplicating it into the test

---

### #264: 11 Availability — `Today` is a clay ring where the frame draws an ink border

**Milestone:** M3 | **Priority:** P2 Medium | **Status:** Backlog | **Capabilities:** `core`
**Blocked by:** None

Filed by lane 153 during the frame `11 Availability` re-run on 2026-08-29. The
frame was rendered **in situ** from the whole `Orla - Screens.dc.html` at
1440x900 with `document.fonts.ready` awaited and read off the
`[data-screen-label="11 Availability"]` node; the live screen was measured in the
same browser at the same viewport. Every number below is from computed styles on
both sides, never from a screenshot.

Frame and the plan's revised state table both draw today as **`1.5px solid #23201C`** on the cell, `font-weight:600`, `padding:5.5px 0`. Live uses `ring-2 ring-clay-400` at weight 400 — an outward ring in the *selecting* colour, so today and an in-progress drag share a colour family. **`19-availability.md` contradicts itself here**: its prose says a `clay-400` ring while its revised table says the ink border. The frame agrees with the table, so the prose is the line to correct

**Acceptance:**

- [ ] The live element matches the frame value above, read from the DOM rather than judged from a screenshot
- [ ] `parity-checker` reports **MATCH** on the affected axis for frame `11 Availability`
- [ ] No other element on the screen regresses on any of the six axes as a result

**Test (required):**

- [ ] a parity assertion reading the expected value out of `Orla - Screens.dc.html` at test time rather than duplicating it into the test

---

### #265: 11 Availability — Month range and quarter rows render 13.5px against the frame's 13px

**Milestone:** M3 | **Priority:** P2 Medium | **Status:** Backlog | **Capabilities:** `core`
**Blocked by:** None

Filed by lane 153 during the frame `11 Availability` re-run on 2026-08-29. The
frame was rendered **in situ** from the whole `Orla - Screens.dc.html` at
1440x900 with `document.fonts.ready` awaited and read off the
`[data-screen-label="11 Availability"]` node; the live screen was measured in the
same browser at the same viewport. Every number below is from computed styles on
both sides, never from a screenshot.

Frame sets the month-nav row and the `This quarter` rows at **13px**; live uses `text-base` (`--text-base: 13.5px`). `--text-action: 13px` already exists in the scale and carries `line-height: normal`, so this is a token swap. Axis **Font**

**Acceptance:**

- [ ] The live element matches the frame value above, read from the DOM rather than judged from a screenshot
- [ ] `parity-checker` reports **MATCH** on the affected axis for frame `11 Availability`
- [ ] No other element on the screen regresses on any of the six axes as a result

**Test (required):**

- [ ] a parity assertion reading the expected value out of `Orla - Screens.dc.html` at test time rather than duplicating it into the test

---

### #266: 11 Availability — Helper line and market note inherit a 1.5 line-height

**Milestone:** M3 | **Priority:** P2 Medium | **Status:** Backlog | **Capabilities:** `core`
**Blocked by:** None

Filed by lane 153 during the frame `11 Availability` re-run on 2026-08-29. The
frame was rendered **in situ** from the whole `Orla - Screens.dc.html` at
1440x900 with `document.fonts.ready` awaited and read off the
`[data-screen-label="11 Availability"]` node; the live screen was measured in the
same browser at the same viewport. Every number below is from computed styles on
both sides, never from a screenshot.

Frame helper line is `line-height: normal` (16px); live renders **20.25px** from `leading-normal`. Frame market note is 1.55 (19.375px); live is `leading-relaxed`, 1.625 (**20.3125px**). Separate from **#235**: the month heading (27px vs 24px) and the selected range (30px vs 26px) are loose for #235's reason — arbitrary `text-[18px]` / `text-[20px]` emit no line-height — but these two are explicit leading utilities that simply do not match the frame. Axis **Font**

**Acceptance:**

- [ ] The live element matches the frame value above, read from the DOM rather than judged from a screenshot
- [ ] `parity-checker` reports **MATCH** on the affected axis for frame `11 Availability`
- [ ] No other element on the screen regresses on any of the six axes as a result

**Test (required):**

- [ ] a parity assertion reading the expected value out of `Orla - Screens.dc.html` at test time rather than duplicating it into the test

---

### #267: 11 Availability — Focus ring is clipped on controls flush with the pane edge

**Milestone:** M3 | **Priority:** P1 High | **Status:** Backlog | **Capabilities:** `core`
**Blocked by:** None

Filed by lane 153 during the frame `11 Availability` re-run on 2026-08-29. The
frame was rendered **in situ** from the whole `Orla - Screens.dc.html` at
1440x900 with `document.fonts.ready` awaited and read off the
`[data-screen-label="11 Availability"]` node; the live screen was measured in the
same browser at the same viewport. Every number below is from computed styles on
both sides, never from a screenshot.

Both panes are `overflow: auto` (`section.app-pane` at `y:86`, `aside.app-pane` at `y:86`). A control whose box sits flush with the top edge has its **outward 4px focus ring clipped**. Pixel-sampled from a screenshot with the control focused: ring absent 3px above, present 3px below/left/right. The ring token itself computes correctly everywhere — this is the failure mode `04-laws.md` warns about, where it computes right and renders invisible. The frame specifies `overflow: hidden` on the rail, and **neither pane needs to scroll** (`scrollHeight === clientHeight` on both), so `overflow:auto` is buying nothing. Same class as ledger finding `P1-3`. #157 removed the two controls that were sitting on the edge, so the hazard is currently latent rather than firing — fix the container, not just the symptom. Axis **Access**

**Acceptance:**

- [ ] The live element matches the frame value above, read from the DOM rather than judged from a screenshot
- [ ] `parity-checker` reports **MATCH** on the affected axis for frame `11 Availability`
- [ ] No other element on the screen regresses on any of the six axes as a result

**Test (required):**

- [ ] a parity assertion reading the expected value out of `Orla - Screens.dc.html` at test time rather than duplicating it into the test

---

### #268: 11 Availability — Weekday headers announce as blank and the month tables are unnamed

**Milestone:** M3 | **Priority:** P2 Medium | **Status:** Backlog | **Capabilities:** `core`
**Blocked by:** None

Filed by lane 153 during the frame `11 Availability` re-run on 2026-08-29. The
frame was rendered **in situ** from the whole `Orla - Screens.dc.html` at
1440x900 with `document.fonts.ready` awaited and read off the
`[data-screen-label="11 Availability"]` node; the live screen was measured in the
same browser at the same viewport. Every number below is from computed styles on
both sides, never from a screenshot.

Each weekday header is `<th scope="col"><span aria-hidden="true">S</span></th>` — the only content is hidden from assistive technology and nothing replaces it, so all seven `columnheader`s have an **empty accessible name** and the `scope="col"` association conveys nothing. Separately, all three `<table>`s have no `<caption>`, `aria-label` or `role`, so three sibling grids of bare numerals give no way to tell which month you are in. The frame uses plain spans in a CSS grid and has no table semantics to satisfy; if the table stays, the headers need real names. Axis **Access**

**Acceptance:**

- [ ] The live element matches the frame value above, read from the DOM rather than judged from a screenshot
- [ ] `parity-checker` reports **MATCH** on the affected axis for frame `11 Availability`
- [ ] No other element on the screen regresses on any of the six axes as a result

**Test (required):**

- [ ] a parity assertion reading the expected value out of `Orla - Screens.dc.html` at test time rather than duplicating it into the test

---

### #269: 11 Availability — Day grid uses `border-spacing`, adding an outer gutter the frame has not

**Milestone:** M3 | **Priority:** P2 Medium | **Status:** Backlog | **Capabilities:** `core`
**Blocked by:** None

Filed by lane 153 during the frame `11 Availability` re-run on 2026-08-29. The
frame was rendered **in situ** from the whole `Orla - Screens.dc.html` at
1440x900 with `document.fonts.ready` awaited and read off the
`[data-screen-label="11 Availability"]` node; the live screen was measured in the
same browser at the same viewport. Every number below is from computed styles on
both sides, never from a screenshot.

Frame draws the day grid as a CSS grid with `gap:4px` and **no outer gutter**, cell width **32.09px**. Live uses a `<table>` with `border-spacing:4px`, which also applies *outside* the edge cells — insetting the grid 4px on all sides and narrowing every cell to **31.03px**. Separately the frame draws adjacent-month numerals (June shows `31` in `stone-500`, no background) where live renders empty `<td>`s in every month. Axis **Layout**

**Acceptance:**

- [ ] The live element matches the frame value above, read from the DOM rather than judged from a screenshot
- [ ] `parity-checker` reports **MATCH** on the affected axis for frame `11 Availability`
- [ ] No other element on the screen regresses on any of the six axes as a result

**Test (required):**

- [ ] a parity assertion reading the expected value out of `Orla - Screens.dc.html` at test time rather than duplicating it into the test

---

### #270: 11 Availability — The rail fill starts 22px below the header

**Milestone:** M3 | **Priority:** P2 Medium | **Status:** Backlog | **Capabilities:** `core`
**Blocked by:** None

Filed by lane 153 during the frame `11 Availability` re-run on 2026-08-29. The
frame was rendered **in situ** from the whole `Orla - Screens.dc.html` at
1440x900 with `document.fonts.ready` awaited and read off the
`[data-screen-label="11 Availability"]` node; the live screen was measured in the
same browser at the same viewport. Every number below is from computed styles on
both sides, never from a screenshot.

Frame's rail box begins flush with the header (`y:66`), so its cream fill and 1px left border run the full height of the shell. Live begins at `y:86` — `pt-5.5` on the page wrapper leaves a **22px stone-50 band** above the rail, so both the fill and the border stop short of the header. Axis **Layout**

**Acceptance:**

- [ ] The live element matches the frame value above, read from the DOM rather than judged from a screenshot
- [ ] `parity-checker` reports **MATCH** on the affected axis for frame `11 Availability`
- [ ] No other element on the screen regresses on any of the six axes as a result

**Test (required):**

- [ ] a parity assertion reading the expected value out of `Orla - Screens.dc.html` at test time rather than duplicating it into the test

---

### #271: 11 Availability — Past day cells have no fill

**Milestone:** M3 | **Priority:** P2 Medium | **Status:** Backlog | **Capabilities:** `core`
**Blocked by:** None

Filed by lane 153 during the frame `11 Availability` re-run on 2026-08-29. The
frame was rendered **in situ** from the whole `Orla - Screens.dc.html` at
1440x900 with `document.fonts.ready` awaited and read off the
`[data-screen-label="11 Availability"]` node; the live screen was measured in the
same browser at the same viewport. Every number below is from computed styles on
both sides, never from a screenshot.

Frame draws a past date as `background:#F8F5EF` with `border-radius:7px`. Live `PAST_STYLE` sets only `cursor-not-allowed text-stone-500`, so `backgroundColor` computes `rgba(0,0,0,0)` and past days sit as bare text on the page ground rather than as filled inert cells. Axis **Style**

**Acceptance:**

- [ ] The live element matches the frame value above, read from the DOM rather than judged from a screenshot
- [ ] `parity-checker` reports **MATCH** on the affected axis for frame `11 Availability`
- [ ] No other element on the screen regresses on any of the six axes as a result

**Test (required):**

- [ ] a parity assertion reading the expected value out of `Orla - Screens.dc.html` at test time rather than duplicating it into the test

---

### #272: 11 Availability — `Clear` padding and radius differ from the frame

**Milestone:** M3 | **Priority:** P2 Medium | **Status:** Backlog | **Capabilities:** `core`
**Blocked by:** None

Filed by lane 153 during the frame `11 Availability` re-run on 2026-08-29. The
frame was rendered **in situ** from the whole `Orla - Screens.dc.html` at
1440x900 with `document.fonts.ready` awaited and read off the
`[data-screen-label="11 Availability"]` node; the live screen was measured in the
same browser at the same viewport. Every number below is from computed styles on
both sides, never from a screenshot.

Frame draws `Clear` at `padding:8px 6px` with no radius and no background. Live renders `6px 12px` with `rounded-lg`, from Button `size="sm"`. The **colour** half of this control was closed by #158; this is the remaining Style half, split out rather than folded into a Colour ticket. Axis **Style**

**Acceptance:**

- [ ] The live element matches the frame value above, read from the DOM rather than judged from a screenshot
- [ ] `parity-checker` reports **MATCH** on the affected axis for frame `11 Availability`
- [ ] No other element on the screen regresses on any of the six axes as a result

**Test (required):**

- [ ] a parity assertion reading the expected value out of `Orla - Screens.dc.html` at test time rather than duplicating it into the test

---

### #273: 11 Availability — `Block these` carries a shadow and border the frame does not draw

**Milestone:** M3 | **Priority:** P3 Low | **Status:** Backlog | **Capabilities:** `core`
**Blocked by:** None

Filed by lane 153 during the frame `11 Availability` re-run on 2026-08-29. The
frame was rendered **in situ** from the whole `Orla - Screens.dc.html` at
1440x900 with `document.fonts.ready` awaited and read off the
`[data-screen-label="11 Availability"]` node; the live screen was measured in the
same browser at the same viewport. Every number below is from computed styles on
both sides, never from a screenshot.

The `primary` variant adds `shadow-sm` (`rgba(35,32,28,.06) 0 2px 10px`) and the Button base adds `border border-transparent` (1px on every side). The frame draws a flat span with neither. Deliberately **not** folded into #156, which was scoped to padding: `03-components.md` may intend the shadow on every primary button, in which case the frame is the thing to reconcile rather than this call site. Axis **Style**

**Acceptance:**

- [ ] The live element matches the frame value above, read from the DOM rather than judged from a screenshot
- [ ] `parity-checker` reports **MATCH** on the affected axis for frame `11 Availability`
- [ ] No other element on the screen regresses on any of the six axes as a result

**Test (required):**

- [ ] a parity assertion reading the expected value out of `Orla - Screens.dc.html` at test time rather than duplicating it into the test

---

### #274: 11 Availability — Two rail strings are in neither the frame nor the voice guide

**Milestone:** M3 | **Priority:** P2 Medium | **Status:** Backlog | **Capabilities:** `core`
**Blocked by:** None

Filed by lane 153 during the frame `11 Availability` re-run on 2026-08-29. The
frame was rendered **in situ** from the whole `Orla - Screens.dc.html` at
1440x900 with `document.fonts.ready` awaited and read off the
`[data-screen-label="11 Availability"]` node; the live screen was measured in the
same browser at the same viewport. Every number below is from computed styles on
both sides, never from a screenshot.

`No dates selected yet.` — added by **#163** to replace a rail instruction that contradicted the pane — and `Open these up`, the primary label when the selection is already blocked. Neither appears in frame `11 Availability` nor in `31-content-voice.md`. The frame draws no empty state and no blocked-selection state, so it cannot settle either. Both need approving into the voice guide or replacing with approved copy. Axis **Text**

**Acceptance:**

- [ ] The live element matches the frame value above, read from the DOM rather than judged from a screenshot
- [ ] `parity-checker` reports **MATCH** on the affected axis for frame `11 Availability`
- [ ] No other element on the screen regresses on any of the six axes as a result

**Test (required):**

- [ ] a parity assertion reading the expected value out of `Orla - Screens.dc.html` at test time rather than duplicating it into the test

---

### #275: [DESIGN] Frame `11 Availability` draws a designer's rationale note that should not ship

**Milestone:** M3 | **Priority:** P2 Medium | **Status:** Backlog | **Capabilities:** `core`
**Blocked by:** None

Filed by lane 153 during the frame `11 Availability` re-run on 2026-08-29. The
frame was rendered **in situ** from the whole `Orla - Screens.dc.html` at
1440x900 with `document.fonts.ready` awaited and read off the
`[data-screen-label="11 Availability"]` node; the live screen was measured in the
same browser at the same viewport. Every number below is from computed styles on
both sides, never from a screenshot.

The frame's rail draws, as styled UI: *"Every state carries a shape as well as a colour, so the calendar still reads in greyscale and for colour-blind vendors. Fill alone is never the signal."* That is process commentary explaining change order **A1** to a reader of the design, not copy addressed to a vendor using the product. **QUESTION — do not build until answered:** confirm it is an annotation and is excluded from the build. Filed rather than silently ignored, because a parity pass otherwise reports it as a missing element on every future run. **#166 is the ticket that implements what the sentence describes**

**Acceptance:**

- [ ] The live element matches the frame value above, read from the DOM rather than judged from a screenshot
- [ ] `parity-checker` reports **MATCH** on the affected axis for frame `11 Availability`
- [ ] No other element on the screen regresses on any of the six axes as a result

**Test (required):**

- [ ] a parity assertion reading the expected value out of `Orla - Screens.dc.html` at test time rather than duplicating it into the test

---

### #276: [DESIGN] `19-availability.md` says "no month navigation" twice while the frame draws it

**Milestone:** M3 | **Priority:** P2 Medium | **Status:** Backlog | **Capabilities:** `core`
**Blocked by:** None

Filed by lane 153 during the frame `11 Availability` re-run on 2026-08-29. The
frame was rendered **in situ** from the whole `Orla - Screens.dc.html` at
1440x900 with `document.fonts.ready` awaited and read off the
`[data-screen-label="11 Availability"]` node; the live screen was measured in the
same browser at the same viewport. Every number below is from computed styles on
both sides, never from a screenshot.

The plan says *"three months across ... which covers a typical booking horizon **with no month navigation**"* and repeats it in its own acceptance checklist (*"Three months visible at 1440 with no month navigation"*). Frame `11 Availability` draws `‹ June — August 2026 ›`, and the app implements paging. **#157** built the frame's glyphs under the standing rule *"where the two disagree, build the frame and correct the plan"*. The plan is the half still to correct, by whoever owns it — tickets write code, design passes edit the plan

**Acceptance:**

- [ ] The live element matches the frame value above, read from the DOM rather than judged from a screenshot
- [ ] `parity-checker` reports **MATCH** on the affected axis for frame `11 Availability`
- [ ] No other element on the screen regresses on any of the six axes as a result

**Test (required):**

- [ ] a parity assertion reading the expected value out of `Orla - Screens.dc.html` at test time rather than duplicating it into the test

---

### #277: The frames use a 12px radius 69 times and the radius scale has no 12px step

**Milestone:** M3 | **Priority:** P2 Medium | **Status:** Backlog | **Capabilities:** `core`
**Blocked by:** None

Filed by lane 153 during the frame `11 Availability` re-run on 2026-08-29. The
frame was rendered **in situ** from the whole `Orla - Screens.dc.html` at
1440x900 with `document.fonts.ready` awaited and read off the
`[data-screen-label="11 Availability"]` node; the live screen was measured in the
same browser at the same viewport. Every number below is from computed styles on
both sides, never from a screenshot.

`--radius-*` is 6 / 8 / 10 / 14 / 18. **12px is the second most common radius in the frame bundle — 69 uses, against 50 for 14px** — and has no token, so #154 and #155 both had to reach for `rounded-[12px]`. Either the scale is missing a step or those 69 frame uses should be 14px; that is a foundations decision, not a per-screen one. Note the *type* scale has no such gap: `--text-meta: 12px` already exists and #159 used it

**Acceptance:**

- [ ] The live element matches the frame value above, read from the DOM rather than judged from a screenshot
- [ ] `parity-checker` reports **MATCH** on the affected axis for frame `11 Availability`
- [ ] No other element on the screen regresses on any of the six axes as a result

**Test (required):**

- [ ] a parity assertion reading the expected value out of `Orla - Screens.dc.html` at test time rather than duplicating it into the test

---

### #293: `nearby-availability` builds its dates in UTC while the route reads server-local time

**Milestone:** M3 | **Priority:** P2 Medium | **Status:** Backlog | **Capabilities:** `core`
**Blocked by:** None

Found 2026-08-29 by lane 170 while running the API suite for #170. **Not caused by that
diff** — reproduced on a clean tree with `git stash`, 1 failed / 403 passed.

| | |
| --- | --- |
| **Expected** | `pnpm --filter @vendor-marketplace/api test` is green on `main` at any hour, in any timezone |
| **Observed** | `src/modules/vendors/nearby-availability.routes.test.ts > "never suggests a past date when the wanted date is today"` fails with `expected '2026-08-29' to be '2026-08-31'`, but **only between 20:00 and 00:00 EDT** — the window where the local date and the UTC date disagree |

**Cause.** The test's `dayFromToday()` helper (line 17) builds dates with
`new Date().toISOString().slice(0, 10)`, which is **UTC**. The route computes "today" in
**server-local** time. At 22:00 EDT the two differ by a day, so the test asks for
availability from the UTC tomorrow and asserts against a UTC-derived expectation while the
route answers from the local today. CI runs in UTC, so the two agree there and `main` stays
green — the failure is invisible to CI and reproducible only on a developer machine west of
Greenwich in the evening.

**Which side is wrong is the product question this ticket has to settle**, and it is not
merely a test bug: a marketplace that decides whether a date is in the past using the API
server's local clock will give a different answer depending on where the process runs. The
likely correct fix is that the route resolves "today" in an explicit timezone rather than
the server's, and the test then shares that definition.

**Acceptance:**

- [ ] "Today" is resolved from an explicit, stated timezone rather than the server's local clock
- [ ] The test derives its expectations from the same definition the route uses
- [ ] The suite is green at any hour — proven by running it with `TZ` set to a zone behind and a zone ahead of UTC, not by waiting for the clock

**Tests (required):**

- [ ] Run the affected test under at least `TZ=America/Los_Angeles`, `TZ=UTC` and `TZ=Pacific/Kiritimati`, asserting the same result in each. This is the dimension the current test has no coverage of, and the reason CI cannot see the defect.

---

### #278: [DESIGN] The frame's blocked hatch puts text on a band that fails AA

**Milestone:** M3 | **Priority:** P3 Low | **Status:** Backlog | **Capabilities:** `core`
**Blocked by:** None

Filed by lane 153 during the frame `11 Availability` re-run on 2026-08-29. The
frame was rendered **in situ** from the whole `Orla - Screens.dc.html` at
1440x900 with `document.fonts.ready` awaited and read off the
`[data-screen-label="11 Availability"]` node; the live screen was measured in the
same browser at the same viewport. Every number below is from computed styles on
both sides, never from a screenshot.

The blocked cell's hatch alternates `#EFE9E0` / `#E0D8CA` every 3px under `#6B6459` text. Against the dark band alone that is **4.13:1**, below AA. Over the alternation the perceived ground is roughly `#E7E0D5`, which clears, so the frame reads acceptably — but a verbatim implementation puts glyph strokes directly on the failing band. Worth resolving against `19-availability.md` before **#166** builds the hatch, rather than after

**Acceptance:**

- [ ] The live element matches the frame value above, read from the DOM rather than judged from a screenshot
- [ ] `parity-checker` reports **MATCH** on the affected axis for frame `11 Availability`
- [ ] No other element on the screen regresses on any of the six axes as a result

**Test (required):**

- [ ] a parity assertion reading the expected value out of `Orla - Screens.dc.html` at test time rather than duplicating it into the test

---
