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
| `worktree-153` | `.claude/worktrees/153` | 10 | #153–#164, frame `11 Availability` — **has known defects, see §2** |
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
   `packages/config/tailwind/theme.css:324` sets to `overflow-y: auto` — roughly
   the top 3px is unreachable, giving ~41px. The `Button variant="ghost"
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
