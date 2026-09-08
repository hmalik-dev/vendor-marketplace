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
| **437** | **Admin detail views, and the entities the console cannot see** | P3 | M6 | **P1 High** | **Backlog** | — | **None** — #435 landed 2026-09-07 (`d83d374b`) and the Pattern B detail frame this row was held for arrived the same day in `design/delta-admin/` (#454) | `core` `auth` | **Filed 2026-09-07 by the admin-panel investigation.** Seven list screens, zero detail screens, against a design plan that specifies *"detail views: card-based groupings with prominent actions"* (`22-admin.md`). Consequence: `refund_amount_cents`, `cancellation_reason`, `dispute_reason`, `cancelled_by`, `payout_released_at` and `banned_at` appear on no row schema and no screen. Whole entities are absent — `booking_requests` (the entire pre-payment funnel), `service_packages`, `portfolio_items`, `availability`, `notifications`, `categories` — several of which the plan's own authorization matrix (§7) already grants admin. |
| **440** | **Operator-initiated refunds and credits** | P3 | M6 | **P1 High** | **Deferred — needs a human** | — | **The account holder: whether an operator may move money outside D3, D31 and D35, and on what authority** | `core` `auth` `stripe` | **Filed 2026-09-07 by the admin-panel investigation.** Money only moves on rails today — ban (full refund), customer cancellation (D3 tiers), dispute resolved for the customer. Partial refund, goodwill credit, fee waiver and correction do not exist, so every off-script case is settled in the Stripe Dashboard, after which the `bookings` row is wrong. **Deferred rather than Backlog because building it decides policy**: D3 fixes the cancellation tiers platform-wide, D31 makes a cancellation a full unwind, D35 fixes the 72-hour hold, and an operator lever is a fourth path none of them contemplates. Needs a decision entry before a line of code. |
| **443** | **Frame `13`'s parity residue, including two access findings nothing else checks** | P3 | M6 | **P2 Medium** | **Backlog** | — | **None** | `core` `auth` | **Filed 2026-09-07 from #433's parity pass**, which returned MATCH on all six axes for its own change and correctly declined to attribute these six to itself. **Two are access findings** — the search field has an `aria-label` but no visible `<label>`, and the row checkbox is `22x44` against `04-laws.md`'s 44px minimum — and the parity pass is the **only** gate on the accessibility laws and the contrast table, so an unfiled access finding is not caught later, it evaporates. The other four: the header is 1px short, the wordmark renders 24px against 23px, the four filter dropdowns carry a 2px padding asymmetry left over from the caret D25 removed (**correct the padding, do not restore the caret**), and the filtered empty state offers no way out where every other console empty state does. Batched by surface per the filing convention rather than filed as six rows. D30 binds: corroborate each transcribed number against the neighbouring widths before building it. |
| **444** | **An unwind declines the accepted request behind a completed booking** | P3 | M6 | **P1 High** | **Backlog** | — | **None** | `core` `auth` | **Filed 2026-09-07 by lane #438**, which tripped over it building account closure, verified it was pre-existing rather than its own, and pinned current behaviour in a test rather than widening scope. Confirmed independently before filing. `declineOpenRequests` (`admin.dao.ts:484`) sets `status: 'declined'` where status is in `['pending','quoted','accepted']` — **unconditionally**. But `accepted` is exactly the status a request holds *after checkout*, so an unwind flips the accepted request behind an **already-completed** booking to `declined`: the event happened, the vendor was paid, and the customer's requests screen now says it was declined. That is rewriting history, not unwinding it. **Reachable from any ban**, so it predates #433 and #438 both. The neighbouring `findConfirmedBookingsToUnwind` gets it right and is the model — it bounds on `event_date > today`; the request decline has no equivalent bound. Do **not** simply drop `accepted`: a request accepted but never paid for is a real open commitment. |
| **446** | **The app declares no body text size, so every unsized block renders at 16px** | P1 | M3 | **P2 Medium** | **Backlog** | — | **None** | `core` | **Filed 2026-09-07 by #441's parity pass, which hit it as a worked example.** `globals.css` sets `line-height` on `html` and its own comment explains why a per-call-site fix cannot close that class — *"an element with no text utility at all still inherits, so the per-site route cannot close the class"* — and then **stops one property short**. Nothing declares `font-size`, so every block element carrying no `text-*` utility inherits the browser's **16px**, which is `--text-lg`, not the 13.5px `--text-base` body step. **The worked example**: #441 set the footer's 13px on the `<a>`, and each `<li>`'s own line box stayed 16px because an inline child does not shrink its block. Rows measured 31px against the frame's 27, the footer was **25px taller** than it draws, and the legal row's copyright sat 1.5px off the links' baseline. #441 fixed the footer by moving the size onto the `<ul>`; the class is still open everywhere else. **Scope is the fix *plus* the sweep, not the fix with a caveat.** `body { font-size: var(--text-base) }` in the same `@layer base` block — on `body`, never `html`, which would rescale every rem-based spacing utility in the product — rescales **every currently-unsized block** from 16px to 13.5px. Anyone picking this up needs to know that before they start rather than discover it: it wants a parity pass over every frame-carrying screen, and it may well surface sites that were silently relying on the 16px. |
| **449** | **The screens document is content-box and every delta bundle is border-box, so the logo mark paints 19px where the frame draws 17** | P1 | M3 | **P2 Medium** | **Backlog** | — | **None** | `core` | **Filed 2026-09-07 by #441's `diff-reviewer` pass, and it overturns a standing assumption rather than finding drift.** `design/Orla - Screens.dc.html` ships **no `*` reset** — its 33 `box-sizing` hits are inline opt-ins — which is what #250 measured when it ruled `box-content` for the logo mark. **Every delta bundle opens with `* { box-sizing: border-box; }`**: `delta-band`, `delta-legal` and `contact-support` all do. So the closing-band frame draws the footer mark as two **equal footprints** — a 17px outline circle with its 1.3px stroke inside, beside a 17px disc — where `logo.tsx` paints a **19px** outline circle at x=7.64, 2px larger than the disc and 2px low. Measured in Chromium against the frame's own markup under its own reset. **#441 deliberately did not fix it**: `box-content` is #250's ruling, taken from the screens document and measured there, and overturning it moves the mark on the desktop header, the auth panel, the favicon and the app icon on one bundle's authority. That is a design adjudication. It is written up at the `box-content` comment in `logo.tsx`, and `logo.test.tsx`'s `it.each(EVERY_SIZE)` guard now pins `box-content` at D=17 — a diameter taken from a border-box frame — so the two guards in that file read the same contract two incompatible ways until this is settled. **RULED 2026-09-07: `box-content` stands and #250 is upheld** — the screens document is the primary contract and the bundles are supplements, so nothing moves on the header, the auth panel, the favicon or the app icon. The corroboration was closer than the filing implied: `design/delta-admin/` arrived the same day shipping **no `*` reset** either, making it **two content-box documents against three border-box bundles**. What remains open is the contradiction *inside* `logo.test.tsx` — a `box-content` guard pinned at a diameter transcribed from a border-box frame — plus recording the ruling in `web-design-parity.md` and at the `logo.tsx` call site. **A `delta-band` parity read measuring 19-against-17 is looking at this ruling, not at drift.** |
| **450** | **A closed account vanishes from the only screen it can be reached from** | P3 | M6 | **P1 High** | **Backlog** | — | **None** — #438 landed 2026-09-07 (`c7228e77`) | `core` `auth` | **Filed 2026-09-07 by lane #438's `diff-reviewer`**, which correctly declined to fix it in scope: the defect is in an **existing** surface's query. `/admin/customers` filters `deleted_at is null` (`admin.dao.ts:490`) and closure sets `deleted_at` — while `/admin/users/[userId]`, the data-rights page carrying the export, the retained counts and the legal acceptance record, is reachable **from that table and by direct URL and nowhere else**. So closing an account removes the page needed to audit the closure. **It is worst exactly when it matters**: a subject-access request, a regulator, or a dispute about whether closure did what was promised all arrive *after* the closure and none come with the uuid in hand. Fix with a deliberate way to ask for closed accounts — not by dropping the predicate, which correctly makes live accounts the default. |
| **451** | **Closing an account leaves its Clerk identity live, and its email locked** | P3 | M6 | **P1 High** | **In Progress** | `worktree-451b` | **None** — #438 landed 2026-09-07 (`c7228e77`) | `core` `auth` | **Filed 2026-09-07 by lane #438's `/code-review high`**, held out of scope correctly: closure soft-deleting is the ruled behaviour and revoking a Clerk session is a new integration call. Two defects from one omission. **The person stays signed in to an application that refuses them** — `clerk-auth.ts:164` 401s a request whose local row is retired, but the Clerk session is still valid, so the browser renders **signed-in header chrome over a signed-out application** indefinitely, with no sign-out prompt because nothing knows to show one. **And their email is locked under the retired row** — `users_email_key` does not care about `deleted_at`, so a re-registration with the same address collides on insert. That is the same state `CLAUDE.md` already warns about for the E2E seed; closure creates it deliberately. **RULED 2026-09-07: release the address.** The unique index becomes partial (`WHERE deleted_at IS NULL`) so a closed account’s address frees up, and closure therefore **deletes the Clerk user** rather than only revoking its sessions — revoking alone would leave the identity holding the address at Clerk’s end while ours had released it. That fires `user.deleted` back at our own webhook, so the handler must be **asserted** idempotent against a retirement it just performed; #433’s replay guard already provides it. The address is not burned, so nothing reaches the privacy text and #374’s wording gate is not on this path. |
**This board carries open work only, and closed rows are now DELETED rather than kept.** Changed 2026-09-06 on the account holder's instruction: *"clear out all completed tickets - delete them - no need to maintain any memory of them - it is confusing new tickets."* 33 closed rows and their 33 detail sections were removed in one commit, taking the file from 4,115 lines to under 1,100. **The registry in `packages/shared/src/env/tickets.ts` was NOT touched** — its ids must stay contiguous from 0, and `pnpm preflight --ticket <old n>` still gates correctly for any older branch or commit message. `git log` holds the deleted prose if it is ever wanted; nothing else does. **The pre-2026-08-30 archive still exists** at `.claude/plans/vendor-marketplace-tickets-archive.md` and is read by `tickets.board.test.ts` alongside this file — it was left alone because it is a separate file that no longer competes with open work for a reader's attention.
| **455** | **The `Apply filters` button clears the filter it should apply, and no pointer can reach it** | P3 | M6 | **P1 High** | **Backlog** | — | **None** | `core` `auth` | **Filed 2026-09-07 by #435's browser pass, reproduced twice.** On `/admin/reviews` the Direction select auto-applies on change (`?type=vendor_to_customer`, 14 rows, all "The customer"). Activating the `sr-only` submit **navigates to `/admin/reviews` with no query at all** — 15 rows, mixed directions — so the control named "Apply filters" is the one control that discards them. It is also pointer-intercepted by the Direction combobox, so a mouse cannot reach it. That button exists for the keyboard and no-JS path, which means it fails **precisely** the users it was added for and nobody else, and they have no workaround because the auto-apply it shadows is a JS change event. Not cosmetic: the filter bar is the only way to narrow six admin tables. |
| **457** | **A moderation hold the moderated vendor cannot lift** | P3 | M6 | **P0 Critical** | **Backlog** | — | **None** — #454 landed 2026-09-08 (`32fa9bd4`) and drew the Actions card this control belongs in | `core` `auth` | **Filed 2026-09-07 by #435's security audit.** #435 shipped unpublish and package deactivation, and both write columns **the vendor also writes**: `PUT /vendor/profile` accepts `isPublished: true` checking only `publishBlockers`, and `PUT /vendor/packages/:id` accepts `isActive`. There is no hold column on `vendor_profiles` or `service_packages`, so an operator takes a storefront down for a policy violation and the vendor puts it back from their own dashboard seconds later — no block, no notification, nothing but an `admin_actions` row. #435's acceptance 1 was corrected to say it is advisory; **ban remains the only enforcing lever until this lands.** Review hiding and portfolio removal are unaffected and do hold. Carries the unapproved review-moderation copy as a dependency: `Hide review` / `Unhide review` / `Delete review` appear in no frame and in no voice file — the admin delta covers the vendor detail card and says nothing about reviews. |
| **459** | **Every lane's `pnpm install` rewrites four lockfile keys nobody asked it to** | P3 | M6 | **P3 Low** | **Backlog** | — | **None** | `core` | **Filed 2026-09-07 by lane #445, which paid it and reverted it by hand.** The lockfile's `eslint-plugin-import` / `eslint-import-resolver-typescript` peer suffixes are stored in an **older, abbreviated form** than the installed pnpm writes, so *any* `pnpm add` or `pnpm install` that rewrites `pnpm-lock.yaml` expands four keys — `eslint-import-resolver-typescript@3.10.1(eslint-plugin-import@2.32.0)(...)` becomes the fully-qualified spelling, plus the three snapshot entries that reference it. **The resolutions do not change**, and `pnpm install --frozen-lockfile` accepts both forms, so nothing fails — the cost is that every lane touching a dependency carries an unrelated 19-line diff into its PR, and two lanes doing so conflict on lines neither of them meant to write. Reverting it is a step each lane has to know about and none of them is told. **Land the re-serialisation once, deliberately, on `main`** — a lone `pnpm install` commit touching only these keys — so the stored form matches what the installed pnpm writes and the churn stops being generated. Verify with `--frozen-lockfile` before and after, and check no second copy of any package appears. |
| **460** | **Closing an operator account needs a hurdle, not a refusal** | P3 | M6 | **P2 Medium** | **Backlog** | — | **#451** — the 403 this relaxes does not exist until that lands | `core` `auth` | **Filed 2026-09-07 on the account holder's ruling** — *"handle this as best practice possible — admin deletion should have additional verification/hurdles — very rare to do."* #451 makes closure **delete the Clerk identity**, so it is irreversible against a real identity provider, and it therefore answers **403 for an admin target** as the conservative direction while the question was open. The ruling is **not a refusal**: an operator account must stay closable — people leave — but with friction proportionate to being unrecoverable. Build a **typed confirmation** (the target's email, so the control cannot be cleared absently by a tired person clicking a second button), a **structural refusal when no other live admin would remain** rather than the incidental one `actorId === userId` gives today, a dialog stating the sign-in is restorable **only from Clerk's dashboard** because `role = 'admin'` is unreachable from inside the product, and a **distinct `admin_actions` value** so the audit can answer *"who removed our colleague's access"* without joining to a role the closure just retired. **Do not read this as loosen the guard**: the 403 stays until the hurdle exists, and both halves land in one commit. |
| **461** | **A live error type routes around #445's log sink** | P3 | M6 | **P2 Medium** | **Backlog** | — | **None** | `core` `auth` | **Filed 2026-09-07 by #451's `security-auditor`. Nothing leaks today** — it is filed because a path #445 documented as *unreachable* turns out to be reachable, and the next error type to travel it will not be as harmless. `ClerkAPIResponseError` carries an own enumerable **`errors`** array; `pino-std-serializers` copies it to **`aggregateErrors`** without passing it through `log-error-serializer.ts`, so its contents reach the log stream having been through none of the redaction. Contents today are Clerk's `{code, message, longMessage, meta}` — no credential, no bound parameter. **That is exactly why to fix it now**: #445's claim is that the sink is total and *nobody needs to know the hazard exists to be safe from it*, and a known hole with benign contents is one that gets forgotten before something else flows through it. #445 already follows `cause` and `err.errors`; this is the same array arriving under a different key, from the library rather than from our own recursion. **Fix the sink again, not this error type** — a `ClerkAPIResponseError` special case would be the fourth per-call-site guard in a story whose point was that per-call-site guards are how a rule becomes a special case. |
| **462** | **A failed email update leaves `users.email` stale for ever, and notifications keep going there** | P3 | M6 | **P1 High** | **Backlog** | — | **None** — #451's partial index removes one trigger, not the defect | `core` `auth` `email` | **Filed 2026-09-07 by #442's `security-auditor`**, pre-existing and found while auditing something else. `updateUserByClerkId` sets `email` with **no conflict handling**, so a `user.updated` carrying an address another row holds raises a **23505**, the handler 500s, svix exhausts its retries, and `users.email` stays at the **old** value permanently — with nothing surfacing it, because the failure is upstream and the row looks ordinary. **Then the stale column is used to send mail**: `notification-email.dao.ts` picks the recipient from it, so every notification for that account — carrying **counterparty PII**, names, event dates, booking details, message excerpts — keeps going to an address the account holder **no longer controls**, indefinitely, because nothing ever retries the update. The 500 is a nuisance; the mail is a disclosure. Catch the 23505 on that one statement — it is **not** inside a transaction, unlike `insertUserIfAbsent`'s path, which is why #442 needed a different shape there — and let the webhook **succeed**, since a retry cannot help a collision that is a fact about another row. Record the divergence where an operator sees it, the way `refundsFailed` and `identityDeleted` already are. **Then ask** what mail should do while the column is known-stale; continuing to send is the actual harm and is a product decision. Not fixed by #451 (that clears only the retired-row trigger; live-versus-live remains) and not the same defect as #442 (different caller, different transaction shape, different consequence). |
| **463** | **The admin detail views are drawn to Pattern B and C and built to neither** | P3 | M6 | **P2 Medium** | **Backlog** | — | **None** — the patterns are in the repository (#454) | `core` `auth` | **Filed 2026-09-08 by #454's parity pass**, which measured four console screens on six axes. #454 took the four findings inside its own acceptances and scoped this out in as many words: *"Neither is a rebuild. Both were built to a convention and now have a contract."* This is that rebuild. **`/admin/cases/[caseId]` renders one column where Pattern C draws two** — regions 1 and 3 left, region 2 right — and the **case-scoped reported-thread card is absent entirely**, which is a *required* part of region 2 rather than decoration: #436 built the conversation read and Pattern C asks for it scoped to the event date with the steel `Case-scoped read` chip. Region 1 has no sender block (avatar, role, id) and no `stone-50` inset around the message; label/value pairs stack where Pattern B rule 2 puts a fixed 150px label column beside a `minmax(0,1fr)` value. **`/admin/users/[userId]` has no 320px right column**, so `Export data` and `Close account` sit inside the first content card instead of a right-column Actions card below Identity, with no hairline between tiers and no per-action consequence line — rule 4's *literal* half. **Its spirit half already passes and must keep passing**: the two genuinely read-only cards contain zero interactive elements. Neither screen draws the `.ach` header band (`#F4F0E8` on a `1px #E4DDD1` rule), so region 3's *"Moves money. Both positions confirm first."* note has nowhere to live; card radii are 14px against `.ac`'s 12px throughout. **Values render 13.5px where rule 2 says 13px, and money and dates 13.5px sans where it says mono 12px.** Smaller and separable: `/admin/activity`'s filter bar carries one facet where Pattern A names three (Actor, Subject type, date range), `/admin/cases` has no search field though the bundle draws one, both lack frame `13`'s `Export CSV`, the Cases status filters carry no counts, and the `READ-ONLY` marker is stone where `40-states.md` makes information steel. **Read `web-design-parity.md` before measuring** — #454's four live overrides and two ruled colour entries are expected deviations, not drift. |
| **464** | **Sign-up dead-ends silently when the bot challenge cannot complete** | P3 | M6 | **P0 Critical** | **Backlog** | — | **None** | `core` `auth` | **Filed 2026-09-07 by lane #451b's browser pass and reproduced independently on `localhost:3000` in a real browser** — this is product behaviour, not a test-environment obstacle. Pick a role, type an email and password, press **Create my account**: `POST /v1/client/sign_ups` is **never sent** (verified by request interception — the only traffic is `challenges.cloudflare.com`), clerk-js waits on a Turnstile token that never arrives (`Error: 600010`), the form **disables every field permanently**, and the Clerk card then unmounts leaving the role picker. **No error, no timeout, no message, no retry — the button eats the click.** Sign-in is unaffected. **P0 because the people it hits are real and it is the only route into the product**: a privacy extension blocking `challenges.cloudflare.com`, a corporate or school network doing the same, third-party frames disabled, or Cloudflare failing — and there is no support path because there is no error to quote. **Ruled out already, do not re-derive**: headless (re-run under real Chrome), bundled Chromium, the network (Cloudflare's own demo page solved from the same machine), Clerk bot protection (a testing token made the widget vanish and submit **still** hung), and lane env (reproduced on `:3000`). **Not archived #226**, which recorded the same symptom as a *testing* obstacle on 2026-08-29 — `auth.spec.ts:9-14` still excludes sign-up for that reason — and that deferral is why the product half went unnoticed for nine days. Build a **bounded wait**, an **actionable error** in approved copy under `40-states.md`'s failure tone, and a **form that is usable again** rather than one needing a reload; then **ask** whether a challenge-free fallback is wanted, since that trades off against what bot protection exists to stop. **A second half was found 2026-09-08 and it is worse**: a sign-up that *succeeds* can still strand you. The account holder completed one by hand — role picked, email verified, Clerk identity created with `role: customer` — and landed back on the **role picker**, because `/after-sign-in` resolves to `/sign-in` rather than to the Terms interstitial. `getCurrentUser()` returns `null`, which means no token or a 401/404 from `/users/me`, where `clerk-auth.ts` should be answering `TERMS_REQUIRED` for a session with no row. **Diagnose which before fixing** — a browser left without an active session, or the gate not being reached — since the symptom is identical and the fixes are not. This half creates a **real verified account** and then shows the person the sign-up screen again, so they retry, meet *"that email is taken"*, and conclude the product is broken while holding an account they cannot tell exists. |
| **465** | **Post-sign-up routing, and no dead routes for any role** | P3 | M6 | **P0 Critical** | **Backlog** | — | **None** | `core` `auth` | **Filed 2026-09-08 at the account holder's request** after they completed a sign-up by hand and were returned to the role picker. **#464 is the sign-up form's own failure; this row is where sign-up *sends* you.** Role picked, email verified, **Clerk identity created correctly** (`unsafe_metadata: {"role":"customer"}`) — and then `/after-sign-in` resolves to **`/sign-in`** rather than the Terms interstitial, because `getCurrentUser()` returns `null`, which means no token or a 401/404 from `/users/me`. Neither is what a session with no `users` row should produce: `clerk-auth.ts` sets `termsRequired = true` for exactly that state and `signedInFailurePath` turns it into the interstitial. **Diagnose which branch before fixing** — no active session after `setActive()`, or the gate never reached — since the symptom is identical and the fixes are not. **P0 because the person now holds a real verified account and has been shown the sign-up screen again**: they retry, meet *"that email is taken"*, and conclude the product is broken. **The wider requirement is the account holder's**: *"must be Playwright verified as all users to prevent this issue. No dead routes."* So build a **route-landing sweep** over roles × targets — signed out, customer, vendor, admin, and a **newly verified account with no `users` row**, which no fixture represents — against every router segment and every literal redirect destination, asserting a terminal status, a rendered screen and the role's own chrome. **Enumerate targets from the source**, never a hand-maintained list, and assert unreachable cells as refusals rather than skipping them. |
| **466** | **"For vendors" sends a visitor to a sign-up form instead of an informational page** | P3 | M6 | **P1 High** | **Backlog** | — | **The account holder — the page needs a frame or a ruling before it is built** | `core` | **Filed 2026-09-08 at the account holder's request**: *"the 'for vendors' link should take users to a dedicated `/for-vendors` informational route not sign up again."* Today `marketing-nav.tsx:43` is `{ label: 'For vendors', href: '/sign-up?role=vendor' }`, so the one nav item addressed to vendors **asks them to create an account before telling them anything** — and a visitor who already has one is shown a sign-up screen again, which is #465's confusion from another direction. Build an **informational** `/for-vendors`: what it costs, how payouts work, what a storefront looks like, then the call to action carrying `?role=vendor` into sign-up. The deep link **keeps working** — `SignUpForm`'s `initialRole` exists for it — so what changes is which door the *nav* opens. **Blocked because there is no frame**: neither `Orla - Screens.dc.html` nor `design/design-plan/` has a vendor marketing page, and a lane building one would be inventing a public surface with nothing for the parity gate to compare against. The account holder picks: a frame, or a ruling that it composes from the landing page's existing vocabulary with the strings recorded in `31-content-voice.md` first. **No invented numbers** — this is the surface most likely to reach for *"vendors earn on average…"*, and MVP forbids every one of those. |

Rows are ordered by build sequence, not by ticket number. **Recounted programmatically 2026-09-08 after #442 landed: 21 rows — 18 Backlog and 3 `Deferred — needs a human`.** #438's, #448's, #452's, #436's, #445's, #447's, #458's, #454's, #456's and #442's rows and detail sections are **deleted** by their own lanes, per the rule above — the squash SHA is in the landed list below, which is where a closed ticket is recorded now that the row is gone. The board tripled in one sitting: **#431–#440** are the admin-panel investigation, and **#434 (`1f8011a`), #433 (`ad1b179`), #439 (`efe1ef73`), #441 (`1b8435f3`), #431 (`54fa7e64`), #432 (`1e899ae1`), #438 (`c7228e77`), #435 (`d83d374b`), #448 (`36683a21`), #452 (`46a85a52`), #436 (`3ccfe8db`), #445 (`758430f1`), #447 (`ec537047`), #458 (`affd481c`), #454 (`32fa9bd4`, which closed #456 with it) and #442 (`dcf8728c`) have all landed** — so **#437**, **#443**, **#444** and **#445** are startable unattended today, as are **#446** and **#449**, both filed by #441 on the way past. **#437 is the one #439 unblocked**: the delivery record, the provider webhook and the `email_deliveries` read paths now exist, so the delivery history on the customer, vendor and booking views — #439's acceptances 5 and 6, deliberately left — is data work rather than schema work. **#440 is `Deferred` because it decides policy, not because it is hard** — an operator money lever contradicts D3, D31 and D35 and needs a decision entry before any code. #370 is still blocked behind #362, and #362, #374 and #440 all need the account holder. **D39 is now built** (#438, `c7228e77`): closure answers 409 while the account holds a future confirmed booking **of its own**, and a vendor's closure refunds their customers in full through #433's unwind rather than a fork of it — the two halves the ruling divides, with the console and the privacy policy stating both. **Do not hand-maintain this number, recount it.** **#450 and #451 are startable too** — both were filed against a closure that did not exist yet, and #438 landing cleared their only blocker. **#453 was closed by delivery rather than by a commit** — it *was* the request for frames, and the account holder supplied `design/delta-admin/` on 2026-09-07. **#454 consumed them and landed 2026-09-08 (`32fa9bd4`)**, closing **#456** with it and taking the counted filtered-empty pattern to all seven console lists. That unblocks **#437** — the Pattern B detail frame it was held for is now in the repository — and **#457** with it. What #454 deliberately did not build is filed as **#463**: it landed the rulings and the parity fixes inside its own acceptances, and Pattern B and C's **composition** is a rebuild rather than a parity fix. **#442 landed 2026-09-08 (`dcf8728c`), and the ruling it was waiting on never existed.** The row claimed #427 had ruled that a second acceptance of a version already held is a second row, citing `legal-acceptance-immutability.test.ts` — but that test **inserts straight into the table, past both services**, so it recorded a schema fact and not a decision. Both writers had refused a repeat since #427 and #429. So the fix enforced a policy that already existed rather than settling one: a unique index on `(accepted_by_user_id, document, version)`, with `ON CONFLICT DO NOTHING` so the losing insert of a race loses harmlessly. **No Backlog row now waits on a person** — the three `Deferred` rows (#362, #374, #440) still do, and #370 is blocked behind #362.

**#448 landed a bigger finding than either half it was filed for, and that finding is the one to carry forward.** The filed halves were `renderLaneEnv` not writing `API_URL` and `lane:exec` handing every child the API's `PORT`; the first had already landed inside #432 (`1e899ae1`) before the lane branched, which is the board's own rule about trusting the repository over the ticket, arriving again. The real defect was **`laneEnvAgreesWith` comparing a subset of what `renderLaneEnv` writes** — it checked the two ports and `NEXT_PUBLIC_API_URL` and nothing else, so a `.env.lane` written before `API_URL` existed still *agreed* with its manifest, was never rewritten, and every long-running lane resumed onto the stale file for ever while `lane:up` printed ✓ over it. **A check that cannot fail for the state it exists to detect is worse than no check**, because it is also the thing that stops anyone else looking. It now compares every origin the file writes, and that is what makes **`pnpm lane:up <n>` the repair for a stale lane env — in place, database kept.** Do not tell a lane to `lane:down` for this. `pnpm preflight` now also fails a lane whose `.env.lane` omits `API_URL` **and** one whose `apps/web` build was made outside `lane:exec` — the second read out of `routes-manifest.json` rather than by curling the web port, because preflight runs *before* the dev servers, so a request probe finds nothing listening in the very flow it gates and cannot tell that from a server still cold-compiling. It would have to pass both, reproducing #448's own defect inside #448's fix.
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

### #437: Admin detail views, and the entities the console cannot see

**Milestone:** M6 | **Phase:** P3 | **Priority:** P1 High | **Status:** Backlog | **Capabilities:** `core` `auth`
**Blocked by:** None. **Both blockers cleared on 2026-09-07.**

**#435 landed** (`d83d374b`), which was the file-set block: a trace found the two
share six files — `admin.routes.ts`, `admin.service.ts`, `admin.dao.ts`,
`vendor-table.tsx`, `admin-data.ts` and `schemas/index.ts`. They never collided
*semantically* — #435 added moderation writes, this adds detail reads — but
`admin.routes.ts` is one ordered list of registrations that both append to, which
conflicted textually every time. This ticket is also a read-consumer of the states
#435 writes (`is_published`, `is_public`, `is_active`) and of #433's retired
status, and it now has them landed rather than merely merged.

**And the frame arrived.** This row was additionally held — see #453, now closed —
because `22-admin.md` specified detail views in one sentence and five screens
would have been invented from it. The account holder delivered
`design/delta-admin/` the same day. **Build against Pattern B**, and read #454
first: it carries the contract reconciliation, three open design questions, and
two constraints that bind this ticket directly — **`/admin/requests` is a tab
inside Bookings, not a rail row**, and the route the bundle calls
`/admin/categories` is served today at `/admin/tags`, which #454's second design
question settles.

**Two things #454 hands you, both of which are code you must write and not
merely read:**

1. **The closure refusal's link is owed.** #454 built `/admin/users/[userId]`'s
   refusal panel exactly as the frame draws it — disabled button, gold panel
   naming the blocking booking and its date — **except the link**, because
   `/admin/bookings/[id]` did not exist and a link to a 404 is worse than none.
   Wire it when you build that route. There is a comment at the call site saying
   so; delete it when you do.
2. **`/admin/requests` gets no rail row.** The bundle rules it a **tab inside
   Bookings** (`Bookings · Requests`), because a request is a booking before it
   exists and an operator reaches it while looking at bookings. And its `quoted`
   pill draws **steel**, not the delta's gold — ruled 2026-09-07, with
   `03-components.md` standing and the bundle corrected.

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

### #446: The app declares no body text size, so every unsized block renders at 16px

**Milestone:** M3 | **Phase:** P1 | **Priority:** P2 Medium | **Status:** Backlog | **Capabilities:** `core`
**Blocked by:** None

**Filed 2026-09-07 by #441's parity pass**, which hit it as a worked example
rather than as an audit finding.

#### The root cause

`globals.css` sets `line-height` on `html`, and the comment beside it explains
exactly why that had to be a document-level declaration: *"an element with no
text utility at all still inherits, so the per-site route cannot close the
class."* It then **stops one property short**. Nothing declares `font-size`, so
every block element carrying no `text-*` utility inherits the browser default of
**16px** — which is `--text-lg`, not the 13.5px `--text-base` the design system
calls its body step.

#### The worked example

#441 set the footer's link columns to 13px on the `<a>`. Each `<li>`'s own line
box stayed **16px**, because a smaller inline child does not shrink the block
that holds it. Rows measured 31px pitch against the frame's 27, the footer stood
**25px taller** than the frame draws it, and the legal row's copyright sat 1.5px
off the links' baseline. #441 closed it for the footer by moving the size onto
the `<ul>`, where the frame sets it. Every other unsized block in the product
still has it.

#### Scope: the fix **and** the sweep

`body { font-size: var(--text-base) }` in the same `@layer base` block. On
`body`, **never** `html` — `html` would rescale every rem-based Tailwind spacing
utility in the product.

That one line rescales **every currently-unsized block** from 16px to 13.5px, so
this ticket is the change plus a parity pass over every frame-carrying screen.
That is scope, not a caveat: anyone picking it up needs to know before they
start rather than discover it halfway. Expect it to surface sites that were
silently relying on the 16px, and treat each as a decision rather than a
regression.

---

### #449: The screens document is content-box and every delta bundle is border-box

**Milestone:** M3 | **Phase:** P1 | **Priority:** P2 Medium | **Status:** Backlog | **Capabilities:** `core`
**Blocked by:** None

#### RULED 2026-09-07 by the account holder: `box-content` stands. #250 is upheld

**The screens document wins.** `design/Orla - Screens.dc.html` is the primary
contract and the delta bundles are supplements to it, so the 19-against-17
reading is an artefact of a supplement's own reset rather than drift in the app.
`logo.tsx` does not change, and **the mark does not move on the desktop header,
the auth panel, the favicon or the app icon.**

**The corroboration is closer than the original filing suggested**, and it is
worth recording because it would otherwise look like the ruling went against the
weight of evidence. `design/delta-admin/` arrived on 2026-09-07 and ships **no
`*` reset** either — grepped and confirmed, zero `box-sizing` declarations. So
the split is **two content-box documents** (the screens document and
`delta-admin`) against **three border-box bundles** (`delta-band`,
`delta-legal`, `contact-support`), not one against three. That does not decide
it — primacy does — but it removes the "one frame against three corroborating
siblings" reading of D30 that made the other answer look obvious.

#### What this ticket now is

**Not a re-measurement. The scope is the contradiction inside `logo.test.tsx`,
which is real and still open.** That file holds two guards reading the same
contract incompatibly: `it.each(EVERY_SIZE)` pins `box-content` at **D=17**, a
diameter transcribed from a **border-box** frame. So the assertion is correct
about the box model and wrong about where its number came from, and the next
reader cannot tell which half to trust.

1. **Correct the D=17 guard** so its diameter is taken from a content-box source
   — the screens document, which is what #250 measured — or, if 17 is genuinely
   the right number under content-box, say so at the assertion with the
   measurement that establishes it. Do not leave a number whose provenance
   contradicts the rule it is pinning.
2. **Record the ruling in `.claude/rules/web-design-parity.md`** beside the
   existing #449 paragraph, replacing *"not yet ruled"* with the outcome and the
   two-against-three count. The existing instruction — *grep `box-sizing` in the
   specific bundle a pass is reading before arguing about any bordered box in
   it* — stays, and now applies in both directions.
3. **Leave the `box-content` comment in `logo.tsx` in place**, and extend it to
   name the ruling, so the next `delta-band` parity read measuring 19-against-17
   is told at the call site that it is reading a decision.

**A parity pass reporting the footer mark as 2px large is looking at this
ruling.** It is an accepted deviation from that bundle, permanently.

**Filed 2026-09-07 by #441's `diff-reviewer` pass.** This overturns a standing
assumption rather than finding drift, which is why it is a ticket and not a fix.

#### What is actually true

`design/Orla - Screens.dc.html` ships **no `*` reset** — its 33 `box-sizing`
hits are inline opt-ins. That is what #250 measured when it ruled `box-content`
for the logo mark, and it is correct for that document.

**Every delta bundle opens with `* { box-sizing: border-box; }`** —
`delta-band`, `delta-legal` and `contact-support` alike. So the closing-band
frame draws the footer mark as two **equal footprints**: a 17px outline circle
with its 1.3px stroke *inside*, beside a 17px disc.

Measured in Chromium, frame markup under its own reset versus what `logo.tsx`
emits at D=17:

| | outline circle | ink right edge | box |
| --- | --- | --- | --- |
| frame | 17.00 x 17.00 @ x=8 | 25.00 | 26 x 17 |
| component | **19.00 x 19.00** @ x=7.64 | 26.64 | 24.64 x 17 |

#### Why #441 did not fix it

`box-content` is #250's ruling, taken from the screens document and measured
there. Overturning it moves the mark on the desktop header, the auth panel, the
favicon and the app icon — on the authority of one bundle. That is a design
adjudication, not a parity fix.

It is written up at the `box-content` comment in `logo.tsx`. Note that
`logo.test.tsx`'s `it.each(EVERY_SIZE)` guard now pins `box-content` at **D=17**,
a diameter taken from a border-box frame, so the two guards in that file read
the same contract two incompatible ways until this is settled.

**A `delta-band` parity read measuring 19-against-17 is looking at this ruling,
not at drift.**

### #450: A closed account vanishes from the only screen it can be reached from

**Milestone:** M6 | **Phase:** P3 | **Priority:** P1 High | **Status:** Backlog | **Capabilities:** `core` `auth`
**Blocked by:** None — #438 landed 2026-09-07 (`c7228e77`), so the closure this describes now exists

**Filed 2026-09-07 by lane #438's `diff-reviewer` pass**, which correctly declined
to fix it in scope: the defect is in an **existing** surface's query, not in the
closure #438 builds.

#### The defect

`/admin/customers` filters `deleted_at is null` (`admin.dao.ts:490`). Account
closure (#438) sets `deleted_at`. And `/admin/users/[userId]` — the data-rights
page carrying the export, the retained counts and the legal acceptance record —
is reachable **from the customers table and by direct URL, and from nowhere
else**.

So the moment an operator closes an account, the page they would need to audit
that closure stops being reachable by navigation. The record survives; the route
to it does not. An operator who did not keep the URL has to reconstruct a uuid.

**It is worst exactly when it matters.** The reasons to look at a closed
account's data-rights page are a subject-access request, a regulator, or a
dispute about whether closure did what was promised — all of which arrive
*after* the closure, and none of which come with the uuid in hand.

#### What to build

**Let the operator see closed accounts, deliberately rather than by accident.**
The straightforward shape is a filter on `/admin/customers` — a `Closed` or
`Include closed` state alongside the existing search — with closed rows visibly
marked rather than silently mixed in. `deriveVendorStatus` already has the
precedent for a retired state on the vendor side (#433), and the customers table
already has a `Flagged` pill for a banned account, so the vocabulary exists.

**Do not simply drop the `deleted_at is null` predicate.** It is there so the
default view is live accounts, which is right — the fix is a deliberate way to
ask for the other set, not the removal of the distinction.

**Check the neighbouring reads while you are there.** `admin.dao.ts` filters
`deleted_at is null` in at least three places (the customer list, the ban lookup,
the metrics count). Each is probably correct for its own purpose, but they were
written when nothing set `deleted_at` except a Clerk webhook — say which of them
should now surface closed accounts and which should not, rather than changing one
and leaving the reader to guess about the rest.

#### Acceptance

1. An operator can reach a closed account's `/admin/users/[userId]` page by
   navigation, without knowing the uuid.
2. Closed accounts are visibly distinguished from live ones, using the existing
   pill vocabulary rather than a new tone.
3. The **default** `/admin/customers` view still shows live accounts only.
4. Every other `deleted_at is null` read in `admin.dao.ts` is either changed with
   a stated reason or documented as deliberately unchanged.
5. Asserted end to end: close an account through #438's route, then reach its
   data-rights page from the customers screen.

#### Tests (required)

- [ ] A test per acceptance, watched failing first.
- [ ] Acceptance 5 driven through the real closure route, not a row hand-set
      with `deleted_at`, so the fixture cannot drift from what closure produces.

### #451: Closing an account leaves its Clerk identity live, and its email locked

**Milestone:** M6 | **Phase:** P3 | **Priority:** P1 High | **Status:** In Progress | **Capabilities:** `core` `auth`
**Blocked by:** None — #438 landed 2026-09-07 (`c7228e77`), so the closure this describes now exists

**Filed 2026-09-07 by lane #438's `/code-review high`**, which correctly held it
out of scope: closure soft-deleting is the **ruled** behaviour (D39 and the
retire-never-remove rule), and revoking a Clerk session is a new integration
call, not a fix to the ticket that surfaced it.

#### Two defects from one omission

Closure sets `users.deleted_at` and stops. Nothing tells Clerk.

**1. The person stays signed in to an application that refuses them.**
`clerk-auth.ts:164` 401s a request whose local row is retired — but the Clerk
session itself is still valid, so the browser keeps rendering **signed-in header
chrome over a signed-out application**, indefinitely, until that session ages
out on its own. Every read fails; the shell says they are logged in. There is no
sign-out prompt because nothing knows to show one.

**2. Their email is locked under the retired row.** `users_email_key` is a unique
index that does not care about `deleted_at`, so a closed account's address is
held forever. A person who closes an account and later returns cannot
re-register with the same email — the insert collides, and the failure surfaces
wherever the sync path reports it rather than as anything a user could act on.

This is the same class the E2E-seed note in `CLAUDE.md` already warns about:
*"a `users` row carrying an E2E email under a made-up id makes that account's
next sign-in collide on the email index and locks it out."* Closure creates that
state deliberately.

#### What to build

**Revoke the Clerk identity as part of closure**, in the same operation that
retires the row — Clerk's backend API can revoke sessions or delete the user.
Decide and state which:

- **Revoking sessions** ends the ghost-session half and leaves the identity, so
  the email stays locked.
- **Deleting the Clerk user** ends both halves, and fires `user.deleted` back at
  our own webhook — so the handler must be idempotent against a retirement it
  just performed, which #433's replay guard already provides.

**RULED 2026-09-07 by the account holder: release the address on closure.**
Both halves are settled and neither is the lane's to reopen.

- **The unique index becomes partial** — `UNIQUE (email) WHERE deleted_at IS
  NULL` — so a closed account's address frees up and that person can sign up
  again with it. Two rows sharing an address across time is the correct record
  of what happened, not a collision.
- **Closure therefore deletes the Clerk user**, not merely its sessions. That is
  the half that follows from the first: revoking sessions alone would end the
  ghost session but leave the identity holding the address at Clerk's end while
  ours had released it, which is the two systems disagreeing about the same
  person. Deleting fires `user.deleted` back at our own webhook, so **the
  handler must be idempotent against a retirement it just performed** —
  #433's replay guard already provides that, and this must be asserted rather
  than assumed.

The privacy policy consequence disappears with the ruling: the address is not
burned, so there is nothing to add to the policy text and #374's wording gate is
not on this path. Say in the schema comment **why** the index is partial, since
a bare `WHERE deleted_at IS NULL` reads as an optimisation rather than a
decision about people.

#### Acceptance

1. Closure revokes the Clerk identity, and a browser holding that session lands
   somewhere coherent rather than on signed-in chrome over a dead application.
2. Whichever Clerk call is used, our own `user.deleted` handler is idempotent
   against a retirement already performed.
3. The email index is **partial** (`WHERE deleted_at IS NULL`) and the schema
   comment says why, in terms of the person rather than the query plan.
4. A re-registration with a closed account's email **succeeds**, creating a new
   row rather than resurrecting or colliding with the retired one, and the
   retired row stays retired and readable.
5. Asserted end to end through #438's closure route.

#### Tests (required)

- [ ] A test per acceptance, watched failing first.
- [ ] Acceptance 2 asserted by replaying the webhook after a closure — a double
      retirement must not double-refund, which is #433's guard doing its job.
- [ ] Acceptance 4 asserted **against the real partial index** rather than a
      mocked insert — a mock cannot distinguish a partial index from a full one,
      which is the entire content of the change.

#### Never drive this closure against a seeded E2E account

Once this lands, `POST /admin/users/:id/close` **deletes a real Clerk
identity**, and nothing in this repository can put one back. `db:seed:e2e`
*resolves* the Clerk ids behind the E2E customer, vendor and admin emails rather
than creating them — deliberately, because a `users` row carrying an E2E email
under an invented id locks that account out on its next sign-in — so re-seeding
does not restore a deleted identity. Only a person with the Clerk dashboard can.
The admin fixture is the worst case: it is the only route to `/admin` at all,
because `role = 'admin'` is unreachable from inside the product.

Verify against a **throwaway `+clerk_test` sign-up** instead; this is a
`pk_test` instance, so those addresses work and cost nothing. The **refusal**
path is safe and is what most passes actually want — D39 answers 409 while the
account holds a future confirmed booking, and the console disables the button
and states the reason above it, so verifying the refusal never reaches the
deletion. The same warning is on `closeAccount` itself, because the tracker is
not a sufficient safeguard for a consequence nobody can undo.


### #455: The `Apply filters` button clears the filter it should apply, and no pointer can reach it

**Milestone:** M6 | **Phase:** P3 | **Priority:** P1 High | **Status:** Backlog | **Capabilities:** `core` `auth`
**Blocked by:** None

#### What happens

On `/admin/reviews`, choosing a Direction auto-applies it — the select fires a
change event and the page navigates to `?type=vendor_to_customer`, showing 14
rows all reading "The customer". Activating the **`Apply filters`** submit then
navigates to `/admin/reviews` **with no query string**, showing 15 rows of mixed
direction. Reproduced twice.

So the control whose name promises to apply the filters is the only control that
discards them.

#### Why it is P1 rather than cosmetic

That button is `sr-only` until focused. It exists for the **keyboard and no-JS
path** — the auto-apply it shadows is a JS `change` handler, which those users do
not get. So the defect fails precisely the users the button was added for, and
they have no workaround: the filter bar is the only way to narrow six admin
tables, and for them it now clears instead of filtering.

It is also **pointer-intercepted** by the Direction combobox, so a mouse cannot
activate it at all — which is why it survived: every sighted mouse test passes.

#### What to build

The submit must apply the same query the change handler builds, and must be
reachable. Fix both halves, and add a test that activates the **button** rather
than firing the select's change event — a test that only exercises the JS path
cannot fail on this.

#### Tests (required)

- [ ] Activating the submit with a Direction chosen lands on the filtered query,
      asserted on the resulting rows and not only on the URL.
- [ ] The submit is hit-testable at 1440x900 — `elementFromPoint` at its centre
      returns the button, not the combobox.
- [ ] The keyboard path end to end: focus the select, choose, tab to the submit,
      activate, and assert the narrowed table.

### #457: A moderation hold the moderated vendor cannot lift

**Milestone:** M6 | **Phase:** P3 | **Priority:** P0 Critical | **Status:** Backlog | **Capabilities:** `core` `auth`
**Blocked by:** None — #454 landed 2026-09-08 (`32fa9bd4`), and the vendor
detail Actions card it drew is where this control belongs

#### The state today

**#435's two reversible levers are advisory, and the party they are used against
is the one who can undo them.**

- `vendor_profiles.is_published` is written by `PUT /admin/vendors/:vendorId/publish`
  **and** by the vendor's own `PUT /vendor/profile`, which accepts
  `isPublished: true` checking only `publishBlockers`.
- `service_packages.is_active` is written by `PUT /admin/packages/:packageId/active`
  **and** by the vendor's own `PUT /vendor/packages/:id`.

There is no hold column on either table. So: an operator unpublishes a storefront
for an unverified claim in a bio; the vendor opens their dashboard, clicks
Publish, and is back on search. Nothing refuses them, nothing tells the operator,
and the only record is the `admin_actions` row saying the operator once
unpublished it.

Review hiding and portfolio removal are **not** affected and need nothing here:
nothing outside the admin plugin writes `reviews.is_public`, and a removed
photo's object is gone.

Found by the security audit on #435's own lane, before it shipped — not by a
vendor.

#### What to build

**1. A hold column on both tables.** `moderation_hold boolean not null default
false` on `vendor_profiles` and `service_packages`. Set by the #435 admin routes;
**cleared only by an admin**, never by the vendor and never as a side effect of
any vendor write.

**2. The vendor's own paths refuse while it is set.** `updateVendorProfile`'s
`isPublished` branch and `updateServicePackage`'s `isActive` branch answer **403**
while the hold stands — not a silent no-op, and not a validation error.

**3. The refusal copy is not this ticket's to invent, and neither is the review
vocabulary it inherits.** `31-content-voice.md` has no register for a moderation
refusal; the nearest approved rows are the publish blocker and the payout gate,
both about something the vendor can go and fix, which this is not. Separately,
#435's review actions — `Hide review`, `Unhide review`, `Delete review` — appear
in **no frame and no voice file**: the admin delta covers the vendor detail card
and says nothing about reviews. **Both need a design pass before this ships.**

**4. Setting and clearing are logged admin actions**, extending #434's enum
rather than starting a second list.

**5. The console shows it.** A held vendor must be distinguishable in
`/admin/vendors` from one merely unpublished, or an operator cannot tell whether
a storefront is down because it was moderated or because the vendor took it down
themselves — which is the same ambiguity #435's republish dialog currently warns
about in prose.

#### Acceptance

1. With the hold set, `PUT /vendor/profile` with `isPublished: true` answers 403
   and the storefront stays off search — asserted **as the vendor**, not as an admin.
2. With the hold set, `PUT /vendor/packages/:id` with `isActive: true` answers 403.
3. An admin clearing the hold restores the vendor's ability to publish.
4. The hold survives a **full profile save** that does not mention `isPublished`.
5. Setting and clearing each write an `admin_actions` row naming the actor.
6. A held vendor is distinguishable from an unpublished one in `/admin/vendors`.
7. Nothing here bans, refunds or touches a booking — #435's invariant, asserted
   the same way.
8. #435's acceptance 1 is restored to enforcement wording, since this is the
   ticket that makes it true.

#### Tests (required)

- [ ] A test per acceptance, watched failing first.
- [ ] Acceptance 4 driven as a realistic **whole-profile** save: the vendor editor
      sends every field, and a patch-shaped fixture omitting `isPublished` would
      pass while the real form clears the hold.
- [ ] Acceptances 1 and 2 asserted on the status code **and the resulting public
      surface**. The bug this fixes is a write that succeeded, so a test reading
      only the API's answer would have passed against the broken version.


### #459: Every lane's `pnpm install` rewrites four lockfile keys nobody asked it to

**Milestone:** M6 | **Phase:** P3 | **Priority:** P3 Low | **Status:** Backlog | **Capabilities:** `core`
**Blocked by:** None

**Filed 2026-09-07 by lane #445**, which hit it adding `pino` as an explicit
dependency, watched a three-line change arrive as a nineteen-line diff, and
reverted the other sixteen by hand.

#### The defect

`pnpm-lock.yaml` stores four peer-suffixed keys in an **abbreviated form** that
the installed pnpm (10.32.1) no longer writes:

```
eslint-import-resolver-typescript@3.10.1(eslint-plugin-import@2.32.0)(eslint@…)
```

becomes the fully-qualified spelling, in which the `eslint-plugin-import`
suffix carries its own suffixes. Three snapshot entries reference that key and
are rewritten with it: the `eslint-config-next` importer's optional
dependencies, `eslint-module-utils@2.14.0`, and `eslint-plugin-import@2.32.0`
itself.

**Nothing is wrong with either form.** The resolutions are identical,
`pnpm install --frozen-lockfile` accepts both, and CI is green either way —
which is exactly why it persists. The cost is entirely in the diffs:

- Any lane that adds, removes or bumps a dependency ships sixteen lines of
  unrelated churn in its PR, where a reviewer has to establish that the
  resolutions did not move.
- Two lanes doing that at once **conflict on lines neither of them wrote**.
- The only remedy today is to know it happens and revert those hunks by hand,
  which is a step nothing tells a lane about and every lane has to repeat.

#### What to build

**Land the re-serialisation once, on purpose.** A single commit on `main`
containing nothing but the rewritten keys, with no `package.json` change beside
it — so the stored form matches what the installed pnpm writes, and the churn
stops being generated rather than being reverted forever.

#### Acceptance

1. `pnpm-lock.yaml`'s four keys are in the form the installed pnpm writes, and a
   subsequent `pnpm install` leaves the file **byte-identical**.
2. `pnpm install --frozen-lockfile` succeeds before and after.
3. No package gains a second copy: the `node_modules/.pnpm` entry count for
   `eslint-plugin-import` and `eslint-import-resolver-typescript` is unchanged.
4. `pnpm lint` still passes — the plugin and resolver are the subject, so a
   resolution that silently moved would show up there first.

#### Tests (required)

- [ ] No new unit test; this is a lockfile serialisation change. The evidence is
      the **idempotence check** in acceptance 1 — run `pnpm install` twice and
      diff — plus `--frozen-lockfile`, `pnpm lint` and the `.pnpm` entry count,
      each recorded in the PR with its output.

### #460: Closing an operator account needs a hurdle, not a refusal

**Milestone:** M6 | **Phase:** P3 | **Priority:** P2 Medium | **Status:** Backlog | **Capabilities:** `core` `auth`
**Blocked by:** #451 — the 403 this relaxes does not exist until that lands

**Filed 2026-09-07 on the account holder's ruling**, in answer to a question
#451's `security-auditor` and `diff-reviewer` both raised: *"handle this as best
practice possible — admin deletion should have additional verification/hurdles —
very rare to do."*

#### What #451 shipped, and why it is not the answer

`closeAccount` now **deletes the Clerk identity**, so closure is irreversible
against a real identity provider. #451 therefore answers **403 for an admin
target** — the conservative direction, taken deliberately while the question was
open, with a comment naming the line to delete once it was ruled.

**It has now been ruled, and the ruling is not a refusal.** An operator account
must remain closable — people leave — but the act needs friction proportionate
to being unrecoverable. So this row replaces the flat 403 with a hurdled path.

**Do not read this as "loosen the guard".** The 403 stays until the hurdle is
built. Landing a relaxation without the friction would leave the console strictly
worse than it is today.

#### What to build

1. **A typed confirmation, not a second button.** The `ConfirmAction` for an
   admin target requires the operator to type the target's **email address**
   before the destructive control enables. A dialog that only needs a second
   click is a hurdle a tired person clears without reading; typing an identifier
   is the standard best practice precisely because it cannot be done absently.
2. **Refuse when no other live admin would remain.** `closeAccount` already
   refuses `actorId === userId`, which makes lockout unreachable *incidentally* —
   an actor always survives. Make it structural: count live admins and refuse
   when closing this one would leave none. It fires in a case the self-closure
   refusal already prevents, and that is the point — a guard that depends on a
   different guard's side effect breaks silently when that one is changed.
3. **Say what is irreversible, in the dialog, in money-and-consequence terms**
   the way #454's resolve control does: their sign-in is deleted at Clerk and
   **cannot be restored from this application** — only from the Clerk dashboard,
   by someone with access to it. `role = 'admin'` is unreachable from inside the
   product, so a mistakenly closed operator cannot be re-made by an operator.
4. **Record it distinctly in `admin_actions`.** Closing an operator is not the
   same event as closing a customer, and an audit trail that cannot distinguish
   them cannot answer *"who removed our colleague's access"* without a join to a
   `role` that the closure itself has just retired. Note the immutability
   trigger: a wrong value here **cannot be corrected**.

#### Acceptance

1. An admin can close another admin's account through the console, and only
   after typing the target's email address exactly.
2. The destructive control is disabled until that input matches, and the
   mismatch state says so rather than failing on press.
3. Closure of the last live admin is refused with a 409 naming why, whether or
   not the actor is the target.
4. The dialog states that the Clerk sign-in is deleted and restorable only from
   Clerk's dashboard.
5. `admin_actions` distinguishes an operator closure from an ordinary one.
6. #451's flat 403 for admin targets is removed **in the same commit** that adds
   the hurdle, never before it.

#### Tests (required)

- [ ] A test per acceptance, watched failing first.
- [ ] Acceptance 2 asserted on the **disabled** state with a near-miss string —
      a test that types the correct email proves the happy path and nothing about
      the guard.
- [ ] Acceptance 3 driven with **two** live admins and then one, so the refusal
      is observed firing and not firing. A fixture with one admin passes the
      refusal for the wrong reason.
- [ ] Acceptance 6 asserted by grepping for the 403 branch's absence, so the two
      halves cannot separate across a rebase.

### #461: A live error type routes around #445's log sink

**Milestone:** M6 | **Phase:** P3 | **Priority:** P2 Medium | **Status:** Backlog | **Capabilities:** `core` `auth`
**Blocked by:** None

**Filed 2026-09-07 by #451's `security-auditor`.** Nothing leaks today. It is
filed because **a path #445 documented as unreachable turns out to be reachable**,
and the next error type to travel it will not be as harmless.

#### The gap

#445 closed the bound-parameter leak at the **sink** rather than per call site —
a custom pino `err` serialiser plus a `formatters.log` hook — and its whole claim
is that *nobody needs to know the hazard exists to be safe from it*.

`ClerkAPIResponseError` carries an own enumerable **`errors`** array.
`pino-std-serializers` copies it to **`aggregateErrors`** without passing it
through `log-error-serializer.ts`. So its contents reach the log stream having
been through none of the redaction.

**Today that is harmless**: the contents are Clerk's `{code, message,
longMessage, meta}` — no credential, no bound parameter, nothing a caller chose.
**That is exactly why it should be fixed now.** The claim #445 makes is about the
sink being total, and a known hole with benign contents is a hole that gets
forgotten before something else flows through it.

#### What to build

Bring `aggregateErrors` under the same serialiser as every other nested-error
route. #445 already follows `cause` **and** `err.errors` for the `AggregateError`
case — this is the same array arriving under a different key, from
`pino-std-serializers` rather than from our own recursion, which is why the
existing coverage misses it.

**Fix the sink again, not this error type.** A `ClerkAPIResponseError` special
case would be the fourth per-call-site guard in a story whose whole point was
that per-call-site guards are how a rule becomes a special case.

#### Acceptance

1. An error carrying an own enumerable `errors` array is serialised through
   `log-error-serializer.ts` regardless of which key `pino-std-serializers` files
   it under.
2. Asserted with a **real** `ClerkAPIResponseError` shape, not a hand-rolled
   object — the bug is in how a specific library copies a specific property.
3. Asserted with a **synthetic** error whose `errors` array carries a sentinel
   that must not appear in the output, so the test fails if the redaction is
   skipped rather than merely if the key is missing.
4. #445's existing coverage of `cause` and `err.errors` still passes unchanged.

#### Tests (required)

- [ ] A test per acceptance, watched failing first — the sentinel test must fail
      against `main` before the fix.
- [ ] Assert on the **serialised output**, not on the serialiser's return value
      in isolation: the defect is a library copying a property before ours runs,
      so a unit test of our function alone cannot reach it.

### #462: A failed email update leaves `users.email` stale for ever, and notifications keep going there

**Milestone:** M6 | **Phase:** P3 | **Priority:** P1 High | **Status:** Backlog | **Capabilities:** `core` `auth` `email`
**Blocked by:** None — #451's partial index removes one trigger, not the defect

**Filed 2026-09-07 by #442's `security-auditor`.** Pre-existing, and it was found
while auditing something else.

#### The chain

`updateUserByClerkId` sets `email` with **no conflict handling**. So a
`user.updated` webhook carrying an address that another row already holds raises
a **23505**, the handler 500s, svix retries, retries are exhausted, and
`users.email` stays at the **old** value permanently. Nothing surfaces it: the
webhook's failure is upstream, and the row looks ordinary.

**Then the stale column is used to send mail.** `notification-email.dao.ts`
picks the recipient from `users.email`, so every notification for that account —
carrying **counterparty PII**: names, event dates, booking details, message
excerpts — keeps going to an address the account holder **no longer controls**.

That is the harm. The 500 is a nuisance; mail to a relinquished address is a
disclosure, and it continues indefinitely because nothing ever retries the
update again.

#### What to build

**Catch the 23505 on that one statement and record a divergence.** It is not
inside a transaction, so catching it there is available and does not abort
anything — unlike `insertUserIfAbsent`'s first-sign-in path, where the caller's
`db.transaction` is why #442 had to reach for a different shape.

The webhook must then **succeed** rather than 500: a retry cannot help, because
the collision is a fact about another row and will be true again next time.
Exhausting svix's retries is how a permanent condition currently gets treated as
a transient one.

**Record the divergence somewhere an operator sees it.** A log line alone is a
line nobody reads. The console already has the vocabulary — this is the same
class as `refundsFailed` and `identityDeleted`, a thing that went wrong after a
committed operation and has to be *reported* rather than only logged.

**Decide what mail should do while the column is known-stale.** Continuing to
send to an address the person has abandoned is the actual harm, and it is a
product decision rather than a lane's: hold notifications for that account, send
to nothing, or send and accept it. **Ask before choosing.**

#### What this is not

**Not fixed by #451's partial index.** That removes the *retired-row* trigger —
a closed account no longer holds its address in the index — which is one way two
rows can collide on an address. The live-versus-live case remains, and so does
every other reason the update could fail.

**Not the same defect as #442.** That one is `insertUserIfAbsent` on the
first-sign-in path. This is `updateUserByClerkId` on the webhook path, with a
different caller, a different transaction shape and a different consequence.

**But it is the same root, and that is worth knowing before you fix it** (#451b,
2026-09-07): **two writers on `users` with no conflict handling, differing only
in which row they meet.** `insertUserIfAbsent` meets the identity's own row;
`updateUserByClerkId` meets somebody else's. The fix shapes diverge — one cannot
catch the 23505 because its caller holds a transaction, this one can — which is
why merging the two rows would be wrong. **Check the third writer while you are
here**: if any other statement sets a column under a unique index with no
`onConflict` clause, it belongs in this row rather than in a fourth.

#### Acceptance

1. A `user.updated` whose new address collides does **not** 500, and does not
   exhaust svix's retries.
2. The divergence is recorded where an operator can see it, not only in a log.
3. `users.email` is never left silently disagreeing with Clerk with nothing
   saying so.
4. Whatever is ruled for notifications while the column is stale is implemented
   and stated at the send site.

#### Tests (required)

- [ ] A test per acceptance, watched failing first.
- [ ] Acceptance 1 driven against the **real** unique index, with a second row
      genuinely holding the address — a mocked rejection proves the catch and
      not that the catch is reachable.
- [ ] Acceptance 3 asserted by reading the row **and** the divergence record
      together: a test that only checks the row passes against a version that
      silently discards the update.

### #463: The admin detail views are drawn to Pattern B and C and built to neither

**Milestone:** M6 | **Phase:** P3 | **Priority:** P2 Medium | **Status:** Backlog | **Capabilities:** `core` `auth`
**Blocked by:** None — the patterns landed with #454 (`32fa9bd4`)

**Filed 2026-09-08 by #454's parity pass.** That pass measured `/admin/activity`,
`/admin/cases`, `/admin/cases/[caseId]` and `/admin/users/[userId]` at 1440x900
on all six axes. #454 took the four findings that fell inside its own
acceptances — a payout hold painted red, a 12-hour clock, a filled destructive
button, an ellipsised identifier — and scoped the rest out in as many words:
*"Neither is a rebuild. Both were built to a convention and now have a
contract."* **This ticket is that rebuild**, and it is filed rather than folded
in because it is a build.

#### The two detail screens, which is most of the work

**`/admin/cases/[caseId]` against Pattern C.**

- **One column where the frame draws two.** Pattern C is
  `grid-template-columns: minmax(0,1.35fr) minmax(0,1fr)` with regions **1 and 3
  stacked left** and **region 2 in the right column**. Everything currently
  stacks in one 1157px column.
- **The reported-thread card is absent.** This is not decoration — Pattern C §2
  requires the case-scoped read of the thread, read-only, scoped to the event
  date, with the steel `Case-scoped read · 12 Sep only` chip and the line saying
  operators see the messages the case is about rather than the whole
  relationship. **#436 already built the conversation read** (`CaseConversation`),
  so this is composition rather than new capability.
- **Region 1 has no sender block.** The frame draws a 30px monogram, the name at
  13px/600, and `Customer · CUS-5518 · email` at 11.5px `stone-600`. The screen
  renders a three-up `From / Reply to / Arrived by` trio instead — no avatar, no
  role, no id.
- **The message body has no inset.** The frame puts it on `#F8F5EF` with a `1px
  #EFE9E0` hairline at a 10px radius and 13px/15px padding, with a character
  count beneath. It renders as a bare paragraph.

**`/admin/users/[userId]` against Pattern B.**

- **No 320px right column.** Pattern B is "left = the record, right = identity +
  actions", and *everything that changes state lives in the right column and
  nowhere else*.
- **Rule 4's literal half fails.** `Export data` and `Close account` sit inside
  the first content card at the top of the page, not in a right-column Actions
  card below Identity, with no hairline between tiers and no per-action
  consequence line — one shared paragraph instead.
- **Rule 4's spirit half already passes, and a test must keep it passing.** The
  two genuinely read-only cards — *What is still held* and *Legal acceptances* —
  contain **zero** interactive elements. A rebuild that moves the actions must
  not regress that.
- **Card order is inverted.** Pattern B for this route is retained-data counts as
  a **table**, then legal acceptance as read-only fields. It renders the counts
  as a `grid-cols-4` of `dt`/`dd` pairs and the acceptances as the admin table —
  each in the other's form.
- `Export their record` should read **`Export data`**, which is what Pattern B
  names it.

#### Shared between both detail screens

- **No `.ach` header band.** The frame's card header is `padding:10px 16px` on
  `#F4F0E8` with a `1px #E4DDD1` bottom rule and a right-hand note. Region 3's
  note — *"Moves money. Both positions confirm first."* — has nowhere to live
  without it, and neither does Stripe's *"Read-only — mirrored from Stripe, 6m
  ago"*.
- **Card radius is 14px** (`rounded-xl`) against `.ac`'s **12px**, on every card.
- **Rule 2's type scale.** Values render 13.5px where the rule says 13px, and
  identifiers, dates and money render 13.5px sans where it says **mono 12px**.
  `text-base` resolving to 13.5px is the cause, so this needs a deliberate step
  rather than a per-site override.

#### The list-screen items, which are separable and could be their own pass

- **`/admin/activity`'s filter bar carries one facet.** Pattern A names three —
  `Actor ▾`, `Subject type ▾`, date range. Only `Action` exists; actor and
  subject filtering are reachable *only* by clicking a row cell.
- **`/admin/cases` has no search field**, though the bundle draws one in both of
  its Cases panels: `max-width:280px`, placeholder *"Search reference or
  sender…"*.
- **Neither list draws frame `13`'s `Export CSV`**, right-anchored in the filter
  bar.
- **The Cases status filters carry no counts.** The bundle draws `Open (4)` /
  `Resolved (0)` as counted pills; the screen renders two uncounted dropdowns.
  The dropdown *shape* is an accepted deviation (#433); the missing counts are
  not covered by that entry.
- **The `READ-ONLY` marker is stone, not steel.** `40-states.md` makes steel
  information, and a read-only marker is information. The frame draws
  `#3D6A8C` on `#EEF3FA`.

#### Before measuring anything

**Read `.claude/rules/web-design-parity.md` first.** #454 added four live
overrides — US month-first dates, the retained `UTC` suffix, the `stone-600` em
dash, and money without cents — plus two ruled colour entries (`quoted` steel,
`accepted` clay). All six are **expected deviations, not findings**, and a pass
that re-files them is re-litigating a ruling.

`design/delta-admin/` ships **no `box-sizing` reset**, so every bordered box in
it is content-box. That is the distinction #449 turns on.

#### Acceptance

1. `/admin/cases/[caseId]` renders two columns at 1440x900, regions 1 and 3
   left, region 2 right, and carries the case-scoped reported-thread card.
2. Region 1 draws the sender block and the message on its `stone-50` inset with
   a character count.
3. `/admin/users/[userId]` renders a 320px right column holding Identity and one
   Actions card, ordered least to most severe with a hairline between tiers and
   one consequence line per action.
4. **No interactive element appears inside a read-only card on either screen** —
   asserted, because this currently passes and a rebuild is what would break it.
5. Both screens draw the `.ach` card header band, and card radius is 12px.
6. Label/value pairs render as a fixed 150px label column beside a
   `minmax(0,1fr)` value; identifiers, dates and money render mono 12px.
7. `parity-checker` returns MATCH on all six axes for both detail screens, with
   #454's six recorded deviations reported as expected.

#### Tests (required)

- [ ] A test per acceptance, watched failing first.
- [ ] Acceptance 4 asserted by **querying for interactive descendants** of each
      read-only card rather than by naming the controls that exist today — a
      list of known controls cannot fail for a control added later.
- [ ] Acceptance 6 asserted on `getComputedStyle`, not on class names: the
      defect is a resolved size, and `text-base` resolving to 13.5px is exactly
      the kind of thing a `toContain` on a class string cannot see.
- [ ] Browser: both detail screens driven at 1440x900, and the resolve control
      still reachable only past the evidence after the recomposition.

### #464: Sign-up dead-ends silently when the bot challenge cannot complete

**Milestone:** M6 | **Phase:** P3 | **Priority:** P0 Critical | **Status:** Backlog | **Capabilities:** `core` `auth`
**Blocked by:** None

**Filed 2026-09-07 by lane #451b's browser pass, then reproduced independently
by the supervising session on `localhost:3000` in a real browser.** This is not a
test-environment problem. **Nobody can create an account whose browser cannot
complete the Cloudflare Turnstile challenge, and the product says nothing.**

#### What happens

Pick a role, type an email and a password, press **Create my account**:

- `POST /v1/client/sign_ups` is **never sent**. Verified by request interception
  — the only network traffic is `challenges.cloudflare.com`.
- clerk-js waits on a Turnstile token that never arrives (`Error: 600010`,
  `challenges.cloudflare.com` `ERR_ABORTED`).
- **The form disables every field permanently**, then the Clerk card unmounts,
  leaving the role picker and a *"Already with us? Sign in"* link.
- **No error, no timeout, no message, no retry.** The button eats the click.

**Sign-in is unaffected** and works normally.

#### Why this is P0 rather than an automation nuisance

The people it hits are real: a privacy extension that blocks
`challenges.cloudflare.com`, a corporate or school network that does the same, a
browser with third-party frames disabled, or Cloudflare simply failing. **They
get a sign-up button that does nothing, for ever, with nothing to read and
nothing to try.** There is no support path because there is no error to quote.

It is also **the only route into the product.** A vendor cannot list and a
customer cannot book without an account, so this is the top of every funnel.

#### The second half, found 2026-09-08: sign-up can *succeed* and still strand you

The account holder completed a sign-up by hand — role picked, email verified —
and **landed back on the role picker**, with no indication anything had worked.

Checked rather than inferred:

- **The Clerk identity was created correctly**: verified email,
  `unsafe_metadata: {"role":"customer"}`. Round one genuinely succeeded.
- **No `users` row exists**, which is correct — since #429 the acceptance gate is
  the only writer on the product path, so a new account is *supposed* to be held
  at the interstitial.
- **But `/after-sign-in` resolves to `/sign-in`**, not to the Terms interstitial.
  `getCurrentUser()` returned `null`, which happens on **no token** or on a
  **401/404** from `/users/me` — and neither is what a session with no row should
  produce. `clerk-auth.ts` sets `termsRequired = true` for exactly that state and
  `requireAuth` throws `termsRequiredError()`, which `signedInFailurePath` turns
  into the interstitial. That path is not being taken.

**Diagnose which of the two it is before fixing** — a browser left without an
active session after `setActive()`, or a `/users/me` answering 401/404 where the
gate should answer `TERMS_REQUIRED`. They have different fixes and the symptom is
identical.

**This half is worse than the hang.** The hang at least does nothing. This one
**creates a real, verified account** and then shows the person the sign-up screen
again — so they try again, hit *"that email is taken"*, and conclude the product
is broken while holding an account they cannot tell exists. Add it to acceptance
1's sibling: a completed sign-up must land somewhere that reflects it.

#### What was ruled out, so nobody re-derives it

Lane #451b's pass eliminated, in order: headless mode (re-ran under real Chrome),
the bundled Chromium, the network (solved Cloudflare's own demo page from the
same machine), and Clerk bot protection (minted a Clerk testing token — the
widget vanished and submit **still** hung). The supervising session then
reproduced it on `:3000` rather than a lane port, so it is not lane env either.

**Do not confuse this with archived #226.** That recorded the same Turnstile
symptom on 2026-08-29 and deferred it **as a test-environment obstacle** —
`apps/web/e2e/auth.spec.ts:9-14` still says sign-up is deliberately absent from
the suite for that reason. This row is the **product behaviour**: what a person
experiences when the challenge cannot complete. Same cause, different subject,
and the deferral of the first is why the second went unnoticed for nine days.

#### What to build

**The failure must become visible and recoverable.** At minimum:

1. **A bounded wait.** If the challenge has not produced a token within a stated
   timeout, stop waiting and say so. An indefinite wait is what turns a failure
   into a dead end.
2. **An error the person can act on**, in approved copy from
   `31-content-voice.md` — what happened, in their words, and one action.
   `40-states.md` binds: this is a failure, so it is red, and it needs the one
   action the state offers.
3. **The form must not stay disabled.** Re-enable the fields so the attempt can
   be retried, and offer the retry explicitly rather than requiring a reload.
4. **Decide whether a fallback exists.** Clerk supports email-code sign-up
   without a password, and a Turnstile-free path may or may not be acceptable
   given what bot protection is there to stop. **This is a product decision —
   ask before choosing.** Shipping (1)–(3) without it is still a strict
   improvement on silence.

#### Acceptance

1. With `challenges.cloudflare.com` blocked, pressing **Create my account**
   surfaces a stated error within a bounded time rather than hanging.
2. The form is usable again afterwards — fields enabled, a retry offered.
3. The error copy is in `31-content-voice.md` and follows `40-states.md`'s
   failure tone.
4. Sign-up still succeeds normally when the challenge **can** complete.
5. Whatever is ruled for a fallback path is implemented, or the row records that
   none is wanted and why.

#### Tests (required)

- [ ] A test per acceptance, watched failing first.
- [ ] **Acceptance 1 asserted with the challenge host actually blocked** — route
      interception on `challenges.cloudflare.com`, not a mocked clerk-js
      rejection. The defect is that a real network condition produces no
      response at all, and a mock that rejects *has already done the thing the
      product fails to do*.
- [ ] Acceptance 4 driven in a browser, because the whole class of defect here is
      one no unit test reached for nine days.

### #465: Post-sign-up routing, and no dead routes for any role

**Milestone:** M6 | **Phase:** P3 | **Priority:** P0 Critical | **Status:** Backlog | **Capabilities:** `core` `auth`
**Blocked by:** None

**Filed 2026-09-08 at the account holder's request**, after they completed a
sign-up by hand and were returned to the role picker with no sign anything had
worked. **#464 is the sign-up form's own failure; this row is where sign-up
*sends* you, and every other landing like it.**

#### The observed defect

Role picked, email verified, **Clerk identity created correctly** — verified
address, `unsafe_metadata: {"role":"customer"}`. Then:

- `/after-sign-in` resolves to **`/sign-in`**, not to the Terms interstitial.
- `getCurrentUser()` returned `null`, which happens on **no token** or on a
  **401/404** from `/users/me`.
- Neither is what a session with no `users` row should produce.
  `clerk-auth.ts` sets `termsRequired = true` for exactly that state,
  `requireAuth` throws `termsRequiredError()`, and `signedInFailurePath` turns
  that into the interstitial. **That path is not being taken.**

**Diagnose which of the two it is before writing a fix** — a browser left with no
active session after Clerk's `setActive()`, or the gate never reached. The
symptom is identical and the fixes are not. Start by capturing what `/users/me`
actually answers for a freshly verified identity with no row: that single
response tells you which branch you are in.

**Why P0:** the person now holds a **real, verified account** and has been shown
the sign-up screen again. They retry, meet *"that email is taken"*, and conclude
the product is broken while owning an account they cannot tell exists. It is the
top of the funnel and it fails silently.

#### `/after-sign-in` is transit, and must never be where you end up

**Ruled 2026-09-08 by the account holder:** *"signing in shouldn't take me to
`/after-sign-in` — it should take me based on my role."*

**The intent already matches that**, and the table is `role-routes.ts`:

| Role | Lands on |
| --- | --- |
| `customer` | `/` — a customer's first move is to browse, not to open a dashboard they did not ask for |
| `vendor` | `/vendor/dashboard` |
| `admin` | `/admin` — note there is **no `/admin/dashboard`**; the console's overview is `/admin` itself |

`/after-sign-in` is a **route handler, not a page**. Clerk lands there because it
does not know the role — role lives in our database, never in Clerk metadata —
and the handler answers with a real HTTP redirect to the row above. It is a
route handler rather than a page calling `redirect()` precisely because Clerk
arrives by client-side navigation, where an RSC redirect across layout segments
leaves the App Router unable to reconcile the tree (#410).

**So seeing `/after-sign-in` in the address bar is the defect itself**, not a
design to change: it means the redirect did not resolve. `/dashboard` is the same
shape and inherits the same requirement.

**Make it an assertion rather than a property nobody checks.** After any
authentication, the **terminal** URL is the role's destination; `/after-sign-in`
and `/dashboard` never appear as a final location for any role, including the
no-row state. That is one line in the sweep below and it is the line that would
have caught this.

#### The wider requirement: no dead routes, for any role

The account holder's instruction is that this class must not recur:
**"must be Playwright verified as all users to prevent this issue. No dead
routes."**

So the fix is not only the branch above. **Every landing and redirect target in
the product must resolve to a rendered screen for every role that can reach it.**

Build a **route-landing sweep** driven in a real browser, over the matrix of:

- **Roles**: signed out · customer · vendor · admin · a **newly verified account
  with no `users` row** (the state this ticket is about, and the one no fixture
  currently represents).
- **Targets**: every entry in the app router, plus every literal redirect
  destination — `postSignInPath`, `signedInFailurePath`, `termsAcceptancePath`,
  `DASHBOARD_PATH_BY_ROLE`, `/after-sign-in`, and the `?returnTo=` round trip.

For each cell assert: a **terminal** HTTP status (no redirect loop), a rendered
screen rather than an error boundary, and the role's own chrome. **A redirect
that lands on another redirect is only acceptable if the chain terminates**, and
the test must follow it rather than reading the first hop.

#### What "no dead routes" has to mean in a test

**Not a list of routes someone maintained by hand** — that is the failure this
repo keeps finding, a check whose reach is smaller than its author believed.
Enumerate the targets from the **source**: walk the app router directory for
segments, and grep the redirect helpers for their literal destinations, so a
route added later is covered without anyone remembering.

Where a cell is legitimately unreachable, assert **that** rather than skipping —
a skipped cell and a passing cell look identical in a summary.

#### Acceptance

1. A freshly verified account with no `users` row lands on the **Terms
   interstitial**, from `/after-sign-in` and from a direct URL alike.
2. The root cause is **named** in the ticket and in the code comment — session or
   gate — rather than fixed by making the symptom go away.
3. Every role × target cell resolves to a terminal status and a rendered screen,
   with no redirect loop and no error boundary.
4. The target list is **derived from the source**, not hand-maintained, so a new
   route is covered on the day it is added.
5. Unreachable cells are asserted as refusals, not omitted.
6. **The terminal URL after authenticating is the role's own destination** —
   `/` for a customer, `/vendor/dashboard` for a vendor, `/admin` for an
   operator. Neither `/after-sign-in` nor `/dashboard` is ever a final location,
   for any role or for the no-row state.

#### Tests (required)

- [ ] A test per acceptance, watched failing first — acceptance 1 must fail
      against `main` today.
- [ ] **Playwright, at every role in the matrix**, per the account holder's
      instruction. The no-row state is the one that has no fixture: create it the
      way the product does, or seed a Clerk identity with no local row, and say
      in the test which.
- [ ] The redirect chain **followed to termination**, not asserted on the first
      hop — a loop passes a first-hop assertion.
- [ ] A deliberately broken redirect target added and the sweep watched to fail,
      so the enumeration is proven to reach.


### #466: "For vendors" sends a visitor to a sign-up form instead of an informational page

**Milestone:** M6 | **Phase:** P3 | **Priority:** P1 High | **Status:** Backlog | **Capabilities:** `core`
**Blocked by:** The account holder — the page needs a frame before it is built. See below.

**Filed 2026-09-08 at the account holder's request:** *"the 'for vendors' link
should take users to a dedicated `/for-vendors` route not sign up again."*

#### What it does today

`marketing-nav.tsx:43` — `{ label: 'For vendors', href: '/sign-up?role=vendor' }`.

So the one nav item addressed to vendors asks them to **create an account before
telling them anything**. A visitor evaluating whether to list with us is handed a
form. And a visitor who is **already signed up** and clicks it out of curiosity
is shown a sign-up screen again, which is the same confusion #465 is about
arriving from a different direction.

#### What to build

**A real `/for-vendors` route — informational, as the account holder specified.** A page *about* vending: what it costs,
how payouts work, what a storefront looks like, and *then* the call to action
that carries `?role=vendor` into sign-up. The nav points there instead.

**The sign-up deep link keeps working.** `/sign-up?role=vendor` is a supported
entry — `SignUpForm`'s `initialRole` exists for it and pre-selects the vendor
card — so the change is which door the **nav** opens, not the removal of a route.

#### This needs a frame before it is built, and that is why it is blocked

`design-is-a-contract-not-code`: there is **no frame for a vendor marketing
page** in `Orla - Screens.dc.html`, and `design/design-plan/` has no screen file
for one. A lane building it would be inventing a public surface, which is exactly
what the MVP rule and the design contract exist to stop — and the parity gate
would have nothing to compare it against.

**Two ways forward, and the account holder picks:**

1. **A frame**, the way `delta-admin` answered #453.
2. **A ruling that it composes from existing frames** — the landing page's own
   vocabulary applied to vendor-side copy, with the approved strings recorded in
   `31-content-voice.md` first. Cheaper, and defensible because the page is a
   rearrangement of parts that are already drawn rather than a new shape.

**No invented numbers.** A vendor marketing page is the surface most likely to
reach for *"vendors earn on average…"* or *"X events booked"*. MVP forbids every
one of those on a public page: nothing ships here that is not a query result at
request time or a fact about the product's own mechanics.

#### Acceptance

1. `/for-vendors` exists and renders for a signed-out visitor, a customer and a
   vendor — no role is bounced off a public marketing page.
2. The nav's "For vendors" points at it.
3. `/sign-up?role=vendor` still works and still pre-selects the vendor card.
4. The page's call to action carries `?role=vendor` into sign-up.
5. Every claim on the page is a product mechanic or a request-time query result —
   **no platform statistics**.
6. Parity against whatever the account holder supplies, on all six axes at
   1440x900.

#### Tests (required)

- [ ] A test per acceptance, watched failing first.
- [ ] Acceptance 1 driven at **all three** auth states — the defect class this
      sits beside (#465) is precisely a route that renders for one role and not
      another.
- [ ] Acceptance 3 asserted after the nav change, since the deep link and the nav
      target are now different things and a regression would silently merge them
      back.
