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
| **374** | **Launch legal, policy and support surfaces** | P3 | M6 | **P0 Critical** | **Deferred — needs a human** | — | **The account holder: (1) the operative wording of the terms, privacy policy and vendor agreement — a ticket must not invent binding text; (2) a real monitored support address or destination** | `core` | **Filed 2026-08-31.** Not a consolidation — a gap nobody had filed. `docs/pre-launch.md` §1.5 and §7 require terms, a privacy policy, a cookie notice, a vendor agreement covering the 12% commission and payout timing, a refund and cancellation policy shown **before** payment, and a support route that reaches a human. **None of those routes exist in `apps/web/src/app`.** The product cannot take money from strangers without them. |
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
| **422** | **One image fallback, everywhere — a broken image must degrade the way an absent one does** | P1 | M3 | **P1 High** | **Backlog** | — | **None** | `core` `storage` | **Filed 2026-09-06 on the account holder's instruction**, verbatim: *"there should always be a fallback image for a broken or blank image no matter where - card, profile pic, etc. anywhere pictures are used"*. **The design already exists and is ruled** — D17 and D18, drawn in frame `26 State library`: a **neutral tone block** at `stone-250 #ece6dc`, the image's exact dimensions and the container's radius, nothing inside it. The token is already minted. **What is missing is the failure half.** The app handles *absent* — a published vendor with no `coverImageUrl` gets the block — but **nothing anywhere handles a load failure**: `grep onError` across `avatar.tsx`, `stock-photo.tsx`, `vendor-card.tsx`, `profile-header.tsx` and `portfolio-pane.tsx` returns nothing. A URL that exists and 404s, a bucket that is down, or a category card whose file was never shipped all render a browser-broken-image glyph on a public page. **The hatch is not the answer** — `03-components.md` and D17 both forbid it on a live surface. One shared mechanism, applied at every site that renders an image |
| **423** | **Hold the money until the event has happened — separate charges and transfers, a dated release, and a dispute hold** | P1.5 | M4.5 | **P0 Critical** | **Backlog** | — | **None** | `core` `stripe` | **Filed 2026-09-06 on the account holder's ruling.** Today checkout is a **destination charge**: `transfer_data.destination` splits the money the instant the card succeeds, so a vendor booked for an event in March is paid in January and `createRecipientAccount` sets no payout schedule. **Replaces it with separate charges and transfers**, the Airbnb model adapted to single-day events: the customer pays into **Orla's** balance, and a scheduled job transfers the vendor's share **a fixed window after the event date** — not when anyone clicks a button. **The release is keyed to the date, never to a party's action:** the vendor is the one who benefits from marking a booking complete, so it proves nothing, and a vendor who forgets would strand the money forever. **A customer complaint pauses the release** — `disputed` already exists in `BOOKING_STATUSES` and is unused. **This also simplifies refunds:** before release nothing has been transferred, so a cancellation is a plain refund with no `reverse_transfer` and no way to push a vendor negative, which is the consequence D31 had to accept. **This is the money path — the bar is that every test drives the real state machine, not a mock that agrees with itself.** #416 shipped a refund that had never once worked, for months, because the double was more permissive than the gateway |
| **424** | **Vendor dashboard: a pending payout with a real date, and an honest held state** | P1.5 | M4.5 | **P1 High** | **Backlog** | — | **#423** — it owns the release date, the held state and the API read this surface renders | `core` `stripe` | **Filed 2026-09-06 on the account holder's instruction**, split out of #423 so the money mechanics and the surface that reports them are separate reviewable units. The dashboard's payout line reads **`Paid out after each event`** — a dateless sentence chosen in #308 precisely because there was no payout schedule to read a date from. **#423 creates one.** This ticket replaces the sentence with a real amount and a real date, and says so when a dispute is holding it. **Every number here is read from the booking row at request time** — the amount is the stored `vendorPayoutCents`, never a recomputed fee, and the date is derived from the event date and `PAYOUT_RELEASE_HOURS`. **A payout figure that disagrees with what Stripe moves is worse than no figure at all**, which is why this carries the same testing bar as #423 rather than a lighter one |
| **425** | **A customer has no way to report a problem with a booking** | P1.5 | M4.5 | **P1 High** | **Backlog** | — | **#423** (owns the `disputed` hold and the release window a report has to land inside) | `core` | **Filed 2026-09-06 on the account holder's instruction.** Measured first: **nothing in the web app lets a customer raise anything about a booking** — no dispute control, no `Report a problem`, no route — and **nothing anywhere writes `disputed`**, which appears only in read predicates in `customers.dao.ts` and `dashboard.dao.ts`. So the status #423 uses as its payout hold has no way to be reached by the person it exists for. Adds the entry point on the customer's booking, routed to **`/support` prefilled with that booking's context** — the pattern #421 already built for frame `16`, where an error's digest travels in `searchParams` and renders as attached, non-editable context. **The report is what places the hold**, so this is on the money path and carries the same testing bar: a report that silently fails to hold a payout is worse than no button |
**This board carries open work only, and closed rows are now DELETED rather than kept.** Changed 2026-09-06 on the account holder's instruction: *"clear out all completed tickets - delete them - no need to maintain any memory of them - it is confusing new tickets."* 33 closed rows and their 33 detail sections were removed in one commit, taking the file from 4,115 lines to under 1,100. **The registry in `packages/shared/src/env/tickets.ts` was NOT touched** — its ids must stay contiguous from 0, and `pnpm preflight --ticket <old n>` still gates correctly for any older branch or commit message. `git log` holds the deleted prose if it is ever wanted; nothing else does. **The pre-2026-08-30 archive still exists** at `.claude/plans/vendor-marketplace-tickets-archive.md` and is read by `tickets.board.test.ts` alongside this file — it was left alone because it is a separate file that no longer competes with open work for a reader's attention.

