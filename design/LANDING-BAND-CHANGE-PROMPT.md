# Prompt for Claude Code — landing closing band, footer, and the signed-in landing

Paste everything below the line into Claude Code. Scope is **the landing page's
closing band, the site footer, and the signed-in variant of `/`**. Nothing else.

---

I have an existing implementation built from the specs in `design-plan/`. Four
things about the landing page and footer have changed. **Revise only what is
listed below.** Every other screen, component and token is correct as built — do
not touch, refactor, "improve", or reformat anything outside this scope.

Reference design: `Orla - Screens.dc.html`, section 30 ("Landing — full page"),
which now carries both states side by side: the signed-out page, the signed-in
page, and the closing band with its notes.

## Read first

- `design-plan/10-landing.md` — the landing spec
- `design-plan/00-README.md` — conventions and the MVP/post-MVP split

## Change 1 — Roles are exclusive, and that decides who sees `/`

**One account cannot be both a customer and a vendor.** Role is fixed on the
account. This is now load-bearing for routing:

- A **signed-in vendor** hitting `/` is redirected to `/dashboard`. The marketing landing never renders for them. The header logo also points at `/dashboard` for a vendor, not at `/`.
- A **signed-in customer** stays on `/` and gets the signed-in variant in Change 3.
- A **signed-out visitor** gets the page as built, with the band from Change 2.

Do not add a role switcher, a "switch to vendor account" affordance, or any UI
that implies one account can hold both roles. A customer who wants to sell needs
a separate account.

## Change 2 — The closing band above the footer is vendor-only

Today the dark band above the footer is a two-column fork: _Planning an event? →
Find a vendor_ on the left, _Booking events yourself? → Go to your dashboard_ on
the right.

**Replace it with a single vendor-only band, and render it for signed-out visitors
only.**

Why, so the rewrite doesn't drift back: the customer half was redundant — the hero
is a _live search bar_, so a button whose only job is to scroll you back up to it
earns nothing. The vendor half is the page's only supply-side entry point besides
one nav link, so it is the half worth keeping and widening.

**Composition** — ground `#23201C`, `60px 40px`, inner max-width `1160px` centred,
two columns split by a `1px rgba(248,245,239,.14)` rule with `52px` of left padding
on the right column:

_Left column, max-width 440px:_

- Instrument Serif `33px/1.14`, `#F8F5EF`: **Booking events yourself?**
- Body `13.5px/1.7`, `#D8D0C2`: "Publish your prices and your open dates, and take bookings without the phone tag. You are paid through Stripe after the event."
- Primary button: `#FFFDF9` fill, `#23201C` text, `12px 22px`, `rounded-9` — **Start taking bookings**
- Secondary text link beside it, `13.5px/600`, `#F8F5EF` — **See how payouts work**

_Right column — three numbered mechanism steps,_ `19px` apart. Each step is a
`22px` circle with a `1px rgba(248,245,239,.3)` border holding the numeral in
JetBrains Mono `11px`, `#D8D0C2`; then a `14px/600` `#F8F5EF` title and a
`12.5px/1.6` `#A79D8C` body capped at `250px`:

1. **Publish your prices** — What you charge, in the open. Orla adds nothing on top of it.
2. **Set your open dates** — Customers only ever request a date you have actually left free.
3. **Get paid after the event** — The payment is held from booking until the event is done, then released to you through Stripe.

### Do not put pricing figures in this band

An earlier iteration had `12%`, `$0 to list` and the payout interval here as large
serif numerals. **They are removed on purpose. Do not reintroduce them.** Two
reasons, both structural:

- Commission is a _conversion_ number, not an acquisition one. Stated bare in a band with no room to frame it against what a vendor keeps, the first fact a vendor learns about money is what gets deducted from them.
- **Customers read this same page.** "Orla takes 12%" invites a customer to conclude that a vendor charges more here than direct — exactly backwards, and it undercuts the _No service fee_ trust item three sections above.

The commission belongs in exactly two places: **`/for-vendors`**, where it can be
framed, and the **vendor agreement**, where it is binding.

### `/for-vendors` is a new page this change depends on

Both **Start taking bookings** and **See how payouts work** must land on
`/for-vendors`, not on `/sign-up?role=vendor`. The nav's _For vendors_ link points
there too. Right now both entry points drop a vendor straight into a signup form,
which means a vendor first learns the commission at step 3 of onboarding — after
creating an account and filling in a profile. That is backwards.

`/for-vendors` states what you keep, when you are paid, what it costs, and how
availability works — **then** the signup CTA. If you are not building that page in
this pass, point both controls at `/sign-up?role=vendor` and leave a `TODO`
naming `/for-vendors`; do not silently invent a different destination.

