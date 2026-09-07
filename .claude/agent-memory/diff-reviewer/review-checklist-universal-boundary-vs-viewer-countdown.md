---
name: review-checklist-universal-boundary-vs-viewer-countdown
description: A server read filtered with isUniversallyPastDate keeps yesterday; the client that renders it must re-filter on the viewer's day or it prints "today" about a past date
metadata:
  type: feedback
---

**`isUniversallyPastDate` on the server is a _wider_ window than the viewer's
day. Any client that then renders a countdown off that row has to narrow it
again — otherwise `days <= 0` collapses "yesterday" into "today".**

**Why:** #409's rule is that a server cannot know the reader's day, so a server
filter keeps everything from `now - 1 UTC day` onward. `useViewerToday` then
re-anchors the _label_ on the reader's real day. The two boundaries do not
match: for a reader whose day is the server's day, a row dated yesterday
survives the filter and `daysUntil` returns **-1**; east of UTC it returns -2.
Seen on #428's landing status strip, which rendered
`Next up — June Harlow Photography, Sat, Apr 25 · today` on Apr 26, and whose
own comment claimed _"negative counts cannot arrive — `landingStatus` filters
the entry out"_. The peer surface disagreed too: `/bookings` classifies that
same row as **past**, because `entriesForTab` filters
`daysUntil(eventDate, today) >= 0` against the _viewer's_ day.

**How to apply:** when a diff pairs a server-side `isUniversallyPastDate` /
`isUniversallyFutureDate` filter with a client component that renders a
relative label:

1. Read the countdown's floor. `days <= 0 → 'today'` and `days < 0 → …` are
   different guards; the first is the bug, and it is usually justified by a
   comment asserting negatives are impossible.
2. Probe with the row the server filter deliberately keeps: `eventDate =`
   yesterday, `serverToday =` today, viewer clock on today. Under
   `viewerOn()` + fake timers this renders in one test.
3. Diff the predicate against the sibling surface the link goes to. Two
   surfaces filtering the same list on two clocks is the finding, not the
   arithmetic.

The mirror of [[review-checklist-viewer-anchor-vs-the-read-behind-it]]: there a
surface was re-anchored on the viewer without widening the server read; here the
server read was widened without re-narrowing at the viewer.
