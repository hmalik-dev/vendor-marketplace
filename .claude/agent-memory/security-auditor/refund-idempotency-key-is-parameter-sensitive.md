---
name: refund-idempotency-key-is-parameter-sensitive
description: Refund idempotency keys are parameter-versioned by hand; VEN-469 made the version a persisted refusal counter, so how a Stripe error is classified now decides whether a second refund is sent
metadata:
  type: project
---

`createRefund` keys are `${keyPrefix}_${booking.id}_direct[_${attempt}]`
(`payments.service.ts` `refundAndUnwind`) and `${refundKeyPrefix}:${booking.id}`
(`admin/account-unwind.ts`, no counter). Stripe caches a response — including a
_failure_ — for 24h per key and refuses a replay with different parameters.

**The classifier is the guard (VEN-469).** `createRefundOnce` bumps a persisted
`refund_attempts` counter — and therefore the key — for anything it calls a
refusal. Treating every `StripeError` with a `statusCode` as one is wrong three
ways: a 429 and a 5xx may have executed or may retry safely only under the
_same_ key, and an `idempotency_error` proves a request under that key already
ran. Bump on those and the next attempt sends a fresh key while
`findRefund`'s list still lags — the over-refund the fixed key existed to stop.
Only a deterministic 4xx (`invalid_request_error`, `card_error`) may move it.

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

**How to apply:** when a refund's parameters change, the key literal must change
with it — VEN-469 added `metadata` to `refundParams` and left `_direct` and the
unwind key alone, so every key replayed inside the deploy's 24h window answers
`idempotency_error`. When the key gains state, check that concurrent callers
still derive the same one. Related: [[refund-before-row-move-can-double-refund]],
[[refund-proportionality-is-now-ours-to-state]].

**Two actors, one key (VEN-659).** The vendor cancel (full refund) reuses
`cancel_${id}_marked` with the customer cancel (tiered). If the vendor's
`findRefund` sees the customer's half-refund, its "remaining half" replays the
same key + same params, Stripe returns the customer's refund, and
`alreadyRefunded + created` double-counts it: the row records a full refund
Stripe never sent. Only the loser's `alertRefundUnrecorded` catches it. Keys
are safe to share only between callers that compute the same amount.

**The reversal keys keep the cached-failure half.** Every `reverseTransfer` key
is fixed per booking (`${keyPrefix}_${id}_reversal`, VEN-424's
`release_${id}_surplus`); `balance_insufficient` is the realistic refusal and
`findTransfer().reversedCents` is the expiry-free guard that makes varying them
safe. The test double replays a reversal on the key alone and models no cached
failure, so no suite can go red for it; `createTransfer`'s `failedTransferKeys`
branch is the shape to copy.
