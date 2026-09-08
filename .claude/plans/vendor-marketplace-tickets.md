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
| **442** | **A repeat Terms acceptance can write two permanent rows — the read has no index behind it** | P3 | M6 | **P1 High** | **Backlog** | — | **None** — the product question this row invented was false, corrected 2026-09-07 | `core` `auth` | **Filed 2026-09-07 from #429's security pass, which found it and deliberately did not close it.** `acceptTerms` reads *"already accepted"* and then inserts, with **no unique index behind the read**, so two submissions from one session can each write a row into a table nothing can delete. **There is no product question and this row was wrong to claim one.** Both writers already refuse a repeat — `acceptTerms` and `acceptVendorAgreement` each return early under the comment *"Already held: answer, do not write"*, and `terms.routes.test.ts` asserts it twice. The cited `legal-acceptance-immutability.test.ts:248` **inserts directly into the table**, so it asserts a schema fact — *"there is no unique key to collide on"* — and not a ruling that the product permits two acceptances. A test that writes past the code cannot say what the code decided. So the intent is already one row per person, per document, per version, and the service's early return is merely **advisory**: nothing at the database level holds it. Add the unique index and let the losing insert of a race lose harmlessly. Check three things first — existing duplicates would block the index in a table the trigger will not let you tidy; `vendor_id` is left out of the key, which is safe only if one user can never hold two vendor profiles; and both writers must be covered. The window is small — it closes on the first commit — and rate-limited, but **it reopens at every version bump, the rows are permanent, and the identical shape has been live on the vendor agreement since #427**, so the fix must cover both writers. Reasoning is written up in **D38** on `main` |
| **443** | **Frame `13`'s parity residue, including two access findings nothing else checks** | P3 | M6 | **P2 Medium** | **Backlog** | — | **None** | `core` `auth` | **Filed 2026-09-07 from #433's parity pass**, which returned MATCH on all six axes for its own change and correctly declined to attribute these six to itself. **Two are access findings** — the search field has an `aria-label` but no visible `<label>`, and the row checkbox is `22x44` against `04-laws.md`'s 44px minimum — and the parity pass is the **only** gate on the accessibility laws and the contrast table, so an unfiled access finding is not caught later, it evaporates. The other four: the header is 1px short, the wordmark renders 24px against 23px, the four filter dropdowns carry a 2px padding asymmetry left over from the caret D25 removed (**correct the padding, do not restore the caret**), and the filtered empty state offers no way out where every other console empty state does. Batched by surface per the filing convention rather than filed as six rows. D30 binds: corroborate each transcribed number against the neighbouring widths before building it. |
| **444** | **An unwind declines the accepted request behind a completed booking** | P3 | M6 | **P1 High** | **Backlog** | — | **None** | `core` `auth` | **Filed 2026-09-07 by lane #438**, which tripped over it building account closure, verified it was pre-existing rather than its own, and pinned current behaviour in a test rather than widening scope. Confirmed independently before filing. `declineOpenRequests` (`admin.dao.ts:484`) sets `status: 'declined'` where status is in `['pending','quoted','accepted']` — **unconditionally**. But `accepted` is exactly the status a request holds *after checkout*, so an unwind flips the accepted request behind an **already-completed** booking to `declined`: the event happened, the vendor was paid, and the customer's requests screen now says it was declined. That is rewriting history, not unwinding it. **Reachable from any ban**, so it predates #433 and #438 both. The neighbouring `findConfirmedBookingsToUnwind` gets it right and is the model — it bounds on `event_date > today`; the request decline has no equivalent bound. Do **not** simply drop `accepted`: a request accepted but never paid for is a real open commitment. |
| **446** | **The app declares no body text size, so every unsized block renders at 16px** | P1 | M3 | **P2 Medium** | **Backlog** | — | **None** | `core` | **Filed 2026-09-07 by #441's parity pass, which hit it as a worked example.** `globals.css` sets `line-height` on `html` and its own comment explains why a per-call-site fix cannot close that class — *"an element with no text utility at all still inherits, so the per-site route cannot close the class"* — and then **stops one property short**. Nothing declares `font-size`, so every block element carrying no `text-*` utility inherits the browser's **16px**, which is `--text-lg`, not the 13.5px `--text-base` body step. **The worked example**: #441 set the footer's 13px on the `<a>`, and each `<li>`'s own line box stayed 16px because an inline child does not shrink its block. Rows measured 31px against the frame's 27, the footer was **25px taller** than it draws, and the legal row's copyright sat 1.5px off the links' baseline. #441 fixed the footer by moving the size onto the `<ul>`; the class is still open everywhere else. **Scope is the fix *plus* the sweep, not the fix with a caveat.** `body { font-size: var(--text-base) }` in the same `@layer base` block — on `body`, never `html`, which would rescale every rem-based spacing utility in the product — rescales **every currently-unsized block** from 16px to 13.5px. Anyone picking this up needs to know that before they start rather than discover it: it wants a parity pass over every frame-carrying screen, and it may well surface sites that were silently relying on the 16px. |
| **447** | **A border or surface token used as text on ink — four instances, three per-call-site guards, no law** | P1 | M3 | **P2 Medium** | **Backlog** | — | **None** | `core` | **Filed 2026-09-07 by #441, which was the third instance.** The recurring mistake is not "a border token used as text" but ***the nearest hex is not the right role***, and it has now bitten four times: `stone-400` as text on ink twice (#430's closing band, #441's admin header), `stone-0` as a border on ink once (#441's legal hairline), and the 78%-alpha-of-`stone-50` that `theme.css` records as the defect which minted the ink-ground ramp in the first place. Three of those now carry **three separately hand-written per-call-site guards** — `page.test.tsx` for the band, `admin-header.test.tsx` and `site-footer.test.tsx` for #441 — and no law. A fourth guard would make it a habit. **#441 looked for the cheap guard and reports that there is not one**, which is the part that should stop the next person rediscovering it: a blanket ban on `text-stone-400` needs **four legitimate exemptions** (`ui/empty-state.tsx`, `vendors/profile/review-form.tsx`, and two in `packages/package-manager.tsx` — all decorative glyphs on a light ground), and a file-level "this file has an ink ground" rule matches **14 files**, most of which use `bg-stone-900` for a scrim, a chip or one button variant. So the guard has to know the *ground an element renders on*, which no source scan can see. Options worth weighing: extend `theme-tokens.test.ts`'s contrast table into a role table naming which tokens may be `text-*` at all; or assert it in the browser during the parity pass, where the ground **is** observable. |
| **449** | **The screens document is content-box and every delta bundle is border-box, so the logo mark paints 19px where the frame draws 17** | P1 | M3 | **P2 Medium** | **Backlog** | — | **None** | `core` | **Filed 2026-09-07 by #441's `diff-reviewer` pass, and it overturns a standing assumption rather than finding drift.** `design/Orla - Screens.dc.html` ships **no `*` reset** — its 33 `box-sizing` hits are inline opt-ins — which is what #250 measured when it ruled `box-content` for the logo mark. **Every delta bundle opens with `* { box-sizing: border-box; }`**: `delta-band`, `delta-legal` and `contact-support` all do. So the closing-band frame draws the footer mark as two **equal footprints** — a 17px outline circle with its 1.3px stroke inside, beside a 17px disc — where `logo.tsx` paints a **19px** outline circle at x=7.64, 2px larger than the disc and 2px low. Measured in Chromium against the frame's own markup under its own reset. **#441 deliberately did not fix it**: `box-content` is #250's ruling, taken from the screens document and measured there, and overturning it moves the mark on the desktop header, the auth panel, the favicon and the app icon on one bundle's authority. That is a design adjudication. It is written up at the `box-content` comment in `logo.tsx`, and `logo.test.tsx`'s `it.each(EVERY_SIZE)` guard now pins `box-content` at D=17 — a diameter taken from a border-box frame — so the two guards in that file read the same contract two incompatible ways until this is settled. **RULED 2026-09-07: `box-content` stands and #250 is upheld** — the screens document is the primary contract and the bundles are supplements, so nothing moves on the header, the auth panel, the favicon or the app icon. The corroboration was closer than the filing implied: `design/delta-admin/` arrived the same day shipping **no `*` reset** either, making it **two content-box documents against three border-box bundles**. What remains open is the contradiction *inside* `logo.test.tsx` — a `box-content` guard pinned at a diameter transcribed from a border-box frame — plus recording the ruling in `web-design-parity.md` and at the `logo.tsx` call site. **A `delta-band` parity read measuring 19-against-17 is looking at this ruling, not at drift.** |
| **450** | **A closed account vanishes from the only screen it can be reached from** | P3 | M6 | **P1 High** | **Backlog** | — | **None** — #438 landed 2026-09-07 (`c7228e77`) | `core` `auth` | **Filed 2026-09-07 by lane #438's `diff-reviewer`**, which correctly declined to fix it in scope: the defect is in an **existing** surface's query. `/admin/customers` filters `deleted_at is null` (`admin.dao.ts:490`) and closure sets `deleted_at` — while `/admin/users/[userId]`, the data-rights page carrying the export, the retained counts and the legal acceptance record, is reachable **from that table and by direct URL and nowhere else**. So closing an account removes the page needed to audit the closure. **It is worst exactly when it matters**: a subject-access request, a regulator, or a dispute about whether closure did what was promised all arrive *after* the closure and none come with the uuid in hand. Fix with a deliberate way to ask for closed accounts — not by dropping the predicate, which correctly makes live accounts the default. |
| **451** | **Closing an account leaves its Clerk identity live, and its email locked** | P3 | M6 | **P1 High** | **Backlog** | — | **None** — #438 landed 2026-09-07 (`c7228e77`) | `core` `auth` | **Filed 2026-09-07 by lane #438's `/code-review high`**, held out of scope correctly: closure soft-deleting is the ruled behaviour and revoking a Clerk session is a new integration call. Two defects from one omission. **The person stays signed in to an application that refuses them** — `clerk-auth.ts:164` 401s a request whose local row is retired, but the Clerk session is still valid, so the browser renders **signed-in header chrome over a signed-out application** indefinitely, with no sign-out prompt because nothing knows to show one. **And their email is locked under the retired row** — `users_email_key` does not care about `deleted_at`, so a re-registration with the same address collides on insert. That is the same state `CLAUDE.md` already warns about for the E2E seed; closure creates it deliberately. **RULED 2026-09-07: release the address.** The unique index becomes partial (`WHERE deleted_at IS NULL`) so a closed account’s address frees up, and closure therefore **deletes the Clerk user** rather than only revoking its sessions — revoking alone would leave the identity holding the address at Clerk’s end while ours had released it. That fires `user.deleted` back at our own webhook, so the handler must be **asserted** idempotent against a retirement it just performed; #433’s replay guard already provides it. The address is not burned, so nothing reaches the privacy text and #374’s wording gate is not on this path. |
**This board carries open work only, and closed rows are now DELETED rather than kept.** Changed 2026-09-06 on the account holder's instruction: *"clear out all completed tickets - delete them - no need to maintain any memory of them - it is confusing new tickets."* 33 closed rows and their 33 detail sections were removed in one commit, taking the file from 4,115 lines to under 1,100. **The registry in `packages/shared/src/env/tickets.ts` was NOT touched** — its ids must stay contiguous from 0, and `pnpm preflight --ticket <old n>` still gates correctly for any older branch or commit message. `git log` holds the deleted prose if it is ever wanted; nothing else does. **The pre-2026-08-30 archive still exists** at `.claude/plans/vendor-marketplace-tickets-archive.md` and is read by `tickets.board.test.ts` alongside this file — it was left alone because it is a separate file that no longer competes with open work for a reader's attention.
| **454** | **Land the admin design delta — the drawn frames for every unframed console screen** | P3 | M6 | **P1 High** | **Backlog** | — | **None** — the frames arrived 2026-09-07 and this row is what consumes them | `core` `auth` | **Filed 2026-09-07. The account holder supplied `design/delta-admin/` in answer to #453**, which asked for frames and per `design-is-a-contract-not-code` deliberately did not attempt them — so **#453 is closed by that delivery**, not by this row. The bundle is **three patterns, two drawn frames and one ruling**: **A** rules that the four list routes reuse frame `13`'s table verbatim and gives their column grids, defaults, colour and empty behaviour; **B** draws one detail frame on `/admin/vendors/[id]` settling card order, label/value typography, long-field wrapping and where destructive actions may sit; **C** draws `/admin/cases/[caseId]` in full, including the two-position resolve control and its `ConfirmAction`. **This row takes the surfaces already on `main`** — the rail order, `/admin/activity`, `/admin/cases`, and a parity pass over `/admin/cases/[caseId]` and `/admin/users/[userId]` — plus the contract reconciliation and the **filtered-empty pattern**, which is a new shared component and closes one of #443's six findings. **#437 is unblocked by this filing** and builds the five routes that do not exist yet against Pattern B. **The rail change is an *order* change, not a count change** — the bundle reasons from a stale brief of eight rows, but `22-admin.md` already gave Cases a row (#431) and the app renders nine; what actually moves is Cases, from between `Payments` and `Reviews` to directly after `Bookings`, overturning #431. **All three design questions were answered by the account holder on 2026-09-07 and nothing is open** — the money one settled that `Suspend vendor` **keeps refunding in full** per D31/#416 and the frame’s *"holds payouts"* is loose copy to be corrected, `/admin/activity` **keeps** its `What changed` column for five in total, and the route stays `/admin/tags`. All three corrections edit the **bundle**, in the design pass’s own commit. |
| **455** | **The `Apply filters` button clears the filter it should apply, and no pointer can reach it** | P3 | M6 | **P1 High** | **Backlog** | — | **None** | `core` `auth` | **Filed 2026-09-07 by #435's browser pass, reproduced twice.** On `/admin/reviews` the Direction select auto-applies on change (`?type=vendor_to_customer`, 14 rows, all "The customer"). Activating the `sr-only` submit **navigates to `/admin/reviews` with no query at all** — 15 rows, mixed directions — so the control named "Apply filters" is the one control that discards them. It is also pointer-intercepted by the Direction combobox, so a mouse cannot reach it. That button exists for the keyboard and no-JS path, which means it fails **precisely** the users it was added for and nobody else, and they have no workaround because the auto-apply it shadows is a JS change event. Not cosmetic: the filter bar is the only way to narrow six admin tables. |
| **456** | **Two moderation labels disagree with the frame that now draws them** | P3 | M6 | **P2 Medium** | **Backlog** | — | **#454** (the frames land with it) | `core` `auth` | **Filed 2026-09-07 by #435, against its own surface.** #435 shipped `Unpublish storefront` and `Suspend account` before any frame drew the vendor detail view; `design/delta-admin/Orla-Admin-Views.html` then arrived naming them **`Unpublish profile`** and **`Suspend vendor`** in the Actions card. `web-design-parity.md` is explicit that "same composition with reworded copy has failed too", so this is a text-parity defect rather than a preference. The *descriptions* already agree — both say existing bookings stand and the vendor keeps their dashboard — so this is two labels, in `vendor-table.tsx` and their four assertions. **Do not fix before #454 lands** or the frame is not yet in the repository to match. See design question 3 in #454 before touching the suspend copy: the card also says suspend "holds payouts" where the code refunds in full, and that is unresolved. |
| **457** | **A moderation hold the moderated vendor cannot lift** | P3 | M6 | **P0 Critical** | **Backlog** | — | **#454** (the vendor detail Actions card is where the control lives) | `core` `auth` | **Filed 2026-09-07 by #435's security audit.** #435 shipped unpublish and package deactivation, and both write columns **the vendor also writes**: `PUT /vendor/profile` accepts `isPublished: true` checking only `publishBlockers`, and `PUT /vendor/packages/:id` accepts `isActive`. There is no hold column on `vendor_profiles` or `service_packages`, so an operator takes a storefront down for a policy violation and the vendor puts it back from their own dashboard seconds later — no block, no notification, nothing but an `admin_actions` row. #435's acceptance 1 was corrected to say it is advisory; **ban remains the only enforcing lever until this lands.** Review hiding and portfolio removal are unaffected and do hold. Carries the unapproved review-moderation copy as a dependency: `Hide review` / `Unhide review` / `Delete review` appear in no frame and in no voice file — the admin delta covers the vendor detail card and says nothing about reviews. |
| **458** | **A vendor is offered a Report control on their own storefront** | P3 | M6 | **P3 Low** | **Backlog** | — | **None** | `core` `auth` | **Filed 2026-09-07 by #436's browser pass, against #436's own surface.** The report controls on `/vendors/[slug]` take `signedIn` and nothing else, so a vendor viewing their own storefront is offered *Report this profile*, *Report this photo* and *Report this review* on their own work. Filing one succeeds: `/reports` checks that the subject resolves and, for a conversation, that the caller is a party — a public subject is reportable by anyone signed in, deliberately, because restricting a storefront report would only stop the passer-by who noticed. **The cost is a real case in the operations queue naming a vendor as their own reporter**, which an operator has to open to dismiss. Not a security issue and not urgent: the vendor can only report themselves. **The fix is a viewer check, not a server refusal** — the pane knows the slug and the page already resolves `viewerRole`, so it wants the vendor's own profile id threaded in and the control hidden when they match. Refusing it at the API instead would need `/reports` to answer 403 to the one caller whose complaint is least likely to be malicious, and would leak the owner's identity to anybody probing — a 403-on-owner turns the endpoint into an oracle for who owns a storefront. **RULED 2026-09-07: two of the three controls, not all three.** Hide it on the profile and the portfolio, where the subject is the vendor's own record; **keep it on reviews**, where the subject is a customer's content written *about* them, which is not self-reporting and belongs in the queue. `apps/web/src/app/vendor/` has no reviews route, so the storefront control is a vendor's **only** channel against a defamatory review — hiding it would trade a dismissible case for a real one nobody can file. |
| **459** | **Every lane's `pnpm install` rewrites four lockfile keys nobody asked it to** | P3 | M6 | **P3 Low** | **Backlog** | — | **None** | `core` | **Filed 2026-09-07 by lane #445, which paid it and reverted it by hand.** The lockfile's `eslint-plugin-import` / `eslint-import-resolver-typescript` peer suffixes are stored in an **older, abbreviated form** than the installed pnpm writes, so *any* `pnpm add` or `pnpm install` that rewrites `pnpm-lock.yaml` expands four keys — `eslint-import-resolver-typescript@3.10.1(eslint-plugin-import@2.32.0)(...)` becomes the fully-qualified spelling, plus the three snapshot entries that reference it. **The resolutions do not change**, and `pnpm install --frozen-lockfile` accepts both forms, so nothing fails — the cost is that every lane touching a dependency carries an unrelated 19-line diff into its PR, and two lanes doing so conflict on lines neither of them meant to write. Reverting it is a step each lane has to know about and none of them is told. **Land the re-serialisation once, deliberately, on `main`** — a lone `pnpm install` commit touching only these keys — so the stored form matches what the installed pnpm writes and the churn stops being generated. Verify with `--frozen-lockfile` before and after, and check no second copy of any package appears. |

