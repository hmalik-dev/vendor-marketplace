---
name: review-checklist-limit-added-under-a-post-fetch-filter
description: When a diff adds LIMIT/OFFSET to a read whose service filters the rows *after* fetching them, the page stops being a page of the filtered set — probe with pageSize=2 and a filter that matches only the oldest row
metadata:
  type: feedback
---

A read with no `LIMIT` can filter in the service and still be correct: it loaded
everything. **The moment a diff adds a page window above that filter, the answer
changes** — page N is "the matching subset of a page of _all_ rows", not "page N
of the matching rows". Short pages, empty pages in the middle of a sequence, and
a client that stops on the first empty page never sees the row.

**Why:** #408 added `.limit()/.offset()` to `findRequests`, but
`listBookingRequests` still passes `filter = { customerId }` and applies
`query.status` to the aged rows afterwards (`booking-requests.service.ts:674`
then `:684`) — even though `findRequests` already accepts `filter.status` and
would have pushed it into the `WHERE`. Reproduced in the API harness: three
requests, the two newest accepted, then
`GET /booking-requests?status=pending&pageSize=2` answers **`[]`** while page 2
carries the pending one.

**How to apply:**

- For every DAO the diff gives a `PageWindow`, read its **service** caller and
  ask what it does to the rows between the fetch and the response. Any
  `.filter(...)`, `.slice(...)` or `if (…) continue` there is the bug.
- The probe is three rows and `pageSize=2` — it does not need the default page
  size to be exceeded, so "nobody has 100 bookings" is not a defence.
- Check whether the DAO already supports the predicate. Here it did, so the fix
  is passing `status` into the filter, not a bigger window.
- The sibling question: a lazy sweep that runs over the fetched page only
  (expiry here) now sweeps one page instead of the table, so rows past the
  window never age.

Related: [[review-checklist-read-time-overlay-vs-sibling-write]],
[[review-checklist-status-filter-vs-webhook-idempotency]].
