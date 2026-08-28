# 40 — Error, loading and empty states

Frames 15–26 in `Orla - Screens.dc.html`. Every state is a designed screen, not a
fallback. If a state isn't here, it isn't built.

**Section number 25 is used twice in the source file** — once for the 1024
small-laptop set (`30-responsive.md`) and once for `25 Upload failures` below.
Every frame's `data-screen-label` is still unique, so **always reference a frame
by its full label**, never by its section number alone. The three 1024 state
frames are `25 Search — loading · 1024`, `25 Search — no results · 1024` and
`25 Vendor dashboard — empty · 1024`; they are the 1024 renderings of 17, 18
and 20 below.

## The four questions every error must answer

1. **What happened**, in the user's words — not the exception.
2. **Was money moved?** Any error on the checkout, quote-accept or payout path
   states the money position explicitly, even when the answer is "nothing".
3. **Is my date still mine?** Availability is the scarce resource; say whether
   the hold survived.
4. **What do I do now?** One primary action. "Retry" alone is not an action.

Copy is a single sentence per job. No apology paragraphs, no "Oops", no exclamation marks.

## Colour semantics — these do not bend

| Colour                       | Means                               | Used for                                                                            |
| ---------------------------- | ----------------------------------- | ----------------------------------------------------------------------------------- |
| Steel `steel-50 / steel-600` | neutral information, self-resolving | offline / reconnecting, degraded feature, informational toast                       |
| Gold `gold-50 / gold-600`    | waiting on someone                  | unpublished profile, publish blockers, availability conflicts, date-held countdowns |
| Red `error-50 / error-500`   | it failed                           | declined payment, validation failure, failed send, 500                              |
| Sage `sage-50 / sage-600`    | settled                             | success toasts, "no payment was taken" reassurance                                  |

Red is never used for `pending`. Gold is never used for a failure.

## Loading — one idiom per screen, never two

| Scope   | Treatment                                                                                        | Rule                                                                                                     |
| ------- | ------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| Element | 16px spinner, 2px `clay-400` ring, transparent quarter; label dims to 60%                        | inside buttons and single controls only                                                                  |
| Content | Skeletons mirroring real geometry; `stone-200` shimmer `stone-200 → stone-150 → stone-200`, 1.5s | min 200ms display so fast loads don't flash; chrome the user already filled in **never** skeletons       |
| Page    | The mark’s two rings converging and parting, 1.9s                                                | first paint and auth redirects only; geometry only, no wordmark (it renders before fonts are guaranteed) |

Skeleton variants: vendor card, list row, table row, message bubble. One per
content type; a generic grey box is a bug.

## Empty states

Muted geometric glyph (two circles, `stone-400`, one dashed) · Instrument Serif
headline at 26px in-app / 30px marketing · one `stone-700` sentence saying what
will appear here · **one** primary CTA. The surrounding chrome (grouping,
filters, rail) stays drawn so the user learns the shape of the feature.

Where an empty state has a _cause_, name the cause and make the CTA fix it —
frame 20 is the reference: a vendor's empty request list is almost always an
unpublished profile.

Rails are never blanked in an empty state. They carry mechanism copy (real
availability, payment held, no service fee) or a setup checklist.

## Validation

- Errors appear **after a submit attempt**, never while typing. Cleared per-field on correction.
- Three tiers, used together: red on the wrong field, gold on a field that is
  valid but costly (a date the vendor blocked), and a counted summary at the
  submit bar linking to each field.
- Every message says how to fix it: "Needs 10 digits — you're two short", not "Invalid".
- Primary button goes `clay-300` (disabled fill) while blockers exist; it stays
  visible and its helper line explains the block.

## Screens

| #   | State                    | Notes                                                                                       |
| --- | ------------------------ | ------------------------------------------------------------------------------------------- |
| 15  | 404                      | Marketing shell retained; recovery is category links, since most 404s are stale vendor URLs |
| 16  | 500                      | Sage money-position banner + selectable mono incident id                                    |
| 17  | Search loading           | Chrome real, 6 card skeletons, "Searching…" instead of a fake count                         |
| 18  | Search no results        | Names the likely-at-fault filter, one-tap relaxations, nearby-date alternatives             |
| 19  | Bookings hub empty       | Month grouping still drawn; rail carries the four mechanism promises                        |
| 20  | Vendor dashboard empty   | Gold blocker banner + setup checklist; empty pane names the cause                           |
| 21  | Checkout declined        | "You haven't been charged" + 24h date hold + no-third-attempt guidance                      |
| 22  | Request validation       | Red fields, gold blocked-date field, counted summary at the submit bar                      |
| 23  | Messaging offline        | Steel banner, composer stays usable, failed bubble at 55% with Retry / Delete               |
| 24  | Image upload in progress | Non-blocking, per-tile determinate rings, one aggregate line, cover as a designation        |
| 25  | Upload failures          | Partial success preserved; per-file reason and matching fix; one "Retry all"                |
| 26  | State library            | Banners, toasts, field states, loaders, skeletons, 4 dialogs, 403, rate limit               |

## Image uploads (frames 24–25)

Images are the only uploads in the product: portfolio shots, cover, vendor avatar.

Rules:

- **Never modal, never blocking.** Tiles appear the moment files are picked; the
  vendor can keep editing other sections and leave the page — images save as they finish.
- **Determinate progress only.** Per-tile percentage ring + a 3px bottom bar;
  queued tiles get a skeleton, not a spinner. One aggregate line for the batch
  (`Uploading 4 of 8 — 18.2 MB of 29.4 MB`) in steel, plus a compact count in the header.
- **Partial success is the normal case.** Successful files stay and are already
  saved; a failure never rolls back a sibling.
- **Cover** is a designation on an existing tile (drag to first slot), never a
  second uploader.

### Constraints, stated before the picker opens

JPG or PNG · 12 MB each · min 1200px wide · 20 files per upload. The same line
appears in the drop zone and the requirements rail.

### The four failure modes — each needs its own sentence

| Cause                                | Colour | Fix offered                                                             |
| ------------------------------------ | ------ | ----------------------------------------------------------------------- |
| Unsupported format / over size limit | red    | **Replace file** + the exact export advice ("JPG at 2400px wide")       |
| Connection dropped mid-upload        | red    | **Retry** — resumes; says the file is fine                              |
| Below minimum dimensions             | gold   | **Replace file** — explains it would look soft, not that it's "invalid" |
| Too many files in one batch          | gold   | trims the batch and says which files were held back                     |

A failed file **keeps its tile/row** so the vendor can tell which shot it was.
The banner counts failures and offers one _Retry all that can_; the header
aggregate turns red rather than adding a second alert. Never a bare
"Upload failed" toast.

## Dialogs (frame `26 State library`)

Interrupt only when the user cannot continue without deciding.

- **Availability conflict** — the date went while they deliberated. Gold pill,
  money position, two alternate dates.
- **Session expired** — states the draft is saved; re-auth in place.
- **Listing removed (410, not 404)** — existing bookings explicitly unaffected.
- **Destructive confirm** — exact refund split in dollars, what is released, and
  irreversibility; `error-500` fill on the destructive button only, never as the
  screen's primary elsewhere; always an escape hatch ("Message June instead").

## Not built yet

Upload failure detail view, partial-refund dispute flow, vendor-side payout
failure. All follow these rules when they land.