Rows are ordered by build sequence, not by ticket number. **Recounted programmatically 2026-09-07 after #445 landed and #459 was filed: 19 rows — 16 Backlog and 3 `Deferred — needs a human`.** #438's, #448's, #452's, #436's and #445's rows and detail sections are **deleted** by their own lanes, per the rule above — the squash SHA is in the landed list below, which is where a closed ticket is recorded now that the row is gone. The board tripled in one sitting: **#431–#440** are the admin-panel investigation, and **#434 (`1f8011a`), #433 (`ad1b179`), #439 (`efe1ef73`), #441 (`1b8435f3`), #431 (`54fa7e64`), #432 (`1e899ae1`), #438 (`c7228e77`), #435 (`d83d374b`), #448 (`36683a21`), #452 (`46a85a52`), #436 (`3ccfe8db`) and #445 (`758430f1`) have all landed** — so **#437**, **#443**, **#444** and **#445** are startable unattended today, as are **#446**, **#447** and **#449**, all filed by #441 on the way past. **#437 is the one #439 unblocked**: the delivery record, the provider webhook and the `email_deliveries` read paths now exist, so the delivery history on the customer, vendor and booking views — #439's acceptances 5 and 6, deliberately left — is data work rather than schema work. **#440 is `Deferred` because it decides policy, not because it is hard** — an operator money lever contradicts D3, D31 and D35 and needs a decision entry before any code. #370 is still blocked behind #362, and #362, #374 and #440 all need the account holder. **D39 is now built** (#438, `c7228e77`): closure answers 409 while the account holds a future confirmed booking **of its own**, and a vendor's closure refunds their customers in full through #433's unwind rather than a fork of it — the two halves the ruling divides, with the console and the privacy policy stating both. **Do not hand-maintain this number, recount it.** **#450 and #451 are startable too** — both were filed against a closure that did not exist yet, and #438 landing cleared their only blocker. **#453 is closed by delivery rather than by a commit** — it *was* the request for frames, and the account holder supplied `design/delta-admin/` on 2026-09-07; **#454** is the row that consumes them, and it is what unblocked **#437**, whose second hold was the missing detail frame. **#442 is the only Backlog row still waiting on a person** for the ruling D38 sets out.

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

