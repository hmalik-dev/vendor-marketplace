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

`Superseded` is a fourth terminal value, added 2026-08-29 by the backlog consolidation. It means the ticket's work now lives in another ticket, named in its Notes. The row and its detail section stay on purpose — they carry the measurements and the reasoning the replacement was built from, and `tickets.ts` keeps its registry row so `pnpm preflight --ticket <old number>` still gates correctly for anyone working from an older branch or commit message. **A `Superseded` ticket is never worked directly.**

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
| 46 | Clerk webhooks point at a CLI relay, not the API | P1.5 | M4.5 | P1 High | **Superseded** | main | Secret rotation (Clerk dashboard) | `core` `auth` | **Superseded 2026-08-30 by the second backlog consolidation — merged into #362**, because one person, one sitting, at the provider consoles. The row and its detail section stay: they carry the measurements #362 was built from, and `pnpm preflight --ticket 46` still gates for anyone on an older branch. **Never worked directly.** Code shipped `34cd28c`, `ed41aed`. Scope 1 (reconciliation) and 2 (guard) are **Done**; scope 3 (**rotate `CLERK_WEBHOOK_SECRET`**, leaked into a chat transcript 2026-08-27) needs a human in the Clerk dashboard and is the only thing left. The API now refuses to boot when its Clerk endpoint is a relay, a foreign origin, the wrong route, or plain HTTP — silent off a platform, since a relay is the correct local setup. `CLERK_WEBHOOK_ENDPOINT` added to the env registry and set on Railway. Reconciliation routes corrections through the webhook handler itself, so deletion behaves once, and skips `seed_mkt_…` rows Clerk never issued — the first dry run would otherwise have retired 50 of 54 rows and taken the seeded marketplace down. Production dry run: **4 real users, 0 drift, 0 retirements, 50 skipped**, so the write-mode run is a proven no-op; `pnpm reconcile:clerk [--dry-run]` when wanted |
| 62 | Stripe public business name is "VendYou", not Orla | P1.5 | M4.5 | P1 High | **Superseded** | — | Stripe dashboard | `core` `stripe` | **Superseded 2026-08-30 by the second backlog consolidation — merged into #362**, because one person, one sitting, at the provider consoles. The row and its detail section stay: they carry the measurements #362 was built from, and `pnpm preflight --ticket 62` still gates for anyone on an older branch. **Never worked directly.** **Found 2026-08-28** from `stripe config --list` during #9 setup: `display_name = 'VendYou'`. Stripe renders the platform's public business name on the **hosted Connect Express onboarding page** (#9), on Checkout (#10), and as the statement descriptor on cardholders' statements. Harmless in sandbox, wrong in front of a real vendor. **A #19 prerequisite** — only the account holder can change it |
| 19 | Production Environment Provisioning | P1.5 | M4.5 | P0 Critical | **Superseded** | — | #17 | all | **Superseded 2026-08-30 by the second backlog consolidation — merged into #362**, because one person, one sitting, at the provider consoles. The row and its detail section stay: they carry the measurements #362 was built from, and `pnpm preflight --ticket 19` still gates for anyone on an older branch. **Never worked directly.** **BLOCKED on a human** — external accounts only, no repo code. Parallel with #18; schedule after #10  **Deferred 2026-08-28:** the ticket says so itself — "almost entirely external account configuration rather than repository code", with a provisioned environment rather than a diff as its deliverable. Every value must be newly minted in Clerk, Stripe, R2 and Resend by the account holder; nothing here can be produced autonomously |
| 20 | Deploy Pipeline | P1.5 | M4.5 | P0 Critical | Backlog | — | #19 | `core` | **Blockers corrected 2026-08-30: #18 and #30 are Done; only #19 remains.**  First production deploy |
| 11 | Transactional Email Notifications | P3 | M6 | P2 Medium | Backlog | — | None | `core` `auth` `email` | **Unblocked 2026-08-30 by lane 329 — the key is in place.** `pnpm preflight --ticket 11` now passes **35 of 35**, `RESEND_API_KEY — set, shape ok`. It had been `Deferred — needs a human` since 2026-08-28 on a placeholder key that has since been supplied, so the row was holding a solved blocker. The project's own rule is that a ticket does not start until the gate passes, and the acceptance requires verifying that each row of the event table actually sends. **Unblocks with one key** from https://resend.com/api-keys. Everything it hangs off is ready: `NOTIFICATION_TYPES` is the shared enum, and #7/#8 already emit every event at a single call site, so email attaches there without a second source of truth |
| 15 | Admin Portal | P3 | M6 | P1 High | **Backlog** | — | **None** | `core` `auth` | **Split 2026-08-30: the Sentry half is now #353, and this row is the admin portal alone.** The `sentry` capability moves with it, so `pnpm preflight --ticket 15` no longer fails on the placeholder `SENTRY_DSN` — the admin portal reaches no external service beyond Clerk. Sentry is launch-prep work: it needs a DSN only the account holder can mint, and it catches errors in an environment that does not exist until #19. **#14 landed 2026-08-30 (`5f2a747`), so the ticket blocker is clear — but the *gate* is not. `pnpm preflight --ticket 15` fails 1 of 34 on `SENTRY_DSN`, still the placeholder. Unlike #14, the `sentry` capability here is real: the ticket integrates `@sentry/node` and `@sentry/nextjs`, so narrowing the row is not the unblock and a human must supply the DSN. **The admin portal half needs no Sentry and is independently workable** — split it out if the DSN stays absent, rather than leaving a P1 feature parked behind a key. Found on run 2 of an unattended batch by running the gate, not by reading the board.**  Frame `22`. **MVP-minimal** — `/suspended` already exists and implies suspension, so something must be able to suspend. Preflight enforces `sentry` |
| **353** | **[PRE-LAUNCH] Sentry integration** | P3 | M6 | **P2 Medium** | **Deferred — needs a human** | — | **`SENTRY_DSN` (Sentry dashboard)** | `core` `sentry` | **Filed 2026-08-30, carved out of #15.** The two Sentry bullets in #15 were holding a P1 admin portal behind a credential. Unlike #14, the `sentry` capability here is real — the ticket installs `@sentry/node` and `@sentry/nextjs` — so narrowing is not the unblock and a human must supply the DSN. **Launch-prep block, with #19, #62, #46 and #206**: error tracking catches errors in an environment that does not exist until #19 provisions it, so doing it before then instruments nothing. |
| **206** | **[PLATFORM] Upgrade production to Launch and give it a real recovery story** | **INFRA** | **M-OPS** | **P3 Low** | **Superseded** | — | **Launch prep — not current work** | `core` | **Superseded 2026-08-30 by the second backlog consolidation — merged into #362**, because one person, one sitting, at the provider consoles. The row and its detail section stay: they carry the measurements #362 was built from, and `pnpm preflight --ticket 206` still gates for anyone on an older branch. **Never worked directly.** **Platform / durability.** Filed 2026-08-28. Free-plan production is not launch-safe: **6-hour** history window, **zero** snapshots taken, `protected: false` on the production branch, scale-to-zero **cannot be disabled** (cold start for the first visitor after 5 min idle), 0.5 GB storage cap whose breach makes **inserts/updates/deletes fail**, 5 GB/month account-wide egress, community support, no SLA. Launch is pay-as-you-go with no minimum — roughly **$5–25/month** here. On upgrade: enable **protected branches** on `production`, widen the history window to **7 days**, set a **scheduled backup**, disable scale-to-zero once real traffic exists, and set a **spending notification**. Separately and regardless of plan: **`pg_dump` to R2 on a schedule** — PITR and snapshots protect against your mistakes, an off-platform dump protects against the platform's (lockout, billing failure). Keeping that habit from self-managed Postgres is the point **Human gate: billing.** Entering payment details and selecting the Launch plan is the account owner's action alone. Every post-upgrade setting — protected branch, 7-day history, backup schedule, spending notification — is agent-executable afterwards. **Reconciliation 2026-08-29:** overlaps **#19**, which already covers external-account provisioning and is `Deferred — needs a human`. The plan's launch checklist also requires the pooled string on Railway and the unpooled one on Railway *and* GitHub Actions. **Deferred to launch prep 2026-08-29 (user ruling).** Free is the correct plan while there is no real data — usage is **8.9 of 100 CU-hours**, 34 MB of 512 MB, 3 of 10 branches. Nothing here blocks development. **The checklist moved to `docs/pre-launch.md` §3.2**, which is where launch-gated work belongs; this row is a pointer, not a queue item. Do not re-surface it as active work. |
| **299** | **09 Vendor profile editor — cover field, preview rail and parity close-out** | P1 | M3 | **P0 Critical** | **Superseded** | — | **None** | `core` `storage` | **Superseded 2026-08-30 by the second backlog consolidation — merged into #360**, because one route, and #338 was already acceptance line 5 of #299. The row and its detail section stay: they carry the measurements #360 was built from, and `pnpm preflight --ticket 299` still gates for anyone on an older branch. **Never worked directly.** **Unblocked 2026-08-30 by D16 (#335-D) — and D12 had already answered it.** `Your line` and `Years in business` are **relocated into About your business**, not deleted: both are the only editing surface for content frame `03` displays, so deleting the editor without deleting the display leaves content nobody can change. Frame `09`'s ordered field list is recorded as non-exhaustive, and that is the deviation. The character counters stay and **spread to every capped input in the product**. **Re-pointed 2026-08-30: the ruling this waits on is question D of #335.**  **Filed 2026-08-29 by the backlog consolidation.** Merges **#137, #138, #140, #141, #152, #257, #258, #288**. **#288 leads and unblocks #137**, which was stuck because the design contract contradicted itself on the cover field: the media row becomes a 128px circle profile photo beside a **216×144, 3:2** cover drop zone reading *"Drop a photo or browse · landscape · 1200×800 or larger"* — the `21:9, 1600×686 min` ask is retired, and the drop zone that is missing entirely today (#137) is built to that spec. The card preview is **never a field**: a **308px right-edge rail** at ≥1024 with a mono `PREVIEW` label, an **In search / Your profile** toggle and the real card, 280px at 1280, a panel above the fields at 768, a bottom sheet at 390. **There is no separate profile-banner field and there must never be one** — one file, two placements, per #287, which is why this is blocked on #298. Then the parity remainder: two undocumented fields to remove (#138) and the eight helper strings that came with them (#152, already `Blocked by #138`), the section nav's missing `Payouts` entry and gold dot (#140 — the dot depends on #9), the form pane over its scroll budget (#141), the slug preview promising a vanity URL the router does not serve (#257), and the submit bar never saying when the storefront was last saved (#258). Parity gate at 1440 / 1024 / 768 / 390. **Deferred 2026-08-30 — started, then released unstarted with no code written.** #298 unblocked this ticket but also sharpened the contradiction at its centre. Acceptance requires removing the two undocumented fields (#138) so every remaining string traces to frame `09`. **Both fields are the only editing surface for content frame `03` displays:** #298 moved the tagline into the identity card, and `yearsInBusiness` is read by the About pane's `Experience` tile. Deleting the inputs makes public-profile content permanently unsettable — a regression dressed as a parity fix. Keeping them fails frame `09`'s parity gate on the Layout and Text axes. **Lane 137 reached the identical conclusion on #138 and escalated rather than guessing; the question was never answered, and it is now load-bearing for a P0.** The repo's tie-breaker ("where the two disagree, build the frame and correct the plan") settles frame-vs-plan and does **not** arbitrate frame-vs-frame, which is what this is: frame `03` plus `12-vendor-profile.md` require the data, frame `09` plus `17-vendor-profile-editor.md`'s ordered field list omit the inputs. **The question, unchanged from lane 137:** delete `Your line` and `Years in business` outright, accepting that frame `03` loses its tagline and Experience tile, or relocate them into `About your business`, accepting that frame `09`'s field list is not exhaustive? Relocating also serves #141's scroll budget without destroying data. The field list determines the form's layout and every parity assertion, so the rest of the ticket cannot close its gate ahead of the ruling. Everything else in #299 (cover drop zone #288/#137, the 308px preview rail, `Payouts` nav #140, slug preview #257, last-saved #258) is implementable the moment this is answered. |
| **300** | **08 Vendor dashboard — re-measure, then close parity** | P1 | M3 | **P2 Medium** | **Backlog** | — | None | `core` | **Filed 2026-08-29 by the backlog consolidation.** Merges **#124, #127, #135, #79**. Re-measure frame `08` first — all four predate #74/#165/#198. #127 and #135 are the **same missing string** (`See all N →` beside `Requests waiting on you`) filed twice, from the Layout axis and the Text axis; close them together. Plus `View my public profile` moved out of the header into the content column (#124) and the vendor nav labels and their order diverging from the frame (#79). Small, self-contained, one browser pass. |
| **313** | **Sign-up and session entry** | P1 | M3 | **P1 High** | **Blocked — needs a human** | `worktree-313b` | **Three decisions: the Clerk-owned submit label, the contrast ruling, and #333** | `core` `auth` | **Second slice landed 2026-08-30 — squash `a806d63`, PR #70, required CI green, browser-verified at 1440x900.** The role now survives email verification: Clerk's verification step is a path navigation that remounts the form, so `role` came back null and the picker asked again, contradicting the subhead's own promise. It is read back from the in-flight `unsafeMetadata`, **narrowed** to the two sign-up roles because that metadata is client-writable and `admin` is a real `UserRole` this screen must never confer, and the picker is **not rendered** rather than `hidden` (which would leave the radios submittable). Also corrected frame `12`'s panel padding to `46px 48px` and its body measure to 415px, verified on `/sign-in` as well since `AuthScreen` is shared. **Blocked on three decisions, none of them code:** (1) **`Create my account` is not reachable by changing a string** — verified against Clerk's own `en-US` source that `formButtonPrimary` appears **once, at the top level**, with no `signUp.start` variant, and `<SignUp />` takes **no `localization` prop**, so setting it also relabels `/sign-in`. The comment in `clerk-copy.ts` was **right**, and #365 was wrong to call it stale. Scoping needs a route-aware or nested `ClerkProvider` — an auth-stability decision. The password helper `At least 10 characters` is blocked identically, since it belongs inside Clerk's card. (2) **The contrast ruling and the measurement disagree** — D16 ruled no scrim with contrast guaranteed by selection; parity found a scrim matching the frame byte for byte and the gold italic accent at **3.81:1** against a blanket 4.5:1 with no large-text carve-out. (3) **`sage-175` and the missing 14px/11.5px type steps belong to #333**, which owns scale completion. **The post-verification remount is unit-tested, not browser-driven** — it needs a fresh Clerk sign-up with a reachable inbox, which no lane has. Said plainly rather than implied. **Unblocked 2026-08-30 by D16 — all three rulings given.** (1) `Create my account` is the approved string and the plan already said so; live reads Clerk's default `Continue`, which is a code defect. (2) The panel photograph is **fixed and hand-picked**, contrast guaranteed by selection — **no scrim**, and it is never rotated or made dynamic. (3) The role picker reappearing after verification is a **defect**: the role is already in `unsafeMetadata` before verification, so it is read back from there rather than re-asked. No larger select-role-after-verification flow needed. **Filed 2026-08-29 by the backlog consolidation.** Merges **#194, #197, #226, #234, #259**. **Two halves, and the first is implementable today**: the header renders its signed-out variant on the first navigation in a fresh browser context (#259), and Clerk's own sign-in card reads `vendor-marketplace` to the user instead of `BRAND_NAME` (#234). The second half is **three rulings, and this ticket asks for all three at once rather than three tickets asking separately** — the primary action reads `Continue` where the frame says `Create my account` (#194); panel text over photography is not contrast-guaranteed and needs either a scrim or a ruling that the photography is fixed (#197); and sign-up returns to the role picker after email verification (#226), which is either a Clerk redirect defect or an intended re-confirmation. Do the first half, then return **BLOCKED with the three questions together** if they are still unanswered. **First half done 2026-08-30 (`worktree-313`).** #259 is **not a product defect** — it reproduces only from a restored `storageState`; a real sign-in takes 0 handshake hops and paints correctly on the first navigation. Filed as **#321**, which matters more than the ticket it came from because every browser verification here restores state. #234 is fixed as far as code reaches: `.cl-headerTitle` now reads the brand, though it was never visible (the app hides Clerk's header). **Four questions now wait on a human**, the three rulings plus renaming the Clerk application itself — that name is the source every `{{applicationName}}` key interpolates, and it is dashboard configuration on the shared instance. | **Found 2026-08-30 by #9's parity pass:** the site header renders **signed-out chrome on an authenticated vendor page** — `window.Clerk.loaded === true` and `Clerk.user.id` is populated after a 15s settle, yet `/vendor/dashboard`'s header reads `Sign in` / `Sign up` where frame `08` draws `View my public profile` and the avatar. Reproduced at 1440x900 signed in as the vendor.
| **322** | **Vendor surfaces at 1024 and 768** | P1 | M3 | **P1 High** | **Done** | worktree-322 | **None** | `core` | **Filed 2026-08-30 by lane 304**, carved out of **#169** when #304 landed. #304 verified landing and the shared chrome; these five frames are **not** verified and their components carry no 1024 or 1440 steps at all — `profile-header.tsx` and `bookings-hub.tsx` contain **zero** `min-[90rem]:` between them, so they render one composition at every width, exactly as landing did before #304. Frames: `27 Vendor profile — 1024`, `27 Vendor profile — 768`, `27 Vendor dashboard — 1024`, `27 Vendor dashboard — empty · 1024`, `27 Vendor profile editor — 768`. **#169's own numbers to check first:** sidebars stay 220px with labels (no icon rail), right rails narrow 420 → 340 and never stack, and the dashboard's right column is 300px with the calendar on the **booking week** rather than the month. The shared chrome from #304 already helps — gutter ladder, 56px header below 1440, capped popovers — so start by **re-measuring** rather than assuming the deltas match landing's. Needs `pnpm db:seed:e2e`; a vendor surface is unreachable without it. **Landed 2026-08-30 as `3478925` (PR #67, squashed from `worktree-322`)** — the **1024 pass only**. Both 1024 frames verified in the browser at 1024, 1280 and 1440: the sidebar steps 241 → 265, the right column exists at 1024 and 1280 at 300px, the stats row is deleted at 1024 (four cards computed to 89.5px in a 394px pane, every label wrapping to three lines), the requests column is 423px against the frame's 423, and the profile's whole interior ladder — gutter, gap, radii, type, rail — steps between frames `27` and `03`. Every 1440 step moved off `xl:` (1280, which no frame draws) onto `min-[90rem]:`. The published rail is now the booking week and the next payout, per frame `27`, reading the availability calendar rather than a second derivation. **Three of the five frames are not done and are filed as #354, #355 and #356.** Two recorded deviations, both in `16-vendor-dashboard.md`: the payout card states the event date rather than a payout date (no schedule until #10), and the week strip's day number is 16px rather than the frame's 15 (the serif floor). Also fixed a clipped focus ring on the profile tab strip and corrected two stale 1280 cells in `30-responsive.md`. |
| **323** | **Search and checkout at 1024** | P1 | M3 | **P1 High** | **Backlog** | — | **None** | `core` `stripe` | **Filed 2026-08-30 by lane 304**, carved out of **#169** when #304 landed. Frames: `27 Search results — 1024`, `27 Search — loading · 1024`, `27 Search — no results · 1024`, `27 Checkout — 1024`. **Coordinate with #297**, which owns `/search` parity at 1440 — this is the 1024 composition only, and the two will collide in `search-shell.tsx` and `refine-bar.tsx` if run concurrently. #304 already moved the `/search` **header** inset to 20px at 1024 (`SEARCH_INSET`), which the three search frames draw and which had been inheriting landing's 28px; the page body below it is untouched. `search-bar.tsx`'s **`compact`** variant is likewise untouched — #304 stepped only `hero`. **Checkout has a route as of 2026-08-30** (`apps/web/src/app/bookings/[requestId]/checkout/page.tsx`); #304 had recorded it as unimplemented and that finding is now stale. **#169's hard constraint applies: "Due today" must stay above the fold at 1024, asserted rather than eyeballed** — its rect bottom ≤ 640. |
| **324** | **02 Search — the availability chip draws one tone where the frame draws three** | P1 | M3 | **P2 Medium** | **Superseded** | — | **None** | `core` | **Superseded 2026-08-30 by the second backlog consolidation — merged into #358**, because one route, three states, one browser pass. The row and its detail section stay: they carry the measurements #358 was built from, and `pnpm preflight --ticket 324` still gates for anyone on an older branch. **Never worked directly.** **Unblocked 2026-08-30 by D16 (#335-B, C).** The **gold chip is dropped from MVP** — `scarce` was never defined and the threshold is an invented number. **The sage chip is dropped from the results grid too**: a dated query is filtered on availability (`vendor-search.dao.ts` hard-codes `availableOnDate: true` and says so), so the chip was a tautology. It survives **only** on the nearby-dates band that closes frame `18`, where it names a different date. The stone `New` chip is a **joined-recently badge** (published < 30 days), the only chip a search card now carries. **Re-pointed 2026-08-30: the two decisions this waits on are questions B and C of #335.**  **Filed 2026-08-30 by lane 297**, carved out of **#297** (originally #243) because it cannot be finished without two product decisions. **The finding is confirmed from source, not inferred from one dataset**: `vendor-card.tsx` renders exactly one availability tone, `bg-sage-50 text-sage-600`, and no branch can produce another. Frame `02` draws three — sage `Free Jun 14` (`#EDF0E9`/`#4B5940`), gold `2 dates left` (`#F5EEDC`/`#7A5A12`) and stone `New` (`#F0EAE1`/`#4A443C`). **The sage tone is shipped and correct.** What blocks the other two: (1) `03-components.md:56` says the chip is "gold when scarce (\"2 dates left\")" and **never defines scarce** — a count of free dates in what window, below what number? The count itself is a real query result and may ship, but the *threshold* is an invented number and the no-invented-numbers rule covers it. (2) The stone `New` chip is in **no** plan file at all, and in the frame it sits on a vendor already showing `★ 5.0 (17)` — so it is not "unreviewed", and nothing says what it is. **Do not guess either one.** |
| **326** | **18 Search no results — residual parity after #297** | P1 | M3 | **P2 Medium** | **Superseded** | — | **None** | `core` | **Superseded 2026-08-30 by the second backlog consolidation — merged into #358**, because one route, three states, one browser pass. The row and its detail section stay: they carry the measurements #358 was built from, and `pnpm preflight --ticket 326` still gates for anyone on an older branch. **Never worked directly.** **Filed 2026-08-30 by lane 297** from the `parity-checker` pass that closed #297. #297 fixed frame 18's headline scale, measure, both colour failures and both text failures; these are what it did **not** take, each measured at 1440x900. **Layout:** the count row (`0 photographers in Marfa` + the clause + `Prices are what they charge`) renders at y=118–173 where frame `18` draws **no count row at all** — its pane opens straight into `padding:44px 26px`, which puts the glyph at y=162 against the live y=221. **Style, shared compact header bar** (measured against frames `17`/`18`, since frame `02`'s header is ruled stale by #57): bar padding `0 4 0 16` vs `0 5 0 18`; segment values 13.5px/400 vs **13px/500**; segment inner padding-left 14 vs 16. **Style, description:** `line-height: 21.6px` (`leading-prose` 1.6) vs the frame's `13.5px/1.65` = 22.28px — 0.68px, and `leading-prose` is global, so this needs a per-call-site override rather than a token change. **Text, needs a ruling not a fix:** live draws an `Anywhere` relaxation and a `Clear all` text button, neither of which is in frame `18` or `31-content-voice.md`, and `Clear all` duplicates the Refine bar's own `Clear`. **Known and owned elsewhere, do not re-file:** the two-circle glyph vs `SearchX` (**#305**), the nearby-dates band and its `See all 14 in the region →` (**#50**), the wordmark at 24px vs 23px (**#118**). |
| **327** | **01 Landing — the hero query has no seed value, and the frame hard-codes one** | P1 | M3 | **P2 Medium** | **Superseded** | — | **None** | `core` | **Superseded 2026-08-30 by the second backlog consolidation — merged into #357**, because the ruling is landed; what is left is the frame file and the code sites it names, and one lane must own `Orla - Screens.dc.html`. The row and its detail section stay: they carry the measurements #357 was built from, and `pnpm preflight --ticket 327` still gates for anyone on an older branch. **Never worked directly.** **Unblocked 2026-08-30 by D16 (#335-A).** The hero **seeds nothing** — all three segments render in the placeholder tone `#6B6459`. **Frame `01` is corrected, not the code**: a hard-coded `Austin, TX` is a claim about where the marketplace operates, and an empty value in the filled tone reads as a value that is not there. The hero badge "Now booking in Austin" is unaffected. **Re-pointed 2026-08-30: the ruling this waits on is question A of #335.**  **Filed 2026-08-30 by lane 296**, carved out of **#296** (originally #88), which instructs in its own acceptance to return `BLOCKED` with this question rather than invent a seed. Frame `01 Landing` draws the City segment as the **literal** `Austin, TX` in `#23201C` (stone-900, the filled tone). Live renders an empty `input` with `placeholder="Anywhere"` in `#6B6459` (stone-600, the placeholder tone). **The measurement pass found the question is wider than City.** The frame *templates* the vendor type (`{{ searchValue }}`, hint "Photography") but *hard-codes* the city, and live renders `Any vendor type` in the placeholder tone too — so the hero's centrepiece reads as three empty fields where the frame reads as a seeded query. Whatever is decided for City decides the vendor-type tone with it; ruling on one alone leaves the two segments disagreeing. **The options, none of them free:** seed a real city (which city, and on what basis — geolocation is not MVP and a hard-coded `Austin, TX` is a claim about where the marketplace operates); seed nothing and accept the placeholder tone as the honest empty state, correcting frame `01` in a design pass; or seed nothing but draw the empty value in the filled tone, which reads as a value that is not there. **Do not guess.** |
| **332** | **`state` becomes a closed vocabulary, from the form to the column** | P1 | M3 | **P1 High** | **Done** | `worktree-332` | **None** | `core` | **Done 2026-08-30 — squash `7314adc`, PR #71, CI green (`0 cached, 7 total` on the run that did the work), browser-verified at 1440x900.** `US_STATE_CODES` in the shared constants is the single vocabulary; `us_state` (Postgres) and `usStateCodeSchema` (Zod) both derive from it. Two migrations, order load-bearing: `0018` repairs (names case-folded onto codes, two-letter values upper-cased, blanks to NULL), `0019` creates the type and casts — reversed, the cast fails on the row that motivated the ticket. **`0018` has no catch-all on purpose**: an unrecognised value fails the migration loudly rather than being mapped to NULL, which would silently drop that vendor out of every state-filtered search. Verified end to end: the form stores `NY` while showing `New York`, `PUT /vendor/profile` carried `"state":"NY"`, and the column reads `pg_typeof = us_state`. Two things fell out of the closure rather than being sought — the seed fixtures had to declare `UsStateCode`, and the facet DAO's `state <> ''` guard became **unrepresentable** (an enum column cannot hold an empty string, so TypeScript rejected it). **City stays free text** and **`users.state` was left alone** — same latent split, no bad data, and closing it needs the customer form to become a picker. **Filed 2026-08-30 by the backlog consolidation.** Merges **#330 and #331**. `Austin, TX` and `Austin, Texas` are two rows in the dev database (11 and 1), so a customer who picks one never sees the other's vendors — the split is entirely in `state`, and it **widens with every new vendor**, because `us-states.ts` offers full names while the majority of rows hold codes. Canonical form is the **two-letter USPS code**, ruled 2026-08-30. The two rows were split by layer: #330 put the vocabulary in `createVendorProfileSchema` and repaired the data, #331 constrained the column. Merged because #331 must run **after** #330's repair or it fails on exactly the row that motivated it, and shipping them apart means two migrations on one column and an unconstrained column in between. City stays free text, deliberately — a validated city list needs a dataset decision that is not this ticket. |
| **333** | **Token scale completion, and the guard against a step that does not exist** | P1 | M3 | **P1 High** | **Backlog** | — | **None** | `core` | **Filed 2026-08-30 by the backlog consolidation.** Merges **#303 and #325**. `text-stone-800` compiles, renders, and puts an off-palette colour on the page: the warm ramp defines no `stone-800`, so Tailwind 4 resolves its own cool `#292524` with no error and nothing in the suite able to notice — **seven call sites are still live**, verified 2026-08-30. The same hole is open on every family (`gold-100`, `steel-300`, `clay-700`, `sage-500`). Alongside it the token-file remainder after #74/#165/#198/#235: the `text-[Npx]` line-height defect, the radius scale's missing **12px step** (confirmed absent from `theme.css`, which runs 6/8/10/14/18), and avatar initials rendering Instrument Serif below its 16px floor. Merged because both halves complete a scale **and** add a source-scanning guard over the same class strings — one scanner closes both, and #325's guard is what stops #303's radius work reopening the class. |
| **334** | **Repo guardrails — lane tooling, preflight hygiene and the route/frame ledger** | P2 | M4.5 | **P2 Medium** | **Superseded** | — | **None** | `core` | **Superseded 2026-08-30 by the second backlog consolidation — merged into #363**, because tooling and tests only — no parity gate, no browser pass, one verification shape. The row and its detail section stay: they carry the measurements #363 was built from, and `pnpm preflight --ticket 334` still gates for anyone on an older branch. **Never worked directly.** **Filed 2026-08-30 by the backlog consolidation.** Merges **#316 and #319**. Lane hygiene: `lane:up` migrates but never seeds, so a fresh lane's vendor surfaces 404 with nothing to say why; a resumed lane hands back a stale `worktreePath`; three parallel lanes exhaust the file-descriptor limit and `next dev` dies with a Clerk error three steps from the cause; the `stripe listen` secret drifts from `.env` and every webhook 401s; a malformed body answers 400 where a 403 belongs; and a `packages/preflight` test fails only under parallel Turbo runs. Ledger: **#80 named five unframed routes, the count is now nine**, because four arrived after the 2026-08-28 mapping and nothing forced the ledger forward — parity is unprovable on an unframed route. Merged because both ship only tooling and tests: no user-facing behaviour, no parity gate, one verification shape. |
| **335** | **[DESIGN] Ruling round — four open questions blocking parity** | P1 | M3 | **P1 High** | **Superseded** | — | **None** | `core` | **Superseded 2026-08-30 by the second backlog consolidation — merged into #357**, because the ruling is landed; what is left is the frame file and the code sites it names, and one lane must own `Orla - Screens.dc.html`. The row and its detail section stay: they carry the measurements #357 was built from, and `pnpm preflight --ticket 335` still gates for anyone on an older branch. **Never worked directly.** **Ruled 2026-08-30 — all five questions answered, recorded as D16, and the `design-plan/` edits are landed** (`03-components.md`, `10-landing.md`, `11-search.md`, `21-sign-up.md`, `31-content-voice.md`, `99-open-questions.md`), including the **overdue 48-hour correction D12 granted an exception for and never made**. #327, #324, #299 and #313 are moved to Backlog; #320 and #339 are closed by the ruling. **What is left is code, not decisions:** correct frames `01`, `02`, `12` and `18` (plus their 1024 variants) in `Orla - Screens.dc.html`, and add the guard test asserting no approved string in `31-content-voice.md` hard-codes a duration the code derives. **Filed 2026-08-30 by the backlog consolidation.** Merges **#320** whole and takes the ruling half out of **#327 (A)**, **#324 (B, C)** and **#299 (D)**. Four tickets are each stalled on one decision nobody has made, and every one of them needs a `design-plan/` edit that **a ticket may not make** — `web-design-parity.md` is explicit that design passes edit the plan and tickets write the code. Follows the **#306** precedent, which closed the same way. One sitting answers all four; the code halves stay in their own rows and go `Deferred` → `Backlog` as each is ruled. **Do not guess any of the four** — three of them are invented numbers or claims about the business, which the no-invented-numbers rule covers. |
| **336** | **01/02 header — the signed-in cluster draws `Dashboard` and a bell where frame `02` draws `Bookings`** | P1 | M3 | **P2 Medium** | **Superseded** | — | **None** | `core` | **Superseded 2026-08-30 by the second backlog consolidation — merged into #361**, because one signed-in render of one component cluster, owned by no parity pass. The row and its detail section stay: they carry the measurements #361 was built from, and `pnpm preflight --ticket 336` still gates for anyone on an older branch. **Never worked directly.** **Filed 2026-08-30 by lane 329**, from the `parity-checker` pass that closed #329. Frame `02`'s signed-in header draws **`Messages` · `Bookings` · avatar**. Live renders **`Messages` · `Dashboard` · a notification bell · the Clerk `UserButton`** — `apps/web/src/components/site-header.tsx` lines 145–162. Two separate deviations: the link **text** is wrong on the Text axis (`site-header.tsx:157`), and the **bell is not in the frame at all** on the Layout axis. Not caused by #329 and not touched by it; the chip removal is on the row below. Decide per element — the bell may be a real surface the frame predates, in which case the frame is what needs the ruling |
| **337** | **The card focus ring is clipped by the scroll container on the first row of results** | P1 | M3 | **P2 Medium** | **Superseded** | — | **None** | `core` | **Superseded 2026-08-30 by the second backlog consolidation — merged into #358**, because one route, three states, one browser pass. The row and its detail section stay: they carry the measurements #358 was built from, and `pnpm preflight --ticket 337` still gates for anyone on an older branch. **Never worked directly.** **Filed 2026-08-30 by lane 329**, from the `parity-checker` pass that closed #329. `div.app-pane` is the `overflow:auto` scroller and has **zero top padding**; its content-box top is `y=173` and the first row of cards starts at exactly `y=173`, so the ring's outward 4px falls at `y=169–172` — outside the scroller. **Measured, not inferred**: pixel-differencing a focused card against a blurred one shows rows 169–172 identical `rgb(248,245,239)` in both, first difference at `y=173`. The ring still paints left, right, bottom and corners, so the indicator is visible and **WCAG 2.4.7 holds** — this is a partial clip, not the "clipped to nothing" failure `04-laws.md` names, which is why it is P2 and not P1. Fix is top padding or `scroll-padding-top` on `.app-pane`; check every other `overflow` scroller for the same shape rather than patching one |
| **338** | **09 Vendor profile editor — the Storefront nav is missing `Payouts` and its blocker dot** | P1 | M3 | **P2 Medium** | **Superseded** | — | **None** | `core` `stripe` | **Superseded 2026-08-30 by the second backlog consolidation — merged into #360**, because one route, and #338 was already acceptance line 5 of #299. The row and its detail section stay: they carry the measurements #360 was built from, and `pnpm preflight --ticket 338` still gates for anyone on an older branch. **Never worked directly.** **Filed 2026-08-30 by lane 329**, from the `parity-checker` pass that closed #329. Live renders **six** section-nav items (Business, Location, Tags, Response time, Packages, Portfolio); frame `09` draws **seven**, with **`Payouts` last, carrying a gold blocker dot**. Gold is correct there under `40-states.md` — it is waiting on someone, not a failure. Payouts exists as a surface (#9 shipped Connect onboarding), so this is a missing nav entry rather than a missing feature. **Re-measure frame `09` before fixing**: the parity pass was scoped to the Tags row and read the rest only in passing, so treat the six-vs-seven count as the finding and everything else about that nav as unverified |
| **339** | **[DESIGN] Search `Sort` has no specified default — the frame draws a chosen one** | P1 | M3 | **P3 Low** | **Superseded** | — | **None** | `core` | **Superseded 2026-08-30 by the second backlog consolidation — merged into #357**, because the ruling is landed; what is left is the frame file and the code sites it names, and one lane must own `Orla - Screens.dc.html`. The row and its detail section stay: they carry the measurements #357 was built from, and `pnpm preflight --ticket 339` still gates for anyone on an older branch. **Never worked directly.** **Ruled 2026-08-30 by D16 — `Most relevant` stands.** Frame `02`'s `Top rated ▾` is a *chosen* sort, not a default, and a new marketplace defaulting to it ranks its thinnest review counts first. Recorded in `11-search.md` and `99-open-questions.md`; **no code change**. What is left is the plan edit's verification only. **Filed 2026-08-30 by lane 329**, from the `parity-checker` pass that closed #329. Live defaults to **`Most relevant`** (`sort: 'relevance'`); frame `02` draws **`Top rated ▾`**. Neither `11-search.md` nor `42-dropdowns.md` fixes a default, and the frame draws a *chosen* sort exactly as it draws a chosen price and a chosen rating — so this is **not** evidence the default is wrong, and `parity-checker` correctly did not call it a deviation. It is an unresolved gap in the plan: **a new marketplace defaulting to `Top rated` ranks its thinnest review counts first**, which is a product decision, not a parity one. Needs a one-line ruling, then either the code or the plan changes. Do not "fix" this by matching the frame |
| **340** | **Playwright E2E harness and the eight critical-journey suites** | P3 | M6 | **P1 High** | **Backlog** | — | **#14** (**Done** — archived 2026-08-30) | `core` `auth` `stripe` | **Filed 2026-08-30 by lane 14**, split out of #14. The repo has **no `playwright.config`, no `e2e/` directory and no test-runner harness at all** — Playwright is currently MCP-driven for agentic verification only, so this ticket builds the runner from nothing. Depends on #14 for the fixed-UUID dataset the suites select on. Carries the eight suites verbatim from #14: auth, vendor profile, search, booking request, payment, messaging, reviews, admin — plus `@clerk/testing` for programmatic sign-in and the 1440x900 / 1024 / 768 / 390 viewport matrix |
| **341** | **`seed:marketing` and `seed:e2e` write an event-type label into a slug column** | P3 | M6 | **P2 Medium** | **Superseded** | — | **None** | `core` | **Superseded 2026-08-30 by the second backlog consolidation — merged into #363**, because tooling and tests only — no parity gate, no browser pass, one verification shape. The row and its detail section stay: they carry the measurements #363 was built from, and `pnpm preflight --ticket 341` still gates for anyone on an older branch. **Never worked directly.** **Filed 2026-08-30 by lane 14.** `seed-marketing.ts:406` and `seed-e2e.ts:465` both write `eventType: 'Wedding'`. `booking_requests.event_type` holds an `EVENT_TYPES` **slug** — `eventTypeSchema` is `z.enum(EVENT_TYPES)` at the API edge — so the correct value is `'wedding'`. Harmless today because reads are typed as a plain string, wrong the moment anything renders the label via `EVENT_TYPE_LABELS` or validates on read. Same defect was found and fixed in `seed-demo.ts` by #14; **close the class with a guard**, not two edits — a test asserting every seeded `event_type` is in `EVENT_TYPES` |
| **342** | **[DESIGN] The avatar tint the frames draw has no token** | P1 | M3 | **P2 Medium** | **Superseded** | — | **None** | `core` | **Superseded 2026-08-30 by the second backlog consolidation — merged into #357**, because the ruling is landed; what is left is the frame file and the code sites it names, and one lane must own `Orla - Screens.dc.html`. The row and its detail section stay: they carry the measurements #357 was built from, and `pnpm preflight --ticket 342` still gates for anyone on an older branch. **Never worked directly.** **Ruled 2026-08-30 by D17 — `clay-150: #EADCCB` is added to the ramp.** The frames draw that fill at **42 sites across 20 frames** and the ramp had no step between `clay-100` (`#F7E7E0`) and `clay-200` (`#EFD8CC`); the clay initials and the whole sage pair already resolved exactly, so the fill was the one off-token value. **The ramp was incomplete, not the frame wrong** — same finding as #306. `01-foundations.md` and `03-components.md` are updated; the code change is one string in `avatar.tsx:17`'s `FALLBACK_TONES`, and it affects every avatar fallback in the app. **Filed 2026-08-30 by lane 302**, from the `parity-checker` pass that closed #302. Frame `07`'s `Recent messages` rows draw two avatar palettes: **`#EADCCB` fill with `#8E3F20` initials**, and `#E4E9DE` with `#4B5940`. The sage pair resolves to tokens exactly and renders correctly. **`#EADCCB` is not in `01-foundations.md`** — the `Avatar` primitive alternates `clay-100` (`#F7E7E0`) and `sage-100` by a hash of the name, so the initials colour matches the frame and the fill does not. This is the same class as the `#C4D6A8` / `#5C4A18` values **#306** ruled on: a frame colour with no token behind it. **Do not substitute silently** — either the token gains a step or the frame is corrected, and both are design passes. Affects every avatar fallback in the app, not just this rail |
| **343** | **07 Bookings hub — residual parity after #302** | P1 | M3 | **P2 Medium** | **Superseded** | — | **None** | `core` | **Superseded 2026-08-30 by the second backlog consolidation — merged into #359**, because frames 04/07/19 are one customer fixture and one browser pass; 07 and 19 are the same shell. The row and its detail section stay: they carry the measurements #359 was built from, and `pnpm preflight --ticket 343` still gates for anyone on an older branch. **Never worked directly.** **Filed 2026-08-30 by lane 302** from the `parity-checker` pass that closed #302, which fixed the Access axis and the deviations #302 itself introduced. These are **pre-existing** and were out of that ticket's scope. **Layout:** the title row should be `flex` with `Your bookings` left and today's date (`12.5px`, `#6B6459`) right — **the date is absent from the screen entirely**; the sidebar draws two rows where the frame draws four (`Messages` with an unread dot and `Saved vendors` are missing, and `bookings-sidebar.tsx:10-17` justifies that under #31's dead-control rule, which **no longer applies now that `/messages` exists and is linked from the header**). **Style:** `StatusPill` is `700 11px` / `padding 6px 10px` where `.pill` is `700 10px` / `5px 10px` — **shared, so it affects every screen carrying a pill**; the dashed tile border is `#D5CEC2` (`stone-400`) where the frame draws `#DDD5C7`. **Font:** the summary sentence is `text-md` (15px) with `leading-prose` where the frame draws **14px / normal** — and **there is no 14px token**, so this one needs a scale decision, not a class swap. Sidebar card body and CTA are 11px where the frame draws 11.5 and 12 |
| **344** | **19 Bookings hub empty — the app renders frame 07's shell around frame 19's panel** | P1 | M3 | **P2 Medium** | **Superseded** | — | **None** | `core` | **Superseded 2026-08-30 by the second backlog consolidation — merged into #359**, because frames 04/07/19 are one customer fixture and one browser pass; 07 and 19 are the same shell. The row and its detail section stay: they carry the measurements #359 was built from, and `pnpm preflight --ticket 344` still gates for anyone on an older branch. **Never worked directly.** **Filed 2026-08-30 by lane 302** from the `parity-checker` pass that closed #302. #302's own assertion is verified — with bookings the rail draws `Recent messages` and not `How booking works here` — and the **empty pane itself matches frame `19` exactly**: dashed panel, the two-circle mark, `No bookings yet`, the body copy character for character including the curly apostrophe, the `Find a vendor` button, and the `01/02/03` steps in JetBrains Mono. **The shell around it does not.** Frame `19` draws a different title (`My bookings`), a `Nothing booked yet` sub-line, a `Find a vendor` button in the title row, pill filters `All / Pending / Confirmed / Past`, a sidebar with a `Booking` section label plus `Payments` and an Account/`Settings` block, and a **bordered radius-18 card** rail rather than `07`'s flush border-left. None of that is present. **This long predates #302** and may well be a deliberate one-shell reconciliation of frames `07` and `19` — but nothing in the repo records that decision, so it currently reads as unexplained drift. **Decide and record before building**: one shell is probably right, and if so frame `19` is what needs correcting. **Also unverified:** the rail's `How booking works here` block on a live empty hub — the E2E customer has bookings and `.claude/rules/e2e-auth.md` forbids a throwaway account, so it was not driven and is not recorded as matching |
| **345** | **04 Booking request — `31-content-voice.md` states a deadline the product does not use** | P1 | M3 | **P2 Medium** | **Superseded** | — | **None** | `core` | **Superseded 2026-08-30 by the second backlog consolidation — merged into #359**, because frames 04/07/19 are one customer fixture and one browser pass; 07 and 19 are the same shell. The row and its detail section stay: they carry the measurements #359 was built from, and `pnpm preflight --ticket 345` still gates for anyone on an older branch. **Never worked directly.** **Filed 2026-08-30 by lane 302** from the `parity-checker` pass that closed #302. Frame `04` **and** `31-content-voice.md`'s approved string both read *"Maya has **48 hours** to confirm or send a **revised quote**"*. The app renders *"…has **7 days** to confirm or send a **quote**"*. **The code is right** — the sent-confirmation and the request card both say 7d, and the interval is derived from the constant rather than written down — so **the plan is what is stale**, and `04-laws.md`'s precedence rule says correct it in the same pass. Two more from the same frame: the copy neutralises the vendor's pronoun (*"the more **they know**"* for the frame's *"**she knows**"*, and *"Anything else **they** should know?"*), which is deliberate and correct but is a wording change from the frame and needs recording rather than leaving as drift; and `Continue to review` carries a `shadow-sm` the frame's `.btnP` does not. **Two small ones for the same visit:** the `Start time` field is 42px against `Guest count`'s 38px — the native `<input type="time"]` clock affordance adds 4px to a pair the frame draws at one height — and removing the marketing footer left a **stray empty `<section>` at `y=900`, height 0**, which should be deleted rather than emitted |
| **346** | **`/messages` keys threads by vendor, so one booking's question lands in another's thread** | P1 | M3 | **P1 High** | **In Progress** | `worktree-346` | **None** | `core` | **Filed 2026-08-30 by lane 305**, carved out of #81 (item 3) because it is a data-model change, not the copy fix the rest of that ticket was. A customer asking about their Jun 11 fundraiser sends it into a thread the vendor reads as "Mar 15 birthday" — the subtitle names one arbitrary booking out of several. `conversations` already carries a nullable `booking_request_id` and a `conversations_request_key` unique index, so the schema supports a thread per request; what does not exist is the read path, the list grouping, or a rule for the vendor-initiated thread that belongs to no request. Needs a design ruling on how a multi-booking relationship is listed before it is built |
| **347** | **`/search` has no pagination control, so page 2 is unreachable and page 2+ renders blank** | P1 | M3 | **P2 Medium** | **Superseded** | — | **None** | `core` | **Superseded 2026-08-30 by the second backlog consolidation — merged into #358**, because one route, three states, one browser pass. The row and its detail section stay: they carry the measurements #358 was built from, and `pnpm preflight --ticket 347` still gates for anyone on an older branch. **Never worked directly.** **Filed 2026-08-30 by lane 305**, carved out of #81 (item 4) because it is a missing feature rather than a defect in one. `?page=2` returns HTTP 200 with an empty results pane while the `h1` claims the full count; there is no control anywhere to reach it, and `pageSize=20` means it is unreachable in practice today. Two halves: the control itself (frame `02` draws none — needs a design ruling), and an out-of-range page rendering an empty state whose heading agrees with its body rather than a blank pane |
| **348** | **[DESIGN] Does a real vendor with no cover get the labelled placeholder, or a designed empty state?** | P1 | M3 | **P2 Medium** | **Superseded** | — | **None** | `core` | **Superseded 2026-08-30 by the second backlog consolidation — merged into #357**, because the ruling is landed; what is left is the frame file and the code sites it names, and one lane must own `Orla - Screens.dc.html`. The row and its detail section stay: they carry the measurements #357 was built from, and `pnpm preflight --ticket 348` still gates for anyone on an older branch. **Never worked directly.** **Ruled 2026-08-30 by D17 — a designed empty state, not the labelled placeholder.** The hatch is a **build-time device** for photography the *product* lacks before launch; a live vendor's empty cover is *their* missing content shown to *their* customers, and it reads as an unfinished product. `/search` and `/vendors/[slug]` render a neutral tone block at the cover's exact dimensions — no hatch, no mono label (`vendor-card.tsx:149`, `profile-header.tsx:199`). The cause and the fix stay in the editor, where the vendor is. Recorded in `40-states.md` and `03-components.md`. **Filed 2026-08-30 by lane 305**, the residue of #228 after #305 closed its literal finding. The `COVER · FULL-BLEED BANNER` string #228 measured is gone — `CHANGE-ORDER-2026-08-29.md` retired that composition. What remains is a genuine conflict between two documents. `03-components.md` defines `Placeholder` as "stand-in imagery **until real photography exists**", and `web-design-parity.md` permits "real photography in place of the labelled placeholders" — both about the *product* lacking photos before launch. #228 was about a different absence: a real vendor who has not uploaded a cover, whose live public page then reads as unfinished to their own customers. `40-states.md` would give that a designed empty state. Deciding which applies is a ruling, not an implementation choice, so #305 closed the finding and filed this rather than guessing. The upload control itself is #299 |
| **349** | **Back and Forward discard unsaved profile edits without prompting** | P1 | M3 | **P2 Medium** | **Superseded** | — | **None** | `core` | **Superseded 2026-08-30 by the second backlog consolidation — merged into #360**, because one route, and #338 was already acceptance line 5 of #299. The row and its detail section stay: they carry the measurements #360 was built from, and `pnpm preflight --ticket 349` still gates for anyone on an older branch. **Never worked directly.** **Filed 2026-08-30 by lane 305**, the third exit #227 did not name. `useUnsavedChangesGuard` covers leaving the site (`beforeunload`) and leaving the page by link (a capture-phase click intercept), and deliberately does **not** cover a history navigation: `beforeunload` does not fire for a same-document one, and `popstate` arrives *after* the entry has already changed, so the only way to "block" it is to push a decoy entry and undo it — which corrupts the history stack the user is walking. A vendor who presses Back on a dirty `/vendor/profile/edit` still loses the edit. Needs either a supported App Router navigation-blocking API, or a ruling that the decoy-entry trade is worth making |
| **350** | **The 500 page offers "Go to my bookings" to a signed-out visitor, and the frame draws it that way** | P1 | M3 | **P3 Low** | **Superseded** | — | **None** | `core` | **Superseded 2026-08-30 by the second backlog consolidation — merged into #357**, because the ruling is landed; what is left is the frame file and the code sites it names, and one lane must own `Orla - Screens.dc.html`. The row and its detail section stay: they carry the measurements #357 was built from, and `pnpm preflight --ticket 350` still gates for anyone on an older branch. **Never worked directly.** **Ruled 2026-08-30 by D17 — "Browse vendors" → `/search`, and frame `16` is corrected.** #305 was right to revert its own change: a ticket may not edit approved copy, and this is the design pass that may. An auth-aware pair was rejected because `global-error.tsx` renders outside the Clerk provider and cannot know who is reading. `error-screen.tsx:74` changes href and label. **Filed 2026-08-30 by lane 305**, carved out of #81 (item 7). A visitor who has never signed in is offered a link to bookings they cannot have. #305 changed the label to "Browse vendors" and then **reverted it**: frame `16` draws `Go to my bookings` verbatim, every other string on that screen matches the frame exactly, and `web-design-parity.md` is explicit that "the words *are* the design" and that design passes edit the plan while tickets write the code. Changing approved copy to fix a logic problem is the reverse of that. Also note `global-error.tsx` renders outside the Clerk provider, so it cannot know who is reading — any auth-aware answer needs a default, and the frame gives none. Needs a ruling: a second frame for the signed-out 500, or an accepted inaccuracy |
| **351** | **The notification dropdown's empty state is a bare paragraph, not an `EmptyState`** | P1 | M3 | **P3 Low** | **Superseded** | — | **None** | `core` | **Superseded 2026-08-30 by the second backlog consolidation — merged into #361**, because one signed-in render of one component cluster, owned by no parity pass. The row and its detail section stay: they carry the measurements #361 was built from, and `pnpm preflight --ticket 351` still gates for anyone on an older branch. **Never worked directly.** **Filed 2026-08-30 by lane 305**, found by browser verification. The bell renders `<p class="px-4 py-6 text-center text-base text-stone-600">No notifications yet</p>` — no glyph, no heading, no CTA, and `closest('[data-slot="empty-state"]')` is null. #305 made the two-circle glyph the default for every `EmptyState`, which is why this one stands out: it is not a call site, so the default cannot reach it. Whether a dropdown that small should carry the full glyph-headline-sentence-CTA stack is a judgement — frame `08/09/11 shared` draws the panel but `40-states.md` does not name a dropdown among its empty states — so this needs a look at the frame before it is changed rather than a mechanical swap |
| **352** | **The user-menu avatar's alt text reads "'s logo" — the business name interpolates empty** | P1 | M3 | **P2 Medium** | **Superseded** | — | **None** | `core` `auth` | **Superseded 2026-08-30 by the second backlog consolidation — merged into #361**, because one signed-in render of one component cluster, owned by no parity pass. The row and its detail section stay: they carry the measurements #361 was built from, and `pnpm preflight --ticket 352` still gates for anyone on an older branch. **Never worked directly.** **Filed 2026-08-30 by lane 305**, found by browser verification on every signed-in page. The avatar in the user menu has `alt="'s logo"`, so the name it should carry is an empty string — a screen-reader user hears a possessive with nothing in front of it. Present for both roles. The template is right and the value reaching it is not, so the fix is wherever that name is resolved, not in the alt attribute. `04-laws.md` covers alternative text and the parity `Access` axis is what would have caught it |
| **354** | **27 Vendor profile — 768: the booking rail must become a sticky bottom bar** | P1 | M3 | **P2 Medium** | **Backlog** | — | **None** | `core` | **Filed 2026-08-30 by lane 322**, from the 1024 pass that closed the first two of its five frames. **This is a composition change, not a ladder step**, which is why it was not folded into #322. `30-responsive.md` gives 768 "Card + rail → sticky bottom bar", and frame `27 Vendor profile — 768` draws it: `position:absolute;left:0;right:0;bottom:0`, `background:#FFFDF9`, `border-top:1px solid #E4DDD1`, `padding:12px 24px`, `gap:16px`, `box-shadow:0 -4px 18px rgba(35,32,28,.07)`, holding an 11px `From` over a serif 24px price at `line-height:1.1`, an `.inp` at `flex:1;max-width:180px` carrying the date, a `flex:1` centred `Request booking` at `600 14px` on `padding:13px 0;border-radius:10px`, and a `.btnS Message` at `12px 18px`. **Today the rail simply stacks under the content below `lg`** — the grid is `lg:grid-cols-[…]` and nothing replaces it. The 768 interior is also its own ladder and is not built: pane `22px 24px 0`, card radius 16 on a 179px floor, identity pane `20px 22px`, avatar 56, name 29px, tagline 18px on a 13px offset, tab strip `margin-top:18px` at `gap:22px` and 13px, bio `14px/1.7` inside 600 on a 16px offset, stat grid `gap:12px` on an 18px offset inside 480 with `11px 13px` cards and 21px values, and `What's included` at `margin-top:20px` inside 600 with a 9px label offset over 13.5px rows. **Re-measure before fixing** — #322 moved every one of these files. |
| **355** | **27 Vendor profile editor — 768** | P1 | M3 | **P2 Medium** | **Backlog** | — | **None** | `core` | **Filed 2026-08-30 by lane 322**, from the 1024 pass that closed the first two of its five frames. The fifth of #322's frames and **the one never opened at all** — no measurement of it exists yet, so this ticket starts by taking one rather than by fixing anything. What is known from `30-responsive.md`'s degradation table: at 768 the editor puts its **nav on top**, turns the preview rail into a **panel above the fields**, and lays the fields out **two columns**; at 1024 the section nav keeps its labels — no dots rail, no icon rail — and the preview rail is 280px. The editor is the one vendor route that suppresses the shared sidebar (`VendorNav` returns `null` under `/vendor/profile/edit`) and carries its own 200px section rail in `vendor-profile-form.tsx`, which is **not** `box-content` — so the footprint arithmetic #322 fixed on the shared nav does not apply here and has to be derived separately. Needs `pnpm db:seed:e2e`. |
| **356** | **27 Vendor dashboard — empty · 1024: the draft-profile state is a different screen** | P1 | M3 | **P2 Medium** | **Backlog** | — | **None** | `core` | **Filed 2026-08-30 by lane 322**, from the 1024 pass that closed the first two of its five frames. Frame `27 Vendor dashboard — empty · 1024` is **not** the populated dashboard with an empty list. It opens with a gold blocker banner the code has no counterpart for — a 16px `#C99A2E` dot on `#F5EEDC` inside `1px #E8DBB8` at `border-radius:11px`, `padding:12px 14px`, reading *"Your profile isn't live yet — three things left"* over *"Add at least 6 portfolio images · Set a starting price · Connect payouts."* with an inline `Finish profile` — where the page draws only `<Banner status="pending" title="Payouts not connected">`. Below it the checklist is an **in-pane 300px card** (`border-radius:16px`, `padding:16px`, `1px #E4DDD1`), not #322's bordered outer rail, and it is a **seven**-row `Setup · 4 of 7 done` list with strikethrough on the done rows against the six of `PUBLISH_BLOCKER_KEYS`. The empty pane's copy differs too: frame says *"No requests yet"* / *"Nothing has come in because your listing is still a draft."* / `Preview my profile`, code says *"Nobody can find you yet"* / *"Your profile is not published…"* / `Finish your profile`; panel radius 16 against `rounded-2xl`'s 18, `padding:0 28px` against `px-10`, description capped at 340 against 420, headline 23px. **The state is also unreachable in a lane database**: all 17 `vendor_profiles` rows are `is_published = true` and only the E2E account has a sign-in path, so verifying it needs a seed that can produce an unpublished vendor with zero requests — decide that first, because a pass that cannot render the frame proves nothing. |
| **357** | **Apply the D16/D17 rulings — the four code sites the frames now expect** | P1 | M3 | **P1 High** | **Done** | `worktree-357` | **None** | `core` | **Done 2026-08-30 — squash `d24488c`, PR #69, required CI green.** All four code sites verified in a browser at 1440x900 and MATCH on parity: monogram `clay-150 rgb(234,220,203)`, both coverless blocks `stone-250 rgb(236,230,220)` at ratio 1.500 with empty `innerHTML`, 500 CTA the single link `Browse vendors` -> `/search`. `clay-150` and `stone-250` had to be **minted** — the ticket claimed D18 had done it, but neither was in `theme.css`. `#327` and `#339` closed on evidence: all three hero segments compute to `#6b6459`, and `Most relevant` ships as the default sort. Frame `03`'s sage chip confirmed still present. `grep -rn "<Placeholder"` over `apps/web/src` now returns nothing. **The `parity-checker` MATCH acceptance line was not met as literally written** — frames `01`, `02`, `12`, `16`, `18` each returned MISMATCH, but **every finding was attributed to another ticket or to the frames**, none to this change; the sage result chip and the `New` badge are **#358**, the three carets are **#364**, and the rest (sign-up's `Continue` where D16 ruled `Create my account`, the unminted `sage-175`, frame `16`'s chrome and type scale, `all two filters`, and the 32x32 icon-only submit against the 44x44 law) are filed separately. Holding this ticket open for them would absorb three other tickets and its own stated non-goals **Filed 2026-08-30 by the second backlog consolidation.** Merges **#327, #335, #339, #342, #348, #350**. Every one of these had its decision taken by D16 or D17 and its `design-plan/` edit landed; what each has left is code or the frame file. **They are one ticket because five of the six end in an edit to `Orla - Screens.dc.html`** — frames `01`, `02`, `12`, `16`, `18` and their 1024 variants — and four concurrent lanes editing one 27-frame HTML file is a guaranteed conflict on the repo's own acceptance criterion. The code sites are named and small: `avatar.tsx:17`'s `FALLBACK_TONES` → `clay-150` (#342), `vendor-card.tsx:149` and `profile-header.tsx:199` → the neutral coverless block (#348), `error-screen.tsx:74`'s href and label → `Browse vendors` → `/search` (#350). #327 is **frame-only** — the hero seeds nothing and the code is already right. #339 is **verification only** — `Most relevant` already ships. Plus the guard test D16 asked for: no approved string in `31-content-voice.md` hard-codes a duration the code derives. **The frame half landed out-of-band on 2026-08-30**, from the user's own updated copy of the document — all six corrections plus `12`'s `Create my account`, which was already right. See `design/design-plan/CHANGE-ORDER-2026-08-30.md`. **What is left here is code only**: the four sites above and the guard test. `stone-250 #ECE6DC` was minted (D18) in the same pass, so the coverless block now has a token to name. |
| **358** | **02/17/18 Search — close 1440 parity and the two reachability defects** | P1 | M3 | **P2 Medium** | **Backlog** | — | **None** (was #357; its frames landed 2026-08-30 in `72ddd73`) | `core` | **Filed 2026-08-30 by the second backlog consolidation.** Merges **#324, #326, #337, #347**. One route, three states, one browser pass — #326's own measurements say the compact-header fix *"lands on `/search` at every state"*, #337 was found there, and #347's blank page 2 is reached from it. **#324 is now a deletion:** D16 dropped the gold chip (scarce was never defined) and the sage chip on the results grid (a dated query is already filtered on availability, so the chip was a tautology), leaving the stone `New` badge — published < 30 days — as the only chip a card carries. Sage survives **only** on the nearby-dates band. Sequence **after #357**, which corrects the frames this is measured against, and **do not run concurrently with #323**, which owns the same two components at 1024. **Frames `02` and `18` were corrected on 2026-08-30**, so the measurement target is already stable; the remaining #357 dependency is `vendor-card.tsx`, which both tickets touch. |
| **359** | **04/07/19 Bookings — hub, empty hub and the request form** | P1 | M3 | **P2 Medium** | **Backlog** | — | **None** | `core` | **Filed 2026-08-30 by the second backlog consolidation.** Merges **#343, #344, #345** — all three filed by lane 302 from one `parity-checker` pass. **#343 and #344 are the same shell**, and #345 is one click away, so this is one customer fixture and one browser pass. Carries an unrecorded decision that must be settled before building: the app renders frame `07`'s shell around frame `19`'s pane, which may well be a deliberate reconciliation — one shell for a hub that is sometimes empty is the better product — but **nothing in the repo records it**, so it reads as drift and the next pass finds it again. Also needs an **empty-hub customer fixture**: the E2E customer has bookings and `.claude/rules/e2e-auth.md` forbids a throwaway account, so the empty rail has never been driven. |
| **360** | **09 Vendor storefront editor — cover, preview rail, nav and the unsaved-work guard** | P1 | M3 | **P0 Critical** | **In Progress** | worktree-360 | **None** | `core` `storage` `stripe` | **Filed 2026-08-30 by the second backlog consolidation.** Merges **#299, #338, #349**. **#338 is a duplicate** — "the section nav carries `Payouts` and its gold dot" is already acceptance line 5 of #299 (filed there as #140) — and #349 is the same route's form. #299 in turn merges #137, #138, #140, #141, #152, #257, #258, #288, with **#288 leading** because it unblocks #137. **D16 settled the field question:** `Your line` and `Years in business` are **relocated, not deleted** — both are the only editing surface for content frame `03` displays, so deleting the editor without the display leaves content nobody can change. The `Payouts` dot reads real Stripe onboarding state and is **gold, never red**. Re-measure frame `09`'s nav in full first: the pass that found the missing entry was scoped to the Tags row. |
| **361** | **Site header and chrome — signed-in cluster, notification dropdown, avatar alt** | P1 | M3 | **P2 Medium** | **Backlog** | — | **None** | `core` `auth` | **Filed 2026-08-30 by the second backlog consolidation.** Merges **#336, #351, #352** — `site-header.tsx`, `NotificationBell` and the Clerk `UserButton`, found and fixed in one signed-in render on every page. **They are one ticket for the reason each slipped:** as #352 puts it, *"the user menu is chrome rather than a framed screen, so no parity pass owns it."* The link text needs no ruling — frame `02` draws `Bookings`, live draws `Dashboard` at `site-header.tsx:157`, and the frame is the authority. **The bell is the open question and must not be deleted to pass parity**: it is a real surface with real behaviour and a frame that predates it is not evidence it should go. The avatar alt reads `"'s logo"` on both roles — a data defect, not a template one, so the fix belongs where the name is resolved. |
| **362** | **[PLATFORM] External-account provisioning — one dashboard session** | INFRA | M-OPS | **P0 Critical** | **Deferred — needs a human** | — | **The account holder — every item is a provider-console action** | all | **Filed 2026-08-30 by the second backlog consolidation.** Merges **#19, #46 (residual), #62, #206**. Every item is the same actor doing the same kind of thing — signing into a provider console to mint, rename or rotate a value — and **none of it is repository code**. Three of the four already point at each other: #62 calls itself *"a #19 prerequisite"*, #206's Notes say it *"overlaps #19"* and is *"a pointer, not a queue item"*, and #46's remaining scope is one rotation (its code scopes 1 and 2 are Done in `34cd28c`, `ed41aed`). Split, this is four separate asks of one person. The checklist: **rotate `CLERK_WEBHOOK_SECRET`** (leaked to a transcript 2026-08-27 — rotate, deleting is not enough); **rename the Clerk application** to `BRAND_NAME`, which is the source every `{{applicationName}}` key reads; **change the Stripe public business name** from `VendYou`, which renders on Connect onboarding, on Checkout and as the **statement descriptor**; **mint production credentials** in Clerk, Stripe, R2 and Resend, newly minted rather than copied; pooled string on Railway, unpooled on Railway **and** GitHub Actions. **Supplying `SENTRY_DSN` belongs here too and unblocks #353.** The Neon Launch upgrade (#206) stays **launch-gated** in `docs/pre-launch.md` §3.2 and is not current work. |
| **363** | **Repo guardrails — lane tooling, preflight hygiene, seed and route ledgers** | P2 | M4.5 | **P2 Medium** | **Backlog** | — | **None** | `core` `stripe` | **Filed 2026-08-30 by the second backlog consolidation.** Merges **#334, #341**; #334 in turn merges #316 and #319. **All of it is tooling and tests — no user-facing behaviour, so no parity gate and no browser pass** — which is the whole reason to batch it: they share the entire verification shape. #341 is the same species as the rest, a guard closing a class of mistake three seeds made independently. Contents: `lane:up` **seeds** rather than only migrating (lane 9 came up with 0 categories and every vendor surface 404ing); `laneUp` re-derives `worktreePath` on an active manifest (#256); preflight compares the `stripe listen` secret against `STRIPE_WEBHOOK_SECRET` by **digest only**; `ulimit -n 65536` before `next dev` (three lanes died on `EMFILE` reported as a Clerk middleware error); `POST /vendor/stripe/connect` answers **403 not 400** to a customer's malformed body; the `packages/preflight` parallel-run flake is **reproduced before it is fixed** (#64); seeds write slugs not labels, with a guard over `EVENT_TYPES`; and the route/frame ledger becomes a **test** over `apps/web/src/app/**/page.tsx`, because #80's five unframed routes are now nine and prose did not notice. |
| **364** | **Remove the `▾` disclosure caret from every dropdown trigger — user override** | P1 | M3 | **P1 High** | **Backlog** | — | **None** | `core` | **Filed 2026-08-30 on the user's explicit instruction**, corrected the same day after the first draft aimed at the wrong element. The target is the **small triangle at the right-hand end of each input** — the `▾` / `▴` glyph the hero's `Vendor type`, `City` and `Event date` segments carry on the landing page. It comes off **everywhere**, not only there: **12 render sites across 9 files**. **This is a deliberate deviation from the design contract, not a parity finding** — the frames draw the caret and `42-dropdowns.md` specifies it, and the user is correcting `Orla - Screens.dc.html` themselves. Recorded so the next `parity-checker` pass reads it as an accepted override rather than re-filing it as a regression. **Flagged, not blocking:** these triggers are custom `button`s, not native `<select>`s, so the caret is their only visual disclosure cue — keep each trigger legible as a control by its own fill and border, and keep `aria-expanded` on all of them, since the glyph is decorative and already hidden from the accessibility tree. |
| **365** | **12 Sign up — the D16 copy ruling and four measured gaps** | P1 | M3 | **P1 High** | **Superseded** | — | **None** | `core` `auth` | **Superseded 2026-08-30 the same evening it was filed — merged into #313**, which already owned this surface. Filing it was a duplicate: #313 merges **#194**, whose entire content is `Create my account` versus Clerk's `Continue`, and D16 unblocked #313 with that exact ruling. The row stays because its **measurements are new** — they were taken by `parity-checker` during #357 and are now acceptance lines on #313 — and because `pnpm preflight --ticket 365` should still gate. **Never worked directly.** Filed 2026-08-30 from #357's parity pass. D16 ruled `Create my account` **a code defect, not a plan gap** (`21-sign-up.md:61-66`), and the app still renders **`Continue`** — `#357`'s own notes said this one "was already right", which was wrong. `clerk-copy.ts:7-11` carries a comment claiming `21-sign-up.md` records a deviation; that file rules the opposite, so the comment is **stale against D16** and must be corrected, not just the string. Measured on frame `12` at 1440x900: password helper **`At least 10 characters` is absent** (frame line 1440); sub-headline **15px, frame says 14**; helper under submit **11px, frame says 11.5**; `VENDING` micro-label resolves `sage-200 #A8C08E` where the frame draws **`#C4D6A8`**, which `01-foundations.md` says to mint as **`sage-175`** — the token does not exist in `theme.css`. Panel padding 48px all round vs the frame's `46px 48px`, sub `max-width` 400 vs 415. **Not a finding:** the disabled submit is `stone-500` where the frame draws `#9A9184`, and `01-foundations.md:95-98` bans that value by name — the app is right and the frame is the outlier |
| **366** | **16 Server error — page chrome and type scale** | P1 | M3 | **P2 Medium** | **Backlog** | — | **None** | `core` | **Filed 2026-08-30 from #357's parity pass**, which corrected the CTA (`Browse vendors` -> `/search`) and measured the rest. Frame `16` draws a **bespoke 64px header** — logo left, **`Contact support`** 13.5px/600 `#A34A28` right — and **no footer**; the app renders the full site header and footer, and **`Contact support` exists nowhere**. Consequently the page **scrolls**: `scrollHeight` **964** at a 900 viewport, where frame `16` is a single non-scrolling screen, and the block sits ~100px above the frame's centring. Type: h1 **34px, frame says 38** (`error-screen.tsx:38`); body **12.5px, frame says 14** at lh 1.65 (`error-screen.tsx:42`); reference chip **11px, frame says 12**. The sage banner is the shared `Banner status="settled"` — `sage-50` fill is right, but it carries a `sage-300` border, radius 14 and weight 400 where the frame draws **no border**, radius 10, `padding:11px 16px`, weight 500. That last one is **frame vs component library** and needs a ruling before it is coded. Also: the body renders curly apostrophes where the frame writes straight ones, and `/sign-up` renders straight ones — the app is inconsistent with itself |
| **367** | **18 Search no results — empty glyph, relaxations, and `all two filters`** | P1 | M3 | **P2 Medium** | **Backlog** | — | **#358** | `core` | **Filed 2026-08-30 from #357's parity pass.** **A real copy defect first:** with two filters set the headline reads **`No photographers match all two filters`** — `relaxations.ts:102` composes `all ${spelled(count)} filters` and `spelled(2)` returns `"two"`; it should read `both`. Three filters reads correctly. Frame `18` draws the empty state's glyph as **the Orla mark drawn absent** — a 62x38 group of two 38px circles, one `1.5px solid #D5CEC2`, one `1.5px dashed` — and the app renders a **32x32 lucide `circle-x`**; the colour is right, the shape is a generic icon. Relaxation buttons: frame draws `Search within 100 mi` (`.btnP`) - `Any price` - `Any date`; app draws `Any date` (`.btnP`) - `Any price` - `Anywhere` **plus a fourth underlined `Clear all` the frame does not draw**. The distance relaxation has no corresponding filter in the product, so that third is **partly unbuildable as drawn** — but the extra button and the reordering are not. A count row (`0 photographers in Marfa` + the price line) sits between the Refine bar and the empty block where the frame goes straight through. **Blocked by #358**, which owns the same `vendor-card.tsx` and the Refine bar. **Do not remove the sage chip from the nearby-dates band** — it is one of only two surviving sage sites, and the band's cards are `VendorCard`s, so #358's removal must spare it. The band itself was **unverifiable, not missing**: the lane DB has no availability rows at all. **Not a finding:** the diagnosis sentence differs from the frame deliberately (`relaxations.ts:126-135` — the market-size claim is unmeasured, and no-invented-numbers forbids it) |
| **368** | **A failed search is indistinguishable from an empty one** | P2 | M4.5 | **P1 High** | **Backlog** | — | **None** | `core` | **Filed 2026-08-30 from #357's browser pass**, found while the API rate limit was deliberately exhausted. `search-shell.tsx:171` catches the failure with a bare `.catch(() => {})`, so `/search` renders the **empty-result heading with no error state and nothing in the console** — a reader cannot tell a broken search from a genuinely empty one, and neither can a verifier. That is the same class as the labelled-hatch finding #357 just closed: a developer-facing failure rendered as ordinary product copy. `40-states.md` is the law here — steel is information, **red is failure** — and the failed branch currently draws neither. Needs a real error state, and a test that asserts the two branches differ |
| **369** | **Retire or keep `Placeholder`, and rule the 32x32 icon-only submit** | P2 | M4.5 | **P3 Low** | **Backlog** | — | **None** | `core` | **Filed 2026-08-30 from #357's passes — two loose ends, both needing a decision rather than an obvious fix.** (1) **`placeholder.tsx` is now dead.** After #357, `grep -rn "<Placeholder"` over `apps/web/src` returns nothing; only the component, its test and the `.placeholder-hatch` utility remain. That is consistent with D17's *never on a public page*, but the hatch is still legitimate as a **build-time device** and `image-upload.tsx` uses the utility directly. Decide: keep it as an editor-only primitive with a rule that bans it from public surfaces, or retire the component and keep the utility. (2) **The `/search` header submit is 32x32**, below the **44x44** minimum in `04-laws.md`, and it is the only icon-only control on the page. It carries `aria-label="Search"`, so this is target size, not labelling. **The law and the frames are in standing conflict** — frames `02`, `18` and the five-siblings ruling all draw a 30-32px circle — so this needs a ruling, and nothing in the repo currently checks the law either way |
**This board carries open work only. The closed rows live in `.claude/plans/vendor-marketplace-tickets-archive.md`**, whole — **310 rows as of 2026-08-30: 172 `Done` and 138 `Superseded`**, recounted programmatically in the second consolidation, which also moved #14 and #305 across. The earlier figures here (311 / 180 / 131) were a snapshot that nothing updated as rows moved, with their detail sections. Nothing was deleted or summarised. Read the archive when a Notes cell names a ticket you cannot find here; `packages/shared/src/env/tickets.ts` still holds a registry row for every archived number, so `pnpm preflight --ticket <old n>` gates unchanged, and `tickets.board.test.ts` reads both files so an archived row still has to agree with its registry entry.

Rows are ordered by build sequence, not by ticket number. **45 rows — 20 open (17 Backlog, 1 In Progress, 2 Deferred) and 25 `Superseded`.** **#14 and #305 moved to the archive in this pass**, restoring the 2026-08-30 convention that this board carries open work only; they had been left here after closing. Recounted programmatically on 2026-08-30 after the **second backlog consolidation**, which replaced 25 rows with **#354–#360**. That pass was only possible because D16 and D17 had just ruled every open design question: eleven rows that could never start became ordinary code work, and the shape underneath them — twenty-five rows that were really seven pieces of work — became visible. **The blank line that had split this table in two is gone**; rows #332–#352 had been rendering as a separate headerless table, though `tickets.board.test.ts` parses line by line and never noticed. **A Backlog count is still not a ready count** — **#20** waits on #359 and **#353** on the Sentry DSN, and #355 is sequenced behind #354, which owns `Orla - Screens.dc.html` for one pass. Read `Blocked By`, and trust `pnpm preflight --ticket <n>` over both.

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

### #340: Playwright E2E harness and the eight critical-journey suites

**Milestone:** M6 | **Priority:** P1 High | **Status:** Backlog | **Capabilities:** `core` `auth` `stripe`

**Filed 2026-08-30 by lane 14**, split out of #14.

**Current state, verified 2026-08-30:** the repo has **no `playwright.config.*`,
no `e2e/` directory and no test-runner harness**. Playwright here is MCP-driven,
for agentic browser verification by the `browser-verifier` and `parity-checker`
agents — that is a different thing from a committed suite, and none of it is
reusable as one. `pnpm e2e:auth` and the `.auth/` storage-state files
(`.claude/rules/e2e-auth.md`) already exist and **are** reusable: agents never
type a password, they load a role's storage state. The suites should do the same.

**User value:** Every critical user journey is defended by a test that runs in
CI, so a regression in booking, payment or messaging is caught before a human
sees it.

**Scope:**

- `apps/web`: `playwright.config.ts`, an `e2e/` directory, and the `test:e2e` script
- Eight suites covering the critical journeys
- `@clerk/testing` for programmatic sign-in, reusing the `.auth/` storage state
- Stripe test mode: `pm_card_visa`, and test webhook events via `stripe trigger`

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

- `pnpm --filter web test:e2e` — all 8 suites pass, at the reference viewport (1440×900) plus 1024, 768 and 390
- Suites select on the fixed UUIDs `seed:demo` derives (`demoVendorProfileId`), not on copy that a text change will break
- A suite must fail loudly if a fixed UUID it selects on has drifted, rather than silently selecting nothing
- Suite 8 needs the admin portal, so it lands with or after **#15**

**Non-goals:** load or performance testing; visual-regression snapshots.

**Acceptance:**

- [ ] All 8 suites pass at 1440×900, and the responsive suites at 1024 / 768 / 390
- [ ] Suites use the fixed UUIDs, not text selectors that copy changes will break
- [ ] A drifted UUID fails the suite with a message naming the missing entity
- [ ] Sign-in uses the stored `.auth/` state, never a typed password
- [ ] The suites run against a `seed:demo` database, seeded by the harness

**Blocked by:** #14

---

### #341: `seed:marketing` and `seed:e2e` write an event-type label into a slug column

> **Superseded — merged into #363 on 2026-08-30 by the second backlog consolidation.**
> **Do not work this ticket directly.** This section is kept for the measurements and
> the reasoning #363 was built from, and so `pnpm preflight --ticket 341` still gates for
> anyone on a branch or commit message that predates the merge.

**Milestone:** M6 | **Priority:** P2 Medium | **Status:** Superseded | **Capabilities:** `core`

**Filed 2026-08-30 by lane 14**, found while fixing the same defect in the new
demo seed.

**Observed:** `packages/db/src/seed-marketing.ts:406` and
`packages/db/src/seed-e2e.ts:465` both write `eventType: 'Wedding'`.

**Expected:** `'wedding'`. `booking_requests.event_type` holds a value from
`EVENT_TYPES` — the closed vocabulary in `packages/shared/src/constants` — and
`eventTypeSchema` (`z.enum(EVENT_TYPES)`) enforces it at the API edge. The
display string lives separately in `EVENT_TYPE_LABELS`.

**Why it matters:** the row is one the product itself would reject on write.
Nothing fails today because the read schema deliberately types the column as a
plain string (`packages/shared/src/schemas/index.ts:607`) to tolerate rows
written before the vocabulary existed — so this is silent until a surface
renders the label through `EVENT_TYPE_LABELS` and gets `undefined`, or a
validating read is added.

**Reproduction:** `pnpm db:seed` then `pnpm db:seed:marketing`, then
`select distinct event_type from booking_requests` — `Wedding` appears
alongside the slugs.

**Scope:**

- Correct both call sites to a slug.
- **Close the class rather than the two instances.** Add a guard asserting that
  every `event_type` any seed writes is in `EVENT_TYPES` — a written rule is what
  let three seeds make the same mistake independently. `seed-demo.test.ts` already
  has this assertion for its own seed; generalise it.

**Acceptance:**

- [ ] No seed writes an `event_type` outside `EVENT_TYPES`
- [ ] A test fails if one is reintroduced, naming the seed and the bad value
- [ ] Existing rows carrying a label are corrected on the next seed run, not stranded (`.claude/rules/db-schema.md`)

**Blocked by:** None

---

### #346: `/messages` keys threads by vendor, so one booking's question lands in another's thread

**Milestone:** M3 | **Priority:** P1 High | **Status:** In Progress | **Capabilities:** `core`
**Blocked by:** None

**Filed 2026-08-30 by lane 305**, carved out of #81 (item 3). #305 fixed #81's
copy and markup findings; this one is a data-model change and does not belong in
a compliance sweep.

**Observed:** `/messages` lists one thread per vendor, subtitled with one
arbitrary booking out of however many the customer has with them. A customer
asking about their Jun 11 fundraiser sends the message into a thread the vendor
reads as "Mar 15 birthday".

**Expected:** a message about a booking is readable against that booking.

**What already exists:** `conversations` carries a nullable `booking_request_id`
and a `conversations_request_key` unique index, so the schema already permits a
thread per request — `booking-requests.dao.ts` opens one on request creation.
What is missing is the read path, the list grouping, and a rule for the
vendor-initiated thread that belongs to no request (`conversations_customer_vendor_open_key`
covers exactly that row).

**Needs a ruling first:** how a customer with three bookings from one vendor is
listed — three rows, or one row that opens to three. `18-messaging.md` draws a
single list and does not answer it, so building either shape is a guess.

**Acceptance:**

- [ ] A message sent from a booking is read against that booking, by both sides
- [ ] The list distinguishes threads that share a vendor
- [ ] A vendor-initiated thread with no request still has somewhere to live
- [ ] The ruling above is recorded in `99-open-questions.md` before implementation

---

### #347: `/search` has no pagination control, so page 2 is unreachable and page 2+ renders blank

> **Superseded — merged into #358 on 2026-08-30 by the second backlog consolidation.**
> **Do not work this ticket directly.** This section is kept for the measurements and
> the reasoning #358 was built from, and so `pnpm preflight --ticket 347` still gates for
> anyone on a branch or commit message that predates the merge.

**Milestone:** M3 | **Priority:** P2 Medium | **Status:** Superseded | **Capabilities:** `core`
**Blocked by:** None

**Filed 2026-08-30 by lane 305**, carved out of #81 (item 4) as a missing
feature rather than a defect in an existing one.

**Observed:** `/search?page=2` returns HTTP 200 with a blank results pane while
the `h1` still claims the full count. No control anywhere reaches page 2, and
`pageSize=20` against 17 vendors means nothing is currently lost — which is why
this is Medium rather than High, and why it will stop being true the moment the
marketplace grows.

**Two halves, and only the second is unambiguous:**

1. **The control.** Frame `02 Search` draws no pagination, so its shape — pages,
   "load more", or an infinite rail — is a design ruling, not an implementation
   choice.
2. **The out-of-range page.** Whatever the control turns out to be, `?page=99`
   must render an empty state whose heading agrees with its body instead of a
   blank pane under a contradicting count. That half can land first.

**Acceptance:**

- [ ] An out-of-range page renders an empty state whose heading agrees with the body
- [ ] The heading never claims a count the pane does not show
- [ ] A control exists to reach every page the API will return, in the shape the ruling picks

**Tests (required):**

- [ ] A test asserting an out-of-range page renders an empty state whose heading agrees with the body

---

### #348: [DESIGN] Does a real vendor with no cover get the labelled placeholder, or a designed empty state?

> **Superseded — merged into #357 on 2026-08-30 by the second backlog consolidation.**
> **Do not work this ticket directly.** This section is kept for the measurements and
> the reasoning #357 was built from, and so `pnpm preflight --ticket 348` still gates for
> anyone on a branch or commit message that predates the merge.

**Milestone:** M3 | **Priority:** P2 Medium | **Status:** Superseded | **Capabilities:** `core`
**Blocked by:** A design ruling

**Filed 2026-08-30 by lane 305**, the residue of #228 after #305 closed its
literal finding.

**What #305 closed.** #228 measured the string `COVER · FULL-BLEED BANNER`
rendering in the cover band of every vendor without a cover image. That
composition no longer exists: `CHANGE-ORDER-2026-08-29.md` retired the
full-bleed banner and the avatar overlapping it, and `profile-header.tsx`
records why. The finding as written is fixed.

**What is left is a conflict between two documents, not a bug.**

- `03-components.md` defines `Placeholder` as "stand-in imagery **until real
  photography exists** — a hatched swatch with a mono label naming the shot it
  is waiting for … the label is the point, because it reads as deliberately
  unfinished". `web-design-parity.md` reinforces it, permitting "real
  photography in place of the labelled placeholders" as one of only three
  allowed differences from a frame.
- Both of those are about **the product** lacking photographs before launch.
  #228 was about a **different absence**: a real vendor who has completed
  onboarding and not uploaded a cover. Their live public page then tells their
  own customers that the page is unfinished.
- `40-states.md` would give that second case a designed empty state — glyph,
  headline, one sentence, one CTA — not a build-time stand-in.

**The question:** does `Placeholder` apply to a real vendor's missing cover, or
only to the pre-launch product? If the latter, the vendor profile and the search
card both need a designed coverless state.

**Not decidable in a sweep.** #305 had no mandate to overrule `03-components.md`,
so it closed the finding and filed this. The cover *upload control* is a separate
missing piece and lives in **#299**.

**Acceptance:**

- [ ] The ruling is recorded in `99-open-questions.md`
- [ ] If a designed empty state wins, it is drawn as a frame before it is built

---

### #349: Back and Forward discard unsaved profile edits without prompting

> **Superseded — merged into #360 on 2026-08-30 by the second backlog consolidation.**
> **Do not work this ticket directly.** This section is kept for the measurements and
> the reasoning #360 was built from, and so `pnpm preflight --ticket 349` still gates for
> anyone on a branch or commit message that predates the merge.

**Milestone:** M3 | **Priority:** P2 Medium | **Status:** Superseded | **Capabilities:** `core`
**Blocked by:** None

**Filed 2026-08-30 by lane 305** — the third exit #227 did not name, found by
reviewing the guard #305 built for the first two.

**Observed:** on `/vendor/profile/edit` with unsaved changes, pressing Back (or
a trackpad swipe) navigates away and loses the edits with no prompt — #227's
exact symptom through a different trigger.

**Why #305 did not cover it.** `useUnsavedChangesGuard` covers the two exits it
documents: `beforeunload` for leaving the site, and a capture-phase click
intercept for a `<Link>` or `<a>`. A history navigation is neither.
`beforeunload` does not fire for a same-document one, and `popstate` arrives
**after** the entry has already changed — so the only way to "block" it is to
push a decoy entry on mount and re-push it on every `popstate`, which corrupts
the history stack the user is trying to walk and breaks a second Back press.
Next's App Router exposes no supported navigation-blocking API.

Covering it badly is worse than the gap, so #305 left it uncovered and said so
in the hook's own contract rather than implying the surface was complete.

**Needs one of:** a supported blocking API (watch `next/navigation`), or a
ruling that the decoy-entry trade is acceptable and what it should do on a
second Back.

**Acceptance:**

- [ ] A dirty form prompts on Back, or the ruling records why it deliberately does not
- [ ] Whatever lands does not leave the history stack in a state a second Back handles wrongly
- [ ] `useUnsavedChangesGuard`'s contract comment matches what it actually covers

---

### #350: The 500 page offers "Go to my bookings" to a signed-out visitor, and the frame draws it that way

> **Superseded — merged into #357 on 2026-08-30 by the second backlog consolidation.**
> **Do not work this ticket directly.** This section is kept for the measurements and
> the reasoning #357 was built from, and so `pnpm preflight --ticket 350` still gates for
> anyone on a branch or commit message that predates the merge.

**Milestone:** M3 | **Priority:** P3 Low | **Status:** Superseded | **Capabilities:** `core`
**Blocked by:** A design ruling

**Filed 2026-08-30 by lane 305**, carved out of #81 (item 7).

**Observed:** the 500 page's secondary CTA is "Go to my bookings", offered to a
visitor who by definition has none.

**Why this is a ruling and not a fix.** #305 changed the label to "Browse
vendors" and then reverted it. Frame `16` (`design/Orla - Screens.dc.html`)
draws `Go to my bookings` verbatim, and every other string on that screen —
`500 · SERVER ERROR`, `Something broke on our end`, `This wasn't anything you
did…`, `No payment was taken and no booking was changed.`, `Try again` — matches
the frame exactly. `.claude/rules/web-design-parity.md` is explicit: "Same
composition with reworded copy has failed too — the words *are* the design", and
"Design passes edit the plan. Tickets write the code. Never the reverse."
Rewording approved copy to fix a logic problem is that reversal.

**A complication for whoever rules on it.** `global-error.tsx` replaces the root
layout, so it renders outside the Clerk provider and cannot ask who is reading —
and it is the boundary that catches the errors most likely to be genuine 500s.
Any auth-aware answer therefore needs a default for the case where the answer is
unknown, and the frame supplies none.

**The options, so the ruling has something to pick from:**

1. A second frame for the signed-out 500, with its own CTA.
2. A destination true for both readers, drawn into frame `16`.
3. Accept the inaccuracy: a signed-out visitor following it lands on sign-in
   carrying a return path, which is not broken, only mislabelled.

**Acceptance:**

- [ ] The ruling is recorded in `99-open-questions.md` or the decisions log
- [ ] If the copy changes, `design/` changes first and the code follows

---

### #351: The notification dropdown's empty state is a bare paragraph, not an `EmptyState`

> **Superseded — merged into #361 on 2026-08-30 by the second backlog consolidation.**
> **Do not work this ticket directly.** This section is kept for the measurements and
> the reasoning #361 was built from, and so `pnpm preflight --ticket 351` still gates for
> anyone on a branch or commit message that predates the merge.

**Milestone:** M3 | **Priority:** P3 Low | **Status:** Superseded | **Capabilities:** `core`
**Blocked by:** None

**Filed 2026-08-30 by lane 305**, found by browser verification.

**Observed:** the notification dropdown renders

```html
<p class="px-4 py-6 text-center text-base text-stone-600">No notifications yet</p>
```

No glyph, no heading, no CTA; `closest('[data-slot="empty-state"]')` is null.

**Why it surfaced now.** #305 made the two-circle glyph the default for every
`EmptyState`, so the nine call sites gained it without being edited. This one is
not a call site, so the default cannot reach it — it is the only empty state in
the product that opted out by never opting in.

**Not a mechanical swap.** `40-states.md` lists empty states by screen and names
no dropdown among them, and frame `08/09/11 shared` draws the panel without one.
A full glyph-headline-sentence-CTA stack inside a dropdown that size may be
wrong; the point is that the decision should be made rather than inherited from
whoever wrote the paragraph.

**Acceptance:**

- [ ] Either the dropdown uses `EmptyState`, or the frame's treatment is recorded as deliberate
- [ ] Whatever lands is reachable from the glyph guard in `empty-state-callers.test.ts`, or exempted there in writing

---

### #352: The user-menu avatar's alt text reads "'s logo" — the business name interpolates empty

> **Superseded — merged into #361 on 2026-08-30 by the second backlog consolidation.**
> **Do not work this ticket directly.** This section is kept for the measurements and
> the reasoning #361 was built from, and so `pnpm preflight --ticket 352` still gates for
> anyone on a branch or commit message that predates the merge.

**Milestone:** M3 | **Priority:** P2 Medium | **Status:** Superseded | **Capabilities:** `core` `auth`
**Blocked by:** None

**Filed 2026-08-30 by lane 305**, found by browser verification on every
signed-in page, for both roles.

**Observed:** the user-menu avatar carries `alt="'s logo"`. The name that should
precede the possessive is an empty string, so a screen-reader user hears a
possessive with nothing in front of it.

**Expected:** the account's business or personal name, or — if no name is
resolvable at that point — an alt that does not imply one was expected.

**Where to look.** The template is right and the value reaching it is not, so
the fix belongs wherever that name is resolved for the menu, not in the alt
attribute. Worth checking whether the same value is empty anywhere else it is
rendered without a possessive to make it obvious.

**Why nothing caught it.** `04-laws.md` covers alternative text and the parity
`Access` axis is the gate for it, but the user menu is chrome rather than a
framed screen, so no parity pass owns it.

**Acceptance:**

- [ ] The alt text names the account, on both roles
- [ ] A test asserts the alt is non-empty and does not begin with an apostrophe

---

### #15: Admin Portal

**Milestone:** M6 | **Priority:** P1 High | **Status:** Backlog | **Capabilities:** `core` `auth`

**Sentry moved out to #353 on 2026-08-30.** This ticket is the admin portal alone and needs no credential.

**Design:** `design/design-plan/22-admin.md`. Frame: `13 Admin`.

**Old-design debt:** these surfaces are new, so they are built on Orla tokens and the `03-components.md` vocabulary from the first commit — no `primary-*`, no brand literal, no inline hex. Any pre-Orla file this ticket edits in passing comes across whole rather than part-migrated; anything it cannot clear without leaving scope is named in the Notes column.

**Orla screen `22` — admin:** an operations tool. Same typography and palette, **denser layout** — scannability beats airiness, and the whitespace moves to the gutters.
- The header **inverts to `stone-900`** with a translucent "Admin" chip — an unmistakable signal you're on the ops side of the product. Sidebar 210px: Overview · Vendors · Customers · Bookings · Payments · Reviews (count) · Categories & tags.
- Title row: "Vendors" (Serif 23px) with a count line in `stone-600` ("412 total · 38 awaiting review · updated 2m ago").
- **Filter bar above the table, never a modal**: search input, the active saved filter as a `clay-400` filled button ("Awaiting review (38)"), Category / City / Payouts dropdowns, then "Export CSV" as a right-aligned ghost link.
- Table: `bg-stone-0`, 1px `stone-300`, 12px radius, `overflow:hidden`. Header row `bg-stone-100`, 10.5px uppercase, **fixed**; the body scrolls internally; the page does not scroll. Rows 44px, zebra with `#FDFAF4`. Row-select checkbox first column, overflow menu last. Columns: Business · Category · City · Rating · Bookings · Status · actions, with the standard status pills — Live (sage), Review (gold), Flagged (clay), Paused (stone).
- **Fifteen rows fit at 1440×900. Count them against the real header height before claiming a number** — a table that promises eighteen and clips three is a bug, and this was the most common defect in design review.
- Bulk actions appear only when rows are selected. Overview: four metric cards then Recharts line charts colour-coded by meaning — revenue gold, bookings clay, users steel, completion sage. Every destructive action goes through an AlertDialog naming the consequence.

**User value:** Platform operator has a control plane for oversight.

**Scope:**
- `apps/api`: Admin route group (`/admin/*`), admin service + DAOs, ban middleware
- `apps/api`: Tag moderation routes — `GET /admin/tag-suggestions` (list pending), `PUT /admin/tag-suggestions/:id` (approve/reject)
- `apps/web`: Admin layout, dashboard (metrics + charts), vendor/user/booking/review management pages, category management
- `apps/web`: Tag moderation page — list pending suggestions with vendor name, suggested tag, category. Actions: Approve (creates tag in `tags` table, sets `resolved_tag_id`, notifies vendor), Reject (with optional admin note), Merge (link to existing similar tag). Shows approved/rejected history.
- `apps/web`: Tag management — view all active tags by category, deactivate tags, edit display names, reorder
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

### #353: [PRE-LAUNCH] Sentry integration

**Milestone:** M6 | **Priority:** P2 Medium | **Status:** Deferred — needs a human | **Capabilities:** `core` `sentry`

**Blocked by:** `SENTRY_DSN`, which only the account holder can mint at
https://sentry.io. **Carved out of #15 on 2026-08-30** because those two scope
bullets were holding a P1 admin portal behind a credential.

**Why it is launch-prep, not current work.** Sentry catches errors in a deployed
environment. #19 provisions that environment; until it exists there is nothing to
instrument but a laptop, and the local stack already surfaces its own stack
traces. It belongs in the same sitting as #19, #62, #46 and #206.

**Scope:**

- `apps/api`: `@sentry/node` — request handler, error handler, release tagging
- `apps/web`: `@sentry/nextjs` — client, server and edge configs, source maps
- `SENTRY_DSN` added to the env registry in `packages/shared/src/env/`, and to
  `turbo.json`'s `globalPassThroughEnv` **by regenerating, never by hand**
- `pnpm env:example` re-run so `.env.example` carries the new key

**Behavioral requirements:**

- Unhandled errors reach Sentry from both apps, with the user id attached where a
  session exists and **never** the email or any Clerk token
- Payment errors are tagged `critical` — a failed charge is the one error class
  that costs someone money while they watch
- **The DSN is read from the environment and never inlined**, per `CLAUDE.md`.
  A development default must not be able to reach the production project
- Sampling is explicit, not left at the SDK default, so the free tier's quota is
  a decision rather than a surprise

**Tests (required):**

- The env registry rejects a missing or malformed `SENTRY_DSN` in production and
  tolerates its absence in development
- A captured error carries the user id and **no** email — asserted against the
  scrubbing hook, not the network

**Acceptance:**

- [ ] `pnpm preflight --ticket 353` passes with a real DSN in `.env`
- [ ] An error thrown in each app appears in the Sentry project
- [ ] `git grep` finds no DSN literal anywhere in the tree

### #19: Production Environment Provisioning

> **Superseded — merged into #362 on 2026-08-30 by the second backlog consolidation.**
> **Do not work this ticket directly.** This section is kept for the measurements and
> the reasoning #362 was built from, and so `pnpm preflight --ticket 19` still gates for
> anyone on a branch or commit message that predates the merge.

**Milestone:** M4.5 | **Priority:** P0 Critical | **Status:** Superseded | **Capabilities:** all
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

### #46: Clerk webhooks point at a CLI relay, not the API

> **Superseded — merged into #362 on 2026-08-30 by the second backlog consolidation.**
> **Do not work this ticket directly.** This section is kept for the measurements and
> the reasoning #362 was built from, and so `pnpm preflight --ticket 46` still gates for
> anyone on a branch or commit message that predates the merge.

**Milestone:** M4.5 | **Priority:** P1 High | **Status:** Superseded | **Capabilities:** `core` `auth`
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
### #62: Stripe public business name is "VendYou", not Orla

> **Superseded — merged into #362 on 2026-08-30 by the second backlog consolidation.**
> **Do not work this ticket directly.** This section is kept for the measurements and
> the reasoning #362 was built from, and so `pnpm preflight --ticket 62` still gates for
> anyone on a branch or commit message that predates the merge.

**Milestone:** M4.5 | **Priority:** P1 High | **Status:** Superseded | **Capabilities:** `core` `stripe`
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

### #299: 09 Vendor profile editor — cover field, preview rail and parity close-out

> **Superseded — merged into #360 on 2026-08-30 by the second backlog consolidation.**
> **Do not work this ticket directly.** This section is kept for the measurements and
> the reasoning #360 was built from, and so `pnpm preflight --ticket 299` still gates for
> anyone on a branch or commit message that predates the merge.

**Milestone:** M3 | **Priority:** P0 Critical | **Status:** Superseded | **Capabilities:** `core` `storage`
**Blocked by:** #298

Merges **#137, #138, #140, #141, #152, #257, #258, #288**. **#288 leads and unblocks #137**,
which was stuck because the design contract contradicted itself on the cover field.

**Acceptance:**

- [ ] The media row is a 128px circle profile photo beside a **216x144, 3:2** cover drop zone
      reading *"Drop a photo or browse · landscape · 1200x800 or larger"*. The `21:9,
      1600x686 min` ask is retired (#288), and the drop zone that is missing entirely today
      exists (#137)
- [ ] **There is no separate profile-banner field** — one file, two placements, per #287
- [ ] The card preview is a **308px right-edge rail** at ≥1024 (`stone-100`, `stone-300` left
      border) with a mono `PREVIEW` label, "Updates as you type", an **In search / Your
      profile** toggle and the real card at full size, and **no link out**. 280px at 1280, a
      panel above the fields at 768, a bottom sheet at 390 (#288)
- [ ] The two undocumented fields are removed (#138) and so are the eight helper strings that
      came with them (#152) — every remaining string traces to the frame or to
      `31-content-voice.md`
- [ ] The section nav carries `Payouts` and its gold dot (#140); the dot's state depends on
      **#9**, so if payout status is not yet readable, render the entry and say so in Notes
- [ ] The form pane is inside its scroll budget (#141)
- [ ] The slug preview shows the URL the router actually serves — no extra path segment, no
      vanity URL that 404s (#257)
- [ ] The submit bar says when the storefront was last saved (#258)
- [ ] `parity-checker` returns MATCH on all six axes at **1440 / 1024 / 768 / 390**

**Tests (required):**

- [ ] A test that the slug preview and the route resolve to the same URL — the defect is a
      disagreement between two places, so assert the agreement, not either side
- [ ] Parity assertions read from the frame at test time, at all four viewports

---

### #300: 08 Vendor dashboard — re-measure, then close parity

**Milestone:** M3 | **Priority:** P2 Medium | **Status:** Backlog | **Capabilities:** `core`
**Blocked by:** None

Merges **#124, #127, #135, #79**. #127 and #135 are the **same missing string** filed twice,
once off the Layout axis and once off the Text axis.

**Acceptance:**

- [ ] `parity-checker` was run on frame `08` before any code change, and what now matches is
      closed with that evidence
- [ ] `See all N →` sits beside `Requests waiting on you`, with **N read from the database**
      (#127, #135)
- [ ] `View my public profile` is back in the header where the frame puts it (#124)
- [ ] Vendor nav labels and their order match frame `08` exactly (#79)
- [ ] `parity-checker` returns MATCH on all six axes for frame `08`

**Tests (required):**

- [ ] A parity assertion reading the nav label list and order out of the frame at test time,
      so a reordering fails rather than passing on set equality


### #313: Sign-up and session entry

**Milestone:** M3 | **Priority:** P1 High | **Status:** In Progress | **Capabilities:** `core` `auth`
**Blocked by:** None

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

### #324: 02 Search — the availability chip draws one tone where the frame draws three

> **Superseded — merged into #358 on 2026-08-30 by the second backlog consolidation.**
> **Do not work this ticket directly.** This section is kept for the measurements and
> the reasoning #358 was built from, and so `pnpm preflight --ticket 324` still gates for
> anyone on a branch or commit message that predates the merge.

**Milestone:** M3 | **Priority:** P2 Medium | **Status:** Superseded | **Capabilities:** `core`
**Blocked by:** A scarcity threshold, and a definition for the `New` chip

Carved out of **#297** (filed there as #243). Everything else in #297 landed; this
is the one part that cannot be finished from the repository.

**What is established.** Read from source, not inferred from a dataset:
`vendor-card.tsx` renders exactly one availability tone —
`bg-sage-50 text-sage-600`, reading `Free {date}` — and there is no branch that
can produce another. Frame `02` draws three:

| Tone | Copy | Fill | Text |
| --- | --- | --- | --- |
| sage | `Free Jun 14` | `#EDF0E9` | `#4B5940` |
| gold | `2 dates left` | `#F5EEDC` | `#7A5A12` |
| stone | `New` | `#F0EAE1` | `#4A443C` |

The sage tone ships today and is byte-exact. The other two are blocked.

**Question 1 — what is "scarce"?** `03-components.md:56` says the chip is
"sage when free on the searched date, gold when scarce (\"2 dates left\"),
absent when no date is in the query". It never says what scarce means. The
**count** is a legitimate query result and may ship — but the **threshold** (how
many free days, inside what window, before the chip turns gold) is a number
nothing in the plan or the database supplies, and inventing one is exactly what
the no-invented-numbers rule forbids.

**Question 2 — what is `New`?** The stone `New` chip appears in **no** plan file.
`03-components.md` describes the chip as availability-only and lists two tones.
In the frame it sits on Wildbloom Films, which already shows `★ 5.0 (17)` — so it
does not mean "unreviewed", which is the one reading the code could have
supported. `40-states.md`'s colour law does not cover it either: stone is not one
of its four semantics.

**Acceptance:**

- [ ] A recorded ruling on the scarcity threshold — the window and the count —
      or the gold tone is dropped and `03-components.md:56` is corrected
- [ ] A recorded ruling on what `New` means, or frame `02` is corrected in a
      design pass and the tone is dropped
- [ ] Whatever survives is read from the database at request time. No threshold
      or count is hard-coded in the component
- [ ] The chip carries its meaning in **text**, not only in fill — `40-states.md`

**Non-goals:** the rest of frame `02` (closed by **#297**), the 1024 composition
(**#323**).

**Tests (required):**

- [ ] A test per tone that the chip renders the right copy for the right data,
      driven by the DAO's real output rather than a hand-built prop
- [ ] A test that a vendor with no availability data draws **no** chip, which is
      what "absent when no date is in the query" means

---

### #326: 18 Search no results — residual parity after #297

> **Superseded — merged into #358 on 2026-08-30 by the second backlog consolidation.**
> **Do not work this ticket directly.** This section is kept for the measurements and
> the reasoning #358 was built from, and so `pnpm preflight --ticket 326` still gates for
> anyone on a branch or commit message that predates the merge.

**Milestone:** M3 | **Priority:** P2 Medium | **Status:** Superseded | **Capabilities:** `core`
**Blocked by:** None

The remainder of frame `18` after **#297** closed its headline scale, its measure,
both colour failures and both text failures. Every value below was measured at
1440x900 in Chromium during #297's verification pass.

**Layout.** The count row — `0 photographers in Marfa`, the `free on …` clause and
`Prices are what they charge — no quotes needed` — renders at y=118–173. Frame
`18` draws **no count row**: its pane opens directly into `padding:44px 26px`.
The knock-on is the whole empty state: the glyph sits at y=**221** where the frame
puts it at y=**162**.

**Style — the shared compact header bar.** Measured against frames `17`/`18`,
since frame `02`'s header is ruled stale by **#57**:

| Element | Frame | Live |
| --- | --- | --- |
| Bar padding | `0 5px 0 18px` | `0 4px 0 16px` |
| Segment value | 13px / 500 | 13.5px / 400 |
| Segment inner padding-left | 16px | 14px |

These are the shared `SearchBar`, so the fix lands on `/search` at every state —
check frame `17` in the same pass.

**Style — the description.** `line-height: 21.6px` against the frame's
`13.5px/1.65` = 22.28px. 0.68px, and `--leading-prose` is global at 1.6, so this
is a per-call-site override on the empty state, **not** a token change.

**Text — needs a ruling, not a fix.** Live draws an `Anywhere` relaxation and a
`Clear all` text button. Neither string is in frame `18` or in
`31-content-voice.md`, and `Clear all` duplicates the Refine bar's own `Clear`
doing the same job on the same screen. The relaxation *set* is legitimately
data-driven — it follows the filters actually applied — so what needs deciding is
the wording and whether the second clear survives.

**Known and owned elsewhere — do not re-file:** the two-circle empty glyph against
the live `SearchX` (**#305**), the `Free on a nearby date instead` band and
`See all 14 in the region →` (**#50**), the wordmark at 24px against the frames'
23px (**#118**).

**Acceptance:**

- [ ] The empty state draws no count row above it, so its glyph lands where the
      frame puts it
- [ ] The compact header bar matches `17`/`18` on all three measurements
- [ ] The empty-state description carries the frame's 1.65, without moving
      `--leading-prose`
- [ ] `Anywhere` and the second `Clear all` are ruled on and the ruling is
      recorded in `31-content-voice.md`
- [ ] `parity-checker` returns MATCH on frame `18` for layout, style, font and
      text, or names only the three tickets above

**Tests (required):**

- [ ] Parity assertions reading the header bar's three values out of frame `17`
      at test time, so `02`'s stale header cannot be picked up by mistake
- [ ] A test that the no-results state renders without the count row, asserting
      the absence by role rather than by class

---

### #327: 01 Landing — the hero query has no seed value, and the frame hard-codes one

> **Superseded — merged into #357 on 2026-08-30 by the second backlog consolidation.**
> **Do not work this ticket directly.** This section is kept for the measurements and
> the reasoning #357 was built from, and so `pnpm preflight --ticket 327` still gates for
> anyone on a branch or commit message that predates the merge.

**Milestone:** M3 | **Priority:** P2 Medium | **Status:** Superseded | **Capabilities:** `core`
**Blocked by:** A product ruling on the hero's seed

Carved out of **#296** (filed there as #88), whose acceptance says in as many words:
*"if no ruling has been given, return `BLOCKED` with that one question rather than
inventing a seed."* No ruling has been given.

**What is measured.** Frame `01 Landing` draws the City segment as the literal
`Austin, TX` in `#23201C` — stone-900, the **filled** tone. Live renders an empty
`input` with `placeholder="Anywhere"` in `#6B6459` — stone-600, the **placeholder**
tone.

**The question is wider than City.** The frame *templates* the vendor type
(`{{ searchValue }}`, hinted "Photography") but *hard-codes* the city. Live renders
`Any vendor type` in the placeholder tone as well, so the hero's centrepiece reads
as three empty fields where the frame reads as a seeded query. Ruling on City alone
leaves the two segments disagreeing on tone.

**The options, and what each costs:**

1. **Seed a real city.** Which one, and on what basis? Geolocation is not MVP, and a
   hard-coded `Austin, TX` is a claim about where the marketplace operates — the
   same class of assertion the no-invented-numbers rule exists for.
2. **Seed nothing, keep the placeholder tone.** The honest empty state, and frame
   `01` is corrected in a design pass. Note `10-landing.md` would need the same
   correction.
3. **Seed nothing, draw the empty value in the filled tone.** Matches the frame's
   colour without inventing a value — but renders as a value that is not there.

**Acceptance:**

- [ ] A recorded ruling covering **both** the City segment and the vendor-type
      segment, including the tone each renders in when unset
- [ ] Whatever is decided is applied to `10-landing.md` and to frame `01` — or to the
      code — so the plan, the frame and the app agree afterwards
- [ ] If a city is seeded, it is read from configuration or from the database, never
      a literal in a component

**Non-goals:** the rest of frame `01`, closed by **#296**.

**Tests (required):**

- [ ] A test that the hero's unset segments render the tone the ruling names — the
      defect is a disagreement between two segments, so assert both together

---

### #332: `state` becomes a closed vocabulary, from the form to the column

**Milestone:** M3 | **Priority:** P1 High | **Status:** Done | **Capabilities:** `core`
**Blocked by:** None

Merges **#330 and #331**, whose detail sections carry the measurements and the rulings this
was built from and stay on the board as `Superseded`.

**Why one ticket.** #330 put the vocabulary in `createVendorProfileSchema` and repaired the
data; #331 constrained the column. #331's own text calls itself *"the layer below #330, not a
duplicate"* — and it is right that a validation layer eleven of twelve writers happen to pass
through is a convention, not a guarantee. But it also states that it must run **after** #330's
repair, because a constraint added while `Austin/Texas` still exists fails on exactly the row
that motivated the ticket. Split, this ships two migrations against one column and leaves the
column unconstrained in between; the intermediate state has no standalone value.

**The defect, measured in the dev database rather than inferred:**

```
    city    | state | count
------------+-------+-------
 Austin     | TX    |    11
 Austin     | Texas |     1
 Buda       | TX    |     2
 Oakland    | CA    |     1
 Round Rock | TX    |     2
```

`findVendorCities` (`vendor-profile.dao.ts:174`) derives the picker with `GROUP BY city, state`
over published profiles — deliberately, so the control can only offer places that have
vendors. That design is right and does not change; it faithfully reproduces whatever the
profiles hold, so a dirty column becomes a dirty picker, and `vendor-search.dao.ts:89` then
filters `lower(state) = lower(?)` into two disjoint result sets.

**It widens with every new vendor.** `apps/web/src/lib/us-states.ts` holds **full names**, and
its own comment says *"Display data only — the column is a plain `varchar`"*. The 11 `TX` rows
are seed data; every vendor who saves through the editor today writes `Texas`. The majority
value is the one nothing produces any more.

**Canonical form is the two-letter USPS code**, ruled 2026-08-30: it is what most rows already
hold, what the card and frames `02`/`17`/`27` draw, a fixed-width token that cannot be
half-typed, and it leaves the editor's dropdown as the single place a code→name map is read.
Full names invert that — one free surface, four needing a map — and carry variants
(`District of Columbia` / `Washington DC`) that codes do not.

**Prefer the enum over a `CHECK`**: it is the pattern the schema already uses for closed
vocabularies (`tag_category`, the status enums), it shows up in `db:studio` as a picker, and
`type-parity.test.ts` already has a place to hold it to the shared constant. A `CHECK` is
acceptable if the enum's migration cost is judged too high — say which was chosen and why.

**City is deliberately scoped down.** A true "only real cities" guarantee needs a US city
dataset — which one, how it is kept current, what happens to a vendor in a town it omits.
**That is not this ticket.** City becomes *consistent* (trimmed, internal whitespace collapsed,
punctuation-only rejected) and stays free text. What makes the bug fixable without a dataset is
that the duplication is entirely in `state`.

**Watch `vendor_profiles_city_state_idx`** (`vendor-profiles.ts:82`) — it is on the pair being
rewritten, so confirm the search plan still uses it after the repair. Do not hand-edit
`packages/db/drizzle/`; edit the schema and regenerate.

**Non-goals:** a validated city dataset; geocoding, `latitude`/`longitude` or
`serviceRadiusKm`; changing how `findVendorCities` derives the picker.

**Acceptance:**

- [ ] A `US_STATE_CODES` constant in `packages/shared/src/constants` is the single list, and
      `createVendorProfileSchema.state` is an enum over it with a message naming the field
- [ ] `POST /vendor/profile` and the update route reject `Texas`, `texas` and `Republic of
      Texas` with a 400, and accept `TX`
- [ ] The editor's State dropdown still shows full names and stores the code; `us-states.ts`
      derives its labels from the shared list rather than restating them
- [ ] City is trimmed and internal whitespace collapsed on write; a city of only punctuation
      or whitespace is rejected
- [ ] `vendor_profiles.state` **cannot hold** a value outside the 51 codes — proven by an
      insert that is rejected, not by reading the DDL
- [ ] The constraint is generated from the shared constant, so the two cannot drift
- [ ] The migration runs the data repair **before** the constraint, in that order, and leaves
      **one** `Austin` row in the dev-database clone with **12** vendors, no profile losing
      its state
- [ ] `GET /vendors/cities` returns one Austin entry, and a search for it returns all 12
- [ ] `pnpm db:seed` and `db:seed:e2e` write codes and still run clean against the
      constrained column
- [ ] A decision is recorded for `users.state` (`users.ts:35`, also `varchar(100)`, a
      customer's own location rather than a search axis) — either way, not silently

**Tests (required):**

- [ ] A schema test rejecting the full name and the lowercase code and accepting the code,
      asserting the **message**, not just the failure
- [ ] A route test that `POST /vendor/profile` with `state: 'Texas'` is a 400 and writes no row
- [ ] A test asserting the rejected insert — the constraint stated at the database boundary
      rather than the Zod one
- [ ] A migration test seeding an `Austin/Texas` and an `Austin/TX` profile, running the
      repair, and asserting one pair and both vendors survive; plus confirmation that the
      constraint **fails** against an unrepaired clone rather than assuming it would
- [ ] A `findVendorCities` test over both spellings asserting a single row with the summed
      count — the defect stated as a test
- [ ] `type-parity.test.ts` holds the enum's values to the shared constant, matching how
      `tagCategoryEnum` is already guarded
- [ ] A test that every `US_STATE_CODES` entry is two uppercase letters and the list has 51
      members, so DC cannot be dropped silently

---

### #333: Token scale completion, and the guard against a step that does not exist

**Milestone:** M3 | **Priority:** P1 High | **Status:** Backlog | **Capabilities:** `core`
**Blocked by:** None

Merges **#303 and #325**, which stay on the board as `Superseded` and carry the call-site
lists and the reasoning below them.

**Why one ticket.** Both halves complete a token scale, and both add a source-scanning guard
over the same class strings in `apps/web/src`. #303 would add a guard for `text-[Npx]` without
a paired line-height and a token test for the radius steps; #325 adds a guard for any
`family-step` the theme does not define. That second guard is the general case of the first
kind of defect, and it is what stops #303's radius work reopening the class. One scanner, one
pass over the same files.

**The trap.** `packages/config/tailwind/theme.css` defines the warm stone ramp as
`stone-0 / 50 / 100 / 150 / 200 / 300 / 400 / 500 / 600 / 700 / 900`. There is no `stone-800`.
Tailwind 4 still resolves `text-stone-800` — to **its own built-in cool `stone`**, `#292524`.
The class compiles, renders, and puts an off-palette colour on the page, with no error, no
build warning and nothing in the test suite able to notice. It was caught only by resolving a
computed colour against the token list in a browser. `01-foundations.md` calls the warm ramp
*"deliberately shadows Tailwind's cool `stone`"*, which is what makes the gap silent rather
than loud: every step that *does* exist is overridden, so the one that does not looks like all
the others.

**The sites, re-verified 2026-08-30 — all seven still live:**

- `app/suspended/page.tsx:17`
- `components/uploads/upload-tile.tsx:99`
- `components/tags/tag-category-section.tsx:65`
- `components/packages/package-manager.tsx:191`, `:262`
- `components/packages/package-form.tsx:204`, `:312`

`components/category-picker.tsx:71` already carries the comment "`stone-800` was not even in
the ramp", and `search-shell.tsx:446` carries the same note from #297 — so this was noticed
twice, fixed locally both times, and never generalised. **That is the ticket.**

**The guard is the larger half.** The same hole is open on every family: `gold-100`,
`steel-300`, `clay-700`, `sage-500` all resolve to *something* rather than failing. One
source-scanning test closes all of them.

**The scale remainder** (after #74, #165, #198 and #235): the `text-[Npx]` line-height defect
on the `h1`, the card `h3` and the price span (#247); the radius scale's missing **12px step**
— confirmed 2026-08-30, `theme.css:203-207` runs 6/8/10/14/18 — and the 69 frame call sites
that need it using the token rather than an inline value or a wrong step (#277); and avatar
initials never rendering Instrument Serif below the 16px floor at any of the five sizes
(#230), which is an application of #74's ruling, not a new one.

**Non-goals:** adding a `stone-800` token to the ramp — `01-foundations.md` sets the ramp and
this is not a ticket's to extend. The two absent frame colours (**#306** — a ruling, not an
edit).

**Acceptance:**

- [ ] Every `stone-800` call site resolves to a defined token — `stone-900` where the intent
      is ink, `stone-700` where it is body text; decide per site by what the surrounding frame
      draws, not by a blanket swap
- [ ] A guard that fails when any `(text|bg|border|ring|fill|stroke)-<family>-<step>` class in
      `apps/web/src` names a step `theme.css` does not define. It reads the theme, so a token
      added later needs no edit here
- [ ] The guard covers arbitrary-value classes too, or says in its own comment that it does
      not and why
- [ ] The `text-[Npx]` line-height defect is closed on the `h1`, the card `h3` and the price
      span
- [ ] The radius scale carries a **12px step**, and the frame call sites that need it use the
      token rather than an inline value or a wrong step
- [ ] Avatar initials never render Instrument Serif below the 16px floor, at any of the five
      sizes
- [ ] No inline hex, width or radius is introduced anywhere the sweep touches

**Tests (required):**

- [ ] The undefined-step guard, with a fixture proving it **fails** on a fabricated off-ramp
      class. A scanner that has never been shown to fail is not a guard
- [ ] A guard that fails on a raw `text-[Npx]` without a paired line-height, so the class of
      defect cannot come back
- [ ] A token test that the radius scale has exactly the documented steps

---

### #334: Repo guardrails — lane tooling, preflight hygiene and the route/frame ledger

> **Superseded — merged into #363 on 2026-08-30 by the second backlog consolidation.**
> **Do not work this ticket directly.** This section is kept for the measurements and
> the reasoning #363 was built from, and so `pnpm preflight --ticket 334` still gates for
> anyone on a branch or commit message that predates the merge.

**Milestone:** M4.5 | **Priority:** P2 Medium | **Status:** Superseded | **Capabilities:** `core`
**Blocked by:** None

Merges **#316 and #319**. Both ship only tooling and tests — no user-facing behaviour, so no
parity gate and no browser pass. They share the entire verification shape, which is why they
share a ticket.

**Lane and preflight hygiene** (#316, plus three found 2026-08-30 by lane 9, which hit them in
one ticket):

- [ ] `lane:up` **seeds**, not just migrates. Lane 9's database came up with 0 categories and
      0 tags, so every vendor surface 404s and redirects to profile creation, and the first
      browser pass was blocked outright with nothing to say why. `pnpm lane:exec <n> -- pnpm
      db:seed` fixes it by hand; any ticket touching a vendor or search surface is dead on
      arrival in a fresh lane until `lane:up` does it
- [ ] `laneUp` re-derives `worktreePath` and `branch` when it returns an existing
      `state: 'active'` manifest, instead of handing back stale values (#256). Same class as
      the manifest drift fixed on 2026-08-29 — the fix belongs in `pnpm lane:pr`'s path, and
      manifests are never hand-edited
- [ ] Preflight compares the `stripe listen` signing secret against `STRIPE_WEBHOOK_SECRET`
      — **digests only**, never the values. Preflight checks the env var's *shape* and that
      the CLI is installed and reports green, but the forwarder mints its own secret; when the
      two disagree every locally delivered webhook 401s, which reads exactly like a
      signature-verification bug in the ticket under test
- [ ] The lane's dev script sets `ulimit -n 65536` before `next dev`. With three lanes up it
      died with `EMFILE: too many open files`, the watcher never started, middleware never
      compiled, and every page 500d with Clerk reporting "can't detect usage of
      clerkMiddleware()" — a misleading error three steps from the cause
- [ ] `POST /vendor/stripe/connect` answers **403**, not 400, to a customer sending a
      malformed body. Fastify parses the body before the `preHandler` role guard runs, so a
      denial is reported as a validation failure. Denial is still correct on every other
      shape and no customer reaches the route — but a 400 where a 403 belongs misleads an audit
- [ ] The `packages/preflight` test that fails only under parallel Turbo runs is **reproduced
      first**, then fixed (#64). It has never had a detail section, so the reproduction is
      part of the deliverable — load `debug-flaky-test` before guessing at it

**The route/frame ledger** (#319, filed by #306 while ruling on #80):

| | |
| --- | --- |
| **Expected** | every live route is drawn as a frame, or recorded as deliberately unframed with a reason |
| **Observed** | #80 named **five** unframed routes; the count is now **nine**. Four appeared after the 2026-08-28 mapping — `/bookings/[requestId]` (#308), `/vendor/bookings` (#307), `/vendor/payments` and `/vendor/payments/return` (#9) — and nothing noticed |

The routes themselves are ruled: `00-README.md` records four as exempt, four as needing a
frame, and one (`/vendor/portfolio`) as already framed by `24` and `25` and mis-recorded.
**That table will go stale the same way**, because it is prose and the thing that changes is
the filesystem. Parity is the repo's hard gate and it is *unprovable* on a route with no
frame, so a route that appears without one is a screen nobody can check — and it arrives
silently, as four just did.

- [ ] A test enumerates `apps/web/src/app/**/page.tsx` and asserts every route appears in the
      parity ledger with **either** a frame **or** a recorded exemption naming a reason
- [ ] It fails on a route added with neither — proven by adding one
- [ ] The ledger's `/vendor/portfolio` contradiction is resolved to the frames that exist
- [ ] Dynamic segments (`[slug]`, `[requestId]`) resolve to one ledger entry each, not one
      per instance

**Tests (required):**

- [ ] A test that a resumed lane's manifest reports the worktree path that exists on disk
- [ ] A test that a freshly created lane's database answers `GET /categories` non-empty
- [ ] Whatever the reproduction shows the preflight flake to be
- [ ] A route test that a customer's malformed-body `POST /vendor/stripe/connect` is a 403
- [ ] The ledger enumeration test, plus a guard asserting it found a plausible number of
      routes — a scan that matches nothing passes forever

---

### #335: [DESIGN] Ruling round — four open questions blocking parity

> **Superseded — merged into #357 on 2026-08-30 by the second backlog consolidation.**
> **Do not work this ticket directly.** This section is kept for the measurements and
> the reasoning #357 was built from, and so `pnpm preflight --ticket 335` still gates for
> anyone on a branch or commit message that predates the merge.

**Milestone:** M3 | **Priority:** P1 High | **Status:** Superseded | **Capabilities:** `core`
**Blocked by:** Four product/design decisions, below

Merges **#320** whole, and takes the ruling half out of **#327**, **#324** and **#299**, which
keep their rows and their code halves.

**Why one ticket.** Four rows are each stalled on one decision nobody has made, and every one
of them ends in a `design-plan/` edit that **a ticket may not make** — `web-design-parity.md`
is explicit that *design passes edit the plan; tickets write the code, never the reverse.* So
each was filed as a ticket that can never start. **#306** closed exactly this way and is the
precedent. One sitting answers all four; each code half then goes `Deferred` → `Backlog`.

**Do not guess any of them.** Three are invented numbers or claims about the business, which
the no-invented-numbers rule covers directly.

**A — the hero's seed value** (unblocks **#327**). Frame `01 Landing` draws the City segment
as the literal `Austin, TX` in `#23201C` (stone-900, the *filled* tone); live renders an empty
input with `placeholder="Anywhere"` in `#6B6459` (stone-600, the placeholder tone). The
question is wider than City: the frame *templates* the vendor type (`{{ searchValue }}`, hint
"Photography") but *hard-codes* the city, and live renders `Any vendor type` in the placeholder
tone too — so the hero's centrepiece reads as three empty fields where the frame reads as a
seeded query. **Whatever is decided for City decides the vendor-type tone with it.** The
options, none free: seed a real city (which, and on what basis — geolocation is not MVP, and a
hard-coded `Austin, TX` is a claim about where the marketplace operates); seed nothing and
accept the placeholder tone as the honest empty state, correcting frame `01` in this pass; or
seed nothing but draw the empty value in the filled tone, which reads as a value that is not
there.

**B — what "scarce" means** (unblocks **#324**). `03-components.md:56` says the availability
chip is *"gold when scarce (\"2 dates left\")"* and **never defines scarce** — a count of free
dates in what window, below what number? The count itself is a real query result and may ship;
the *threshold* is an invented number.

**C — what the stone `New` chip means** (unblocks **#324**). It is in **no** plan file at all,
and in frame `02` it sits on a vendor already showing `★ 5.0 (17)` — so it is not
"unreviewed", and nothing says what it is. `vendor-card.tsx` renders exactly one availability
tone, `bg-sage-50 text-sage-600`, and no branch can produce another; the sage tone is shipped
and correct, and B and C are the other two.

**D — `Your line` and `Years in business`** (unblocks **#299**). #299's acceptance requires
removing the two undocumented fields from frame `09`'s editor so every remaining string traces
to the frame — but **both fields are the only editing surface for content frame `03`
displays**: #298 moved the tagline into the identity card, and `yearsInBusiness` is read by the
public profile. Deleting the editor without deleting the display leaves content nobody can
change. The ruling is delete-both, relocate-both, or keep the fields and correct frame `09`.

**E — the 48-hour deadline** (**#320**, merged whole). `31-content-voice.md`'s **Request
reassurance** row reads *"…Maya has 48 hours to confirm or send a revised quote…"* — the exact
literal #216 identified as false. `BOOKING_REQUEST_EXPIRY_DAYS` is **7 days**, and #308 derives
every rendered instance from it. #216's acceptance asked for this and #308 closed without doing
it, because the ticket had no standing to touch `design-plan/`. It is doubly stale: #308 also
made the sentence conditional — a package-priced request carries an immutable price, so the
vendor's only routes are confirm or decline, and only a custom request can be offered a quote.
This matters more than a stale doc because `31-content-voice.md` is the file every ticket takes
approved strings from and the Text axis is checked against it; the next screen to quote it
reintroduces a deadline the API refuses, at the moment of commitment.

**Acceptance:**

- [ ] Each of A–E is answered in `.claude/plans/vendor-marketplace-decisions.md`, with the
      alternatives that were considered and why they lost
- [ ] The plan files are corrected in this pass, by this pass: `11-search.md` and
      `03-components.md` for B and C, frame `01` or `01-foundations.md` for A, `09`'s spec for
      D, and `31-content-voice.md`'s **Request reassurance** row for E
- [ ] E's row states the real window **derived from the same constant the code reads**, not
      restated as a literal, and covers both branches — packaged (confirm or decline) and
      custom (confirm or send a quote) — or says which branch it is the approved wording for
- [ ] Any other row in `31-content-voice.md` quoting a duration is checked against its
      constant in the same pass
- [ ] #327, #324 and #299 are moved `Deferred` → `Backlog` with their answers recorded in
      Notes, and #320 is closed by this ticket

**Tests (required):**

- [ ] A test asserting no approved string in `31-content-voice.md` contains a hard-coded
      duration for a deadline the code derives — the same guard shape as
      `one-deadline-one-fee.test.ts`, pointed at the plan rather than the app. It is the only
      thing that would have caught E, since the file is prose nothing imports

---


### #336: 01/02 header — the signed-in cluster draws `Dashboard` and a bell where frame `02` draws `Bookings`

> **Superseded — merged into #361 on 2026-08-30 by the second backlog consolidation.**
> **Do not work this ticket directly.** This section is kept for the measurements and
> the reasoning #361 was built from, and so `pnpm preflight --ticket 336` still gates for
> anyone on a branch or commit message that predates the merge.

**Milestone:** M3 | **Priority:** P2 Medium | **Status:** Superseded | **Capabilities:** `core`
**Blocked by:** None

**Filed 2026-08-30 by lane 329**, from the `parity-checker` pass that closed #329. Found
while verifying the Refine bar; **not caused by #329 and not touched by it**.

Frame `02`, signed in, draws `Messages` · `Bookings` · avatar. Live renders `Messages` ·
`Dashboard` · a notification bell · the Clerk `UserButton`.

| Axis | Expected (frame `02`) | Observed |
| --- | --- | --- |
| Text | `Bookings` | `Dashboard` — `apps/web/src/components/site-header.tsx:157` |
| Layout | no bell in the cluster | `<NotificationBell />` between the nav links and the avatar |

**These are two decisions, not one.** The link text is a plain Text-axis miss and the frame
is the authority. The bell is different: it is a real surface with real behaviour, and a
frame that predates it is not evidence it should be removed. **Do not delete the bell to
pass parity** — establish first whether the frame is stale, and if it is, that is a design
ruling and this ticket splits.

**Acceptance:**

- [ ] The signed-in header's link reads the string frame `02` draws, verified by
      `parity-checker` on the Text axis
- [ ] The bell is either in the frame or out of the header, with the reasoning recorded —
      not left as an undeclared deviation
- [ ] A test pins the header's signed-in cluster by name, so the next drift is caught in the
      suite rather than by a parity pass

---

### #337: The card focus ring is clipped by the scroll container on the first row of results

> **Superseded — merged into #358 on 2026-08-30 by the second backlog consolidation.**
> **Do not work this ticket directly.** This section is kept for the measurements and
> the reasoning #358 was built from, and so `pnpm preflight --ticket 337` still gates for
> anyone on a branch or commit message that predates the merge.

**Milestone:** M3 | **Priority:** P2 Medium | **Status:** Superseded | **Capabilities:** `core`
**Blocked by:** None

**Filed 2026-08-30 by lane 329**, from the `parity-checker` pass that closed #329.

`div.app-pane` is the `overflow:auto` scroller and carries **no top padding**. Its
content-box top is `y=173`; the first row of result cards starts at exactly `y=173`. The
focus ring paints outward — `ring-2` plus `ring-offset-2` — so its top 4px lands at
`y=169–172`, outside the scroller, and is clipped.

**Measured, not inferred.** Pixel-differencing a focused card against a blurred one: rows
169–172 are identical `rgb(248,245,239)` in both, and the first differing pixel is at
`y=173`. The ring still paints on the left, right, bottom and corners.

**Why P2 and not P1.** The indicator remains visible, so **WCAG 2.4.7 holds**. This is a
partial clip, not the "clipped to nothing" failure `04-laws.md` describes. It is real and
worth fixing; it is not an accessibility break.

**Fix the class, not the instance.** `scroll-padding-top` or top padding on `.app-pane`
closes this row — but any `overflow` scroller whose first focusable child sits flush against
its content box has the same defect. Sweep them.

**Acceptance:**

- [ ] A focused first-row card's ring is unclipped on all four sides, proven by the same
      pixel-difference method rather than by a computed-style read
- [ ] Every other scroll container in the app is checked for the same shape, and what was
      found is recorded — including "none" if that is the answer
- [ ] A test that would fail against today's markup. Note that **jsdom performs no layout**,
      so a geometry assertion there passes on the broken version; this needs a real browser
      or it needs to assert the class-level fact and say so

---

### #338: 09 Vendor profile editor — the Storefront nav is missing `Payouts` and its blocker dot

> **Superseded — merged into #360 on 2026-08-30 by the second backlog consolidation.**
> **Do not work this ticket directly.** This section is kept for the measurements and
> the reasoning #360 was built from, and so `pnpm preflight --ticket 338` still gates for
> anyone on a branch or commit message that predates the merge.

**Milestone:** M3 | **Priority:** P2 Medium | **Status:** Superseded | **Capabilities:** `core` `stripe`
**Blocked by:** None

**Filed 2026-08-30 by lane 329**, from the `parity-checker` pass that closed #329.

Live renders **six** section-nav items — Business, Location, Tags, Response time, Packages,
Portfolio. Frame `09` draws **seven**, with **`Payouts` last, carrying a gold blocker dot**.

Gold is correct there under `40-states.md`: payouts not yet set up is waiting on someone, not
a failure. Red would be wrong. Payouts exists as a surface — #9 shipped Connect onboarding —
so this is a missing nav entry, not a missing feature.

**Re-measure frame `09` first.** The parity pass that found this was scoped to the Tags row
and read the rest of the editor only in passing. The six-versus-seven count is the finding;
**everything else about that nav is unverified**, including the order, the dot's exact token
and whether the other six match.

**Acceptance:**

- [ ] Frame `09`'s section nav is re-measured in full before any code changes
- [ ] The nav renders every item the frame draws, in the frame's order
- [ ] The blocker dot reads the vendor's real Stripe onboarding state — no invented status —
      and uses gold, never red
- [ ] `parity-checker` returns MATCH on frame `09`'s nav rail

---

### #339: [DESIGN] Search `Sort` has no specified default — the frame draws a chosen one

> **Superseded — merged into #357 on 2026-08-30 by the second backlog consolidation.**
> **Do not work this ticket directly.** This section is kept for the measurements and
> the reasoning #357 was built from, and so `pnpm preflight --ticket 339` still gates for
> anyone on a branch or commit message that predates the merge.

**Milestone:** M3 | **Priority:** P3 Low | **Status:** Superseded | **Capabilities:** `core`
**Blocked by:** A design ruling on the default sort

**Filed 2026-08-30 by lane 329**, from the `parity-checker` pass that closed #329.

Live defaults to `Most relevant` (`sort: 'relevance'`). Frame `02` draws `Top rated ▾`.

**This is not evidence the default is wrong**, and `parity-checker` correctly did not report
it as a deviation: frame `02` draws a *chosen* sort exactly as it draws a chosen price
(`$500 – $3,200`) and a chosen rating (`4★ & up`). Neither `11-search.md` nor
`42-dropdowns.md` fixes a default anywhere.

What makes it worth a ticket is the product question underneath. **A new marketplace
defaulting to `Top rated` ranks its thinnest review counts first** — a vendor with one
five-star review outranks one with sixty at 4.8 — and that is a ranking decision, not a
parity one. `relevance` may well be right; nothing has ever said so on the record.

**Do not close this by matching the frame.** The output is a ruling, and then either the code
changes or the plan gains the line it is missing.

**Acceptance:**

- [ ] The default sort is stated in `11-search.md`, with the reasoning
- [ ] Code and plan agree, whichever way the ruling goes
- [ ] If the answer is `relevance`, `11-search.md` says so explicitly, so the next parity pass
      does not re-open this from the frame

---

### #342: [DESIGN] The avatar tint the frames draw has no token

> **Superseded — merged into #357 on 2026-08-30 by the second backlog consolidation.**
> **Do not work this ticket directly.** This section is kept for the measurements and
> the reasoning #357 was built from, and so `pnpm preflight --ticket 342` still gates for
> anyone on a branch or commit message that predates the merge.

**Milestone:** M3 | **Priority:** P2 Medium | **Status:** Superseded | **Capabilities:** `core`
**Blocked by:** A colour ruling

**Filed 2026-08-30 by lane 302**, from the `parity-checker` pass that closed #302.

Frame `07`'s `Recent messages` rows draw two avatar palettes:

| Row | Fill | Initials | Resolves to a token? |
| --- | --- | --- | --- |
| 1, 3 | `#EADCCB` | `#8E3F20` | **fill: no** · initials: `clay-600` |
| 2 | `#E4E9DE` | `#4B5940` | yes — `sage-100` / `sage-600` |

The `Avatar` primitive alternates `clay-100` (`#F7E7E0`) and `sage-100` by a hash of the
name. The sage pair is exact. The clay pair is not: the initials colour matches and the
fill does not.

**This is the same class as `#C4D6A8` and `#5C4A18`, which #306 ruled on** — a colour the
frames draw with nothing behind it in `01-foundations.md`.

**Do not substitute silently.** Either the palette gains a step or the frame is corrected;
both are design passes, and a ticket may not make either call. It affects **every avatar
fallback in the app**, not just this rail, which is why it is worth a ruling rather than a
local override.

**Acceptance:**

- [ ] `01-foundations.md` either carries the value or records why the frame is wrong
- [ ] Whatever is decided is applied through the `Avatar` primitive, not per call site
- [ ] `parity-checker` returns MATCH on the Colour axis for frame `07`'s rail

---

### #343: 07 Bookings hub — residual parity after #302

> **Superseded — merged into #359 on 2026-08-30 by the second backlog consolidation.**
> **Do not work this ticket directly.** This section is kept for the measurements and
> the reasoning #359 was built from, and so `pnpm preflight --ticket 343` still gates for
> anyone on a branch or commit message that predates the merge.

**Milestone:** M3 | **Priority:** P2 Medium | **Status:** Superseded | **Capabilities:** `core`
**Blocked by:** None

**Filed 2026-08-30 by lane 302** from the `parity-checker` pass that closed #302. That
ticket fixed the Access axis and the deviations it had introduced itself; everything here
is **pre-existing** and was outside its scope.

**Layout**

- The title row should be `flex` with `Your bookings` left and today's date right
  (`12.5px`, `#6B6459`). **The date is absent from the screen entirely** — the `h1` is a
  full-width block with no sibling.
- The sidebar draws **two** rows where the frame draws **four**: `Messages` (with an unread
  dot) and `Saved vendors` are missing. `bookings-sidebar.tsx:10-17` justifies this under
  #31's "a control that opens nothing is furniture" rule — but **`/messages` now exists and
  is linked from the header**, so that justification has expired for at least that row.

**Style**

- `StatusPill` computes `700 11px` / `padding 6px 10px`; `.pill` is `700 10px` /
  `5px 10px`. **Shared primitive — this affects every screen carrying a pill**, so measure
  the others before changing it.
- The dashed "Book another vendor" tile borders `#D5CEC2` (`stone-400`) where the frame
  draws `#DDD5C7`.

**Font**

- The summary sentence is `text-md` (15px) with `leading-prose` (24px); the frame draws
  **14px at `normal`**. **There is no 14px token**, so this is a scale decision rather than
  a class swap — `--text-base` is 13.5 and `--text-md` is 15. Decide whether the frame
  earns a step or the sentence takes `base`.
- Sidebar card body 11px against the frame's 11.5, and its CTA 11px against 12.

**Acceptance:**

- [ ] Each item above is either fixed or recorded with the reason it stands
- [ ] The `StatusPill` change, if made, is measured against every frame that draws a pill
- [ ] `parity-checker` returns MATCH on Layout, Style and Font for frame `07`

---

### #344: 19 Bookings hub empty — the app renders frame 07's shell around frame 19's panel

> **Superseded — merged into #359 on 2026-08-30 by the second backlog consolidation.**
> **Do not work this ticket directly.** This section is kept for the measurements and
> the reasoning #359 was built from, and so `pnpm preflight --ticket 344` still gates for
> anyone on a branch or commit message that predates the merge.

**Milestone:** M3 | **Priority:** P2 Medium | **Status:** Superseded | **Capabilities:** `core`
**Blocked by:** None

**Filed 2026-08-30 by lane 302** from the `parity-checker` pass that closed #302.

**What is verified.** #302's own assertion holds: with bookings the rail draws
`Recent messages` and not `How booking works here`. And the **empty pane itself matches
frame `19` exactly** — dashed panel at `radius 18`, the 58x36 two-circle mark,
`No bookings yet` at 26px Instrument Serif, the body copy character for character including
the curly apostrophe in "vendor's", the `Find a vendor` button, and the `01/02/03` steps in
JetBrains Mono at `500 10.5px` with `1.05px` tracking.

**What does not match is the shell around it.** Frame `19` draws a different title
(`My bookings`), a `Nothing booked yet` sub-line, a `Find a vendor` button *in the title
row*, pill filters `All / Pending / Confirmed / Past`, a sidebar carrying a `Booking`
section label plus `Payments` and an Account/`Settings` block, and a **bordered radius-18
card** rail rather than `07`'s flush border-left. None of that is present; the app renders
frame `07`'s shell and swaps only the pane.

**This long predates #302.** It may well be a deliberate reconciliation — one shell for a
hub that is sometimes empty is a better product than two — but **nothing in the repo records
that decision**, so it currently reads as unexplained drift, and the next parity pass will
find it again.

**Decide before building.** If one shell is right, frame `19` is what needs correcting, and
that is a design pass rather than this ticket.

**Also unverified, and deliberately not recorded as matching:** the rail's
`How booking works here` block on a *live* empty hub. The E2E customer has bookings and
`.claude/rules/e2e-auth.md` forbids creating a throwaway account, so it was never driven.

**Acceptance:**

- [ ] The one-shell question is answered on the record, in `20-customer-bookings-hub.md` or
      a ruling
- [ ] Whatever survives that answer matches, and the empty rail is driven in a browser
      rather than inferred
- [ ] A customer fixture with an empty hub exists, so the next pass can drive it

---

### #345: 04 Booking request — `31-content-voice.md` states a deadline the product does not use

> **Superseded — merged into #359 on 2026-08-30 by the second backlog consolidation.**
> **Do not work this ticket directly.** This section is kept for the measurements and
> the reasoning #359 was built from, and so `pnpm preflight --ticket 345` still gates for
> anyone on a branch or commit message that predates the merge.

**Milestone:** M3 | **Priority:** P2 Medium | **Status:** Superseded | **Capabilities:** `core`
**Blocked by:** None

**Filed 2026-08-30 by lane 302** from the `parity-checker` pass that closed #302.

**The stale approved string.** Frame `04` **and** `31-content-voice.md` both read:

> You're requesting, not paying. Maya has **48 hours** to confirm or send a **revised
> quote** — you approve before any card is charged.

The app renders **7 days**, and a plain "quote" rather than "revised quote".

**The code is right.** The sent-confirmation and the request card both say 7d, and the
interval is derived from the constant rather than written down — so this is the plan that
is stale, and `04-laws.md`'s precedence rule says correct it in the same pass rather than
leaving the two disagreeing. **The correction must derive the number from the same constant
the code reads**, not restate it as a literal, or it goes stale again the next time the
window moves.

**The pronoun neutralisation, which is correct but unrecorded.** The frame writes *"The more
**she knows** now…"* and *"Anything else **she** should know?"*; the app writes *"they know"*
and *"they"*. Vendor gender is unknown, so the app is right — but it is a wording change
from the frame on the Text axis and needs recording rather than standing as drift.

**Two small ones for the same visit:**

- `Continue to review` carries `shadow-sm` (`0 2px 10px rgba(35,32,28,.06)`); the frame's
  `.btnP` has no shadow.
- `Start time` renders 42px tall beside `Guest count` at 38px — the native
  `<input type="time">` clock affordance adds 4px to a pair the frame draws at one height.
  Visibly misaligned.
- Removing the marketing footer (#192) left a **stray empty `<section>` at `y=900`, height
  0**. Harmless — zero extent, no text — but it should be deleted rather than emitted.

**Acceptance:**

- [ ] `31-content-voice.md`'s row derives the window from the constant and matches what ships
- [ ] The pronoun decision is recorded
- [ ] The two style deviations and the stray node are fixed
- [ ] `parity-checker` returns MATCH on Style and Text for frame `04`

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

### #357: Apply the D16/D17 rulings — the four code sites the frames now expect

**Milestone:** M3 | **Priority:** P1 High | **Status:** Done | **Capabilities:** `core`
**Blocked by:** None

Merges **#327, #335, #339, #342, #348, #350**.

**Why one ticket.** All six were `Deferred — needs a human` until D16 and D17 answered them
on 2026-08-30, with the `design-plan/` edits landed in the same pass — five of the six were
*filed* that same day, by the lanes that closed #302, #305 and #329, and never had a chance
to start. What each had left was code, and for three of them the
"code" was a correction to `design/Orla - Screens.dc.html` — which is why they were batched
here in the first place: that file holds all 27 frames and **is** the parity acceptance
criterion, so lanes editing it concurrently conflict on the one artifact every other ticket
is measured against.

**That half is now done** — the user landed the six frame corrections on 2026-08-30 as
`72ddd73`, recorded in `design/design-plan/CHANGE-ORDER-2026-08-30.md`. **The sequencing
reason for this ticket has therefore expired, and #358 is no longer behind it.** What is
left is four code sites and one guard test, and they are independent of each other.

**The frame corrections — done.** Landed 2026-08-30 from the user's updated copy of the document; `design/design-plan/CHANGE-ORDER-2026-08-30.md` records them and the plan edits that followed. The table stays as the record of what changed, not as work:

| Frame | Correction | Ruling |
| --- | --- | --- |
| `01 Landing` (+ 1024) | City segment drawn empty in the **placeholder** tone `#6B6459`, not the literal `Austin, TX` in `#23201C`. The vendor-type segment matches it. The hero **badge** "Now booking in Austin" is unaffected | D16-A (#327) |
| `02 Search` (+ 1024) | The gold `2 dates left` and sage `Free Jun 14` chips come off the result cards; the stone `New` chip stays | D16-B, C (#324) |
| `12 Sign up` | Primary action reads `Create my account` — the plan already said so | D16-6 (#313) |
| `16 500` | Secondary CTA reads `Browse vendors` → `/search` | D17 (#350) |
| `18 Search no results` (+ 1024) | Its two gold chips become the sage **nearby-date** form, which is the one place the chip survives | D16-B, C (#324) |

**The code sites, all named in the rulings:**

- `avatar.tsx:17` — `FALLBACK_TONES` takes the new `--color-clay-150: #eadccb`. The frames
  draw that fill at **42 sites across 20 frames**; the ramp had no step between `clay-100`
  (`#F7E7E0`) and `clay-200` (`#EFD8CC`), and the clay initials and the whole sage pair
  already resolved exactly, so the fill was the one off-token value. **The ramp was
  incomplete, not the frame wrong** — the same finding as #306 (#342)
- `vendor-card.tsx:149` and `profile-header.tsx:199` — a published vendor with no
  `coverImageUrl` gets a **`stone-250` (`#ECE6DC`) block at the cover's exact 3:2 and the
  card's own radius, with nothing inside it**: no hatch, no monospace label, nothing
  addressed to a developer. `stone-250` was **minted for this** by D18 on 2026-08-30,
  between `stone-200` and `stone-300`; the hatch stripes stay `stone-200`/`stone-300`, and
  frame `26 State library` now carries the two-tile **Missing cover photo** group showing
  the live block beside the hatch, the hatch marked *never on a public page*. The hatch is a build-time device
  for photography the *product* lacks; a live vendor's empty cover is *their* missing
  content shown to *their* customers. The cause and the fix stay in the editor, which is
  **#360**, not on the page their customers read (#348)
- `error-screen.tsx:74` — href and label (#350)

**#327 is frame-only and #339 is verification-only.** The hero code already renders all
three segments empty in the placeholder tone, which is what D16 ruled correct; `Most
relevant` already ships and D16 confirmed it stands. Both close on evidence, not edits.

**Non-goals:** the rest of frames `01` and `02` (closed by #296 and #297); the `New`
badge's implementation, which is **#358**; the cover *upload* control, which is **#360**.

**Acceptance:**

- [x] ~~Every frame in the table above is corrected~~ — **landed 2026-08-30 as `72ddd73`**,
      by the user, across frames `01`, `02`, `09`, `16`, `18`, `26` and their 1024 variants.
      46 frames unchanged. This ticket does **not** edit `Orla - Screens.dc.html`
- [ ] The four code sites render what their rulings say, verified in a browser
- [ ] A published vendor with no cover renders the **`stone-250`** block on **both**
      `/search` and `/vendors/[slug]`, and the labelled hatch appears on **no** live public
      surface
- [ ] **Frame `03`'s sage chip is left alone.** The change order is explicit that it stays —
      a profile is not a filtered result — and that only its *reasoning* changed. Removing it
      here would be the failure mode this ticket exists to avoid
- [ ] `#327` and `#339` are closed with the evidence that no code change was needed — not
      with a change made to look like one
- [ ] `parity-checker` returns MATCH on frames `01`, `02`, `12`, `16` and `18` afterwards

**Tests (required):**

- [ ] The guard D16 asked for: **no approved string in `31-content-voice.md` hard-codes a
      duration the code derives.** Same shape as `one-deadline-one-fee.test.ts`, pointed at
      the plan rather than the app. It is the only thing that would have caught the 48-hour
      row, since the file is prose nothing imports
- [ ] A token test that `clay-150` exists and that `FALLBACK_TONES` resolves to defined
      ramp steps only — the gap #333 generalises
- [ ] A test that a vendor with `coverImageUrl: null` renders no monospace placeholder
      label on either public surface, asserted by role or text rather than by class

---

### #358: 02/17/18 Search — close 1440 parity and the two reachability defects

**Milestone:** M3 | **Priority:** P2 Medium | **Status:** Backlog | **Capabilities:** `core`
**Blocked by:** None — **unblocked 2026-08-30**; frames `02` and `18` now draw what this is
measured against (`72ddd73`, `CHANGE-ORDER-2026-08-30.md`). Still **must not run concurrently
with #323**, which owns `search-shell.tsx` and `refine-bar.tsx` at 1024.

Merges **#324, #326, #337, #347**. One route, three states, one browser pass.

**Why one ticket.** #326's measurements say its compact-header fix *"lands on `/search` at
every state"* — it is the shared `SearchBar`, so frames `17` and `18` are the same pass.
#337 was found there, #347's blank page 2 is reached from it, and #324's code touches
`vendor-card.tsx`, which all three states render. Split, this is four serial passes on one
shared Playwright browser for one route.

**#324 is now a deletion, not a feature.** D16 dropped the gold chip — `03-components.md`
said "gold when scarce" and never defined scarce, and the threshold is an invented number —
**and dropped the sage chip from the results grid**, because a dated query is already
filtered on availability: `vendor-search.dao.ts` hard-codes `availableOnDate: true` on every
row of one and says so in its own comment. The chip was a tautology. **Sage survives only**
on the "free on a nearby date instead" band (`nearby-dates-band.tsx`), where it names a
*different* date than the one searched and is the only thing that unsticks a dead-end query.
The stone `New` chip is a **joined-recently badge** — vendor published within the last 30
days — and becomes the only chip a search card carries.

**The compact header bar**, measured at 1440×900 in Chromium during #297's pass. Frame
`02`'s header is ruled stale by **#57**, so these are against `17`/`18`:

| Element | Frame | Live |
| --- | --- | --- |
| Bar padding | `0 5px 0 18px` | `0 4px 0 16px` |
| Segment value | 13px / 500 | 13.5px / 400 |
| Segment inner padding-left | 16px | 14px |

**The empty state's glyph sits 59px low** because a count row renders above it: `0
photographers in Marfa`, the `free on …` clause and `Prices are what they charge — no quotes
needed` occupy y=118–173, where frame `18` opens directly into `padding:44px 26px`. The
glyph lands at y=**221** against the frame's y=**162**. The description's `line-height` is
21.6px against the frame's `13.5px/1.65` = 22.28px — and `--leading-prose` is global at 1.6,
so this is a **per-call-site override, not a token change**.

**The focus-ring clip, measured by pixel-differencing** a focused card against a blurred
one: `div.app-pane` is the `overflow:auto` scroller and carries **no top padding**; its
content-box top is `y=173` and the first result row starts at exactly `y=173`, so the ring's
top 4px (`ring-2` + `ring-offset-2`) is clipped. Rows 169–172 are identical
`rgb(248,245,239)` in both and the first differing pixel is at `y=173`. **WCAG 2.4.7 holds**
— the ring still paints left, right, bottom and corners, so this is a partial clip, not the
"clipped to nothing" failure `04-laws.md` describes. That is why it is P2. **Fix the class,
not the instance:** any `overflow` scroller whose first focusable child sits flush against
its content box has it.

**Pagination.** `/search?page=2` returns HTTP 200 with a blank results pane while the `h1`
still claims the full count. `pageSize=20` against 17 vendors means nothing is lost today —
which is why this is Medium, and why it stops being true the moment the marketplace grows.
Frame `02` draws no pagination, so the **control's shape** is undecided; the **out-of-range
page** is unambiguous and lands regardless.

**Known and owned elsewhere — do not re-file:** the `Free on a nearby date instead` band and
`See all 14 in the region →` (**#50**), the wordmark at 24px against 23px (**#118**), the
1024 composition (**#323**), the `Anywhere` relaxation and the second `Clear all` — neither
string is in frame `18` or `31-content-voice.md`, and `Clear all` duplicates the Refine
bar's own `Clear` on the same screen, so **record it as an open wording question rather than
inventing copy**.

**Acceptance:**

- [ ] The gold and sage availability chips are gone from the results grid; sage survives on
      the nearby-dates band only, naming the nearby date
- [ ] The `New` chip reads a real published-at within 30 days, at request time — never a
      hard-coded flag, and never a threshold invented here
- [ ] The empty state draws no count row above it, so its glyph lands where frame `18` puts it
- [ ] The compact header bar matches frames `17`/`18` on all three measurements
- [ ] The empty-state description carries the frame's 1.65 **without** moving `--leading-prose`
- [ ] A focused first-row card's ring is unclipped on all four sides, proven by the same
      pixel-difference method rather than by a computed-style read
- [ ] Every other scroll container in the app is checked for the same shape, and what was
      found is recorded — **including "none" if that is the answer**
- [ ] An out-of-range page renders an empty state whose heading agrees with its body, and the
      heading never claims a count the pane does not show
- [ ] `parity-checker` returns MATCH on frames `02`, `17` and `18`, or names only #50, #118
      and the recorded wording question

**Tests (required):**

- [ ] A test per chip state driven by the DAO's real output rather than a hand-built prop,
      **including that a dated query renders no availability chip on the grid** — the ruling
      stated as a test
- [ ] A test that a vendor with no availability data draws no chip at all
- [ ] Parity assertions reading the header bar's three values out of frame `17` at test time,
      so `02`'s stale header cannot be picked up by mistake
- [ ] A test that the no-results state renders without the count row, asserting the absence
      **by role**, not by class
- [ ] A test asserting an out-of-range page's heading agrees with its body
- [ ] The focus-ring assertion needs a real browser, or must assert the class-level fact and
      say so — **jsdom performs no layout**, so a geometry assertion there passes on the
      broken version

---

### #359: 04/07/19 Bookings — hub, empty hub and the request form

**Milestone:** M3 | **Priority:** P2 Medium | **Status:** Backlog | **Capabilities:** `core`
**Blocked by:** None

Merges **#343, #344, #345** — all three filed 2026-08-30 by lane 302 from the single
`parity-checker` pass that closed #302. That ticket fixed the Access axis and the deviations
it introduced itself; everything here is **pre-existing** and was outside its scope.

**Why one ticket.** #343 and #344 are the same shell, and #345 is one click away in the same
flow. One customer fixture, one browser pass.

**Frame 07 — layout.** The title row should be `flex` with `Your bookings` left and today's
date right (`12.5px`, `#6B6459`); **the date is absent from the screen entirely** — the `h1`
is a full-width block with no sibling. The sidebar draws **two** rows where the frame draws
**four**: `Messages` (with an unread dot) and `Saved vendors` are missing.
`bookings-sidebar.tsx:10-17` justifies this under #31's *"a control that opens nothing is
furniture"* rule — but **`/messages` now exists and is linked from the header**, so that
justification has expired for at least that row.

**Frame 07 — style and font.** The dashed "Book another vendor" tile borders `#D5CEC2`
(`stone-400`) where the frame draws `#DDD5C7`. Sidebar card body 11px against 11.5; its CTA
11px against 12. The summary sentence is `text-md` (15px) with `leading-prose` (24px) where
the frame draws **14px at `normal`** — and **there is no 14px token** (`--text-base` is 13.5,
`--text-md` is 15), so decide whether the frame earns a step or the sentence takes `base`.
`StatusPill` computes `700 11px` / `6px 10px` where `.pill` is `700 10px` / `5px 10px` — a
**shared primitive**, so measure every frame that draws a pill before changing it.

**Frame 19 — the shell, not the pane.** The empty pane matches frame `19` **exactly**:
dashed panel at `radius 18`, the 58×36 two-circle mark, `No bookings yet` at 26px Instrument
Serif, the body copy character for character including the curly apostrophe in "vendor's",
the `Find a vendor` button, and the `01/02/03` steps in JetBrains Mono at `500 10.5px` with
`1.05px` tracking. **What does not match is the shell around it.** Frame `19` draws a
different title (`My bookings`), a `Nothing booked yet` sub-line, a `Find a vendor` button in
the title row, `All / Pending / Confirmed / Past` pill filters, a sidebar carrying a
`Booking` section label plus `Payments` and a Settings block, and a bordered radius-18 card
rail rather than `07`'s flush border-left. The app renders frame `07`'s shell and swaps only
the pane.

**Decide the shell before building.** This long predates #302 and may well be a deliberate
reconciliation — one shell for a hub that is sometimes empty is the better product — but
**nothing in the repo records that decision**, so it reads as unexplained drift and the next
parity pass finds it again. If one shell is right, frame `19` is what needs correcting, and
that is a design pass rather than this ticket.

**Frame 04 — the stale string is already corrected.** D16 rewrote `31-content-voice.md`'s
**Request reassurance** row: split into **packaged** (confirm or decline — the price is
immutable) and **custom** (confirm or send a quote), both reading `{expiryDays}` rather than
a typed literal, per #308. The app already renders **7 days**, derived from
`BOOKING_REQUEST_EXPIRY_DAYS`. **Verify the app against the corrected row** rather than
re-deriving the ruling.

**Frame 04 — what is left.** The pronoun neutralisation is correct but unrecorded: the frame
writes *"The more **she knows** now…"* and *"Anything else **she** should know?"*, the app
writes *"they"*. Vendor gender is unknown, so the app is right — but it is a Text-axis change
from the frame and needs recording rather than standing as drift. Plus: `Continue to review`
carries `shadow-sm` (`0 2px 10px rgba(35,32,28,.06)`) where the frame's `.btnP` has none;
`Start time` renders 42px tall beside `Guest count` at 38px, because the native
`<input type="time">` clock affordance adds 4px to a pair the frame draws at one height,
visibly misaligned; and removing the marketing footer (#192) left a **stray empty `<section>`
at y=900, height 0** — harmless, zero extent, no text, but it should be deleted rather than
emitted.

**Acceptance:**

- [ ] Every measurement above is fixed, or recorded with the reason it stands
- [ ] The one-shell question is answered on the record, in `20-customer-bookings-hub.md`
- [ ] The `StatusPill` change, if one is made, is measured against **every** frame that draws
      a pill first
- [ ] `Messages` is in the bookings sidebar, since the route it opens now exists
- [ ] **The empty rail is driven in a browser rather than inferred.** `How booking works
      here` on a live empty hub was never driven: the E2E customer has bookings and
      `.claude/rules/e2e-auth.md` forbids creating a throwaway account
- [ ] An empty-hub customer fixture exists, so the next pass can drive it
- [ ] The pronoun decision is recorded
- [ ] `parity-checker` returns MATCH on frames `04`, `07` and `19`

**Tests (required):**

- [ ] A fixture test that the empty-hub customer really has zero bookings, so it cannot rot
      into a non-empty one silently
- [ ] A test that nothing rendered on frame `04` carries a typed duration — it reads the
      constant or it fails
- [ ] A test pinning the bookings sidebar's rows by name and order

---

### #360: 09 Vendor storefront editor — cover, preview rail, nav and the unsaved-work guard

**Milestone:** M3 | **Priority:** P0 Critical | **Status:** In Progress | **Capabilities:** `core` `storage` `stripe`
**Blocked by:** None

Merges **#299, #338, #349**. #299 in turn merges **#137, #138, #140, #141, #152, #257, #258,
#288**, with **#288 leading** because it unblocks #137, which was stuck on a design contract
that contradicted itself about the cover field.

**#338 is a duplicate.** "The section nav carries `Payouts` and its gold dot" is already
acceptance line 5 of #299, filed there as #140. It was re-filed on 2026-08-30 by lane 329
from a different parity pass, which is exactly the failure mode a consolidated backlog
exists to prevent. **#349 is the same route's form.**

**D16 settled the field question** (#335-D, and D12 had already answered it): `Your line` and
`Years in business` are **relocated, not deleted**. Both are the only editing surface for
content frame `03` displays — #298 moved the tagline into the identity card and
`yearsInBusiness` is read by the public profile — so deleting the editor without deleting the
display leaves content nobody can change.

**Acceptance:**

- [ ] The media row is a 128px circle profile photo beside a **216×144, 3:2** cover drop zone
      reading *"Drop a photo or browse · landscape · 1200×800 or larger"*. The `21:9, 1600×686
      min` ask is retired (#288), and the drop zone missing entirely today exists (#137)
- [ ] **There is no separate profile-banner field** — one file, two placements, per #287
- [ ] The card preview is a **308px right-edge rail** at ≥1024 (`stone-100`, `stone-300` left
      border) with a mono `PREVIEW` label, "Updates as you type", an **In search / Your
      profile** toggle and the real card at full size, and **no link out**. 280px at 1280, a
      panel above the fields at 768, a bottom sheet at 390 (#288)
- [ ] `Your line` and `Years in business` are **relocated** per D16, and the eight helper
      strings that came with the removed fields go (#152) — every remaining string traces to
      the frame or to `31-content-voice.md`
- [ ] **Frame `09`'s section nav is re-measured in full before any code change.** The pass
      that found the missing entry was scoped to the Tags row and read the rest only in
      passing, so the order, the dot's exact token and whether the other six match are all
      unverified. Live renders **six** items — Business, Location, Tags, Response time,
      Packages, Portfolio — where the frame draws **seven**
- [ ] The nav renders every item the frame draws, in the frame's order, with `Payouts` last
- [ ] The blocker dot reads the vendor's **real** Stripe onboarding state — no invented status
      — and is **gold, never red**: payouts not yet set up is waiting on someone, not a
      failure (`40-states.md`). Payouts exists as a surface, since #9 shipped Connect
      onboarding, so this is a missing nav entry rather than a missing feature
- [ ] The form pane is inside its scroll budget (#141)
- [ ] The slug preview shows the URL the router actually serves — no extra path segment, no
      vanity URL that 404s (#257)
- [ ] The submit bar says when the storefront was last saved (#258)
- [ ] A dirty form prompts on **Back and trackpad swipe**, or the reason it deliberately does
      not is recorded. `useUnsavedChangesGuard` covers `beforeunload` and a capture-phase
      click intercept; **a history navigation is neither** — `beforeunload` does not fire for
      a same-document one and `popstate` arrives *after* the entry changed, so the only block
      is a decoy entry re-pushed on every `popstate`, which corrupts the stack the user is
      walking and breaks a second Back. Next's App Router exposes no supported blocking API.
      **Covering it badly is worse than the gap** — #305 left it uncovered deliberately and
      said so in the hook's own contract
- [ ] Whatever lands does not leave the history stack in a state a second Back handles
      wrongly, and the hook's contract comment matches what it actually covers
- [ ] `parity-checker` returns MATCH on all six axes at **1440 / 1024 / 768 / 390**

**Tests (required):**

- [ ] A test that the slug preview and the route resolve to the same URL — the defect is a
      disagreement between two places, so assert the **agreement**, not either side
- [ ] A parity assertion reading the nav label list **and its order** out of the frame at test
      time, so a reordering fails rather than passing on set equality
- [ ] A test that the payout dot follows real onboarding state in both directions
- [ ] Parity assertions read from the frame at test time, at all four viewports

---

### #361: Site header and chrome — signed-in cluster, notification dropdown, avatar alt

**Milestone:** M3 | **Priority:** P2 Medium | **Status:** Backlog | **Capabilities:** `core` `auth`
**Blocked by:** None

Merges **#336, #351, #352** — `site-header.tsx`, `NotificationBell` and the Clerk
`UserButton`.

**Why one ticket, and why all three slipped.** As #352 puts it: *"the user menu is chrome
rather than a framed screen, so no parity pass owns it."* `04-laws.md` covers alternative
text and the parity `Access` axis is the gate for it, but chrome falls between the frames.
All three are found and fixed in the same signed-in render, on every page, for both roles.

**The link text needs no ruling.** Frame `02` signed in draws `Messages` · `Bookings` ·
avatar. Live renders `Messages` · `Dashboard` · a bell · the Clerk `UserButton`.

| Axis | Expected (frame `02`) | Observed |
| --- | --- | --- |
| Text | `Bookings` | `Dashboard` — `site-header.tsx:157` |
| Layout | no bell in the cluster | `<NotificationBell />` between the nav links and the avatar |

**These are two decisions, not one.** The link text is a plain Text-axis miss and the frame
is the authority. **The bell is different: do not delete it to pass parity.** It is a real
surface with real behaviour, and a frame that predates it is not evidence it should be
removed. Establish first whether the frame is stale; if it is, that is a design ruling and
this ticket splits.

**The avatar alt is a data defect, not a template one.** It reads `alt="'s logo"` — the name
that should precede the possessive is an empty string, so a screen-reader user hears a
possessive with nothing in front of it. On **both roles**, on every signed-in page. The
template is right and the value reaching it is not, so the fix belongs wherever that name is
resolved for the menu, **not in the alt attribute**. Worth checking whether the same value is
empty anywhere else it is rendered without a possessive to make it obvious.

**The dropdown's empty state** is a bare
`<p class="px-4 py-6 text-center text-base text-stone-600">No notifications yet</p>` — no
glyph, no heading, no CTA, and `closest('[data-slot="empty-state"]')` is null. #305 made the
two-circle glyph the default for every `EmptyState`, so nine call sites gained it without
being edited; this one **is not a call site**, so the default cannot reach it. It is the only
empty state in the product that opted out by never opting in. **Not a mechanical swap:**
`40-states.md` lists empty states by screen and names no dropdown, and frame
`08/09/11 shared` draws the panel without one — a full glyph-headline-sentence-CTA stack
inside a dropdown that size may be wrong. The point is that it should be **decided**, not
inherited from whoever wrote the paragraph.

**Acceptance:**

- [ ] The signed-in header's link reads the string frame `02` draws, verified by
      `parity-checker` on the Text axis
- [ ] The bell is either in the frame or out of the header, **with the reasoning recorded** —
      not left as an undeclared deviation
- [ ] The alt text names the account, on **both** roles
- [ ] Either the dropdown uses `EmptyState`, or the frame's treatment is recorded as
      deliberate with the reason
- [ ] Whatever lands is reachable from the glyph guard in `empty-state-callers.test.ts`, or
      exempted there **in writing**

**Tests (required):**

- [ ] A test pinning the header's signed-in cluster **by name**, so the next drift is caught
      in the suite rather than by a parity pass
- [ ] A test asserting the avatar alt is non-empty and does not begin with an apostrophe, for
      both roles
- [ ] The `empty-state-callers.test.ts` entry or its written exemption

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

### #363: Repo guardrails — lane tooling, preflight hygiene, seed and route ledgers

**Milestone:** M4.5 | **Priority:** P2 Medium | **Status:** Backlog | **Capabilities:** `core` `stripe`
**Blocked by:** None

Merges **#334, #341**; #334 in turn merges **#316 and #319**.

**Why one ticket.** All of it ships **only tooling and tests — no user-facing behaviour, so
no parity gate and no browser pass.** They share the entire verification shape, which is the
reason to batch them. #341 is the same species as the rest: a guard that closes a class of
mistake three seeds made independently, which is what #334 is already full of.

**Lane and preflight hygiene** (#316, plus three found 2026-08-30 by lane 9, which hit them
all inside one ticket):

- [ ] `lane:up` **seeds**, not just migrates. Lane 9's database came up with 0 categories and
      0 tags, so every vendor surface 404s and redirects to profile creation, and the first
      browser pass was blocked outright with nothing to say why. `pnpm lane:exec <n> -- pnpm
      db:seed` fixes it by hand; any ticket touching a vendor or search surface is dead on
      arrival in a fresh lane until `lane:up` does it
- [ ] `laneUp` re-derives `worktreePath` and `branch` when it returns an existing
      `state: 'active'` manifest instead of handing back stale values (#256) — the same class
      as the manifest drift fixed on 2026-08-29. The fix belongs in `pnpm lane:pr`'s path, and
      manifests are never hand-edited
- [ ] Preflight compares the `stripe listen` signing secret against `STRIPE_WEBHOOK_SECRET` —
      **digests only, never the values.** Preflight checks the env var's *shape* and that the
      CLI is installed and reports green, but the forwarder mints its own secret; when the two
      disagree every locally delivered webhook 401s, which reads exactly like a
      signature-verification bug in the ticket under test
- [ ] The lane's dev script sets `ulimit -n 65536` before `next dev`. With three lanes up it
      died with `EMFILE: too many open files`, the watcher never started, middleware never
      compiled, and every page 500d with Clerk reporting "can't detect usage of
      clerkMiddleware()" — a misleading error three steps from the cause
- [ ] `POST /vendor/stripe/connect` answers **403, not 400**, to a customer sending a
      malformed body. Fastify parses the body before the `preHandler` role guard runs, so a
      denial is reported as a validation failure. Denial is still correct on every other shape
      and no customer reaches the route — but a 400 where a 403 belongs misleads an audit
- [ ] The `packages/preflight` test that fails only under parallel Turbo runs is **reproduced
      first**, then fixed (#64). It has never had a detail section, so the reproduction is
      part of the deliverable — load `debug-flaky-test` before guessing at it

**Seeds write slugs, not labels** (#341). `seed:marketing` and `seed:e2e` write an event-type
**label** into a slug column. Correct both call sites, then **close the class rather than the
two instances**: a guard asserting that every `event_type` any seed writes is in
`EVENT_TYPES`. `seed-demo.test.ts` already has that assertion for its own seed; generalise
it. A written rule is what let three seeds make the same mistake independently. Existing rows
carrying a label are corrected on the next seed run, not stranded
(`.claude/rules/db-schema.md`).

**The route/frame ledger** (#319, filed by #306 while ruling on #80):

| | |
| --- | --- |
| **Expected** | every live route is drawn as a frame, or recorded as deliberately unframed with a reason |
| **Observed** | #80 named **five** unframed routes; the count is now **nine**. Four appeared after the 2026-08-28 mapping — `/bookings/[requestId]` (#308), `/vendor/bookings` (#307), `/vendor/payments` and `/vendor/payments/return` (#9) — and nothing noticed |

The routes themselves are ruled: `00-README.md` records four as exempt, four as needing a
frame, and one (`/vendor/portfolio`) as already framed by `24` and `25` and mis-recorded.
**That table will go stale the same way**, because it is prose and the thing that changes is
the filesystem. Parity is the repo's hard gate and it is *unprovable* on a route with no
frame, so a route that appears without one is a screen nobody can check — and it arrives
silently, as four just did.

- [ ] A test enumerates `apps/web/src/app/**/page.tsx` and asserts every route appears in the
      parity ledger with **either** a frame **or** a recorded exemption naming a reason
- [ ] It fails on a route added with neither — **proven by adding one**
- [ ] The ledger's `/vendor/portfolio` contradiction is resolved to the frames that exist
- [ ] Dynamic segments (`[slug]`, `[requestId]`) resolve to one ledger entry each, not one
      per instance

**Tests (required):**

- [ ] A test that a resumed lane's manifest reports the worktree path that exists on disk
- [ ] A test that a freshly created lane's database answers `GET /categories` non-empty
- [ ] Whatever the reproduction shows the preflight flake to be
- [ ] A route test that a customer's malformed-body `POST /vendor/stripe/connect` is a 403
- [ ] A test that no seed writes an `event_type` outside `EVENT_TYPES`, naming the seed and
      the bad value
- [ ] The ledger enumeration test, **plus a guard asserting it found a plausible number of
      routes** — a scan that matches nothing passes forever

### #364: Remove the `▾` disclosure caret from every dropdown trigger — user override

**Milestone:** M3 | **Priority:** P1 High | **Status:** Backlog | **Capabilities:** `core`
**Blocked by:** None

**Filed 2026-08-30 on the user's explicit instruction.** *"The small tiny triangle looking
style on the right of the input, as visible in the landing page."* That is the `▾` / `▴`
disclosure caret on the hero's three search segments, and it comes off **everywhere** —
the instruction was *"we don't want it anywhere, especially in the landing page."*

**This is a deliberate deviation from the design contract, not a parity finding.** The
frames draw the caret and `42-dropdowns.md` specifies it — including its flip-and-turn-clay
open state. The user has ruled it out regardless and **will update
`design/Orla - Screens.dc.html` themselves**. It is recorded here so the next
`parity-checker` pass reads it as an accepted override instead of re-filing it as a
regression, which is what happened to #228 and #338.

**The 12 render sites, verified 2026-08-30** (`grep -rn "▾" apps/web/src`, excluding tests
and comments):

| File | Line | Trigger |
| --- | --- | --- |
| `search/category-select.tsx` | 197 | Hero + compact `Vendor type` |
| `search/city-select.tsx` | 116 | Hero + compact `City` |
| `search/search-bar.tsx` | 401 | Hero + compact `Event date` |
| `search/refine-bar.tsx` | 117 | Every Refine chip on `/search` |
| `bookings/bookings-refine-chips.tsx` | 99, 115 | `All categories ▾`, `Soonest first ▾` — **interpolated into the label string**, not a separate node |
| `vendors/profile/booking-rail.tsx` | 245, 312 | Date and package pickers |
| `booking/booking-request-screen.tsx` | 415, 470 | Date and event type |
| `vendor-profile-form.tsx` | 332 | Section disclosure |
| `customer/customer-profile-form.tsx` | 212 | Budget |

**The first three are what the user is looking at**; the other nine are the same glyph and
the same instruction.

**Two sites behave differently and will not fall to a single edit.**
`bookings-refine-chips.tsx` builds the caret **into the label string**
(`` `${SORT_LABELS[sort]} ▾` ``), so removing it changes the trigger's accessible name —
and `bookings-hub.test.tsx` asserts that name in **six** places (lines 200, 201, 354, 426,
427, 449). Those assertions are part of the deliverable, not collateral. Every other site
renders the glyph as its own element.

**Flagged, not blocking — the affordance, which is a different question from parity.**
These triggers are custom `button`s, not native `<select>`s, so the caret is currently
their only *visual* disclosure cue. Removing it is the user's call and this ticket carries
it out; what must not also disappear is the control's legibility as a control. Each trigger
keeps its own fill and border, and **`aria-expanded` stays on all of them** — screen-reader
users were never served by the glyph anyway, since it is decorative and already hidden from
the accessibility tree.

**Non-goals:** the category chip on the vendor card (`vendor-card.tsx:216`) — the first
draft of this ticket aimed there by mistake and **no one has asked for it to go**; the
`▴`/`▾` pair in any non-dropdown context, if the sweep finds one; `42-dropdowns.md` and the
frames, which the user is correcting.

**Acceptance:**

- [ ] No dropdown trigger in `apps/web/src` renders `▾` or `▴`, at any state, on any surface
- [ ] The landing hero's three segments — `Vendor type`, `City`, `Event date` — draw no
      triangle at rest or open, verified in a browser at 1440×900
- [ ] `bookings-refine-chips.tsx`'s two labels no longer carry the glyph in the string, and
      the six assertions in `bookings-hub.test.tsx` are updated to the new accessible name
- [ ] Every trigger keeps `aria-expanded` and stays visually identifiable as a control
- [ ] No trigger is left with a stray empty span, or with padding that was reserving space
      for a glyph that is gone — the segments re-measure, they do not just lose a character
- [ ] `.claude/plans/vendor-marketplace-decisions.md` records this as a **user override of
      the design contract**, noting that `Orla - Screens.dc.html` and `42-dropdowns.md` are
      being corrected by the user rather than by a ticket
- [ ] The frames are **not** edited by this ticket

**Tests (required):**

- [ ] A test that no dropdown trigger's rendered text contains `▾` or `▴` — the override
      stated as an assertion, so a later parity pass restoring it from the frame goes red
- [ ] The six updated `bookings-hub.test.tsx` name assertions, asserting the new name
      explicitly rather than being loosened to a substring match
- [ ] A test that each converted trigger still exposes `aria-expanded` in both states

### #365: 12 Sign up — the D16 copy ruling and four measured gaps

**Milestone:** M3 | **Priority:** P1 High | **Status:** Superseded | **Capabilities:** `core` `auth`
**Blocked by:** None

Filed 2026-08-30 from #357's `parity-checker` pass on frame `12`.

**The copy defect is the reason this is P1.** D16 ruled `Create my account` **a code
defect, not a plan gap** (`21-sign-up.md:61-66`), and the app still renders **`Continue`**.
#357's own notes recorded frame `12`'s correction as one the code "was already right" for.
It was not — that claim was never measured, and the parity pass is what caught it.

**Fix the comment as well as the string.** `apps/web/src/app/clerk-copy.ts:7-11` says
`21-sign-up.md` records a deviation permitting `Continue`. That file rules the opposite.
Changing the string and leaving the comment is how the next reader re-derives the wrong
answer — the comment is the more durable half of the defect.

**Measured at 1440x900 against frame `12`:**

| What | Frame | Live |
| --- | --- | --- |
| Primary action | `Create my account` | `Continue` |
| Password helper | `At least 10 characters`, 11.5px `#6B6459` | absent |
| Sub-headline | 14px | 15px |
| Helper under submit | 11.5px | 11px |
| `VENDING` micro-label | `#C4D6A8` | `sage-200 #A8C08E` |
| Panel padding | `46px 48px` | `48px` all round |
| Sub `max-width` | 415px | 400px |

**`sage-175` does not exist.** `01-foundations.md` rules that `#C4D6A8` should be minted as
`sage-175`; `packages/config/tailwind/theme.css` has no such token. Same shape as #357's
`clay-150` and `stone-250` — the plan named a token the theme never gained, so this is a
mint, not a swap. It is not an AA failure today (5.96:1 against its own band), so the
defect is that the value is off-token, not that it is illegible.

**Not a finding, and must not be "fixed":** the disabled submit renders `stone-500 #C9C1B5`
where the frame draws `#9A9184`. `01-foundations.md:95-98` bans `#9A9184` by name and tells
the app to use a compliant disabled treatment. **The app is right and the frame is the
outlier** — a later pass restoring the frame's value would be a regression against the law.

**Also present, both dev-only or Clerk-owned:** `Secured by Clerk` and `Development mode`
render below the form and are in no frame. Confirm the first is suppressible before filing
it as work; the second does not ship.

**Acceptance:**

- [ ] The primary action reads `Create my account`, and `clerk-copy.ts`'s comment names D16 and `21-sign-up.md:61-66` as the ruling rather than claiming a deviation
- [ ] `At least 10 characters` renders under the password field at 11.5px `#6B6459`
- [ ] The sub-headline is 14px and the helper under the submit is 11.5px
- [ ] `sage-175 #C4D6A8` is minted between `sage-150` and `sage-200`, and `VENDING` resolves to it
- [ ] The disabled submit is **left alone** — `stone-500`, not the frame's banned `#9A9184`
- [ ] `parity-checker` returns MATCH on frame `12` for text, font and colour

**Tests (required):**

- [ ] A test asserting the sign-up primary action string, so a Clerk appearance change cannot silently revert it
- [ ] A token test that `sage-175` exists and resolves to `#c4d6a8`, in the shape #357 added for `clay-150`
- [ ] A guard that `#9A9184` appears in no source file — the value the foundations ban by name

### #366: 16 Server error — page chrome and type scale

**Milestone:** M3 | **Priority:** P2 Medium | **Status:** Backlog | **Capabilities:** `core`
**Blocked by:** None

Filed 2026-08-30 from #357's `parity-checker` pass. #357 corrected this frame's CTA
(`Browse vendors` -> `/search`, D17) and verified it in a real 500. Everything else on the
frame was measured at the same time and is recorded here.

**The chrome is the substantial half.** Frame `16` draws a **bespoke 64px header** — the
logo left, **`Contact support`** 13.5px/600 `#A34A28` right — and **no footer**. The app
renders the full site header (`Orla` / `Sign in` / `Sign up`) and the full site footer, and
**`Contact support` exists nowhere in the application**. That is not a styling gap: the
frame gives a reader whose page just crashed one route to a human, and the app gives them
the ordinary navigation of a site that is currently broken.

**It also makes the page scroll.** `scrollHeight` measured **964** at a 900 viewport, where
frame `16` is a single non-scrolling screen, and the content block sits roughly 100px above
the frame's centring. Removing the footer is most of the fix.

**Type scale, measured:**

| What | Frame | Live | Source |
| --- | --- | --- | --- |
| h1 | 38px, ls -0.57 | 34px (`text-display-lg`), ls -0.51 | `error-screen.tsx:38` |
| Body | 14px / lh 1.65 | 12.5px (`text-sm`) / lh 20.625 | `error-screen.tsx:42` |
| Reference chip | 12px | 11px | — |

**The banner needs a ruling before it is coded.** Frame line 1619 draws `background:#EDF0E9`,
`border-radius:10px`, `padding:11px 16px`, **no border**, text 12.5px **weight 500**. The app
uses the shared `Banner status="settled"`: the `sage-50` fill matches, but it carries a
`sage-300` border, radius 14, padding `13px 15px` and weight 400. `--color-sage-300` is
commented "sage banner border", so the bordered form is a deliberate component decision.
**This is frame vs component library** — decide whether frame `16` gets a bespoke banner or
the frame is corrected, and record it, rather than forking the component.

**One inconsistency the app has with itself:** this screen renders curly apostrophes
(`wasn't`, `We've`, `we're`) where the frame writes straight ones, and `/sign-up` renders
straight ones. Pick one and apply it; the frames are not consistent either, so this needs a
content-voice ruling rather than a local fix.

**Acceptance:**

- [ ] Frame `16` renders its own 64px header — logo and `Contact support` — and no site footer
- [ ] `Contact support` resolves to a real destination, decided and recorded, not a dead link
- [ ] The page does not scroll at 1440x900: `scrollHeight` <= 900
- [ ] h1 is 38px and the body line is 14px at lh 1.65; the reference chip is 12px
- [ ] The banner question is **ruled and recorded** in the plan before any code changes — bespoke banner, or corrected frame
- [ ] The apostrophe form is ruled once in `31-content-voice.md` and applied to both this screen and `/sign-up`

**Tests (required):**

- [ ] A test asserting the 500 screen renders no site footer and no primary nav, since both return the moment the layout changes
- [ ] A test that the recovery CTA is still `Browse vendors` -> `/search` — #357 landed it and this ticket edits the same component

### #367: 18 Search no results — empty glyph, relaxations, and `all two filters`

**Milestone:** M3 | **Priority:** P2 Medium | **Status:** Backlog | **Capabilities:** `core`
**Blocked by:** **#358**

Filed 2026-08-30 from #357's `parity-checker` pass on frame `18`.

**Start with the copy defect — it is the only one a user reads as broken English.**
With two filters set the headline renders **`No photographers match all two filters`**.
`apps/web/src/components/search/relaxations.ts:102` composes `all ${spelled(count)} filters`
and `spelled(2)` returns `"two"`. Three filters reads correctly (`all three filters`). It
should read `both`, which means the count-2 case needs its own branch rather than a wider
`spelled` table.

**The empty glyph is a generic icon where the frame draws the brand.** Frame line 1709 draws
the Orla mark *absent* — a 62x38 group of two 38px circles, one `1.5px solid #D5CEC2`, one
`1.5px dashed #D5CEC2`. The app renders a 32x32 lucide `circle-x`. The colour is already
right (`stone-400`); the shape is the finding.

**The relaxation buttons differ in count, order and treatment:**

| | Frame | Live |
| --- | --- | --- |
| 1 | `Search within 100 mi` (`.btnP`) | `Any date` (`.btnP`) |
| 2 | `Any price` | `Any price` |
| 3 | `Any date` | `Anywhere` |
| 4 | — | `Clear all`, underlined clay |

**The distance relaxation is partly unbuildable as drawn** — there is no distance filter in
the product to relax — so the frame's first button cannot be reproduced without inventing a
filter, which is out of scope here. The extra fourth button and the reordering are not
excused by that and should be fixed.

**A count row sits where the frame goes straight through.** The app renders
`0 photographers in Marfa` plus the price line between the Refine bar and the empty block,
occupying y 118-173; frame `18` runs the 54px Refine bar directly into
`flex:1;padding:44px 26px`.

**Blocked by #358**, which owns `vendor-card.tsx` and the Refine bar at the same widths.
Two lanes in those files will collide.

**The nearby-dates band was unverifiable, not missing.** `nearby-dates-band.tsx` exists and
is wired; it renders nothing because the lane database has no availability rows at all
(`/vendors/availability/nearby` returned `{"items":[],"total":0}` for every date probed).
Verifying it needs a seed that produces availability — decide that first, because a pass
that cannot render the band proves nothing.

**Carry this into #358:** the band's cards are `VendorCard`s, and the sage `Free ...` chip is
one of only **two** surviving sage sites. #358 removes that chip from the result grid and
**must spare the band**.

**Not a finding.** The diagnosis sentence reads `The date is the narrowest filter here`
where the frame reads `Marfa is a small market — the distance limit is the usual culprit`.
That is a documented, reasoned deviation (`relaxations.ts:126-135`): the market-size half is
an unmeasured claim, and the no-invented-numbers law forbids it. **The app is right.**

**Unresolved between two frames, needs a ruling:** frame `02` draws the Refine bar's set
value as a **clay dismiss chip** (`Under $1,200 ✕`), frame `18` as the same, and the app
draws a **stone** set-value chip (`$0 – $1,200 ▾`) with the word `Clear` rather than
`Clear all`. Settle the chip treatment once for both frames before coding either.

**Acceptance:**

- [ ] `No photographers match both filters` at count 2, and `all three filters` still correct at count 3
- [ ] The empty state draws the Orla mark absent — two 38px circles, one solid and one dashed, `1.5px #D5CEC2` — not a generic icon
- [ ] The relaxation row draws three buttons in the frame's order, with no fourth `Clear all`
- [ ] The count row does not render on the no-results state; the Refine bar runs into the empty block
- [ ] The Refine chip treatment is **ruled once** for frames `02` and `18` together and recorded, then applied
- [ ] The nearby-dates band is driven with real availability data, and its sage chip survives #358

**Tests (required):**

- [ ] A test over `relaxations.ts` asserting the headline at counts 1, 2 and 3 — the count-2 case is the regression
- [ ] A test that the no-results state renders no count row
- [ ] A test asserting the nearby-dates band keeps its sage chip, so #358's removal cannot take it

### #368: A failed search is indistinguishable from an empty one

**Milestone:** M4.5 | **Priority:** P1 High | **Status:** Backlog | **Capabilities:** `core`
**Blocked by:** None

Filed 2026-08-30 from #357's `browser-verifier` pass, found incidentally while the API
rate limit was deliberately exhausted to reach the 500 screen.

`apps/web/src/components/search/search-shell.tsx:171` swallows the failure with a bare
`.catch(() => {})`. With the API returning 429 for every request, `/search` rendered the
**ordinary empty-result heading** — `0 vendors` — with **no error state and nothing in the
console**. Nothing anywhere on the page distinguished "the search backend is down" from
"nobody matches your filters".

**This is the same class of defect #357 just closed on the coverless block:** an internal
condition rendered to the customer as ordinary product copy. There it was a developer's
hatch on a public page; here it is a backend outage dressed as a legitimate result. It is
worse than the hatch, because the hatch at least looked wrong.

**It also defeats verification.** A browser pass driving `/search` against a broken API sees
a clean, plausible page and reports it green. Any agent verifying search results can be
lied to by this branch, which is why it is P1 despite being a rare state.

`40-states.md` is the governing law and gives the answer: **steel is information, gold is
waiting on someone, red is failure, sage is settled.** The failed branch currently draws
none of them — it draws the empty state, which is not a failure at all.

**Check the sibling call sites in the same pass.** A bare `.catch(() => {})` in one data
path usually has company; find the others before deciding the shape of the fix, so this is
closed as a class rather than as one line.

**Acceptance:**

- [ ] A failed search renders a real failure state — red per `40-states.md`, distinct from the empty-result state in wording and colour
- [ ] The failure is legible in the console as well as on the page, so a browser pass cannot mistake it for a clean render
- [ ] Every other bare `.catch(() => {})` in the web app's data paths is found and either fixed or explicitly justified in a comment
- [ ] The empty-result state is unchanged for a genuinely empty search

**Tests (required):**

- [ ] A test that a rejected search request renders the failure state and **not** the empty-result heading — the two branches must assert different text
- [ ] A test that a resolved-but-empty search still renders the empty state, so the fix does not collapse the two
- [ ] A guard test that no new bare `.catch(() => {})` appears in `apps/web/src`, in the shape of the existing source-scanning guards

### #369: Retire or keep `Placeholder`, and rule the 32x32 icon-only submit

**Milestone:** M4.5 | **Priority:** P3 Low | **Status:** Backlog | **Capabilities:** `core`
**Blocked by:** None

Filed 2026-08-30 from #357's browser and parity passes. **Two loose ends, both needing a
decision rather than an obvious fix** — which is why they are one low-priority ticket rather
than two pieces of work.

**1. `placeholder.tsx` is now dead code.** After #357 removed the labelled hatch from the
search card and the profile header, `grep -rn "<Placeholder"` over `apps/web/src` returns
**nothing**. What remains is the component, its own test, and the `.placeholder-hatch`
utility in `theme.css` — and the utility is still used directly by `image-upload.tsx`.

That is consistent with D17's *never on a public page*, but "no public page" is not "no
page": the hatch is a legitimate **build-time device** for photography the product lacks,
and the editor is exactly where it belongs. **Decide, and record the decision:** keep the
component as an editor-only primitive with a rule that bans it from public surfaces, or
retire the component and keep the utility for direct use. Deleting it silently loses the
reasoning; leaving it un-ruled means the next parity pass re-files it.

If it is kept, the guard is the deliverable: a test that no route under a public path
renders it. #357 verified that by hand once — a test makes it hold.

**2. The `/search` header submit is 32x32, against a 44x44 law.** `04-laws.md` sets 44x44 as
the minimum target size. `button[aria-label="Search"]` measures **32x32** and is the only
icon-only control on the page. It carries its label, so this is **target size, not
labelling**.

**The law and the design contract are in standing conflict here.** Frames `02` and `18`, and
the five-siblings compact-bar ruling in `11-search.md`, all draw a 30-32px circle. One of
the two has to give, and neither is obviously wrong: the law protects motor accessibility,
the frames protect a dense bar that was measured deliberately.

**Nothing in the repo checks the law either way**, which is why it went unnoticed. Whatever
is ruled, the deliverable includes the check — otherwise the next frame to draw a small
target reintroduces it silently.

**Acceptance:**

- [ ] The `Placeholder` question is ruled and recorded in `design-plan/` — kept as an editor-only primitive, or retired
- [ ] If kept: a test asserts it renders on no public surface. If retired: the component and its test are deleted and `.placeholder-hatch` keeps its remaining caller
- [ ] The 32x32-vs-44x44 conflict is ruled in `04-laws.md` or `11-search.md`, naming which of the law and the frames gives way and why
- [ ] The ruling is enforced by a check, not only written down

**Tests (required):**

- [ ] A test enforcing whichever `Placeholder` ruling is taken
- [ ] A test asserting the minimum target size the ruling settles on, over the interactive controls the ruling covers