Rows are ordered by build sequence, not by ticket number. **Recounted programmatically 2026-09-06 after #423-#425 were filed: 7 rows — 5 Backlog and 2 `Deferred — needs a human`.** Startable now: **#422** and **#423**. #424 and #425 both wait on #423, which owns the release date and the `disputed` hold they read; #370 waits on #362; #362 and #374 need the account holder. **Do not hand-maintain this number, recount it.**
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

### #422: One image fallback, everywhere — a broken image must degrade the way an absent one does

**Milestone:** M3 | **Priority:** P1 High | **Status:** Backlog | **Capabilities:** `core` `storage`
**Blocked by:** None

**Filed 2026-09-06 on the account holder's instruction**, verbatim: *"there
should always be a fallback image for a broken or blank image no matter where -
card, profile pic, etc. anywhere pictures are used"*.

#### The design is already ruled — do not invent one

**D17 and D18, drawn in frame `26 State library`.** A **neutral tone block**:

- `stone-250` **`#ece6dc`** — already minted in `packages/config/tailwind/theme.css`,
  commented *"image ground — behind every cover, and a coverless one"*;
- the image's **exact dimensions** and the container's own radius;
- **nothing inside it.** No hatch, no monospace label, no upload prompt, no icon.

**The hatch is explicitly forbidden here.** `03-components.md` and `40-states.md`
both say so: it is a build-time device for photography *the product* lacks, and
showing it on a live surface reads as an unfinished product rather than an
unfinished profile. *"The person reading is not the person who can fix it."*

The avatar has its own ruled fallback and it is **not** this block:
`--color-clay-150 #eadccb` behind a monogram, in Instrument Sans below the 16px
serif floor (D24). Keep that; do not replace avatars with tone blocks.

#### What is actually missing — the failure half

The **absent** case is handled: a published vendor with no `coverImageUrl` gets
the block, per D17.

The **failure** case is handled nowhere. `grep onError` across `avatar.tsx`,
`stock-photo.tsx`, `vendor-card.tsx`, `profile-header.tsx` and
`portfolio-pane.tsx` returns **nothing**. So today:

- a stored key whose object is gone renders the browser's broken-image glyph;
- an R2 outage renders it on every card at once;
- `StockPhoto` is a `next/image` with no fallback, so a category file that was
  never shipped is a broken front door — **found 2026-09-06** when `carts` had
  no art, and guarded since by `landing-category-art.test.ts`.

**An absent image and a failed one look identical to the person reading.** They
must therefore land in the same place.

#### Where it has to apply

Every site that renders an image. At filing these were `avatar.tsx`,
`stock-photo.tsx`, `vendor-card.tsx`, `profile-header.tsx`, `portfolio-pane.tsx`,
`photo-cluster.tsx`, `image-upload.tsx`, `portfolio-manager.tsx`,
`bookings-hub.tsx` and `request-summary-rail.tsx` — **re-grep rather than trust
that list**, and prefer one shared mechanism over ten call sites each remembering
to handle it.

Note the two rendering paths differ and both need covering: `next/image` (the
stock and category art) and plain `<img>` (bucket content, which skips
`next/image` deliberately because the host changes between environments).

#### Acceptance

1. An image that fails to load renders the ruled fallback for its kind — tone
   block for covers and card art, monogram for avatars — not a browser glyph.
2. An absent image and a failed one are indistinguishable to the reader.
3. The fallback holds the element's exact dimensions, so nothing reflows when a
   load fails.
4. No hatch and no developer-facing label on any public surface.
5. One shared mechanism; a new image site inherits it without opting in.

#### Tests (required)

- [ ] A test per acceptance, each watched failing first.
- [ ] **Drive an actual load failure**, not a nulled prop. A test that passes a
      missing `src` proves the *absent* path, which already works — point a real
      `src` at something that 404s. The whole defect is that the two paths differ.
- [ ] Assert extent alongside the fallback: a tone block on a zero-height box has
      passed on nothing (`web-design-parity.md`).

### #423: Hold the money until the event has happened — separate charges and transfers, a dated release, and a dispute hold

**Milestone:** M4.5 | **Phase:** P1.5 | **Priority:** P0 Critical | **Status:** Backlog | **Capabilities:** `core` `stripe`
**Blocked by:** None

**Filed 2026-09-06 on the account holder's ruling**, after comparing against
Airbnb: *"lets steal that airbnb payment functionality - airbnb however service
start/end doesnt matter here as much since stays are for days and vendors are
typically for 1 day."*

#### What happens today, read from the code

`createPaymentIntent` (`apps/api/src/lib/stripe.ts:446`) builds a **destination
charge**:

```
application_fee_amount: <12%>,
transfer_data: { destination: <vendor connected account> },
```

Stripe splits that **at the moment the card succeeds**. The vendor's 88% lands
in their connected-account balance immediately, and `createRecipientAccount`
sets **no `payout_schedule`**, so Stripe's automatic payouts move it to their
bank on the default rolling schedule. **A vendor booked for an event in March is
paid in January.** The event date is not involved.

`markComplete` (`payments.service.ts:535`) exists, is vendor-only, and correctly
refuses while the event is still ahead everywhere on Earth — but it **moves no
money**. It sets a status and sends a notification.

#### The model this adopts

Airbnb holds the guest's money and pays the host about 24 hours **after
check-in** — keyed to a date, never to the host confirming anything. Adapted
here, where an event is a single day rather than a multi-night stay:

1. The customer pays into **Orla's** balance. No `transfer_data`, no
   `application_fee_amount` on the intent.
2. A scheduled job transfers the vendor's share **`PAYOUT_RELEASE_HOURS` after
   the event date**, and Orla keeps its commission.
3. A customer complaint inside that window **holds the transfer** until it is
   resolved.

**The release is keyed to the date, never to a party's action.** This is the
central design decision and it is deliberate: the vendor is the party who
benefits from pressing `Mark complete`, so it evidences nothing about whether
the event happened, and a vendor who never presses it would strand the money
with no owner. `markComplete` stays as a status signal and a review prompt. **It
must not gate the transfer.**

#### Why this also makes refunds safer

