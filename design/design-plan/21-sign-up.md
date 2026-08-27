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

## Marketing panel — mechanism, not metrics

**Revised copy.** Headline is three lines, Serif 38px, the last line italic in
`#F3C98B`:

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

The premise is published pricing **and** published availability — both halves.
Never use the word "transparent"; demonstrate it instead.

The previous copy ("Prices on the label. Dates you can trust." / "Every review
comes from a booking that actually happened…" / "Real availability, not a contact
form" / "No service fee, ever") is superseded. Layout, type sizes, colours and
the split-screen composition are unchanged — **this is a copy change only.**

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
- [ ] Marketing panel headline is the three-line "See the price. / See the open dates. / _Then decide._"
- [ ] The three guarantee lines match the frame word for word
- [ ] Below 1280 the photo panel drops cleanly, no letterboxing

## Post-MVP

The three guarantees give way to a stats band (vendors · average rating · median
reply) once the numbers are worth showing — condition in `98-post-mvp.md`. Keep
at least one mechanism line even then; it outperforms a number for a first-time
visitor.