### #442: A repeat Terms acceptance can write two permanent rows — rule what the record means, then close the race

**Milestone:** M6 | **Phase:** P3 | **Priority:** P1 High | **Status:** Backlog | **Capabilities:** `core` `auth`
**Blocked by:** None. **Unblocked 2026-09-07 — the product question was a false
one, and the row was wrong.**

**Filed 2026-09-07** from #429's `security-auditor` pass, which found the race
and wrote it up as **D38**. The lane was right to leave the race open. This row
was wrong about *why*.

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

#### There is no product question. This row invented one — read this before working it

The account holder asked the obvious question — *"why is a user able to accept
the terms twice if it's the same terms?"* — and the answer is that **they are
not, and never were.** Verified in the shipped code on 2026-09-07:

- `acceptTerms` (`terms.service.ts`) reads the held version and, under the
  comment *"Already held: answer, do not write"*, **returns the status without
  inserting**.
- `acceptVendorAgreement` (`legal-agreement.service.ts`) does the same, under
  the same comment, with the reasoning spelled out: *"the second acceptance of a
  version already held adds no answer to it. A **new** version still adds its
  row."*
- `terms.routes.test.ts` asserts it twice — *"records the acceptance against the
  existing account, without a second one"* (`:196`) and *"signing in again is not
  accepting again"* (`:350`).