D31 accepted a real consequence: a full unwind reverses the vendor's transfer,
which can drive a vendor who has already been paid out to a **negative
balance**. Under separate charges and transfers, **a cancellation before release
has nothing to reverse** — the money never left Orla. So:

- before release: a plain `refunds.create`, no `reverse_transfer`, no
  `refund_application_fee`, no possibility of a negative vendor balance;
- after release: the existing `REFUND_UNWIND` path, unchanged.

**Both paths must exist and the boundary between them is the release.** Do not
delete the unwind — a booking cancelled after release still needs it.

#### What already exists and must be used, not rebuilt

- `bookings.stripeTransferId` — a column that is **currently always null**,
  because a destination charge's transfer is implicit. It becomes the record of
  the real transfer.
- `bookings.vendorPayoutCents` and `platformFeeCents` — already stored at the
  rate in force when payment succeeded. **Transfer that stored figure, never a
  freshly computed one**, or a fee-rate change silently repricks old bookings.
- `bookings.completedAt`, `cancelledAt`, `refundAmountCents`, `cancelledBy`.
- **`disputed` is already in `BOOKING_STATUSES` and is unused.** It is the hold
  state; do not invent another.
- `FULL_REFUND_CUTOFF_HOURS = 48` and `LATE_CANCELLATION_REFUND_RATE = 0.5`
  (D3). **This ticket does not change the tiers**, only what a refund has to
  reverse.

#### What does not exist yet

- **Any scheduler.** There is no cron in this repo — `railway.json` has only a
  `preDeployCommand`, and the one `setInterval` is an SSE heartbeat. Decide the
  mechanism and say why: a Railway cron service, or a loop in the API with a
  database lock. **It must be safe to run twice.**
- A **release state** on the booking. `status` cannot carry it — a booking is
  `confirmed` both before and after release. Add an explicit column (a
  `payout_released_at`, or a small enum) rather than inferring it from
  `stripeTransferId` being non-null, so a failed transfer is distinguishable
  from one never attempted.
- `PAYOUT_RELEASE_HOURS` as a named constant beside the refund tiers.

#### Acceptance

Every one of these is a test, and each must be driven through the real state
machine rather than asserted against a mock.

**Charge**

1. A successful checkout creates an intent with **no `transfer_data`** and **no
   `application_fee_amount`**; the full amount lands in the platform balance.
2. The booking records `totalAmountCents`, `platformFeeCents` and
   `vendorPayoutCents` exactly as it does today, and `stripeTransferId` is null.

**Release**

3. A booking whose event date is more than `PAYOUT_RELEASE_HOURS` in the past,
   status `confirmed`, not released, gets exactly one transfer of
   **`vendorPayoutCents`** — the stored figure — to the vendor's connected
   account, and `stripeTransferId` and the release timestamp are written.
4. A booking inside the window is **not** transferred.
5. **Running the job twice transfers once.** Assert on the number of transfer
   calls, not just the final row state.
6. A booking the vendor never marked complete **still releases**. This is the
   defining case: `markComplete` must not appear anywhere in the release
   predicate.
7. A transfer that fails leaves the booking releasable and records the failure;
   the next run retries it. A failed transfer must never be indistinguishable
   from a completed one.

**Dispute hold**

8. A customer can raise a dispute on a `confirmed` booking whose event date has
   passed and which is **not yet released**.
9. A `disputed` booking is **skipped** by the release job for as long as it is
   disputed, with no time limit that would release it out from under an open
   complaint.
10. Resolving a dispute in the vendor's favour makes it releasable again on the
    next run; resolving it in the customer's favour refunds without a transfer
    ever having happened.
11. A dispute raised **after** release is refused with a message saying so, or
    routed to the existing post-release refund path — decide which, and say why
    in the ticket notes.

**Refund boundary**

12. Cancelling **before** release issues a plain refund: no `reverse_transfer`,
    no `refund_application_fee`, no transfer reversal, and the vendor's balance
    is untouched.
13. Cancelling **after** release uses the existing `REFUND_UNWIND` and still
    passes every #416 assertion.
