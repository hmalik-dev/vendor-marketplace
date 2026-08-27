# 21 — Sign up & sign in (`/sign-up`, `/sign-in`) — **MVP**

**Purpose:** frictionless entry. Role selection is irreversible, so it must be
made deliberately and visibly.

## Composition at 1440 — split screen

Left half: the auth panel on `stone-50`, content capped at 460px. Right half:
600px full-bleed photograph under a 200deg wash, with proof over it.

A card floating in a field of cream wastes half the viewport. The marketing panel
uses the width honestly and it's the last thing a hesitant sign-up sees.
Below 1280 the panel drops and the auth column centres.

## Two entry points, one screen

Both user types need an account — a customer to request or pay for a booking, a
vendor to publish a profile — but they arrive from different places and in very
different volumes.

| Header control         | Style                                  | Goes to                              |
| ---------------------- | -------------------------------------- | ------------------------------------ |
| **Sign up**            | Ink pill, `stone-900` fill             | `/sign-up` with no role pre-selected |
| **List your services** | Plain text link, left of a 1px divider | `/sign-up?role=vendor`               |

The customer path gets the pill because it is the volume path. The vendor path is
a **named** link — "List your services" says what it does, where "Sign up" beside
it would be ambiguous about which side you're joining. Both land on this screen;
**the role cards below are the real fork**, so the header never has to duplicate
the decision. Arriving with `?role=vendor` pre-selects the vendor card, and the
customer card stays one click away.

"For vendors" in the main nav points at the landing page's vendor section, which
has its own CTA into `/sign-up?role=vendor`. Two doors, same room.

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

|              | Selected (customer) | Selected (vendor) | Unselected      |
| ------------ | ------------------- | ----------------- | --------------- |
| Background   | `clay-100`          | `sage-50`         | `stone-0`       |
| Border       | 2px `clay-400`      | 2px `sage-400`    | 1px `stone-300` |
| Glyph circle | `stone-0`           | `stone-0`         | `stone-150`     |
| Glyph stroke | `clay-500`          | `sage-600`        | `stone-600`     |

The selected card's accent matches the panel beside it — **clay for customer,
sage for vendor**. Sage is the settled, working-side colour throughout the
product, so the vendor path is coloured the same way the vendor's own surfaces
are.

"I'm planning an event — Find and book vendors near you." ·
"I'm a vendor — List your services and take bookings."

Then email, password (helper: "At least 10 characters"), **Create my account**,
and "Already with us? Sign in".

The whole panel — role choice and form — must fit inside 836px without scrolling.

## The marketing panel is role-aware

Selecting a role swaps the right panel's headline, body, three guarantees and the
wash behind them. **The form column does not change** — the choice is the only
thing that moves the page.

Same premise, inverted: a customer is promised they will **see** the price and the
open dates; a vendor is promised they **set** them. That symmetry is the product,
so both panels are built from it rather than each inventing its own angle.

Default with no `?role=`: the customer panel, since that's the volume path.
Arriving at `/sign-up?role=vendor` shows the vendor panel immediately.
`/sign-in` always shows the customer panel — the signing-in visitor already has a
role and the panel is not asking them to pick one.

## Customer panel — mechanism, not metrics

Headline is three lines, Serif 38px, the last line italic in `gold-200`:

```
See the price.
See the open dates.
*Then decide.*
```

Body, one line: "Every vendor publishes what they charge and when they're free —
before you talk to anyone, and without asking for a quote."

Then three guarantees with pale-sage dots above a hairline:

- Live calendars — if a date shows open, it is
- Payment held until the event is complete
- Published prices, and no service fee on top

Wash: `linear-gradient(200deg, rgba(35,32,28,.12), rgba(58,31,18,.62) 55%, rgba(35,32,28,.85))`.

The premise is published pricing **and** published availability — both halves.
Never use the word "transparent"; demonstrate it instead.

The previous copy ("Prices on the label. Dates you can trust." / "Every review
comes from a booking that actually happened…" / "Real availability, not a contact
form" / "No service fee, ever") is superseded.

**No counts, no ratings, no "events booked".** A new marketplace has none of
those honestly, and a placeholder number here — the last thing a hesitant
sign-up reads — is the worst possible place for one. Each of these three claims
is true on day one and is a stronger promise than a small number.

## Vendor panel

Headline, Serif 38px, last line italic in `sage-150`:

```
Set your prices.
Set your dates.
*Get booked.*
```

Body: "Enquiries arrive already knowing what you charge and that your date is
free — so you spend your evenings working, not writing quotes."

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

## Clerk

`<ClerkProvider appearance={{ theme: shadcn }}>` inherits the slots already bound
in `globals.css`. Override only where Clerk's defaults fight the layout:

```ts
appearance: { theme: shadcn, elements: { card: { boxShadow: 'none', border: 'none' } } }
```

Never hand-write brand hexes into a Clerk appearance object — that's a second
source of truth and it drifts.

### The vendor's business-name field

The frame draws **Business name** as the first field of the vendor form. Clerk's
drop-in `<SignUp>` owns its own field set and takes no custom fields, so in MVP
the business name is the first field of the storefront editor the vendor lands on
immediately after sign-up (`17-vendor-profile-editor.md`) — it is collected once,
in one place, one screen later.

**Unblock:** a custom sign-up flow built on `useSignUp`, at which point the field
moves into this form and nothing else about the screen changes. Until then the
frame's vendor form is read as _identical to the customer form_ — that is the
only place the implementation deviates from `12b`.

## Acceptance

- [ ] Role cards side by side, chosen role visible with a Change affordance after selection
- [ ] Panel fits 836px with no scroll
- [ ] Marketing panel contains no platform statistics
- [ ] Customer headline is the three-line "See the price. / See the open dates. / _Then decide._"
- [ ] Vendor headline is the three-line "Set your prices. / Set your dates. / _Get booked._"
- [ ] The three guarantee lines on each panel match the frame word for word
- [ ] `?role=vendor` pre-selects the vendor card and shows the vendor panel; no param shows the customer panel
- [ ] Selecting a role swaps the panel without a page load; the form column doesn't jump
- [ ] Selected card accent matches its panel — clay for customer, sage for vendor
- [ ] **No fee claim anywhere on the vendor panel**, positive or negative
- [ ] Below 1280 the photo panel drops cleanly, no letterboxing
- [ ] Browsing, searching and viewing profiles never require an account

## Post-MVP

The three guarantees give way to a stats band (vendors · average rating · median
reply) once the numbers are worth showing — condition in `98-post-mvp.md`. Keep
at least one mechanism line even then; it outperforms a number for a first-time
visitor.

- **Vendor pricing line** on the vendor panel once the model is decided — a plain statement of what a vendor pays, as a fourth guarantee.
- Vendor-side proof once it exists: earnings ranges by category, time-to-first-booking. Both need real vendors.
- The business-name field moves into the sign-up form behind a custom `useSignUp` flow.
