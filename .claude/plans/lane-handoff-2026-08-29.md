# Lane handoff — 2026-08-29 parity run

Written when a seven-lane parity run was stopped mid-flight so three new
`/loop` lanes could take over. **Three branches carry finished work that is NOT
on `main`.** Read this before working any ticket in #124–#164, or you will redo
about thirty tickets.

## 1. Preserved branches — merge these, do not redo them

All three worktrees are registered, trees clean, servers and lane databases left
up. Nothing here is on `main`.

| Branch | Worktree | Commits | Covers |
| ------ | -------- | ------- | ------ |
| `worktree-137` | `.claude/worktrees/137` | 25 | most of #137–#152, frame `09 Vendor profile editor` |
| `worktree-153` | `.claude/worktrees/153` | 11 | #153–#164, frame `11 Availability` — **partial fix on top, see §2** |
| `worktree-124` | `.claude/worktrees/124` | 7 | several of #124–#136, frame `08 Vendor dashboard` |

Lanes 124 and 137 **never delivered a final status record** — they were stopped
before their closing verification. Treat their board rows as claims to re-check,
not as evidence. Lane 153 did deliver one, and it was wrong (§2).

## 2. `worktree-153` must not be merged as-is — three reviewer findings

Lane 153 declared itself complete with a green gate. Its `diff-reviewer` stalled,
reported *after* the lane had stopped, and found:

1. **HIGH, blocking — #157's 44x44 hit area is not 44x44, and it is a
   regression.** `availability-calendar.tsx:107` uses
   `before:absolute before:size-11 before:-translate-y-1/2`. The pseudo overflows
   the button's own 16px box and is clipped by `section.app-pane`, which
   `packages/config/tailwind/theme.css:324` sets to `overflow-y: auto`. **The
   shortfall is 1px, not 3px** — re-measured on the real page with Instrument
   Sans, `elementFromPoint` gives a vertical reach of **43px** (glyph top y=99,
   centre y=107, pseudo top y=85, pane content origin y=86) and a full 44px
   horizontally. The reviewer’s ~41px came from a Georgia fallback, which moves
   the glyph box and hence the centre. The conclusion stands; someone
   re-measuring and finding 43 has not disproved it. The `Button variant="ghost"
   size="icon"` it replaced was `size-11`, a real 44px box **in flow**, which
   nothing could clip. Fix with a real in-flow 44px box and the glyph drawn at
   the frame's 13px inside it.
2. **MEDIUM — #156's regression guard pins nothing.**
   `availability-calendar.test.tsx:585` uses `toContain('py-2')`, and
   `'py-2.5'.includes('py-2')` is true. Proven by mutation: the call site was
   changed to 10px against the frame's 8px — the exact defect #156 exists to
   prevent — and all 35 tests stayed green. Same shape at line 586 and the
   `text-${token}` assertions at 606-607 and 631.
3. **LOW — three assertions cannot fail.** `availability-calendar.test.tsx:538-541`
   assert literals their own `slice` starts with; line 539 is unreachable because
   the `FRAME_11_RAIL` IIFE throws at module load if the slice is empty.

Also: **ticket #259's text is wrong as written.** It claims "#157 removed the two
controls that were sitting on the edge, so the hazard is currently latent." #157's
controls are the ones being clipped.

**The lesson worth keeping: reading a class string is not measuring a hit area,
and a stalled review agent may still report later.**

## 3. Ticket ids — collision hazard

`main` is contiguous through **#254** (`HIGHEST_REGISTERED_TICKET` = 254).

`worktree-153` independently filed **#254–#270**, so its #254 collides with
lane 103's #254 already on `main`. On merge, shift lane 153's block to
**#255–#271**. `worktree-124` and `worktree-137` also filed from #254 and will
collide the same way.

Filing is a three-file change — the Status Board, `packages/shared/src/env/tickets.ts`,
and `HIGHEST_REGISTERED_TICKET` in `packages/shared/src/env/registry.test.ts` —
and `registry.test.ts` asserts **"registers a contiguous ticket range with no
gaps"**, so never reserve a range or leave a hole. File contiguously and
reconcile collisions at merge; it is mechanical.

`pnpm test` caches a green over tracker edits. Only `pnpm test --force` is evidence.

## 4. Already done — do not rework

Merged to `main` and verified: **#82–#87, #89** (frame 01), **#90, #91, #93–#98,
#100, #101** (frame 02), **#103–#105, #107–#109, #111, #112, #114–#116**
(frame 03), **#117–#123** (shared chrome).

`main` is at 35/83 of the parity findings. Still `Blocked`: **#92, #99**.

## 5. Environment traps that cost real time

