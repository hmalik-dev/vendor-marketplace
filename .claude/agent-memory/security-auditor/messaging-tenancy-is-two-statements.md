---
name: messaging-tenancy-is-two-statements
description: Conversation tenancy moved out of the SQL predicate into JS (#402) — the vendor arm is now an inArray of ids fetched by a separate statement, and the preview subquery is hand-written SQL that only correlates because drizzle leaves the outer table unaliased
metadata:
  type: project
---

`findConversationsFor` (`apps/api/src/modules/messaging/messaging.dao.ts`) no
longer decides tenancy in one predicate. Since #402 it runs
`select id from vendor_profiles where user_id = $1` first and then filters
`or(customerId = user, inArray(conversations.vendorId, ownedIds))`, with an
explicit `ownedIds.length === 0` branch that drops the vendor arm entirely.
`findLastMessagePreviews` is a hand-written correlated subquery
(`where newest.conversation_id = conversations.id`) whose ids come from that
first query's result.

**Why:** the old `customer_id = $1 OR vendor_profiles.user_id = $1` spanned two
tables, so it used neither index and sequentially scanned every conversation on
the platform. The rewrite is a measured plan change, not a style change — do not
"simplify" it back into one predicate.

**How to apply:** two invariants carry the authorization now, and neither is
visible in the SQL.

- The vendor arm is only as tight as `ownedIds`. Anything that widens that first
  query (a join, a soft-delete arm dropped, an id list passed in by a caller)
  widens who can read whose threads, with no change to the visible `where`.
- `findLastMessagePreviews` correlates only because drizzle renders the outer
  table as bare `"conversations"`. Verified by rendering it through `PgDialect`:
  `previewLength` and the id list are bound parameters, and the subquery scope
  holds only `messages as newest`. Alias the outer table, or call the DAO with
  ids that did not come from `findConversationsFor`, and the scoping is gone.

The negative case for the vendor arm is held by `does not list another vendor
thread to a vendor who has their own profile` (`messaging.routes.test.ts`),
added in #402 after this was flagged. It gives `OTHER_VENDOR` a real profile
first, on purpose: the older `does not list a conversation the caller is not in`
uses `OUTSIDER`, a customer with no vendor profile, and therefore exercises only
the `ownedIds.length === 0` branch. Any further test here must do the same or it
re-tests the empty branch. Verified to fail when the `user_id` filter is dropped
from the first statement. See [[booking-reads-gate-on-two-separate-paths]] for
the same shape elsewhere.

`POST /conversations` is `requireRole('customer')` as of #402; rows written
before that where `customer_id` belongs to a vendor or admin account are still
readable and writable by it, because every other messaging route gates on
participation, not role. The guard is forward-only by design — no data
migration was written, because
`select count(*) from conversations c join users u on u.id = c.customer_id
where u.role <> 'customer'` is 0 and the product has never been launched. Re-run
that count before any deployment that predates #402.
