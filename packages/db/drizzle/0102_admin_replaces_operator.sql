-- allow-destructive: renames only, and the account holder ruled the release still serving out of scope (zero real users; old data is cleared after this deploy). Nothing is dropped, retyped or narrowed.
-- VEN-697: the persisted vocabulary says "admin", as the product does since VEN-696.
--
-- Every statement is a rename; nothing is dropped, retyped or rewritten, so rows,
-- grants, RLS policies and indexes keep pointing at the same objects. There is no
-- expand/contract and no backfill of old rows: the deployment has no real users,
-- and the release that reads the old names is not kept running against this schema.
-- Drizzle cannot express enum-value, function or policy renames, so this file is
-- hand-written; the snapshot beside it is the generated one for the renamed schema.

-- Audit actions written by the admin-access paths (0047, 0075).
ALTER TYPE "public"."admin_action" RENAME VALUE 'operator_account_closed' TO 'admin_account_closed';--> statement-breakpoint
ALTER TYPE "public"."admin_action" RENAME VALUE 'operator_granted' TO 'admin_granted';--> statement-breakpoint
ALTER TYPE "public"."admin_action" RENAME VALUE 'operator_revoked' TO 'admin_revoked';--> statement-breakpoint

-- Alert log (0043 and the value extensions since).
ALTER TYPE "public"."operator_alert_kind" RENAME TO "admin_alert_kind";--> statement-breakpoint
ALTER TYPE "public"."operator_alert_outcome" RENAME TO "admin_alert_outcome";--> statement-breakpoint
ALTER TABLE "operator_alerts" RENAME TO "admin_alerts";--> statement-breakpoint
ALTER INDEX "operator_alerts_pkey" RENAME TO "admin_alerts_pkey";--> statement-breakpoint
ALTER INDEX "operator_alerts_kind_subject_sent_at_idx" RENAME TO "admin_alerts_kind_subject_sent_at_idx";--> statement-breakpoint
ALTER INDEX "operator_alerts_digest_date_key" RENAME TO "admin_alerts_digest_date_key";--> statement-breakpoint

-- The messages read policy for admins (0061). The policy follows the function by
-- OID, so the rename does not touch what it allows; the body is replaced only to
-- read the renamed GUC, and still requires `app.role = 'admin'` as well.
ALTER FUNCTION "public"."app_is_operator"() RENAME TO "app_is_admin";--> statement-breakpoint
CREATE OR REPLACE FUNCTION "public"."app_is_admin"() RETURNS boolean LANGUAGE sql STABLE AS $$ select coalesce(current_setting('app.admin', true), '') = 'true' and coalesce(current_setting('app.role', true), '') = 'admin' $$;--> statement-breakpoint
ALTER POLICY "messages_operator_select" ON "messages" RENAME TO "messages_admin_select";--> statement-breakpoint

-- The users.role guard (0069): same predicate and error code, renamed GUC and message.
CREATE OR REPLACE FUNCTION users_role_change_guard() RETURNS trigger
  SET search_path = pg_catalog, public
AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role
     AND coalesce(current_setting('app.admin_role_grant', true), '') <> 'on'
  THEN
    RAISE EXCEPTION 'users.role can only change through the admin grant path'
      USING ERRCODE = 'restrict_violation';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