- **Every `/vendor/*` route 307s to `/vendor/profile/edit` on a fresh lane
  database.** `pnpm preflight` passes anyway — it counts the 16 marketing
  vendors, none of which belongs to the e2e Clerk account. Either create the
  storefront (the form fails **silently** on an unset state combobox: click it,
  `type('Texas')`, `Enter`, then submit — success is `POST 201 /vendor/profile`)
  or repoint a marketing storefront to the e2e vendor directly in the lane
  database, which proved faster.
- **`lane:up` / `lane:down` home a lane at `process.cwd()`**
  (`packages/preflight/src/lane/cli.ts:22`, and `:48` for down). Run them from
  **inside** the worktree, or the lane lands on `main` in the shared checkout
  with no isolation, and a teardown deletes whichever `.env.lane` sits in the
  cwd. Both happened in this run.
- **A manually created worktree gets none of `.worktreeinclude`'s gitignored
  files.** Copy `.env*` and `.auth/` in before `lane:up`, or it cannot derive
  the lane database.
- **`check-staging.mjs` reads the SESSION cwd, not your worktree**, so another
  lane's stray file in the main checkout blocks your commit. Three lanes hit
  this. Do not delete another lane's files — say so and have it cleaned up.
- **`protect-main.mjs` false-positives.** `/i` on its short-flag alternation
  makes `-F` match `-f`, and it matches the word "push" anywhere in the command
  including a heredoc body, so `git commit -F -` with "push" in the message is
  refused as a force-push.
- **Lanes share one scratchpad.** Prefix every scratch file with your lane
  number; generic names get silently overwritten by another lane, producing a
  script that appears to work while measuring the wrong thing.
- **`EMFILE` from Watchpack presents as a bogus "Clerk can't detect
  clerkMiddleware" 500 on every page.** Not a Clerk problem.
- **`pnpm e2e:auth` is hardcoded to `localhost:3000` but honours
  `E2E_BASE_URL`.** The Clerk dev session lapses within minutes — refresh
  immediately before measuring, not at setup.
- **Navigate with `domcontentloaded`, never `networkidle`** — the vendor screens
  hold an SSE stream open, so `networkidle` never settles.

## 6. The ledger is unreliable per-frame

`.claude/plans/parity-sweep-ledger.md` had confirmed mis-transcriptions on frame
03 (an overlap recorded as 14px is 16px; a control recorded as h39 is 38px),
while frames 08 and 11 were independently re-derived and found **accurate**.
Re-derive every `expected` value by rendering `design/Orla - Screens.dc.html` in
Chromium at 1440x900 after `document.fonts.ready`, reading computed styles **in
situ**. Do not extract a frame block into a standalone file — a parity-checker
did that and produced wrong numbers a lane had to refute.

**Never edit anything under `design/`.**

## 7. Repository state

`main` is **63+ commits ahead of `origin/main`** and has not been pushed.
Lane 103's **PR #17 is still open**; it closes itself once `main` is pushed.

The root dev server on :3000 returns **500 on `/sign-in`** — stale after the
merges, needs a package rebuild and restart. The lane servers are unaffected.

## 8. Open rulings owed by a human

- **#118** — `02-brand-and-logo.md` states "wordmark size 1.60 D" as a law, but
  ten desktop frames pair a 15px mark with a **23px** wordmark (1.533) while
  frame 01 draws the 24px that 1.60 gives. Should the law become 23/15 — which
  also moves the sign-up panel onto frame 12's 29px and the mobile header onto
  the frames' 21px — or do the vendor frames yield? The app matches the plan at
  24px; the logo half of #118 was reverted rather than shipped.
- **#88** — should an untouched hero bar arrive pre-filled with `Austin, TX`?
- **`How it works` numerals** — clay-200 on stone-100 is **1.20:1**.
  `10-landing.md:116` specifies clay-200; the contrast law forbids it.
- **#92** — close as a duplicate of #25, or keep as the rendering half?
- **#99** — add a token for `#EADCCB` (it sits on no ramp between `clay-100` and
  `clay-200`), or correct the plan and keep `clay-100`?
- **#106 / #113** — both turn on whether the demo seed should carry portfolio
  images and durations. Is that #14's work?
- **#110** — should `Send a message` create a real pre-booking conversation
  (there is no `POST /conversations`), or stay disabled with the blocker named?

## 9. Wave 6's premise did not hold

