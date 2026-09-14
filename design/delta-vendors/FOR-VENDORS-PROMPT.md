# `/for-vendors` — build prompt

Frame **34** in `Orla - Screens.dc.html`. Standalone frame:
`delta-vendors/Orla-For-Vendors.html` (1440 + 390).

This is the page the landing page's closing band points at, and the page that
lets that band stay figure-free.

## 0 — Routing

**Public marketing route, sibling of `/`.** Landing's nav and footer, cream
`#F8F5EF` page, 40px gutter. No dashboard chrome, no app shell.

Three entry points, one destination:

| From                                 | To                     |
| ------------------------------------ | ---------------------- |
| Nav _For vendors_                    | `/for-vendors`         |
| Closing band _Start taking bookings_ | `/for-vendors`         |
| Closing band _See how payouts work_  | `/for-vendors#payouts` |

`#payouts` is the id on the second section. It is an anchor target only — it
is **never rendered as visible text** on the page.

- Signed-in **vendor** → `302 /dashboard`. The page's only ask is one they've
  already completed.
- Signed-in **customer** → served as-is. Public copy, not a role-gated surface.
- Nav _For vendors_ carries the active clay underline here.
- Footer legal row gains **Vendor agreement** on this page only — the one page
  where a visitor wants it _before_ signing up.

## 1 — Scope: this is a quick informational page

**Two sections, and it ends.** A vendor arrives with two questions and the
page answers each once:

1. **Hero — what do I keep?** Eyebrow, serif 56px headline
   (_Your prices, your dates, your money._), lede, primary CTA, a text link
   down to payouts, and a one-line reassurance row: _Free to list · No monthly
   fee · No fee unless you get paid_.

   Beside it, the **worked example** card — the argument in four lines:

   |                  |                                   |
   | ---------------- | --------------------------------- |
   | You charge       | `$2,600.00`                       |
   | Orla's fee `12%` | `−$286.00`                        |
   | **You keep**     | **`$2,314.00`** (sage, 24px mono) |

   Footnote: the customer pays exactly your price. Orla adds nothing on top,
   so you are never the expensive way to book yourself.

2. **When you are paid** (`id="payouts"`) — heading plus a short right-hand
   note (Stripe holds it in _your_ account, not an Orla balance), then four
   steps in one bordered row: accept → customer pays in full at booking →
   Stripe holds it → **released two business days after the event**. Step 04
   tinted `#FDF6EA`; it is the moment the section exists for.

   Under the row, three one-line facts and nothing more:
   - Canceled by the customer → they are refunded and our fee is refunded too.
   - Payout failed → you are told which detail Stripe rejected, not just that
     it failed.
   - You cannot be booked on a day you did not open; accepting closes that date
     everywhere, and unanswered requests expire and free it.

Then the closing CTA on `#23201C` and the standard footer.

**Deliberately not here:** a fee table, an availability section, testimonials,
logos, an FAQ. The fee table said `$0` six times to make a point the hero's
reassurance row makes in nine words. The full terms live in the vendor
agreement (frame 32), linked twice from this page. A quick page earns its
length by not repeating itself.

## 2 — The commission rule

It appears **exactly once**, as a _subtraction inside the worked example_,
where the result is what the vendor keeps. Never as a bare display numeral, a
hero stat, or a badge — that is what got it cut from the landing band. Do not
add a second occurrence.

## 3 — Config figures

`PLATFORM_FEE_PCT = 12` and `PAYOUT_DELAY = 2 business days` are read from
**one constant**, shared with the vendor agreement and the vendor dashboard.
The payout interval is still a **design placeholder, not a product decision** —
the real figure must be a one-line change in all three places. Marked with a
gold chip in the frame wherever it appears.

## 4 — CTA discipline

**Start taking bookings** → `/sign-up?role=vendor`. Twice only: hero and
closing band. Not in the nav, not sticky, not between sections. A vendor
weighing a payout model should not meet the same button four times.

Secondary controls are text links and never compete: _See how payouts work_
(in-page anchor), _Read the vendor agreement_ (`/legal/vendor-agreement`).

## 5 — Color

Per `40-states.md`: **You keep** is sage — settled, nothing outstanding. Both
config chips are gold, because each names a wait (a percentage yet to be
deducted, an interval yet to elapse). **No red anywhere on this page** —
nothing here has failed, and a red figure beside a commission reads as a
penalty.

## 6 — Mobile (390)

Same two sections, stacked. The worked example survives intact — it is the
whole argument in four lines. Payout steps stack with their numerals kept
(once the row is gone they are the only thing carrying sequence) and step 04
keeps its tint. The three footnotes compress to one sentence. Hero CTA is
full-width, 48px+ tall.

## Acceptance

- [ ] Nav and both band controls resolve here; `#payouts` scrolls to section 2
- [ ] `#payouts` never appears as visible text
- [ ] Signed-in vendor is redirected to `/dashboard`
- [ ] `12%` and the payout interval come from config, not the template
- [ ] Commission appears exactly once, as a subtraction
- [ ] `Start taking bookings` appears exactly twice
- [ ] No red on the page; _You keep_ is sage
- [ ] Vendor agreement linked from the footer legal row and the closing band
- [ ] Landing-band `TODO` naming `/for-vendors` is removed
