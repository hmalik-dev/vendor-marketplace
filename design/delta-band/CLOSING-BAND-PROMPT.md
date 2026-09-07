# Prompt for Claude Code — landing closing band + footer

Scope: **the dark band above the footer on `/`, and the site footer.** Nothing
else. Do not touch the hero, categories, How it works, Featured vendors, or any
other screen.

Reference design: `Orla-Closing-Band.html` — the band and footer as they should
be built, at 1440.

---

## 1. Replace the two-audience closing band with a vendor-only band

Today the band above the footer is a two-column fork: _Planning an event? → Find a
vendor_ on the left, _Booking events yourself? → Go to your dashboard_ on the
right. **Delete both halves and build the single band described below.**

Why, so the rewrite doesn't drift back:

- The **customer half was redundant.** The hero is a _live search bar_ — a button whose only job is to scroll you back up to it earns nothing.
- The **vendor half addressed the wrong person.** "Go to your dashboard" was shown to a signed-out visitor, who has no dashboard.
- The vendor pitch is the page's only supply-side entry point besides one nav link, so it is the half worth keeping and widening.

### Render it for signed-out visitors only

**One account cannot be both a customer and a vendor** — role is fixed on the
account. So:

- **Signed-out visitor** — render the band.
- **Signed-in customer** — do not render it. They cannot act on a vendor pitch without a second account under a different email.
- **Signed-in vendor** — never reaches `/` at all; they are redirected to `/dashboard`.

Do not add a role switcher or any dual-role affordance.

### Composition

Ground `#23201C`, padding `60px 40px`. Contents are **flush to the page's 40px
gutter** — no centred inner max-width. Every block above the band is left-aligned
to that gutter, and a centred content column here reads as an unexplained shift.

The band is **stacked, not columned.** A two-column version left ~500px of dead
ink on the right, so the pitch spans the top line and the steps run full-width
beneath it.

**Top line** — `flex`, `align-items: flex-end`, `justify-content: space-between`:

- _Left_, `max-width: 600px`:
  - Instrument Serif `35px/1.12`, `#F8F5EF` — **Booking events yourself?**
  - Body `14px/1.7`, `#D8D0C2` — "Publish your prices and your open dates, and take bookings without the phone tag. You are paid through Stripe after the event."
- _Right_, flush to the right gutter, `gap: 20px`, `align-items: center`:
  - Text link, `13.5px/600`, `#F8F5EF` — **See how payouts work**
  - Primary button — `#FFFDF9` fill, `#23201C` text, `12px 22px`, `border-radius: 9px` — **Start taking bookings**
  - Button **last**, so the strongest element sits at the band's outer edge.

**Divider** — a `1px rgba(248,245,239,.14)` rule spanning the **full** band width,
`38px` above it, `32px` below.

**Steps** — `grid-template-columns: repeat(3, 1fr)`, `gap: 52px`. Each step is a
`23px` circle with a `1px rgba(248,245,239,.28)` border holding its numeral in
JetBrains Mono `11px` `#D8D0C2`, `14px` gap, then a `14.5px/600` `#F8F5EF` title
and a `13px/1.65` `#A79D8C` body:

1. **Publish your prices** — What you charge, in the open. Orla adds nothing on top of it.
2. **Set your open dates** — Customers only ever request a date you have actually left free.
3. **Get paid after the event** — The payment is held from booking until the event is done, then released through Stripe.

### Do not put pricing figures in this band

An earlier iteration had `12%`, `$0 to list` and the payout interval here as large
serif numerals. **They were removed on purpose. Do not reintroduce them.** Two
structural reasons:

- Commission is a _conversion_ number, not an acquisition one. Stated bare in a band with no room to frame it against what a vendor keeps, the first fact a vendor learns about money is what gets deducted from them.
- **Customers read this same page.** "Orla takes 12%" invites a customer to conclude a vendor charges more here than direct — exactly backwards, and it undercuts the _No service fee_ trust item further up the page.

The commission belongs in exactly two places: **`/for-vendors`**, where it can be
framed, and the **vendor agreement**, where it is binding.

### Both controls point at `/for-vendors`

**Start taking bookings** and **See how payouts work** both land on
`/for-vendors` — not `/sign-up?role=vendor`. The nav's _For vendors_ link points
there too.

Right now both entry points drop a vendor straight into a signup form, which means
a vendor first learns the commission at step 3 of onboarding, _after_ creating an
account and filling in a profile. That is backwards. `/for-vendors` states what you
keep, when you are paid, what it costs, and how availability works — **then** the
signup CTA.

If you are not building that page in this pass: point both controls at
`/sign-up?role=vendor` and leave a `TODO` naming `/for-vendors`. Do not silently
invent a different destination.

## 2. Footer

Applies on **every page**, both auth states.

- **Ground drops from `#23201C` to `#1C1916`.** The band above is `#23201C`; two masses of the same ink separated by a hairline read as one ~400px dark region. The footer's job is to recede into chrome beneath the band. Remove the `border-top` that was compensating for this — the value change replaces it.
- Grid is flush to the same `40px` gutter as the rest of the page. No centred inner column.
- Colour values, all on the new ground:
  - Wordmark `#F8F5EF`
  - Column micro-labels **`#8C8375`** (4.68:1). Do not go darker — `#7A7266` was tried and fails contrast at 10.5px.
  - Link columns `#B8AF9F`
  - Tagline and legal row `#8C8375`
- **Add a legal row** under the four-column grid: `26px` top margin, `16px` top padding, `1px rgba(248,245,239,.1)` top border. `Terms · Privacy · Cookies` at `12px` on the left, `© Orla 2026` right-aligned. **Not a fifth column** — a column would give three legal links the same visual weight as Browse.
- **Account column, signed out:** `Sign in` · `Sign up`. **Drop `Dashboard`** — a visitor has no dashboard.
- **Account column, signed in (customer):** `My bookings` · `Messages` · `Settings` · `Sign out`.

## Do not

- Do not reintroduce pricing figures into the band.
- Do not render the band for any signed-in user.
- Do not centre the band or footer contents.
- Do not add a fifth footer column.
- Do not add a role switcher.
