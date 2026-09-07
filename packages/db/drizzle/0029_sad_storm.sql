CREATE TYPE "public"."legal_document" AS ENUM('vendor_agreement', 'terms_of_service');--> statement-breakpoint
CREATE TABLE "legal_acceptances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vendor_id" uuid NOT NULL,
	"document" "legal_document" NOT NULL,
	"version" varchar(20) NOT NULL,
	"accepted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"accepted_by_user_id" uuid NOT NULL,
	"accepted_by_name" varchar(200) NOT NULL,
	"business_name" varchar(200) NOT NULL,
	"ip" varchar(45),
	"user_agent" text
);
--> statement-breakpoint
ALTER TABLE "legal_acceptances" ADD CONSTRAINT "legal_acceptances_vendor_id_vendor_profiles_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendor_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_acceptances" ADD CONSTRAINT "legal_acceptances_accepted_by_user_id_users_id_fk" FOREIGN KEY ("accepted_by_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "legal_acceptances_vendor_document_idx" ON "legal_acceptances" USING btree ("vendor_id","document","accepted_at" DESC NULLS LAST);--> statement-breakpoint
--
-- Immutability, enforced here rather than by a DAO that happens to have no
-- update method.
--
-- The whole value of this table is that a row means what it meant when it was
-- written: who accepted which version of what, on whose behalf, and when. A
-- record that can be edited answers "which version did I agree to" with
-- whatever is convenient, which is worth nothing in the dispute it exists for.
-- Application code cannot carry that rule — the writers are a route and a seed
-- today, and this table will outlive both.
--
-- **A new version adds a row.** That is the only supported way this table
-- changes, and INSERT is deliberately left alone.
--
-- The DELETE rule is exact rather than absolute: a row may not be removed
-- **while the vendor it is about still exists**. That refuses every tampering
-- shape — a direct DELETE, a tidy-up, a "just this one row" — while still
-- letting the cascade through when the whole vendor account is erased, because
-- an acceptance with no vendor behind it records nothing about anybody.
--
-- **The discriminator is the vendor's own absence, and it is one condition.**
-- It was two — the vendor gone OR the accepting user gone — which is wider than
-- it needs to be: `accepted_by_user_id` is the person, and a row accepted by
-- somebody other than the profile's owner would then have become deletable
-- while the vendor was still trading. Joining through `vendor_profiles.user_id`
-- keeps the single question the rule is actually about, "is this vendor still
-- here", and answers it correctly on both cascade paths.
--
-- Reliable in either direction because a referential CASCADE deletes the parent
-- first and fires the child delete afterwards: during a cascade from
-- `vendor_profiles` the vendor row is already gone, and during a cascade from
-- `users` the owner is, which takes the vendor with it. A direct DELETE against
-- this table has the vendor present and is refused.
--
-- **`SET search_path` is load-bearing, not hygiene.**
--
-- A plain `CREATE FUNCTION` is `SECURITY INVOKER`, so unqualified names inside
-- it resolve against the *caller's* `search_path` at execution time. Without
-- this line the whole rule is defeated by three statements from any role that
-- can create a schema — which the application's own owning role can, on Neon
-- and on the Docker Postgres alike:
--
--     CREATE SCHEMA evil;
--     CREATE TABLE evil.vendor_profiles (id uuid);
--     SET search_path = evil, public;
--     DELETE FROM public.legal_acceptances;   -- every row, silently
--
-- The empty shadow table makes `NOT EXISTS` true for every row, so the guard
-- waves the delete through while the real vendor is still trading. Pinning the
-- path is what makes the check read the tables it names.
CREATE FUNCTION legal_acceptances_are_immutable() RETURNS trigger
  SET search_path = pg_catalog, public
AS $$
BEGIN
  IF TG_OP = 'DELETE'
     AND NOT EXISTS (
       SELECT 1 FROM public.vendor_profiles vp
       JOIN public.users u ON u.id = vp.user_id
       WHERE vp.id = OLD.vendor_id
     )
  THEN
    RETURN OLD;
  END IF;

  RAISE EXCEPTION 'legal_acceptances is append-only: % is not allowed', TG_OP
    USING ERRCODE = 'restrict_violation';
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
--
-- TRUNCATE is a third shape, and a row trigger never sees it.
--
-- Both triggers below are `FOR EACH ROW`, so `TRUNCATE legal_acceptances` — or
-- a `TRUNCATE ... CASCADE` that reaches it — would empty the table without the
-- function running once. That is precisely the threat this rule is written for:
-- somebody with a psql prompt tidying a record they would rather not have.
-- Nothing in this repository truncates this table, so refusing it costs
-- nothing and closes the last way out.
CREATE FUNCTION legal_acceptances_no_truncate() RETURNS trigger
  SET search_path = pg_catalog, public
AS $$
BEGIN
  RAISE EXCEPTION 'legal_acceptances is append-only: TRUNCATE is not allowed'
    USING ERRCODE = 'restrict_violation';
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
CREATE TRIGGER legal_acceptances_no_update
  BEFORE UPDATE ON "legal_acceptances"
  FOR EACH ROW EXECUTE FUNCTION legal_acceptances_are_immutable();--> statement-breakpoint
CREATE TRIGGER legal_acceptances_no_delete
  BEFORE DELETE ON "legal_acceptances"
  FOR EACH ROW EXECUTE FUNCTION legal_acceptances_are_immutable();--> statement-breakpoint
CREATE TRIGGER legal_acceptances_no_truncate
  BEFORE TRUNCATE ON "legal_acceptances"
  FOR EACH STATEMENT EXECUTE FUNCTION legal_acceptances_no_truncate();
