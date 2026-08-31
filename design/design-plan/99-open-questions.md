# 99 — Open questions

Design decisions worth answering. Resolved items are kept with their resolution
so the reasoning isn't lost.

## RESOLVED — Is this a one-event dashboard?

**No.** It's a standing hub for any vendor booking, now or in future. Upcoming /
History / All tabs; "Still to book" removed.

## RESOLVED — Does an Event entity exist in MVP?

**No, and no screen may assume one.** Bookings group by month derived from their
dates; occasion and venue are free-text fields on the booking. Events as a real
object with their own page are post-MVP. See `98-post-mvp.md`.

## RESOLVED — How do users search?

**Category + city + date, as three pickers.** Not a text query — nobody searches
"June Harlow" to find a photographer. A category chip strip above the results
makes switching type a single click, and name search is a secondary link for the
referral case. See `11-search.md`.

## RESOLVED — Public metrics on a brand-new app

**Deferred post-MVP.** Public pages carry no platform statistics; they prove
themselves with mechanism instead. Full before/after and the unblock condition
are in `98-post-mvp.md`.

## 1. What happens when a vendor doesn't reply? — **resolve inside MVP**

**Deferred post-MVP.** The 48-hour expiry is specified; the customer-side experience is not designed.
Options: auto-suggest similar vendors free on the same date · expire quietly ·
nudge the vendor at 24h and tell the customer it happened. This is the most
common failure path in a two-sided marketplace and it has no surface today.

## RESOLVED — Does reply-time ranking exist?

**No, and reply time is omitted from the MVP entirely.** Frame `08` renders
"Median reply time 2h · keep it under 4h to stay ranked"; that line is **not
built**, and the omission is recorded as a deliberate frame deviation in
`16-vendor-dashboard.md`.

The line failed twice over: the median needs message history that does not exist
on day one, and "to stay ranked" promises a ranking signal that was never built.
Softening the copy was considered and rejected — a plain nudge still needs the
median. Reply time is therefore absent from every MVP surface, public and
private. Unblock condition in `98-post-mvp.md`.

## 3. Review asymmetry

**Resolved.** Customer→vendor public; vendor→customer private but self-viewable,
and viewable by a vendor once they have been requested — so it is surfaced in the
messaging context rail ("About Priya").

## 4. Category ordering on the landing page

**Resolved: editorial (ops picks).** Six featured of eleven by `displayOrder`.
With counts deferred, the algorithmic option has no visible justification in MVP.

## 5. Photography

Every placeholder is labelled with the shot it needs. The product is photo-forward
by design, so launch quality depends on the first cohort of vendors having good
cover images. **Resolved:** no quality gate and no shoot-day offer — onboarding
states recommended sizes for photos and nothing more.

## 6. Where does the occasion field come from?

**Deferred post-MVP.** The booking card reads "Photography · Wedding". That occasion string is the
`event_type` already collected in the booking request form (screen 04) — confirm
it's a controlled vocabulary (Wedding / Birthday / Corporate / Quinceañera / …)
rather than free text, since it's now displayed as a label and will eventually
become the grouping key when events ship.

## 7. City coverage

Search assumes a set of live markets. Decide what a visitor sees for a city with
no vendors — MVP spec says "We're not in [city] yet" with email capture, which
needs a market list to check against.

## RESOLVED — Does the landing hero seed a search?

**No. All three segments render empty, in the placeholder tone.** Frame `01`
draws `Austin, TX` in the filled tone and templates the vendor type, so the frame
reads as a seeded query and live reads as three empty fields. **The frame is
corrected, not the code.** A hard-coded city is a claim about where the
marketplace operates, and an empty value drawn in the filled tone reads as a
value that is not there. The hero _badge_ still names the market out loud — "Now
booking in Austin" — which is a different thing from pre-filling a stranger's
query. See `10-landing.md`. Ruled 2026-08-30 (D16).

## RESOLVED — What does "scarce" mean on the availability chip?

**Nothing — the gold chip is dropped from MVP.** `03-components.md` said "gold
when scarce ("2 dates left")" and never defined it; the count is a real query
result but the _threshold_ — free dates in what window, below what number — is an
invented number. Nothing shipped it: `vendor-card.tsx` only ever rendered the
sage tone.

