# 21 — Sign up & sign in (`/sign-up`, `/sign-in`) — **MVP**

**Purpose:** frictionless entry. Role selection is irreversible, so it must be
made deliberately and visibly.

## Composition at 1440 — split screen

Left half: the auth panel on `stone-50`, content capped at 460px. Right half:
600px full-bleed vendor photograph under a
`linear-gradient(200deg, rgba(35,32,28,.12), rgba(58,31,18,.62) 55%, rgba(35,32,28,.85))`
wash, with proof over it.

A card floating in a field of cream wastes half the viewport. The marketing panel
uses the width honestly and it's the last thing a hesitant sign-up sees.
Below 1280 the panel drops and the auth column centres.

## One door

The marketing header carries **Sign in** and a single **Sign up** ink pill. No
separate vendor CTA: the role cards on this screen are already the fork, so a
second header button would be one control too many for one decision — and
"Sign up" next to "List your services" makes a visitor read two things to work out
which one is them.

`/sign-up` therefore opens with **no role pre-selected**, which is the screen's
default state and the reason the panel has a third, neutral variant (below).

`?role=` still exists for deep links — "For vendors" in the main nav leads to the
vendor marketing page, whose CTA goes to `/sign-up?role=vendor` and skips straight
to the vendor state. It's an optimisation for traffic that has already self-identified,
not a second front door.

**Browsing needs no account.** Search, category pages and vendor profiles are all
public — the landing page promises that, so the wall goes up at exactly two
moments: **requesting a booking** and **publishing a vendor profile**. When an
anonymous visitor hits either, they get this screen with the role pre-selected and
their intent preserved, then land back where they were.

## Auth panel

Logo centred · "Let's get you set up" (Serif 32px) · "First — which one are you?
This can't be changed later."

**Role cards, side by side at every width above 640** — they're a comparison, and
stacking turns a choice into a scroll.

|              | Selected       | Unselected      |
| ------------ | -------------- | --------------- |
| Background   | `clay-100`     | `stone-0`       |
| Border       | 2px `clay-400` | 1px `stone-300` |
| Glyph circle | `stone-0`      | `stone-150`     |

"I'm planning an event — Find and book vendors near you." ·
"I'm a vendor — List your services and take bookings."

Then email, password (helper: "At least 10 characters"), **Create my account**,
and "Already with us? Sign in".

The whole panel — role choice and form — must fit inside 836px without scrolling.

**`Create my account` is the approved primary action, and the plan was already
right.** Ruled 2026-08-30 (D16): frame `12 Sign up` draws it, this file has
specified it since it was written, and the live button reads Clerk's default
`Continue` (`sign-up-form.tsx`). That is a code defect, not a plan gap — the
string is what the button does at the moment of commitment, and it now also sits
in `31-content-voice.md`.

**The panel photograph is fixed and hand-picked, and there is a scrim.** Ruled
2026-08-30 (D16), **corrected 2026-09-04 (D30)**. D16's own words were "no
scrim", and that sentence was wrong about the frame: `12` has always drawn
`linear-gradient(200deg, …)` over the photograph, and `01-foundations.md`'s
`#C4D6A8` ruling says so in its first sentence. What D16 actually decided — the
image is a single committed asset, **not vendor content and never rotated or made
dynamic** — stands. A ticket that swaps it, randomises it or feeds it from uploads
still breaks that rule.

**Contrast is now a property of the panel rather than a promise about the file.**
Every text node on `12` and both `12b` panels clears 4.5:1 measured against a
**pure white** backdrop — the worst any photograph can present — so the guarantee
holds whichever image is chosen. The node-by-node table is in
`01-foundations.md`; the three changes that got it there were the accent moving to
`gold-150 #F9E2BD`, `12b`'s scrim mid stop moving 55% → 45% (where `12`'s 55%
lands on a 200px-shorter panel), and the `Both` label leaving the .55 dim.

**The panel's scrim is specified in pixels from the bottom, not in percentages.**
That is the lesson `12b` cost: the same percentage stops over a 700px panel put
**α 0.613** under the headline where the 900px panel puts 0.672, and eleven of the
three panels' twenty-nine line boxes failed on frames nobody had measured. Any new
panel height re-derives the stop.

