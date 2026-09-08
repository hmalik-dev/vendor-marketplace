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
- Say the mechanism instead of the metric. "Payment held until the event is complete" beats "trusted by thousands".
- Never imply a scale the product doesn't have. No "join thousands of vendors", no "the #1 marketplace".
- **Don't name the virtue, show it.** Not "full transparency" but "every vendor publishes what they charge and when they're free". Not "seamless" but "one request, one reply".
- Never name a feature the MVP doesn't have. No "events", no "planning checklist".

## Spelling — US English

The product's market is US cities, so every user-facing string is US English:
**inquiry**, not _enquiry_; _canceled_, _color_, _favorite_.

This one overrides the frames. Frame `12 Sign up` writes "Enquiries arrive
already knowing what you charge…" and the implementation says **Inquiries**; the
parity gate should read that as correct, not as drift. If a future import brings
the British spelling back, change the string, not this rule.

## Apostrophes — straight, always

Ruled 2026-09-06 (#372). The product writes the **straight apostrophe** `'`
(U+0027). Never the curly `’` (U+2019), and never `&rsquo;`.

The design contract settles it and is not close: across every frame's UI
strings the straight form appears **124 times** and the curly form **once** —
`Gold dots mark what’s unfinished` on frame `09`, which is the drift, not the
rule. Both error frames write it straight in their own headline copy (`15`:
_This page isn't here_; `16`: _This wasn't anything you did_), as does frame
`19`'s empty pane (_the vendor's replies_).

The app was inconsistent in exactly the way an unruled question always
produces: `/sign-up` and a dozen other screens wrote `&apos;`, while the 404,
the 500 and seventeen other files wrote `&rsquo;` — the same sentence in two
glyphs depending on who typed it.

**In JSX text write `&apos;`**, which is the straight apostrophe escaped;
ESLint's `react/no-unescaped-entities` rejects the bare character in a text
node, and that rejection is what pushed the curly form into the codebase in the
first place. In a TypeScript string or template literal write the character
itself.

`apostrophe-form.test.ts` is the guard: it reads every non-test source file
under `apps/web/src` and `packages/shared/src`, strips comments, and fails on a
curly apostrophe or an `&rsquo;` in anything that survives.

Contractions are still the rule — see _Rules_ above. What is ruled here is only
which glyph draws them.

## Voice examples

