-- VEN-614: a closed account keeps its row and loses the person on it.
--
-- Closure now anonymises the row in the same transaction that sets
-- `deleted_at` (`closedAccountFields` in apps/api/src/modules/users). Accounts
-- closed before that still hold their real address, name, phone and profile
-- text, and nothing would ever revisit them: re-running a finished closure
-- answers 409. This applies the same scrub to them once, here, so the deploy
-- does it rather than a hand-run script.
--
-- Values match `closedAccountFields` exactly. The id, the role and every
-- foreign key stay, so bookings, payouts, refunds, reviews, messages and legal
-- acceptances keep pointing at the row. Safe for the release still serving:
-- it hides retired rows everywhere already, and its reviews read the name it
-- finds. Re-running changes nothing, because a scrubbed row is skipped.

UPDATE "users"
SET
  "email" = 'closed+' || "id"::text || '@invalid',
  "first_name" = 'Former ' || CASE WHEN "role" = 'admin' THEN 'operator' ELSE "role"::text END,
  "last_name" = '',
  "phone" = NULL,
  "avatar_url" = NULL,
  "bio" = NULL,
  "city" = NULL,
  "state" = NULL,
  "pending_email" = NULL,
  "email_sync_failed_at" = NULL,
  "updated_at" = now()
WHERE "deleted_at" IS NOT NULL
  AND "email" <> 'closed+' || "id"::text || '@invalid';