So the intent is unambiguous and already implemented: **one row per person, per
document, per version.** A repeat submission is refused at the service layer.

**This row previously claimed #427 ruled the opposite** — that a second
acceptance *is* a second row — and cited
`packages/db/src/legal-acceptance-immutability.test.ts:248` as asserting it.
That citation was misread, and the misreading is worth naming because it is a
recurring one: **that test inserts directly into the table**, bypassing both
services. It asserts a *schema* fact — *"there is no unique key to collide on and
no upsert path"* — which is a true description of the database as it stands
today and **not** a ruling that the product permits two acceptances. A test that
writes past the code cannot tell you what the code decided.

**So the fix is not a policy change, it is enforcement of a policy that already
exists.** The service's early return is advisory: nothing at the database level
holds it, so two requests racing from one session both read *not held* and both
insert into a table a trigger makes permanent.

#### What to build

Add the **unique index** — `(accepted_by_user_id, document, version)` — and let
the losing insert of a race lose harmlessly rather than surfacing as a 500. The
index turns the existing early return from a courtesy into a guarantee, which is
what the two service comments already believe they have.

**Three things to check before writing the migration, none of them optional:**

1. **Existing duplicates block the index.** A `CREATE UNIQUE INDEX` fails if the
   table already holds a colliding pair, and this table cannot be tidied — the
   trigger refuses deletes. Query for duplicates first and say in the ticket what
   you found; if any exist, the repair is a decision, not a migration.
2. **`vendor_id` is deliberately not in the key, and you must confirm that is
   safe.** A `vendor_agreement` row carries `vendor_id`; the proposed key does
   not. That is correct **only if** one user can never hold two vendor profiles.
   Verify it against the schema rather than assuming — if it is not true, the key
   needs `vendor_id` and the Terms rows (which carry `null`) still behave, since
   Postgres treats nulls as distinct in a unique index, which is a second thing
   to check rather than assume.
3. **Both writers must be covered**, because the identical shape has been live on
   the vendor agreement since #427. One index covers both; make sure the
   duplicate-key handling does too, so the vendor path does not 500 where the
   Terms path no-ops.

**The window is small but it reopens at every version bump**, and the rows are
permanent, which is the whole reason a P1 sits on a race that closes in
milliseconds.

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

### #447: A border or surface token used as text on ink — four instances, three per-call-site guards, no law

**Milestone:** M3 | **Phase:** P1 | **Priority:** P2 Medium | **Status:** Backlog | **Capabilities:** `core`
**Blocked by:** None

**Filed 2026-09-07 by #441, which was the third instance.**

#### The shape

The recurring mistake is not "a border token used as text". It is ***the nearest
hex is not the right role***, and it has now bitten four times:

- `stone-400` as text on ink — the closing band's pitch (#430) and
  `admin-header.tsx` (#441).
- `stone-0` as a border on ink — the footer's legal hairline (#441).
- A 78% alpha of `stone-50` standing in for a value the frames name outright,
  which `theme.css` records as the defect that minted the ink-ground ramp in the
  first place.

Three of those now carry **three separately hand-written per-call-site guards**
— `page.test.tsx` for the band, `admin-header.test.tsx` and
`site-footer.test.tsx` for #441 — and there is no law. A fourth guard would make
it a habit rather than a rule.

#### Why the cheap guard does not exist

#441 looked, and this is the part that should stop the next person rediscovering
it:

- **A blanket ban on `text-stone-400` needs four legitimate exemptions** —
  `ui/empty-state.tsx`, `vendors/profile/review-form.tsx` and two in
  `packages/package-manager.tsx`. All four are decorative glyphs on a *light*
  ground, where `stone-400` is exactly right.
- **A file-level "this file has an ink ground" rule matches 14 files**, most of
  which use `bg-stone-900` for a scrim, a chip, or one button variant while
  carrying ordinary light-ground text elsewhere.

The rule needs to know the **ground a given element renders on**, and no source
scan can see that.

#### Two options worth weighing

1. Extend `theme-tokens.test.ts`'s contrast table into a **role** table: which
   tokens may appear as `text-*` at all, which only as `border-*`, and on which
   grounds. It already owns the token vocabulary.
2. Assert it in the **browser**, during the parity pass, where the computed
   ground *is* observable — `parity-checker` already reads both colours and
   would only need the ramp membership rule.

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

**Milestone:** M6 | **Phase:** P3 | **Priority:** P1 High | **Status:** Backlog | **Capabilities:** `core` `auth`
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


### #454: Land the admin design delta — the drawn frames for every unframed console screen

**Milestone:** M6 | **Phase:** P3 | **Priority:** P1 High | **Status:** Backlog | **Capabilities:** `core` `auth`
**Blocked by:** None — the frames arrived 2026-09-07 and this ticket is what consumes them

**Filed 2026-09-07. The account holder supplied `design/delta-admin/` in answer
to #453**, which asked for frames and, per `design-is-a-contract-not-code`,
deliberately did not attempt them. The ask is now met: a build prompt
(`ADMIN-VIEWS-PROMPT.md`) and a drawn bundle (`Orla-Admin-Views.html`) covering
every admin route frame `13` never drew. **#453 is closed by that delivery, not
by this ticket.**

The bundle is **three patterns, two drawn frames and one ruling** — deliberately,
because nine screens do not need nine frames:

- **Pattern A — the four list routes** (`/admin/activity`, `/admin/cases`,
  `/admin/requests`, `/admin/categories`) reuse frame `13`'s table verbatim. This
  is the ruling #453's third ask requested. Only column grids, defaults, colour
  and empty behaviour differ, and the bundle states each.
- **Pattern B — one detail frame**, drawn on `/admin/vendors/[id]`, settling card
  order, label/value typography, long-field wrapping and where destructive
  actions may sit. The other three detail routes are given as card orders against
  it.
- **Pattern C — `/admin/cases/[caseId]`**, drawn in full including the
  two-position resolve control and its `ConfirmAction`.

#### This ticket takes the surfaces that already exist. #437 takes the five that do not

The split is the existing one and this ticket does not move it. **#437 is
unblocked by this filing** and builds `/admin/vendors/[id]`,
`/admin/customers/[id]`, `/admin/bookings/[id]`, `/admin/requests` and
`/admin/categories` against Pattern B — that was the frame it was held for, and
it now exists. Everything below is a surface on `main` today.

**Do not build a rail row for `/admin/requests`.** The bundle rules it a **tab
inside Bookings** (`Bookings · Requests`), because a request is a booking before
it exists and an operator reaches it while looking at bookings. That constraint
belongs to #437 and is recorded here so it is not lost between the two rows.

#### 1 — Reconcile the contract before touching code

`orla-design-reimport-is-a-merge` binds: the bundle is newer than
`22-admin.md` in the places it speaks to and silent everywhere else. Do the
design pass first, as its own commit, so the code that follows has something to
be measured against.

- **`22-admin.md` §Detail views is superseded.** It currently reads, in full,
  *"card-based groupings with the actions prominent. Every destructive action
  goes through an AlertDialog naming the consequence."* That single sentence was
  the entire spec five screens would have been invented from. Replace it with a
  pointer to Pattern B rather than a paraphrase.
- **The rail correction is an *order* change, not a count change.** The bundle's
  preamble reasons from a brief of eight rows and concludes the rail needs nine
  so Cases can carry a badge. **That premise is already stale**: `22-admin.md`
  gave Cases its own row on 2026-09-07 (#431) and `admin-nav.tsx` renders nine.
  What the bundle actually changes is **where Cases sits** — directly after
  `Bookings`, where the work arrives — against #431's ruling that it sits between
  `Payments` and `Reviews`. **The bundle wins**, and `22-admin.md`'s paragraph is
  rewritten to say so and to record what it overturned. A lane that reads this as
  "add a ninth row" will add a tenth.
- **Record that this bundle ships no `* { box-sizing: border-box }` reset.**
  Grepped and confirmed: its 0 `box-sizing` declarations put it with
  `Orla - Screens.dc.html` and *against* `delta-band`, `delta-legal` and
  `contact-support`. **#449 turns on exactly this distinction**, so a measurement
  taken off this bundle is content-box and must not be quoted at #449 as though
  it corroborated the border-box side. Add the line to
  `.claude/rules/web-design-parity.md` beside the existing #449 paragraph.
- **The action copy is now drawn, which changes #435's open filing.** The frame
  names `Unpublish profile` and `Suspend vendor`. #435 shipped
  `Unpublish storefront` and `Suspend account`. Those are no longer unapproved
  strings awaiting a design pass — they are **text-parity findings against a
  frame**, which is a different and smaller thing. Fix them here, in the design
  pass's own commit, and record them in `31-content-voice.md`.

#### 2 — The rail, and the two list screens that already exist

- **Move `Cases` to sit directly after `Bookings`.** One line in `ITEMS`, and the
  comment block above it currently argues at length for the position being
  replaced — rewrite it, do not leave a comment defending a decision the frame
  overturned.
- **`/admin/activity`.** Already correct on the thing that matters most: it
  carries no checkbox column and no `···` column, which is what makes it read as
  a log, and `22-admin.md` already gives the reason (the table is append-only in
  the database, so a control would offer something Postgres refuses). Outstanding
  against Pattern A: the column grid becomes
  `Actor 1.2fr · Action 1fr · Subject 1.6fr · When .9fr`, `Subject` becomes type
  + id in **one** cell (type `stone-600`, id mono `stone-900` — `booking ·
  BKG-8821`), and timestamps go **absolute to the minute** (`7 Sep 2026, 14:02`),
  never relative — an audit trail that rounds is not an audit trail. **See the
  design question below before deleting the `What changed` column.**
- **`/admin/cases`.** Columns become `Reference .9fr · Sender 1.2fr ·
  Subject 1.8fr · Booking .9fr · Age .6fr · Status .8fr`. Reference is mono and
  **is the row link**. A case with no linked booking renders `—` in `stone-500`,
  never blank. **`Age` is the pressure column** and carries the only new colour
  rule on this screen: stone under 24h, gold at 24h, red at 72h — and the red is
  the **SLA** failing, not the case. Two status pills only: Open (gold), Resolved
  (sage). Default filter open, oldest first, which is already the built
  behaviour (#431) and must survive the change.

#### 3 — Colour, which is fixed and not re-litigated per screen

`40-states.md` already binds — steel information, gold waiting on someone, red
failed, sage settled. The bundle only draws the consequences, and one of them is
the trap:

| Status | Colour |
| --- | --- |
| `pending`, `quoted` | gold |
| `accepted` | sage |
| `declined`, `cancelled`, `expired` | stone |
| payout attempt failed, chargeback, dispute reason | red |
| case open | gold · case resolved | sage · case age ≥72h | red |

**`expired` is stone, not red.** A clock running out is not a failure, and it is
the one every implementation gets wrong. Assert it.

#### 4 — The filtered-empty pattern, which is the hard part

This is a **new shared component**, not a per-screen string, and it partially
closes **#443** — that ticket's sixth finding is *"the filtered empty state
offers no way out where every other console empty state does"*. **File nothing
new for it; amend #443's row to record that this ticket closed that one finding
and leave its other five open.**

Both empties are drawn.

**True empty carries no button.** Nothing an operator does creates a case or an
activity row, so a button would offer an action that cannot help. The copy's job
is to say where rows come from, so that silence reads as calm rather than broken.
Serif 21px line plus one `stone-600` line.

**Filtered-empty has four requirements and they are hard on purpose:**

1. The heading **recites the active filters in the operator's own words** —
   *"No resolved chargeback cases for 'kessler' in the last 7 days."*
2. One line stating how many filters are narrowing the view.
3. **One button per filter, each dropping exactly that filter and carrying the
   count it would reveal** — `Open cases instead (4)`, `Any origin (2)`,
   `All time (9)`. Highest count is primary. **A route that would reveal zero is
   never offered as a button.**
4. `Clear all filters` last, as a ghost link — the escape, not the suggestion.

The counted routes are the entire point: an operator picks the widening that
*pays* instead of clearing everything and rebuilding the query from scratch.

**This needs count queries the API does not have.** Each button's number is one
count with that single filter dropped and the others held — so a screen with
three active filters costs three counts. Do it in **one** round trip per screen,
not N, and do not compute it in the web layer by over-fetching rows. And note
the shape of the requirement: a button that would reveal zero must not render,
so the count has to be known **before** the button is drawn, not after.

#### 5 — Parity on the two detail screens that already exist

Neither is a rebuild. Both were built to a convention and now have a contract.

- **`/admin/users/[userId]` against Pattern B.** The one thing to check hardest
  is **the closure refusal**, because the frame draws it as *prevention*: with a
  future confirmed booking the button is **disabled**, and a gold panel above it
  reads *"Can't close: 1 confirmed booking on 12 Sep 2026. Cancel or complete it
  first."*, linking the booking. **D39's 409 is shown before the press, never as
  an error after it.** #438 built the refusal; this checks it is drawn as the
  frame draws it. Also Pattern B's rule 4 — no destructive control inside a
  read-only card — and rule 3, that the legal-acceptance record's identifiers
  wrap rather than truncate.
- **`/admin/cases/[caseId]` against Pattern C.** Three **numbered** regions with
  the numbers visible, and the resolve control **last**, reachable only past the
  evidence: *the scroll is half the safeguard and the copy is the other half*.
  The two positions are **equal weight, side by side** — not a primary and a
  secondary, because the operator's job is to judge and a filled clay button on
  one side would be the product voting. Each names its consequence in money
  **and what the other party gets**, with the payout date by name. The
  `ConfirmAction` **restates rather than summarises**: amount in the title, the
  counterparty's zero in the body, the field that will be written
  (`cancelled_by = admin`), the thing operators get wrong in a gold panel
  (*"Refunds settle in 5–10 days. Stripe's dispute stays open until the bank
  closes it — refunding does not withdraw it."*), and a cancel button reading
  **"Keep the case open"** — because "Cancel" on this screen is a verb about
  money.

#### Design questions — ALL THREE ANSWERED 2026-09-07 by the account holder

**Nothing here is open. Build the rulings; do not re-ask.** The questions are
kept with their answers because each one records what was overturned, and a lane
that finds the frame disagreeing with the code needs to know which way it was
settled rather than rediscovering the conflict.

**1. `Suspend vendor` keeps refunding in full — the frame's copy is loose.**
The drawn Actions card says a suspension *"holds payouts"*. It does not, and it
must not start to: D31 (#416) ruled that the unwind refunds every future
confirmed booking in full and reverses the vendor's share out of their Stripe
balance, which can leave it negative — and being told that was the point of the
dialog. **Correct the bundle's description to say what suspension does**, and
record it in `.claude/rules/web-design-parity.md` as transcription drift under
D30, the same direction every other frame-versus-ruling disagreement has gone.
`account-unwind.ts` is untouched by this ticket. **A later pass reading
"holds payouts" in the bundle is reading the record of a correction, not a
finding** — which is exactly the failure this answer exists to prevent, because
a frame in the repository saying one thing beside code doing another gets
implemented by whoever reads the frame first.

**2. `/admin/activity` keeps its `What changed` column — five columns, not
four.** Pattern A lists four and the built screen has five. The fifth stays: the
same Pattern A paragraph forbids rounding a timestamp on the grounds that *an
audit trail that rounds is not an audit trail*, and a trail recording that
something changed but not what fails that test harder. Take the rest of Pattern
A's ruling — the `Actor · Action · Subject · When` ordering, Subject as type +
id in one cell, absolute timestamps — and fit `What changed` after `Subject`,
keeping its existing `1.7fr`. Correct the bundle to draw five.

**3. The route stays `/admin/tags`.** The bundle calls it `/admin/categories`;
nothing drawn depends on the path, and a rename breaks operator bookmarks and
any `admin_actions` subject link already written against the old one. Correct
the bundle's route name. The rail label `Categories & tags` is unchanged.

Each of the three corrections above edits the **bundle**, which is a design
pass, and they belong in the same commit as the `22-admin.md` reconciliation in
step 1 — not scattered through the code commits.

#### The three questions as they were asked

1. **Does `/admin/activity` lose its `What changed` column?** Pattern A lists
   four columns and does not include it; the built screen has five, and
   `22-admin.md` specifies `When · Operator · Action · Subject · What changed`.
   The recommendation is **keep it**: the same paragraph forbids rounding a
   timestamp on the grounds that an audit trail that rounds is not an audit
   trail, and a trail that records *that* something changed but not *what* fails
   the same test harder. Most likely the bundle was written at pattern level and
   the column was not considered. **Confirm before deleting data from a log.**
2. **Does `/admin/tags` become `/admin/categories`?** The bundle names the route
   `/admin/categories`; the app serves `/admin/tags` and the rail says
   `Categories & tags`. Nothing drawn depends on the path. The recommendation is
   **keep `/admin/tags`** — a rename breaks operator bookmarks and any
   `admin_actions` subject link already written against it, for no drawn
   difference. Confirm rather than assume, since the bundle does name a path.

3. **Does `Suspend vendor` hold payouts or refund in full?** This one is about
   money and must not be guessed. The drawn Actions card reads *"Unpublishes,
   cancels 2 pending requests and **holds payouts**. Confirms first."* The
   implementation does something materially different and always has: a ban
   declines every open request, cancels every future confirmed booking and
   **refunds it in full** — and D31 (#416) deliberately made that refund reverse
   the vendor's share out of their Stripe balance, which can leave it negative.
   That is why the shipped dialog says so at length; being told was the ruled
   requirement.

   **Holding and refunding are not the same action.** A hold is reversible and
   leaves the customer's money where it is; a full refund is neither. So either
   the card's copy is loose about an action it is summarising, or the intended
   behaviour of suspension has changed and the unwind is now wrong.

   **The risk of leaving it unanswered is the reason it is a blocker for this
   part of the ticket and not a footnote**: a frame in the repository saying
   suspend holds payouts, sitting beside code that refunds in full, will be read
   by the next lane as the spec — and it will change what a suspension does to
   somebody's money without anyone deciding to. It reaches past #435, because
   #433 extracted that same unwind into `account-unwind.ts`.

   Everything else in this ticket is buildable while this is open. Do not build
   the Actions card's consequence lines until it is answered.

#### Acceptance

1. `22-admin.md` §Detail views points at Pattern B rather than describing detail
   views in one sentence, and its rail paragraph records that Cases moved and
   what that overturned.
2. The rail renders `Overview · Vendors · Customers · Bookings · Cases (badge) ·
   Payments · Reviews (badge) · Categories & tags · Activity` — nine rows, badges
   on Cases and Reviews only.
3. `/admin/activity` matches Pattern A's grid, renders Subject as type + id in
   one cell, and prints timestamps absolute to the minute.
4. `/admin/cases` matches Pattern A's grid; Reference is the row link; a case
   with no booking renders `—`; Age is stone/gold/red at the drawn thresholds;
   open + oldest-first survives.
5. `expired` renders stone, and no status in this delta renders red except a
   payout failure, a chargeback and a dispute reason.
6. Every filtered-empty state offers one widening button **per active filter**,
   each carrying the count it would reveal, never offering a zero-count route,
   with `Clear all filters` last as a ghost link. **"Every" means all seven
   console lists** — `/admin/cases`, `/admin/activity`, `/admin/vendors`,
   `/admin/bookings`, `/admin/customers`, `/admin/payments` and
   `/admin/reviews` — confirmed 2026-09-07 when the lane asked whether the
   first three were the scope. **A half-applied pattern is worse than either
   state**: an operator who learns on one screen that a dead end offers counted
   ways out reads its absence on another as the screen being broken. If a
   filter's count will not fit the single-scan `count(*) filter (where …)`
   shape, stop at the ones that do and file the rest — do not force a query
   shape to satisfy the word "every"; and **say in the commit which screens
   have it and which do not**, because implicit coverage is what turned #443's
   sixth finding into a rediscovery.
7. `/admin/users/[userId]` draws the closure refusal as a disabled button plus a
   gold panel naming the blocking booking and linking it — before the press.
8. `/admin/cases/[caseId]` draws three numbered regions with the resolve control
   last and its two positions at equal weight, each stating its own figure and
   the other party's.
9. Both resolve confirms name `cancelled_by` and the payout sweep date
   explicitly, and cancel reads `Keep the case open`.
10. `31-content-voice.md` records the drawn action copy, and the shipped
    `Unpublish storefront` / `Suspend account` are corrected to the frame's
    `Unpublish profile` / `Suspend vendor`.
11. `.claude/rules/web-design-parity.md` records that this bundle is
    **content-box**, beside the #449 paragraph that turns on it.
12. The bundle's `Suspend vendor` description says what a suspension does — a
    full refund under D31 — and `web-design-parity.md` records the correction as
    a live override so no later pass re-finds it.
13. `/admin/activity` renders **five** columns with `What changed` after
    `Subject`, and the bundle draws five.
14. The category route is still `/admin/tags`, and the bundle names it that.

#### Tests (required)

- [ ] A test per acceptance, watched failing first.
- [ ] Acceptance 5 asserted as a **table over every status in the delta**, not as
      one case — the defect this guards is a whole-vocabulary mistake, and a
      single `expired` assertion passes while five siblings are wrong.
- [ ] Acceptance 6 asserted with a fixture where **one widening reveals zero**,
      so the test fails if a zero-count button renders. A fixture where every
      route reveals rows cannot fail that requirement — it is the
      `verify-with-a-differently-shaped-check` shape, and this is the acceptance
      most likely to be faked by a happy fixture.
- [ ] Acceptance 7 driven through a real account **holding a future confirmed
      booking**, so the disabled state is observed rather than the enabled one.
      An account with no bookings renders the button enabled and proves nothing.
- [ ] Parity: `parity-checker` at 1440x900 against `Orla-Admin-Views.html` for
      `/admin/cases/[caseId]` and `/admin/users/[userId]`, and against frame `13`
      for `/admin/activity` and `/admin/cases`. Six axes.
- [ ] Browser: both list screens at a filtered-empty state, and the case detail
      driven to **both** resolve confirms without pressing either.

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

### #456: Two moderation labels disagree with the frame that now draws them

**Milestone:** M6 | **Phase:** P3 | **Priority:** P2 Medium | **Status:** Backlog | **Capabilities:** `core` `auth`
**Blocked by:** #454 — the frames land with it

#### The mismatch

| Shipped by #435 | Drawn by `design/delta-admin/Orla-Admin-Views.html` |
| --- | --- |
| `Unpublish storefront` | **`Unpublish profile`** |
| `Suspend account` | **`Suspend vendor`** |

#### Why this is a defect and not a preference

`web-design-parity.md`: *"Same composition with reworded copy has failed too —
the words **are** the design."* The frame is the acceptance criterion.

**The sequencing is the excuse and also the lesson.** #435 wrote these strings
when no frame drew the vendor detail view and `31-content-voice.md` recorded
nothing for them; the lane deliberately refused to add them to the voice file
itself, because a ticket writes code and a design pass edits the plan. The frame
arrived afterwards. Nothing was done wrong — the strings simply predate their
own contract, and now that it exists they have to match it.

The **descriptions** already agree in substance: #435's unpublish copy says open
requests stand, confirmed bookings stand, no refund is issued and the vendor can
still sign in; the card says existing bookings stand and the vendor keeps their
dashboard. Same promise. This ticket is the two labels and the four assertions
that pin them.

#### Read this before touching the suspend copy

The same card describes **Suspend vendor** as *"Unpublishes, cancels 2 pending
requests and **holds payouts**"*, where the implemented ban cancels and **refunds
in full**, reversing the vendor's share out of their Stripe balance (D31/#416).
That contradiction is **design question 3 in #454** and is not settled. Change the
label here; do not change what the dialog promises about money until it is.

#### Tests (required)

- [ ] The menu item, dialog title and confirm label all read the frame's word —
      one verb per action, asserted across all of them.
- [ ] The existing "cannot be confused with the suspend dialog" assertions still
      hold with the new labels.

### #457: A moderation hold the moderated vendor cannot lift

**Milestone:** M6 | **Phase:** P3 | **Priority:** P0 Critical | **Status:** Backlog | **Capabilities:** `core` `auth`
**Blocked by:** #454 — the vendor detail Actions card is where the control lives

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


### #458: A vendor is offered a Report control on their own storefront

**Milestone:** M6 | **Phase:** P3 | **Priority:** P3 Low | **Status:** Backlog | **Capabilities:** `core` `auth`
**Blocked by:** None

**Filed 2026-09-07 by #436's browser pass, against #436's own surface.** The
report controls on `/vendors/[slug]` take `signedIn` and nothing else, so a
vendor viewing their own storefront is offered *Report this profile*, *Report
this photo* and *Report this review* on their own work — and filing one
succeeds.

`/reports` checks that the subject resolves and, for a conversation, that the
caller is a party. A public subject is reportable by anyone signed in, and that
is **deliberate**: restricting a storefront report would only stop the
passer-by who noticed something, who is the person the feature exists for.

Not a security issue and not urgent — a vendor can only report themselves. The
cost is a real case in the operations queue naming a vendor as their own
reporter, which an operator has to open in order to dismiss.

#### Two of the three controls, not all three — ruled 2026-09-07

**Hide the control on the profile and the portfolio. Keep it on reviews.** The
row as filed said "their own storefront" and meant all three; that is right for
two of them and wrong for the third, and the difference is the subject.

- **Profile and photo** — the subject is the vendor's **own record**. The case
  names them as their own reporter about their own work, and there is nothing
  for an operator to do but close it. This is the noise the row was filed about.
- **A review** — the subject is a **customer's** content, written *about* them.
  A vendor objecting to it is not self-reporting; it is the ordinary case of a
  person objecting to what somebody else published about them, and that case
  belongs in the queue.

**And it is their only channel.** `apps/web/src/app/vendor/` has no reviews
route, so a vendor has no surface of their own on which a review appears at all.
Hiding the report control would leave someone facing a defamatory or
extortionate review with no route to raise it — **trading a dismissible case for
a real one nobody can file.** That is a worse defect than the one being fixed.

#### The fix is a viewer check, not a server refusal

The pane knows the slug and the page already resolves `viewerRole`, so thread
the vendor's own profile id in and hide the control where they match.

**Do not refuse it at the API.** `/reports` answering 403 to the owner would
refuse the one caller whose complaint is least likely to be malicious, and — the
part that matters — it would **leak the owner's identity to anybody probing**: a
403-on-owner turns the endpoint into an oracle for who owns a storefront. Add no
server-side owner check as belt-and-braces; the belt is what does the damage.

**Read the owner's profile id with a read that cannot redirect.** The protected
`getOwnVendorProfile` redirects on an expired session, a suspension or the terms
gate — and calling it from a **public** storefront turns a stranger's page load
into somebody else's redirect, which is the #33 class. Use a read that degrades
to `null`, and let `null` mean *not the owner*, so a failed read leaves today's
behaviour rather than hiding the control from every visitor. Gate the call on
`viewerRole === 'vendor'` so no customer or signed-out visitor pays a
`/vendor/profile` round trip on the one page that is public and hot.

#### Acceptance

1. A vendor viewing their own storefront is offered **no** report control on the
   about pane or the portfolio pane.
2. That same vendor **is** still offered a report control on each review.
3. A different signed-in user viewing that storefront is offered all three.
4. A signed-out visitor sees the sign-in affordance, unchanged.
5. `/reports` is **untouched** — no owner check reaches the API, and the route's
   diff is empty.
6. `/vendor/profile` is not requested for a signed-out, customer or admin viewer.

#### Tests (required)

- [ ] A test per acceptance, watched failing first.
- [ ] **Assert positive content before asserting absence.** "No control" and
      "the pane did not render" are indistinguishable otherwise — the trap #436
      hit on this same surface the same day, where an unseeded reviews tab read
      as a missing control. Anchor each owner case on real content from that
      pane (the bio, the portfolio tiles, a reviewer's name) first.
- [ ] **Acceptance 2 is the one most likely to be faked**, because a test
      asserting a control is *present* passes against a page that renders it for
      everyone. Pair it with acceptance 3 over the same fixture.
- [ ] Mutation-check the guard: flipping it must fail exactly the owner cases
      and nothing else.
- [ ] Browser: the owner and a different signed-in user, against the same URL.

#### What this ticket does not cover

**A vendor has no reviews surface of their own** — no route under
`apps/web/src/app/vendor/` shows the reviews written about them, which is why
the report control on the public storefront is their only channel. That is a
real absence and a pre-existing one, unrelated in size to this P3. If it is
worth a row it is worth its own; do not widen this one into it.

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
