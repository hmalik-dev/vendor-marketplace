# 99 — Open questions

Design decisions worth answering. Resolved items are kept with their resolution
so the reasoning isn't lost.

## RESOLVED — Is this a one-event dashboard?

**No.** It's a standing hub for any vendor booking, now or in future. Upcoming /
History / All tabs; "Still to book" removed — there is no fixed set of categories
an event should have. See `20-customer-bookings-hub.md`.

## RESOLVED — Does an Event entity exist in MVP?

**No, and no screen may assume one.** An earlier draft grouped bookings under
named events ("Nandakumar wedding") with an "Event details →" link and a "My
events" nav item. There is no way to create an event in the product, so all of
that is removed. Bookings group by **month derived from their dates**; occasion
and venue are free-text fields on the booking. Events as a real object with their
own page are post-MVP. See `98-post-mvp.md`.

## RESOLVED — How do users search?

**Category + city + date, as three pickers.** Not a text query — nobody searches
"June Harlow" to find a photographer, and a text box has to guess intent from
strings like "wedding photographer near me". The vendor-type field is a select
that cannot hold an unrecognised value, so a query always resolves to a category
the platform recognises. Category is selectable in **exactly one control** — no
chip strip, no rail checkbox group. Name search is a secondary `clay-500` link
for the referral case. See `11-search.md`.

## RESOLVED — Public metrics on a brand-new app

**Deferred post-MVP.** Public pages carry no platform statistics; they prove
themselves with mechanism instead. Full before/after and the unblock condition
are in `98-post-mvp.md`.

## 1. What happens when a vendor doesn't reply? — **resolve inside MVP**

**Deferred post-MVP.** The 48-hour expiry is specified; the customer-side experience is not designed.
Options: auto-suggest similar vendors free on the same date · expire quietly ·
nudge the vendor at 24h and tell the customer it happened. This is the most
common failure path in a two-sided marketplace and it has no surface today.

## 2. Does reply-time ranking exist? — **blocks a line of copy**

**Deferred post-MVP.** Screen 16 said "keep it under 4h to stay ranked". Either the
ranking signal is real, or that sentence changes — don't ship an implied mechanic
that isn't there. Since the signal is deferred, **the sentence changed**: the
dashboard nudge no longer mentions ranking. Public reply-time claims go with it —
the profile meta line, the "Replies" stat tile and the landing hero chip are all
removed. See `98-post-mvp.md`.

## 3. Review asymmetry

Customer→vendor public; vendor→customer private but self viewable/viewable by vendor after they are requested so it is surfaced in the messaging
context rail ("About Priya").

## 4. Category ordering on the landing page

Six featured of eleven by `displayOrder`. Editorial (ops picks)

## 5. Photography

Every placeholder is labelled with the shot it needs. The product is photo-forward
by design, so launch quality depends on the first cohort of vendors having good
cover images. -- only recommended sizes for photos

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
