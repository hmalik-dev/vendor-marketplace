# Runbook: the platform balance and paying out commission

Every customer payment lands in the platform's own Stripe balance (separate
charges and transfers, #423). The vendor's share stays there until the payout
sweep transfers it, a fixed window after the event; the rest is commission.
Nothing in that balance is ours to withdraw until it is known to be commission,
so the platform account never pays out on its own (D45).

## The setting that must hold

Stripe Dashboard → Settings → Payouts → **Payout schedule: Manual**, on the
platform account. `pnpm launch:check` fails `stripe payout schedule` until it
reads `manual`. Stripe's default is automatic, which would send customers'
money for events months away to the bank within days, and the transfer to the
vendor after the event would then fail with `balance_insufficient`.

## The daily reconciliation

Every API instance compares, once a day and shortly after each boot:

- **the balance**: USD `available` plus `pending` from `GET /v1/balance`
- **what it owes**: every unreleased vendor payout (`payout_released_at is
null`, `payout_model = 'separate'`, `vendor_payout_cents > 0`), plus what each
  live booking could still refund beyond the vendor's share — for an unreleased
  booking the rest of its total, for one released in the last 120 days (the
  card networks' chargeback window) its commission. A refund after release
  takes the vendor's share back by reversing the transfer (D31).

The result is logged each run (`Platform balance covers what it owes`, with
`balanceCents` and `requiredCents`). When the balance is short, the operator gets
one `platform_balance_short` email that day.

### When the alert fires

1. Stripe Dashboard → Balance → Payouts: find the payout that left. A payout
   while the schedule is manual means somebody took one by hand, or the schedule
   was changed; check Settings → Payouts first and set it back to Manual.
2. Top the balance up by the shortfall the alert names (Balance → Add to
   balance), before the next sweep tries a transfer it cannot cover. A transfer
   that already failed is retried by the sweep; it does not need re-sending.
3. Record what happened in Linear against the payout id.

## Paying out commission by hand

Commission is paid out manually, at most monthly, and only from headroom. The
reconciliation already counts commission still exposed to a chargeback, so what
it leaves over is the platform's:

1. Read the latest `Platform balance covers what it owes` log line (Railway
   logs, API service): `availableCents` and `requiredCents`.
2. Pay out at most `availableCents − requiredCents`, less a working buffer for
   Stripe fees on payments still arriving (keep $500 until volume says
   otherwise): Stripe Dashboard → Balance → Pay out → that amount → the
   platform's bank account. Never choose "Pay out entire balance".
3. The next reconciliation must still read `covers`. If it alerts, the payout
   was too large; follow the steps above.