| Context                        | Not this                                | This                                                                                                                                                                                                                                                   |
| ------------------------------ | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Hero                           | "The #1 marketplace for event vendors"  | "Book your vendors without the back-and-forth."                                                                                                                                                                                                        |
| Hero badge                     | "412 vendors in Austin"                 | "Now booking in Austin"                                                                                                                                                                                                                                |
| Category card                  | "64 vendors · from $850"                | "Photo & film"                                                                                                                                                                                                                                         |
| Sign-up proof                  | "2,412 events booked this year"         | "See the price. See the open dates. Then decide."                                                                                                                                                                                                      |
| Transparency claim             | "Full pricing transparency"             | "Every vendor publishes what they charge and when they're free"                                                                                                                                                                                        |
| Availability claim             | "Real-time availability sync"           | "Live calendars — if a date shows open, it is"                                                                                                                                                                                                         |
| Search field label             | "Search" / "Keywords"                   | "Vendor type"                                                                                                                                                                                                                                          |
| Bookings grouping              | "Nandakumar wedding"                    | "June 2026"                                                                                                                                                                                                                                            |
| Customer bookings title        | "Dashboard"                             | "Your bookings"                                                                                                                                                                                                                                        |
| Bookings summary               | "Your wedding is in 49 days"            | "4 bookings across 2 upcoming events"                                                                                                                                                                                                                  |
| Open category                  | "Still to book: Florals"                | "Add a vendor"                                                                                                                                                                                                                                         |
| Hero sub                       | "Browse our extensive vendor network"   | "Compare real availability and pricing from vendors near you, send one request, and pay securely once the date is locked in."                                                                                                                          |
| Empty bookings                 | "No data found"                         | "No bookings yet — find a vendor to get started"                                                                                                                                                                                                       |
| Booking confirmed              | "Transaction complete"                  | "June 14 is yours."                                                                                                                                                                                                                                    |
| Request reassurance (packaged) | "Payment is not required at this stage" | "You're requesting, not paying. Maya has {expiryDays} days to confirm or decline — the package price is fixed, and you approve before any card is charged."                                                                                            |
| Request reassurance (custom)   | "Payment is not required at this stage" | "You're requesting, not paying. Maya has {expiryDays} days to confirm or send a revised quote — you approve before any card is charged."                                                                                                               |
| Validation error               | "Error 422: Validation failed"          | "Something doesn't look right — check the highlighted fields"                                                                                                                                                                                          |
| Vendor save                    | "Submit profile"                        | "Save changes"                                                                                                                                                                                                                                         |
| Publish blocker                | "Incomplete profile"                    | "2 things left before you can publish — response time and payouts"                                                                                                                                                                                     |
| Payout gate                    | "Stripe Connect required"               | "You can't take payment until payouts are connected. It takes about five minutes."                                                                                                                                                                     |
| Search placeholder             | "Enter search query"                    | "What kind of vendor are you looking for?"                                                                                                                                                                                                             |
| Search loading                 | "Loading…"                              | "Finding photographers in Austin…"                                                                                                                                                                                                                     |
| No results                     | "0 results"                             | "No vendors match your search — try widening the price range or clearing the date"                                                                                                                                                                     |
| Review prompt                  | "Create review"                         | "How was your experience?"                                                                                                                                                                                                                             |
| Cancel confirm                 | "Confirm cancellation"                  | "Cancel this booking? This notifies Maya and can't be undone."                                                                                                                                                                                         |
| Cancel dismiss                 | "Cancel"                                | "Keep booking"                                                                                                                                                                                                                                         |
| Cancel proceed                 | "OK"                                    | "Yes, cancel booking"                                                                                                                                                                                                                                  |
| Hero search, unfilled          | "Photography · Austin, TX · Jun 14"     | "Any vendor type" · "Anywhere" · "Add a date" — the hero seeds nothing, so all three segments render in `stone-600` (D16)                                                                                                                              |
| 500 recovery                   | "Go to my bookings"                     | "Browse vendors" — the 500 page cannot know who is reading, so the one destination true for everyone (D17)                                                                                                                                             |
| Bot challenge stalled          | "CAPTCHA verification failed"           | "We couldn't finish the security check" · "It didn't answer within {challengeTimeoutSeconds} seconds. Ad blockers, privacy extensions and some work or school networks block challenges.cloudflare.com — allow it or switch networks, then try again." |
| Bot challenge retry            | "Reload"                                | "Try again"                                                                                                                                                                                                                                            |

**No approved string hard-codes a duration the code derives.** Ruled 2026-08-30
(D16); the Request reassurance rows are why. They read "48 hours" from the day
this file was written until 2026-08-30, while `BOOKING_REQUEST_EXPIRY_DAYS` has
been **7 days** — so every screen that copied the approved string promised a
deadline the API refuses, at the moment of commitment. `{expiryDays}` is a
placeholder for that constant, not a literal to be typed out: the surface reads
the constant and formats it.

The row is split because #308 made the sentence conditional and this file did not
follow. A **packaged** request carries an immutable price, so the vendor's only
routes are confirm or decline; only a **custom** request can be answered with a
quote. Quoting the wrong branch tells a customer to expect a negotiation that
cannot happen.

Two other durations in the table are deliberate and stay: "4 bookings across 2
upcoming events" counts rows rather than naming a window, and the payout gate's
"about five minutes" is an estimate of Stripe's onboarding, not a deadline this
codebase enforces.

## The bot challenge that never answers — ruled 2026-09-08 (#464)

**This entry is a ruling, and it is recorded here because a lane adding approved
copy is normally forbidden.** Copy is a design pass's business. The exception is
narrow and is the row's own doing: #464 requires an error "in approved copy from
`31-content-voice.md`", and there was none for this state to use. So the strings
below were written to the rules at the top of this file and to `40-states.md`,
and are recorded as approved rather than invented. A future design pass may
reword them; a future lane may not.

Sign-up runs a Cloudflare bot challenge before Clerk will create an account.
There are three ways it can go wrong and **only one of them says this**, which
is the distinction the row did not have and the implementation measured:

| The challenge host is…                 | What happens                                                                         | What the product says  |
| -------------------------------------- | ------------------------------------------------------------------------------------ | ---------------------- |
| **Dropped** — accepted, never answered | Clerk waits on a token for ever, sends no create, disables every field, says nothing | **This copy**          |
| **Refused** — answered with a reset    | Clerk gives up, attempts the create, is rejected, leaves the fields live             | Clerk's own message    |
| **Reachable, unsolved**                | The challenge loads and declines to issue a token; the card is disabled the same way | Nothing yet — not this |