**And the sage chip goes too, on the results grid.** A dated query is _filtered_
on availability, so every card that survives one is free on that date by
construction — the chip is a tautology. It survives only in the "free on a nearby
date instead" band that closes frame `18`, where it names a _different_ date than
the one searched. Ruled 2026-08-30 (D16). See `03-components.md`, `11-search.md`.

## RESOLVED — What is the stone `New` chip?

**A "joined recently" badge — vendor published within the last 30 days.** Not an
availability state: frame `02` puts it on a vendor already showing ★ 5.0 (17), so
it is not "unreviewed" either. With sage and gold gone from the grid it is the
only chip a search card carries, so there is no collision to arbitrate. Ruled
2026-08-30 (D16).

## RESOLVED — What is the default search sort?

**`Most relevant`.** This file and `11-search.md` had never fixed one, and frame
`02` draws `Top rated ▾` — but the frame draws a _chosen_ sort exactly as it
draws a chosen price and rating, so it is not evidence the default is wrong. A
new marketplace defaulting to `Top rated` ranks its thinnest review counts first:
one 5★ review outranks forty. Revisit against real review volume. **Do not "fix"
this by matching the frame.** Ruled 2026-08-30 (D16).

## RESOLVED — Is the sign-up panel photograph safe for text over it?

**Yes, by selection.** The asset is fixed and hand-picked, checked for contrast
against the panel copy, and is **not vendor content** — never rotated, never
dynamic, never fed from uploads. No scrim. A ticket that changes any of that must
add one in the same change. Ruled 2026-08-30 (D16). See `21-sign-up.md`.

## RESOLVED — Is the avatar tint the frames draw a token?

**It is now: `clay-150` = `#EADCCB`.** The frames draw that fill at 42 sites
across 20 frames while the ramp jumped `clay-100` (`#F7E7E0`) to `clay-200`
(`#EFD8CC`), so the fill was the one off-token value — the clay initials
(`#8E3F20` = `clay-600`) and the whole sage pair already resolved exactly. Same
class as #306's `#C4D6A8` / `#5C4A18`: **the ramp was incomplete, not the frame
wrong.** `sage-150` and `stone-150` were the precedent for the step name.
Correcting 42 frame sites to the paler `clay-100` was rejected — it is more work
and lowers contrast under the initials. Ruled 2026-08-30 (D17).

## RESOLVED — What does a real vendor with no cover photo get?

**A designed empty state, not the labelled placeholder.** The hatch is a
build-time device for photography the _product_ lacks before launch; a live
vendor's empty cover is an absence of _their_ content shown to _their_ customers,
and the hatch reads as an unfinished product rather than an unfinished profile.
On `/search` and `/vendors/[slug]` they get a neutral tone block in the cover's
exact dimensions — no hatch, no monospace label. The cause and the fix live in
the editor, where the vendor is, not on the page their customers read. Ruled
2026-08-30 (D17). See `40-states.md`, `03-components.md`.

## RESOLVED — What does the 500 page offer a signed-out visitor?

**"Browse vendors", going to `/search`, and frame `16` is corrected.** It drew
`Go to my bookings`, which offers a visitor who has never signed in a link to
bookings they cannot have. Rejected: an auth-aware pair of strings, because
`global-error.tsx` renders outside the Clerk provider and cannot know who is
reading — it would need a signed-out default anyway, and two strings on one
screen drift. Also rejected: accepting the inaccuracy, since the click is a dead
end on a page that is already a failure. Ruled 2026-08-30 (D17).

## RESOLVED — What token is the ground behind a cover photograph?

**`stone-250` = `#ECE6DC`, minted 2026-08-30 (D18).** The frames paint that fill
behind every 3:2 cover at **30 sites**, while the ramp jumped `stone-200`
(`#EFE9E0`) straight to `stone-300` (`#E4DDD1`) — so the fill was the one
off-token value in the set. Same class as `clay-150` (D17) and #306's `#C4D6A8` /
`#5C4A18`: **the ramp was incomplete, not the frame wrong.** `stone-150` and
`sage-150` are the precedent for the step name.

It had to be settled now because the coverless empty state ruled above _is_ that
block, and a state whose only spec is "a neutral tone block" names a colour nobody
can resolve. `19-availability.md` recorded that `stone-250` "was never minted",
which was true when written and is corrected in place. **It is still not the
hatch** — those stripes stay `stone-200` / `stone-300`, and `#E0D8CA` remains
unminted.
