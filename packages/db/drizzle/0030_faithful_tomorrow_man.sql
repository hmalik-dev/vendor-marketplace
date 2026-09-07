CREATE TYPE "public"."admin_action" AS ENUM('user_banned', 'user_unbanned', 'review_deleted', 'tag_updated', 'tag_suggestion_resolved', 'dispute_resolved');--> statement-breakpoint
CREATE TYPE "public"."admin_action_subject" AS ENUM('user', 'review', 'tag', 'tag_suggestion', 'booking');--> statement-breakpoint
CREATE TABLE "admin_actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" uuid NOT NULL,
	"action" "admin_action" NOT NULL,
	"subject_type" "admin_action_subject" NOT NULL,
	"subject_id" uuid NOT NULL,
	"detail" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "admin_actions" ADD CONSTRAINT "admin_actions_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "admin_actions_created_at_idx" ON "admin_actions" USING btree ("created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "admin_actions_actor_idx" ON "admin_actions" USING btree ("actor_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "admin_actions_subject_idx" ON "admin_actions" USING btree ("subject_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "admin_actions_action_idx" ON "admin_actions" USING btree ("action","created_at" DESC NULLS LAST);--> statement-breakpoint
--
-- Immutability, enforced here rather than by a DAO that happens to have no
-- update method — the same rule `0029_sad_storm.sql` installs on
-- `legal_acceptances`, installed the same way, for the same reason.
--
-- The whole value of this table is that a row means what it meant when it was
-- written: which operator did what, to whom, and when. A record the console can
-- edit answers "who suspended this account" with whatever is convenient, which
-- is worth nothing in the review it exists for. Application code cannot carry
-- that rule — the writers are six service functions today, and this table will
-- outlive all of them.
--
-- **Every row is written by an INSERT and never touched again.** That is the
-- only supported way this table changes, and INSERT is deliberately left alone.
--
-- The DELETE rule is exact rather than absolute: a row may not be removed
-- **while the operator it is about still exists**. That refuses every tampering
-- shape — a direct DELETE, a tidy-up, a "just this one row" — while still
-- letting the cascade through when the whole account is erased, because a
-- recorded action with nobody behind it names nobody. Reliable because a
-- referential CASCADE deletes the parent first and fires the child delete
-- afterwards: during a cascade from `users` the actor is already gone, and a
-- direct DELETE against this table has the actor present and is refused.
--
-- In practice that cascade is unreachable from the product at all: a `users`
-- row here is **retired rather than removed** (`deleted_at`), precisely because
-- bookings, reviews and messages reference it. The exception exists so the rule
-- is exact, not because anything is expected to use it.
--
-- **`subject_id` deliberately has no foreign key**, which is the other half of
-- the same invariant. A review deletion whose audit row cascaded away with the
-- review would erase the only evidence the deletion ever happened — and the
-- subject is the thing most likely to be deleted next.
--
-- **`SET search_path` is load-bearing, not hygiene.**
--
-- A plain `CREATE FUNCTION` is `SECURITY INVOKER`, so unqualified names inside
-- it resolve against the *caller's* `search_path` at execution time. Without
-- this line the rule is defeated by three statements from any role that can
-- create a schema — which the application's own owning role can, on Neon and on
-- the Docker Postgres alike:
--
--     CREATE SCHEMA evil;
--     CREATE TABLE evil.users (id uuid);
--     SET search_path = evil, public;
--     DELETE FROM public.admin_actions;   -- every row, silently
--
-- The empty shadow table makes `NOT EXISTS` true for every row, so the guard
-- waves the delete through while the real operator is still serving. Pinning
-- the path is what makes the check read the table it names.
CREATE FUNCTION admin_actions_are_immutable() RETURNS trigger
  SET search_path = pg_catalog, public
AS $$
BEGIN
  IF TG_OP = 'DELETE'
     AND NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = OLD.actor_id)
  THEN
    RETURN OLD;
  END IF;

  RAISE EXCEPTION 'admin_actions is append-only: % is not allowed', TG_OP
    USING ERRCODE = 'restrict_violation';
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
--
-- TRUNCATE is a third shape, and a row trigger never sees it.
--
-- Both triggers below are `FOR EACH ROW`, so `TRUNCATE admin_actions` — or a
-- `TRUNCATE ... CASCADE` that reaches it — would empty the table without the
-- function running once. That is precisely the threat this rule is written for:
-- somebody with a psql prompt tidying away the record of what they did.
-- Nothing in this repository truncates this table, so refusing it costs nothing
-- and closes the last way out.
CREATE FUNCTION admin_actions_no_truncate() RETURNS trigger
  SET search_path = pg_catalog, public
AS $$
BEGIN
  RAISE EXCEPTION 'admin_actions is append-only: TRUNCATE is not allowed'
    USING ERRCODE = 'restrict_violation';
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
CREATE TRIGGER admin_actions_no_update
  BEFORE UPDATE ON "admin_actions"
  FOR EACH ROW EXECUTE FUNCTION admin_actions_are_immutable();--> statement-breakpoint
CREATE TRIGGER admin_actions_no_delete
  BEFORE DELETE ON "admin_actions"
  FOR EACH ROW EXECUTE FUNCTION admin_actions_are_immutable();--> statement-breakpoint
CREATE TRIGGER admin_actions_no_truncate
  BEFORE TRUNCATE ON "admin_actions"
  FOR EACH STATEMENT EXECUTE FUNCTION admin_actions_no_truncate();