The plan predicted "a large number" of findings would close for free once #74,
#165 and #198 landed. **Across 40 findings re-measured, 9 closed** — and the
shared-chrome lane closed zero. Those tickets moved computed values without
landing them on the frame, and in one case (#84) moved *away* from it. Re-measure,
but budget for implementation.

## 10. `worktree-137` — the one detailed handoff we got

27 commits. **10 of #137–#152 closed**: #139 `24ecc75`, #142 `1d05ba0`,
#143 `6517fb6`, #144 `92f448b`, #145 `3deb775`, #146 `047defd`, #147 `6071377`,
#148 `f21987f`, #149 `7d6a052`, #151 `d70d105`, plus **#150 closed by
re-measurement** (`959a777`, already Instrument Sans — fixed upstream by
`bf525f9`). Filed **#254** and **#255**, which will collide per §3.

**Looks finished but is not:**

- **The closing combined `parity-checker` + `browser-verifier` pass never ran.**
  Changes were verified individually; the whole screen was not verified after
  #151/#152.
- **#152 is partial** (`06446f7`) — 2 of 8 helper strings removed, the rest
  classified and blocked on #138.
- **#141 was measured, not started** — scroll ratio **1.834** (sh 1410 / ch 769),
  **257px over** the 1154px budget. No code written, never browser-verified.

**Blocked (4), each with a real question:** #137 (`40-states.md`'s "never a
second uploader" vs frame 09's cover zone — a law-vs-frame precedence call),
#138 (deleting `Your line` / `Years in business` breaks frame 03's pull-quote and
Experience tile), #140 (blocked on **#9** — no `/vendor/payouts` route and no
`payouts` blocker key), #152 (blocked on #138).

**It changed four SHARED files — expect conflicts:** `ui/input.tsx`,
`ui/label.tsx` (**30 call sites across 9 files**), `category-icon.tsx`, and
`packages/config/tailwind/theme.css`. All 926 web tests pass on the branch.

**Two more environment traps, both new:**

- **Dev uses `distDir: '.next-dev'`, not `.next`.** A corrupt dev dist produces
  the *same misleading* "Clerk can't detect clerkMiddleware()" 500 on every
  route, and clearing `apps/web/.next` does nothing. Clear `.next-dev`. This is a
  **second, distinct cause** of that error from the EMFILE one in §5.
- **The state control is `role="combobox"`, not `button`.** `getByRole('button')`
  finds nothing and the submit silently no-ops — this is the mechanism behind the
  silent-failure trap in §5.
- **Clerk sessions lapse in ~2 minutes**, not "within minutes". Chain `e2e:auth`
  immediately before every browser run.
- **`brand-literals.test.ts` scans comments** — writing the product name in a
  code comment fails the suite.

**Fixture state it created:** the e2e vendor owns a real storefront in
`vendor_marketplace_lane_137` — `Kessler & Co.`, slug **`kessler-co-2`** (the
`-2` because a donor slug already existed), created through the form. Response
time is deliberately left unset so the gold publish blocker matches the frame.
Its servers are still up: web **3023**, api **4023**.

## 11. `worktree-153` — a PARTIAL fix now sits on top

The branch is **not** at `cc10f50`. Commit **`4aedac7`** was added, clearly marked
PARTIAL, containing **only** the §2 finding-1 fix: the pseudo-element swapped for
a real in-flow 44px box, plus a `hasClass` exact-token helper used for that one
assertion. Typecheck, lint, format and the 35 unit tests are green.

**`4aedac7` now looks VALIDATED.** A `browser-verifier` run that landed after the
lane stopped measured **both nav buttons at exactly 44x44 via
`getBoundingClientRect`** — a real in-flow box, not a clippable pseudo — and
`elementFromPoint` 15px from the edge resolved to the button, after which a real
click at that coordinate paged the window. Paging back re-disabled `‹`
correctly. That is the shape §2 asked for, so the blocking finding appears
closed; confirm once on your own stack before trusting it. **Findings 2 and 3 in
§2 are still untouched.**

To hand over the original state instead, `git revert 4aedac7` is clean. The ten
commits through `cc10f50` are untouched beneath it.

**Lane 153's servers are DOWN.** Both were killed and the web restart failed with
72 EMFILE errors. `ulimit -n 65536` before the spawn fixed it the first time, but
system-wide `kern.num_files` is only 21.5k of 184k with five `next-server`
processes running, so it may need a different remedy. Lane 137's servers are
still up (web 3023, api 4023); lane 124's were left up.

**Two more operational traps, both costly:**

- **`process.cwd()` resets between Bash calls in an agent thread.** Since
  `lane:up` / `lane:exec` / `lane:down` take the worktree from cwd (§5), every
  single invocation needs its own `cd` **inside the same command** — otherwise
  the lane silently re-homes onto `main` in the shared checkout.
- **Commit from a lane with `git -C <worktree>`.** The staging hook reads the
  session cwd, so without it a lane's commit blocks on another lane's dirty
  files (§5).

## 12. Frame 11's closing parity pass — arrived after the lane stopped

**The eight fixes all MATCH** and there are **no regressions** in the measured
areas: rail 341px @ x:1099, content column x:289, month track 248.656/248.672/
248.672px, day-row pitch 33px, cell radius 7px, scroll budget exactly 1.0x.
Colour axis is a full MATCH.

