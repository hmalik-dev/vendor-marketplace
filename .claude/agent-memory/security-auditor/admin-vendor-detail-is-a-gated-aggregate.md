---
name: admin-vendor-detail-is-a-gated-aggregate
description: GET /admin/vendors/:vendorId (VEN-380) audited PASS; what it may widen to without crossing another gate
metadata:
  type: project
---

`GET /admin/vendors/:vendorId` aggregates profile, owner email, Stripe id, packages, portfolio keys, date locks with customer names, and the vendor's notifications. Audited 2026-09-14: PASS. `adminOnly` (requireRoleBeforeValidation) on onRequest, `z.uuid()` params, all Drizzle-parameterised, React text only, portfolio refs go through the same `resolveImageUrl` as public pages (host pass-through is the known [[image-ref-scheme-allowlist-is-whitespace-bypassable]] issue, not new).

VEN-400 (2026-09-15) PASS on the same terms: `GET /admin/customers/:userId` (role='customer' filter, closed accounts included, hidden/private review content), and booking detail's notifications via `data->>'bookingId'`/`'bookingRequestId'` bound params, ANDed with `userId IN (customer, vendor owner)`. Dropping that `inArray` is the finding.

**Why:** notifications project `title` only; titles are fixed strings ('New message'), and no message text is read.

**How to apply:** if the projection widens to notification `body`/`data`, or locks start carrying request `message`, that is a staff read of private text that bypasses [[conversation-read-grant-is-an-open-case-row]]; treat it as a finding.
