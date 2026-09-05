-- Clears the way for `tag_suggestions_pending_key` in the migration after this
-- one. A unique index cannot be created over rows that already violate it, so
-- a database carrying duplicates would fail the deploy rather than the insert.
--
-- The duplicates are real and expected: `createTagSuggestion` deduped with a
-- read and then inserted with nothing between the two statements, so two
-- vendors suggesting the same tag at once both looked, both found nothing, and
-- both wrote (#399).
--
-- The oldest pending row for each idea survives, because it is the one the
-- admin queue has been showing and the one whose `created_at` orders that
-- queue.
--
-- **What deleting the rest actually discards, stated rather than waved past.**
-- A pending row carries no *decision* — `resolved_tag_id` and `admin_note` are
-- both null until an operator acts — but it does carry its **submitter**, and
-- that is not inert: resolving a suggestion calls `assignTagToVendor` for the
-- vendor who filed it and mails them "it has been added to your profile"
-- (`admin.service.ts`, the `approve` and `merge` branches). So a deleted loser
-- is a vendor who asked for a tag, will not receive it on their profile, and
-- will not be told.
--
-- Accepted here for two reasons, both checked rather than assumed. The forward
-- behaviour was already this: the read-based dedupe answered `already_suggested`
-- to the second vendor whenever they arrived after the first commit, so that
-- assignment was never reliable. And **no database this repository can reach
-- holds such a row** — the local Postgres reports zero duplicate pending groups,
-- and the deployed API has been down since before the feature shipped.
--
-- If a duplicate is ever found in a real database, do not run this as written:
-- resolve the losers against the survivor's tag instead, so their submitters
-- keep the assignment. Marking them `rejected` is not that — it would tell a
-- vendor their idea was turned down while it is still in front of an operator.
--
-- Scoped to `pending`, matching the index: settled rows are history and may
-- legitimately repeat, because rejecting an idea must not stop anyone raising
-- it again later.
DELETE FROM tag_suggestions t
 WHERE t.status = 'pending'
   AND EXISTS (
     SELECT 1
       FROM tag_suggestions keep
      WHERE keep.status = 'pending'
        AND keep.category = t.category
        AND lower(keep.suggested_name) = lower(t.suggested_name)
        AND (keep.created_at, keep.id) < (t.created_at, t.id)
   );