**Do not read this pass as clearing §2's hit-area finding.** It reports "44x44
confirmed" from `elementFromPoint` at centre **±21px** on all four corners — a
42px span, which passes at a 43px reach. It never probed ±22px, so it is
consistent with, not a refutation of, the 1px shortfall. Three measurements now
exist (~41px on a Georgia fallback, 43px on the real font, ±21px passing);
**43px is the one to trust**, and `4aedac7` is the untested fix for it.

**It was wrong about one thing:** it reported the `postgres` container stopped.
It is up and healthy, as is MinIO. Verify before acting on that claim.

**A false alarm it correctly withdrew, recorded so nobody re-files it:** focus
rings sampled immediately after `Tab` read as absent because `transition-all` is
mid-flight. After ~700ms they settle to the correct
`ring-2 ring-clay-400/30 ring-offset-2 ring-offset-stone-50`. Always let the
transition settle before judging a ring.

**Six new findings, none yet ticketed:**

- **N1 — Access, and the lane's own #164 introduced it.** Heading order is now
  `h1 Availability` → `h3 August/September/October`, with the only `h2`s in the
  rail *after* all three `h3`s (`availability-calendar.tsx:371`). Before #164
  there was no `h1`, so the skip is newly reachable. Real WCAG 1.3.1 defect;
  nothing else gates it.
- **N2 — plan-vs-frame, shared chrome across frames 08/09/10/11.** The frames
  draw one right-side item plus an avatar (`Dashboard`, 13.5px/500/#4A443C, and a
  32x32 #EADCCB circle). Live draws **two** links at #A34A28/13.5px/600, a 44x44
  notifications bell, and a Clerk user button. #117/#118/#120/#121/#124 each
  touched the header and none covers this. The bell is required by **#8's own
  spec**, so this needs a ruling, not a silent fix.
- **N3 — sidebar nav rows carry leading icons** and a count pill; the frame's
  `.nav` is text-only. **#79** is scoped to "labels and order" and does not cover
  it.
- **N4 — rail micro-labels are 1px short**: `mb-2.5` (10px) against the frame's
  `margin-bottom: 11px`, on all three.
- **N5 — fold into #266, do not file separately.** The market-note substitute
  string is in neither the frame nor `31-content-voice.md`. The *substitution* is
  sanctioned by `19-availability.md`'s Post-MVP note; the wording is not.
- **N6 — named, not filed.** All 92 day cells are individual tab stops; crossing
  the calendar takes 62 `Tab` presses. A grid would normally use roving
  `tabindex`. Not one of the six laws, and the frame cannot settle it.

**Data-coverage caveat:** the e2e vendor's calendar has **zero** booked, pending,
blocked or completed dates, so those four cell appearances were never measured on
a rendered cell — they were resolved from compiled CSS with detached probes (all
clear 4.5:1). Seed those states before trusting any future pass on frame 11.

## 13. Frame 11's browser verification — what is proven and what is not

**PASSED with evidence** (vendor role, 1440x900, lane 153's stack): page loads
with three months side by side; single-day click flips `aria-pressed` and updates
the rail; **drag-select** extends a range correctly (simulated with
`mousedown` + `pointerover` + `pointerup` on real coordinates, since the MCP
toolset has no drag primitive — `mousedown` alone selects only the anchor, which
matches real drag semantics); **Block these** fires
`PUT /vendor/availability 200`, cells become `Blocked by you` with `line-through`,
and **Open these up** reverses it, one `PUT 200` each; `Clear` resets. **The lane
database was restored to 0 booked / 0 blocked before the run ended.**

**NEVER VERIFIED — do these first on any resumed lane 153 work:**

- **Keyboard activation** (Tab + Enter/Space on a day cell and a month-nav glyph).
- **Signed-out state** on `/vendor/availability` — whether it redirects or flashes
  content.

Both were blocked when the lane's web server wedged into an **app-wide 500 on
every route including the public `/`**, with
`Clerk: auth() was called but Clerk can't detect usage of clerkMiddleware()`.
Note this is a **third** presentation of that same error, distinct from the EMFILE
and stale-`.next-dev` causes in §5 and §10 — and here `e2e:auth` does **not**
recover it, because the app is already down. It needs `next dev` restarted.

**Two things to settle, neither a defect:**

- **Month paging advances a full 3-month window per click**, not one month, so an
  intermediate window such as Sep–Nov is unreachable. A valid reading of "page
  the window", but confirm it is the intended granularity.
- **The `/events/stream` SSE endpoint is actively failing**, not merely held open:
  repeated `net::ERR_CONNECTION_REFUSED` and one
  `net::ERR_INCOMPLETE_CHUNKED_ENCODING` across the session. It did not visibly
  break the UI, but §5's "SSE holds the connection open" is an incomplete
  description of what is happening.
