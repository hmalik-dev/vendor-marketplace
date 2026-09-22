# Checkout test mode

## 39 — checkout, test mode

34px strip above the checkout header, only when the Stripe publishable key starts `pk_test_`.

- Ground `#23201C`, mono `11.5px` `#F8F5EF`, 6px amber `#E0A83C` dot, centred, single line, never wraps.
- Copy: **Test mode: no real money moves. Use Stripe's test card 4242 4242 4242 4242.**
- Pushes the page down 34px — it does not overlay. Nothing else on checkout changes in test mode.

**Checkout only.** Not the dashboard, not browse, not emails, not any other route.

## 39b — the same strip on 21 and 33

The declined state and the refund block are the same route, so the strip lives in the checkout layout above the header and every state of that page inherits it. Do not add it per-state — the one that would eventually ship without it is the declined state, where it matters most.

Order is environment first, then account state: _none of this is real_ above _this attempt failed_, with the header between them so ink and red never touch.

Two details specific to the declined state in test mode:

- Card number shows `4000 0000 0000 0002` (Stripe's decline card), not `4242`. A tester reproducing a decline needs the card that causes one; the strip names only the success card.
- The red banner's claim ("you haven't been charged") and the strip's claim ("no real money moves") are different statements and must stay visually distinct — this is why the strip is ink and mono rather than a second red band.

At 390 the strip stays one line at 11.5px mono with 20px padding. Below that it wraps to two lines and grows to 48px — never truncate it.

Gate on the key, never on a build flag or env name — a flag can disagree with the key actually in use. Production key → no strip, no override.

Colour is deliberately outside the four state families in `40-states.md`: steel/gold/red/sage all make claims about _your booking_; this makes a claim about the _build_. Ink + mono reads as developer scaffolding.

### Recommended, not yet built

Same rule — show it where someone could believe real money already moved:

- **Payment confirmed / receipt screen** — asserts a successful charge. Strongest remaining candidate.
- **Vendor payout / earnings** — balances read as money in a real bank account.
- **Refund confirmed** — "you've been refunded $1,450" is a false promise without it.

Deliberately excluded: booking detail, bookings hub, profile pricing, the `/for-vendors` worked example. They quote prices, they don't assert a transaction — and a strip everywhere becomes furniture and stops being read at checkout.

Emails need a `[TEST]` **subject** prefix instead of a body strip: the recipient decides whether to open before they see any body copy.
