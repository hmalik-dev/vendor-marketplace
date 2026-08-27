# 98 — Post-MVP register

Everything deliberately deferred, and the condition that unblocks it. Nothing
here is a missing piece of the MVP — each was considered and postponed for a
reason.

## Deferred: metric-based public marketing

**Status: cut from MVP. Do not build. Do not fake.**

The app is new, so it has no vendor count, no "events booked", no average rating
and no median reply time worth publishing. Every one of these was removed from
the public surfaces:

| Surface                 | Was                                                        | Now (MVP)                                                                      |
| ----------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Landing hero badge      | "412 vendors in Austin"                                    | "Now booking in Austin"                                                        |
| Landing category cards  | "64 vendors · from $850"                                   | "Photo & film" — what the category _is_                                        |
| Landing stats row       | 2,412 booked / 4.8 / 2h                                    | **Removed entirely**                                                           |
| Sign-up marketing panel | "2,412 events booked in Austin this year" + 3 stat columns | "See the price. See the open dates. Then decide." + three mechanism guarantees |
| Confirmation cross-sell | "Florals — 38 near you"                                    | "Florals" — category chips, no counts                                          |

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
- Filter facet counts inside the Refine bar popovers
- A vendor's own rating and review count on their profile (reply time is deferred — below)
- A vendor's own metrics on their private dashboard
- Real counts in admin

## Deferred: all fee language on vendor surfaces

Vendors pay something — service fee, commission or subscription — and the model
isn't settled. **No vendor-facing surface makes any fee claim, in either
direction.** Not "no fees", not a rate, not a hint. The vendor sign-up panel talks
about the payment _mechanism_ instead ("Paid out after the event — no chasing
invoices"), which holds true under any model.

The **customer** side keeps "Published prices, and no service fee on top" — true
of the customer's half of the transaction, and a real differentiator there. It must
not be mirrored, or negated, onto the vendor side.

**Unblock:** pricing decided. The vendor panel then gains a fourth guarantee
stating plainly what a vendor pays, and the vendor section gets a pricing block. A
claim walked back later costs more trust than saying nothing now.

## Deferred: reply-time claims

Median reply time ("Replies in ~2h", a "Replies" stat tile, "★ 4.9 · replies in
2h" on the landing hero chip) requires message history that does not exist at
launch. A brand-new vendor's first enquiry would be measured against a number
invented for them.

Removed from: the landing hero chip (chip deleted entirely), the vendor profile
meta line, the profile's stat tiles (four → three), and the mobile profile.

**Kept:** the vendor's own private dashboard metric. That's their data about
themselves and it starts empty honestly. The dashboard's "keep it under 4h to stay
ranked" line implied a ranking signal that does not exist, so it is softened to a
plain nudge — see the reply-time ranking entry below and `16-vendor-dashboard.md`.

**Unblock:** ~10 answered enquiries for a given vendor. It then returns as a
**per-vendor fact shown only for vendors who have one** — never as a platform
average, and never as a default for a new profile.

## Deferred: the landing hero vendor chip

A floating card over the photo cluster showing a named vendor, their rating and
their reply time. Three fabricated facts in the most prominent position on the
site. Deleted; the photo cluster carries the hero on its own.

**Unblock:** real vendors with real ratings worth featuring — and an editorial
decision about who gets featured, which is a fairness question as much as a design
one.

## Deferred: Events as an entity

**There is no way to create an event in MVP, so no screen may assume one.**

Bookings are grouped by **month, derived from the booking date** — no new object,
no new step. The occasion ("Wedding", "Birthday") and the venue are **free-text
fields on the booking**, captured in the request form and shown on the card, which
is enough for a customer to tell two bookings apart.

Deferred to post-MVP:

- An Event object: name, date, venue, guest count, with its own page at `/events/[id]`
- Filing bookings into an event, and an "Event details →" link from a group header
- Event templates and suggested categories per event type — needs real pairing data
- Shared events with co-planners and roles
- Budget tracking across an event's bookings

**Unblock:** enough customers with multiple bookings on the same date that
grouping by month stops being sufficient. Month grouping remains the default view
even after events ship.

Removed for the same reason: **"Still to book"**. There is no fixed set of
categories an event should have, and asserting one invents an obligation the
customer never agreed to.

## Deferred: free-text and semantic search

MVP search is **category + city + date**, three enumerable pickers — see
`11-search.md`. Nobody arrives knowing a vendor's name, so a text box on the main
path is a worse question than a dropdown. Name search survives as a secondary
`clay-500` link beside the query bar, for the referral case only.

Deferred: semantic search over profile text ("someone who shoots on film"), saved
searches with alerts, and map view. **Unblock:** enough profile copy to index, and
enough vendors per category that browsing a grid stops being sufficient.

## Deferred: multi-vendor single booking

One request to several vendors at once. The hub's month grouping is the seed
of it. Out of MVP scope; revisit once the request→quote→pay loop is proven.

## Deferred: vendor discovery beyond search

No recommendations, no "similar vendors", no personalised home feed in MVP — all
need behavioural data. Category browsing plus the Refine bar is the whole discovery surface.

## Deferred: reply-time ranking

The vendor dashboard used to show "keep it under 4h to stay ranked", which implied
a ranking signal the app does not have. **Resolved by changing the copy**, not by
building the signal: the line is now a plain nudge with no mechanic attached — see
`16-vendor-dashboard.md`.

**Unblock:** a real ranking signal that reads reply time. Only then may any
surface tell a vendor that replying faster ranks them higher.

## Open design questions

Live in `99-open-questions.md`. The vendor-doesn't-reply path (question 1) is
the one I'd resolve inside MVP — it's the most common failure in a two-sided
marketplace and it currently has no designed surface.
