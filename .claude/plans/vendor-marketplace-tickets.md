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
| **313** | **Sign-up and session entry** | P1 | M3 | **P1 High** | **Backlog** | `worktree-313b` | **#385** — the contrast ruling only. **The other two blockers are gone:** D16 answered the submit label (the row below records it as answered, now code), and `#333` was superseded by **#373**, which landed 2026-08-31. Renaming the Clerk application moved to **#362** | `core` `auth` | **Second slice landed 2026-08-30 — squash `a806d63`, PR #70, required CI green, browser-verified at 1440x900.** The role now survives email verification: Clerk's verification step is a path navigation that remounts the form, so `role` came back null and the picker asked again, contradicting the subhead's own promise. It is read back from the in-flight `unsafeMetadata`, **narrowed** to the two sign-up roles because that metadata is client-writable and `admin` is a real `UserRole` this screen must never confer, and the picker is **not rendered** rather than `hidden` (which would leave the radios submittable). Also corrected frame `12`'s panel padding to `46px 48px` and its body measure to 415px, verified on `/sign-in` as well since `AuthScreen` is shared. **Blocked on three decisions, none of them code:** (1) **`Create my account` is not reachable by changing a string** — verified against Clerk's own `en-US` source that `formButtonPrimary` appears **once, at the top level**, with no `signUp.start` variant, and `<SignUp />` takes **no `localization` prop**, so setting it also relabels `/sign-in`. The comment in `clerk-copy.ts` was **right**, and #365 was wrong to call it stale. Scoping needs a route-aware or nested `ClerkProvider` — an auth-stability decision. The password helper `At least 10 characters` is blocked identically, since it belongs inside Clerk's card. (2) **The contrast ruling and the measurement disagree** — D16 ruled no scrim with contrast guaranteed by selection; parity found a scrim matching the frame byte for byte and the gold italic accent at **3.81:1** against a blanket 4.5:1 with no large-text carve-out. (3) **`sage-175` and the missing 14px/11.5px type steps belong to #333**, which owns scale completion. **The post-verification remount is unit-tested, not browser-driven** — it needs a fresh Clerk sign-up with a reachable inbox, which no lane has. Said plainly rather than implied. **Unblocked 2026-08-30 by D16 — all three rulings given.** (1) `Create my account` is the approved string and the plan already said so; live reads Clerk's default `Continue`, which is a code defect. (2) The panel photograph is **fixed and hand-picked**, contrast guaranteed by selection — **no scrim**, and it is never rotated or made dynamic. (3) The role picker reappearing after verification is a **defect**: the role is already in `unsafeMetadata` before verification, so it is read back from there rather than re-asked. No larger select-role-after-verification flow needed. **Filed 2026-08-29 by the backlog consolidation.** Merges **#194, #197, #226, #234, #259**. **Two halves, and the first is implementable today**: the header renders its signed-out variant on the first navigation in a fresh browser context (#259), and Clerk's own sign-in card reads `vendor-marketplace` to the user instead of `BRAND_NAME` (#234). The second half is **three rulings, and this ticket asks for all three at once rather than three tickets asking separately** — the primary action reads `Continue` where the frame says `Create my account` (#194); panel text over photography is not contrast-guaranteed and needs either a scrim or a ruling that the photography is fixed (#197); and sign-up returns to the role picker after email verification (#226), which is either a Clerk redirect defect or an intended re-confirmation. Do the first half, then return **BLOCKED with the three questions together** if they are still unanswered. **First half done 2026-08-30 (`worktree-313`).** #259 is **not a product defect** — it reproduces only from a restored `storageState`; a real sign-in takes 0 handshake hops and paints correctly on the first navigation. Filed as **#321**, which matters more than the ticket it came from because every browser verification here restores state. #234 is fixed as far as code reaches: `.cl-headerTitle` now reads the brand, though it was never visible (the app hides Clerk's header). **Four questions now wait on a human**, the three rulings plus renaming the Clerk application itself — that name is the source every `{{applicationName}}` key interpolates, and it is dashboard configuration on the shared instance. | **Found 2026-08-30 by #9's parity pass:** the site header renders **signed-out chrome on an authenticated vendor page** — `window.Clerk.loaded === true` and `Clerk.user.id` is populated after a 15s settle, yet `/vendor/dashboard`'s header reads `Sign in` / `Sign up` where frame `08` draws `View my public profile` and the avatar. Reproduced at 1440x900 signed in as the vendor.
| **362** | **[PLATFORM] External-account provisioning — one dashboard session** | INFRA | M-OPS | **P0 Critical** | **Deferred — needs a human** | — | **The account holder — every item is a provider-console action** | all | **Filed 2026-08-30 by the second backlog consolidation.** Merges **#19, #46 (residual), #62, #206**. Every item is the same actor doing the same kind of thing — signing into a provider console to mint, rename or rotate a value — and **none of it is repository code**. Three of the four already point at each other: #62 calls itself *"a #19 prerequisite"*, #206's Notes say it *"overlaps #19"* and is *"a pointer, not a queue item"*, and #46's remaining scope is one rotation (its code scopes 1 and 2 are Done in `34cd28c`, `ed41aed`). Split, this is four separate asks of one person. The checklist: **rotate `CLERK_WEBHOOK_SECRET`** (leaked to a transcript 2026-08-27 — rotate, deleting is not enough); **rename the Clerk application** to `BRAND_NAME`, which is the source every `{{applicationName}}` key reads; **change the Stripe public business name** from `VendYou`, which renders on Connect onboarding, on Checkout and as the **statement descriptor**; **mint production credentials** in Clerk, Stripe, R2 and Resend, newly minted rather than copied; pooled string on Railway, unpooled on Railway **and** GitHub Actions. **Supplying `SENTRY_DSN` belongs here too and unblocks #353.** The Neon Launch upgrade (#206) stays **launch-gated** in `docs/pre-launch.md` §3.2 and is not current work. |
| **370** | **Production deploy pipeline and error visibility** | P1.5 | M4.5 | **P0 Critical** | **Backlog** | — | **#362** (production credentials and `SENTRY_DSN`) | `core` `sentry` | **Filed 2026-08-31 by the third backlog consolidation.** Merges **#20, #353**. One deliverable: merging to `main` ships — migrations first, both services after, a failed `/ready` poll stops the release — and what it ships reports its own errors somewhere a human reads. Split, the two waited on the same #362 sitting. |
| **371** | **Responsive parity at 1024 and 768** | P1 | M3 | **P1 High** | **Backlog** | `worktree-371` | **#385** (the ruling round that absorbed #377 and #378) | `core` `stripe` | **MEASUREMENT PASS COMPLETE 2026-08-31 — acceptance line 1 is met.** All seven frames measured at their declared sizes before any edit, each against **both** neighbouring widths rather than in isolation. **That method changed the ticket.** **Three frames are blocked, not unbuilt.** `27 Search results / loading / no-results — 1024` are **stale**: corroborated against `02 Search` (1440) and `14 Search tablet` (768), the 1024 frame alone disagrees with both on card radius (16/**14**/16), name (19/**18**/19), price (17/**16**/17), meta (12/**11.5**/12) and the count-heading band (drawn/**absent**/drawn), and still draws a `Distance` chip, a `Free on Jun 14 ✕` chip and an `18 free that day` count that **D16** removed. Only the 20px gutter and the 3-column grid survive. Edits already made from those numbers were **reverted** rather than shipped. Filed as **#377**. **Two frames were unrenderable and are now fixed** — the ticket's own rule is that a pass which cannot render the frame proves nothing. `27 Vendor dashboard — empty · 1024` had no producible state (all 17 profiles published, one sign-in path) → `pnpm db:seed:e2e:draft`, `3da72be`. `27 Checkout — 1024` answered **404** for the E2E customer at every viewport, because the fixture wrote `stripeOnboarded` without `stripeAccountId` — a state the product cannot reach → `be02b46`; the class is **#381**. **A live P1 was found on the way and fixed:** every state-filtered search returned **500** (`lower()` on the `us_state` enum #332 introduced), so the canonical `/search` URL the app builds for itself was the failure page for every visitor — `26f4503`, three regression tests, the filter had none. **Acceptance line 6 is answered: the six is correct**, not the frames' seven — see **#378** for the four sources. **`27 Vendor profile — 768` and `27 Vendor profile editor — 768` corroborated clean and are the deliverable remainder.** Measured, not yet built: the booking rail **does not become a sticky bottom bar** (it is `position:static`, a stacked card — the ticket's headline item, frame spec `position:absolute;left:0;right:0;bottom:0`, `#FFFDF9`, `1px solid #E4DDD1`, `12px 24px`, `gap:16px`, `0 -4px 18px rgba(35,32,28,.07)`, holding From/price, a 180px date field, `Request booking`, `Message`); the editor renders **no section nav at all** at 768 (`display:none`, frame draws a 48px horizontal chip row) and its whole responsive story sits on `lg:`, so **768 renders the 390 composition** — one breakpoint short of the frame set, not a set of tuning misses; the editor's scroll budget is **2.09×** against `04-laws.md`'s 1.0×; **`04-laws.md` rule 5 fails, measured** — the sticky save bar overlaps two live controls at `scrollY 900` because the scrolling pane's `padding-bottom` is `0px`; the publish switch is **32×18** against the 44×44 law at 768; and bio/stats max-widths render the **1024** frame's values at 768 (520/440 vs 600/480). **RECORDED DEVIATION — the bar overlays content mid-scroll, and that is the design, not a defect.** The browser pass was given "no interactive element is overlapped at any scroll offset" as its criterion and correctly reported **FAIL** at mid-scroll: at 768x600, scrollY 164, two footer links signed in (three signed out) were fully covered with their centres intercepted. **The criterion was wrong, not the code.** A bar whose stated job is to persist over scrolling content necessarily overlays it — `30-responsive.md:88`: *"The primary action stays reachable. On mobile that means a sticky bottom bar, not a button pushed below a scroll"* — and frame `27 Vendor profile — 768` draws it `position:absolute;bottom:0` **over** the pane. The requirement that does bind is `30-responsive.md:160`: *"any pane with a fixed bottom action bar needs bottom padding equal to the bar's height ... or the last card's price row lands underneath it"* — content must not **end** underneath it. That is met and measured: at 768x1024 **zero** intersections across every link, button and input, both auth states, with `All vendors` moved from `404,951` to `404,863`, 74px clear; and at 768x600 max scroll every footer link resolves to itself. The defect that mattered — a page that did not scroll at all, leaving `All vendors` permanently unreachable — is gone. **Also recorded:** `xl:` (1280, a width no frame draws) survives in ~10 more files — **#372** owns most of those surfaces and should absorb the sweep plus a guard test. **Filed:** #377, #378, #379, #380, #381. **Filed 2026-08-31 by the third backlog consolidation.** Merges **#323, #354, #355, #356**. One ladder walked once — search, checkout, vendor profile, the profile editor and the empty dashboard, at both widths. Four tickets that were the same work split by frame. **Returned to Backlog 2026-09-03 by the autonomous QA run:** In Progress with no live session. Work is on worktree-371 (10 commits, never pushed, `e908d1a`); resume from that branch rather than rebuilding. |
| **372** | **Design parity close-out — dashboard, bookings, chrome and the error page** | P1 | M3 | **P2 Medium** | **Backlog** | — | **#374** (owns the `Contact support` destination) — **#358 landed 2026-08-31 (`8e9208d`), so its collision is cleared** | `core` `auth` | **Filed 2026-08-31 by the third backlog consolidation.** Merges **#300, #359, #361, #366, #367**. The last 1440 parity debt in one pass: frames `08`, `04`/`07`/`19`, `16`, `18`, and the site chrome no frame owns. |
| **374** | **Launch legal, policy and support surfaces** | P3 | M6 | **P0 Critical** | **Deferred — needs a human** | — | **The account holder: (1) the operative wording of the terms, privacy policy and vendor agreement — a ticket must not invent binding text; (2) a real monitored support address or destination** | `core` | **Filed 2026-08-31.** Not a consolidation — a gap nobody had filed. `docs/pre-launch.md` §1.5 and §7 require terms, a privacy policy, a cookie notice, a vendor agreement covering the 12% commission and payout timing, a refund and cancellation policy shown **before** payment, and a support route that reaches a human. **None of those routes exist in `apps/web/src/app`.** The product cannot take money from strangers without them. |
| **383** | **Focus indicators — one ring per control, and one idiom for the whole app** | P1 | M3 | **P1 High** | **Backlog** | — | **None** | `core` | **Filed 2026-08-31 on the user's report**, verbatim: *"ensure theres a ticket there to fix the issue of multiple (including an outdated focus) on the inputs.. and verify it across the app that that issue doesnt persist. I am seeing it in multiple places right now."* **Root cause located, not guessed.** `globals.css:152-154` applies `ring-2 ring-clay-400/30 ring-offset-2 ring-offset-stone-50 outline-none` to **every** `:focus-visible` node in the app. Tailwind's `ring` and `inset-ring` write **different** custom properties (`--tw-ring-shadow` / `--tw-inset-ring-shadow`), and `outline` is a different CSS property again — so a component that adds an inset ring or an outline paints **its own indicator and the global one at the same time**. Three components already found this and turned the global ring off by hand (`profile-tabs.tsx:141`, `vendor-card.tsx:164`, `command.tsx:78`); seven more did not. **The "outdated" half is literal:** that global rule is the *superseded* law. `03-components.md:120-124` replaced "the offset ring for everything" with **three treatments by element type** and says so in as many words; the global rule is the old one, still shipping, and at `/30` where even `04-laws.md:135` says `/40`. Full site table in the detail section |
| **384** | **Search rework — `City` becomes a place search over every US city, not the inventory list** | P1 | M3 | **P1 High** | **Backlog** | — | **None** | `core` | **Filed 2026-08-31 on the user's explicit instruction**, verbatim: *"i currently want the city dropdown to function the way airbnb's 'where' input functions. Do not preload and indicate how many vendors are in each city.. users should be able to search for any city and see the results."* **The third user override of the design contract, after #364 and #375 — record it as one.** It overrides #375's own closing invariant (*"A free-text city that reaches the API as a filter is a regression, not this ticket"*) and D6's rule that the field may only ask questions the platform can answer. Three things go: the preloaded `GET /vendors/cities` payload, `vendorCount` as a ranking **and** display signal, and the rule that a city with nobody in it is unpickable. **The `(city, state)` pair survives** — `state` has been the closed `us_state` enum since #332 and "Springfield" still names a place in thirty-odd states — so a suggestion still names its state; what changes is *which* places may be suggested. Detail section carries the scope, the suggestion source and the empty-state contract |
| **385** | **[DESIGN] Ruling round — the four questions blocking #371 and #313** | P1 | M3 | **P1 High** | **Backlog** | — | **A design pass: it edits `design/` and answers product rulings, which `web-design-parity.md` reserves for one** | `core` | **Filed 2026-08-31 by the fourth backlog consolidation. Merges #377, #378 and #380**, and takes the contrast question out of **#313**'s blocked half. One person, one sitting, one design bundle open. Split, they stall four separate times for one reason — and three of the four block the same ticket, so answering them one at a time re-opens #371 three times. **Same shape as #335**, the 2026-08-29 ruling round that unblocked eleven rows at once. The merged rows carry the measurements and are the checklist. **Order: rule first, re-cut second, and only then do #371, #313 and #386 become ordinary code work** |
| **386** | **Visual corrections read off the frames — four undefined ramp steps and the search skeleton** | P2 | M3 | **P2 Medium** | **Backlog** | `worktree-386` | **None** | `core` | **Filed 2026-08-31 by the fourth backlog consolidation. Merges #376 and #379.** Both are single-pass corrections whose value is read off a frame and then guarded; both are unblocked; and neither fills a lane on its own, while each would otherwise cost a worktree, a preflight, a PR and a merge. One browser session covers all three frames — `05 Checkout`, `06 Booking confirmed`, `17 Search loading`. The merged rows carry the measurements and are not restated **Returned to Backlog 2026-09-03 by the autonomous QA run:** In Progress with no live session. Work is on worktree-386 (checkpointed `4877d7a`); resume from that branch rather than rebuilding. |
| **388** | **Forms reject the first submit in silence** | P1 | M3 | **P1 High** | **Backlog** | `worktree-388` | **None** | `core` | **Filed 2026-08-31 by the pre-launch QA passthrough.** Two of the three form surfaces a vendor must clear reject a pristine submit with **no POST, no `aria-invalid`, no `role=alert`, no message anywhere on the page** — the button appears inert. Confirmed on **Add package** (`/vendor/packages`) and **Create profile** (`/vendor/profile/edit`, the screen every new vendor is funnelled to). Focus moves to the offending control, which is the only signal, and it is silent for a screen reader. A **second** submit does render the summary, so the machinery exists and the first pass does not reach it. The booking-request form validates correctly but never announces it either. Includes the Price filter, which discards non-numeric input with no message **Returned to Backlog 2026-09-03 by the autonomous QA run:** In Progress with no live session. Work is on worktree-388 (checkpointed `32b00b3`); resume from that branch rather than rebuilding. |
| **392** | **Frame `13 Admin` parity debt — four class-level misses and the missing chevrons** | P1 | M3 | **P2 Medium** | **Backlog** | — | **None** | `core` | **Filed 2026-08-31 by #389's `parity-checker` pass.** Frame `13` matched on all six axes for #389's own change, and the pass surfaced five pre-existing misses it did not own. **#372 does not cover these** — it closes frames `08`, `04`/`07`/`19`, `16`, `18` and the site chrome, not `13`. **All five are class- or token-level, so no viewport can change them** — re-derived from source after a peer challenged whether the readings were taken at 1440: the pane uses `rounded-xl` → `--radius-xl: 14px` (`theme.css:221`) where the frame draws 12px, which is `--radius-panel` on the line above; `admin-nav.tsx:66` is `min-h-11` in a `gap-1` list, a 48px pitch by construction against the frame's 34px, ending the rail 93px low; `status-pill.tsx:40` is `px-2.5 py-1.5 text-xs font-bold` against the frame's `10px/700` with `padding 5px 10px` (47.36×26 vs 44.88×23), and that size comes from `03-components.md`'s vocabulary, so **the plan is what needs correcting, not only the component**; the avatar initial renders `font-sans` where the frame draws Instrument Serif; and `filter-bar.tsx`'s `Category ▾ / City ▾ / Payouts ▾` triggers render **no `▾` glyph at all** (`innerHTML` is bare text, zero children), which walks City 15px and Payouts 25.6px left of their frame positions. **Not in scope:** frame `13`'s table pane clipping its own fifteenth row by 4px — that is **#385**'s to rule on, and the app reproduces it within a pixel or two |
| **393** | **Admin tables have no responsive strategy below 1024** | P1 | M4.5 | **P2 Medium** | **Backlog** | — | **None** | `core` | **Filed 2026-08-31 by #389's browser pass.** `30-responsive.md:31` specifies Admin as `768 → Horizontal scroll` and `390 → Card list, not a table`. **Neither exists.** After #389 the layout is correct at every width and nothing overflows — but at 390 `/admin/reviews` resolves to `12.2px 31.73px 31.73px 21.97px 46.38px 21.97px 70px`, so headers render `R…`, `A…`, `W…` and body cells `4…`, `Ro…`, `T…`. **A 12px column cannot show more than an ellipsis**, so the tables are legible only at 1024 and above. This is #389's fix working, not failing: before it, the rows were mutually misaligned *and* the document scrolled sideways, so the contract's 768 row was never actually implemented either — the old horizontal scroll was incoherence, not a degradation. Ruling needed on whether 768 keeps the contract's scroll-inside-the-pane or follows 390 to cards |
| **394** | **The booking confirmation screen answers 500 for every customer** | P1 | M4.5 | **P0 Critical** | **In Progress** | `main` | **None** — #387 landed, so the file-holding conflict is gone | `core` | **Filed 2026-08-31 from #363's browser pass**, which could not verify its own change because the screen never renders. `GET /customer/booking-requests/:id/booking` (`payments.routes.ts:70`) serialises with **`bookingSchema`**, which declares neither `eventType` nor `venue`, so Fastify's serialiser strips both from a 200. The web parses the same body with `wireBookingSchema` = `bookingWithContextSchema`, where both are **`.nullable()` — nullable, not optional** — so the parse throws, `getBookingForRequest` raises, and the RSC 500s. The list route is correct (`booking-requests.routes.ts:167` uses `z.array(bookingWithContextSchema)`), which is why `/bookings` renders and only the single read fails. **Also carries the frame `06` label fix, lifted out of #363** so both land in one browser pass: `booking-confirmed.tsx` prints `booking.eventType` verbatim, and the column holds the slug, so the occasion renders `wedding · Barr Mansion · Austin, TX` in lower case. The component fix and its two tests were written and shown failing-before under #363; they were reverted from that lane because the 500 makes them unverifiable and the route fix belongs to a file lane #387 is live in **The 500 is fixed by #387 (squash `cd33f70`).** The route now serialises `bookingWithContextSchema`, `reconcileBooking` supplies `eventType` and `venue`, and an API test asserts the serialised 200 carries both — acceptance 1, 3 and 5, plus the required API test. **Still open here:** acceptance 2 (the occasion still prints verbatim at `booking-confirmed.tsx:107`, with no `EVENT_TYPE_LABELS` lookup — verified on `main` after `cd33f70`), acceptance 6 (the `.nullable()` vs `.optional()` ruling — #387 made the server always send both, which makes the two sides agree, but did not write the ruling), and the two `booking-confirmed.test.tsx` cases still to be recovered from `worktree-363`. One thing to re-measure rather than trust: #387's browser pass transcribed the sub-line as `Wedding · Barr Mansion, Austin TX` capitalised, which the code path cannot produce — read it off the DOM before assuming the defect is or is not present. **In Progress 2026-09-03 (autonomous QA run, on `main` directly per operator instruction).** The occasion now reads `EVENT_TYPE_LABELS` through `Object.hasOwn` with the stored value as fallback, three tests added; the route half was already fixed by #387 and the `.nullable()`-not-`.optional()` ruling is written on `bookingWithContextSchema`. Code landed in `1908064`; the browser pass of frame `06` (acceptance 1, 3, 4) is pending on the shared browser and gates Done. |
| **395** | **Frame `05 Checkout` fails parity on all six axes** | P1.5 | M3 | **P1 High** | **Backlog** | — | **None** | `core` `stripe` | **Filed 2026-08-31 from #387's parity pass — the first that could reach the screen.** Checkout was unrenderable for the E2E customer until #387 landed a real connected account, so the frame had never been measured. Measured at 1440x900 against `Orla - Screens.dc.html` lines 877–925: **Layout 5** — the full app-shell header renders above the checkout's own wordmark header (`layout.tsx:127`, giving 128px of chrome against the frame's 64px and a **nested `<main>`**, so `Skip to content` lands above the extra nav), the pay button and its reassurance sit in the left column with their bottom edge at 917px — below the 900px fold — where the frame draws them as the summary rail's fourth block, the rail mini-card is missing its `<package> · <duration>` second line, header padding is `0 40px` against `0 32px`. **Style 5** — card shadow `--shadow-md` for `--shadow-sm`, panel radius 14px for 12px, avatar 64px circle for a 54px 12px-radius square, logo at `LOGO_SIZES.authPanel` (19px circles) where the frame draws 15px. **Colour 2** — page ground `stone-100` for `stone-50`. **Font 5** — `h1` 30px for 26px (over `04-laws.md`'s 26px app ceiling), letter-spacing `normal` for `-.01em`, context line and `Total today` 12.5px for 14px. **Text 2** — the rail sub-line and the frame's `Name on card` field have no counterpart. **Access 1** — the nested `<main>` is two landmarks and a wrong skip target. Contrast passes at 4.83:1 worst case; the focus ring passes, sampled twice. **Two are contract gaps, not template omissions:** `checkoutIntentSchema` carries neither package name nor duration, so the rail sub-line needs the API widened. **Coordinate with #386**, which owns token substitutions on other surfaces. |
| **396** | **Production CSP blocks Stripe entirely — checkout cannot load on the deployed origin** | P1.5 | M4.5 | **P0 Critical** | **In Progress** | `main` | **None** | `core` `stripe` | **Filed 2026-08-31 from #387's browser pass, confirmed independently by two lanes.** `apps/web/src/config/security-headers.ts` names Stripe **exactly once in the whole file** — in a comment explaining why it is not needed. No Stripe host appears in any directive, so the deployed origin blocks the payment path **three** ways: `script-src` (`:96`) omits `js.stripe.com`, so `loadStripe` cannot inject; `frame-src` (`:115`) is `'self' ${CLERK_HOSTS}`, so the Elements iframe is refused; `connect-src` (`:114`) omits `api.stripe.com`/`r.stripe.com`. **A fourth, in the same file:** `Permissions-Policy: payment=()` (`:154`) is justified by a comment reading *"Stripe Checkout is a redirect, not an embedded Payment Request"* — false since the screen moved to embedded Elements (`checkout-screen.tsx:8-9`, `loadStripe` at `:25`, `confirmPayment` at `:147`), so Apple Pay and Google Pay stay dead **after** the three directives are fixed. Anyone who fixes only the CSP gets a working card form and wallets that silently never appear. **Invisible in dev by construction:** `next.config.ts:76` enforces only when `isProduction`, so locally the header is report-only and the violations read as console noise — #387's three passing payment runs went straight through 16 of them. **Reproducible locally with `CSP_ENFORCE=1`**, which flips it to enforcing on a dev server; that flag appears nowhere in `packages/shared/src/env` or `.env.example` and should be documented here too. **Guard:** `security-headers.test.ts` passes today with zero Stripe hosts because it asserts directives are *present*, not what they *permit* — the fix needs a test enumerating every origin the app loads from and asserting each appears in the enforced policy. Standalone rather than folded into #370, which is blocked on #362 for credentials this needs none of. **In Progress 2026-09-03 (autonomous QA run, on `main` directly per operator instruction).** Stripe's hosts added per Stripe's published CSP guidance for Stripe.js, the Payment Element and Link — including `*.js.stripe.com`, `*.stripe.com` (img) and `*.link.com`, which the ticket's "no wildcards" line is deliberately not followed on because Stripe documents them; `payment=(self "https://js.stripe.com" "https://*.js.stripe.com")`; `CSP_ENFORCE` registered and moved to turbo `globalEnv` (as a pass-through key the build hash was identical for 0 and 1); `shouldEnforceCsp` extracted and its production branch pinned. Code landed in `1908064`, reviewed by diff-reviewer and security-auditor. Acceptance 3 (checkout driven with `CSP_ENFORCE=1`, zero violations, screenshots) is pending on the shared browser and gates Done. |
**This board carries open work only. Every closed row lives in `.claude/plans/vendor-marketplace-tickets-archive.md`**, whole — **380 rows as of 2026-09-03: 196 `Done` and 184 `Superseded`**, recounted programmatically. **`Superseded` now goes to the archive with `Done`**, which reverses what this line said before 2026-08-31. The old rule kept `Superseded` rows here on the reasoning that they are still consulted — and they are — but it was never applied: 138 of them were already in the archive while 46 sat on this board, so the board was 46 of 62 rows closed and the distinction cost a reader more than it bought. **Being consulted is not the same as being open.** Nothing about consulting them changed: `tickets.board.test.ts` reads both files together, `pnpm preflight --ticket <old n>` still gates against every one, and the detail sections moved across whole rather than being summarised. A `Superseded` ticket is still never worked directly.

