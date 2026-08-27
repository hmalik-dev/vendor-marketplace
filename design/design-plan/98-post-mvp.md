# 98 — Post-MVP register

Everything deliberately deferred, and the condition that unblocks it. Nothing
here is a missing piece of the MVP — each was considered and postponed for a
reason.

## Deferred: metric-based public marketing

**Status: cut from MVP. Do not build. Do not fake.**

The app is new, so it has no vendor count, no "events booked", no average rating
and no median reply time worth publishing. Every one of these was removed from
the public surfaces:

| Surface                 | Was                                                        | Now (MVP)                                                                |
| ----------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------ |
| Landing hero badge      | "412 vendors in Austin"                                    | "Now booking in Austin"                                                  |
| Landing category cards  | "64 vendors · from $850"                                   | "Photo & film" — what the category _is_                                  |
| Landing stats row       | 2,412 booked / 4.8 / 2h                                    | **Removed entirely**                                                     |
| Sign-up marketing panel | "2,412 events booked in Austin this year" + 3 stat columns | "Prices on the label. Dates you can trust." + three mechanism guarantees |
| Confirmation cross-sell | "Florals — 38 near you"                                    | "Florals" — category chips, no counts                                    |

**What public pages prove themselves with instead:** the mechanism. Real
availability rather than a contact form. Payment held until the event is
complete. No service fee. Reviews only from bookings that actually happened.
These are true on day one and they're stronger claims than a small number.

**Unblock condition:** a category has enough vendors in a city that the count
flatters rather than exposes — as a rule of thumb, 25+ live vendors in the
category and city being displayed. Then, and only then:

- Landing badge returns to a live vendor count, scoped to the visitor's city
- Category cards regain counts and from-prices, computed per city
- A stats band returns to the landing page and the sign-up panel
- The confirmation screen's cross-sell chips regain counts

**Rule that outlives the deferral:** every number on a public page is read from
the database at request time, or it does not ship. A hardcoded stat is a
liability — it goes stale silently and it's a lie the moment it does.

### Where counts ARE valid in MVP

These are query results or per-vendor facts, not platform marketing, and they stay:

- Search result count — "24 photographers in Austin" (it's the answer to the query)
- Filter facet counts in the search rail
- A vendor's own rating, review count and reply time on their profile
- A vendor's own metrics on their private dashboard
- Real counts in admin

## Deferred: single-event planning features

See `20-customer-bookings-hub.md`. Event templates and suggested-category rows
need real pairing data before they can be honest. **Unblock:** enough completed
multi-vendor events to see what actually gets booked together.

## Deferred: multi-vendor single booking

One request to several vendors at once. The hub's per-event grouping is the seed
of it. Out of MVP scope; revisit once the request→quote→pay loop is proven.

## Deferred: vendor discovery beyond search

No recommendations, no "similar vendors", no personalised home feed in MVP — all
need behavioural data. Search plus categories is the whole discovery surface.

## Deferred: reply-time ranking

The vendor dashboard shows "keep it under 4h to stay ranked", which implies a
ranking signal. **The signal must exist before that copy ships** — either build
the ranking or change the line to a plain nudge. Flagged in `16`.

## Open design questions

Live in `99-open-questions.md`. The vendor-doesn't-reply path (question 2) is
the one I'd resolve inside MVP — it's the most common failure in a two-sided
marketplace and it currently has no designed surface.
