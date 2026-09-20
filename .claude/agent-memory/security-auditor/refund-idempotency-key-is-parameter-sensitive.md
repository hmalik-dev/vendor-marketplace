---
name: refund-idempotency-key-is-parameter-sensitive
description: Both refund idempotency keys carry a version suffix; VEN-477 made that suffix the already-refunded total, so dedup now holds only while two racers read the same Stripe state
metadata:
  type: project
---

`createRefund` keys are `cancel_${bookingId}_direct_${alreadyRefundedCents}`
(`payments.service.ts` `refundAndUnwind`) and
`${refundKeyPrefix}:${booking.id}:${alreadyRefundedCents}`
(`admin/account-unwind.ts`). Stripe caches a response — including a _failure_ —
for 24h per key and refuses a replay with different parameters.

**What VEN-477 changed.** `findRefund` now sums every usable refund on the
intent (`sumUsableRefunds`, all pages) and both paths refund the _remainder_
instead of skipping when any refund exists. Consequences to keep in mind:

- The key is no longer a pure function of the booking. Two concurrent cancels
  dedup only if their `findRefund` reads agree; a refund landing between the two
  reads gives them different keys and different amounts, and only Stripe's
  charge-amount cap bounds the result — so below the full tier it is a real
  over-refund. The refund is deliberately sent _before_ the guarded row update
  (#399), so nothing else serialises the two.
- The suffix does **not** move when the refund _fails_ (nothing landed, so
  `alreadyRefundedCents` stays), which is precisely the cached-failure case D36
  is about. The in-code comment claims otherwise; a transient refusal still
  locks the booking's refund for 24h.
- `refundCents` is still time-tiered on the cancel path, so a first attempt
  above the cutoff and a retry below it share a key with different amounts →
  `idempotency_error`. Unfixed, pre-VEN-477.

**How to apply:** when a refund's parameters change, the key must change with
them; when the key gains state, check that concurrent callers still derive the
same one. Related: [[refund-before-row-move-can-double-refund]],
[[refund-proportionality-is-now-ours-to-state]].

**The reversal keys keep the cached-failure half.** Every `reverseTransfer` key
is fixed per booking (`${keyPrefix}_${id}_reversal`, VEN-424's
`release_${id}_surplus`); `balance_insufficient` is the realistic refusal and
`findTransfer().reversedCents` is the expiry-free guard that makes varying them
safe. The test double replays a reversal on the key alone and models no cached
failure, so no suite can go red for it; `createTransfer`'s `failedTransferKeys`
branch is the shape to copy.
