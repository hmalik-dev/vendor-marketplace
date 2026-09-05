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

Related, and **already filed as ticket #407 acceptance 1** — do not re-litigate
it as a new finding: `GET /vendors/:slug/availability` returns
`z.array(availabilitySchema)`, which includes `note`, for **every** row in its
window, unauthenticated. `findAvailabilityInRange` is a bare `select()`. The
route's own docstring claims the forward-only floor protects the note; it only
ever protected the _past_ rows. See also [[customer-pii-has-two-disclosure-gates]]
and [[response-schemas-are-a-second-write-boundary]].