14. The 48h / 50% tiers behave exactly as they do today on both sides of the
    boundary. `refundAmountCents` records what actually moved.

**Surfaces**

15. Every value the vendor dashboard needs to show a pending payout is
    **readable from the booking row** — the amount, the release date and
    whether a dispute is holding it — without the surface recomputing a fee or
    inferring a date. **Building that surface is #424**, filed separately at the
    account holder's request; this ticket owes it a truthful source, and an API
    read that exposes those three things.
16. A held payout is distinguishable from a pending one **in the data**, not
    only by inspecting `status`.

#### Tests (required) — this is the money path

- [ ] A test per acceptance, each **watched failing before and passing after**.
- [ ] **The double must reject what Stripe rejects.** #416 shipped a refund that
      had never once worked, for months, because `test-server.ts`'s fake
      `createRefund` recorded the call instead of judging it. The transfer
      double must refuse an invalid transfer the way the gateway does, and #416's
      pattern — build the real params, throw Stripe's own message — is the model.
- [ ] **Idempotency proved by call count**, not by end state. A second run that
      no-ops because the row already changed is not the same as one that never
      issues the second transfer.
- [ ] **Concurrency covered in `*.contention.test.ts`**, on real Postgres. Two
      release runs racing the same booking is exactly the shape PGlite cannot
      tell apart — a single connection cannot distinguish a held row lock from
      its absence. `pnpm test` alone is not evidence here.
- [ ] A **browser pass** driving a real Stripe test-mode payment end to end, then
      the release, then a cancellation on each side of the boundary.

#### Deliberately out of scope

- Changing the refund tiers (D3) or the commission rate.
- Instalments, deposits or split payments — Post-MVP.
- A dispute *resolution* UI beyond what the hold needs. Admin already has the
  surfaces; do not build a case-management product.

#### Rulings the account holder still owes, if they surface

- **`PAYOUT_RELEASE_HOURS`** — 24 or 48. Airbnb uses ~24 after check-in.
- **Whether Orla holding customer funds** raises a compliance question in the
  jurisdictions it operates in. Separate charges and transfers is a standard,
  supported Connect pattern, but the platform becomes responsible for negative
  balances. Flag it; do not decide it in code.

### #424: Vendor dashboard — a pending payout with a real date, and an honest held state

**Milestone:** M4.5 | **Phase:** P1.5 | **Priority:** P1 High | **Status:** Backlog | **Capabilities:** `core` `stripe`
**Blocked by:** **#423** — it owns the release date, the held state, and the API read this renders.

**Filed 2026-09-06 on the account holder's instruction**, split out of #423 so
the money mechanics and the surface reporting them are separate reviewable
units. **Do not start it before #423 lands**: every number here comes from
columns that ticket creates.

#### Why the current line says what it says

The dashboard reads **`Paid out after each event`** — dateless, and deliberately
so. `constants/index.ts` records the reasoning: frame `08` draws `Next payout
Jun 18`, a real date, and #308 could not ship one *"because there is no payout
schedule to read one from until #10, and a date the platform invents is exactly
what the no-invented-numbers rule forbids."*

**#423 creates the schedule.** So the frame's Text axis, open since #308, can
finally be closed honestly rather than by inventing a date.

#### What to show

- The **amount**: the stored `vendorPayoutCents` for each unreleased booking.
  **Never a recomputed fee** — the commission rate in force when payment
  succeeded is already written to the row, and recomputing would silently
  reprice old bookings if the rate ever changes.
- The **date**: derived from the event date and `PAYOUT_RELEASE_HOURS`.
- A **held** state when a dispute is holding a payout, saying that it is held.
  Per `40-states.md`, **gold is waiting on someone; red is a failure.** A held
  payout is waiting, not failed.

#### Acceptance

1. A vendor with unreleased bookings sees the summed pending amount and the next
   release date, both read from booking rows at request time.
2. The amount equals the sum of `vendorPayoutCents` for exactly the bookings that
   are unreleased and not cancelled. Assert the figure, not that a figure exists.
