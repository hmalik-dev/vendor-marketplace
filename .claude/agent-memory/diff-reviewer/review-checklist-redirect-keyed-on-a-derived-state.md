---
name: review-checklist-redirect-keyed-on-a-derived-state
description: A new route guard keyed on a derived list (publishBlockers) also fires for every other writer that produces that state by design — find the other producers before judging the guard
metadata:
  type: feedback
---

A redirect gated on a _derived_ condition (`!isPublished && publishBlockers.includes('packages')`)
is not scoped to the flow the ticket describes. Grep for every writer that can
produce that same tuple.

**Why:** VEN-514 added the guard for a brand-new draft profile, but
`unpublishForMissingPackages` (vendors.service.ts) unpublishes a _live_ vendor
the moment they deactivate their last active package, and a moderation hold
deactivates packages too — so established vendors with pending requests were
permanently bounced off their dashboard.

**How to apply:** for any new `if (<derived state>) redirect(...)`, list the
other code paths that write that state (grep the blocker/flag name in the API
service), then name the established user who lands in it. Check the destination
route's chrome too: the editor replaces the vendor nav with its own rail, so
what the bounced user can still reach is a separate question.

Related: [[review-checklist-layout-gate-checked-at-its-own-route]],
[[review-checklist-gate-redirect-in-shared-client-helper]].
