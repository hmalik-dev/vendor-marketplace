---
name: api-session-timeouts-vs-stripe-in-transaction
description: VEN-607 API pool statement/lock/idle-in-transaction timeouts turn waits after a Stripe side effect into thrown errors that skip the refund/payout alert paths
metadata:
  type: project
---

VEN-607 set `statement_timeout 10s`, `lock_timeout 5s`, `idle_in_transaction_session_timeout 30s` on the API pool (startup params, so the payout sweep inherits them) and maps 57014/55P03 to a fixed-copy 503 `SERVICE_BUSY`. The 503 body leaks nothing; the log/Sentry side is the same `err` as the 500 path.

The money hazards (audit 2026-09-24):

- `cancelBooking` refunds outside any transaction, then `asBookingActor(cancelBookingAndFreeDate)` UPDATEs the booking row. If the sweep holds that row `FOR UPDATE` during its Stripe calls for >5s, the UPDATE throws 55P03 and escapes before the `!settled` → `refundFailedAlert` branch. Before VEN-607 it waited, then failed the `payout_released_at IS NULL` predicate and alerted.
- The sweep awaits findRefund → findTransfer → createTransfer (→ reverseTransfer) with no DB statement between them. Each can take about 20s (10s timeout plus one retry), so the idle gap can pass 30s. The server then kills the session after the transfer. The commit throws out of `releaseOnePayout` and `releaseDuePayouts` has no per-booking catch, so the rest of the batch is abandoned and `payoutFailedAlert` never fires. `findTransfer` still prevents a second transfer.
- `resolveDispute` has a `.catch(alertUnreconciled)` on its transaction, so a timeout there does alert.

**How to apply:** any post-side-effect DB write must alert on _thrown_ errors, not only on a null result. And the idle timeout must exceed the longest Stripe chain awaited inside a transaction. Relates to [[refund-before-row-move-can-double-refund]] and [[payout-sweep-is-a-second-money-mover]].
