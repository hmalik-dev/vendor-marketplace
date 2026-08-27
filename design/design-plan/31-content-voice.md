# 31 — Copy & voice

Warm, clear, encouraging. A friendly, experienced event planner — not a SaaS
onboarding tour, not a wedding blog.

## Rules

- Address the reader as "you". Never "the user".
- Contractions always: you're, it's, we'll, won't.
- Vendor business names render exactly as entered. Never lowercased, never truncated mid-word.
- Errors say what happened **and** what to do about it.
- Buttons: 2–4 words, imperative, specific. "Send request", not "Submit".
- No jargon: no API, webhook, session, null, entity, record.
- **Numbers are real or absent.** Read from the database at request time, or not on the page. In MVP that means **no platform statistics on any public surface** — see `98-post-mvp.md`.
- Never name a feature the MVP doesn't have. No "events", no "planning checklist", no "still to book".
- Say the mechanism instead of the metric. "Payment held until the event is complete" beats "trusted by thousands".
- **Don't name the virtue, show it.** Not "full transparency" but "every vendor publishes what they charge and when they're free". Not "seamless" but "one request, one reply".
- Never imply a scale the product doesn't have. No "join thousands of vendors", no "the #1 marketplace".

## Voice examples

| Context                 | Not this                                | This                                                                                                                            |
| ----------------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Hero                    | "The #1 marketplace for event vendors"  | "Book your vendors without the back-and-forth."                                                                                 |
| Hero badge              | "412 vendors in Austin"                 | "Now booking in Austin"                                                                                                         |
| Hero sub                | "Browse our extensive vendor network"   | "Compare real availability and pricing from vendors near you, send one request, and pay securely once the date is locked in."   |
| Category card           | "64 vendors · from $850"                | "Photo & film"                                                                                                                  |
| Landing category jump   | "Popular: Florals · Taco carts"         | "Or jump straight to" + category pills                                                                                          |
| Search field label      | "Search" / "Keywords" / "What"          | "Vendor type"                                                                                                                   |
| Search city label       | "Where"                                 | "City"                                                                                                                          |
| Search date label       | "When"                                  | "Event date"                                                                                                                    |
| Search placeholder      | "Enter search query"                    | "What kind of vendor are you looking for?"                                                                                      |
| Search loading          | "Loading…"                              | "Finding photographers in Austin…"                                                                                              |
| No results              | "0 results"                             | "No vendors match your search — try widening the price range or clearing the date"                                              |
| Sign-up proof           | "2,412 events booked this year"         | "See the price. See the open dates. Then decide."                                                                               |
| Transparency claim      | "Full pricing transparency"             | "Every vendor publishes what they charge and when they're free"                                                                 |
| Availability claim      | "Real-time availability sync"           | "Live calendars — if a date shows open, it is"                                                                                  |
| Service fee claim       | "No service fee, ever"                  | "Published prices, and no service fee on top"                                                                                   |
| Customer bookings title | "Dashboard"                             | "Your bookings"                                                                                                                 |
| Bookings summary        | "Your wedding is in 49 days"            | "4 upcoming bookings. Next up is Kessler & Co. in 49 days."                                                                     |
| Bookings grouping       | "Nandakumar wedding"                    | "June 2026"                                                                                                                     |
| Open category           | "Still to book: Florals"                | "Book another vendor"                                                                                                           |
| Empty bookings          | "No data found"                         | "No bookings yet — find a vendor to get started"                                                                                |
| Booking confirmed       | "Transaction complete"                  | "June 14 is yours."                                                                                                             |
| Request reassurance     | "Payment is not required at this stage" | "You're requesting, not paying. Maya has 48 hours to confirm or send a revised quote — you approve before any card is charged." |
| Validation error        | "Error 422: Validation failed"          | "Something doesn't look right — check the highlighted fields"                                                                   |
| Vendor save             | "Submit profile"                        | "Save changes"                                                                                                                  |
| Publish blocker         | "Incomplete profile"                    | "2 things left before you can publish — response time and payouts"                                                              |
| Payout gate             | "Stripe Connect required"               | "You can't take payment until payouts are connected. It takes about five minutes."                                              |
| Review prompt           | "Create review"                         | "How was your experience?"                                                                                                      |
| Cancel confirm          | "Confirm cancellation"                  | "Cancel this booking? This notifies Maya and can't be undone."                                                                  |
| Cancel dismiss          | "Cancel"                                | "Keep booking"                                                                                                                  |
| Cancel proceed          | "OK"                                    | "Yes, cancel booking"                                                                                                           |

## Headline system

The landing H1 is two lines: a plain first line in ink, an italic second line in
`clay-500` carrying the promise. That pattern repeats nowhere else — it's the
brand's one flourish, and using it twice would spend it.

Alternates approved for other marketing surfaces:

- "Find your people. Skip the phone tag." (warmest)
- "Their prices and dates, before you say hello." (works as a section header under the hero)

Never claim the customer will "meet" the vendor. Not having to is the product.

## Trust language

Say the mechanism, not the adjective. Not "secure and reliable" but "Payment
held by Stripe until the event is complete." Not "verified reviews" alone but
"Every review comes from a booking that actually happened."
