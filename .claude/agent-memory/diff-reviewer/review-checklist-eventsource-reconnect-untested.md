---
name: review-checklist-eventsource-reconnect-untested
description: Review checklist — when a diff makes an EventSource credential single-use, the shipped hook tests almost never drive `onerror`; mutate the hook to cache the credential and watch the suite stay green
metadata:
  type: feedback
---

`apps/web/src/lib/use-event-stream.ts` owns the app's only `EventSource`. Any
diff that changes what travels in its URL (#215 swapped the Clerk session JWT
for a single-use stream ticket) has exactly two behaviours that matter and
neither is visible in the diff:

1. **Reconnect re-exchanges.** The hook must close the source in `onerror` and
   rebuild it, because the native retry replays the same URL and a spent ticket
   401s forever. It does — proved by driving `sources[0].onerror()` under fake
   timers and asserting `opened[1]` carries `ticket-2`.
2. **A failed exchange still retries.** The `catch { scheduleRetry(); return; }`
   branch is the only thing between a transient API blip and a stream that is
   dead for the life of the tab.

**Why:** the #215 suite (`use-event-stream.test.tsx`, 7 tests) covers neither.
Its `it('asks for a ticket before every connection, so none is replayed')`
renders once and asserts `fetch` was called once — the name claims the reconnect
property, the body asserts the first connect. Two mechanical mutations each left
7/7 green: caching the ticket in the effect closure (`cachedTicket ?? await
requestStreamTicket(token)`), and deleting `scheduleRetry()` from the catch.

**How to apply:** write a throwaway `apps/web/src/lib/zz-scratch-*.test.tsx`
(vitest needs the `@/` alias, so it cannot live in /tmp), stub `EventSource`
with a fake that records every instance, `vi.useFakeTimers({ shouldAdvanceTime:
true })`, fire `onopen` then `onerror`, `advanceTimersByTimeAsync(1_500)` past
`BACKOFF_MS[0]`, and assert the second URL carries a _different_ credential.
Delete the file afterwards. Then apply the mutations to the implementation and
re-run the shipped suite — green is the finding.

Related: [[review-checklist-unpinned-safety-constants]] — same technique, flip
the thing the test claims to protect and see whether anything notices.
