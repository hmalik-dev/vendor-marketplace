---
name: review-checklist-viewer-anchor-vs-the-read-behind-it
description: When a diff moves a client surface onto the viewer's clock, check every server read that feeds it moved too — an absent row usually means a permissive default, so a narrowed window reads as a positive claim rather than a gap
metadata:
  type: feedback
---

When a diff re-anchors a rendered value on something the **client** knows and
the server does not — the viewer's day, their locale, their zone — walk every
server read that feeds that surface and ask whether its own bounds moved with
it. A window narrowed against the old anchor does not show a gap under the new
one; it shows the collection's **default**.

**Why:** #409 moved six surfaces onto the viewer's day and widened the vendor's
own availability window to match. `getPublicVendorAvailability` was left on
`toDateString(now)`, the server's UTC day. West of UTC the visitor's day is the
day before, so a `blocked` row on it fell outside the response — and because an
absent availability row **means available**, the customer was not shown a hole.
They were shown a vendor who was free, on a day that vendor had closed, with the
request form saying "is free on this date". The read was not wrong before the
diff; the diff made it wrong by moving the thing that reads it.

I did report this one, and it is the cheap version of a class worth naming: the
rendering became viewer-aware and the data feeding it did not.

**How to apply:** for each surface a diff re-anchors, list the endpoints behind
it and compare their date/range bounds against the new anchor, not the old one.
Then ask what an **absent** row means in that collection. A sparse table with a
permissive default — availability, feature flags, overrides — turns a missing
row into a positive claim, so a bound that is one day, one page or one tenant
too narrow is a wrong answer rather than an empty one. Sparse-by-design
collections are where this bites; a dense one merely renders short.

See also [[review-checklist-status-filter-vs-webhook-idempotency]], which is the
same shape one layer down: narrowing a shared finder for one caller blinded a
second caller that depended on its old breadth.