Rows are ordered by build sequence, not by ticket number. **Recounted programmatically 2026-09-03, after the autonomous QA run's Phase 0 reconciliation moved six `Done` rows to the archive: 16 rows — 12 Backlog, 2 In Progress, 2 Deferred — needs a human, and 0 `Done` awaiting the next archive sweep.** **Do not hand-maintain these numbers, recount them** — the line here has been wrong after two of the last three passes. That sweep moved the remaining 46 `Superseded` rows and their 36 detail sections to the archive, on the user's instruction to close superseded tickets out. **A Backlog count is still not a ready count** — read `Blocked By`, and trust `pnpm preflight --ticket <n>` over both.
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

### #313: Sign-up and session entry

**Milestone:** M3 | **Priority:** P1 High | **Status:** Backlog | **Capabilities:** `core` `auth`
**Blocked by:** **#385** — the contrast ruling, and nothing else.

> **Reconciled 2026-08-31 by `/cleanup-tickets`. This header and the board row had
> disagreed since the first half landed**: the row read `Blocked — needs a human` /
> *"three decisions: the Clerk-owned submit label, the contrast ruling, and #333"*,
> while this section read `In Progress` / `Blocked by: None`. **Neither was right.**
> D16 answered the submit label — it is recorded below as answered, awaiting code, not
> as a question. `#333` was superseded and its replacement **#373 landed 2026-08-31**.
> Renaming the Clerk application had already moved to **#362**. One decision was ever
> genuinely open, the contrast ruling, and it is now item 4 of **#385**. The status is
> `Backlog`, not `Blocked — needs a human`: a design ruling is not a dashboard setting
> or a secret rotation, which is what that value means on this board.

