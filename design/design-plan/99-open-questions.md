# 99 — Open questions

Design decisions worth answering. Resolved items are kept with their resolution
so the reasoning isn't lost.

## RESOLVED — Is this a one-event dashboard?

**No.** The product is a standing hub for any vendor booking, for any event, now
or in future. Screen 20 was rebuilt around events-as-containers with Upcoming /
History / All, and "Still to book" was removed: there is no fixed set of
categories an event should have. See `20-customer-bookings-hub.md`.

## RESOLVED — Public metrics on a brand-new app

**Deferred post-MVP.** Public pages carry no platform statistics; they prove
themselves with mechanism instead. Full before/after and the unblock condition
are in `98-post-mvp.md`.

## 1. What happens when a vendor doesn't reply? — **resolve inside MVP**

The 48-hour expiry is specified; the customer-side experience is not designed.
Options: auto-suggest similar vendors free on the same date · expire quietly ·
nudge the vendor at 24h and tell the customer it happened. This is the most
common failure path in a two-sided marketplace and it has no surface today.

## 2. Does reply-time ranking exist? — **blocks a line of copy**

Screen 16 says "keep it under 4h to stay ranked". Either the ranking signal is
real, or that sentence changes. Don't ship an implied mechanic that isn't there.

## 3. Review asymmetry

Customer→vendor public; vendor→customer private but surfaced in the messaging
context rail ("About Priya"). Confirm intended — a customer seeing their own
private rating quoted back would be a bad surprise.

## 4. Category ordering on the landing page

Six featured of eleven by `displayOrder`. Editorial (ops picks) or algorithmic
(by vendor count)? Decides whether ops needs a UI for it. Note that with counts
deferred, the algorithmic option has no visible justification in MVP.

## 5. Photography

Every placeholder is labelled with the shot it needs. The product is photo-forward
by design, so launch quality depends on the first cohort of vendors having good
cover images. Decide whether onboarding includes a minimum-quality gate or a
shoot-day offer for early vendors.

## 6. Event creation friction

MVP says an event is optional and auto-created from a booking's date. Confirm
that's right — the alternative (event first, then vendors) is a cleaner model but
adds a step before anyone has seen value.