3. The date is the earliest release date among those bookings, derived — not
   stored twice, and not invented when there are none.
4. A vendor with nothing pending sees an empty state, not `$0` and not a stale
   date.
5. A booking held by a dispute is shown as held, in gold, and is **excluded from
   the "next release" date** — it has no known date.
6. A released booking leaves the pending figure on the next read.
7. **The figure reconciles with Stripe.** A test asserts the dashboard number
   equals what the release job would transfer for the same rows — the two must
   not be able to disagree.

#### Tests (required)

- [ ] A test per acceptance, each watched failing first.
- [ ] **Assert specific amounts and dates**, never `toBeTruthy()`. This is a
      money figure a vendor will plan around.
- [ ] A test covering the **rate-change case**: a booking written at one
      commission rate still shows its stored payout after the rate changes.
- [ ] Deterministic dates — no real clock. #409 is the precedent: the server's
      UTC day is not the viewer's day.

### #425: A customer has no way to report a problem with a booking

**Milestone:** M4.5 | **Phase:** P1.5 | **Priority:** P1 High | **Status:** Backlog | **Capabilities:** `core`
**Blocked by:** **#423** — it owns the `disputed` hold and the release window a report must land inside.

**Filed 2026-09-06 on the account holder's instruction:** *"allowing a customer
to dispute (this can happen directly via clicking a dispute or have a problem
from the booking as a customer - and maybe take them to the customer support
page? prefilled with that bookings info?)"*

#### Measured before filing

- **Nothing in the web app lets a customer raise anything about a booking.** No
  dispute control, no `Report a problem`, no route.
- **Nothing anywhere writes `disputed`.** It appears in `BOOKING_STATUSES` and in
  read predicates in `customers.dao.ts` and `dashboard.dao.ts`, and nothing sets
  it.

So the status #423 relies on as its payout hold is currently unreachable by the
person it exists to protect.

#### The shape

Extend the mechanism **#421 already built**. `/support` reads `searchParams`,
parses them *"only when the whole object parses: a half-valid reference reaches
the"* screen as nothing, and renders the result as **attached, non-editable
context** — the frame `29` state 3 treatment, mono type, no input chrome, no
clear affordance.

A booking report is the same shape with different context:

- entry point on the customer's booking — `Report a problem`, wording to be taken
  from `31-content-voice.md` rather than invented here;
- routes to `/support` carrying the booking reference;
- the booking's identity renders as attached context, the same way the error
  digest does;
- **`Something broke` is not the right preselected topic** — frame `29`'s topic
  list has `A booking or payment`, and that is the one a booking report should
  preselect.

#### The part that is not just a link

**Submitting the report is what places #423's hold.** A form that emails support
without moving the booking to `disputed` would let the payout release while the
complaint is open — which is the exact failure this whole chain exists to
prevent. The two must happen together, or the report must not claim to have been
made.

#### Acceptance

1. A customer sees a way to report a problem on a booking they own, and only on
   bookings they own.
2. It is offered when a report can still do something — after the event, before
   release. Outside that window the surface says what to do instead rather than
   offering a control that cannot act.
3. Following it lands on `/support` with the booking attached as context,
   non-editable, and `A booking or payment` preselected.
4. Submitting **both** sends the support message and moves the booking to
   `disputed`, atomically. Neither half can land without the other.
5. A booking already `disputed` does not offer a second report; it says one is
   open.
6. A vendor cannot reach this for a booking they are the vendor on — it is the
   customer's control.
7. The support email carries the booking reference, so a human can act without
   asking.

#### Tests (required)

- [ ] A test per acceptance, each watched failing first.
- [ ] **The atomicity in AC 4 is tested from both ends**: a failing email must not
      leave a `disputed` booking with no message, and a failing status write must
      not send a message claiming a report was filed. This is the #405 failure
      shape — two writes with no rollback — on the money path.
- [ ] An authorisation test per role: customer-owner, customer-other, vendor,
      admin, signed out.
- [ ] A browser pass driving the entry point through to the placed hold, and a
      check that #423's release job then skips that booking.