## Change 3 — The signed-in landing (`/` for a customer)

Same route, and **the hero is unchanged** — badge, headline, sub-headline, search
bar, jump-to category pills, photo cluster and the category row all stay exactly
as they are in the signed-out page. Do not re-cut the hero for signed-in users;
that is a separate decision.

**Add above the hero** — a `60px` status strip between the header and the hero,
ground `#F4F0E8`, `1px #E8E1D5` bottom border, `0 40px`:

- Left: two items separated by a `1px #DFD8CB` 20px vertical rule. First, a `7px` sage `#7A9468` dot then `Next up — <strong>June Harlow Photography</strong>, Sat 14 Jun · in 49 days`. Second, a `7px` gold `#C08A21` dot then `1 request waiting on a vendor`.
- Right: `13px/600` clay-text `#A34A28` — `All bookings →`
- Colour is a signal here, same as everywhere else in the product: sage means settled, gold means waiting on someone. Derive both items from real data; render the strip with only the items that exist, and omit it entirely when the customer has no bookings and no open requests.

**Remove below the hero,** for signed-in customers only:

- **How it works** — it explains a process this person has completed. Pure acquisition.
- **Featured vendors** — out of scope here and separately disputed.
- **The closing band** — a customer cannot act on a vendor pitch, and the customer pitch is a scroll back to a search bar they already passed.

**Keep the trust band, and bind its copy to the live booking.** This one is a
deliberate reversal of an earlier note that cut it. _How it works_ describes a
process; the trust band states **standing guarantees** that stay true on every
booking — and "payment held until the event" matters _more_ to someone with money
in flight than to a visitor. So it stays, as the page's ending, with copy resolved
against the customer's actual booking rather than generic:

- _Payment held until the event_ — "Your $2,050 for June is held by Stripe until 14 June, then released to her."
- _Reviews from real bookings_ — "You can review June once 14 June has passed. Every review on Orla comes from a booking that happened."
- _No service fee_ — unchanged, generic. There is nothing booking-specific to say.

Fall back to the generic signed-out copy when the customer has no booking to
resolve against.

**How the page ends.** With the closing band gone, the trust band is the last
content block, and the merge into the footer is a value ramp: hero gradient →
`#F8F5EF` → `#F4F0E8` trust band → `#1C1916` footer. Each step is darker than the
last, so the footer arrives as the bottom of a ramp rather than a wall. Keep the
trust band on `#F4F0E8` for exactly this reason — do not put it on `#F8F5EF`, which
would leave the footer as a hard cut off cream.

## Change 4 — Footer

Applies on **every page**, both auth states.

- **Ground drops from `#23201C` to `#1C1916`.** The band above it is `#23201C`; two masses of the same ink separated by a hairline read as one 400px dark region, and the footer's job is to recede into chrome beneath the band.
- Column micro-labels go to **`#8C8375`** (4.68:1 on the new ground). Do not use anything darker — `#7A7266` was tried and fails contrast at 10.5px. Body copy stays `#8C8375`, link columns `#B8AF9F`, wordmark `#F8F5EF`.
- **Add a legal row** under the existing four-column grid: `26px` top margin, `16px` top padding, `1px rgba(248,245,239,.1)` top border. `Terms · Privacy · Cookies` at `12px` `#8C8375` on the left, `© Orla 2026` right-aligned. **Not a fifth column** — a column would give three legal links the same visual weight as Browse. If you have already built this row from the legal-pages prompt, leave it; it is the same row.
- **Account column, signed out:** `Sign in` · `Sign up`. **Drop `Dashboard`** — a visitor has no dashboard.
- **Account column, signed in (customer):** `My bookings` · `Messages` · `Settings` · `Sign out`.

## Header, signed in as a customer

For completeness, since the signed-in landing shows it: logo, then `Browse` ·
`My bookings` · `Messages`; on the right a mail glyph with a clay `7px` unread dot
and the `30px` avatar disc (`#F7E7E0` fill, `#8E3F20` initials). No Sign in, no
Sign up pill.

## One unconfirmed number

The payout interval — **"released two business days after the event"** — is a design
placeholder, not a product decision. It no longer appears on the landing page after
Change 2, but it is still in the vendor agreement and will be on `/for-vendors`.
Read it from one config constant referenced everywhere it appears, so the real
figure is a one-line change.

## Do not

- Do not reintroduce pricing figures into the closing band.
- Do not render the closing band for any signed-in user.
- Do not re-cut the signed-in hero.
- Do not remove the trust band from the signed-in page.
- Do not add a role switcher or any dual-role affordance.
- Do not add a fifth footer column.
