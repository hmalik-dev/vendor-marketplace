---
name: refund-idempotency-key-is-parameter-sensitive
description: Both refund idempotency keys are fixed per booking while their params vary — the amount drifts across the refund tier and the unwind flags changed in #416, so a retry can be refused by Stripe instead of replayed
metadata:
  type: project
---

`createRefund` sends a key that is a pure function of the booking id —
`cancel_${bookingId}` (`payments.service.ts`) and `ban-refund:${booking.id}`
(`admin.service.ts`) — while the _parameters_ under that key are not fixed.

Stripe caches the first response for a key for 24 hours and refuses reuse of the
same key with different parameters (`idempotency_error`: "Keys for idempotent
requests can only be used with the same parameters they were first used with").
Two things vary here:

- **`amount`** comes from `calculateRefund`, which is time-dependent: a first
  attempt above `FULL_REFUND_CUTOFF_HOURS` asks for 100%, a retry below it asks
  for 50%. Same key, different amount, so the retry is refused rather than
  replayed and the customer cannot cancel at all until the key ages out.
- **The unwind flags** changed with D31/#416 (`reverse_transfer` false -> true),
  so any key minted in the 24h before that deploy refuses the new params too.

**Why:** the refund is deliberately sent _before_ the guarded row update (#399),
so the key is the only thing standing between two concurrent cancels and two
refunds. That design is right; the key being narrower than the request is the
gap.

**How to apply:** when a refund's parameters change — flags, amount derivation,
reason — the key has to change with them, or the first 24 hours after deploy
answer an opaque 400 on the money path. Version the key alongside the policy.
Related: the >24h direction is the opposite failure, see
[[refund-before-row-move-can-double-refund]].
