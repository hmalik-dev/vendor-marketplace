---
name: closed-accounts-are-listed-not-scrubbed
description: Closure only sets users.deleted_at — name/email survive intact — and #450 lists those rows in the console behind status=closed; the six deleted_at reads are a settled census
metadata:
  type: project
---

`retireUserWhere` in `apps/api/src/modules/users/users.dao.ts` sets `deleted_at`
(and takes the storefront down) and **scrubs nothing**: a closed account keeps
`email`, `first_name`, `last_name`, `city`, `state`, `total_bookings_count`.
So "closed" is a visibility decision at every read site, never an absence of
data.

`apps/api/src/modules/admin/admin.dao.ts` carries a **census comment** (added by
#450, above the module body) listing the six `deleted_at` reads and the ruling
at each:

- `RETIRED`/`NOT_RETIRED` (vendors list) — closed rows **listed** as `retired` (#433)
- `findUserById` (the lookup behind `setUserBanned` / `setVendorPublished`) — **excluded** on purpose; widening it turns a clean 404 into a meaningless write
- `customerCondition` (customers list) — **listed only behind `status=closed`** (#450); absent `status` still means live accounts
- `refundStuck` — closed rows **included**, because a closure strands money the way a ban does
- `findAdminMetricTotals`' `Users` card and `findAdminMetricSeries`' signups line — **excluded**, and they must stay the same set as each other

**Why:** every one of these was written when only a Clerk webhook could set the
column, so "excluded" meant "cannot happen". Closure (#438) made all six real
decisions. The pattern the census states: _a list an operator navigates shows
closed accounts; a count claiming a present-tense fact does not; a lookup behind
a write does not._

**How to apply:** do not re-report the metric exclusions or the `findUserById`
exclusion — they are settled and reasoned in place. Do audit any **new** read of
`users` in the admin module against the census, and audit any surface that
starts offering a _control_ on a customer row: the customers table is
deliberately links-only (name → `/admin/users/[userId]`), and adding a ban or
publish action there would route a closed row into `findUserById` and 404.

Two related facts an audit here keeps rediscovering:

- The retention itself is **not** described by `apps/web/content/legal/privacy.md`
  (~line 46), which says "two things survive" closure — the payment/booking
  records and the legal-acceptance record — and does not mention that the
  account record's name and email survive too and are readable by operators.
  Raised as an observation on #450, not a blocker: the retention predates the
  diff and `/admin/users/[userId]` already displayed both fields for a closed
  account. It is a copy question for the product, not a code fix.
- `users_email_key` is partial (see [[email-uniqueness-is-partial-nothing-joins-by-email]]),
  so a closed account's address can be re-registered and the customers list can
  legitimately show two rows with one email — different `id`s, different status.

See also [[closure-deletes-the-clerk-identity]],
[[legal-acceptance-record-is-undeletable-pii]], [[closure-refuses-only-the-customer-side]].
