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

`Closed — Superseded` is a fourth terminal value, added 2026-08-29 as `Superseded` and renamed 2026-08-31 so the board never has to be read twice to see that nobody is working it. It means the ticket's work now lives in another ticket, named in its Notes. The row and its detail section are kept whole in the archive — they carry the measurements and the reasoning the replacement was built from, and `tickets.ts` keeps its registry row so `pnpm preflight --ticket <old number>` still gates correctly for anyone working from an older branch or commit message. **A `Superseded` ticket is never worked directly.**

**Closed rows live in `.claude/plans/vendor-marketplace-tickets-archive.md`.** Moved there on 2026-08-30, when this file had reached 13,500 lines and 311 of its 334 rows were finished work — whole, not summarised, rows and detail sections together. This board carries open work only. When a Notes cell names a ticket that is not here, it is there.

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

## Beta gate — what blocks shipping to real users

> ## The one-line answer, corrected 2026-08-30
>
> **#9 and #10 have landed, and the paragraph that stood here was stale.** It said the
> product could not transact — that `POST /booking-requests/:id/accept` returned a 402 with
> no payout setup behind it, and that there was "no Stripe onboarding route, link or
> `accountLink` anywhere in the tree." That was true when it was written on 2026-08-29 and
> false by the time anyone read it. Verified in the tree on 2026-08-30:
> `stripe.v2.core.accountLinks.create` at `apps/api/src/lib/stripe.ts:284`,
> `POST /vendor/stripe/connect` with its own route tests, `/vendor/payments` and
> `/vendor/payments/return` as pages, and `/bookings/[requestId]/checkout` as a route.
>
> **The 402 is still there and is now correct**
> (`booking-requests.service.ts:723`): it gates a vendor who has not finished onboarding,
> and onboarding now exists for them to finish. That is a working guard, not a dead end.
>
> **Read the Status Board, not this section, for what blocks a beta.** Nothing here is a
> transaction blocker any more. What remains is parity, chrome, tooling and one human
> sitting at four provider consoles (**#362**). This block is kept rather than deleted
> because the lesson is the durable part: **a "verified" claim at the top of a tracker is
> the first thing to go stale and the last thing anyone re-checks.** It was read by every
> session that opened this file for a day after it stopped being true.


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
| **362** | **[PLATFORM] External-account provisioning — one dashboard session** | INFRA | M-OPS | **P0 Critical** | **Deferred — needs a human** | — | **The account holder — every item is a provider-console action** | all | **Filed 2026-08-30 by the second backlog consolidation.** Merges **#19, #46 (residual), #62, #206**. Every item is the same actor doing the same kind of thing — signing into a provider console to mint, rename or rotate a value — and **none of it is repository code**. Three of the four already point at each other: #62 calls itself *"a #19 prerequisite"*, #206's Notes say it *"overlaps #19"* and is *"a pointer, not a queue item"*, and #46's remaining scope is one rotation (its code scopes 1 and 2 are Done in `34cd28c`, `ed41aed`). Split, this is four separate asks of one person. The checklist: **rotate `CLERK_WEBHOOK_SECRET`** (leaked to a transcript 2026-08-27 — rotate, deleting is not enough); **rename the Clerk application** to `BRAND_NAME`, which is the source every `{{applicationName}}` key reads; **change the Stripe public business name** from `VendYou`, which renders on Connect onboarding, on Checkout and as the **statement descriptor**; **mint production credentials** in Clerk, Stripe, R2 and Resend, newly minted rather than copied; pooled string on Railway, unpooled on Railway **and** GitHub Actions. **Supplying `SENTRY_DSN` belongs here too and unblocks #353.** The Neon Launch upgrade (#206) stays **launch-gated** in `docs/pre-launch.md` §3.2 and is not current work. |
| **370** | **Production deploy pipeline and error visibility** | P1.5 | M4.5 | **P0 Critical** | **Backlog** | — | **#362** (production credentials and `SENTRY_DSN`) | `core` `sentry` | **Filed 2026-08-31 by the third backlog consolidation.** Merges **#20, #353**. One deliverable: merging to `main` ships — migrations first, both services after, a failed `/ready` poll stops the release — and what it ships reports its own errors somewhere a human reads. Split, the two waited on the same #362 sitting. |
| **374** | **Launch legal, policy and support surfaces** | P3 | M6 | **P0 Critical** | **Deferred — needs a human** | — | **The account holder: (1) the operative wording of the terms, privacy policy and vendor agreement — a ticket must not invent binding text; (2) a real monitored support address or destination** | `core` | **Filed 2026-08-31.** Not a consolidation — a gap nobody had filed. `docs/pre-launch.md` §1.5 and §7 require terms, a privacy policy, a cookie notice, a vendor agreement covering the 12% commission and payout timing, a refund and cancellation policy shown **before** payment, and a support route that reaches a human. **Every one of those surfaces now exists** — #421 built `/support`, #427 built `/terms`, `/privacy`, `/cookies`, the vendor agreement step and the refund schedule above the pay control, and every factual claim in them is checked against the constants by a test. **What is left here is the two things only the account holder can supply**: the operative wording, which ships today as replaceable placeholder in `apps/web/content/legal/*.md` and needs no code change to replace — and the real legal entity, since `/terms` §1 currently names an invented Delaware corporation — plus a monitored destination for `SUPPORT_EMAIL_TO`. |
rendered surface without the neutralisation that surface needs. The first is a
script-injection hole on the most-visited public page in the product. |
predicate, a transaction, or an idempotency key. Two of them move money or sell
a date twice. The sweep reproduced the double-accept against the real harness
(two `/accept` calls fired with `Promise.all`; both answered 200 |
request stays `accepted`, so the next transition on that date re-locks it
permanently; every read that asks "is there a booking for this request" gets a
row back and reports it as paid. The customer sees a booking they cancelle |
request with no price, or one whose event date has already passed, becomes a
terminal `accepted` row; the customer's checkout for it renders the 500 page.
Reproduced end to end by the browser sweep. |
sweep. Its thread loader has no cancellation and no owner check, its draft is
one string for the whole screen, and the API pages from the oldest message —
so a thread with more than 50 messages hides everything newer behind a |
labelled `STARTING RATE` and matches any package in range, so a vendor whose
cheapest package is $400 appears under a $4,000 floor. The rest are the URL's
handling of values it cannot use — some announced, some silent, one sen |
mount, so the date and guest count chosen on the vendor profile rail — or given
in the URL — are silently replaced by whatever was saved earlier. A URL-only
guest count is itself persisted as a 'draft'. |
snapshot is taken from the live form rather than what was sent, and its publish
switch reads unsaved state while toggling the saved row. Around it, the package
form and the portfolio manager both discard edits when their parent r **Done 2026-09-06** — squash `b1b06a2`, PR #120, branch `worktree-t405`. Tags moved onto the profile body and `PUT /vendor/tags` was deleted, so the save is one transactional write; the snapshot is taken from what was sent; publishing waits for a clean form while unpublishing never does. `diff-reviewer` found criterion 7 unmet — the ceiling was still counted through a list that cannot hold a tag approved since page load, which this ticket's own transaction made severe — plus a stuck state where a published vendor who cleared a required field could never re-enable the switch; both fixed. `security-auditor` PASS. Browser 32/32, twice. |
accepts: the API boots on localhost and MinIO, the web bundle bakes
`http://localhost:4000` as its API origin, every stored-key image resolves to
nothing, checkout loads Stripe.js with an empty publishable key, and the Clerk |
serves the vendor's private per-date note, a customer-facing booking read
carries the platform fee, the vendor payout split and the Stripe transfer id,
and any authenticated user can pin another vendor's storage object by na **Landed 2026-09-05 as `ecf08fe` (PR #102, branch `worktree-t407-rebased`).** The public read is a DAO that never selects `note`, and `availabilitySchema` now *extends* `publicAvailabilitySchema` rather than omitting down to it. The four money fields are gone from `bookingSchema` itself, so every route answering it strips them; `booking-view.ts` is the one projection all three call sites use. **The write guard took five review passes and six spellings** — a host in front, a dot segment, a backslash, the bucket path the product itself stores and publishes, and a query string whose slashes a `split('/')` counts but a URL parser drops. It now decides on the object a reference *resolves to*, sharing `normalizeImageRefPath` with `imageRefSchema`; `ownsObjectKey` is deliberately unwidened, proven unchanged over 26,946 keys x 4 owners. A differential of ~132,400 owner-mismatching refs per seed found 0 violations, with the origin's key derivation measured against MinIO's `NoSuchKey` echo rather than assumed. `request-body-image-ref.test.ts` closes the class. **Two residuals, deliberately not done:** the guard is write-time only, so a row that borrowed a foreign key before this still pins its owner's delete (a data cleanup); and R2 is *assumed* to normalise as MinIO does — the same `NoSuchKey` echo makes that a five-minute check. |
column that stores it, so an ordinary input answers 500 after the state has
already moved; and several reads have no limit, one of which fans out an
unbounded `Promise.all` that ends in an email send. |
client, and three server components call it. West of UTC a vendor's current day
renders as already past on the availability calendar and the dashboard's 'This
week'; east of UTC yesterday stays pickable on the booking req |
signed-in role may not see leaves the browser on a blank page with signed-out
chrome, rather than redirecting to somewhere that role can be. A vendor signing
in from a booking request form, a vendor sent to `/customer/profile`,  |
the silent-submit work #388 closed:

- **Portfolio lightbox** (`portfolio-pane.tsx:108-160`) is `role="dialog"
  aria-modal="true"` but nothing focuses it, nothing traps Tab and nothing
  restores focus — a keyboard user t |
storefront, each of which tells the reader something untrue. |
| **431** | **Operations case console: every dispute, however it arrives, and its resolution** | P3 | M6 | **P0 Critical** | **Backlog** | — | **None** | `core` `auth` `stripe` `email` | **Filed 2026-09-07 by the admin-panel investigation.** `PUT /admin/bookings/:bookingId/dispute` is the only way to lift a payout hold and **has no UI whatsoever** — `admin-data.ts` is nine GETs and nothing else, so an operator resolves disputes with curl while the vendor's money sits frozen. The complaint that justifies the hold is never stored: `POST /support/messages` sends one email and keeps no row, so the reason lives in an inbox and the hold lives in `bookings.dispute_reason`, which no admin schema exposes. `charge.dispute.*` is not among the handled Stripe events, so a chargeback never reaches the booking at all. |
| **432** | **Payout health: failed transfers, retries, and why Stripe stopped a vendor** | P3 | M6 | **P0 Critical** | **Backlog** | — | **None** | `core` `auth` `stripe` | **Filed 2026-09-07 by the admin-panel investigation.** `payouts.dao.ts:213` writes `payout_attempts` and `payout_failure_reason` on every failed transfer and **nothing anywhere reads either column** — not admin, not the vendor dashboard. `adminPaymentRowSchema` carries no payout state at all, so a vendor owed money by a transfer that keeps failing generates no signal. `stripe_onboarded` is a boolean with no reason behind it: when Stripe revokes a capability the operator sees only "No payouts yet" in a filter. |
| **435** | **Graduated moderation: unpublish, hide and reinstate without banning** | P3 | M6 | **P1 High** | **Backlog** | — | **None** | `core` `auth` | **Filed 2026-09-07 by the admin-panel investigation.** Ban is the only moderation action and it is nuclear — it declines every open request, cancels and **fully refunds** every confirmed booking, and unpublishes the storefront. There is no lever between "nothing" and that: `vendor_profiles.is_published` has no admin writer, and `reviews.is_public` exists, defaults `true` and is written by **nothing but seed scripts**, so a review can only be permanently deleted. `reviews.service.ts` says so itself — *"there is nowhere to queue to until #15 builds admin"* — and #15 shipped without the queue. |
| **436** | **Reporting and message visibility for trust and safety** | P3 | M6 | **P1 High** | **Backlog** | — | **None** — #434 landed 2026-09-07 (`1f8011a`) | `core` `auth` `email` | **Filed 2026-09-07 by the admin-panel investigation.** Nothing in the product can report anything — no listing report, no message report, no photo report, no user report; grepping report/flag/abuse across the API returns nothing. The only inbound channel is a rate-limited public email form. And `/conversations` is participant-only with no admin read, so a harassment complaint arrives by email naming a thread the operator cannot open. |
| **437** | **Admin detail views, and the entities the console cannot see** | P3 | M6 | **P1 High** | **Backlog** | — | **#435** — the two share six files (`admin.routes.ts`, `admin.service.ts`, `admin.dao.ts`, `vendor-table.tsx`, `admin-data.ts`, `schemas/index.ts`) and this one reads the states #435 writes | `core` `auth` | **Filed 2026-09-07 by the admin-panel investigation.** Seven list screens, zero detail screens, against a design plan that specifies *"detail views: card-based groupings with prominent actions"* (`22-admin.md`). Consequence: `refund_amount_cents`, `cancellation_reason`, `dispute_reason`, `cancelled_by`, `payout_released_at` and `banned_at` appear on no row schema and no screen. Whole entities are absent — `booking_requests` (the entire pre-payment funnel), `service_packages`, `portfolio_items`, `availability`, `notifications`, `categories` — several of which the plan's own authorization matrix (§7) already grants admin. |
| **438** | **Data rights: export, account closure, and the legal acceptance record** | P3 | M6 | **P0 Critical** | **Backlog** | — | **None** — #434 landed 2026-09-07 (`1f8011a`) | `core` `auth` `email` | **Filed 2026-09-07 by the admin-panel investigation.** Neither privacy-policy promise is backed by anything: the text says *"ask us for a copy of what we hold"* and *"to close your account, ask us through Contact support"*, and there is no export endpoint, no admin-initiated deletion, and no screen. Deletion happens only if the user deletes themselves in Clerk. Separately, `legal_acceptances` is the platform's evidence a vendor agreed to the 12% and the 72-hour hold — immutable, IP and UA captured, three DB triggers — and no operator can read it. |
| **439** | **Transactional email delivery is invisible** | P3 | M6 | **P1 High** | **Backlog** | — | **None** | `core` `auth` `email` | **Filed 2026-09-07 by the admin-panel investigation.** Fourteen notification types fire and forget; failures are logged and dropped at `notification-email.ts:200`. The `notifications` table records the in-app bell only — no `sentAt`, no failure reason, no provider id. *"Was the customer actually told their booking was cancelled?"* is unanswerable from the console, from the database, or from anywhere but a log search. |
| **440** | **Operator-initiated refunds and credits** | P3 | M6 | **P1 High** | **Deferred — needs a human** | — | **The account holder: whether an operator may move money outside D3, D31 and D35, and on what authority** | `core` `auth` `stripe` | **Filed 2026-09-07 by the admin-panel investigation.** Money only moves on rails today — ban (full refund), customer cancellation (D3 tiers), dispute resolved for the customer. Partial refund, goodwill credit, fee waiver and correction do not exist, so every off-script case is settled in the Stripe Dashboard, after which the `bookings` row is wrong. **Deferred rather than Backlog because building it decides policy**: D3 fixes the cancellation tiers platform-wide, D31 makes a cancellation a full unwind, D35 fixes the 72-hour hold, and an operator lever is a fourth path none of them contemplates. Needs a decision entry before a line of code. |
| **441** | **The site footer against the newer frame, and the ink-ground text ramp used as a border** | P1 | M3 | **P2 Medium** | **Backlog** | — | **None** | `core` | **Filed 2026-09-07 by #430's parity pass**, which measured the footer against `design/delta-band/Orla-Closing-Band.html` — a frame #428 never saw, so none of this is a regression. **Nine layout, style and font deviations**: inner padding `py-14` (56px) where the frame draws 40px top and bottom; the column grid is four equal quarters where the frame draws `1.5fr 1fr 1fr 1fr` (419/280/280/280), which puts `Browse` at x=390 against the frame's ≈493; gap 40px vs 34px; the footer wordmark at 32px vs 25px, and its logo mark `29x20` with **unequal** circles (20px filled, 22px outer) where the frame draws `26x17` with two equal 17px circles — so `logo.tsx:50`'s comment that `marketingFooter` is *"absent from every frame"* is now stale, this frame draws it twice; `Contact support` renders `#B8AF9F`/400 where the frame singles it out at `#F8F5EF`/600; link columns 13.5px vs 13px; tagline 13.5px/1.6 vs 13px/1.5; micro-labels at 600 weight and .05em vs 500 and .07em. **And the mechanism #430 fixed in the band, in the two places it survives**: the legal row's hairline is `border-stone-0/10` where the frame draws `rgba(248,245,239,.1)` — `stone-50`, the other end of the ramp — and **`admin-header.tsx:64`** sets `text-stone-400` as text on frame `13`'s inverted `#23201C` ground. `stone-400` is a **border** value: it is drawn on a light ground at thirty-nine sites across the frames and as text on ink at none. `stone-480` (`#d8d0c2`) was added to the ink-ground text ramp in `aac9b3b` and is the token both should read. That is the only admin instance, which is why it rides here rather than in #431–#440 — the ramp is the defect, not the surface. **One access finding with no other checker**: the footer logo link is `88x32`, twelve pixels under `04-laws.md`'s 44px minimum; its `aria-label` is present and correct. **Not in scope**: the `Florals` mismatch in the Browse column is the ruled #419 override, and the band itself is done (#430, `aac9b3b`). |
| **442** | **A repeat Terms acceptance can write two permanent rows — rule what the record means, then close the race** | P3 | M6 | **P1 High** | **Backlog** | — | **The account holder: does a second acceptance of a version already held mean one row or two?** | `core` `auth` | **Filed 2026-09-07 from #429's security pass, which found it and deliberately did not close it.** `acceptTerms` reads *"already accepted"* and then inserts, with **no unique index behind the read**, so two submissions from one session can each write a row into a table nothing can delete. The obvious fix — a unique index on `(accepted_by_user_id, document, version)` — **overturns #427's ruling** that a second acceptance of a held version *is* a second row, on the grounds that *"I accepted it twice"* is a true statement about what happened; `legal-acceptance-immutability.test.ts` asserts exactly that today. So the race cannot be closed without first deciding what the record is claiming, which is a product question, not a lane's. The window is small — it closes on the first commit — and rate-limited, but **it reopens at every version bump, the rows are permanent, and the identical shape has been live on the vendor agreement since #427**, so the fix must cover both writers. Reasoning is written up in **D38** on `main` |
| **443** | **Frame `13`'s parity residue, including two access findings nothing else checks** | P3 | M6 | **P2 Medium** | **Backlog** | — | **None** | `core` `auth` | **Filed 2026-09-07 from #433's parity pass**, which returned MATCH on all six axes for its own change and correctly declined to attribute these six to itself. **Two are access findings** — the search field has an `aria-label` but no visible `<label>`, and the row checkbox is `22x44` against `04-laws.md`'s 44px minimum — and the parity pass is the **only** gate on the accessibility laws and the contrast table, so an unfiled access finding is not caught later, it evaporates. The other four: the header is 1px short, the wordmark renders 24px against 23px, the four filter dropdowns carry a 2px padding asymmetry left over from the caret D25 removed (**correct the padding, do not restore the caret**), and the filtered empty state offers no way out where every other console empty state does. Batched by surface per the filing convention rather than filed as six rows. D30 binds: corroborate each transcribed number against the neighbouring widths before building it. |
| **444** | **An unwind declines the accepted request behind a completed booking** | P3 | M6 | **P1 High** | **Backlog** | — | **None** | `core` `auth` | **Filed 2026-09-07 by lane #438**, which tripped over it building account closure, verified it was pre-existing rather than its own, and pinned current behaviour in a test rather than widening scope. Confirmed independently before filing. `declineOpenRequests` (`admin.dao.ts:484`) sets `status: 'declined'` where status is in `['pending','quoted','accepted']` — **unconditionally**. But `accepted` is exactly the status a request holds *after checkout*, so an unwind flips the accepted request behind an **already-completed** booking to `declined`: the event happened, the vendor was paid, and the customer's requests screen now says it was declined. That is rewriting history, not unwinding it. **Reachable from any ban**, so it predates #433 and #438 both. The neighbouring `findConfirmedBookingsToUnwind` gets it right and is the model — it bounds on `event_date > today`; the request decline has no equivalent bound. Do **not** simply drop `accepted`: a request accepted but never paid for is a real open commitment. |
| **445** | **A failed query logs every bound parameter, and the redact list cannot reach it** | P3 | M6 | **P0 Critical** | **Backlog** | — | **None** | `core` | **Filed 2026-09-07 after two lanes hit it independently** — #431's security pass and #439's review — which makes it a shape rather than an incident. Drizzle 0.45.2's `DrizzleQueryError` puts the statement's bound parameters in its `message` **and** in an own enumerable `params` property; pino's `err` serialiser copies own properties, so any `log.*({ err })` on a failed query writes every bound value into the log stream. **`server.ts`'s redact list is path-based on `req.headers.*` and never reaches it.** Caller-triggerable, which is why it is P0: `freeText()` does not strip `U+0000`, Postgres refuses it with `22021`, and the insert is on the **public unauthenticated** `POST /support/messages` — so a stranger picks when the write fails, six times an hour, and up to 4,000 characters of what they typed plus their reply-to address is logged. **Fix the sink, not the source**: a custom pino `err` serialiser covers every existing and future call site, where narrowing `freeText()` closes one trigger and leaves the class open. Two lanes have already written per-call-site guards; a third would make it a habit rather than a law. |
**This board carries open work only, and closed rows are now DELETED rather than kept.** Changed 2026-09-06 on the account holder's instruction: *"clear out all completed tickets - delete them - no need to maintain any memory of them - it is confusing new tickets."* 33 closed rows and their 33 detail sections were removed in one commit, taking the file from 4,115 lines to under 1,100. **The registry in `packages/shared/src/env/tickets.ts` was NOT touched** — its ids must stay contiguous from 0, and `pnpm preflight --ticket <old n>` still gates correctly for any older branch or commit message. `git log` holds the deleted prose if it is ever wanted; nothing else does. **The pre-2026-08-30 archive still exists** at `.claude/plans/vendor-marketplace-tickets-archive.md` and is read by `tickets.board.test.ts` alongside this file — it was left alone because it is a separate file that no longer competes with open work for a reader's attention.

Rows are ordered by build sequence, not by ticket number. **Recounted programmatically 2026-09-07 after #433 landed: 13 rows — 10 Backlog and 3 `Deferred — needs a human`.** The board tripled in one sitting: **#431–#440** are the admin-panel investigation, and **#434 (`1f8011a`) and #433 (`ad1b179`) have both landed** — so **#431**, **#432**, **#435**, **#436**, **#437**, **#438**, **#439**, **#441** and **#442** are startable unattended today. **#440 is `Deferred` because it decides policy, not because it is hard** — an operator money lever contradicts D3, D31 and D35 and needs a decision entry before any code. #370 is still blocked behind #362, and #362, #374 and #440 all need the account holder. **#438 inherits D39**: closure is a refusal, not a refund, and it must reuse the path #433 landed rather than fork it. **Do not hand-maintain this number, recount it.**
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

**Critical path — remaining:** **#362** (a human, at four provider consoles) → **#20** →
**#11** → **#353**, with **#15** (Admin Portal) parallel-safe.

> **The block below is a historical snapshot and is no longer accurate.** Corrected
> 2026-08-30 by the second backlog consolidation, which found it still naming **#9 as
> NEXT** when #9 and #10 have both been `Done` for days, and still listing #61, #63, #64
> and #65 as "unblocked right now" when all four are closed. #19, #46 and #62 are now
> `Superseded` into **#362**. It is kept because the phase structure is still a fair
> picture of how the product was built — but **the Status Board is the only authority on
> what is open, and `pnpm preflight --ticket <n>` on whether it can start.** This is the
> same staleness the Beta gate section above records as its own lesson; it was found in
> the same pass, two hundred lines apart.

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

## Consolidated Tickets — filed 2026-08-29

**These 21 tickets replace 130 open ones.** The backlog had grown to 150 open rows, roughly
ninety of which were single-measurement parity findings against nine frames — a shape that
would have cost ninety serial passes on one shared Playwright browser to close nine screens.
They are batched here by **the thing that has to be true when the work is done**, not by the
axis the finding was measured on.

Nothing was discarded. Every merged ticket keeps its row and, where it had one, its detail
section, carrying the `expected` vs `observed` tables the replacement was built from. The
full measurement record also lives in `.claude/plans/parity-sweep-ledger.md`.

**Three rules govern the parity tickets below.** First, **re-measure before fixing** — #74,
#165, #198 and #235 all landed after those findings were filed, and the tracker's own note
said they change the computed metrics of most of them. Close whatever now reports MATCH,
with the evidence in Notes, before touching code. Second, **the change order goes first**
within its frame: #287 in #298, #288 in #299, #166 in #301, #169 in #304 each rewrite the
surface their siblings were measured against. Third, **one frame is one browser pass.**

---

## Consolidated Tickets — filed 2026-08-30

**These seven tickets replace twenty-five open ones.** The board carried 37 open rows the
morning after the D16/D17 ruling rounds landed. Those rounds are what made this pass
possible: eleven rows that could never start — each stalled on one decision a ticket may
not make — became ordinary code work overnight, and the shape underneath them became
visible. What was left was not ninety measurements against nine frames, as in the
2026-08-29 pass, but **twenty-five rows that were really seven pieces of work**, split by
the axis a finding was measured on or the day a lane happened to find it.

**Nothing was discarded.** Every merged ticket keeps its row, its registry row — so
`pnpm preflight --ticket <old number>` still gates for anyone working from an older branch
or commit message — and, where it had one, its detail section, carrying the `expected` vs
`observed` tables the replacement was built from. Each of those sections now opens with a
`Superseded` banner naming its replacement, because a detail section is what `/ticket <id>`
lands on and the board row alone does not reach it. **#206 is the one exception: it never
had a detail section**, and its content survives in its Notes cell and in
`docs/pre-launch.md` §3.2. A `Superseded` ticket is never worked directly.

**Four rules govern the tickets below.**

1. **#357 goes first, and alone.** Five of the six tickets it merges end in an edit to
   `design/Orla - Screens.dc.html` — the repo's own acceptance criterion, one HTML file
   holding all 27 frames. Concurrent lanes editing it conflict by construction. #358 is
   measured against two of the frames it corrects.
2. **Re-measure before fixing**, as in the 2026-08-29 pass. #302, #305 and #329 all landed
   after most of these findings were filed.
3. **One frame is one browser pass**, and a ticket that touches a shared primitive
   (`StatusPill`, `Avatar`, `SearchBar`, `.app-pane`) measures every screen that draws it
   before changing it — not just the one it was found on.
4. **#358 and #323 must not run concurrently.** They own the same two components,
   `search-shell.tsx` and `refine-bar.tsx`, at two different widths.

---

### #362: [PLATFORM] External-account provisioning — one dashboard session

**Milestone:** M-OPS | **Phase:** INFRA | **Priority:** P0 Critical | **Status:** Deferred — needs a human | **Capabilities:** `all`
**Blocked by:** The account holder — every item is a provider-console action

Merges **#19, #46 (residual), #62, #206**.

**Why one ticket.** Every item is the same actor doing the same kind of thing: signing into a
provider console and minting, renaming or rotating a value. **None of it is repository
code** — #19's own text says it is *"almost entirely external account configuration rather
than repository code"*, with a provisioned environment rather than a diff as its deliverable.
Three of the four already point at each other: #62 calls itself *"a #19 prerequisite"*,
#206's Notes say it *"overlaps #19"* and is *"a pointer, not a queue item"*, and #46's
remaining scope is one rotation. Split, this is four separate asks of one person, each of
which stalls a different part of the board. Merged, it is one sitting with a checklist.

**No ticket can do any of it, and none should try.** `~/.claude/CLAUDE.md` is explicit: a
credential that reached a command line or a config file is already exposed, and an approved
command can be saved verbatim as a permission rule. Every value here is read from the
environment or it does not exist.

**The checklist:**

- [ ] **Clerk — rotate `CLERK_WEBHOOK_SECRET`** (#46). Leaked into a chat transcript on
      2026-08-27. Scopes 1 and 2 of #46 are **Done** in code (`34cd28c`, `ed41aed`): the API
      refuses to boot when its Clerk endpoint is a relay, a foreign origin, the wrong route
      or plain HTTP, and `pnpm reconcile:clerk` proved a no-op in production (4 real users,
      0 drift, 0 retirements, 50 seeded rows skipped). **Deleting the value is not enough —
      rotate it.**
- [ ] **Clerk — set the password minimum to the frame's 10 characters, or rule the frame
      wrong** (#313). The instance enforces `min_length: 15`, read from its own
      environment endpoint. Frame `12` draws the helper `At least 10 characters`, so the
      product would either state a rule the provider refuses or need the plan corrected.
      **And the helper cannot be rendered either way today:** Clerk exposes no persistent
      password-hint key — `formFieldHintText__` has only `optional` and `slug` — and the
      field lives inside Clerk's own card, which the app cannot reach into. Both halves
      leave the sign-up form one line short of frame `12`.
- [ ] **Clerk — rename the application** from `vendor-marketplace` to the brand name (#313).
      The name Clerk interpolates into every `{{applicationName}}` key comes from the
      instance's display config, which is dashboard configuration rather than code. #313
      corrected the two observed keys as defence in depth; **this is the source**, and it
      fixes every key at once including the ones nobody has enumerated. It touches the shared
      instance the E2E accounts live in, so it is not a lane's call to make.
- [ ] **Stripe — change the public business name** from `VendYou` to the brand name (#62).
      Found 2026-08-28 from `stripe config --list`: `display_name = 'VendYou'`. Stripe renders
      it on the hosted Connect Express onboarding page (#9), on Checkout (#10), and **as the
      statement descriptor on cardholders' statements**. Harmless in sandbox, wrong in front
      of a real vendor.
- [ ] **Sentry — supply a real `SENTRY_DSN`**, which **unblocks #353**. `pnpm preflight
      --ticket 353` fails on the placeholder, and the `sentry` capability there is real — the
      ticket integrates `@sentry/node` and `@sentry/nextjs` — so narrowing the row is not the
      unblock.
- [ ] **Mint production credentials** in Clerk, Stripe, R2 and Resend (#19) — newly minted by
      the account holder, never copied from development.
- [ ] Pooled connection string on Railway; unpooled on Railway **and** GitHub Actions.
- [ ] **Neon Launch upgrade (#206) is launch prep, not current work.** Free is the correct
      plan while there is no real data — 8.9 of 100 CU-hours, 34 MB of 512 MB, 3 of 10
      branches — and nothing here blocks development. When it happens: protected branch on
      `production`, history window to **7 days**, a scheduled backup, scale-to-zero disabled
      once real traffic exists, and a spending notification; roughly **$5–25/month**.
      Separately and regardless of plan, **`pg_dump` to R2 on a schedule** — PITR and
      snapshots protect against your mistakes, an off-platform dump protects against the
      platform's. The full checklist lives in `docs/pre-launch.md` §3.2. **Do not re-surface
      it as active work.**

**Acceptance:**

- [ ] Every value above exists in the environment it belongs to and **nowhere else** — not
      inline in a command, not in `.claude/`, not in a transcript
- [ ] `pnpm preflight --ticket 353` and `--ticket 20` both pass
- [ ] `pnpm env:example` regenerated from the registry; no real value in it
- [ ] `pnpm secrets:scan:all` is clean over the whole tree
- [ ] The Neon items stay recorded as launch-gated in `docs/pre-launch.md` and are **not**
      brought back onto the board

---

## Consolidated Tickets — filed 2026-08-31

**The third backlog consolidation, and the last one that should be needed.** It closed
**14 open rows into 4**, and filed one ticket for a launch gap nobody had written down.
The board went from 22 open rows to 13.

**Why it happened.** Of 315 closed rows, **138 were `Superseded`** — filed, then
consolidated away without ever being worked. Roughly 44% of the ticket volume was spent
on filing and re-filing rather than on building. The cause was mechanical: parity and
audit sweeps filed **one ticket per measurement**, so a single browser pass could produce
a dozen rows, and the operator running them autonomously could not tell from the queue
what any given run would change.

**The rule now, and it binds every future sweep:** a ticket is a **feature or a fix a
human would recognise by name**. A measurement, a single axis, one line of copy or one
lint hit is **not** a ticket — it is an acceptance line on the ticket for the surface it
belongs to. `~/.claude/skills/file-ticket` and `~/.claude/skills/cleanup-tickets` enforce
this; see also `.claude/memory/ticket-granularity-feature-sized.md`.

---

### #370: Production deploy pipeline and error visibility

**Milestone:** M4.5 | **Phase:** P1.5 | **Priority:** P0 Critical | **Status:** Backlog | **Capabilities:** `core` `sentry`
**Blocked by:** **#362** — production credentials and a real `SENTRY_DSN`, both provider-console actions

Merges **#20, #353**.

**Why one ticket.** A release pipeline that ships a service which cannot report its own
failures is half a deliverable. #20's own acceptance ends at "the smoke check passes";
the first thing anyone needs after that is to know when it stops passing. Both halves
also wait on the same person doing the same thing — #362's console sitting — so split,
they stall twice for one reason.

**Read #20's detail section (above) whole.** Its behavioural requirements, its five edge
cases and its thirteen acceptance lines are the source for the pipeline half and are not
restated here. Likewise #353 for the instrumentation half. What follows is what is true
of the merged ticket.

**Scope:**

- `.github/workflows/deploy.yml` — push to `main`, gated on `ci.yml`, order exactly
  `migrate (unpooled) -> deploy api (Railway) -> deploy web (Vercel) -> poll GET /ready`
- `.github/workflows/ci.yml` — add `gitleaks`
- `apps/api`: `@sentry/node` — request handler, error handler, release tagging
- `apps/web`: `@sentry/nextjs` — client, server and edge configs, source maps
- `SENTRY_DSN` into `packages/shared/src/env/`, and into `turbo.json`'s
  `globalPassThroughEnv` **by regenerating**; `pnpm env:example` re-run
- The release path documented in `CLAUDE.md`

**Behavioural requirements** — #20's and #353's, plus the one that only exists because
they are merged:

- **The deploy's release tag is the Sentry release.** An error arriving from production
  resolves to the commit that shipped it, or the instrumentation is decoration.
- Migrations run first and receive **only** `DATABASE_URL_UNPOOLED`; a failed migration
  aborts before any deploy
- The smoke check polls `GET /ready`, not `/health`, with a bounded timeout, and a
  timeout **fails** the workflow
- A concurrency group serialises deploys; `ci.yml` skipped or cancelled is **not passing**
- Unhandled errors reach Sentry from both apps with the user id attached and **never**
  the email or any Clerk token; payment errors are tagged `critical`
- Sampling is explicit, not the SDK default
- No secret is printed in any path, including failures

**Non-goals:** rollback automation and preview environments (D6, D7); blue-green or
canary releases; the Neon Launch upgrade (#362, launch-gated in `docs/pre-launch.md` §3.2).

**Acceptance:**

- [ ] Every acceptance line of **#20** passes, including the deliberate bad migration and
      the planted fake credential — tested on a scratch branch, not assumed
- [ ] Every acceptance line of **#353** passes, including `git grep` finding no DSN literal
- [ ] A production error's Sentry event names the release that deployed it
- [ ] `pnpm preflight --ticket 370` passes
- [ ] **#35 is retired** — it is explicitly interim

**Tests (required):** #20's and #353's, plus a test that the release identifier the
workflow sets is the one the SDK reports.

---

### #374: Launch legal, policy and support surfaces

**Milestone:** M6 | **Phase:** P3 | **Priority:** P0 Critical | **Status:** Deferred — needs a human | **Capabilities:** `core`
**Blocked by:** the account holder — two things, both of which a ticket must not invent:
**(1)** the operative wording of the terms, the privacy policy and the vendor agreement, and
**(2)** a real monitored support destination (an address, or where a form should land).

**Deferred 2026-08-31** at the start of an unattended run, on the standing instruction to
defer rather than guess. **The deferral is the two content items only.** Everything else
here is code and becomes runnable the moment they arrive: the four routes, the footer
links, the checkout placement, and the reconciliation of the stated policy against what
`booking-requests.service.ts` actually enforces. **#372 waits only on item (2)** — the
`Contact support` destination frame `16` needs

**Filed 2026-08-31. Not a consolidation — a gap nobody had filed.** `docs/pre-launch.md`
§1.5 and §7 have carried these as checkboxes since 2026-08-27, and no ticket was ever
written for them, so `/next-ticket` could never reach them. **None of these routes exist
in `apps/web/src/app`.**

**Why it is P0.** The product takes card payments from members of the public and pays out
to third-party vendors on a 12% commission. Doing that without published terms, a privacy
policy and a stated refund position is legal exposure, not polish — and Stripe Connect
onboarding asks for the URLs.

**What is genuinely a ticket's to build, and what is not.** The **routes, the layout, the
navigation and the enforcement** are code and belong here. The **operative wording** of a
binding contract is not a ticket's to invent — it needs a human, and where this ticket
cannot write copy it ships the surface with the content sourced from the account holder or
marks that one page `Deferred — needs a human` rather than inventing terms. **Do not
generate plausible-sounding legal text and ship it as binding.**

**Scope:**

- `/terms`, `/privacy`, `/cookies` — static routes under the site layout, linked from the
  footer on every page
- `/support` — the destination frame `16` needs (**#372 depends on this**), and the
  "support contact route that reaches a human" of §7. Decide the mechanism: a mailto to a
  real monitored address, or a form that lands somewhere. A form that posts into nothing is
  worse than a mailto
- A **vendor agreement** surface covering the 12% commission and payout timing, presented
  during vendor onboarding
- The **refund and cancellation policy shown before payment** — on
  `/bookings/[requestId]/checkout`, above the pay control, not only as a footer link
- A cookie notice consistent with what the app actually sets

**The hard requirement, and the reason this is not just five markdown pages:** the refund
and cancellation policy shown to the customer **must match what the code enforces**. Read
the cancellation and refund behaviour out of
`apps/api/src/services/booking-requests.service.ts` and the Stripe integration first, and
write the policy from that. A policy that promises something the code does not do is the
one failure mode here that creates a dispute the platform loses.

**Non-goals:** a CMS; per-jurisdiction variants; a cookie *consent* banner with
preference storage (MVP sets no third-party marketing cookies — confirm that, and if it is
false, this becomes a blocker rather than a non-goal); the licensing audit of marketing
photography (§7, a human's task, record it as such).

**Acceptance:**

- [ ] `/terms`, `/privacy`, `/cookies` and `/support` render under the site layout and are
      reachable from the footer on every page, signed in and signed out
- [ ] `Contact support` on the 500 screen resolves here (#372's dependency)
- [ ] The refund and cancellation policy is visible **before** the pay control on checkout,
      not behind a link
- [ ] The policy text and the enforced behaviour are reconciled on the record — the ticket
      names the code path it was written from
- [ ] The vendor agreement states the 12% commission and the payout timing, and a vendor
      sees it during onboarding
- [ ] Every route is in the parity ledger, framed or recorded as deliberately unframed
      (#363's ledger test will require this)
- [ ] No page ships invented binding wording — anything needing the account holder is
      recorded in `docs/pre-launch.md` §7 and the ticket says so

**Tests (required):**

- [ ] A test that each route renders and returns 200
- [ ] A test that the footer links to all four on both auth states
- [ ] A test that the checkout page renders the cancellation terms **above** the pay
      control, asserted by position rather than by presence
- [ ] A test that the commission figure on the vendor agreement reads the same constant the
      payment code charges — never a typed literal

---

## Filed 2026-08-31 — the fourth consolidation pass, and two user overrides

`/cleanup-tickets`, run against a board of 15 open rows. Four merged into two
(**#385**, **#386**), one folded into an existing ticket (**#382** into **#363**),
and two filed from the user's own instructions in the same session (**#383**,
**#384**). Every merged row keeps its body, its `Superseded` status and its
registry entry, exactly as the three previous passes did.

---

## Filed 2026-09-04 — the autonomous QA run's application sweep

`/hunt-bugs` fanned eleven read-only hunters across the codebase and drove seven
flows in a real browser, producing 131 candidates. Each went to three skeptics
prompted to refute it; **92 survived**. They are grouped here into fifteen
tickets by the file set a single lane would open, not one row per finding —
`ticket-granularity-feature-sized` is the rule, and the sweep's own output is
kept in the run report rather than the board.

## Filed 2026-09-06 — the user's review of a verified parity pass

Three tickets from one session. **#417** groups what a driven, screenshotted
parity pass confirmed was real after the user rejected five stale findings from
an earlier pass; **#418** and **#419** are product instructions given verbatim.

The evidence for #417 is in `parity-review/` — four screenshots and
`FINDINGS.md`, measured at 1440x900 against `main` @ `1334c05`. **That review
also dismissed five previously-recorded findings**; they are listed there with
the reason, and must not be re-filed. In particular the price chip's missing `✕`
is **correct as built** — frame `02` draws `$500 – $3,200 ▾` for a range and
`4★ & up ✕` for a single value, and `refine-bar.tsx` documents why — and the
header submit's `ring-offset-0` is deliberate and tracked under #306/#73, now
re-reported six times by successive passes.

#### Read this first: the table is good, and most of it is not the problem

`legal_acceptances` (#427) is better built than an audit usually finds, and
**none of the following is to be changed**:

- **Immutability is enforced by a database trigger**, not by a DAO that happens
  to have no update method — and `legal-acceptance-immutability.test.ts` proves
  it by *attempting* the update and the delete rather than reading the DDL.
- `accepted_by_name` and `business_name` are **deliberate copies, not joins**, so
  a vendor who renames their business cannot thereby rewrite who accepted what on
  whose behalf.
- `ip`, `user_agent`, and a timezone-aware `accepted_at` are already captured.
- **The privacy policy already discloses the IP and browser capture** —
  `privacy.md` names it explicitly, in the right terms.
- **The stale-version blocker already exists**: `hasCurrentVendorAgreement` reads
  false when a vendor's accepted version is behind `CURRENT_VENDOR_AGREEMENT_VERSION`,
  and `acceptAgreement` refuses a version that is not current.

**Do not rebuild any of that.** Two things are genuinely missing.

#### Hole 1 — only a vendor can be recorded

`vendor_id` is `NOT NULL` with a foreign key to `vendor_profiles`. So:

- **A customer accepting the Terms of Service at sign-up has nowhere to be
  recorded**, and that is the acceptance every single user of the product makes.
- `terms_of_service` is already in `LEGAL_ACCEPTANCE_DOCUMENTS` and in the
  `legal_document` enum, and **nothing anywhere writes it** — an unused enum
  value, exactly the shape `disputed` had before #425 gave it a writer.

**The fix is a shape change, and the invariant has to survive it.** The row's
subject becomes the **user**, with the vendor profile optional context:

- `accepted_by_user_id` already exists and is already `NOT NULL` — it is the real
  subject and should be the anchor.
- `vendor_id` becomes **nullable**, set for a vendor-agreement acceptance and
  null for a customer's Terms acceptance.
- `business_name` is likewise not meaningful for a customer; make it nullable
  rather than writing an empty string, which would be a claim rather than an
  absence.
- **The immutability trigger must be re-examined, not assumed.** Its current rule
  allows the one delete that cascades from removing the vendor. With the anchor
  moving to the user, the equivalent rule is "removable only when the *user* it
  is about is erased" — verify what the existing trigger does under a nullable
  `vendor_id`, and extend the test rather than trusting it still holds.

**Where the Terms acceptance is written:** first sign-in, where the `users` row
is created — `insertUserIfAbsent`, reached from `users.service.ts`. That is the
one place every account passes through exactly once, and the same place the role
is resolved from Clerk.

#### Hole 2 — the record says which version, not what it said

The row stores `version: 'v1.0'`. That is a **label, not the text.**

The copy lives in `apps/web/content/legal/*.md` and is **explicitly placeholder
that will be replaced** — #427 shipped it that way on purpose. So an edit to
`terms.md` that does not bump the version leaves every existing acceptance row
attesting to text that no longer exists, and nothing can reconstruct what was on
screen when the person clicked.

**Store a `document_sha256`** — the hash of the rendered document as served —
alongside the version. Version says *which* one; the hash proves *which bytes*.
It is small, it is immutable with the rest of the row, and it is the difference
between "they accepted v1.0" and "they accepted this".

**Both open questions are ruled here. Do not relitigate them in the lane.**

1. **Hash the markdown source bytes as committed** — SHA-256 of the file, not of
   the rendered HTML. Rendering is a function of the renderer, so a markdown
   library or Tailwind upgrade would move a rendered hash for text nobody edited,
   and every acceptance row would then read as drift. The source is what is
   diffable, what is in version control, and what — rendered by the code at that
   commit — uniquely determines what was on screen.
2. **Drift fails loudly, in the test suite.** Commit a manifest of
   `{document, version, sha256}` next to the documents, and assert each entry
   against the file it names. Editing `terms.md` without bumping the version then
   fails `pnpm test` with the document named, which is the outcome that makes the
   silent case impossible. Do **not** derive the version from the hash: a version
   a human chose is what the row, the blocker and the agreement all cite, and a
   hash-derived one would change under a typo fix that nobody needs to re-accept.

#### Hole 3 — nothing is actually *accepted*; the flow is browsewrap

**Ruled by the account holder 2026-09-07: _"explicit checkbox."_** This is not a
nice-to-have and it is not a column — it is the acceptance itself. A row saying
someone accepted the Terms is worth nothing if all they did was press a button
labelled `Continue` under a link they never opened. That is browsewrap, and it is
the form courts decline to enforce. Clickwrap is an **unticked box the person
ticks**, with the document named and linked beside it.

**The placement problem is real, and it is the hard part of this hole.**
`sign-up-form.tsx` renders Clerk's prebuilt `<SignUp>` component, so there is no
seam inside the form to put a checkbox in — and a checkbox placed *before* it, on
the role step, is bypassed by every social sign-up that enters Clerk directly.

**So the gate goes after authentication, not before it:** a first-sign-in
interstitial on the `/after-sign-in` path, which every account traverses exactly
once regardless of how it was created, and which is already where the `users` row
is written. Until the box is ticked and submitted, that is the only page the
account can reach; the submit is what writes both the `users` row and the
acceptance, in one transaction, so an account cannot exist without its acceptance
row.

Three properties this has to have, each of which a shortcut would lose:

- **The box starts unticked.** A pre-ticked box is not an affirmative act, and
  pre-ticking it is the single most common way a clickwrap record is thrown out.
- **The document is reachable from beside the box**, opening without leaving or
  resetting the interstitial.
- **The `ip` and `user_agent` recorded are the ones on the request that carried
  the tick** — not on some earlier request in the flow. This is the whole reason
  those columns exist, and it is quietly easy to get wrong when the write moves
  to a different handler from the one the person submitted.

Record the method on the row (`acceptance_method`), so a later flow that accepts
some other way is distinguishable from this one rather than retroactively
indistinguishable from it.

#### Acceptance

1. A customer accepting the Terms at sign-up writes exactly one immutable row,
   with `document = 'terms_of_service'`, the version, the hash, `ip`,
   `user_agent` and a timezone-aware timestamp.
2. `vendor_id` is null on that row and set on a vendor-agreement row; neither
   case writes a placeholder value for a field it does not have.
3. Every existing vendor-agreement row still reads correctly after the migration
   — asserted against seeded rows, not inferred from the DDL.
4. **Immutability still holds after the shape change**, proven by attempting an
   update and a delete, including the nullable-`vendor_id` case.
5. A second sign-in does **not** write a second Terms row; re-acceptance happens
   only when the version changes.
6. Raising the Terms version makes the next acceptance add a row rather than
   replace one, and the earlier row still answers "what did I agree to".
7. `document_sha256` matches the document served, and a changed file without a
   version bump is impossible or fails loudly — whichever was ruled.
8. **Acceptance is an unticked checkbox the person ticks**, on a first-sign-in
   interstitial every account traverses, with the document linked beside it. The
   account cannot reach any other page until it is submitted.
9. The `ip` and `user_agent` on the row are the ones from the request that
   carried the tick.
10. The `users` row and its acceptance row are written in **one transaction** —
    an account with no acceptance row is not a reachable state.
11. The acceptance method is recorded on the row.

#### Tests (required)

- [ ] A test per acceptance, each watched failing first.
- [ ] **Immutability re-proven by attempting mutation**, not by reading the
      schema — the existing test's approach, extended to the new shape. This is
      the property the whole table exists for.
- [ ] A test that **changes the markdown and asserts the hash no longer matches**,
      so the drift this column is for is demonstrably caught.
- [ ] Sign-in twice; assert one row.
- [ ] Migration applied against seeded data carrying existing acceptances.
- [ ] **The checkbox starts unticked**, and submitting without it writes no row
      and lets no route through — asserted on both halves, since a gate that
      records nothing but still admits you is the failure worth catching.
- [ ] A test that the recorded `ip`/`user_agent` come from the submitting
      request, by making them differ from an earlier request in the same flow.
- [ ] The manifest test: mutate a legal markdown file in a fixture and assert the
      suite fails naming that document.
- [ ] Browser-verified at both auth states, including a social sign-up path, so
      the gate is shown to be unbypassable rather than argued to be.

#### Explicitly out of scope

The operative legal wording (**#374**), the stale-version blocker and the privacy
disclosure — all three already exist or belong elsewhere. This ticket is about
**what is recorded**, not what the documents say.

#### This is a revision of #428, not a rebuild — read what is already true

**Do not redo any of this.** #428 (`bc3948a`) already shipped, and the new prompt
restates it because it was written as a standalone brief:

- the band is already **vendor-only** — the two-audience fork is gone;
- it already renders for **signed-out visitors only**;
- it already carries **no pricing figures**;
- both controls already share **one destination** (`VENDOR_ENTRY_PATH`), so
  neither can drift from the other;
- the footer already has its **legal row** and its `#1C1916` ground;
- the footer's **Account column is already right in both states** — signed out is
  `Sign in` · `Sign up` with `Dashboard` deliberately absent, and the reasoning is
  written above `site-footer.tsx:66`. The prompt restates it because it is a
  standalone brief; it is not a change;
- a signed-in vendor is already redirected off `/`.

Re-implementing any of that is how a revision becomes a regression.

#### What actually changes

**1. The band stacks.** Today it is two columns — a pitch on the left capped at
`max-w-110`, and the steps in a right-hand column separated by a vertical
`sm:border-l`. It becomes:

- a **top line** (`flex`, `align-items: flex-end`, `justify-content:
  space-between`): the pitch on the left at `max-width: 600px`, and on the right
  the text link **then** the button — button last, so the strongest element sits
  at the band's outer edge;
- a **full-width horizontal rule**, `1px rgba(248,245,239,.14)`, `38px` above and
  `32px` below — replacing the vertical divider;
- the three steps beneath as `grid-template-columns: repeat(3, 1fr)`, `gap: 52px`.

Stated reason, worth keeping: a two-column version left roughly 500px of dead ink
on the right.

**2. Both centred measures go.** This is the part that contradicts a recorded
decision, so take it deliberately:

- The band currently wraps its contents in `mx-auto ... max-w-[1160px]`, and
  `page.tsx` carries a comment defending it — the two blocks *"left uncapped sit
  at opposite edges with 300px of ink between them and stop reading as one
  band. 1160 is the frame's own measure."*
- The footer does the same with `mx-auto w-full max-w-[1440px]`.

**The newer frame overrules both**: contents sit **flush to the page's 40px
gutter**, because every block above the band is left-aligned to that gutter and a
centred column here reads as an unexplained shift. **Correct that comment rather
than leaving it** — a comment that argues against the code it sits above is worse
than none, and this one is specific and persuasive enough to get the change
reverted by the next reader. Note the stacked layout also removes the condition
the old reasoning described: there are no longer two blocks to hold together.

**3. Measured values.** Serif `33px → 35px/1.12`; body `14px/1.7`; step circles
`22px → 23px` with a `1px rgba(248,245,239,.28)` border and JetBrains Mono `11px`;
step title `14.5px/600`, body `13px/1.65`. Take these off the frame, not off this
list — and per `web-design-parity.md`, corroborate any value against the widths
either side before building it.

**4. The footer's compensating `border-top` goes.** It existed to separate two
masses of the same ink; the `#1C1916` ground now does that job. **The legal row
keeps its own `border-t`** — that is a different rule and stays.

#### Acceptance

1. The band is stacked: pitch and controls on one line, a full-width rule, then
   three steps in a 3-column grid.
2. The link precedes the button, and the button is the outermost element.
3. Neither the band nor the footer centres an inner measure; both are flush to
   the 40px gutter, and this holds at every width in `30-responsive.md`.
4. The `page.tsx` comment defending `1160` is corrected, not orphaned.
5. The footer's compensating `border-top` is gone and the legal row's own border
   remains.
6. Still vendor-only, still signed-out-only, still no pricing figure — asserted,
   because these are the properties a recomposition is most likely to drop.
7. Matches `Orla-Closing-Band.html` on all six axes at 1440x900.

#### Tests (required)

- [ ] A test per acceptance, watched failing first.
- [ ] **Acceptance 6 asserted against a signed-in customer and a signed-out
      visitor**, not just the default — the regression this ticket could cause is
      showing a vendor pitch to someone who cannot act on it.
- [ ] The no-pricing-figure check searches rendered output, not source.

## Admin Panel — filed 2026-09-07

Ten tickets from one investigation of the operations console, end to end: what
frame `13` and #15 actually built, what the domain holds, and what an operator
cannot do about it. The finding common to all ten is this: **the admin panel is
a competent read console with one write action, and it cannot close the loop on
any exception path.** Seven screens, fifteen routes, nine of them reads. Of the
six mutating routes, five have UI; the sixth — dispute resolution, the one that
unfreezes a vendor's money — has none.

**Do not re-derive the inventory.** What exists is: `/admin` (Overview,
metrics + four charts), `/admin/vendors` (filters, facets, CSV export, ban and
bulk-ban), `/admin/customers`, `/admin/bookings` (status + `refund-stuck`
flag), `/admin/payments`, `/admin/reviews` (delete), `/admin/tags` (suggestion
queue + tag edit). The reads are genuinely good — URL-driven filters, real
facets, dropped-parameter announcements, no invented numbers — and none of these
tickets should rebuild them.

**Scope law for all ten: `98-post-mvp.md` still binds.** Cohort and retention
analytics, automated flag triage, vendor quality scoring and bulk messaging to
vendor segments are Post-MVP and **no ticket here may implement them**. Equally
binding the other way: **D4** (one role per account, immutable — no ticket adds
role switching), **D3** (cancellation tiers fixed platform-wide), **D31** (a
cancellation is a full unwind), **D35** (the 72-hour payout hold is fixed). Any
ticket that finds itself wanting an exception to one of those has found #440,
not a licence.

### #431: Operations case console — every dispute, however it arrives, and its resolution

**Milestone:** M6 | **Phase:** P3 | **Priority:** P0 Critical | **Status:** Backlog | **Capabilities:** `core` `auth` `stripe` `email`
**Blocked by:** None

#### The state today

Three mechanisms that are one job, and none of them meet:

1. **The customer's report.** `POST /support/messages` is public and
   unauthenticated. When it carries a `bookingId`, `sendSupportMessage`
   orchestrates `placeDisputeHold` (`payments.service.ts:1089`), which moves the
   booking `confirmed | completed` → `disputed`, writes `dispute_reason`, and
   sends the report to `SUPPORT_EMAIL_TO`. **The message is never stored** —
   `support.routes.ts` says so deliberately: *"this creates nothing addressable
   … one email, no ticket to track."*
2. **The hold.** `payouts.dao.ts` excludes `disputed` from the 15-minute release
   sweep, so the vendor's transfer is frozen from that moment.
3. **The resolution.** `PUT /admin/bookings/:bookingId/dispute` takes an outcome
   of `vendor` or `customer` and calls `resolveDispute`. It is the **only** thaw.
   It has **no client function, no button, no screen** — `admin-data.ts` holds
   nine GETs and no mutations.

So the reason lives in an inbox, the hold lives in a column no admin schema
exposes, and the resolution lives in an endpoint with no UI. An operator can
filter `/admin/bookings?status=disputed` and see a pill; they cannot see why,
and they cannot act.

Separately, **`charge.dispute.*` is not among the handled Stripe events**
(`webhooks/stripe.routes.ts` handles `payment_intent.succeeded`,
`account.updated`, `capability.updated`, `v2.core.account.*`). A network-level
chargeback lands in the Stripe Dashboard and the `bookings` row never learns —
so the platform can be debited for a booking the console still reports as paid.

#### What to build

**1. A `support_cases` table and the report that writes it.** Persist what
`sendSupportMessage` currently only emails: sender (user id where there is one,
plus the reply-to address), subject/body, the generated reference
(`ORL-4K7Q-P2` shape, already produced — reuse it as the case's public id), the
`bookingId` where one was given, `createdAt`, and a disposition
(`open | resolved`, with resolver and resolved-at once #434 lands). **The email
still sends** — this is a record beside it, not a replacement, and a failure to
write the row must not lose the email or strand the hold. Keep
`liftDisputeHold`'s existing compensation: if the report cannot be sent, the
hold comes back off.

**2. Chargebacks arrive as cases too.** Handle `charge.dispute.created`,
`charge.dispute.closed` and `charge.dispute.funds_reinstated`. On `created`,
open a case linked to the booking and place the same hold (through
`placeDisputeHold`'s primitive, not a second writer) so a chargeback cannot pay
out underneath the platform. On close, record the network's outcome on the case
— **do not** auto-resolve the booking; Stripe's outcome and the platform's
disposition are different facts and an operator reconciles them. Signature
verification and idempotency follow the existing handler exactly; a replayed
event must not double-hold or double-open.

**3. `/admin/cases` — the queue.** List: reference, who, subject, linked booking
(or —), age, status. Filter by open/resolved and by has-booking. Default to
open, oldest first — the age of the oldest open case is the number that matters,
because it is money someone is not being paid.

**4. `/admin/cases/[id]` — the case, and where it is resolved.** The message
body in full; the sender and their role; the linked booking with **everything
`adminBookingRowSchema` currently omits** — total, fee, payout, `paid_at`,
`dispute_reason`, `cancelled_by`, `refund_amount_cents`, `payout_released_at`,
and the chargeback's Stripe id where there is one. Then the two-position
control: **resolve for the vendor** (hold lifts, booking returns to `confirmed`
or `completed` per `completedAt`, payout resumes on the next sweep) or **resolve
for the customer** (refund and cancel, `cancelled_by = 'admin'`). Both go through
`ConfirmAction` naming the consequence in money, per `22-admin.md`; both call the
**existing** `resolveDispute` — do not write a second money path.

**5. A count in the rail.** `AdminNav` already carries a `reviewCount` badge;
open cases get the same treatment, and for a better reason. Read it the cheap
way the layout already documents (`pageSize=1` for the `total`), not through
`/admin/metrics`.

#### Acceptance

1. A support message with a `bookingId` places the hold **and** writes a case
   row; the case carries the same reference the sender was shown.
2. A support message without a `bookingId` writes a case and places no hold.
3. If the email fails, the hold is lifted and the case records the failure —
   the existing compensation still holds with a row in play.
4. `charge.dispute.created` opens a case, places the hold, and is idempotent
   under a replayed event.
5. `/admin/cases` lists open cases oldest first and is reachable from the rail
   with an open count.
6. `/admin/cases/[id]` shows the message and every money field named above.
7. Resolving for the vendor lifts the hold and the next sweep pays out;
   resolving for the customer refunds and cancels with `cancelled_by = 'admin'`.
8. Both resolutions are refused on a booking that is not `disputed`, with the
   409 the service already raises rather than a 500.
9. Non-admins get 403 from every new route **before** validation — the
   `requireRoleBeforeValidation` rule this plugin documents, not `preHandler`.

#### Tests (required)

- [ ] A test per acceptance, watched failing first.
- [ ] The chargeback replay asserted against the real webhook harness, not a
      unit stub.
- [ ] A resolution asserted end to end against the Stripe test-mode connected
      account the E2E seed provisions (#387) — the refund path must be driven,
      not mocked, because the 402 it used to hide behind is the exact failure.
- [ ] Browser-verified at both auth states; a customer typing `/admin/cases` is
      bounced, not shown a shell of 403s.

### #432: Payout health — failed transfers, retries, and why Stripe stopped a vendor

**Milestone:** M6 | **Phase:** P3 | **Priority:** P0 Critical | **Status:** Backlog | **Capabilities:** `core` `auth` `stripe`
**Blocked by:** None

#### The state today

**Two columns are written and read by nothing.** The release sweep
(`payouts.service.ts`, every 15 minutes) increments
`bookings.payout_attempts` and writes `bookings.payout_failure_reason` on every
failed transfer (`payouts.dao.ts:213`), clearing the reason on success. Grep
both across the repo: the only readers are the sweep's own ordering
(`orderBy(asc(bookings.payoutAttempts), …)`) and its logger. **No screen, no
API response, and no alert reads either.** A vendor whose transfer fails on
every one of ninety-six daily attempts is owed money that nobody is told about.

`adminPaymentRowSchema` carries `totalAmountCents`, `platformFeeCents`,
`vendorPayoutCents`, `stripePaymentIntentId`, `paidAt` and `status` — and no
payout state at all. The Payments screen therefore shows a booking whose money
reached the platform and never reached the vendor identically to one that
settled.

**And the vendor-side story is a boolean.** `vendor_profiles.stripe_onboarded`
is set by `isOnboarded(status)` — true iff `stripe_transfers` **and** `payouts`
capabilities are both active. When Stripe revokes one, `applyAccountStatusChange`
flips it false and that is the entire record. `isMissingPayoutsOnly` already
distinguishes the half-restricted case and only logs a warning. The operator's
filter says "No payouts yet" for a vendor who has never onboarded and for one
Stripe restricted this morning, with no reason and nowhere to go.

#### What to build

**1. Payout state on the payments surface.** Add to the admin payment row:
`payoutReleasedAt`, `payoutAttempts`, `payoutFailureReason`, `stripeTransferId`,
and a derived payout state. **Derive it with `payoutStatusOf`** — the one
derivation #423 wrote for exactly this, already used by `booking-report.ts` and
`dashboard.service.ts`. A fourth copy of "what is held" is how these come to
disagree; that is written down twice in `dashboard.dao.ts` already.

**2. A failing-payout filter and a row flag**, shaped like the `refund-stuck`
flag the Bookings screen already carries — marked on every row, not only inside
the filter, because the failure #415 fixed was precisely a state you had to know
about to find. A payout is failing when `payout_attempts > 0` and
`payout_released_at is null`.

**3. A retry.** `PUT /admin/bookings/:bookingId/payout/retry`, admin-only,
which re-enters the **existing** sweep path for one booking rather than
reimplementing the transfer. **D36 binds: the idempotency key is versioned by
the attempt**, so a retry increments `payout_attempts` and mints a new key —
reusing the key replays Stripe's cached failure and the operator learns nothing.
Refuse on a booking that is `cancelled`, `disputed`, or already released, and say
which.

**4. Stripe account state, with the reason.** Persist what the webhook already
reads: the disabled reason and the outstanding requirements from the connected
account, alongside `stripe_onboarded`. Surface them on the vendor row's detail
(#437 builds the view; this ticket supplies the data and may land its own
panel first). **Read-only.** An operator must not be able to flip
`stripe_onboarded` by hand — D29's constraint (`stripe_onboarded = false OR
stripe_account_id IS NOT NULL`) and the capability read are what make the column
true, and a manual override makes it a guess. Link out to the Stripe Dashboard
for the account instead.

**5. A Live-vendor payout alert on the Overview.** One count — vendors whose
payouts are blocked, and bookings whose transfers are failing — sitting where
the four metric cards already are. A number that leads to the filtered list;
`page.tsx` already documents that a card leading nowhere is furniture.

#### Acceptance

1. The admin payment row carries payout state derived by `payoutStatusOf`, not
   by a new local test.
2. A booking with `payout_attempts > 0` and no release is flagged on its row and
   findable by filter.
3. The retry mints a new idempotency key versioned by the attempt (D36) and is
   refused with a specific message on cancelled, disputed and released bookings.
4. **Ruled 2026-09-07: data-complete here, view deferred to #437.** The Vendors
   table is frame `13`'s seven columns and `frame-13-parity.test.ts` asserts the
   grid template, so an eighth column would break the parity gate #392 owns —
   a design-contract change, which a ticket may not make. So this ticket
   **supplies and tests** `stripeAccountId`, `stripeDisabledReason` and
   `stripeRequirementsDue` on `adminVendorRowSchema`, written only by the
   account webhook, and #437 draws them on the vendor detail view. A vendor
   Stripe has restricted must be distinguishable in the *data* from one who
   never onboarded; that distinction becoming visible is #437's acceptance, not
   this one's. (Same call #438 made in declining to add a vendor-table link for
   the same reason.)
5. Nothing in the console writes `stripe_onboarded`.
6. The Overview carries a payout-health count that links to the filtered list.
7. Every new number is a query result at request time — the no-invented-numbers
   law.

#### Tests (required)

- [ ] A test per acceptance, watched failing first.
- [ ] The retry asserted against a Stripe failure that is **cached** under the
      old key — the D36 regression is invisible to a test that only asserts a
      success.
- [ ] A restricted account asserted through the real `account.updated` webhook
      payload shape, not a hand-built row.

### #435: Graduated moderation — unpublish, hide and reinstate without banning

**Milestone:** M6 | **Phase:** P3 | **Priority:** P1 High | **Status:** Backlog | **Capabilities:** `core` `auth`
**Blocked by:** None

#### The state today

**Ban is the only moderation action, and it is irreversible in substance.**
`setUserBanned` declines every open booking request, cancels **and fully
refunds** every confirmed booking, and unpublishes the storefront. Unbanning
does not restore any of it — the console's own dialog says so: *"the bookings
cancelled by the suspension are not restored."* So the response to a vendor with
one bad photo, an unverified claim in a bio, or a single abusive review is either
nothing or the destruction of their live business.

There is no lever between:

- **`vendor_profiles.is_published`** has no admin writer at all. The only way the
  console can take a storefront down is to ban the account.
- **`reviews.is_public`** exists in the schema, defaults `true`, and is written
  by **nothing but `seed-demo.ts` and `seed-marketing.ts`**. The console's only
  review action is `DELETE /admin/reviews/:reviewId` — permanent, with a rating
  recalculation, no hide, no appeal, no reinstate.
- **`service_packages.is_active`** and portfolio items have no admin path.
- The review profanity filter (`reviews.service.ts`) refuses a submission at the
  door and says why it has to: *"Real moderation is a queue with a human at the
  end of it, and there is nowhere to queue to until #15 builds admin."* #15
  shipped. The queue did not.

#### What to build

**1. Unpublish and republish a storefront.**
`PUT /admin/vendors/:vendorId/publish` with a boolean, admin-only, writing
`is_published`. **This is not a ban and must not behave like one** — no requests
declined, no bookings cancelled, no refunds. The storefront comes off search and
its slug 404s; the vendor's existing bookings stand and their dashboard still
works. Say that in the confirmation dialog, in the same register as the
suspension copy, because an operator who confuses the two destroys a business by
mistake.

**2. Hide and unhide a review.** `PUT /admin/reviews/:reviewId/visibility`,
writing `is_public`. Hidden reviews leave the public profile and **are excluded
from the rating**, which means the same recomputation `deleteReviewAndRecalculate`
already performs — reach it, do not reimplement it, for the reason that file
already gives. Unhiding restores both. Deletion stays, for content that must not
persist at all; hiding becomes the default action and deletion the escalation.

**3. `is_public` becomes real on the read side.** It is currently honoured in
exactly one place (`customers.dao.ts:119`). Every public review read — the vendor
profile, the profile's review list, the rating aggregate — must respect it, or
hiding a review moves it off one surface and leaves it on three.

**4. Deactivate a package and remove a portfolio item.** `service_packages`
already has `is_active` and the portfolio already has a delete; both need an
admin-side route and both are reversible for packages, permanent for a removed
image (the R2 object goes with it — follow whatever the vendor-side delete
already does, and do not leave an orphan).

**5. Everything here writes an action row (#434) and shows the current state in
the console.** A reversible action nobody can see the history of is not
reversible in practice.

#### Acceptance

1. Unpublishing a storefront takes it off search and 404s its slug, and cancels
   nothing, declines nothing and refunds nothing.
2. Republishing restores it.
3. The unpublish dialog cannot be confused with the suspend dialog — asserted on
   the copy, because that is the whole risk.
4. Hiding a review removes it from every public read and from the rating; the
   rating matches what a deletion would have produced.
5. Unhiding restores the review and the rating.
6. `is_public = false` is honoured by the vendor profile, the profile review
   list and the aggregate — asserted on each, not on the DAO.
7. A deactivated package disappears from the storefront and from the "From"
   price, and can be reactivated.
8. Every action writes an `admin_actions` row.
9. No moderation action here bans, refunds, or touches a booking.

#### Tests (required)

- [ ] A test per acceptance, watched failing first.
- [ ] Acceptance 4's rating asserted against the number
      `deleteReviewAndRecalculate` produces for the same set — two paths, one
      answer.
- [ ] Acceptance 6 driven, not grepped: the review must be absent from rendered
      output, per the source-grep-guard failure this repo has already hit.

### #436: Reporting and message visibility for trust and safety

**Milestone:** M6 | **Phase:** P3 | **Priority:** P1 High | **Status:** Backlog | **Capabilities:** `core` `auth` `email`
**Blocked by:** #434 — a read of someone's private messages is the action that most needs a log

#### The state today

**Nothing in the product can report anything.** Grep `report`, `flag` and
`abuse` across `apps/api/src` and `packages/db/src`: there is no listing report,
no message report, no photo report, no user report, and no table to hold one.
The single inbound channel is `POST /support/messages` — a public form, rate
limited to six an hour, whose output is an email.

**And the operator cannot read the thing being reported.** `/conversations` and
`/conversations/:id/messages` are participant-only; the admin plugin has no
messaging route. A complaint that a vendor is soliciting off-platform payment,
or harassing a customer, arrives as prose in an inbox naming a conversation
nobody with authority can open. The operator's options are to believe it or not.

#### What to build

**1. A report control on the surfaces that need one.** A vendor profile, a
review, a message thread, and a portfolio image. Authenticated, one shape, one
table: reporter, subject type and id, a reason from a short enum, optional free
text, `createdAt`, disposition. Rate limited like the support form and for the
same reason.

**2. Reports land in the case queue #431 builds.** Not a second inbox. A report
is a case with a different origin, and an operator working two queues works
neither.

**3. Scoped, logged message access.** `GET /admin/conversations/:id/messages`,
admin-only, **reachable only from a case that names that conversation** — not a
free browse of every thread in the marketplace. Every read writes an
`admin_actions` row naming the conversation and the case (which is why #434 is a
prerequisite rather than a nicety). No admin write into a thread: the operator
reads, then acts through moderation or through support, and never posts as a
participant.

**4. Say so in the privacy policy.** `apps/web/content/legal/privacy.md`
currently makes no claim that staff can read messages. If they can — and to
moderate, they must — the document says so, in the placeholder register #374
already establishes, flagged for the account holder's review rather than
invented as binding text.

#### Acceptance

1. A signed-in user can report a vendor, a review, a thread and a portfolio
   image; a signed-out one cannot.
2. A report opens a case in the #431 queue with its subject resolvable to the
   real row.
3. Reports are rate limited per account, and the limit is stated to the user
   when it bites — a lane 429 must not render as the 500 page.
4. `GET /admin/conversations/:id/messages` is admin-only, refuses a conversation
   no open case names, and writes an action row on every successful read.
5. There is no admin route that writes a message.
6. The privacy policy states the access, marked as placeholder wording.

#### Tests (required)

- [ ] A test per acceptance, watched failing first.
- [ ] Acceptance 4's refusal asserted for a conversation whose case is
      **resolved**, not only for one with no case at all.
- [ ] The action row asserted for a read, which is the assertion most likely to
      be forgotten because the read succeeds without it.

### #437: Admin detail views, and the entities the console cannot see

**Milestone:** M6 | **Phase:** P3 | **Priority:** P1 High | **Status:** Backlog | **Capabilities:** `core` `auth`
**Blocked by:** #435 — measured, not assumed. A file-set trace on 2026-09-07 found the
two tickets share six files: `admin.routes.ts`, `admin.service.ts`, `admin.dao.ts`,
`vendor-table.tsx`, `admin-data.ts` and `schemas/index.ts`. They do not collide
*semantically* — #435 adds moderation writes, this adds detail reads — but
`admin.routes.ts` is one ordered list of registrations and both append to it, which
conflicts textually every time. This ticket is also a read-consumer of the states
#435 writes (`is_published`, `is_public`, `is_active`) and of #433's retired status,
so it wants them landed rather than merely merged.

#### The state today

**Seven list screens and zero detail screens.** There is no
`/admin/vendors/[id]`, no `/admin/bookings/[id]`, no `/admin/customers/[id]`.
`design/design-plan/22-admin.md` specifies *"detail views: card-based groupings
with prominent actions"* under MVP, and none were built. Frame `13` draws the
Vendors list and an ellipsis menu per row; the menu today holds exactly one item.

The cost is measurable in columns. Across all five admin row schemas, none of
these is exposed anywhere: `bookings.refund_amount_cents`,
`cancellation_reason`, `cancelled_by`, `dispute_reason`, `completed_at`,
`payout_released_at`, `payout_model`; `users.banned_at`, `deleted_at`;
`vendor_profiles.stripe_account_id`, `response_time_hours`, `service_radius_km`.
The vendor list searches by email and never displays it.

**And whole entities are absent from the console entirely:**

| Absent | Why it matters |
| --- | --- |
| `booking_requests` | **The entire pre-payment funnel.** Six statuses — pending, quoted, accepted, declined, expired, cancelled — and the operator cannot see one of them. Expiry is lazy (evaluated on read, never swept), so "how many requests died waiting" is unanswerable. |
| `service_packages` | What a vendor actually sells, and the "From" price on every storefront. |
| `portfolio_items` | The images the platform publishes on a vendor's behalf. |
| `availability` | Why a date is refused, and whether a lock is stale. |
| `notifications` | What the platform told someone, and whether they read it. |
| `categories` | `is_active` and `display_order` are seed-only; the plan's §7 matrix already grants admin CRUD, and the nav says "Categories & tags" while the screen manages tags alone. |

The plan's own authorization matrix (§7) grants admin read on booking requests,
bookings, availability and conversations, and CRUD on categories, packages and
portfolios. None of it exists.

#### What to build

**1. Detail views for vendor, customer and booking**, per `22-admin.md` —
card-based groupings, every column named above, and the row's actions promoted
into the view rather than duplicated. The vendor detail is where #432's Stripe
state and #435's publish control land; the booking detail is where the money
story is finally legible in one place.

**2. `/admin/requests`** — the pre-payment funnel, filterable by all six
statuses, showing vendor, customer, event date, quoted price, and time to
expiry. This is the first surface that can answer where the funnel leaks, and it
needs no new state: the rows are already there.

**3. Packages, portfolio and availability on the vendor detail.** Availability
shows which locks are `booked` / `pending` and what holds them.

**Two routes are already built and have no surface — wire them up here, do not
rebuild them.** #435 ships `PUT /admin/packages/:packageId/active` and
`DELETE /admin/portfolio-items/:itemId` guarded, audited and tested, but
deliberately did **not** invent a mini detail view for them, because that view is
this ticket's scope and would have been superseded on arrival. So the vendor
detail is where a vendor's packages and photos are finally listed and acted on.
Storefront publish/unpublish and review hide/unhide already reached the existing
list screens under #435 and need nothing here.

**#438 also lands an API read this ticket consumes**: `GET /admin/users/:userId/data-rights`
returns retained counts and the legal acceptance record. #438 deliberately did not
add a vendor-table link for it, because `frame-13-parity.test.ts:204` pins the
grid template off the frame and an eighth column is a design-contract change. The
vendor detail is where it belongs.

*(Restored 2026-09-07 — reverted by PR #135's stale whole-file copy. See
`.claude/memory/stale-whole-file-copy-silently-reverts.md`.)*

**4. Category management.** `is_active` and `display_order`, the same shape the
tag table already implements — that screen is the template, and reusing it is
what makes "Categories & tags" true.

**5. Notifications on the customer and vendor detail** — what was sent, when, and
whether it was read. The email half of that question is #439's.

**Frame `13` is the parity target for the list screens and must not regress.**
The detail views have no frame; build them in the console's established
vocabulary — `AdminSurface`, `DataTable`, `StatusPill`, `ConfirmAction` — and do
not invent a second visual language. Where the frame draws an ellipsis menu with
one item, a detail link is the second.

#### Acceptance

1. Vendor, customer and booking detail views exist and expose every column named
   in the table above.
2. `/admin/requests` lists booking requests filterable by all six statuses.
3. A request past `expires_at` reads as expired on this screen, matching what a
   participant's own read would show — one derivation, not a second.
4. The vendor detail shows packages, portfolio and availability.
5. Categories can be deactivated and reordered, and a deactivated category
   leaves search facets.
6. Every new screen uses the existing admin component vocabulary.
7. Frame `13`'s list screens are unchanged — parity re-verified at 1440x900.
8. Every number is a request-time query result.

#### Tests (required)

- [ ] A test per acceptance, watched failing first.
- [ ] Acceptance 3 asserted against the participant read's own answer for the
      same row, so the two cannot drift.
- [ ] Acceptance 7 is a parity pass, screenshotted, not an assertion that
      nothing was edited.

### #438: Data rights — export, account closure, and the legal acceptance record

**Milestone:** M6 | **Phase:** P3 | **Priority:** P0 Critical | **Status:** Backlog | **Capabilities:** `core` `auth` `email`
**Blocked by:** #434 — a closure and an export are the two most consequential logged actions

#### The state today

**The privacy policy makes two promises the product cannot keep.**
`apps/web/content/legal/privacy.md` tells the reader to *"ask us for a copy of
what we hold"* and that *"to close your account, ask us through Contact
support"*. There is no export endpoint, no admin-initiated deletion path, and no
screen behind either. The only deletion that exists happens if the user deletes
their own Clerk identity, which fires the webhook — and #433 documents what that
currently fails to do.

So a subject-access request arrives at `SUPPORT_EMAIL_TO` and the operator's
only recourse is a manual database query. A closure request is worse: the
operator cannot perform it at all without a privileged write, which is precisely
the thing #15's admin plugin exists to make unnecessary.

**And the platform's own evidence is unreadable.** `legal_acceptances` records
that a vendor accepted the vendor agreement — document, version, timestamp,
accepting user, name, business name, IP, user agent — and is immutable at the
database level (three triggers in `0029_sad_storm.sql`). It is the record that
answers "did this vendor agree to the 12% and the 72-hour hold". No operator can
read it. (#429 is open and orthogonal: acceptances are vendor-only, and no
customer terms acceptance is recorded at all. **Do not implement #429 here** —
this ticket surfaces what the record holds, whatever #429 makes it hold.)

#### What to build

**1. Export.** `POST /admin/users/:userId/export`, admin-only, producing a
machine-readable archive of what the platform holds for one person: their user
row, vendor profile if any, bookings and booking requests, reviews written and
received, messages, notifications, legal acceptances, and payment records with
Stripe ids. **Redact what belongs to the counterparty** — the other side's email
and phone are not the subject's data — and say in the export what was withheld
and why. Delivery follows the privacy policy's own claim; if that is by email,
the link expires.

#### Ruled 2026-09-07 (D39): closure is **refused**, not priced

The account holder ruled that an account holding a **future confirmed booking
cannot be closed at all** — the customer cancels their upcoming bookings first,
which routes them through D3's existing tiers, and no new money path is created.
Post-release is always operator-settled: the platform never claws back a
completed transfer.

**This changes what this ticket builds.** Closure here answers **409** while a
future confirmed booking exists, naming what the customer must do first. It does
not refund, and it does not price anything.

**The hard half is the Clerk self-serve path.** `<UserButton />` is mounted at
`site-header.tsx:197`, and a Clerk deletion is *reactive* — by the time
`user.deleted` reaches the webhook the identity is gone and there is nothing left
to refuse. A refusal guarding only this ticket's own route is one a user walks
around in two clicks. So this ticket must either disable self-serve deletion in
the Clerk instance and route closure through the product, or state plainly that
the webhook remains an unrefusable backstop. **Say which; do not leave it
implied.** #433's operator-settled fallback — booking left confirmed and payable,
logged for a human — stays as that backstop and is deliberately decision-free.

**2. Operator-initiated closure.** `POST /admin/users/:userId/close`, which
refuses per D39 while a future confirmed booking exists, and otherwise does
what #433 makes the deletion path do — retire the storefront, decline open
requests, cancel and fully refund future confirmed bookings — and soft-deletes
the user row. **It must reuse #433's path**, not fork it, so closure by request
and closure by Clerk converge on one behaviour. It does **not** hard-delete: the
privacy policy already states payment and booking records persist for tax and
counterparty reasons, and `legal_acceptances` cannot be deleted at all — the
`ON DELETE CASCADE` on its foreign keys would fire the `no_delete` trigger and
refuse the whole transaction. That is correct, and the ticket should verify it
rather than work around it.

**3. Legal acceptances on the console.** Visible on the vendor detail (#437) and
by user: which document, which version, when, by whom, from what address. It is
read-only by construction — the triggers see to that — and the surface should
say so.

**4. Retention, stated once.** The privacy policy claims records are kept; the
console should show a closed account's retained data rather than pretending the
account is gone. An operator asked "what do you still hold about me" needs the
same answer the export gives.

#### Acceptance

1. An export produces every category named above for one user and withholds
   counterparty contact details, naming what it withheld.
2. An export of a user with no vendor profile, no bookings and no reviews
   succeeds and is not an error.
3. Closure is **refused with a 409** while the account holds a future confirmed
   booking (D39), naming what the customer must cancel first; otherwise it runs
   #433's unwind — same code path, asserted — and soft-deletes the user.
   The Clerk self-serve deletion path is either intercepted or explicitly
   documented as an unrefusable backstop.
4. Closure of a vendor retires the storefront; their slug 404s.
5. Closure **retires** the user (`deleted_at`) and never issues a hard
   `DELETE FROM users`; a test asserts a closed account's `legal_acceptances`
   **and** `admin_actions` rows both survive it, **by counting surviving rows
   rather than catching an exception**. The database will *not* save you here:
   `0029`'s guard is `BEFORE DELETE ... FOR EACH ROW` and `RETURN OLD` from such
   a trigger means **proceed**, so a cascade succeeds — proved by
   `packages/db/src/legal-acceptance-immutability.test.ts`, green on main since
   `13e91d7`. The record survives because the closure path never hard-deletes,
   not because Postgres would stop one.
   *(Restored 2026-09-07 — reverted by PR #135's stale whole-file copy, and
   independently rediscovered by lane 438.)*
6. Legal acceptances are readable per vendor and per user, read-only.
7. Both actions write an `admin_actions` row.
8. Every claim the privacy policy makes about access and closure is now true of
   the product — asserted against the rendered document, in the shape #427's
   tests already use.

#### Tests (required)

- [ ] A test per acceptance, watched failing first.
- [ ] Acceptance 5 asserted against the real Postgres triggers.
- [ ] Acceptance 8 reads the rendered legal page, not the Markdown source.
- [ ] An export asserted to contain **no** credential, no Stripe secret, and no
      other user's email.

### #439: Transactional email delivery is invisible

**Milestone:** M6 | **Phase:** P3 | **Priority:** P1 High | **Status:** Backlog | **Capabilities:** `core` `auth` `email`
**Blocked by:** None

#### The state today

Fourteen notification types are defined (`NOTIFICATION_TYPES`) and the platform
sends mail for most of them — new request, quoted, accepted, declined, expired,
cancelled, booking confirmed, completed, cancelled, new review, payout sent,
Stripe onboarding complete, tag suggestion approved. Every send is fire and
forget: `notification-email.ts:194` catches, `:200` logs an error, and execution
continues — correctly, because a failed email must not fail the booking. But
nothing records that it happened.

The `notifications` table holds the **in-app bell only** — `userId`, `type`,
`title`, `body`, `data`, `readAt`, `createdAt`. There is no `sentAt`, no
failure reason, no provider message id, no bounce.

So *"was the customer actually told their booking was cancelled?"* cannot be
answered from the console, from the database, or from anywhere but a log search
against a process that may have rotated. On the surface where an operator is
mediating a dispute (#431) about whether someone was informed, that is the
question they will be asked.

#### What to build

**1. A delivery record per send.** Recipient user id, address, notification
type, the related entity id, `sentAt`, outcome, provider message id, and the
failure reason on a failure. One row per attempt, so a retry is visible as a
retry. Write it **beside** the send, under the same best-effort rule the file
already follows — a failure to record must never fail the operation, and must
never fail the email.

**2. Resend's delivery events.** Handle the provider's webhook for delivered,
bounced and complained, keyed by the message id, so the record reflects what
actually happened rather than what was attempted. Signature-verified like the
Stripe and Clerk handlers, and idempotent under replay. If the account holder has
not configured the webhook, the record still holds attempts — the ticket must not
depend on it.

**3. On the console.** Delivery history on the customer and vendor detail views
(#437), and on the booking detail — the emails that booking generated, in order.
Plus a bounced-address signal on the account, because an address that bounces
means every future notification to that person is lost silently.

**4. What must not be stored.** The rendered body. The record is metadata — who,
what type, when, what outcome — and a copy of every email the platform ever sent
is a liability, not an audit trail.

#### Acceptance

1. Every transactional send writes a delivery record, including a failed one.
2. A failure to write the record does not fail the send or the operation.
3. A provider delivery event updates the matching record and is idempotent under
   replay.
4. The absence of a configured provider webhook does not break sending or
   recording.
5. Delivery history appears on the customer, vendor and booking detail views.
6. A bounced address is visible on the account.
7. No record contains a rendered email body.

#### Tests (required)

- [ ] A test per acceptance, watched failing first.
- [ ] Acceptance 2 asserted by making the record write throw — the regression is
      an operation that now 500s because its bookkeeping failed.
- [ ] Acceptance 3's replay asserted against the real webhook harness.

### #440: Operator-initiated refunds and credits

**Milestone:** M6 | **Phase:** P3 | **Priority:** P1 High | **Status:** Deferred — needs a human | **Capabilities:** `core` `auth` `stripe`
**Blocked by:** The account holder — whether an operator may move money outside D3, D31 and D35, and on what authority

#### Why this is deferred rather than Backlog

Money only moves on three rails today, and every one of them is decided by a
rule rather than by a person:

- a **ban** refunds every future confirmed booking in full
  (`setUserBanned`, and deliberately full rather than D3's tiers — *"the
  platform is removing a party from a transaction the other side did nothing
  wrong in"*);
- a **customer cancellation** refunds on **D3**'s fixed tiers — 100% at or
  before 48 hours, 50% after;
- a **dispute resolved for the customer** refunds and cancels.

There is no partial refund, no goodwill credit, no fee waiver and no correction
of a mistaken charge. So every off-script case — a vendor who delivered half of
what was booked, a duplicate charge, a customer owed something for a platform
error — is settled by hand in the Stripe Dashboard, after which the `bookings`
row disagrees with the money and every admin screen reports the disagreement as
fact.

**Building this decides policy, which is why it cannot start.** Four recorded
decisions define the money rules and an operator lever is a fourth path none of
them contemplates:

- **D3** — cancellation tiers are fixed platform-wide, not vendor-configurable
  and with no admin override.
- **D31** — a cancellation is a full unwind: Stripe refund with
  `reverse_transfer` and `refund_application_fee`, the vendor's balance may go
  negative, and there is no admin exemption to partial refunds.
- **D35** — the payout hold is 72 hours after the event, with no override.
- **D37** — under separate charges, every proportional split must be written
  down.

A partial refund contradicts D31's shape directly. A goodwill credit needs a
funding answer — platform or vendor — that no decision supplies. A fee waiver
changes what D37 requires to be written down.

#### What the account holder needs to decide

1. **May an operator move money outside the three rails at all?** If no, this
   ticket closes and the Stripe Dashboard remains the escape hatch — in which
   case #431's case detail should link out to it and say plainly that the
   console does not reconcile what happens there.
2. **If yes: partial refund, goodwill credit, fee waiver — which of the three?**
   They have different funding and different tax consequences.
3. **Who pays?** A refund beyond what the customer is owed under D3 comes out of
   the platform's fee, the vendor's payout, or both, and the split has to be
   stated before it can be written down (D37).
4. **What authority is required?** A single admin, or two? The role model is
   flat — **D4** gives one immutable role per account — so a second-approver
   requirement is itself a new decision.
5. **What does the customer and the vendor get told?** Every existing money
   movement sends mail; an operator-initiated one needs its own copy or it is a
   silent adjustment to someone's bank account.

#### What to build once decided

Record the answer as a **new decision entry** in
`.claude/plans/vendor-marketplace-decisions.md` first — that is the deliverable
that unblocks this row. Then the lever itself: admin-only, on the booking
detail (#437), through the existing payment service rather than a second money
path, versioning its idempotency key by attempt (**D36** — `request_log_url` is
the tell that a cached failure is being replayed), writing an `admin_actions`
row (#434), and notifying both parties.

**Do not build any part of this before the decision exists.** A money path
implemented against a guessed policy is the one kind of code in this repository
that cannot be corrected by a later ticket.

### #441: The site footer against the newer frame, and the ink-ground text ramp used as a border

**Milestone:** M3 | **Phase:** P1 | **Priority:** P2 Medium | **Status:** Backlog | **Capabilities:** `core`
**Blocked by:** None

**Filed 2026-09-07 by the parity pass on #430**, which compared the closing band
_and_ the footer against `design/delta-band/Orla-Closing-Band.html`. The band is
done (`aac9b3b`, PR #134). Everything below is the footer, and **none of it is a
regression**: these are #428-era values measured against a frame #428 never saw.
#430 deliberately left them rather than widening a revision into a restyle.

Two different mechanisms live here, and they are one ticket because a single lane
opens the same two files for both.

### #442: A repeat Terms acceptance can write two permanent rows — rule what the record means, then close the race

**Milestone:** M6 | **Phase:** P3 | **Priority:** P1 High | **Status:** Backlog | **Capabilities:** `core` `auth`
**Blocked by:** The account holder — see the ruling below

**Filed 2026-09-07** from #429's `security-auditor` pass. The lane found it,
wrote it up as **D38**, and deliberately left it open, which was the right call:
the fix decides a product question.

#### What is wrong

`acceptTerms` in `apps/api/src/modules/legal/terms.service.ts` does a
**check-then-insert**: it reads whether this user already holds the current
version, and if not, inserts. Nothing at the database level enforces the
invariant that read is protecting, so two submissions racing from one session
can both pass the check and both insert.

The table is `legal_acceptances`, which a database trigger makes **immutable** —
no update, no delete. So a duplicate is not a row someone can tidy up later. It
is permanent, and it sits in the one table whose entire purpose is to be
evidence.

#### Why it was not simply fixed

The obvious remedy is a unique index on `(accepted_by_user_id, document,
version)`. That **overturns a ruling #427 made deliberately**: a second
acceptance of a version already held *is* a second row, because *"I accepted it
twice"* is a true statement about what happened, and a record built to say what
happened should not silently collapse two acts into one.
`packages/db/src/legal-acceptance-immutability.test.ts` asserts that behaviour
directly, so the index and the test cannot both stand.

**The question for the account holder, stated plainly:** when the same person
accepts the same version of the same document twice, should the record show one
acceptance or two?

- **One row** — the record answers *"what is this person bound by"*. Add the
  unique index, let the second insert lose harmlessly, and amend #427's test.
- **Two rows** — the record answers *"what did this person do, and when"*.
  Keep the current meaning and close the race a different way: a transaction
  with the right isolation, or an advisory lock keyed to the user and document,
  so a genuine repeat acceptance minutes apart still records two rows while two
  submissions of one click record one.

Either is defensible. What is not defensible is leaving a race open in an
append-only evidence table because the question was never asked.

#### Scope, once ruled

- **Both writers, not just the new one.** The vendor agreement has had the
  identical shape since #427; #429 only widened the record from vendors to every
  user. Fixing `acceptTerms` and leaving `acceptAgreement` alone fixes half of it.
- **D38 is the write-up** and should be amended with the ruling rather than
  duplicated.
- The `document_sha256` manifest and the clickwrap gate are **not** in scope —
  both shipped in #429 and are correct.

#### Acceptance

1. Two concurrent submissions of one acceptance produce exactly the outcome the
   ruling specifies — one row or two — and the assertion names which ruling it
   is enforcing.
2. The same holds for `acceptAgreement` on the vendor agreement.
3. A genuine repeat acceptance after a version bump still writes a new row under
   either ruling; the fix must not block the case the table exists for.
4. `legal-acceptance-immutability.test.ts` either still asserts #427's meaning or
   is amended in the same commit that overturns it — never left contradicting the
   schema.
5. Immutability still holds, proven by attempting an update and a delete.

#### Tests (required)

- [ ] A **contention test** on real Postgres, not PGlite. This is a race: PGlite
      is a single connection and cannot tell a lock from its absence, so a
      passing `pnpm test` here would prove nothing. `pnpm test:contention`.
- [ ] The race reproduced **failing first** — two writes landing today — then
      passing after the fix.
- [ ] Both writers covered, in separate cases.
- [ ] A version-bump case, so the fix is shown not to have closed the door on
      legitimate re-acceptance.

### #443: Frame `13`'s parity residue, including two access findings nothing else checks

**Milestone:** M6 | **Phase:** P3 | **Priority:** P2 Medium | **Status:** Backlog | **Capabilities:** `core` `auth`
**Blocked by:** None

**Filed 2026-09-07 from #433's parity pass**, which returned **MATCH on all six
axes** for the change it was verifying and correctly declined to attribute these
six to itself. They are pre-existing drift on the admin console, batched by
surface rather than filed as six rows.

**Two of them are access findings, and that is why this is not a cosmetic
ticket.** `web-design-parity.md` says the parity pass is the *only* gate on the
six accessibility laws in `04-laws.md` and the contrast table in
`01-foundations.md` — nothing else in this repository verifies either. So an
access finding that is not filed does not get caught somewhere else later; it
simply evaporates with the session that found it.

#### The six

**Access — fix these first:**

1. **The search field has an `aria-label` but no visible `<label>`.** A visible
   label is the requirement; an `aria-label` satisfies a screen reader and leaves
   a sighted user with a bare box whose purpose is carried only by placeholder
   text that disappears on focus.
2. **The row checkbox is 22x44.** `04-laws.md` sets a 44px minimum target and the
   horizontal axis is half that. The row is already 44px tall, so this is a
   width fix, not a layout change.

**Style and type:**

3. **The header is 1px short** of the frame.
4. **The wordmark renders 24px against the frame's 23px.**
5. **The four filter dropdowns carry a 2px horizontal padding asymmetry** — a
   vestige of the caret D25 removed. Correct the padding; **do not restore the
   caret**. D25 has been re-filed four times and `dropdown-caret.test.ts`
   enforces its absence everywhere except the one exempt file.

**Content:**

6. **The filtered empty state has no CTA.** Every other empty state in the
   console offers the way out; this one states the condition and stops.

#### Corroborate before building

**D30 binds.** The frames are trustworthy as composition, not as arithmetic, and
every number above is transcribed from one pass. Read frame `13` at the widths
either side before changing a measurement — a value disagreeing with both
neighbours is the middle frame being wrong, not a ladder step.

**Read the live-overrides list in `.claude/rules/web-design-parity.md` first.**
Frame `13` currently carries three: the `Florals` sample data in its table rows
and filter pill (#419), the missing `···` on a retired vendor's row (#433), and
the fourth `Status` dropdown, whose growth #433 measured as acceptable —
`Export CSV` lands at x=1347.1 against the frame's 1348.1, so the right anchor
held. None of those is a finding.

#### Acceptance

1. The search field has a visible `<label>`, and the empty state offers a way out.
2. The row checkbox meets the 44px minimum on both axes.
3. Header height, wordmark size and dropdown padding match the frame, each value
   corroborated against the neighbouring widths before it is changed.
4. The caret is still absent from all four dropdowns — asserted, because
   "correct the padding" is one edit away from restoring it.
5. Frame `13` still matches on all six axes at 1440x900, with the three live
   overrides untouched.

#### Tests (required)

- [ ] A test per acceptance, watched failing first.
- [ ] The two access findings asserted against rendered output, not source — a
      `className` substring check is not a measurement of a hit area.
- [ ] The parity pass delegated to `parity-checker`, not eyeballed.

### #444: An unwind declines the accepted request behind a completed booking

**Milestone:** M6 | **Phase:** P3 | **Priority:** P1 High | **Status:** Backlog | **Capabilities:** `core` `auth`
**Blocked by:** None

**Filed 2026-09-07 by lane #438**, which tripped over it while building account
closure, verified it was pre-existing rather than its own, pinned the current
behaviour in a test with a comment, and correctly declined to widen its scope to
fix it. Confirmed independently against the code before filing.

#### The defect

`declineOpenRequests` (`apps/api/src/modules/admin/admin.dao.ts:484`) writes:

    .set({ status: 'declined', updatedAt: now })
    .where(and(inArray(bookingRequests.status, ['pending', 'quoted', 'accepted']), sides))

`accepted` is in that set unconditionally. But an accepted request is exactly the
one that **has a booking behind it** — `accepted` is the status a request holds
after checkout, and `bookings` carries a unique index on `request_id` precisely
because one accepted request becomes one booking.

So an unwind flips the accepted request behind an **already-completed** booking
to `declined`. The event happened, the vendor was paid, and the customer's
requests screen now says the request was declined. That is rewriting history, not
unwinding it.

**It is reachable today and it is not new.** `unwindAccountBookings` is called
from `setUserBanned` — so any ban does this — and now also from the `user.deleted`
path (#433) and account closure (#438). It predates all three.

The neighbouring code gets this right and is the model: `findConfirmedBookingsToUnwind`
bounds on `status = 'confirmed' AND event_date > today`, so it only ever touches
bookings that have not happened. The request decline has no equivalent bound.

#### What to build

**Narrow the predicate so an accepted request whose booking is settled is left
alone.** The rule the rest of the unwind already follows is "unwind what has not
happened yet", so an accepted request should be declined only where its booking
is one the unwind is itself cancelling — or where there is no booking at all,
which is the genuine mid-checkout case.

Do not simply drop `accepted` from the list: a request that was accepted but
never paid for is a real open commitment and should still be declined, or the
vendor is left holding a date for an account that no longer exists.

**Decide and state what the customer's screen should say** for a request whose
booking the unwind *did* cancel. `declined` is arguably wrong there too — the
vendor did not decline it, the platform cancelled it — but `BOOKING_REQUEST_STATUSES`
has no member for that, and adding one is a schema and design change. If the
honest answer is that the existing vocabulary cannot express it, say so in the
ticket rather than picking the least-wrong word silently.

#### Acceptance

1. An unwind leaves the `accepted` request behind a **completed** booking
   untouched, and a test asserts the status is unchanged.
2. An unwind still declines an `accepted` request with **no** booking behind it.
3. An unwind's treatment of an `accepted` request whose booking it cancelled is
   deliberate and documented at the predicate, not incidental.
4. `pending` and `quoted` are unaffected.
5. Asserted through **`setUserBanned`**, not only through the newer closure
   path — the ban is where this has been reachable longest.
6. #438's test pinning the current behaviour is updated rather than deleted, so
   the change is visible as a change.

#### Tests (required)

- [ ] A test per acceptance, **watched failing first** — this is a bug fix, so
      the failing test is the evidence the defect was real.
- [ ] The completed-booking case asserted against a real completed booking, not
      a row hand-set to `completed`, so the fixture cannot drift from what the
      payment path actually produces.

### #445: A failed query logs every bound parameter, and the redact list cannot reach it

**Milestone:** M6 | **Phase:** P3 | **Priority:** P0 Critical | **Status:** Backlog | **Capabilities:** `core`
**Blocked by:** None

**Filed 2026-09-07 after two lanes hit it independently** — #431's security pass
and #439's review — which is what makes it a shape rather than an incident.
Neither was looking for it.

#### The defect

Drizzle 0.45.2 wraps a failed statement in a `DrizzleQueryError` whose `message`
is `Failed query: … params: <every bound parameter>`, **and** which carries
`params` as an **own enumerable property**. Pino's `err` serialiser copies own
properties. So any `log.*({ err })` on a failed query writes every bound value
of that statement into the log stream.

**`server.ts`'s redact list cannot help.** It is path-based on `req.headers.*`
and never reaches a property hanging off a serialised error.

**It is caller-triggerable, which is what makes it P0 rather than hygiene.**
#431 found the reachable instance: `freeText()` does not strip `U+0000`,
Postgres refuses that with `22021`, and the insert is on the **public,
unauthenticated** `POST /support/messages` — so a stranger chooses when the
write fails, six times an hour, and up to 4,000 characters of what they typed
plus their reply-to address goes into the logs. Every field on that form is
user-supplied.

#### Why a per-call-site fix is not the answer

Both lanes fixed their own write paths — #431 now logs the driver code and never
the error, #439 avoided the shape on its path. That is three hand-written
guards across the API and no law, which is the same trajectory the colour-role
class is on (#446). The next `log.error({ err })` written against a query
failure reintroduces it, and nothing fails.

#### What to build

**A serialiser-level fix, so the guard is structural rather than remembered.**
Options, in the order worth trying:

1. **A custom pino `err` serialiser** that strips `params` and truncates
   `message` at the `params:` boundary for `DrizzleQueryError`, applied once at
   the logger. Every existing and future call site is covered without edits.
2. Failing that, a narrow error-mapping helper every DAO catch uses, plus a lint
   rule or a source guard that fails on `{ err }` in a catch around a query.

**Assert it over the whole serialised output, not field by field.** The
prohibition is "no bound parameter appears anywhere in what is logged" — the
same shape #434's `admin_actions` content test uses, and for the same reason: a
field-by-field check passes while the payload leaks through a field nobody
listed.

**Do not widen `freeText()` to strip `U+0000` and call it done.** That closes
the one reachable trigger and leaves the class open — any query failure on any
user-supplied value still leaks. Fix the sink; narrowing the source is a
defence-in-depth extra, worth doing second.

#### Acceptance

1. A failed query logged via `log.*({ err })` emits **no bound parameter** —
   asserted against the whole serialised record, not named fields.
2. The `message` no longer carries the `params:` tail.
3. The driver error code and the statement's identity are still logged, so the
   failure remains diagnosable.
4. A `U+0000` payload to `POST /support/messages` leaks nothing, driven through
   the real route.
5. The guard is structural — a new `log.error({ err })` around a query written
   after this ticket is covered without the author knowing about it.

#### Tests (required)

- [ ] A test per acceptance, **watched failing first** against the current
      serialiser — this is a security fix, so the failing test is the evidence.
- [ ] Acceptance 1 asserted by searching the serialised output for a sentinel
      value bound into the failing statement, rather than by inspecting keys.
- [ ] Acceptance 4 driven end to end through the public route, not by calling
      the DAO.
