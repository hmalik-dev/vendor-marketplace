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

## 2. Does reply-time ranking exist? — **blocks a line of copy**

Screen 16 says "keep it under 4h to stay ranked". Either the ranking signal is
real, or that sentence changes. Don't ship an implied mechanic that isn't there.

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