**The role survives email verification; the picker is never shown twice.** Ruled
2026-08-30 (D16) as a defect. The role is read from `?role=` server-side and
handed to Clerk as `unsafeMetadata` before verification, but Clerk's verification
step is a path navigation that remounts the page, and the picker — local state
seeded from the query string — resets to unselected. Since the role is already in
`unsafeMetadata`, it is read back from there (or the picker is suppressed once
verification is pending) rather than re-asked. **Re-asking is not a
confirmation step**; the screen's own subhead promises the choice cannot be
changed later, and asking again contradicts it.

## The marketing panel has three states

| State       | When                                                  | Panel                          |
| ----------- | ----------------------------------------------------- | ------------------------------ |
| **Default** | `/sign-up` with no role chosen                        | Neutral — speaks to both sides |
| Customer    | "I'm planning an event" selected, or `?role=customer` | Clay                           |
| Vendor      | "I'm a vendor" selected, or `?role=vendor`            | Sage                           |

Since the header no longer pre-sorts anyone, the **default state is the common
one** and it has real work to do: sell a two-sided marketplace to someone who
hasn't said which side they're on. The **form column is identical in all three
states** — email and password, nothing else. Only the panel changes.

**No business name on this screen.** Auth collects credentials and a role, full
stop. Business name, slug, categories and location are profile data, collected in
the editor (`17-vendor-profile-editor.md`) which is the next step of the vendor
flow. Putting a profile field in the auth form couples identity creation to
profile creation — it breaks social/SSO sign-up, complicates the confirm-email
round trip, and gives a partially-created vendor no clean state to resume from.

The vendor flow is therefore: **sign up (role + credentials) → profile editor
(screen 09/17) → publish checklist → live.** The editor already owns every field
that isn't a credential.

Same premise, inverted: a customer is promised they will **see** the price and the
open dates; a vendor is promised they **set** them. That symmetry is the product,
so both panels are built from it rather than each inventing its own angle.

The selected role card also changes accent: **clay** for customer, **sage** for
vendor, matching the gradient wash behind each panel. Sage is the settled,
working-side colour throughout the product.

## Default panel — both sides, labelled

**"Clear prices. Open calendars. _No back-and-forth._"** (Serif 38px, last line
italic in `#F3C98B`) · "Event vendors and the people who hire them — with the
price and the date settled before anyone picks up the phone."

Then three rows, each **prefixed with the side it belongs to** in a 9.5px uppercase
label, 64px column:

| Label   | Colour                  | Line                                            |
| ------- | ----------------------- | ----------------------------------------------- |
| BOOKING | `#F3C98B`               | See what a vendor charges and when they're free |
| VENDING | `#C4D6A8`               | Publish your prices and own your calendar       |
| BOTH    | `rgba(255,253,249,.55)` | Payment held until the event is complete        |

**The labels are what make this work.** A neutral panel written as generic copy
("connecting great events with great vendors") says nothing to either side — the
usual failure of a shared default. Naming the audience per line keeps every claim
concrete, silently tells the visitor there are two sides here, and previews the
choice sitting immediately below it in the form. The third row earns its place by
being the one promise that's identical for both.

Wash is neutral warm-grey rather than clay or green, so the panel doesn't
pre-suggest an answer: `linear-gradient(200deg, rgba(35,32,28,.14), rgba(45,40,32,.62) 55%, rgba(30,28,24,.86))`.

### The form waits for a role

In the default state both cards are unselected, **Create my account** renders
disabled (`stone-200` fill, `stone-500` text) and a 11.5px `stone-600` line under
it reads "Pick one above to continue". Email and password remain editable — typing
first and choosing second is a normal order, and disabling the fields would punish
it. Choosing a role enables the button and swaps the panel in one move.

## Customer panel — mechanism, not metrics

**"See the price. See the open dates. _Then decide._"** (Serif 38px, the last line
italic in `#F3C98B`) · then: "Every vendor publishes what they charge and when
they're free — before you talk to anyone, and without asking for a quote."