Dropping is what a filtering corporate or school network does, and what several
privacy extensions do. It is the only one of the three where nothing at all
comes back from the host, and that is what the sentence claims — so the sentence
is only shown when it is true. Saying it on row three would blame a network that
is working.

The sentence names the host, and that is deliberate rather than a leak of
plumbing. It is the only thing the person can act on: an extension's allowlist
takes a hostname, and a support conversation needs something to quote. The
alternative — "something went wrong" — is the state the row was filed against.

`{challengeTimeoutSeconds}` is `SIGN_UP_CHALLENGE_TIMEOUT_MS`, per the rule
directly above: no approved string hard-codes a duration the code derives.

**Whether a challenge-free sign-up path should exist is still open** — Clerk
supports email-code sign-up without a password, which would route around the
challenge entirely, and that trades directly against what bot protection is
there to stop. #464 shipped the bounded wait, the message and the retry without
it; the fallback is the account holder's call and is recorded in
`99-open-questions.md`.

## Admin console action copy — drawn 2026-09-07

The admin delta (`design/delta-admin/`) is the first frame to draw the
console's destructive controls, so the labels below are approved strings, not
conventions a lane picked. Recorded here because a label that exists only in a
frame gets reworded by the next person who touches the component.

| Control                            | Label                  | Consequence line                                                                                                                                                 |
| ---------------------------------- | ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Take a storefront off search       | **Unpublish profile**  | Removes it from search and browse. Existing bookings stand and the vendor keeps their dashboard, but they cannot put the storefront back — only an operator can. |
| Moderate a vendor off the platform | **Suspend vendor**     | Declines their open requests and cancels every future confirmed booking, refunded in full — which reverses the vendor's share out of their Stripe balance.       |
| Dismiss a resolve confirm          | **Keep the case open** | —                                                                                                                                                                |

**`Unpublish profile` and `Suspend vendor` replace `Unpublish storefront` and
`Suspend account` (#454, correcting #435).** #435 shipped the older pair before
any frame drew this surface, so this is a text-parity correction against a
frame rather than a preference: `web-design-parity.md` is explicit that "same
composition with reworded copy has failed too". The _descriptions_ were already
right and are unchanged — both already said existing bookings stand and the
vendor keeps their dashboard.

**The suspend line says `refunded in full`, and that is the ruled behaviour, not
the frame's.** The drawn card read "holds payouts"; that was loose copy about an
action it was summarising and has been corrected in the bundle. D31 (#416) is
unchanged and the shipped dialog already stated it at length — being told is the
ruled requirement, because the refund can leave a vendor's Stripe balance
negative. A hold is reversible and leaves the customer's money where it is; a
full refund is neither, so the two are not interchangeable wordings.

## The unpublish consequence line, corrected — ruled 2026-09-08 (#457)

**This entry is a ruling, recorded here because a lane changing approved copy is
normally forbidden.** The same exception #464 relied on applies, and the trigger
is narrower still: the approved sentence did not become unclear, it became
**false**, and the ticket that falsified it is the one correcting it.

`Unpublish profile`'s line closed _"Publish it again from this menu whenever you
like."_ That was true when #435 drew it — `is_published` was a column the vendor
also wrote, so anyone could put the storefront back. #457 added
`vendor_profiles.moderation_hold`, and from that commit the vendor cannot. The
sentence then described, on the control that removes the ability, the exact
ability it removes, to the operator, at the moment of the press.

The correction keeps the half that is still true and states the half that
changed: an operator undoes this from this menu, and the vendor cannot undo it at
all. It is a correction rather than a rewrite — same register, same length, same
reassuring function.

**A future design pass may reword it; a future lane may not.** What a future lane
must not do is quietly restore the old promise: `vendor-table.render.test.tsx`
asserts both that the copy names the operator-only route back and that it does
**not** promise the vendor one, so the string and the behaviour cannot drift
apart again without a red test.

**The class this belongs to is prose going stale behind a change**, which is why
the guard is a test rather than this paragraph. Three instances landed in one
night: this line, `RepublishConsequence`'s justification clause (narrowed rather
than falsified — see `web-design-parity.md`), and the vendor editor's _"Ready to
publish — flip this when you are."_, which #457 also had to correct because it
told a held vendor yes and then refused them.

**"Cancel" is not a dismissal word on a screen about money.** The case-detail
confirm dismisses with **Keep the case open**, naming the state you return to —
the same rule that made the booking dialog dismiss with "Keep booking" rather
than "Cancel". Both resolve confirms name the field that will be written
(`cancelled_by = admin`) and the payout sweep date by name, because restating is
what makes a confirm a safeguard rather than a speed bump.

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