Merges **#194, #197, #226, #234, #259**. **Two halves.** The first is implementable today.
The second is three rulings, and this ticket asks for all three at once rather than three
tickets asking separately.

**Acceptance — implementable now:**

- [x] ~~The header renders its signed-in variant on the **first** navigation in a fresh browser
      context, not only after a second (#259)~~ — **not a product defect.** It already does.
      The reproduction restored a saved `storageState`; a real in-context sign-in takes 0
      handshake hops and paints the signed-in header on the first navigation. Filed as
      **#321**, because every browser verification here restores state and therefore reads
      an auth state the product does not have.
- [x] Clerk's own sign-in card reads `BRAND_NAME`, not `vendor-marketplace` (#234) — done,
      **partially at the source.** The two observed keys now interpolate `BRAND_NAME`, and
      `.cl-headerTitle` renders "Sign in to Orla". The string was never visible: the app
      hides `[data-auth-screen] .cl-header`. It was corrected anyway because `display: none`
      is not correctness — it leaves the wrong name one stylesheet change from being read
      aloud, and does nothing for a scraper reading `textContent`. **Every other key that
      interpolates the name still says `vendor-marketplace`**; see the human list below.

**Acceptance — the three D16 answered, now code:**

- [ ] The primary action reads `Create my account` (#194, D16). **Correct the comment as
      well as the string** — `apps/web/src/app/clerk-copy.ts:7-11` claims `21-sign-up.md`
      records a deviation permitting `Continue`, and that file rules the opposite. The
      comment is the more durable half of the defect: changing the string and leaving it is
      how the next reader re-derives the wrong answer
- [ ] Sign-up after email verification reads the role back from `unsafeMetadata` rather than
      re-asking (#226, D16 — it is a defect, and no select-role-after-verification flow is
      needed because the role is already stored before verification)
- [ ] **The contrast ruling and the measurement disagree, and that is the real work here.**
      D16 ruled the photograph **fixed and hand-picked, contrast guaranteed by selection —
      no scrim**. `parity-checker` measured the shipped panel on 2026-08-30 and found a scrim
      that matches the frame byte for byte
      (`linear-gradient(200deg, rgba(35,32,28,.14) 0%, rgba(45,40,32,.62) 55%, rgba(30,28,24,.86) 100%)`),
      and sampled the committed image through it per-pixel per text band:

      | Text | Lightest ground | Ratio |
      | --- | --- | --- |
      | `Clear prices. / Open calendars.` `#FFFDF9` 38px | `rgb(116,116,102)` | 4.67 |
      | **`No back-and-forth.` `gold-200 #F3C98B` 38px italic** | `rgb(105,100,84)` | **3.81** |
      | body `stone-0/82` 15px | `rgb(98,96,75)` | 4.85 |
      | `BOOKING` `#F3C98B` 9.5px/700 | `rgb(67,58,43)` | 7.20 |
      | `VENDING` `#A8C08E` 9.5px/700 | `rgb(62,55,40)` | 5.96 |
      | `BOTH` `stone-0/55` 9.5px/700 | `rgb(59,52,39)` | 4.89 |

      The italic accent clears WCAG's 3:1 large-text threshold at 38px but **fails the
      project's blanket 4.5:1** in `01-foundations.md:69`, which states no large-text
      carve-out. So either the scrim is not what guarantees contrast (and D16's "no scrim"
      is describing an intent the code does not implement), or the accent colour moves, or
      the law takes a large-text carve-out. **Settle it and record it** — do not simply
      darken the scrim, because `21-sign-up.md:68-74` says the guarantee is by selection,
      which means swapping the asset later moves this number again

**Folded in from #365, measured by `parity-checker` on 2026-08-30:**

- [ ] The password helper `At least 10 characters` renders under the password field at
      11.5px `#6B6459` (frame line 1440) — it is absent today
- [ ] The sub-headline is **14px** (live: 15px) and the helper under the submit is
      **11.5px** (live: 11px)
- [ ] `VENDING` resolves to `#C4D6A8`, which `01-foundations.md` says to mint as
      **`sage-175`**; live resolves `sage-200 #A8C08E` and the token does not exist in
      `theme.css`. Same shape as #357's `clay-150` and `stone-250` — a mint, not a swap
- [ ] Panel padding is `46px 48px` (live: 48px all round) and the sub `max-width` is 415
      (live: 400)
- [ ] **The disabled submit is left alone.** It renders `stone-500 #C9C1B5` where the frame
      draws `#9A9184`, and `01-foundations.md:95-98` bans `#9A9184` **by name**. The app is
      right and the frame is the outlier — restoring the frame's value would be a regression
      against the law

**The fourth question moved out.** Renaming the Clerk application from `vendor-marketplace`
to `BRAND_NAME` is dashboard configuration on the shared instance the E2E accounts live in,
so it is not a lane's call — it is now part of **#362**, with the other provider-console
work. Do not block this ticket on it: correcting the individual keys is defence in depth and
already landed in `c8b54cd`.

> **First half done 2026-08-30 — `worktree-313`.** One of the two turned out to be a
> harness artifact rather than a defect (#321) and the other was fixed as far as code
> reaches. The four questions above are what remains, and they need a human.

**Tests (required):**

- [x] ~~A browser test in a **fresh context** asserting the header's signed-in variant on first
      paint~~ — moved to **#321**, and its assertion changed. Asserting the *header* is what
      made a harness artifact look like an app defect; #321 asserts the **handshake hop
      count**, which is the thing that actually differs between the two states. There is also
      no Playwright spec harness in this repository yet to hold such a test — only
      `pnpm e2e:auth`, which mints the storage state. The suite is **#14**, blocked by #12.
- [ ] A contrast assertion on the panel text against its actual rendered ground — belongs
      with the #197 ruling, which is still open

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

### #371: Responsive parity at 1024 and 768

**Milestone:** M3 | **Priority:** P1 High | **Status:** In Progress | **Capabilities:** `core` `stripe`
**Blocked by:** None

Merges **#323, #354, #355, #356** — all four filed by lanes 304 and 322 from the same
degradation table, split only by which frame they were looking at.

**Why one ticket.** `30-responsive.md` is one ladder. Four tickets walking it separately
re-measure the same breakpoints, re-derive the same footprint arithmetic and collide in
the same files. One lane, one browser session, two viewport sizes.

**Order inside the ticket — this matters.** Take **every** measurement first, at both
widths, before changing anything. Three of the four merged tickets open by saying the
measurement is stale or was never taken: #354 says *"re-measure before fixing — #322 moved
every one of these files"*, #355 says its frame *"was never opened at all"*, #356 says its
state is *"unreachable in a lane database"*. A fix applied to a stale measurement is worse
than no fix, because it reads as verified.

**Needs `pnpm db:seed:e2e`.** #356 additionally needs a seed that can produce an
**unpublished vendor with zero requests** — all 17 `vendor_profiles` rows are
`is_published = true` and only the E2E account has a sign-in path. **Decide that seed
first**: a pass that cannot render the frame proves nothing.

**The five frames, and what each one owes.** The merged rows carry the full measurements;
they are the implementation checklist and are not restated here.

| Frame | From | The substantial part |
| --- | --- | --- |
| `27 Search results / loading / no results · 1024`, `27 Checkout · 1024` | #323 | **`Due today` must stay above the fold at 1024 — asserted, not eyeballed: its rect bottom <= 640.** The `/search` header inset is already 20px (`SEARCH_INSET`, landed by #304); the body below it and `search-bar.tsx`'s `compact` variant are untouched |
| `27 Vendor profile · 768` | #354 | A **composition change**, not a ladder step: card + rail becomes a sticky bottom bar (`position:absolute;left:0;right:0;bottom:0`, `#FFFDF9`, `1px solid #E4DDD1`, `12px 24px`, `gap:16px`, `0 -4px 18px rgba(35,32,28,.07)`). Today the rail just stacks under the content below `lg` and nothing replaces it |
| `27 Vendor profile editor · 768` | #355 | Never opened. Nav on top, preview rail becomes a panel above the fields, fields go two-column. The editor suppresses `VendorNav` and carries its own 200px rail in `vendor-profile-form.tsx`, which is **not** `box-content` — #322's shared-nav arithmetic does not transfer and must be derived again |
| `27 Vendor dashboard — empty · 1024` | #356 | **A different screen, not the populated one with an empty list.** Gold blocker banner the code has no counterpart for, an in-pane 300px checklist card (not #322's bordered outer rail) with **seven** rows against `PUBLISH_BLOCKER_KEYS`'s six, and different empty-pane copy throughout |

**Acceptance:**

- [ ] Every frame above was measured with `parity-checker` **before** any edit, and the
      measurements are recorded in the ticket's Notes
- [ ] `parity-checker` returns MATCH on all six axes for all five frames, at 1024 and 768
- [ ] `Due today` is above the fold at 1024, asserted by rect bottom <= 640
- [ ] The 768 vendor profile draws the sticky bottom bar, not a stacked rail
- [ ] The unpublished-vendor seed exists and frame `27 Vendor dashboard — empty · 1024` was
      driven against it, not inferred
- [ ] The seven-row checklist and `PUBLISH_BLOCKER_KEYS`'s six are reconciled on the record —
      one of them is wrong and this ticket says which

**Tests (required):**

- [ ] A layout test asserting `Due today`'s position at 1024, so the constraint survives
- [ ] A fixture test that the unpublished-vendor seed really produces
      `is_published = false` with zero requests
- [ ] A test pinning the publish-checklist row count to the ruled number

---

### #372: Design parity close-out — dashboard, bookings, chrome and the error page

**Milestone:** M3 | **Priority:** P2 Medium | **Status:** Backlog | **Capabilities:** `core` `auth`
**Blocked by:** **#374** (owns the `Contact support` destination frame `16` needs). **#358 landed 2026-08-31 (`8e9208d`)** — the `vendor-card.tsx` / Refine-bar collision it caused is cleared, and its sage-chip removal is now history this ticket verifies rather than waits on.

Merges **#300, #359, #361, #366, #367** — the last of the 1440 parity debt.

**Why one ticket.** Five surfaces, one browser session, one customer fixture and one
vendor fixture. Every one of them is *measurements already taken* plus *a handful of
rulings*, and the rulings interact: the `StatusPill` question (#359) and the Refine chip
question (#367) are both "one shared primitive, many frames", and answering either
separately re-opens the other.

**The merged rows carry the measurements.** They are the implementation checklist and are
deliberately not restated. What this ticket adds is the order and the rulings.

**Take the rulings first, before any code.** Each one is recorded in the plan, then coded:

1. **The one-shell question (#359).** Frame `19` draws a different shell around the empty
   bookings pane than frame `07` does; the app renders `07`'s shell and swaps the pane.
   This may well be a deliberate reconciliation — one shell for a hub that is sometimes
   empty is the better product — but **nothing in the repo records it**, so every parity
   pass re-finds it. Rule it in `20-customer-bookings-hub.md`. If one shell is right,
   frame `19` is what needs correcting, and that is a design pass, not this ticket.
2. **The notification bell (#361).** Frame `02` draws no bell; the app has one with real
   behaviour. **Do not delete it to pass parity.** Establish whether the frame is stale;
   if it is, that is a design ruling and this item leaves the ticket.
3. **The `StatusPill` primitive (#359).** `700 11px` / `6px 10px` live against `.pill`'s
   `700 10px` / `5px 10px`. **Measure every frame that draws a pill before changing it.**
4. **The Refine chip treatment (#367).** Frames `02` and `18` draw a clay dismiss chip
   (`Under $1,200 ✕`); the app draws a stone set-value chip with `Clear`. Settle it once
   for both frames before coding either.
5. **The frame-`16` banner (#366).** Frame vs component library: the frame draws a
   borderless `#EDF0E9` banner at radius 10, the app uses `Banner status="settled"` whose
   `sage-300` border is a deliberate component decision. Rule it; **do not fork the
   component**.
6. **The apostrophe form (#366).** The 500 screen renders curly, `/sign-up` renders
   straight, and the frames are inconsistent. Rule once in `31-content-voice.md`.
7. **The pronoun deviation (#359).** The app writes "they" where frame `04` writes "she".
   The app is right — vendor gender is unknown — but it is an unrecorded Text-axis
   deviation. Record it.

**Then the fixes, by surface:**

- **Frame `08` (#300)** — `See all N ->` beside `Requests waiting on you` with **N read
  from the database**; `View my public profile` back in the header; nav labels and order
  match the frame
- **Frames `04`/`07`/`19` (#359)** — the date in the title row, `Messages` in the sidebar
  (the route it opens now exists, so #31's "a control that opens nothing is furniture"
  rule has expired for it), the dashed-tile border, the 14px-token question on the summary
  sentence, `Continue to review`'s stray `shadow-sm`, the `Start time`/`Guest count` height
  mismatch, and the stray empty `<section>` at y=900
- **Chrome (#361)** — the signed-in link reads what frame `02` draws; the avatar alt names
  the account on **both** roles (**fix where the name is resolved, not in the alt
  attribute**); the notification dropdown's empty state is decided rather than inherited
- **Frame `16` (#366)** — bespoke 64px header with `Contact support`, **no site footer**,
  `scrollHeight <= 900`, h1 38px, body 14px at lh 1.65, reference chip 12px
- **Frame `18` (#367)** — **`No photographers match both filters` at count 2** (today it
  reads `all two filters`), the Orla mark absent instead of a lucide `circle-x`, three
  relaxation buttons in the frame's order with no fourth `Clear all`, and no count row on
  the no-results state

**Not findings, do not "fix" them:** frame `18`'s distance relaxation (there is no
distance filter to relax); frame `18`'s market-size diagnosis sentence (the app is right —
the no-invented-numbers law forbids the claim); frame `04`'s expiry string (already
correct, reads `BOOKING_REQUEST_EXPIRY_DAYS`).

**Acceptance:**

- [ ] All seven rulings are recorded in the plan **before** the code that depends on them
- [ ] `parity-checker` returns MATCH on all six axes for frames `04`, `07`, `08`, `16`,
      `18` and `19`
- [ ] `Contact support` resolves to the real destination #374 builds — not a dead link
- [ ] The empty bookings rail is **driven in a browser**, against a real empty-hub customer
      fixture, not inferred
- [ ] The nearby-dates band is driven with real availability data and **keeps its sage chip**
      through #358's sage removal
- [ ] Every measurement in the five merged rows is either fixed or recorded with the reason
      it stands

**Tests (required):**

- [ ] A parity assertion reading frame `08`'s nav label list **and order** at test time, so
      a reordering fails rather than passing on set equality
- [ ] A fixture test that the empty-hub customer has zero bookings, so it cannot rot
- [ ] A test pinning the bookings sidebar's rows by name and order
- [ ] A test pinning the header's signed-in cluster by name
- [ ] A test that the avatar alt is non-empty and does not begin with an apostrophe, both roles
- [ ] A test that the 500 screen renders no site footer and no primary nav
- [ ] A test over `relaxations.ts` asserting the headline at counts 1, 2 and 3
- [ ] A test that the nearby-dates band keeps its sage chip

---

#### Appended 2026-08-31 by the pre-launch QA passthrough — the no-results state has no `<h1>`

Frame `18`'s surface, inherited here from #367. `/search` with a filter that matches
nothing renders **no `<h1>` at all** — the only heading in the document is
`<h2>No vendors match that filter</h2>`. The populated state renders `<h1>17 vendors</h1>`,
and the loading shell renders `<h1>Searching…</h1>`, so the heading is lost precisely when
the results settle to zero.

Confirmed through the accessibility tree, not `querySelector`: `getByRole('heading',
{ level: 1 })` returns 0 on the empty state and 1 on the populated one.

Repro: `/search?tags=<any tag with no matching vendor>`.

**Acceptance line to add:** the no-results state carries an `<h1>`, and the document has
exactly one at every state of this route — loading, populated and empty.

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

### #383: Focus indicators — one ring per control, and one idiom for the whole app

**Milestone:** M3 | **Priority:** P1 High | **Status:** Backlog | **Capabilities:** `core`
**Blocked by:** None

**Filed 2026-08-31 on the user's report**, verbatim:

> *"also ensure theres a ticket there to fix the issue of multiple (including an outdated
> focus) on the inputs.. and verify it across the app that that issue doesnt persist. I am
> seeing it in multiple places right now."*

**Both halves of that sentence are literally true, and both have a single cause.**

#### The mechanism, measured from source

`apps/web/src/app/globals.css:152-154` puts the ring on **every** focusable node
in the application:

```css
:focus-visible {
  @apply ring-2 ring-clay-400/30 ring-offset-2 ring-offset-stone-50 outline-none;
}
```

The comment above it explains the intent — *"no component has to remember it, and
so a component that forgets still lands on clay rather than on Chrome's blue"* —
and that intent is right. The defect is that it is a **floor with no ceiling**.

Tailwind's ring utilities all write `--tw-ring-shadow`, so a component's own
`ring-3` *replaces* the global `ring-2` and draws one indicator. But:

- **`inset-ring-*` writes `--tw-inset-ring-shadow`** — a different custom property,
  composited into the same `box-shadow` alongside the outward ring rather than
  replacing it.
- **`outline-*` is a different CSS property entirely**, so it composites with the
  ring unconditionally.

So every component that reaches for an inset ring or an outline paints **two
indicators**: its own, plus the global one. Three components discovered this
independently and turned the global ring off by hand — `profile-tabs.tsx:141`
(`ring-0 ring-offset-0`, with a comment recording that it was *"painting the inward
outline **and** a 4px outward ring"*), `vendor-card.tsx:164`, and `command.tsx:78`.
Nothing generalised the fix.

#### The "outdated" one is literal, not a figure of speech

`03-components.md:120-124` **replaced** the single global treatment with three, and
records that it did: *"This resolves the old conflict with `04-laws.md`, which
specified the offset ring for everything."*

| Element | Focus treatment |
| --- | --- |
| Standalone bordered field | `border-clay-400` + `ring-3 ring-clay-400/15`, **no offset** |
| Segment inside a joined bar or panel | `bg-stone-200` fill + clay label. **No border, edge or outline.** |
| Unbordered control (button, link, avatar, card) | `ring-2 ring-clay-400/40` + `ring-offset-2` |

The global rule in `globals.css` **is** "the offset ring for everything" — the
superseded law, still shipping, and at `/30` where both surviving statements of the
unbordered treatment (`03-components.md:124`, `04-laws.md:135`) say **`/40`**. A
bordered input therefore renders the old law's detached offset ring underneath
whatever its own class list asks for.

#### Every site, and which idiom it uses

Taken by grep over `apps/web/src` on 2026-08-31, excluding tests. **This table is
the checklist; do not re-derive it, but do re-run the grep first — it is cheap and
the file set moves.**

**A — draws its own indicator *and* the global ring (the reported defect):**

| Site | What it adds | Result |
| --- | --- | --- |
| `search/search-bar.tsx:227-228` | `has-[:focus-visible]:bg-clay-400/10` + `inset-ring-2 inset-ring-clay-400/30` | fill **+** inset ring **+** global outward ring = **three** |
| `search/search-bar.tsx:268` | bar-level `has-[:focus-visible:not([type=submit])]:ring-3 ring-clay-400/20` | a **fourth**, on the wrapper, at a fourth opacity |
| `search/category-select.tsx:138-139` | the same segment idiom again, copied | same stack, second copy |
| `vendors/profile/about-pane.tsx:169` | `outline-2 outline-clay-400 outline-offset-2` | outline **+** ring — **and no `outline-solid`**, so per `04-laws.md:154` the outline paints nothing and only the global ring renders |
| `vendors/profile/profile-tabs.tsx:158` | `outline-2 outline-clay-400 outline-offset-2 outline-solid` | outline **+** ring |
| `bookings/booking-confirmed.tsx:137,143,156` | `outline-2 outline-offset-2 outline-solid outline-stone-0` | outline **+** ring, and the outline is drawn in **`stone-0`** — near-white on cream |
| `app/bookings/[requestId]/page.tsx:77` | `outline-2 outline-clay-400 outline-offset-2 outline-solid` | outline **+** ring |

**B — the superseded shadcn ring, never re-tokenised (five files):**
`ui/input.tsx:11`, `ui/textarea.tsx:10`, `ui/select.tsx:40`, `ui/switch.tsx:20` and
`vendor-profile-form.tsx:343` all carry `focus-visible:border-ring focus-visible:ring-3
focus-visible:ring-ring/50` — shadcn's `--color-ring`, at `/50`. The law says
`border-clay-400` + `ring-3 ring-clay-400/15`, and **three files already do it right**
(`admin/filter-bar.tsx:140`, `booking/booking-request-screen.tsx:581`,
`customer/customer-profile-form.tsx:30`). So the *same field type* renders a
different ring depending on which file built it. That is the second thing the user
is seeing.

**C — a hardcoded rgba that bypasses the token:** `ui/dropdown-range.tsx:252` draws
`focus-visible:shadow-[0_0_0_3px_rgba(180,85,47,.15)]` — which *is* `clay-400/15`,
written so no token change can reach it.

**D — correct already, and the model for the fix:** `ui/input-group.tsx:17` rings the
group and zeroes the control (`:116`, `:129`); `vendor-card.tsx:148`/`:164` does the
same. Copy this shape.

#### Order inside the ticket

1. **Rule the global rule.** Either keep `:focus-visible` as a floor and give every
   component a documented way to opt out, or delete it and make the three treatments
   explicit. **Recommendation: keep it, but move it to the *unbordered* treatment at
   the law's `/40`, and add a single `data-focus-own` (or `:where()`) escape hatch**,
   so the three hand-rolled `ring-0` overrides collapse into one mechanism.
2. **Then** correct group B to `border-clay-400 + ring-3 ring-clay-400/15`.
3. **Then** the search bar: `03-components.md` says a segment inside a joined bar
   takes `bg-stone-200` **and no outline at all** — so the inset ring at
   `search-bar.tsx:228` and `category-select.tsx:139` should not exist, and the fill
   is `stone-200`, not `clay-400/10`. **Read frame `02` before deleting the bar-level
   halo at `:268`** — #89 and #73 argued this both ways and the record is in the
   comments at `search-bar.tsx:213-228`.
4. **Then** group A's outline sites, and group C's rgba.

#### Acceptance

- [ ] **No focusable element in the app paints more than one focus indicator.**
      Asserted by computed style, not by class list — `box-shadow` carries at most one
      ring layer plus its offset layer, and `outline-style` is `none` wherever a ring
      renders
- [ ] Every focus indicator resolves to one of the **three** treatments in
      `03-components.md:120-124`, at the opacity that file states
- [ ] `04-laws.md:135` and `03-components.md:124` agree on the unbordered opacity —
      one of them moves, and the ticket records which
- [ ] No `outline-*` width without `outline-solid` anywhere in `apps/web/src`
- [ ] `outline-stone-0` at `booking-confirmed.tsx:137,143,156` is either justified
      against the frame or replaced — an indicator drawn in the page's own ground is
      the `04-laws.md` "visible, not merely declared" failure
- [ ] **Verified across the app in a real browser at 1440x900, both auth states** —
      landing, search, vendor profile, booking request, checkout, booking confirmed,
      bookings hub, messages, vendor dashboard, profile editor, admin. Tab through
      every interactive element on each; screenshot the focused state of at least one
      control per treatment. This is the user's own acceptance criterion: *"verify it
      across the app that that issue doesnt persist"*
- [ ] `parity-checker` re-run on every frame whose focus treatment changed

#### Tests (required)

- [ ] A test that walks every focusable node on the rendered search bar, checkout form
      and vendor profile, and asserts **exactly one** indicator per node — counting
      rendered `box-shadow` layers and `outline-style` together, because a test that
      asserts the class cannot see this failure (`04-laws.md:157-159`)
- [ ] A lint-shaped test over `apps/web/src` asserting no `focus-visible:outline-<n>`
      appears without `focus-visible:outline-solid`
- [ ] A token test asserting no `ring-ring`, no `border-ring` and no hardcoded
      `rgba(180,85,47,…)` survives in `apps/web/src`
- [ ] A test that the indicator is **inside** its nearest `overflow:hidden` ancestor's
      rect, per `04-laws.md:157-159` — the failure mode `profile-tabs.tsx` hit

---

#### Appended 2026-08-31 by the pre-launch QA passthrough — the `ring-*`-only case is also doubled

This ticket's mechanism section exempts components that use `ring-*`: *"a component's own
`ring-3` replaces the global `ring-2` and draws one indicator."* **Measured, it does not.**
`ring-*` and `ring-offset-*` write different custom properties, and `ui/input.tsx` sets
only the former, so the base rule's `ring-offset-2 ring-offset-stone-50` survives and
composites.

A focused `input[data-slot="input"]`, keyboard-focused so `:focus-visible` is genuine:

```
box-shadow layer 1: rgb(248, 245, 239) 0 0 0 2px      <- ring-offset, from the base rule
box-shadow layer 2: oklab(clay/0.5)    0 0 0 5px      <- ring-3, from input.tsx
border-color      : rgb(180, 85, 47)                  <- focus-visible:border-ring
```

Three concentric edges on a plain text input — which is what the user's report describes.

The search bar stacks three **elements**: focusing one combobox paints a ring on the input,
an inset ring on its field cell, and a 3px ring around the whole `<form>` — reproduce by
keyboard-focusing `Vendor type` on `/search`.

**So the fix cannot be "let components override the ring" — a component cannot override an
offset it does not set.** Whichever owner is chosen, `ring-offset` must be owned by the
same rule as `ring`, and `ui/input.tsx` is a site this ticket's table must include.

### #384: Search rework — `City` becomes a place search over every US city, not the inventory list

**Milestone:** M3 | **Priority:** P1 High | **Status:** Backlog | **Capabilities:** `core`
**Blocked by:** None. **Do not run concurrently with #383** — both open
`search-bar.tsx`, `city-select.tsx` and `dropdown-combobox.tsx`.

**Filed 2026-08-31 on the user's explicit instruction**, verbatim:

> *"also create a ticket to rework our 'search' - i currently want the city dropdown to
> function the way airbnb's 'where' input functions. Do not preload and indicate how many
> vendors are in each city.. users should be able to search for any city and see the
> results.."*

**This is the third user override of the design contract — record it as a decision,
the way #364 and #375 were.** It overrides:

- **#375's own closing invariant**, stated in `city-select.tsx` and in the ticket:
  *"A free-text city that reaches the API as a filter is a regression, not this ticket."*
  It is now the requirement.
- **D6 and `42-dropdowns.md`**, whose rule is that the field may only ask questions the
  platform can answer.
- **`vendor-profile.dao.ts:160-173`**, whose docstring is the same argument:
  *"a picker offering somewhere with nobody in it is a picker that guarantees an empty
  result."*

**The reasoning those comments carry was not wrong, and the override does not discard
what it protected** — see the invariant below. Every one of them must be rewritten to
record the override rather than deleted, so the next reader does not re-derive the old
answer. That is how #375 handled the same situation.

#### Current state, verified 2026-08-31

- `GET /vendors/cities` (`vendors.routes.ts:72` → `findVendorCities`,
  `vendor-profile.dao.ts:174`) returns **every distinct `(city, state)` of a published
  profile, with `count(*)` as `vendorCount`** — the whole list, on page load.
- `vendorCitySchema` (`packages/shared/src/schemas/index.ts:1494-1501`) declares
  `vendorCount: z.int().min(1)`.
- `city-select.tsx` feeds that list to `ComboboxDropdown` and ranks it with
  `rankCityMatches` (`lib/option-filter.ts:66`), whose **third tier is vendor count** —
  *"that last tier is what puts `Portland, OR` above `Portland, ME`."*
- A typed string that matches no seeded city commits **nothing**; the field shows
  `No vendors in "…" yet. Try a nearby city.` and the query stays `Anywhere`.

#### Scope

1. **Stop preloading.** No full city list in the page payload. Suggestions arrive from a
   request made as the customer types, debounced, or from a local dataset that is not the
   inventory — never from a preloaded inventory list.
2. **Drop `vendorCount` entirely** from the suggestion path: out of `vendorCitySchema`,
   out of `findVendorCities`, out of `rankCityMatches`'s third tier, and off the screen.
   The user asked for it not to be indicated; it must also stop being the thing that
   orders two same-named cities. Replace that tie-break with population or alphabetical
   by state — **rule which, and record it.**
3. **Any US city is searchable and commits.** `Springfield, IL` commits whether or not a
   vendor has published there, the search runs, and the result is an honest empty state
   with relaxations — the machinery `relaxations.ts` and #368 already built.
4. **The `(city, state)` pair still travels together.** `state` has been the closed
   `us_state` enum since #332, and `lower(state::text)` at `vendor-search.dao.ts:87` is
   the only reason city+state search returns 200 at all. Every suggestion names its state,
   as Airbnb's does; the pair is still what commits.

#### The suggestion source — the one decision, with a stated default

**Default, and what this ticket should be built on unless the user says otherwise: a
seeded US city/state reference table in `packages/db`, independent of `vendor_profiles`.**
Reasons: `us_state` is already a closed US enum, so the product is US-only by
construction; it needs **no external account and no credential**, so this ticket stays
`Backlog` rather than becoming `Deferred — needs a human`; and it is queryable with the
same DAO shape the search already uses.

The alternative — an external geocoder (Mapbox, Google Places) — would give
international coverage and fuzzy matching for free, but it needs a provider account and a
key, which puts the ticket behind **#362** and adds a per-keystroke billable call. **Do
not choose it without asking.**

#### Edge cases the old design handled and this one must not lose

- **A typed string that matches nothing.** Airbnb commits nothing and says so. Keep
  commit-on-selection: typing is an affordance, selection is what commits. A bare
  `Enter` on an unmatched string must not send a free-text city to the API — that is the
  half of #375's invariant that survives, because `lower(city) = $1` matches exactly and
  a typo would silently return zero rows with nothing to say about why.
- **Two Portlands.** Every suggestion renders `City, ST`, as today.
- **The empty result.** A city with no vendors now reaches the results page. It must land
  on the frame `18` no-results state with relaxations, **not** on a blank grid, and its
  count sentence must still be truthful — the no-invented-numbers law is untouched.
- **`Anywhere`.** Clearing the field still commits the empty pair.
- **The API contract.** `GET /vendors?city=&state=` is unchanged; only who may fill it
  changes. **Keep the `#332` regression tests** — every state-filtered search 500'd for
  days and the filter had no test.

#### Acceptance

- [ ] No city list is fetched or embedded before the customer types
- [ ] `vendorCount` appears in no response schema, no ranking tier and on no screen
- [ ] Typing any US city surfaces it as a suggestion whether or not a vendor is there
- [ ] Committing a city with no vendors renders the no-results state with relaxations,
      and the count sentence names the city truthfully
- [ ] The committed value is still a real `(city, state)` pair or empty — never a
      free-typed string
- [ ] D6, `42-dropdowns.md`, `city-select.tsx`'s docstring and
      `vendor-profile.dao.ts:160-173` are **rewritten to record the override**, not
      deleted
- [ ] The decision is added to `vendor-marketplace-decisions.md` with the user's verbatim
      instruction, as #364 and #375 were
- [ ] Driven in a real browser at 1440x900 on `/` and `/search`, signed out and signed in
- [ ] `parity-checker` on frames `01`, `02` and `18` — the field's shape changes and its
      frames do not

#### Tests (required)

- [ ] An API test that a city with zero published vendors returns `200` with `total: 0`,
      not `404` and not `500`
- [ ] A test that the suggestion request is **not** made on mount and **is** made after
      the first keystroke
- [ ] A test that `Enter` on an unmatched string commits nothing and leaves the query
      `Anywhere`
- [ ] A test that two same-named cities both render with their state, in the ruled order
- [ ] The `#332` state-filter regression tests still pass — city **with** state, 200

---

### #385: [DESIGN] Ruling round — the four questions blocking #371 and #313

**Milestone:** M3 | **Priority:** P1 High | **Status:** Backlog | **Capabilities:** `core`
**Blocked by:** A design pass. It edits `design/` and answers product rulings, which
`web-design-parity.md` reserves for one.

Merges **#377, #378 and #380**, and takes the contrast question out of **#313**.

**Why one ticket.** All four need the same person with the same design bundle open, and
none of them is code. Split, they stall four separate times for one reason — and three of
the four block **#371**, so answering them one at a time re-opens that ticket three times.
Same shape as **#335**, the 2026-08-29 ruling round that turned eleven unstartable rows
into ordinary code work in a single pass.

**The merged rows carry the measurements and are the checklist.** They are deliberately
not restated here.

#### The four, in the order they should be taken

1. **Re-cut the three `27 … 1024` search frames (#377).** Not a judgement call: every
   disputed value was corroborated against **both** neighbours, `02 Search` (1440) and
   `14 Search tablet` (768) — card radius **16/14/16**, name **19/18/19**, price
   **17/16/17**, meta **12/11.5/12**, count-heading band **drawn/absent/drawn**. A real
   ladder step moves monotonically; the 1024 frame disagrees with both siblings on all
   five. It also still draws a `Distance` chip, a `Free on Jun 14 ✕` chip and an
   `18 free that day` count, all removed by **D16**. Only the 20px gutter and the
   3-column grid survive. **Reconcile D24 in the same pass** — monograms below 16px
   render Instrument Sans, and these frames draw serif, so a parity pass reads a recorded
   ruling as a Font-axis miss. **Also in scope:** frame `13 Admin`'s table pane is 3px
   short of the fifteen rows its own blurb claims (found by lane 15 from the other side).
2. **Is setup completeness the same gate as publishing? (#378)** Frames `20` and
   `27 Vendor dashboard — empty · 1024` both draw `Setup · 4 of 7 done` against **four**
   sources that say six, and **#371 already made the call that the six is correct**.
   Frame-against-frame (`08` says 6, `20` says 7), which the build-the-frame tiebreak
   cannot resolve. The two lists are different *concepts* — the code's is the publish
   **gate**, the frame's is setup **completeness** — and **#360 ruled that `payouts` is
   not a `PUBLISH_BLOCKERS` key and must not become one**. Rule it, then correct whichever
   artefact is wrong.
3. **`Due today` or `Total today`? (#380)** The frames split three-all: `05 Checkout`,
   `14-checkout.md:31` and `checkout-screen.tsx:342` say `Total today`;
   `27 Checkout — 1024`, `30-responsive.md:24` and `:240`, and
   `CHANGE-ORDER-2026-08-28.md:165` say `Due today`. **The layout constraint is slack, not
   tight** — the row's bottom sits at 302 in a 640px frame — so this is a labelling
   question wearing a layout question's clothes. **Correct #371's acceptance wording in
   the same edit**: it currently requires a string the app never renders.
4. **The sign-up panel contrast ruling (#313).** D16 ruled the photograph *fixed and
   hand-picked, contrast guaranteed by selection — no scrim*; `parity-checker` measured a
   scrim on 2026-08-30 that matches the frame byte for byte, and the gold italic accent
   sampled through it reads **3.81** against `01-foundations.md:69`'s blanket **4.5:1**,
   which takes no large-text carve-out. So either the scrim is not what guarantees
   contrast, or the accent colour moves, or the law takes a carve-out. **Do not simply
   darken the scrim** — `21-sign-up.md:68-74` says the guarantee is by selection, so
   swapping the asset later moves the number again. The full measurement table is in
   **#313**.

#### Acceptance

- [ ] Each of the four is answered **in the plan** — `design/design-plan/` and
      `vendor-marketplace-decisions.md` — before any ticket codes against it
- [ ] The three `27 … 1024` search frames in `Orla - Screens.dc.html` are re-cut, and
      **corroborated against `02` and `14` rather than drawn in isolation** — the method
      that found the staleness is the method that has to fix it
- [ ] D24 is reconciled against the re-cut frames in the same pass
- [ ] Frame `13 Admin`'s table pane holds the fifteen rows its blurb claims
- [ ] The setup-vs-publish ruling names which artefact is wrong and corrects it
- [ ] `#371`'s acceptance wording is corrected to the ruled checkout string
- [ ] `#371`, `#313` and `#386` have their `Blocked By` cleared as each item lands
- [ ] **The general lesson is recorded** where a parity pass will read it: the frames are
      trustworthy as **composition**, not as **arithmetic** — corroborate any number
      against the widths either side before building it

#### Tests

**None, and that is deliberate.** This ticket writes no application code. The tests that
enforce its rulings belong to **#371**, **#313** and **#386**, which consume them.

---

### #386: Visual corrections read off the frames — four undefined ramp steps and the search skeleton

**Milestone:** M3 | **Priority:** P2 Medium | **Status:** In Progress | **Capabilities:** `core`
**Blocked by:** None. **#385** improves the search-loading half — if the 1024 search
frames are being re-cut, take the skeleton's row count from the re-cut frame rather than
the stale one. The four ramp steps do not wait on anything.

Merges **#376** and **#379**.

**Why one ticket.** Both are single-pass corrections whose value is read off a frame and
then guarded; both are unblocked; and neither fills a lane on its own, while each would
otherwise cost a worktree, a preflight, a browser session, a PR and a merge. One browser
session covers all three frames.

**The merged rows carry the measurements.** They are the checklist and are not restated.

#### Half one — four colour classes name ramp steps the theme never defines (#376)

Found by `apps/web/src/app/design-tokens.test.ts` on its first run, not by eye. Each class
names a step no ramp declares, so Tailwind falls through to **its own cool default
palette** — a rendered colour belonging to no palette in this product, on screens that
carry frames.

| Site | Class | Ramp holds | Likely correction |
| --- | --- | --- | --- |
| `app/bookings/[requestId]/checkout/page.tsx` | `bg-sage-500` | 50, 100, 150, 200, 300, 400, 600 | `sage-400` |
| `components/checkout/checkout-screen.tsx` | `bg-sage-500` | as above | `sage-400` |
| `components/bookings/booking-confirmed.tsx` | `text-sage-700` | as above | `sage-600` |
| `components/portfolio/portfolio-manager.tsx` | `text-steel-700` | 50, 200, 600 | `steel-600` |

**Those corrections are a reading of the ramp comments, not a ruling.** Two of the three
surfaces carry frames (`05 Checkout`, `06 Booking confirmed`) — **measure before
substituting.**

#### Half two — the search skeleton does not mirror the card it becomes (#379)

Width-invariant, which is why #371 left it. The loading skeleton renders **three generic
bars** (`h-5 w-2/3`, `h-3 w-1/2`, `h-6 w-3/4 rounded-full`) where the frames draw a
skeleton shaped like the card it resolves into: a 62% title bar, a 44% meta bar, a
**two-chip row**, a 1px `#EFE9E0` divider, then a **From/price row**. Its radius is
`rounded-2xl` (18px) against the loaded card's **16px**, so the card visibly changes shape
as it loads. The pane renders **8** skeletons where the frame draws 6, and the shimmer is a
whole-surface `background-color` pulse where the frames sweep a `linear-gradient`.
**Verify the count against the real page size before changing it** — 8 may be right and
the frame's 6 merely illustrative.

#### Acceptance

- [ ] Each of the four classes resolves to a token this theme declares, read off the frame
      where the surface has one
- [ ] The four exemptions are **deleted** from `design-tokens.test.ts`, not amended — the
      list only shrinks
- [ ] The skeleton mirrors the loaded card's block structure, and its radius matches the
      card's 16px so nothing changes shape on resolve
- [ ] The skeleton count is either corrected to the frame's or **recorded** as a
      deliberate deviation with the page size that justifies it
- [ ] `parity-checker` MATCH on `05 Checkout`, `06 Booking confirmed` and
      `17 Search loading`
- [ ] `40-states.md`'s one-idiom-per-screen loading rule still holds after the change

#### Tests (required)

- [ ] `pnpm --filter @vendor-marketplace/web test` green with **no exemptions left** in
      `design-tokens.test.ts`
- [ ] A test asserting the skeleton and the loaded card share a radius token, so the two
      cannot drift apart again


### #394: The booking confirmation screen answers 500 for every customer

**Milestone:** M4.5 | **Priority:** P0 Critical | **Status:** Backlog | **Capabilities:** `core`
**Blocked by:** None. **Touches `apps/api/src/modules/payments/payments.routes.ts`, which lane #387 is live in — do not run the two concurrently.**

**Filed 2026-08-31 by #363's browser pass**, which set out to verify a one-line
change on this screen and found the screen does not render at all.

#### What happens

Signed in as the E2E customer, with a `confirmed` booking for request
`80c8ec6d…`, at 1440x900:

`/bookings/80c8ec6d…/confirmed` returns **HTTP 500** and renders the server-error
page — *"Something broke on our end … No payment was taken and no booking was
changed."* It does not redirect to `/checkout` and does not 404. The heading is
`Something broke on our end`; there is no date sentence and no
`<main aria-label="Booking confirmed">`.

The copy is wrong in the way that matters most: a payment **was** taken. This is
the screen a customer lands on immediately after paying.

#### Why

`GET /customer/booking-requests/:requestId/booking`
(`apps/api/src/modules/payments/payments.routes.ts:70`) declares:

```ts
schema: { params: requestParamsSchema, response: { 200: bookingSchema } },
```

`bookingSchema` (`packages/shared/src/schemas/index.ts:765`) declares neither
`eventType` nor `venue`, so Fastify's response serialiser **strips both**. The
observed 200 body carries 18 keys and neither of those two.

The web parses that body with `wireBookingSchema` — `bookingWithContextSchema`
(`:792`) plus date coercions — where `eventType` and `venue` are `.nullable()`,
**not `.optional()`**. A missing key is not a null, so the parse throws:

```
ApiClientError: API response for /customer/booking-requests/80c8ec6d…/booking
  did not match its schema
    at apiRequest (src/lib/api-client.ts:88:15)
    at getBookingForRequest (src/lib/customer-data.ts:150:16)
    at BookingConfirmedPage
```

The list route gets it right — `booking-requests.routes.ts:167` serialises with
`z.array(bookingWithContextSchema)` — which is why `/bookings` renders and only
the single-booking read fails.

#### The second half — the occasion renders as a slug

Lifted out of **#363** so both defects on this screen land in one browser pass.

`booking-confirmed.tsx` prints `booking.eventType` verbatim, and the column holds
the slug, so the line reads `wedding · Barr Mansion · Austin, TX` — lower-case,
in the middle of the confirmation screen. Every other read site already routes
through `EVENT_TYPE_LABELS` with a fallback (`request-row.tsx:81`,
`accepted-request.tsx:43`, `quote-review.tsx:96`, `reviews-pane.tsx:66`,
`customer-history.tsx:76`, `booking-entries.ts:87`); this one does not.

The fix and its two tests were **written and shown failing-before** under #363 —
reverting the line made the occasion test fail — then reverted from that lane,
because the 500 makes them unverifiable in a browser and the route fix belongs to
a file another lane is holding. Recover them from that branch rather than
rewriting them.

#### Acceptance

1. `/bookings/<id>/confirmed` renders frame `06` for a customer with a paid
   booking — driven in a real browser at 1440x900, signed in, screenshotted.
2. The occasion line reads `Wedding · <venue> · <city>`, capitalised through
   `EVENT_TYPE_LABELS`, with the stored value as the fallback for a legacy row.
3. No console errors on that page.
4. The signed-out URL still redirects to sign-in carrying `returnTo`.
5. A test asserts the single-booking route's 200 body **includes** `eventType`
   and `venue` — the schema mismatch is invisible to a route test that only
   checks the status.
6. Rule on `.nullable()` vs `.optional()` for these two fields and make the two
   sides agree; a client that requires a key the server may omit is the class,
   not the instance.

#### Tests (required)

- [ ] An API test that the serialised 200 carries `eventType` and `venue`
- [ ] A web test that the confirmed page renders rather than throwing, for a
      booking whose `eventType` is a slug
- [ ] The two `booking-confirmed.test.tsx` cases recovered from `worktree-363`

---

### #388: Forms reject the first submit in silence

**Milestone:** M3 | **Priority:** P1 High | **Status:** In Progress | **Capabilities:** `core`
**Blocked by:** None

**Filed 2026-08-31 by the pre-launch QA passthrough.**

#### The defect

Submitting a pristine form produces **no observable response at all**:

| Surface | Trigger | POST | `aria-invalid` | `role=alert` | Visible message |
| --- | --- | --- | --- | --- | --- |
| `/vendor/packages` → Add package | `Add package`, all blank | none | 0 | none | none |
| `/vendor/packages` → Add package | name + price, description blank | none | 0 | none | none |
| `/vendor/profile/edit` → Create profile | `Create profile`, all blank | none | 0 | none | none |

Focus moves to the first offending control — the textarea, then `businessName` — and that
is the **only** signal. It is silent for assistive technology and easy to miss with a
mouse, so the button reads as broken. `/vendor/profile/edit` is the screen **every new
vendor is funnelled to**: with no profile row, all seven `/vendor/*` routes redirect here.

**The machinery exists and the first pass does not reach it.** A *second* submit renders
*"One field needs fixing before this can go out"* and names the field, and the required
description is not marked required anywhere before it blocks.

#### The same gap, one level milder, on the booking request form

`/vendors/<slug>/request` sets `aria-invalid` and wires a well-written message through
`aria-describedby` — genuinely good — but the message container carries **no `role="alert"`
and no `aria-live`**, and focus stays on `Continue to review`. Nothing is announced.

#### And the Price filter discards input without saying so

`/search` → Price → Min = `abc` → Apply: the popover closes, the URL and results are
unchanged, and nothing is said. The **inverted** range on the same control explains itself
well — *"That price range isn't one we can use, so it was cleared — the rest of your
search still applies."* One control, two contracts.

#### Acceptance

1. A blank submit on **Add package** and on **Create profile** renders the same error
   summary the second submit renders today, on the **first** press.
2. Every field that blocks submission carries `aria-invalid="true"` and an
   `aria-describedby` message placed next to that field.
3. The error summary is announced: `role="alert"` (or an `aria-live="assertive"` region),
   on all three forms including the booking request.
4. Focus moves to the first invalid control **and** that control's message is what a
   screen reader reads on arrival.
5. Required fields are marked required before they block — the package description
   included.
6. The Price filter tells the user when it discards a value, in the register the inverted
   range already uses.
7. Driven in a real browser at 1440x900 for each surface, with a screen reader
   announcement check or an equivalent assertion on the live region, and screenshots.
8. Tests: one per surface asserting a blank submit produces a visible, announced message
   and no network call.

---

### #392: Frame `13 Admin` parity debt — four class-level misses and the missing chevrons

**Milestone:** M3 | **Priority:** P2 Medium | **Status:** Backlog | **Capabilities:** `core`
**Blocked by:** None

**Filed 2026-08-31 by #389's `parity-checker` pass.**

Frame `13` matched on all six axes for #389's own change. These five are pre-existing
and were surfaced on the way past. **#372 does not cover them** — it closes frames `08`,
`04`/`07`/`19`, `16`, `18` and the site chrome, not `13`.

#### The five

| Miss | App | Frame | Source |
| --- | --- | --- | --- |
| Pane radius | 14px (`rounded-xl` → `--radius-xl`) | 12px (`--radius-panel`) | `packages/config/tailwind/theme.css:221` vs `:220` |
| Sidebar nav pitch | 44px tall, 48px pitch, rail ends 93px low | 34px tall, 34px pitch | `admin-nav.tsx:66` — `min-h-11` in a `gap-1` list |
| Status pill | 47.36×26, `11px/700`, `padding 6px 10px` | 44.88×23, `10px/700`, `padding 5px 10px` | `status-pill.tsx:40` |
| Avatar initial | `font-sans` | Instrument Serif | `components/ui/avatar.tsx` |
| Dropdown chevrons | **no `▾` glyph at all** — `innerHTML` is bare text, zero children. Walks City 15px and Payouts 25.6px left | `Category ▾`, `City ▾`, `Payouts ▾` | `filter-bar.tsx` |

#### Why these are the strongest kind of parity finding

**Every one is class- or token-level, so no viewport can change them.** That matters
because of how they were confirmed: a peer challenged whether the parity readings had
been taken at 1440 or 1280, after finding the shared browser at `about:blank` 1280×720
when I had relayed it as 1440×900 on `/admin/reviews`. Rather than defend the readings,
all five were **re-derived from source**, where the question does not arise. The
geometric figures are corroboration; the source lines are the finding.

#### One of them is a plan correction, not only a component fix

The status pill's size comes from `03-components.md`'s `text-xs … py-1.5` vocabulary,
which **disagrees with the frame**. Design law is that where the two disagree the frame
wins and the plan is corrected — so this ticket edits `03-components.md` as well as
`status-pill.tsx`, or it will be re-found by the next pass.

#### Not in scope

Frame `13`'s table pane clips its own fifteenth row by 4px, against a blurb claiming
fifteen are visible. The app reproduces the same defect in the same direction within a
pixel or two. **That is #385's to rule on** — do not "fix" the app against a frame whose
own arithmetic is under review.

#### Acceptance

- [ ] Each of the five matches the frame, measured at 1440×900
- [ ] `03-components.md`'s pill vocabulary is corrected to the frame's values, or the
      disagreement is recorded as a ruling if the plan is judged right
- [ ] The chevrons render as glyphs and the three triggers land at their frame positions
- [ ] Re-run `parity-checker` on frame `13` and record the axes in Notes
- [ ] `frame-13-parity.test.ts` gains a source-level guard for whichever of these can
      carry one — the radius token and the nav pitch both can

---

### #393: Admin tables have no responsive strategy below 1024

**Milestone:** M4.5 | **Priority:** P2 Medium | **Status:** Backlog | **Capabilities:** `core`
**Blocked by:** None

**Filed 2026-08-31 by #389's browser pass.**

`design/design-plan/30-responsive.md:31` specifies Admin as **`768 → Horizontal scroll`**
and **`390 → Card list, not a table`**. Neither exists.

#### Measured after #389

`/admin/reviews` at 390×844 resolves to
`12.2px 31.73px 31.73px 21.97px 46.375px 21.97px 70px`. Headers render `R…`, `A…`, `W…`;
body cells render `4…`, `Ro…`, `T…`. **A 12px column cannot show more than an ellipsis.**
Layout is correct — zero template mismatches, no document overflow, no collisions — and
the content is simply unreadable. The tables are legible at 1024 and above only.

#### This is #389's fix working, not failing

Before #389 the rows were mutually misaligned **and** the document scrolled sideways
(`scrollWidth 407 > 390`). So the contract's `768 → Horizontal scroll` was never actually
implemented either: what existed was incoherence, not a degradation. Flooring the tracks
removed the incoherence and made the absence of a real strategy visible.

#### The ruling this needs

`768` and `390` are different questions and the contract answers them differently:

1. **768** — keep the contract's horizontal scroll, but *inside the table pane*, not on
   the document. The pane is already an `overflow-y-auto` scroller, so `overflow-x` is
   already `auto` there; what is missing is a `min-width` on the grid so the tracks stop
   collapsing and start scrolling.
2. **390** — the contract says cards. That is a real component, not a tuning pass.

Rule which of the two 768 takes before building either, since a `min-width` that makes
768 scroll also changes what 390 does.

#### Acceptance

- [ ] The 768 behaviour matches whatever the ruling names, measured at 768×1024
- [ ] 390 renders the card list `30-responsive.md` specifies, on all six admin tables
- [ ] No admin route scrolls the **document** horizontally at any width — #389's
      acceptance 2 stays true
- [ ] Every cell's content is readable at every width: no track resolves narrower than
      its content's first character plus an ellipsis
- [ ] A test pins the breakpoint behaviour, so "the table survives at 390" cannot regress
      to "the table is 12px columns at 390" unnoticed

---

### #395: Frame `05 Checkout` fails parity on all six axes

**Milestone:** M3 | **Priority:** P1 High | **Status:** Backlog | **Capabilities:** `core` `stripe`
**Blocked by:** None

**Filed 2026-08-31 from #387's parity pass** — the first pass that could reach
the screen at all. Checkout 404'd for the E2E customer until #387 landed a real
Stripe connected account, so frame `05` had never been measured against anything.
None of what follows is caused by #387.

Measured at 1440x900 against `design/Orla - Screens.dc.html` lines **877–925**,
with class definitions from lines 26–41.

#### Layout

1. **Two headers.** `layout.tsx:127` renders `SiteHeader` inside `OutsideAdmin`,
   so the app shell banner (Main nav, Messages, Dashboard, notifications, avatar)
   sits at `y=0 h=64` above the checkout's own wordmark header at `y=64 h=64`.
   The frame has **one** `.hd`, 64px, no nav; `14-checkout.md` says "no nav —
   nothing competes with finishing". The suppression mechanism already exists for
   `/admin` and was simply never extended here.
2. **The pay button is below the fold and in the wrong column.** Frame lines
   919–921 draw it as the summary rail's **fourth** block. Live it renders inside
   the left `<form>` at `x=40 y=871 w=620 h=46` — bottom edge **917px**, past the
   900px fold. `04-laws.md` requires the primary action visible without
   scrolling. `checkout-screen.tsx:262` already concedes the placement in a
   comment.
3. **The rail mini-card has no second line.** Frame line 907 draws
   `<package> · <duration>`. **Contract gap, not a template omission:**
   `checkoutIntentSchema` (`packages/shared/src/schemas/index.ts:813–841`)
   carries neither field, so the API must widen first.
4. Checkout header padding `0 40px` (`px-10`) against the frame's `0 32px`.
5. The page scrolls — `scrollHeight 964 / 900` — entirely because of (1). Inside
   the ≤1.5x form budget, so not a budget breach, but it is what pushes (2) off
   screen.

#### Style

| Element | Frame | Live |
| --- | --- | --- |
| Rail card shadow | `--shadow-sm` `0 2px 10px rgba(35,32,28,.06)` | `--shadow-md` `0 4px 18px rgba(35,32,28,.09)` |
| "If plans change" radius | 12px (`--radius-panel`) | 14px (`rounded-xl`) |
| Rail avatar | 54x54, radius 12px | 64x64, full circle |
| Checkout logo | 15px circles (`LOGO_SIZES.desktopHeader`) | 19px (`LOGO_SIZES.authPanel`) |
| Sage dots | 7x7 | 6x6 (`size-1.5`) |

Also: the price block is the card's last child and still carries
`border-b border-stone-200` (`checkout-screen.tsx:325`), drawing a hairline on
the card's bottom edge. In the frame that border separates it from the pay
block, which the live card does not have.

#### Colour

Page ground is `stone-100` `#F4F0E8` (`page.tsx:67`) where the frame's `.fr` is
`#F8F5EF` (`stone-50`) — one step too dark across the whole canvas.

The `bg-sage-500` finding from the same pass was **already fixed in #387**
(swapped to `sage-400`, `#5E6B4F`, matching frame lines 880 and 921) at #386's
request, with both `KNOWN_UNDEFINED_STEPS` exemptions deleted.

#### Font

`h1` 30px for the frame's 26px — over `04-laws.md`'s 26px in-app ceiling and
`14-checkout.md`'s "Serif 26px"; letter-spacing `normal` for `-.01em`;
line-height 37.5px (`leading-tight`) where the frame sets none; context line
12.5px for 14px; `Total today` 12.5px for 14px. Minor: panel body
`leading-relaxed` (1.625) where `01-foundations.md` names `leading-prose` (1.6)
and calls out `relaxed` as explicitly not it; the Stripe appearance `.Label`
(`checkout-screen.tsx:46–52`) is 11px/.06em against `.lbl`'s 10.5px/.05em.

#### Text

The rail sub-line (see Layout 3) and the frame's **"Name on card"** field label
(line 892) have no live counterpart. **Every other Orla-authored string matches
word for word**, including "Secure checkout · encrypted by Stripe", "Confirm and
pay", both refund sentences, "Service fee / None", and
"Pay $1,450 — confirm October 19".

#### Access

The nested `<main>` from Layout 1 (`layout.tsx:129` wrapping `page.tsx:77`) is
two `main` landmarks, and `Skip to content` targets the outer one — so skipping
lands above the extra nav rather than at the checkout. Disappears with Layout 1.

Passing, and worth not re-measuring: contrast on all 34 Orla-authored text nodes,
worst case **4.83:1**; the focus ring, sampled twice 500ms apart. One deviation
to reconcile rather than fix here — `04-laws.md:135` specifies `ring-clay-400/40`
for an unbordered control and the shipped `Button` renders `/30`; the law file
and the primitive disagree, which is a ruling, not a checkout bug.

#### Not scored against the frame, but decide it

`PaymentElement` is configured `layout: 'tabs'` (`checkout-screen.tsx:197`),
which renders Card/Bank/Klarna tabs, a Link row and a "Save my information"
block. The frame draws a bare card form. The internals are Stripe's, but the
`layout` choice and the enabled method set are ours and change the composition
materially.

#### Coordination

**#386** owns token substitutions on other surfaces and has already handed this
lane its two checkout swaps; keep the two tickets off each other's files.
**#396** must land before any of this can be verified on the deployed origin.

#### Acceptance

1. Every numbered item above either fixed or ruled, at 1440x900, against the
   frame — not against a description of it.
2. The rail sub-line either lands with the widened `checkoutIntentSchema`, or the
   frame is corrected and the reason recorded.
3. Driven by `parity-checker` on all six axes, with the frame lines cited.
4. The screen is reachable for this: it needs an `accepted`, unpaid booking, so
   `pnpm db:seed:e2e` then accept as the vendor — do not complete the payment.

---

### #396: Production CSP blocks Stripe entirely — checkout cannot load on the deployed origin

**Milestone:** M4.5 | **Priority:** P0 Critical | **Status:** Backlog | **Capabilities:** `core` `stripe`
**Blocked by:** None

**Filed 2026-08-31 from #387's browser pass, confirmed independently by two
lanes.** #387 made the money path work locally. This makes that same screen
non-functional in production, and it is invisible in development by
construction.

`apps/web/src/config/security-headers.ts` mentions Stripe **exactly once in the
entire file** — in a comment explaining why it is not needed.

#### Four blocks, not one

1. `script-src` (`:96–101`) is `'self' 'unsafe-inline' [dev 'unsafe-eval']
   ...CLERK_HOSTS`. No `js.stripe.com`, so `loadStripe` cannot inject its tag.
2. `frame-src` (`:115`) is the literal `'self' ${CLERK_HOSTS.join(' ')}`. The
   Elements iframe is refused.
3. `connect-src` (`:114`) omits `api.stripe.com` and `r.stripe.com`.
4. **`Permissions-Policy: payment=()`** (`:154`), justified by a comment reading
   *"Payment is denied too — Stripe Checkout is a redirect, not an embedded
   Payment Request, so #10 does not need it back."* **That premise is false in
   the current code.** `checkout-screen.tsx:8-9` imports `Elements`,
   `PaymentElement`, `useStripe` and `useElements`, calls `loadStripe` at module
   scope (`:25`) and `stripe.confirmPayment` at `:147`. It is embedded Elements.
   `payment=()` blocks the Payment Request API that Apple Pay and Google Pay go
   through — exactly what `PaymentElement` surfaces.

**The failure mode that makes this worth care:** fix the three directives and
stop, and you get a working card form with Apple Pay that silently never
appears. That is worse than the current total failure, because nothing is red.

#### Why it escaped

`next.config.ts:76` reads `enforceCsp: process.env.CSP_ENFORCE === '1' ||
isProduction`. Locally the header is `Content-Security-Policy-Report-Only`, so
the element loads and the violations go to the console, where a browser pass
reads them as noise. **#387's three passing end-to-end payment runs each went
straight through 16 of them.** A browser pass under report-only *cannot* fail on
this; a pass under `CSP_ENFORCE=1` cannot miss it.

`CSP_ENFORCE` appears nowhere in `packages/shared/src/env` or `.env.example` —
an undocumented escape hatch that exists only in `next.config.ts`.

#### Acceptance

1. The enforced policy permits every origin the app actually loads from —
   `js.stripe.com` on `script-src`, the Elements frame on `frame-src`,
   `api.stripe.com` and `r.stripe.com` on `connect-src` — scoped to exact hosts,
   not wildcards.
2. `payment=()` is corrected for embedded Elements, and the stale comment is
   **rewritten to record the reversal**, not deleted — the way this repo handles
   its other overrides.
3. Driven end to end with `CSP_ENFORCE=1` on a lane dev server: the payment path
   completes and the console carries **zero** CSP violations. Screenshot before
   and after.
4. `CSP_ENFORCE` is documented — the env registry, `.env.example`, or the
   checkout ticket's verification recipe, wherever a future reader will look.
5. **The guard, which is the half that closes the class:**
   `security-headers.test.ts` passes today with zero Stripe hosts because it
   asserts directives are *present*, not what they *permit*. Replace it with a
   test that enumerates the origins the app loads from and asserts each appears
   in the enforced policy.
6. Verified against the deployed origin once #370 makes one available; until
   then `CSP_ENFORCE=1` is the gate.

#### Not #370

#370 is blocked on #362 for production credentials. This needs none: it is a
header change, a comment rewrite and a test, all runnable today. Filing it
behind #370 would park a launch blocker behind an external-account dependency.

---