The premise is that both things a customer normally has to chase — **what it
costs and whether the date is free** — are published up front. That's the whole
product, and it's a promise that's true on day one. Note the headline never uses
the word "transparent"; it demonstrates it instead.

Three guarantees with pale-sage dots above a hairline:

- Live calendars — if a date shows open, it is
- Payment held until the event is complete
- Published prices, and no service fee on top

**No counts, no ratings, no "events booked".** A new marketplace has none of
those honestly, and a placeholder number here — the last thing a hesitant
sign-up reads — is the worst possible place for one. Each of these three claims
is true on day one and is a stronger promise than a small number.

## Clerk

`<ClerkProvider appearance={{ theme: shadcn }}>` inherits the slots already bound
in `globals.css`. Override only where Clerk's defaults fight the layout:

```ts
appearance: { theme: shadcn, elements: { card: { boxShadow: 'none', border: 'none' } } }
```

Never hand-write brand hexes into a Clerk appearance object — that's a second
source of truth and it drifts.

## Acceptance

- [ ] Role cards side by side, chosen role visible with a Change affordance after selection
- [ ] Panel fits 836px with no scroll
- [ ] Marketing panel contains no platform statistics
- [ ] Headline conveys published pricing **and** published availability — both halves, not just price
- [ ] Below 1280 the photo panel drops cleanly, no letterboxing
- [ ] No param shows the **neutral** panel with both cards unselected and submit disabled
- [ ] `?role=vendor` / `?role=customer` pre-select and show the matching panel immediately
- [ ] Email and password stay editable in the default state; only submit is disabled
- [ ] Header has one sign-up control, not two
- [ ] Selecting a role swaps the panel without a page load; the form column doesn't jump
- [ ] Selected card accent matches its panel — clay for customer, sage for vendor
- [ ] **No fee claim anywhere on the vendor panel**, positive or negative
- [ ] The form column is identical for both roles — email and password only
- [ ] No profile fields on this screen; business name is collected in the profile editor
- [ ] Reaching this screen from a blocked action preserves the intent and returns there after auth
- [ ] Browsing, searching and viewing profiles never require an account

## Vendor panel

**"Set your prices. Set your dates. _Get booked._"** (Serif 38px, last line italic
in `#D9E2C8`) · "Inquiries arrive already knowing what you charge and that your
date is free — so you spend your evenings working, not writing quotes."

Three guarantees with pale-sage dots:

- You publish your own packages and prices
- Your calendar decides which dates you're offered
- Paid out after the event — no chasing invoices

Wash: `linear-gradient(200deg, rgba(35,32,28,.12), rgba(40,48,34,.62) 55%, rgba(28,32,24,.86))`
— the same structure as the customer panel, shifted green.

The vendor's pain is unpaid quoting and calendar chaos, not price discovery, so
each line answers one of those. It never claims volume ("get more bookings",
"reach thousands of couples") — that's a platform-scale promise the app can't keep
on day one.

### No fee language on vendor surfaces — deferred

**Vendors do pay something**, and whether that's a service fee, a commission or a
subscription is not settled. So no vendor-facing surface makes any claim about
fees, in either direction. "Paid out after the event" describes the payment
_mechanism_, which is true regardless of the model.

The customer panel's "Published prices, and no service fee on top" stays — it's
true of the customer's side of the transaction and it's a real differentiator
there. Do not mirror it, or its negation, onto the vendor side.

When pricing is decided, the vendor panel gains a fourth line stating it plainly.
Until then, silence beats a claim that has to be walked back. See `98-post-mvp.md`.

## Post-MVP

The three guarantees give way to a stats band (vendors · average rating · median
reply) once the numbers are worth showing — condition in `98-post-mvp.md`. Keep
at least one mechanism line even then; it outperforms a number for a first-time
visitor.

- **Vendor pricing line** on the vendor panel once the model is decided — a plain statement of what a vendor pays, as a fourth guarantee.
- Vendor-side proof once it exists: earnings ranges by category, time-to-first-booking. Both need real vendors.
