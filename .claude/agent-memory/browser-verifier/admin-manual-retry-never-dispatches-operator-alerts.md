---
name: admin-manual-retry-never-dispatches-operator-alerts
description: 3 manual PUT .../payout/retry calls never write an operator_alerts row by design, so an empty table after driving retries is not a finding
metadata:
  type: project
---

`retryBookingPayout` (`apps/api/src/modules/admin/admin.service.ts`) calls
`retryPayoutRelease` with no `alerts` in its `PayoutContext` — deliberately, per
its own comment: the pager is the sweep's alone, because an operator pressing
Retry is already looking at the result. Only `releaseDuePayouts` (the
15-minute scheduled sweep) is wired with `context.alerts`, and
`payoutFailedAlert` only fires once `attempts >= PAYOUT_FAILURE_ALERT_ATTEMPTS`.

**Why:** driving three manual retries through the admin route to check a
"stranded vendor" alert will always find `operator_alerts` empty — that is
correct behavior, not a broken alert.

**How to apply:** if a ticket's acceptance criteria expects an alert row after
N failures, it has to come from the sweep (`releaseDuePayouts`), which is
impractical to trigger live in a lane (no fast-forward, runs on a timer) — call
that criterion BLOCKED with this reason rather than reporting a false failure
from the empty table. See [[payout-release-needs-a-real-payment-intent]] for
the sibling gotcha in the same flow.
