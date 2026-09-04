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
| **371** | **Responsive parity at 1024 and 768** | P1 | M3 | **P1 High** | **Backlog** | `main` | **#385** (the ruling round that absorbed #377 and #378) | `core` `stripe` | **MEASUREMENT PASS COMPLETE 2026-08-31 — acceptance line 1 is met.** All seven frames measured at their declared sizes before any edit, each against **both** neighbouring widths rather than in isolation. **That method changed the ticket.** **Three frames are blocked, not unbuilt.** `27 Search results / loading / no-results — 1024` are **stale**: corroborated against `02 Search` (1440) and `14 Search tablet` (768), the 1024 frame alone disagrees with both on card radius (16/**14**/16), name (19/**18**/19), price (17/**16**/17), meta (12/**11.5**/12) and the count-heading band (drawn/**absent**/drawn), and still draws a `Distance` chip, a `Free on Jun 14 ✕` chip and an `18 free that day` count that **D16** removed. Only the 20px gutter and the 3-column grid survive. Edits already made from those numbers were **reverted** rather than shipped. Filed as **#377**. **Two frames were unrenderable and are now fixed** — the ticket's own rule is that a pass which cannot render the frame proves nothing. `27 Vendor dashboard — empty · 1024` had no producible state (all 17 profiles published, one sign-in path) → `pnpm db:seed:e2e:draft`, `3da72be`. `27 Checkout — 1024` answered **404** for the E2E customer at every viewport, because the fixture wrote `stripeOnboarded` without `stripeAccountId` — a state the product cannot reach → `be02b46`; the class is **#381**. **A live P1 was found on the way and fixed:** every state-filtered search returned **500** (`lower()` on the `us_state` enum #332 introduced), so the canonical `/search` URL the app builds for itself was the failure page for every visitor — `26f4503`, three regression tests, the filter had none. **Acceptance line 6 is answered: the six is correct**, not the frames' seven — see **#378** for the four sources. **`27 Vendor profile — 768` and `27 Vendor profile editor — 768` corroborated clean and are the deliverable remainder.** Measured, not yet built: the booking rail **does not become a sticky bottom bar** (it is `position:static`, a stacked card — the ticket's headline item, frame spec `position:absolute;left:0;right:0;bottom:0`, `#FFFDF9`, `1px solid #E4DDD1`, `12px 24px`, `gap:16px`, `0 -4px 18px rgba(35,32,28,.07)`, holding From/price, a 180px date field, `Request booking`, `Message`); the editor renders **no section nav at all** at 768 (`display:none`, frame draws a 48px horizontal chip row) and its whole responsive story sits on `lg:`, so **768 renders the 390 composition** — one breakpoint short of the frame set, not a set of tuning misses; the editor's scroll budget is **2.09×** against `04-laws.md`'s 1.0×; **`04-laws.md` rule 5 fails, measured** — the sticky save bar overlaps two live controls at `scrollY 900` because the scrolling pane's `padding-bottom` is `0px`; the publish switch is **32×18** against the 44×44 law at 768; and bio/stats max-widths render the **1024** frame's values at 768 (520/440 vs 600/480). **RECORDED DEVIATION — the bar overlays content mid-scroll, and that is the design, not a defect.** The browser pass was given "no interactive element is overlapped at any scroll offset" as its criterion and correctly reported **FAIL** at mid-scroll: at 768x600, scrollY 164, two footer links signed in (three signed out) were fully covered with their centres intercepted. **The criterion was wrong, not the code.** A bar whose stated job is to persist over scrolling content necessarily overlays it — `30-responsive.md:88`: *"The primary action stays reachable. On mobile that means a sticky bottom bar, not a button pushed below a scroll"* — and frame `27 Vendor profile — 768` draws it `position:absolute;bottom:0` **over** the pane. The requirement that does bind is `30-responsive.md:160`: *"any pane with a fixed bottom action bar needs bottom padding equal to the bar's height ... or the last card's price row lands underneath it"* — content must not **end** underneath it. That is met and measured: at 768x1024 **zero** intersections across every link, button and input, both auth states, with `All vendors` moved from `404,951` to `404,863`, 74px clear; and at 768x600 max scroll every footer link resolves to itself. The defect that mattered — a page that did not scroll at all, leaving `All vendors` permanently unreachable — is gone. **Also recorded:** `xl:` (1280, a width no frame draws) survives in ~10 more files — **#372** owns most of those surfaces and should absorb the sweep plus a guard test. **Filed:** #377, #378, #379, #380, #381. **Filed 2026-08-31 by the third backlog consolidation.** Merges **#323, #354, #355, #356**. One ladder walked once — search, checkout, vendor profile, the profile editor and the empty dashboard, at both widths. Four tickets that were the same work split by frame. **Returned to Backlog 2026-09-03 by the autonomous QA run:** In Progress with no live session. The `worktree-371` branch (10 commits, never pushed, `e908d1a`) was triaged file by file on 2026-09-03: every app change on it — the 768 bottom bar, the footer overlap fix, the 13.5px date field, the rail field-order test, the `us_state` search cast — is already on `main` byte-identical, and its seed and ticket-filing commits are superseded by #387 and by the #377–#382 rows main already carries. The lane, worktree and branch were removed; nothing is lost. What remains is exactly the part blocked on #385: frames `27 Search · 1024` / `27 Checkout · 1024` (`Due today` above the fold) and the setup-checklist reconciliation. |
| **372** | **Design parity close-out — dashboard, bookings, chrome and the error page** | P1 | M3 | **P2 Medium** | **Backlog** | — | **#374** (owns the `Contact support` destination) — **#358 landed 2026-08-31 (`8e9208d`), so its collision is cleared** | `core` `auth` | **Filed 2026-08-31 by the third backlog consolidation.** Merges **#300, #359, #361, #366, #367**. The last 1440 parity debt in one pass: frames `08`, `04`/`07`/`19`, `16`, `18`, and the site chrome no frame owns. |
| **374** | **Launch legal, policy and support surfaces** | P3 | M6 | **P0 Critical** | **Deferred — needs a human** | — | **The account holder: (1) the operative wording of the terms, privacy policy and vendor agreement — a ticket must not invent binding text; (2) a real monitored support address or destination** | `core` | **Filed 2026-08-31.** Not a consolidation — a gap nobody had filed. `docs/pre-launch.md` §1.5 and §7 require terms, a privacy policy, a cookie notice, a vendor agreement covering the 12% commission and payout timing, a refund and cancellation policy shown **before** payment, and a support route that reaches a human. **None of those routes exist in `apps/web/src/app`.** The product cannot take money from strangers without them. |
| **383** | **Focus indicators — one ring per control, and one idiom for the whole app** | P1 | M3 | **P1 High** | **Backlog** | — | **None** | `core` | **Filed 2026-08-31 on the user's report**, verbatim: *"ensure theres a ticket there to fix the issue of multiple (including an outdated focus) on the inputs.. and verify it across the app that that issue doesnt persist. I am seeing it in multiple places right now."* **Root cause located, not guessed.** `globals.css:152-154` applies `ring-2 ring-clay-400/30 ring-offset-2 ring-offset-stone-50 outline-none` to **every** `:focus-visible` node in the app. Tailwind's `ring` and `inset-ring` write **different** custom properties (`--tw-ring-shadow` / `--tw-inset-ring-shadow`), and `outline` is a different CSS property again — so a component that adds an inset ring or an outline paints **its own indicator and the global one at the same time**. Three components already found this and turned the global ring off by hand (`profile-tabs.tsx:141`, `vendor-card.tsx:164`, `command.tsx:78`); seven more did not. **The "outdated" half is literal:** that global rule is the *superseded* law. `03-components.md:120-124` replaced "the offset ring for everything" with **three treatments by element type** and says so in as many words; the global rule is the old one, still shipping, and at `/30` where even `04-laws.md:135` says `/40`. Full site table in the detail section |
| **384** | **Search rework — `City` becomes a place search over every US city, not the inventory list** | P1 | M3 | **P1 High** | **Backlog** | — | **None** | `core` | **Filed 2026-08-31 on the user's explicit instruction**, verbatim: *"i currently want the city dropdown to function the way airbnb's 'where' input functions. Do not preload and indicate how many vendors are in each city.. users should be able to search for any city and see the results."* **The third user override of the design contract, after #364 and #375 — record it as one.** It overrides #375's own closing invariant (*"A free-text city that reaches the API as a filter is a regression, not this ticket"*) and D6's rule that the field may only ask questions the platform can answer. Three things go: the preloaded `GET /vendors/cities` payload, `vendorCount` as a ranking **and** display signal, and the rule that a city with nobody in it is unpickable. **The `(city, state)` pair survives** — `state` has been the closed `us_state` enum since #332 and "Springfield" still names a place in thirty-odd states — so a suggestion still names its state; what changes is *which* places may be suggested. Detail section carries the scope, the suggestion source and the empty-state contract |
| **385** | **[DESIGN] Ruling round — the four questions blocking #371 and #313** | P1 | M3 | **P1 High** | **Backlog** | — | **A design pass: it edits `design/` and answers product rulings, which `web-design-parity.md` reserves for one** | `core` | **Filed 2026-08-31 by the fourth backlog consolidation. Merges #377, #378 and #380**, and takes the contrast question out of **#313**'s blocked half. One person, one sitting, one design bundle open. Split, they stall four separate times for one reason — and three of the four block the same ticket, so answering them one at a time re-opens #371 three times. **Same shape as #335**, the 2026-08-29 ruling round that unblocked eleven rows at once. The merged rows carry the measurements and are the checklist. **Order: rule first, re-cut second, and only then do #371, #313 and #386 become ordinary code work** |
| **392** | **Frame `13 Admin` parity debt — four class-level misses and the missing chevrons** | P1 | M3 | **P2 Medium** | **Backlog** | — | **None** | `core` | **Filed 2026-08-31 by #389's `parity-checker` pass.** Frame `13` matched on all six axes for #389's own change, and the pass surfaced five pre-existing misses it did not own. **#372 does not cover these** — it closes frames `08`, `04`/`07`/`19`, `16`, `18` and the site chrome, not `13`. **All five are class- or token-level, so no viewport can change them** — re-derived from source after a peer challenged whether the readings were taken at 1440: the pane uses `rounded-xl` → `--radius-xl: 14px` (`theme.css:221`) where the frame draws 12px, which is `--radius-panel` on the line above; `admin-nav.tsx:66` is `min-h-11` in a `gap-1` list, a 48px pitch by construction against the frame's 34px, ending the rail 93px low; `status-pill.tsx:40` is `px-2.5 py-1.5 text-xs font-bold` against the frame's `10px/700` with `padding 5px 10px` (47.36×26 vs 44.88×23), and that size comes from `03-components.md`'s vocabulary, so **the plan is what needs correcting, not only the component**; the avatar initial renders `font-sans` where the frame draws Instrument Serif; and `filter-bar.tsx`'s `Category ▾ / City ▾ / Payouts ▾` triggers render **no `▾` glyph at all** (`innerHTML` is bare text, zero children), which walks City 15px and Payouts 25.6px left of their frame positions. **Not in scope:** frame `13`'s table pane clipping its own fifteenth row by 4px — that is **#385**'s to rule on, and the app reproduces it within a pixel or two |
| **393** | **Admin tables have no responsive strategy below 1024** | P1 | M4.5 | **P2 Medium** | **Backlog** | — | **None** | `core` | **Filed 2026-08-31 by #389's browser pass.** `30-responsive.md:31` specifies Admin as `768 → Horizontal scroll` and `390 → Card list, not a table`. **Neither exists.** After #389 the layout is correct at every width and nothing overflows — but at 390 `/admin/reviews` resolves to `12.2px 31.73px 31.73px 21.97px 46.38px 21.97px 70px`, so headers render `R…`, `A…`, `W…` and body cells `4…`, `Ro…`, `T…`. **A 12px column cannot show more than an ellipsis**, so the tables are legible only at 1024 and above. This is #389's fix working, not failing: before it, the rows were mutually misaligned *and* the document scrolled sideways, so the contract's 768 row was never actually implemented either — the old horizontal scroll was incoherence, not a degradation. Ruling needed on whether 768 keeps the contract's scroll-inside-the-pane or follows 390 to cards |
| **395** | **Frame `05 Checkout` fails parity on all six axes** | P1.5 | M3 | **P1 High** | **Backlog** | — | **None** | `core` `stripe` | **Filed 2026-08-31 from #387's parity pass — the first that could reach the screen.** Checkout was unrenderable for the E2E customer until #387 landed a real connected account, so the frame had never been measured. Measured at 1440x900 against `Orla - Screens.dc.html` lines 877–925: **Layout 5** — the full app-shell header renders above the checkout's own wordmark header (`layout.tsx:127`, giving 128px of chrome against the frame's 64px and a **nested `<main>`**, so `Skip to content` lands above the extra nav), the pay button and its reassurance sit in the left column with their bottom edge at 917px — below the 900px fold — where the frame draws them as the summary rail's fourth block, the rail mini-card is missing its `<package> · <duration>` second line, header padding is `0 40px` against `0 32px`. **Style 5** — card shadow `--shadow-md` for `--shadow-sm`, panel radius 14px for 12px, avatar 64px circle for a 54px 12px-radius square, logo at `LOGO_SIZES.authPanel` (19px circles) where the frame draws 15px. **Colour 2** — page ground `stone-100` for `stone-50`. **Font 5** — `h1` 30px for 26px (over `04-laws.md`'s 26px app ceiling), letter-spacing `normal` for `-.01em`, context line and `Total today` 12.5px for 14px. **Text 2** — the rail sub-line and the frame's `Name on card` field have no counterpart. **Access 1** — the nested `<main>` is two landmarks and a wrong skip target. Contrast passes at 4.83:1 worst case; the focus ring passes, sampled twice. **Two are contract gaps, not template omissions:** `checkoutIntentSchema` carries neither package name nor duration, so the rail sub-line needs the API widened. **Coordinate with #386**, which owns token substitutions on other surfaces. **Blocked in practice as of 2026-09-04, though not by another ticket:** #386's parity pass could not measure this frame at all. The only `accepted` booking request without a booking that the E2E customer can reach has an event date of 2026-09-03 — yesterday — and `/bookings/<id>/checkout` answers the 500 page for it. That is #401's defect (a request accepted for a past date). Either #401 lands first, or `pnpm db:seed:e2e` has to leave a future-dated accepted request behind; the pass deliberately did not manufacture one. |
| **398** | **Untrusted vendor text reaches a public page unescaped** | P1.5 | M4.5 | **P0 Critical** | **In Progress** | `main` | **None** | `core` | **Filed 2026-09-04 by the autonomous QA run's `/hunt-bugs` sweep**, which put every candidate through three adversarial skeptics before recording it. Groups 2 verified findings. Two findings, one root: free text a vendor or customer typed is written to a **In Progress 2026-09-04 (autonomous QA run, on `main` per operator instruction).** The XSS half is closed and audited: `serialiseJsonLd` escapes `<`, `>`, `&` and the two JS line separators into `\uXXXX` forms, both JSON-LD sites route through it, and a source guard asserts the exact set of `dangerouslySetInnerHTML` call sites and that every `application/ld+json` block uses the serialiser. security-auditor **PASS-WITH-NOTES**: the escape set closes every route out of a script element, the payload round-trips including `<`-bearing keys, and nothing else in it is attacker-controlled. The bidi half is **partly** closed: `stripBidiControls` runs inside the shared `trimmedString` helper (24 fields) and on the two hand-written fields the finding named — `createVendorProfileSchema.businessName` and the booking request's `eventLocation`. **What remains before Done:** the other hand-written free-text fields route through neither, nothing guards that they must, and the vendor page still has no test file, so acceptance 2's render of a hostile `businessName`/`bio` is unwritten. |
rendered surface without the neutralisation that surface needs. The first is a
script-injection hole on the most-visited public page in the product. |
| **399** | **The money path's writes are read-then-write, so two callers can both win** | P1.5 | M4.5 | **P0 Critical** | **Backlog** | — | **None** | `core` `stripe` | **Filed 2026-09-04 by the autonomous QA run's `/hunt-bugs` sweep**, which put every candidate through three adversarial skeptics before recording it. Groups 7 verified findings. Seven places decide what to write by reading first and then writing without a **One of the seven landed 2026-09-04 (`main`):** `createRefund` now carries `idempotencyKey: cancel_<bookingId>`, so two concurrent cancels refund once. The refund is sent *before* the guarded update that decides who won, so both callers reach Stripe and only the key stops the customer being paid twice. Proven by a test firing both cancels with `Promise.all`, asserting `[200, 409]`, one key and one cancelled row. The other six remain: the double accept, the transition-and-calendar transaction, the availability status predicate, the review duplicate-key sniff, the tag-suggestion unique index, and the message plus `last_message_at` pair. **A second item landed 2026-09-04:** the accept path now takes the vendor's calendar row for the date (`lockHeldDate`, an upsert on the unique key) and commits the transition and the calendar sync in one transaction, so two accepts on one date serialise and the loser gets a 409. The rival check excludes the request's own row, because a double-clicked accept would otherwise be told a rival took the date — that case belongs to `applyTransition`'s status predicate. **A limitation worth knowing:** PGlite holds one connection and runs each `db.transaction` callback to completion, so no two transactions in this suite overlap — the `Promise.all` route test proves the in-transaction re-read, not the lock, and deleting `lockHeldDate` leaves it green. `date-lock.test.ts` pins the lock's shape instead, and a true contention test against two real connections is still owed. Measured during review against the Docker Postgres: without the lock the same sequence produces two accepted requests. **A third item landed 2026-09-04 (`c19bde2`):** the review duplicate guard read the constraint name out of `error.message`, and Drizzle 0.45 stopped putting it there — the wrapper's message is `Failed query: …` and the name is on `cause`, so a genuine concurrent double review answered 500 instead of 409. Replaced by `violatesConstraint`, which walks the error chain and falls back to the message text; its test takes a real wrapped driver error and asserts the old shape is absent, which is the fail-before evidence PGlite's single connection cannot produce at the route level. **Four remain:** the transition-and-calendar transaction (landed with the accept lock), the availability status predicate, the tag-suggestion unique index, and the message plus `last_message_at` pair. |
predicate, a transaction, or an idempotency key. Two of them move money or sell
a date twice. The sweep reproduced the double-accept against the real harness
(two `/accept` calls fired with `Promise.all`; both answered 200 |
| **400** | **Cancelling a booking leaves it half-cancelled everywhere** | P1.5 | M4.5 | **P0 Critical** | **Backlog** | — | **None** | `core` `stripe` | **Filed 2026-09-04 by the autonomous QA run's `/hunt-bugs` sweep**, which put every candidate through three adversarial skeptics before recording it. Groups 5 verified findings. Cancel flips `bookings.status` and frees the date, and stops. The parent
request stays `accepted`, so the next transition on that date re-locks it
permanently; every read that asks "is there a booking for this request" gets a
row back and reports it as paid. The customer sees a booking they cancelle |
| **401** | **A request can be accepted into a state that can never be paid** | P1.5 | M4.5 | **P1 High** | **Backlog** | — | **None** | `core` `stripe` | **Filed 2026-09-04 by the autonomous QA run's `/hunt-bugs` sweep**, which put every candidate through three adversarial skeptics before recording it. Groups 4 verified findings. Accept does not check that the thing being accepted is payable. A custom
request with no price, or one whose event date has already passed, becomes a
terminal `accepted` row; the customer's checkout for it renders the 500 page.
Reproduced end to end by the browser sweep. |
| **402** | **Messages: the thread pane shows the wrong conversation, and only its oldest 50** | P1.5 | M4.5 | **P1 High** | **Backlog** | — | **None** | `core` | **Filed 2026-09-04 by the autonomous QA run's `/hunt-bugs` sweep**, which put every candidate through three adversarial skeptics before recording it. Groups 17 verified findings. The messaging screen is the surface with the most confirmed defects in the
sweep. Its thread loader has no cancellation and no owner check, its draft is
one string for the whole screen, and the API pages from the oldest message —
so a thread with more than 50 messages hides everything newer behind a |
| **403** | **Search: the price filter means something other than its label, and bad params answer inconsistently** | P1.5 | M4.5 | **P1 High** | **Backlog** | — | **None** | `core` | **Filed 2026-09-04 by the autonomous QA run's `/hunt-bugs` sweep**, which put every candidate through three adversarial skeptics before recording it. Groups 9 verified findings. Nine findings on one surface. The most serious is semantic: the filter is
labelled `STARTING RATE` and matches any package in range, so a vendor whose
cheapest package is $400 appears under a $4,000 floor. The rest are the URL's
handling of values it cannot use — some announced, some silent, one sen |
| **404** | **A restored draft overwrites the choice the customer just made** | P1.5 | M4.5 | **P2 Medium** | **Backlog** | — | **None** | `core` | **Filed 2026-09-04 by the autonomous QA run's `/hunt-bugs` sweep**, which put every candidate through three adversarial skeptics before recording it. Groups 3 verified findings. `useSavedDraft` replaces the whole form object once it reads storage after
mount, so the date and guest count chosen on the vendor profile rail — or given
in the URL — are silently replaced by whatever was saved earlier. A URL-only
guest count is itself persisted as a 'draft'. |
| **405** | **The storefront editor keeps unsaved work it did not save, and loses work it should have** | P1.5 | M4.5 | **P1 High** | **Backlog** | — | **None** | `core` | **Filed 2026-09-04 by the autonomous QA run's `/hunt-bugs` sweep**, which put every candidate through three adversarial skeptics before recording it. Groups 8 verified findings. The vendor editor's save is two writes with no rollback, its post-save
snapshot is taken from the live form rather than what was sent, and its publish
switch reads unsaved state while toggling the saved row. Around it, the package
form and the portfolio manager both discard edits when their parent r |
| **406** | **Development defaults can reach a deployed build** | INFRA | M-OPS | **P0 Critical** | **Backlog** | — | **None** | `core` `auth` `storage` `stripe` | **Filed 2026-09-04 by the autonomous QA run's `/hunt-bugs` sweep**, which put every candidate through three adversarial skeptics before recording it. Groups 6 verified findings. Five variables carry a development default that a production build silently
accepts: the API boots on localhost and MinIO, the web bundle bakes
`http://localhost:4000` as its API origin, every stored-key image resolves to
nothing, checkout loads Stripe.js with an empty publishable key, and the Clerk |
| **407** | **Reads hand back more than the caller is entitled to** | P1.5 | M4.5 | **P1 High** | **Backlog** | — | **None** | `core` `storage` | **Filed 2026-09-04 by the autonomous QA run's `/hunt-bugs` sweep**, which put every candidate through three adversarial skeptics before recording it. Groups 3 verified findings. Three reads return fields their audience should not have: a public endpoint
serves the vendor's private per-date note, a customer-facing booking read
carries the platform fee, the vendor payout split and the Stripe transfer id,
and any authenticated user can pin another vendor's storage object by na |
| **408** | **A legal request body 500s, and four reads have no ceiling** | P1.5 | M4.5 | **P1 High** | **Backlog** | — | **None** | `core` `email` | **Filed 2026-09-04 by the autonomous QA run's `/hunt-bugs` sweep**, which put every candidate through three adversarial skeptics before recording it. Groups 10 verified findings. Two classes with the same shape: a value the schema accepts is wider than the
column that stores it, so an ordinary input answers 500 after the state has
already moved; and several reads have no limit, one of which fans out an
unbounded `Promise.all` that ends in an email send. |
| **409** | **The server's UTC day stands in for the viewer's day** | P1.5 | M4.5 | **P2 Medium** | **Backlog** | — | **None** | `core` | **Filed 2026-09-04 by the autonomous QA run's `/hunt-bugs` sweep**, which put every candidate through three adversarial skeptics before recording it. Groups 2 verified findings. `todayDateString()` says in its own contract that it is only meaningful on the
client, and three server components call it. West of UTC a vendor's current day
renders as already past on the availability calendar and the dashboard's 'This
week'; east of UTC yesterday stays pickable on the booking req |
| **410** | **Signing in through returnTo lands on a blank page** | P1.5 | M4.5 | **P1 High** | **Backlog** | — | **None** | `core` `auth` | **Filed 2026-09-04 by the autonomous QA run's `/hunt-bugs` sweep**, which put every candidate through three adversarial skeptics before recording it. Groups 3 verified findings. Three reproductions of one defect: a `returnTo` pointing at a route the
signed-in role may not see leaves the browser on a blank page with signed-out
chrome, rather than redirecting to somewhere that role can be. A vendor signing
in from a booking request form, a vendor sent to `/customer/profile`,  |
| **411** | **Accessibility: dialogs, calendars and composite controls are unreachable or unannounced** | P1.5 | M4.5 | **P1 High** | **Backlog** | — | **None** | `core` | **Filed 2026-09-04 by the autonomous QA run's `/hunt-bugs` sweep**, which put every candidate through three adversarial skeptics before recording it. Groups 1 verified finding. The static accessibility hunt found, beyond the focus-ring work #383 owns and
the silent-submit work #388 closed:

- **Portfolio lightbox** (`portfolio-pane.tsx:108-160`) is `role="dialog"
  aria-modal="true"` but nothing focuses it, nothing traps Tab and nothing
  restores focus — a keyboard user t |
| **412** | **Customer profile and storefront CTAs report things that are not so** | P1.5 | M4.5 | **P2 Medium** | **Backlog** | — | **None** | `core` | **Filed 2026-09-04 by the autonomous QA run's `/hunt-bugs` sweep**, which put every candidate through three adversarial skeptics before recording it. Groups 7 verified findings. Seven small correctness and copy defects on the customer profile and the public
| **413** | **Frame `06 Booking confirmed` fails parity on five axes** | P1.5 | M4.5 | **P2 Medium** | **Backlog** | — | **None** | `core` | **Filed 2026-09-04 by #386's parity pass**, the first to measure this frame — #386 changed one colour on it and the pass around that change found the rest. Nine measured misses, all in `booking-confirmed.tsx`, and the first three are one fix: the component renders a **second `<main>`** inside the layout's, whose `flex-1` resolves against a non-flex parent, so the sage gradient is `[0,64,1440,515]` and stops 321px short of the viewport the frame draws full-bleed — which also clips all four cross-sell chips' focus outlines by 4px. |
storefront, each of which tells the reader something untrue. |
**This board carries open work only. Every closed row lives in `.claude/plans/vendor-marketplace-tickets-archive.md`**, whole — **384 rows as of 2026-09-03: 200 `Done` and 184 `Superseded`**, recounted programmatically. **`Superseded` now goes to the archive with `Done`**, which reverses what this line said before 2026-08-31. The old rule kept `Superseded` rows here on the reasoning that they are still consulted — and they are — but it was never applied: 138 of them were already in the archive while 46 sat on this board, so the board was 46 of 62 rows closed and the distinction cost a reader more than it bought. **Being consulted is not the same as being open.** Nothing about consulting them changed: `tickets.board.test.ts` reads both files together, `pnpm preflight --ticket <old n>` still gates against every one, and the detail sections moved across whole rather than being summarised. A `Superseded` ticket is still never worked directly.

Rows are ordered by build sequence, not by ticket number. **Recounted programmatically 2026-09-03, after the autonomous QA run's Phase 0 reconciliation moved six `Done` rows to the archive: 28 rows — 25 Backlog, 1 In Progress, 2 Deferred — needs a human, and 0 `Done` awaiting the next archive sweep.** **Do not hand-maintain these numbers, recount them** — the line here has been wrong after two of the last three passes. That sweep moved the remaining 46 `Superseded` rows and their 36 detail sections to the archive, on the user's instruction to close superseded tickets out. **A Backlog count is still not a ready count** — read `Blocked By`, and trust `pnpm preflight --ticket <n>` over both.
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

## Filed 2026-09-04 — the autonomous QA run's application sweep

`/hunt-bugs` fanned eleven read-only hunters across the codebase and drove seven
flows in a real browser, producing 131 candidates. Each went to three skeptics
prompted to refute it; **92 survived**. They are grouped here into fifteen
tickets by the file set a single lane would open, not one row per finding —
`ticket-granularity-feature-sized` is the rule, and the sweep's own output is
kept in the run report rather than the board.

### #398: Untrusted vendor text reaches a public page unescaped

**Milestone:** M4.5 | **Priority:** P0 Critical | **Status:** Backlog | **Capabilities:** `core`
**Blocked by:** None

**Filed 2026-09-04 by the autonomous QA run's `/hunt-bugs` sweep.** Every finding
below was reproduced or traced by a read-only hunter or a browser pass, then put
through three adversarial skeptics with distinct lenses; only findings a majority
upheld are here.

Two findings, one root: free text a vendor or customer typed is written to a
rendered surface without the neutralisation that surface needs. The first is a
script-injection hole on the most-visited public page in the product.

#### The findings this groups

- **Stored XSS: vendor bio/business name serialised raw into the public page's JSON-LD <script>** — `apps/web/src/app/vendors/[slug]/page.tsx:226`. The HTML parser closes the `application/ld+json` block at the vendor's `</script>` and executes the injected script in the visitor's origin on every page view. JSON.stringify does not escape `<`, `</script>` or `<!--`, and dangerouslySetInnerHTML emits it verbatim (Next escapes its own __next_f payloads for exactly this reason; this hand-rolled block does not). A signed-in visitor's Clerk session is usable from that 
- **Unicode bidi override characters in the venue field are stored and rendered unneutralised** — `http://localhost:3000/bookings/ac475f65-526a-4856-9cbe-dd8979691a74`. The RLO/PDF control characters survive into the database and into the detail-page summary line (and therefore the vendor's inbox), so a customer-supplied string can visually reorder the surrounding text on both sides' screens. Script and img payloads in the same fields were rendered inert, so this is the only hostile-text case that reached the page unchanged.

#### Acceptance

1. The JSON-LD block escapes `<`, `>`, `&`, U+2028 and U+2029 before it reaches `dangerouslySetInnerHTML` — or is emitted through a serialiser that does, rather than bare `JSON.stringify`.
2. A test renders the vendor page for a profile whose `businessName` and `bio` contain `</script><script>alert(1)</script>` and asserts the rendered HTML contains no executable `<script>` beyond the JSON-LD element itself.
3. Unicode bidi override characters (U+202A–U+202E, U+2066–U+2069) in vendor and customer free text are stripped or neutralised at the write boundary, so a venue name cannot reorder the sentence around it.
4. The neutralisation lives in one place (`packages/shared`), not per call site, and every free-text write path routes through it.

#### Tests (required)

- [ ] A web test that a hostile `businessName`/`bio` cannot break out of the JSON-LD script element
- [ ] A shared-package test for the bidi stripper, asserting the exact characters removed and that ordinary non-Latin text is untouched

---

### #399: The money path's writes are read-then-write, so two callers can both win

**Milestone:** M4.5 | **Priority:** P0 Critical | **Status:** Backlog | **Capabilities:** `core` `stripe`
**Blocked by:** None

**Filed 2026-09-04 by the autonomous QA run's `/hunt-bugs` sweep.** Every finding
below was reproduced or traced by a read-only hunter or a browser pass, then put
through three adversarial skeptics with distinct lenses; only findings a majority
upheld are here.

Seven places decide what to write by reading first and then writing without a
predicate, a transaction, or an idempotency key. Two of them move money or sell
a date twice. The sweep reproduced the double-accept against the real harness
(two `/accept` calls fired with `Promise.all`; both answered 200 and both rows
ended `accepted` on the same date).

#### The findings this groups

- **Customer booking cancel refunds without an idempotency key, so two concurrent cancels refund twice** — `apps/api/src/modules/payments/payments.service.ts:551`. Stripe receives two independent 50% refunds against the same payment intent (their sum does not exceed the charge, so Stripe accepts both) — the customer is refunded 100% of a booking the policy refunds at 50%, and the vendor's payout is reversed in full. The second request then gets a 409 and only an error log line records that money moved twice. The ban path already carries `idempotencyKey: ban-refund:<bookingId>` 
- **Two accepts on the same vendor date are only guarded by a read, so both can win and both become payable** — `apps/api/src/modules/booking-requests/booking-requests.service.ts:790`. Both requests end up `accepted` and both customers are told the date is held. Each can open checkout (requirePayableByCustomer only checks the row's own status) and confirmBooking inserts a booking per request — `bookings_request_id_key` is per request, and no constraint exists on (vendor_id, event_date). Two customers pay in full for one vendor on one day.
- **Request transition and calendar sync are two statements outside a transaction; a failure between them leaves an accepted request on an unheld date** — `apps/api/src/modules/booking-requests/booking-requests.service.ts:641`. The date has no `booked` row. A second request for that date can be created and, because prepareTransition's check at 790 reads the calendar rather than the request table, accepted as well — two accepted requests for one date without any concurrency needed. The cell only self-heals when some other transition happens on that exact date. Also violates the repository rule that multi-statement mutations run in one transa
- **Vendor availability edit is check-then-write with no status predicate, so it can overwrite a `booked` cell written by a racing accept or payment webhook** — `apps/api/src/modules/availability/availability.service.ts:162`. applyAvailability deletes the row (if the vendor chose 'available') or upserts it to 'blocked' with no `status <> 'booked'` guard. A paid or accepted date now reads free/blocked: search shows the vendor as available, createBookingRequest accepts a new request for it (`blocked` is not a hard stop), and the vendor's calendar no longer shows the sale.
- **Review duplicate-key guard sniffs error.message, which Drizzle 0.45 no longer carries — concurrent double review 500s instead of 409** — `apps/api/src/modules/reviews/reviews.service.ts:222`. drizzle-orm 0.45.2 wraps every driver error in DrizzleQueryError whose message is `Failed query: <sql>\nparams: <params>` (node_modules/drizzle-orm/errors.js:10-19, thrown from pg-core/session.js:41 which both postgres-js and pglite sessions route through). The constraint name lives only on `cause`, so `/reviews_booking_reviewer_key/.test(error.message)` is never true, the catch rethrows, and the client gets 500 INTE
- **Tag suggestion dedupe is read-then-insert with no unique index, so concurrent submissions create duplicate pending rows** — `apps/api/src/modules/tags/tags.service.ts:105`. The admin queue at /admin/tags shows N identical pending suggestions. Approving the first creates the tag; approving the second falls into the merge branch, so no data corruption — but the `already_suggested` contract the service promises is not upheld and each duplicate is an operator action.
- **insertMessage writes the message and bumps conversations.last_message_at as two statements outside a transaction** — `apps/api/src/modules/messaging/messaging.dao.ts:223`. The message exists and is delivered on the next thread read, but the conversation keeps its old `last_message_at`, so it does not surface at the top of either party's /messages list and the recipient's list-level preview lags until another message lands. Violates the repository rule that multi-statement mutations run in one transaction.

#### Acceptance

1. `createRefund` carries an idempotency key derived from the booking, so a repeated or concurrent cancel refunds once.
2. Accepting a request takes the date under a predicate or a lock, so exactly one of two concurrent accepts on the same vendor date wins and the loser gets a 409.
3. A request transition and its calendar sync commit in one transaction; a failure leaves neither applied.
4. The availability upsert carries a status predicate so it cannot overwrite a `booked` cell.
5. The review duplicate guard reads the constraint name off the driver error's `cause`, not `error.message`, and answers 409.
6. `tag_suggestions` gets a unique index on its dedupe key and the insert is `onConflictDoNothing`.
7. `insertMessage` and the `last_message_at` bump commit together.

#### Tests (required)

- [ ] A concurrency test per write: two calls fired with `Promise.all` against the real harness, asserting exactly one succeeds and the database holds one row
- [ ] A refund test asserting the idempotency key is passed and is stable for the same booking

---

### #400: Cancelling a booking leaves it half-cancelled everywhere

**Milestone:** M4.5 | **Priority:** P0 Critical | **Status:** Backlog | **Capabilities:** `core` `stripe`
**Blocked by:** None

**Filed 2026-09-04 by the autonomous QA run's `/hunt-bugs` sweep.** Every finding
below was reproduced or traced by a read-only hunter or a browser pass, then put
through three adversarial skeptics with distinct lenses; only findings a majority
upheld are here.

Cancel flips `bookings.status` and frees the date, and stops. The parent
request stays `accepted`, so the next transition on that date re-locks it
permanently; every read that asks "is there a booking for this request" gets a
row back and reports it as paid. The customer sees a booking they cancelled
described as booked, on a screen they cannot reach by navigation.

#### The findings this groups

- **Cancelling a paid booking frees the date while its request stays `accepted`, so the next transition on that date re-locks it permanently** — `apps/api/src/modules/booking-requests/booking-requests.service.ts:691`. syncHeldDate reads statusesOnDate → ['accepted', 'declined'] and calls setHeldDate('booked'): the date is marked sold again although the only booking on it is cancelled. Nothing can undo it: setOwnAvailability 409s on any `booked` date (availability.service.ts:165), setHeldDate(null) refuses to delete when *any* bookings row exists on the date regardless of status (booking-requests.dao.ts:385-389, no status filter), 
- **A cancelled booking is still read as paid: checkout redirects to the confirmation, the detail page says "is booked" and offers "Cancel booking" again** — `apps/api/src/modules/payments/payments.dao.ts:96-110 (findBookingByRequest has no status filter)`. The page re-renders from getBookingForRequest, which returns the cancelled row because neither reconcileBooking (`existing` is returned whatever its status) nor findBookingByRequest checks status. AcceptedRequest branches only on `booking ? … : …`, so the customer who just cancelled sees "<Vendor> is booked", "Paid $X", a refund sentence, "View confirmation" and a live "Cancel booking" button; pressing it again answe
- **Vendor bookings page counts a cancelled booking as "coming up" and pins a "Booked" pill beside its "Cancelled" pill** — `apps/web/src/components/vendor/booking-card.tsx:55-56`. The heading reads "You have N bookings coming up" including the cancelled one, and the card shows `<StatusPill tone="confirmed">Booked</StatusPill>` (chosen only on `booking` being non-null) next to CompleteBooking's `<StatusPill tone="failed">Cancelled</StatusPill>` — two contradictory pills on one row, and the customer's contact details still printed under a date the vendor no longer holds.
- **Ban unwind swallows a failed refund and reports success, leaving a confirmed booking on a suspended account with nobody told** — `apps/api/src/modules/admin/admin.service.ts:283`. The catch logs and `continue`s before cancelBookingAndFreeDate and before the notification loop, so that booking stays `confirmed`, its date stays `booked`, neither customer nor vendor receives booking_cancelled, and the route still answers 200. AdminBanResult has no field for refunds that failed, so the operator's table shows the account suspended and has no signal that money did not move; only a log line records it
- **Paid bookings on the customer hub link nowhere, so the only surface with "Cancel booking" and "View confirmation" is unreachable by navigation** — `apps/web/src/components/bookings/bookings-hub.tsx:109-127`. `href` is `null` for `kind === 'booking'`, justified by a stale comment ("has no detail route of its own yet"). The detail route exists at /bookings/<requestId> (AcceptedRequest with the cancel and confirmation controls) and `booking.requestId` is already on the wire object (it is what `paidRequestIds` is built from). The customer's confirmed booking is a dead card: after checkout there is no in-product path back to 

#### Acceptance

1. Cancelling moves the parent `booking_requests` row out of `accepted` in the same transaction as the booking and the calendar.
2. `findBookingByRequest` (and every read built on it) filters on status, so a cancelled booking is not read as paid: checkout does not redirect to the confirmation, the detail page does not say the date is booked, and it does not offer `Cancel booking` a second time.
3. The vendor bookings page does not count a cancelled booking as coming up, and does not pin a `Booked` pill beside its `Cancelled` pill.
4. A paid booking on the customer hub links to its detail page, so `Cancel booking` and `View confirmation` are reachable.
5. A ban that cannot refund a confirmed booking fails loudly rather than reporting success.

#### Tests (required)

- [ ] An API test that cancel leaves the request out of `accepted` and the date re-bookable
- [ ] A test that every booking read filters cancelled rows
- [ ] A web test for the hub link and the vendor pill

---

### #401: A request can be accepted into a state that can never be paid

**Milestone:** M4.5 | **Priority:** P1 High | **Status:** Backlog | **Capabilities:** `core` `stripe`
**Blocked by:** None

**Filed 2026-09-04 by the autonomous QA run's `/hunt-bugs` sweep.** Every finding
below was reproduced or traced by a read-only hunter or a browser pass, then put
through three adversarial skeptics with distinct lenses; only findings a majority
upheld are here.

Accept does not check that the thing being accepted is payable. A custom
request with no price, or one whose event date has already passed, becomes a
terminal `accepted` row; the customer's checkout for it renders the 500 page.
Reproduced end to end by the browser sweep.

#### The findings this groups

- **A vendor can accept a custom request with no price, producing a terminal `accepted` row that can never be paid** — `apps/api/src/modules/booking-requests/booking-requests.service.ts:772-808`. The row becomes `status='accepted'`, `finalPriceCents=null`, `quotedPriceCents=null`, `acceptedAt` set; `syncHeldDate` writes the date `booked`; the customer is notified "Payment confirms the booking". Checkout then fails: `payableAmount` (`payments.service.ts:65-77`) throws 500 `INTERNAL_ERROR` "has no locked price"; the web shows "No price yet" / "Pay now" (`accepted-request.tsx:103-105,168-171`). `BOOKING_REQUEST_
- **Vendor can accept a custom request that has no quote and whose date has already passed; the customer's checkout for it then renders the 500 page** — `http://localhost:4000/booking-requests/:id/accept (POST) -> http://localhost:3000/bookings/d5c7de88-463e-4a3c-bae4-e5cb0b992421/checkout`. Accept returned 200. DB afterwards: booking_requests.status='accepted', final_price_cents NULL, accepted_at set; a new availability row 2026-09-03 status='booked' was written. The vendor calendar now shows '2026-09-03 — Completed, in the past' and 'Completed 1 event' for an event that was never paid or worked; /vendor/bookings lists it under 'Past events' as 'AWAITING PAYMENT … —' with no amount. The customer's check
- **A request can be sent for today, and its 7-day reply window outlives the event; past-dated requests stay 'awaiting reply'** — `http://localhost:3000/vendors/e2e-test-studio/request and http://localhost:3000/bookings?tab=history`. The request is created with expires_at eight days after the event date. The hub says 'Next up is E2E Test Studio today.' and History shows an older Kessler & Co. request dated Mon, Aug 31 still 'Pending ... awaiting reply · expires in 4d' four days after the event. Meanwhile the vendor dashboard's 'This week' starts on 'Friday, September 4', so the two sides disagree about what today is. Vendors are offered accept/qu
- **Booking request page admits admins but the API refuses them, so an admin completes the two-step form and gets a 403 on send** — `apps/web/src/app/vendors/[slug]/request/page.tsx:62`. The page only bounces role==='vendor' (line 62-63); an admin renders the form, and POST /booking-requests is `requireRole('customer')` (booking-requests.routes.ts:60), so the submit answers 403 FORBIDDEN with the generic message. The role gate is applied on the client surface for one non-customer role and on the API for both, and they disagree; every other customer-only surface (/bookings/*, /customer/*) uses require

#### Acceptance

1. Accepting a request with no locked price is refused with a message naming what is missing.
2. Accepting a request whose event date has passed is refused.
3. A request cannot be created for a date that has already passed, and its reply window never outlives the event date.
4. The booking request page does not admit a role the API refuses — an admin sees the same answer before filling the form, not a 403 on send.

#### Tests (required)

- [ ] API tests for each refusal, asserting status and body shape
- [ ] A test that a request's reply deadline is `min(created + 7 days, event date)`

---

### #402: Messages: the thread pane shows the wrong conversation, and only its oldest 50

**Milestone:** M4.5 | **Priority:** P1 High | **Status:** Backlog | **Capabilities:** `core`
**Blocked by:** None

**Filed 2026-09-04 by the autonomous QA run's `/hunt-bugs` sweep.** Every finding
below was reproduced or traced by a read-only hunter or a browser pass, then put
through three adversarial skeptics with distinct lenses; only findings a majority
upheld are here.

The messaging screen is the surface with the most confirmed defects in the
sweep. Its thread loader has no cancellation and no owner check, its draft is
one string for the whole screen, and the API pages from the oldest message —
so a thread with more than 50 messages hides everything newer behind a reload.

#### The findings this groups

- **Message threads are truncated to the oldest 50 messages; everything newer is invisible after a reload** — `apps/api/src/modules/messaging/messaging.dao.ts:205-211`. findMessages orders `asc(createdAt)` with LIMIT 50 OFFSET 0, and loadThread requests `/conversations/<id>/messages` with no page parameter and does `setMessages(page.items)` — there is no "load older" control and no request for any later page. The thread renders messages 1–50 and hides the newest ones, including the reader's own last replies and the other party's latest answer. During a live session SSE appends new m
- **Failed thread read in the messages screen is unhandled and leaves the previous thread's messages under the new thread's header** — `apps/web/src/components/messaging/messages-screen.tsx:99`. loadThread awaits the GET with no try/catch; the effect fires it with `void`, so the rejection is unhandled (console error, Next dev overlay). `messages` is never reset when `activeId` changes and is only set on success, so thread A's bubbles stay rendered under B's avatar/name and booking line, and Send posts the draft to B. On first load the failure leaves `messages=[]` and the pane shows 'Start the conversation — 
- **Thread load effect has no cancellation or pending state: stale response can leave conversation A's messages under conversation B, and an existing thread shows 'Start the conversation' while loading** — `apps/web/src/components/messaging/messages-screen.tsx:128`. loadThread(A) resolves last and calls setMessages(A.items) unconditionally, so B's header sits over A's bubbles until another event happens; during the switch, A's bubbles remain under B's header because messages is never cleared; and on first open the pane renders the empty-thread copy 'Start the conversation — say what you need and when…' (line 319-322) over a thread that has messages, because messages starts [] an
- **Thread pane has no owner check: a slower GET for the previous thread, or a send that resolves after switching threads, writes the wrong conversation's messages into the visible one** — `apps/web/src/components/messaging/messages-screen.tsx:98-132,165-193`. The header names B while the bubbles are A's, or A's just-sent message appears at the bottom of B's thread; the reader can reply to the wrong person. State self-corrects only on a later thread switch.
- **Notification click to /messages?conversation=<id> while already on /messages does not switch threads — MessagesScreen reads the param only at mount** — `apps/web/src/components/messaging/messages-screen.tsx:63-65`. URL says conversation B, the pane still shows A, and the notification that pointed at B is already struck through — the reader has to find B by hand in the list. Same for a bell click from the `?conversation=` URL of any other thread.
- **/messages?conversation=<id not in the list> shows "No conversations yet" over a populated inbox, hides the list below md with no way back, and fires an unhandled rejection** — `apps/web/src/app/messages/page.tsx:37-47`. The raw param is never validated and is used as `activeId`, so `active` is null while `activeId` is not. The right pane renders the EmptyState "No conversations yet" even though the aside is listing threads; `listOwnsSmallScreen` is false, so below md the list is `max-md:hidden` and the back button lives inside the `active !== null` branch — the user is stranded on an empty pane with no control. Meanwhile `useEffect`
- **Foreign, missing or malformed ?conversation= id renders 'No conversations yet' beside a populated list and throws an uncaught ApiClientError** — `apps/web/src/components/messaging/messages-screen.tsx:98-132`. The API correctly refuses (403/404/400), but the right pane shows the empty-state heading 'No conversations yet' and copy 'A thread opens the moment you send a booking request…' while the left list shows the user's 5 real conversations. No user-facing explanation, and the rejected promise from loadThread escapes as an uncaught page error.
- **An unrecognised ?conversation= id selects a thread that is not in the list: the pane claims 'No conversations yet' over a populated inbox, hides the list below md, and fires an unhandled rejection** — `apps/web/src/app/messages/page.tsx:47`. activeId is seeded with the foreign id, `active` resolves to null, so the right pane renders EmptyState 'No conversations yet' even though `conversations` has rows; `listOwnsSmallScreen` is false (activeId !== null), so below md the list is `max-md:hidden` and the empty state is also hidden's sibling — the user has an inbox and no way to reach it without editing the URL. The effect still calls loadThread(foreignId); 
- **Clicking a thread in the list does not write ?conversation=, so refresh and Back lose the selected thread** — `apps/web/src/app/messages/page.tsx:22-25`. URL stays http://localhost:3000/messages after both clicks, contradicting the page comment that 'the thread id lives in ?conversation= so a thread is linkable'. A reload returns to the top thread, and Back leaves /messages entirely instead of returning to the previously viewed thread.
- **The composer draft is one string for the whole screen, so text typed for one conversation is sent to whichever thread is active when Send is pressed** — `apps/web/src/components/messaging/messages-screen.tsx:67`. `draft` is not keyed by conversation and is not cleared on `setActiveId`, so the textarea still holds A's text under B's header and `submit()` POSTs it to `/conversations/${activeId}/messages` — B's thread. A vendor negotiating with two customers can send one customer's price to the other.
- **A message arriving in the open thread is displayed but never marked read, so the list and header count it as unread while it is on screen** — `apps/web/src/components/messaging/messages-screen.tsx:142-155`. The row for A goes bold with a clay dot and the header shows 'Unread (1)' for a message the reader is looking at; it clears only after switching away and back (or an SSE reconnect).
- **Double-clicking Send creates the same message twice** — `apps/web/src/components/messaging/messages-screen.tsx:419`. Two POST /conversations/:id/messages requests both return 201, two identical bubbles appear in the thread, and the database holds two rows. Expected one message.
- **Send-failure message is not in a live region** — `apps/web/src/components/messaging/messages-screen.tsx:189`. The red 'That message did not send. Your text is still here — try again.' text appears visually only; it has no role and no aria-live ancestor, so assistive technology is not told the send failed. Colour is correct per 40-states (red for failed send).
- **Event-stream connect() awaits getToken() outside try/catch; a rejection kills live updates for the tab with no retry and no resume** — `apps/web/src/lib/use-event-stream.ts:121`. The rejection escapes `void connect()` (:235, :216) as an unhandled rejection; scheduleRetry is never called, so `exhausted` stays false and both `online` and `visibilitychange` handlers return early at resume() (:220). The tab never reconnects for its lifetime: no notification pushes, and /messages shows the 'Reconnecting' informational banner permanently while nothing is reconnecting. Coming back online does not re
- **Conversation list loads every message in every thread to pick one preview per conversation** — `apps/api/src/modules/messaging/messaging.dao.ts:128`. The query is `SELECT * FROM messages WHERE conversation_id IN (...) ORDER BY created_at DESC` with no `DISTINCT ON`, no `LIMIT`, and no per-conversation bound, so the full message history of every thread the user has ever had is pulled through the pool and into Node on every page load, then all but N rows are discarded in the `for` loop. Cost scales with total messages sent, not thread count: a vendor with 200 thread
- **Conversation list's OR across two tables defeats both conversations indexes — every list render is a full scan of conversations** — `apps/api/src/modules/messaging/messaging.dao.ts:65`. `WHERE conversations.customer_id = $1 OR vendor_profiles.user_id = $1` references two different tables, so Postgres cannot use `conversations_customer_idx` or `conversations_vendor_idx` (`packages/db/src/schema/messaging.ts:449-450`) as an access path; it must read every `conversations` row, join each to `vendor_profiles`, and filter. The per-request cost scales with the platform's total thread count rather than the 
- **POST /conversations is requireAuth while its sibling POST /booking-requests is customer-only, so vendors and admins can open threads with any published vendor** — `apps/api/src/modules/messaging/messaging.routes.ts:91`. openConversation (messaging.service.ts:228-251) only refuses the vendor's own listing; a vendor becomes `conversations.customer_id` on a thread with a competitor and can message every vendor on the marketplace (spam/poaching vector with no rate limit beyond the global one). The receiving vendor sees the sender as a first-name customer, and clicking through to GET /customers/:id/profile answers 404 because customers.s

#### Acceptance

1. A thread's newest messages are what load; paging goes backwards from the newest.
2. A thread read that fails renders an error rather than leaving the previous thread's messages under the new header.
3. The thread loader cancels or ignores a stale response, and a send that resolves after a switch cannot write into the wrong thread.
4. `?conversation=` is honoured on every change, not only at mount; an id that is not in the list renders a not-found state rather than 'No conversations yet' over a populated inbox, and never throws.
5. Selecting a thread writes `?conversation=`, so refresh and Back keep it.
6. The composer draft is per conversation.
7. A message arriving in the open thread is marked read.
8. Send is idempotent against a double click.
9. The send-failure message is announced.
10. The event stream survives a `getToken()` rejection and resumes.
11. The conversation list stops loading every message in every thread, and its query uses an index rather than a full scan.
12. `POST /conversations` is customer-only, matching its sibling.

#### Tests (required)

- [ ] A test per behaviour above; the thread-ownership and stale-response cases need an ordered pair of resolutions, not a single await

---

### #403: Search: the price filter means something other than its label, and bad params answer inconsistently

**Milestone:** M4.5 | **Priority:** P1 High | **Status:** Backlog | **Capabilities:** `core`
**Blocked by:** None

**Filed 2026-09-04 by the autonomous QA run's `/hunt-bugs` sweep.** Every finding
below was reproduced or traced by a read-only hunter or a browser pass, then put
through three adversarial skeptics with distinct lenses; only findings a majority
upheld are here.

Nine findings on one surface. The most serious is semantic: the filter is
labelled `STARTING RATE` and matches any package in range, so a vendor whose
cheapest package is $400 appears under a $4,000 floor. The rest are the URL's
handling of values it cannot use — some announced, some silent, one sent to the
API anyway.

#### The findings this groups

- **Price filter matches any package in range, not the 'STARTING RATE' it is labelled as** — `http://localhost:3000/search?minPriceCents=400000`. '$4k+' shows '5 vendors' whose cards read 'From $1,750 / $1,680 / $1,640 / $2,100 / $1,580'; '$2–4k' shows 16 vendors. Read-only query against the local DB: vendors whose cheapest active package is in band = 4 / 12 / 1 / 0 (<=1k, 1–2k, 2–4k, 4k+), vendors with ANY active package in band = 4 / 16 / 16 / 5 — the screen matches the latter. The label, the card price and the result set contradict each other.
- **Price inputs drop the decimal point, turning '999.99' into a $99,999 floor** — `http://localhost:3000/search`. Min field re-renders as '$99,999'; URL becomes ?minPriceCents=9999900&maxPriceCents=10000100; zero results with chip '$99,999 – $10,000+'. '9.99'–'19.99' becomes '$999 – $1,999' (minPriceCents=99900&maxPriceCents=199900, 16 vendors). A customer typing cents gets a filter 100x what they typed with no message.
- **Half-rejected price range is announced as 'cleared' while the surviving bound still filters and its chip stays** — `http://localhost:3000/search?minPriceCents=0&maxPriceCents=9999999999900`. Page shows 'That price range isn't one we can use, so it was cleared — the rest of your search still applies' but the chip '$0 – $10,000+' remains and the API is still called with minPriceCents=0. In the decimal case the notice says the range was cleared, yet minPriceCents=9999900 is still sent, 0 cards render, chip '$99,999 – $10,000+' remains, and 'No vendors match that filter / The price range is the narrowest fil
- **Past date in the URL is sent to the API before the client strips it, producing a 400 and a console error** — `http://localhost:3000/search?date=2020-01-01`. A GET to :4000/vendors?date=2020-01-01 goes out and is refused 400 ('Event date has already passed'); the console logs 'Failed to load resource: 400 (Bad Request)'. The page then clears the date and shows 'Wed, Jan 1 has already passed, so the date was cleared' with 17 vendors, so the user recovers, but every shared stale link costs a failed request and a console error.
- **Unknown-but-well-formed category slug renders the marketplace-empty copy 'No vendors listed yet'** — `http://localhost:3000/search?category=does-not-exist`. Screen says 'No vendors listed yet / Try a different vendor type or city.' — a false statement about the platform. The malformed variant is instead cleared with 'That vendor type isn't one we can use, so it was cleared' and shows 17 vendors, so the two bad inputs get opposite treatments.
- **Copy: 'No photographers match all two filters'** — `http://localhost:3000/search?category=photography&city=Oakland&minRating=4.9`. Empty-state headline reads 'No photographers match all two filters' followed by 'The rating floor is the narrowest filter here.' — 'all two' is ungrammatical; the count template is being applied at n=2.
- **Non-numeric page and unknown sort fall back silently while other bad params announce they were cleared** — `http://localhost:3000/search?page=abc`. page=abc and sort=evil render 17 vendors with no notice, while page=2147483648 shows 'That page isn't one we can use, so it was cleared' and the combined bad URL lists 'date, rating, tags, page and price range' but omits the sort that was also replaced. Inconsistent with the screen's own rule of naming every dropped param.
- **Sub-lg SearchBar draft is reset by a new `value` object on every SearchScreen render, discarding a selection made while results are loading** — `apps/web/src/components/search/search-bar.tsx:131-134`. The bar reverts to the URL's values and the past-date alert (if shown) disappears without the customer doing anything; the change they made has to be redone.
- **Refine dropdown drafts are re-seeded from an unstable `value` object on every parent render, wiping a half-typed price range or tag selection when search results land** — `apps/web/src/components/ui/dropdown-range.tsx:99`. RefineBar passes `value={{ min: state.minPriceCents, max: state.maxPriceCents }}` (refine-bar.tsx:363) and `value={chosen.map((tag) => tag.id)}` (line 288) — a new object/array each render. The re-seed effect depends on `[open, value]`, so when SearchShell re-renders on `setResult`/`setIsLoading`/`setSearching(false)`, the effect runs again and `setDraft(value)` discards what the customer typed or ticked, without clo

#### Acceptance

1. The price filter matches what its label says, or the label says what it matches. One control, one contract.
2. A typed bound keeps its decimal: `999.99` is $999.99, not $99,999.
3. A half-rejected range says which bound survived, rather than announcing the whole range as cleared while the surviving bound still filters.
4. A past date in the URL is stripped before the request, not after — no 400, no console error.
5. An unknown but well-formed category slug renders the no-results state for that query, not the marketplace-empty copy.
6. Count copy reads `all two filters` correctly (`both filters`, or the number spelled the way `31-content-voice.md` sets).
7. A non-numeric page and an unknown sort are announced like every other cleared param.
8. A draft in the search bar or a refine dropdown survives results landing — the re-seed keys on value, not object identity.

#### Tests (required)

- [ ] A test per param class asserting both the request that goes out and the sentence that renders
- [ ] A price-semantics test at the DAO level

---

### #404: A restored draft overwrites the choice the customer just made

**Milestone:** M4.5 | **Priority:** P2 Medium | **Status:** Backlog | **Capabilities:** `core`
**Blocked by:** None

**Filed 2026-09-04 by the autonomous QA run's `/hunt-bugs` sweep.** Every finding
below was reproduced or traced by a read-only hunter or a browser pass, then put
through three adversarial skeptics with distinct lenses; only findings a majority
upheld are here.

`useSavedDraft` replaces the whole form object once it reads storage after
mount, so the date and guest count chosen on the vendor profile rail — or given
in the URL — are silently replaced by whatever was saved earlier. A URL-only
guest count is itself persisted as a 'draft'.

#### The findings this groups

- **Restored localStorage draft overwrites the date and guest count the customer just chose in the booking rail; a URL-only guest count is itself persisted as a 'draft'** — `apps/web/src/components/booking/booking-request-screen.tsx:142`. The page seeds form.eventDate/guestCount from the URL, then the restore effect runs `setForm(draft.restored.form)` and replaces the whole form — including eventDate and guestCount — with the stale draft. The request the customer reviews and sends carries the old date, not the one they just selected in the rail. Separately, isEmptyDraft excludes only eventDate, so arriving with `?guests=120` and typing nothing writes 
- **Restored draft overwrites the date and guest count the customer just chose on the vendor profile rail** — `apps/web/src/components/booking/booking-request-screen.tsx:142-149`. The form silently shows D1 and the old guest count instead of D2; the steel banner only says 'We kept what you had written.' A customer who does not re-check the date sends the request for the wrong day.
- **Restoring a saved booking-request draft overwrites the date and guest count the customer just chose in the URL** — `apps/web/src/components/booking/booking-request-screen.tsx:143-149`. `setForm(draft.restored.form)` replaces the whole form state, including `eventDate` and `guestCount` that were seeded from the URL, so the form silently shows date A. The restore banner says only "We kept what you had written"; nothing says the date changed. isEmptyDraft deliberately excludes the date from the emptiness test, but the restore path does not exclude it from the overwrite, so a customer who trusts the ra

#### Acceptance

1. A restored draft merges rather than replaces: a field the customer set on this navigation wins over the stored one.
2. Values that arrived only from the URL are not written back as a draft.
3. The 'we kept what you had written' line is accurate about what was kept.

#### Tests (required)

- [ ] A test that a rail-chosen date survives a stored draft with a different date

---

### #405: The storefront editor keeps unsaved work it did not save, and loses work it should have

**Milestone:** M4.5 | **Priority:** P1 High | **Status:** Backlog | **Capabilities:** `core`
**Blocked by:** None

**Filed 2026-09-04 by the autonomous QA run's `/hunt-bugs` sweep.** Every finding
below was reproduced or traced by a read-only hunter or a browser pass, then put
through three adversarial skeptics with distinct lenses; only findings a majority
upheld are here.

The vendor editor's save is two writes with no rollback, its post-save
snapshot is taken from the live form rather than what was sent, and its publish
switch reads unsaved state while toggling the saved row. Around it, the package
form and the portfolio manager both discard edits when their parent replaces a
list.

#### The findings this groups

- **Profile save runs two writes; when the tag write fails the profile write is silently kept and the form stays 'unsaved' forever (deterministic for any vendor holding an admin-hidden tag; 409-locks first-time creation)** — `apps/web/src/components/vendor-profile-form.tsx:557-602`. In (a) the vendor can never get a clean save: the profile row is updated on each attempt but `savedSnapshot`/`lastSavedAt`/`publishBlockers` are never updated, the bar keeps saying 'Unsaved changes', the leave-guard dialog claims 'Leaving now discards them' (false), and a red 'Tags' issue points at a control with nothing to change. In (b) the created profile exists server-side but the screen stays in creation mode an
- **'Visible to customers' switch is offered from unsaved form state but toggles the saved row — publish fails with a message contradicting the screen** — `apps/web/src/components/vendor-profile-form.tsx:443-446,618-636,1115-1148`. A red toast says the profile is incomplete while the form shows zero blockers and no field highlighted; nothing tells the vendor to Save first. Mirror case: clearing the bio in the form (unsaved) on a published storefront hides the switch and shows '1 thing left before you can publish' although the profile is live.
- **Post-save snapshot is taken from the live form, so text typed while 'Saving…' is marked as saved and the leave guard is disarmed** — `apps/web/src/components/vendor-profile-form.tsx:577-585`. `isDirty` is false, the bar reads 'Saved', `useUnsavedChangesGuard(false)` installs no beforeunload/click interception, and navigating away drops the extra text with no dialog; the stored row lacks it.
- **Profile form fields stay editable during save, and the saved snapshot is taken from the post-save form, so edits typed while the PUT is in flight are marked 'saved' and the unsaved-changes guard is disarmed** — `apps/web/src/components/vendor-profile-form.tsx:575`. send() posted `toPayload(form)` captured at click time, but on success `setForm(previous => { const next = {...previous, slug, tagIds}; setSavedSnapshot(JSON.stringify(next)); return next; })` snapshots the *current* form including the mid-flight keystrokes. `isDirty` becomes false, the status line reads the saved timestamp, and `useUnsavedChangesGuard(isDirty)` installs no beforeunload/click interception — so a link
- **PackageForm's reset effect fires whenever the manager replaces list objects, wiping unsaved edits on reorder or toggle** — `apps/web/src/components/packages/package-form.tsx:129-132`. The vendor's typed name/description/price/inclusions vanish with no prompt; the editor shows the last saved values under 'Edit package'.
- **Portfolio reorder is allowed while an upload is in flight; the reorder response replaces the client list and erases the photo the upload just appended (or the server 400s the reorder)** — `apps/web/src/components/portfolio/portfolio-manager.tsx:146`. Two orderings, both wrong. (a) POST /vendor/portfolio commits before PUT /vendor/portfolio/reorder is handled: the API's assertCompleteOrder rejects the id list as incomplete, the order snaps back and the vendor sees 'Could not save the new order.' for a reorder they did correctly. (b) The reorder is handled first but its response arrives after persist() appended the new row: `setItems(saved)` overwrites the list wit
- **Suggesting an existing tag at the per-category limit shows 'we've selected X for you' while the selection was refused** — `apps/web/src/components/tags/tag-suggestion-form.tsx:63-70,81-83`. Two contradictory toasts; the tag is not selected and the vendor is told it was.
- **Four mutation forms render ApiClientError.message verbatim, leaking 5xx and generic upstream shapes the project's userFacingError exists to suppress** — `apps/web/src/components/bookings/accepted-request.tsx:69`. The role="alert" shows 'Request failed' / 'Internal server error' / a client-internal schema message — all in UPSTREAM_ERROR_SHAPES that user-facing-error.ts pins as never-shown, and confirm-action.tsx:51-63 documents why (money paths are the ones most likely to 500). In the schema-drift case the refund has already been issued and the row cancelled, but router.refresh() is skipped, so the customer keeps seeing 'Cance

#### Acceptance

1. A profile save is one unit: if the tag write fails, the profile write does not silently stand and the form does not stay 'unsaved' forever.
2. The saved snapshot is what was sent, so text typed during the PUT is still unsaved afterwards and the leave guard stays armed.
3. Fields are not editable while the save is in flight, or the editor accounts for edits made during it.
4. `Visible to customers` reads the same state it writes: it is disabled while there are unsaved changes, or it saves first.
5. The package form does not reset on a parent list replacement that is not a different package.
6. Portfolio reorder is refused, or queued, while an upload is in flight.
7. Suggesting a tag at the per-category limit says the selection was refused rather than claiming it was made.
8. No mutation form renders `ApiClientError.message` verbatim — `web-route-boundaries.md` forbids it and four forms do it.

#### Tests (required)

- [ ] A test per behaviour; the two-write rollback needs a failing tag write with a succeeding profile write

---

### #406: Development defaults can reach a deployed build

**Milestone:** M-OPS | **Priority:** P0 Critical | **Status:** Backlog | **Capabilities:** `core` `auth` `storage` `stripe`
**Blocked by:** None

**Filed 2026-09-04 by the autonomous QA run's `/hunt-bugs` sweep.** Every finding
below was reproduced or traced by a read-only hunter or a browser pass, then put
through three adversarial skeptics with distinct lenses; only findings a majority
upheld are here.

Five variables carry a development default that a production build silently
accepts: the API boots on localhost and MinIO, the web bundle bakes
`http://localhost:4000` as its API origin, every stored-key image resolves to
nothing, checkout loads Stripe.js with an empty publishable key, and the Clerk
webhook guard is a no-op off Railway. This is the law in `CLAUDE.md` — *a
development default must never be able to reach production* — and it is
violated in every consumer.

#### The findings this groups

- **API boots in production on the localhost/MinIO development defaults for every per-environment variable that carries one** — `apps/api/src/config/env.ts:64`. The process starts, `/health` is 200 and nothing logs a warning, but: CORS `origin` is `['http://localhost:3000']` (server.ts:127-131) so every browser call from the real web origin fails preflight; `canonicalWebOrigin` hands Stripe `http://localhost:3000/vendor/payments/return` as the Connect return/refresh URL and every notification email links to localhost; uploads and the reap path go to `http://localhost:9000` w
- **Web build on Vercel silently bakes http://localhost:4000 as the API origin when NEXT_PUBLIC_API_URL is unset** — `apps/web/src/lib/api-client.ts:8`. Every browser call — search results, notifications, SSE ticket, messages, upload XHR, Stripe confirm — is sent to the visitor's own machine on port 4000 and fails; every server-side loader in the Vercel function dials its own localhost:4000 and hits ECONNREFUSED, so `requireCurrentUser`, `/`, `/search` and `/vendors/[slug]` land on the error boundary. The CSP `connect-src` names `http://localhost:4000` (next.config.t
- **Every stored-key image resolves to nothing when NEXT_PUBLIC_S3_PUBLIC_URL is missing from a production build, with no error** — `apps/web/src/lib/wire-schemas.ts:55`. `resolveImageUrl(undefined, key)` returns `null` by design (packages/shared/src/utils/index.ts:419-423), so every uploaded photo on /search cards, /vendors/[slug], the vendor's own portfolio manager and the header avatar renders as the empty-image state. Uploads still succeed (the API's `S3_PUBLIC_URL` is separate), so a vendor uploads a photo, gets a 201, and never sees it — indistinguishable from 'no photos yet'. N
- **Checkout loads Stripe.js with an empty publishable key and the build gate does not require it** — `apps/web/src/components/checkout/checkout-screen.tsx:25`. The server page opens a real PaymentIntent (openCheckout succeeds, money-side state is created) and renders `CheckoutScreen`; Stripe.js rejects the `''` key, `Elements` receives a rejected promise and the checkout client crashes to the error boundary. The customer cannot pay, the build that shipped this was green, and `env.test.ts:76-79` asserts the key is *not* required ('does not require a capability the web app ha
- **Checkout falls back to an empty Stripe publishable key; the web build never validates the Stripe capability, so a misconfigured deploy ships a checkout with no card field and a Pay button that does nothing** — `apps/web/src/components/checkout/checkout-screen.tsx:25`. `loadStripe('')` rejects (Stripe.js refuses an empty key), `useStripe()` stays null, PaymentElement never mounts, and the submit button — disabled only by `paying` (line 280) — is enabled; `pay` returns early at line 141 on `!stripe`, so clicking does nothing, with no on-screen error. The customer sees 'Confirm and pay', a blank card area and a dead 'Pay $X — confirm <date>' button; the request stays accepted/unpaid.
- **Clerk webhook endpoint guard is a no-op on every platform except Railway, so the localhost default passes a deployment boot** — `apps/api/src/modules/webhooks/clerk.endpoint-guard.ts:100`. The boot-time check that exists because 'a webhook pointed elsewhere fails silently' (registry.ts:414-415) does not run on the two platforms this repository actually deploys to today — memory records the Railway service as removed. A relay or stale endpoint on the production Clerk app goes undetected: `user.updated` / `user.deleted` never arrive, deleted Clerk accounts keep a live `users` row and a working session, a

#### Acceptance

1. A production target refuses to boot, or refuses to build, when a per-environment variable is still on its development default. The registry already knows which those are.
2. The web build fails rather than baking `localhost` into a bundle.
3. The Stripe capability is validated by the web build, so a deploy cannot ship a checkout with no card field.
4. The Clerk webhook endpoint guard runs on every platform, not only where `RAILWAY_PUBLIC_DOMAIN` happens to be set.
5. Each of these is asserted by a test that sets `NODE_ENV=production` and expects the throw.

#### Tests (required)

- [ ] One test per variable class, asserting the production branch throws — a default is exactly the code no test covers

---

### #407: Reads hand back more than the caller is entitled to

**Milestone:** M4.5 | **Priority:** P1 High | **Status:** Backlog | **Capabilities:** `core` `storage`
**Blocked by:** None

**Filed 2026-09-04 by the autonomous QA run's `/hunt-bugs` sweep.** Every finding
below was reproduced or traced by a read-only hunter or a browser pass, then put
through three adversarial skeptics with distinct lenses; only findings a majority
upheld are here.

Three reads return fields their audience should not have: a public endpoint
serves the vendor's private per-date note, a customer-facing booking read
carries the platform fee, the vendor payout split and the Stripe transfer id,
and any authenticated user can pin another vendor's storage object by naming
its key, which turns the owner's delete into a no-op.

#### The findings this groups

- **Public availability endpoint serves the vendor's private per-date note to anyone** — `apps/api/src/modules/vendors/vendors.routes.ts:118`. The note is returned verbatim on a public, unguarded route. getPublicVendorAvailability (vendor-profile.service.ts:82-91) only trims *past* rows and its own comment says the reason is that 'every past row returned here would carry the vendor's private note ... over a public endpoint' — but findAvailabilityInRange (availability.dao.ts:70) is a bare select() over every column and the response schema availabilitySchema 
- **Customer-facing booking reads return the platform fee, vendor payout split and Stripe transfer id** — `apps/api/src/modules/booking-requests/booking-requests.routes.ts:165`. listBookings (booking-requests.service.ts:937-943) and reconcileBooking (payments.service.ts:394,416) spread the full bookings row through bookingWithContextSchema (schemas/index.ts:765-796), which carries platformFeeCents, vendorPayoutCents, stripePaymentIntentId and stripeTransferId. payments.service.ts:193-196 states the platform's commission 'is none of the customer's business', yet the customer can read exactly 
- **Any authenticated user can pin another vendor's storage object by referencing its key, making the owner's delete a no-op** — `apps/api/src/modules/portfolio/portfolio.dao.ts:216`. removePortfolioItem -> reapObjects passes ownsObjectKey for B, but findUnreferencedKeys (portfolio.dao.ts:216-258) counts A's users.avatar_url / portfolio_items row as a live reference and skips storage.remove. B's photo stays served indefinitely at its public URL and, in the vendor-A variant, is displayed on A's public storefront as A's own work. B has no way to remove it; the DAO comment even notes that 'any authen

#### Acceptance

1. The public availability response is projected through a schema without `note`.
2. Customer-facing booking reads carry no platform fee, payout split or Stripe transfer id.
3. An object key can only be referenced by the account that owns its prefix; a write naming someone else's key is refused.
4. Each is pinned by a test asserting the field is absent rather than that the route answers 200.

#### Tests (required)

- [ ] A public-route test asserting `note` is absent
- [ ] A customer read test asserting the three money fields are absent
- [ ] An ownership test for `imageUrl`/`avatarUrl` writes naming a foreign key

---

### #408: A legal request body 500s, and four reads have no ceiling

**Milestone:** M4.5 | **Priority:** P1 High | **Status:** Backlog | **Capabilities:** `core` `email`
**Blocked by:** None

**Filed 2026-09-04 by the autonomous QA run's `/hunt-bugs` sweep.** Every finding
below was reproduced or traced by a read-only hunter or a browser pass, then put
through three adversarial skeptics with distinct lenses; only findings a majority
upheld are here.

Two classes with the same shape: a value the schema accepts is wider than the
column that stores it, so an ordinary input answers 500 after the state has
already moved; and several reads have no limit, one of which fans out an
unbounded `Promise.all` that ends in an email send.

#### The findings this groups

- **Notification title built from a 200-char business name overflows notifications.title varchar(200), 500-ing quote/decline after the status has already moved and silently dropping the booking-confirmed notification** — `apps/api/src/modules/booking-requests/booking-requests.service.ts:846`. transitionRequest runs applyTransition (line 641) and syncHeldDate (648) first, then announce (650) → notifyParty → recordNotification → insertNotification with no try/catch and no truncation; Postgres rejects the row (`value too long for type character varying(200)`), the error is not an AppError, and the vendor gets an opaque 500 while the request is already `quoted`/`declined` — no in-app row, no email to the cust
- **Notification `title` is `varchar(200)` but three titles interpolate a 200-char business name, so the write fails after the state transition has already committed** — `apps/api/src/modules/booking-requests/booking-requests.service.ts:846`. Quote/decline: `applyTransition` (:641) and `syncHeldDate` (:648) are separate statements already committed when `announce` throws, so the request is `quoted`/`declined` but the vendor gets an opaque 500, the customer gets no notification or email, and a retry answers 409 `INVALID_STATE_TRANSITION`. Payment: `confirmBooking` has committed the booking and the `booked` date when `announceBooking` throws; the webhook an
- **Category-prefixed tag slug can exceed tags.slug varchar(100) for a legal 100-char suggestion, so approve and rename 500 instead of 400** — `apps/api/src/modules/admin/admin.service.ts:563`. tagSlug returns `${category}-${generateSlug(name)}` — up to 8 + 1 + 100 = 109 characters — and insertTag (inside the transaction at admin.service.ts:729) or updateTagRow throws `value too long for type character varying(100)`. The transaction rolls back and the admin gets an opaque INTERNAL_ERROR; the suggestion stays `pending` in the queue with no way to approve it, and nothing tells the operator why.
- **Vendor slug collision suffix pushes a 200-char slug past vendor_profiles.slug varchar(200)** — `apps/api/src/modules/vendors/vendors.service.ts:125`. The candidate is 201–202 characters; slugExists compares fine, then insertVendorProfile throws `value too long for type character varying(200)` — an opaque 500 rather than the 409 `That business name is already taken` the loop is written to produce. Even if the column accepted it, the response would fail `slugSchema.max(MAX_SLUG_LENGTH)` serialization.
- **displayOrder accepted up to 2^53 but stored in int4 — a legal body yields a 500 on package/portfolio/tag writes** — `packages/shared/src/schemas/index.ts:519`. packages.service.ts:63/109 and portfolio.service.ts:49 pass the value straight to the insert/update; Postgres raises `value "2147483648" is out of range for type integer`, which is not an AppError, so the caller gets an opaque 500 INTERNAL_ERROR instead of the 400 every other bounded field returns. Every other integer input in the schema file (guestCount, priceCents, yearsInBusiness, serviceRadiusKm, page) carries a 
- **Four list endpoints return every row the caller has ever had with no limit or pagination** — `apps/api/src/modules/booking-requests/booking-requests.dao.ts:456`. Unlike `/notifications`, `/conversations/:id/messages`, `/vendors/:slug/reviews` and every admin list — all of which page through `paginationQuerySchema` — these four accept no `page`/`pageSize` and apply no `LIMIT`, so the response body, the `bookings ⋈ booking_requests` join (`findBookings`) and the three-way `reviews ⋈ bookings ⋈ vendor_profiles` join (`findCustomerReviews`) all grow without bound over an account'
- **GET /booking-requests reads the actor's entire request history with no limit and ages every expired row in an unbounded Promise.all, each chain ending in an email send** — `apps/api/src/modules/booking-requests/booking-requests.service.ts:565`. `findRequests` (`booking-requests.dao.ts:109-113`) has no `LIMIT`, so every row the actor ever had is loaded and serialised on each load; the payload grows forever. Worse, `rows.map(ageIfExpired)` under `Promise.all` starts all N expiry chains at once with no concurrency cap; each chain (`:187-234`) runs `applyTransition` UPDATE, `statusesOnDate` SELECT, `setHeldDate` DELETE, `insertNotification`, `findUserEmail` SEL
- **Resend fetch has no timeout and is awaited inline on every notification-bearing request, so an email stall hangs booking actions and starves request reads** — `apps/api/src/lib/email.ts:63`. `fetch(RESEND_API, …)` carries no AbortSignal/timeout, so the await inside sendNotificationEmail blocks until undici's default ~300s headers timeout. Browser calls deliberately have no deadline (api-client.ts:179), so the customer's 'Sending…' / vendor's Accept button sits busy for minutes with no error. Server-side reads do have the 8s deadline: a vendor dashboard whose list read expires a request waits on that requ
- **Post-commit notification writes are unguarded, so a failure after the state change returns 5xx for work that succeeded and (for the webhook) permanently loses the booking_confirmed notifications** — `apps/api/src/modules/payments/payments.service.ts:287`. Webhook: 500 to Stripe, Stripe retries, the retry short-circuits at `existing` (:232-236) → 'already-booked', so neither party ever receives the booking_confirmed row or email and no retry can repair it. Reconcile path: the /confirmed page throws to the error boundary although the booking exists (reload works). Messages: the row is inserted, the route 500s, messages-screen shows 'That message did not send. Your text 
- **`users.total/completed/cancelled_bookings_count` are documented as derived but have no writer anywhere, so every customer is permanently a 0-booking "New member"** — `packages/db/src/schema/users.ts:47-51`. `GET /customers/:customerId/profile` tells every vendor the customer has 0 total / 0 completed / 0 cancelled bookings and `completionRate: null` regardless of history; `/customer/profile` (`apps/web/src/app/customer/profile/page.tsx:62-64,93`) shows the "New member" badge and "0 bookings" to a customer with ten completed events; `/admin/customers` lists `totalBookingsCount` 0 for everyone. A column the schema comment

#### Acceptance

1. Every schema bound agrees with its column: notification title against a 200-char business name, tag slug against its prefix, vendor slug against its collision suffix, `displayOrder` against int4.
2. A value that would overflow answers 400 before the transition commits, not 500 after it.
3. The four unbounded list endpoints paginate, and the expiry sweep is bounded and does not send email inline.
4. The Resend call carries a timeout and is not awaited on the request path.
5. A post-commit notification failure does not turn a succeeded write into a 5xx, and is not silently lost.
6. `users.total/completed/cancelled_bookings_count` either get a writer or are removed and derived at read time — every customer currently reads as a 0-booking 'New member'.

#### Tests (required)

- [ ] A test per bound, using the longest legal value
- [ ] A test that the expiry sweep is bounded
- [ ] A test that a failed notification write does not fail the request

---

### #409: The server's UTC day stands in for the viewer's day

**Milestone:** M4.5 | **Priority:** P2 Medium | **Status:** Backlog | **Capabilities:** `core`
**Blocked by:** None

**Filed 2026-09-04 by the autonomous QA run's `/hunt-bugs` sweep.** Every finding
below was reproduced or traced by a read-only hunter or a browser pass, then put
through three adversarial skeptics with distinct lenses; only findings a majority
upheld are here.

`todayDateString()` says in its own contract that it is only meaningful on the
client, and three server components call it. West of UTC a vendor's current day
renders as already past on the availability calendar and the dashboard's 'This
week'; east of UTC yesterday stays pickable on the booking request form. #391
fixed the dashboard's earnings month the same way and its approach is the
precedent.

#### The findings this groups

- **Calendar 'today' and dashboard 'This week' use the UTC day, so a vendor in the evening (west of UTC) sees their current day rendered as already past** — `http://localhost:3000/vendor/availability and http://localhost:3000/vendor/dashboard (today from toDateString(new Date()) = UTC date)`. The calendar cell for 2026-09-03 is labelled '… in the past' and the sidebar 'Today' outline sits on Sep 4; the dashboard 'This week' rail starts at 'Friday, September 4'. A PUT blocking 2026-09-03 returned 200 but wrote nothing (treated as past). For any US vendor after ~19:00–20:00 local, the day they are still living in is uneditable and shown as history — the date effectively moves a day. Expected: 'today' anchor
- **Booking-request date floor is the server's day, so the customer's own current day is greyed out (west of UTC) or yesterday stays pickable (east of UTC)** — `apps/web/src/app/vendors/[slug]/request/page.tsx:66 (also apps/web/src/app/vendors/[slug]/page.tsx:176)`. West of UTC the DateDropdown treats 09-03 as past and blocks it with 'missing/past date' although `isPastDate`'s contract (utils:311-318) is that 'an event happening today is still bookable' and the API would accept it (`isUniversallyPastDate`, booking-requests.service.ts:394). East of UTC the form offers 09-03 — already yesterday for the customer — and the API accepts the request (09-03 is not universally past at 22

#### Acceptance

1. Every 'today' a viewer sees is the viewer's today, anchored the way #391 anchors the earnings month.
2. The availability calendar, the dashboard week strip and the booking-request date floor all agree with each other and with the browser.
3. A test pins the behaviour under a western and an eastern `TZ`.

#### Tests (required)

- [ ] Tests run under two timezones, asserting the same rendered day

---

### #410: Signing in through returnTo lands on a blank page

**Milestone:** M4.5 | **Priority:** P1 High | **Status:** Backlog | **Capabilities:** `core` `auth`
**Blocked by:** None

**Filed 2026-09-04 by the autonomous QA run's `/hunt-bugs` sweep.** Every finding
below was reproduced or traced by a read-only hunter or a browser pass, then put
through three adversarial skeptics with distinct lenses; only findings a majority
upheld are here.

Three reproductions of one defect: a `returnTo` pointing at a route the
signed-in role may not see leaves the browser on a blank page with signed-out
chrome, rather than redirecting to somewhere that role can be. A vendor signing
in from a booking request form, a vendor sent to `/customer/profile`, and a
customer sent to `/vendor/dashboard` all hit it.

#### The findings this groups

- **Vendor signing in through the request form's returnTo lands on a blank page instead of the dashboard** — `http://localhost:3000/vendors/e2e-test-studio/request (after /sign-in?returnTo=%2Fvendors%2Fe2e-test-studio%2Frequest)`. The vendor is signed in (window.Clerk.user is the vendor) but sees an empty page at the request URL: #main has 0 children, no h1, and the header still shows 'Sign in' / 'Sign up'. Nothing on screen tells them what happened or where to go. A fresh navigation to the same URL afterwards redirects to /vendor/dashboard correctly, so the server-side redirect() in the page is not being honoured on the post-sign-in client re
- **Vendor signing in through returnTo=/customer/profile is left on a blank /customer/profile page** — `http://localhost:3000/sign-in?returnTo=%2Fcustomer%2Fprofile`. The vendor lands on /customer/profile with the header rendered and an empty <main> (innerHTML 17 chars, no text, no skeleton, no aria-busy) and stays there; sampled once per second for 8 s, then again at 6 s on a second run, URL never changed. Title is 'Your profile · Orla'. A manual reload sends them to /vendor/dashboard, and a direct visit to /customer/profile as vendor redirects to /vendor/dashboard immediately, s
- **Signing in as a non-vendor through /sign-in?returnTo=/vendor/dashboard leaves a blank page with a signed-out header** — `http://localhost:3000/sign-in?returnTo=%2Fvendor%2Fdashboard -> http://localhost:3000/vendor/dashboard`. After sign-in the URL is /vendor/dashboard, document.title is 'Your business · Orla', <main> is empty (innerHTML length 17), and the header shows 'Sign in' / 'Sign up' links even though window.Clerk.user is set with role 'customer' (resp. 'admin'). Still blank after 3–5 s. A subsequent manual navigation to /vendor/dashboard redirects correctly (customer -> /bookings, admin -> /admin), so only the post-sign-in landing

#### Acceptance

1. A `returnTo` the authenticated role cannot use redirects to that role's home, not to a blank render.
2. The header renders its signed-in variant on that first navigation.
3. The redirect target is computed from the role the session actually has, in one place.

#### Tests (required)

- [ ] A test per role/target pair asserting the landing route and that the page renders

---

### #411: Accessibility: dialogs, calendars and composite controls are unreachable or unannounced

**Milestone:** M4.5 | **Priority:** P1 High | **Status:** Backlog | **Capabilities:** `core`
**Blocked by:** None

**Filed 2026-09-04 by the autonomous QA run's `/hunt-bugs` sweep.** Every finding
below was reproduced or traced by a read-only hunter or a browser pass, then put
through three adversarial skeptics with distinct lenses; only findings a majority
upheld are here.

The static accessibility hunt found, beyond the focus-ring work #383 owns and
the silent-submit work #388 closed:

- **Portfolio lightbox** (`portfolio-pane.tsx:108-160`) is `role="dialog"
  aria-modal="true"` but nothing focuses it, nothing traps Tab and nothing
  restores focus — a keyboard user tabs the page underneath the scrim.
- **Read-only availability calendar** (`availability-pane.tsx:60-75`) states
  free/booked by colour alone, on `text-stone-400` (~1.7:1) with the status
  only in `title=`.
- **Date picker** (`ui/dropdown-date.tsx:213-259`) claims `role="grid"` with
  `gridcell` buttons and no rows, no arrow keys and no roving tabindex, so
  every day is a tab stop while the role promises otherwise; day names are raw
  ISO strings.
- **Vendor availability grid** (`availability-calendar.tsx:485-492`) has empty
  `<th>` names and ISO cell labels.
- **Nested `<main>` landmarks** on the request detail, checkout and confirmed
  pages, inside the layout's own `main#main` — which is also why frame `06`'s
  gradient stops short of the viewport.
- **Image upload** (`image-upload.tsx:315-323`) paints the focus ring on a
  transparent input, so it is invisible on all three photo fields.
- **Unnamed inputs**: three `CommandInput`s in the tag pickers, the admin
  filter search, the message composer (placeholder only).
- **Announcements**: the messages send failure, the search skeleton, the
  thread's incoming messages.
- **Avatar** repeats the adjacent name at seven call sites; `aria-pressed` on
  links in two admin pages; heading order skips h2 on the vendor profile,
  search results and availability.

#### The findings this groups

- **Two nested <main> landmarks on the request detail and checkout pages** — `http://localhost:3000/bookings/ac475f65-526a-4856-9cbe-dd8979691a74 and http://localhost:3000/bookings/ac475f65-526a-4856-9cbe-dd8979691a74/checkout`. Invalid landmark structure: a <main> inside #main. Screen-reader landmark navigation announces two main regions, and any role=main locator is ambiguous (Playwright's 'main' locator threw a strict-mode violation). The hub (/bookings) and the request form have exactly one.

#### Acceptance

1. Every item above is fixed or explicitly ruled out in the ticket's notes with the reason.
2. The lightbox focuses, traps and restores; the date picker either drops the grid role or implements the grid keyboard model; every control has an accessible name; every status message is in a live region.
3. No page renders a second `<main>`.
4. Colour is never the only carrier of state.
5. A source-level guard covers what a guard can reach (nested landmarks, missing `aria-label` on icon-only buttons), and the rest is verified in the browser.

#### Tests (required)

- [ ] A landmark guard test
- [ ] RTL tests for the lightbox focus contract and the date picker's keyboard model

---

### #412: Customer profile and storefront CTAs report things that are not so

**Milestone:** M4.5 | **Priority:** P2 Medium | **Status:** Backlog | **Capabilities:** `core`
**Blocked by:** None

**Filed 2026-09-04 by the autonomous QA run's `/hunt-bugs` sweep.** Every finding
below was reproduced or traced by a read-only hunter or a browser pass, then put
through three adversarial skeptics with distinct lenses; only findings a majority
upheld are here.

Seven small correctness and copy defects on the customer profile and the public
storefront, each of which tells the reader something untrue.

#### The findings this groups

- **Guest-count decimals and exponent notation are silently truncated and saved under a 'Profile saved' toast** — `http://localhost:3000/customer/profile (Guests, from / Guests, up to)`. No validation message. PUT /users/me is sent with typicalGuestCountMin: 2 (for 2.7) and typicalGuestCountMax: 1 (for 1e21), the toast says 'Profile saved', and the inputs keep showing 2.7 / 1e21 — what the user sees and what is stored disagree. 1e21 becoming 1 collapses the range to 1–1. By contrast 0, -5 and 100001 are refused client-side (no PUT).
- **Sidebar 'My bookings' badge shows 9 on /customer/profile but 7 on /bookings for the same account** — `http://localhost:3000/customer/profile and http://localhost:3000/bookings (BookingsSidebar)`. The same navigation element contradicts itself between the two pages it is shared by. /bookings shows 7 (Upcoming 3 + History 4) and the DB has 7 booking_requests and 2 bookings for this customer; the profile page shows 9, i.e. requests plus bookings summed so accepted requests are counted twice.
- **Validation failure surfaces the bare Zod default 'Invalid input' with no field named** — `http://localhost:3000/customer/profile (Save changes error line)`. The request is correctly not sent, but the only text shown is 'Invalid input'; the offending field is not named and is not marked aria-invalid (the bio counter does read 301 / 300, the guest field has no such cue). Guest range inversion, by contrast, gets a proper message ('The smaller number goes first — swap them and this will save.') and a disabled button.
- **Unsaved profile edits are discarded without a prompt on navigation** — `http://localhost:3000/customer/profile`. No confirm dialog and no beforeunload prompt in either case; pressing Back returns to the last saved value and the draft is gone.
- **Single 'Profile photo' field carries multi-file hint copy** — `http://localhost:3000/customer/profile (Profile photo help text)`. Hint reads 'JPG or PNG · 12 MB each · min 1200px wide · 20 files per upload' for a field that stores exactly one image (the chooser and the rejection copy both treat it as one file: 'JPG or PNG · under 12 MB · at least 1200px wide').
- **Vendor account can open a conversation from a storefront while the same account is refused 'Request booking'; CTAs also shown on the vendor's own storefront** — `http://localhost:3000/vendors/kessler-co`. 'Send a message' navigates to /messages?conversation=5f01314a-cf56-4948-9ede-52358a522c2a and inserts a conversations row with the vendor-role user as customer_id. 'Request booking' for the same account silently redirects to /vendor/dashboard with no explanation. The vendor's own storefront still renders 'Request booking' and 'Send a message' against themselves. The role gate is applied to one CTA and not the other, 
- **Request detail page prints the event date as raw ISO text** — `http://localhost:3000/bookings/ac475f65-526a-4856-9cbe-dd8979691a74`. The summary line reads 'Wedding · 2026-10-20 · <venue>' while the form, the review step and the hub render the same date as 'October 20, 2026' / 'Tue, Oct 20'. Inconsistent copy on the one page the customer lands on from the hub.

#### Acceptance

1. A decimal or exponent guest count is refused rather than truncated under a 'Profile saved' toast.
2. The `My bookings` badge is one number, computed once.
3. A validation failure names the field rather than rendering Zod's `Invalid input`.
4. Navigating away from unsaved profile edits prompts, as the editor does.
5. The single-photo field does not carry multi-file hint copy.
6. A vendor account sees the same answer for `Send a message` as for `Request booking`, and neither CTA is offered on the vendor's own storefront.
7. The request detail page formats the event date rather than printing the ISO string.

#### Tests (required)

- [ ] A test per item

---

### #413: Frame `06 Booking confirmed` fails parity on five axes

**Milestone:** M4.5 | **Priority:** P2 Medium | **Status:** Backlog | **Capabilities:** `core`
**Blocked by:** None

**Filed 2026-09-04 by #386's parity pass**, measured at 1440x900 signed in as
the E2E customer on a real confirmed booking. #386 changed one colour on this
screen; the pass around that change measured the whole frame for the first
time. Everything below is in
`apps/web/src/components/bookings/booking-confirmed.tsx`.

**Not in scope, do not re-file:** the `sage-600` label colour is a *recorded*
deviation from the frame's `#3A4D33` (`01-foundations.md:94-104`), verified
correct at 7.38:1. The occasion sub-line's shape is #394's, already closed.

#### One fix, three symptoms — the nested `<main>`

`booking-confirmed.tsx:79` renders `<main aria-label="Booking confirmed"
class="relative flex flex-1 flex-col …">` **inside** the layout's
`<main id="main" class="flex-1">`. `flex-1` resolves against a parent that is
not a flex container, so the element sizes to content:

1. The sage gradient measures `[0, 64, 1440, 514.875]`. Sampled off the
   rendered PNG, the band runs y 64 → 578 and **321px of bare `stone-50`**
   sits below it. The frame draws the gradient full-bleed with **no header at
   all**; `15-confirmed.md` says "Full-bleed".
2. All four cross-sell chips' focus outlines are **clipped 4px**: the chip
   bottom is 578.875, the outline's outer bottom is 582.875, and the nearest
   `overflow:hidden` ancestor ends at 578.875. The ring renders as an open "U".
3. `justify-center` has no slack, so the check circle sits flush at y=64 where
   the frame gives ~160px of air.

There are also **two `<main>` landmarks**, so `Skip to content` lands on the
layout wrapper rather than the celebration. That instance belongs here; the
other two (request detail, checkout) are #411's and #395's.

#### Contrast over the gradient — four failures, and there is no scrim

Measured by decoding the rendered PNG, sampling the composited backdrop pixel
under each text box, and compositing the alpha foreground over it.

| Text | Ratio | |
| --- | --- | --- |
| Sub-line, `stone-0/88` at 13.5px/400 | **3.58:1** | fails — normal-size body text |
| `Still need someone for …`, `stone-0/75` 12.5px/400 | **3.40:1** | fails |
| Four cross-sell chips, `stone-0` 12.5px/600 over `white/14` | **3.72–3.98:1** | fails — 12.5px is not large text at any weight |
| `<h1>` 48px/400 | 4.04:1 | fails the plan's flat 4.5:1; passes WCAG large-text 3:1 |

The `✓` glyph at 3.06:1 is `aria-hidden` and decorative — exempt, do not
"fix" it. Everything inside the white card passes (15.96:1, 5.75:1).

**This needs the same ruling #385 is holding for the sign-up panel**: the plan
states a flat 4.5:1 with no large-text carve-out, and this screen is white text
on a mid-sage field by design. Either the plan grows a carve-out, or the
gradient darkens, or the type sizes go up. Do not invent one.

#### Type and copy

| | Frame | Live |
| --- | --- | --- |
| Sub-line | 16px (`text-lg`) | **13.5px** (`text-base`) |
| Both buttons | 14px | **12.5px** (`text-sm`) |
| Card sub-line | 12px | 11px (`text-xs`) |
| `PAID` / `BOOKING` | 600, `.05em`, uppercase | **400, normal, sentence case** — `text-label` is a size-only token; the three companion utilities are absent |
| Sub-line tail | `…two weeks out to plan the timeline.` | `…before the day to plan the details.` — **reworded**; the words are the design |
| Booking id | `ORL-4821`, 66px wide | a raw UUID, **281px wide**, pushing the card to 730.63px against ~600 |

#### Style

The avatar is a **64px circle** (`Avatar size="lg"`); the frame draws a **50px
square at `11px` radius**. Correct and not to be touched: card radius 18px,
padding `18px 22px`, the two decorative circles, chip shape, gradient stops
(`#7A9468 / #5E7A4E / #49613D`, exact).

#### Acceptance

1. The gradient fills the viewport as the frame draws it, and no page renders
   two `<main>` landmarks.
2. No focus ring on this screen is clipped.
3. Every text node over the gradient meets whatever ratio the contrast ruling
   settles, with the decorative glyph exempt.
4. The four type sizes and the micro-label treatment match the frame.
5. The sub-line reads the frame's words.
6. The avatar is the frame's shape and size.
7. `parity-checker` returns MATCH on all six axes, and the ruling in 3 is
   recorded in the plan rather than assumed.

#### Tests (required)

- [ ] A landmark test asserting one `<main>` per page, covering this route
- [ ] A test pinning the four type sizes and the micro-label utilities
- [ ] The sub-line's exact string

---
