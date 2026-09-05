---
name: client-component-props-are-public-html
description: Adding 'use client' to a pane on a public page publishes its whole props object into the inlined RSC payload — the availability note reached the vendor page's HTML this way in #409
metadata:
  type: project
---

Adding `'use client'` to a component that a **server** page renders moves every
prop it receives into the RSC flight payload, which Next inlines in the HTML
(`self.__next_f.push`). On a public page that makes the prop object readable by
any anonymous visitor **and every crawler**, whether or not the component
renders it.

**Why:** #409 needed `useViewerToday` inside
`apps/web/src/components/vendors/profile/availability-pane.tsx`, so the pane
became a client component. Its prop is `entries: readonly Availability[]` — the
full row: `id`, `vendorId` and the vendor's private per-date `note` ("Sarah &
Tom, deposit paid"). The pane only ever reads `date` and `status`
(`new Map(entries.map((e) => [e.date, e.status]))`). The same page already
builds exactly that record and passes it to `BookingRail` as `calendar`.

**How to apply:** in any diff that adds `'use client'` to a component reachable
from a public route, list its props and ask what each one carries beyond what it
renders. Narrow the prop to the projection the component uses, on the server.
The same question applies to a client component whose prop type widens.

The endpoint half is **FIXED (#407, audited 2026-09-05)** — do not re-report it.
`GET /vendors/:slug/availability` now answers `publicAvailabilitySchema` and
reaches `findPublicAvailabilityInRange`, which never selects `note` at all;
`availabilitySchema` is declared as that shape **extended** with the note, so a
new private column is private until the public object names it. The vendor's own
`GET /vendor/availability` still carries the note behind `requireRole('vendor')`
and their own id, and no authorization decision anywhere reads the column
(the double-booking guards use `findAvailabilityOnDates`). See also [[customer-pii-has-two-disclosure-gates]]
and [[response-schemas-are-a-second-write-boundary]].
