CREATE TYPE "public"."legal_acceptance_method" AS ENUM('clickwrap_checkbox', 'seed_fixture');--> statement-breakpoint
ALTER TABLE "legal_acceptances" ALTER COLUMN "vendor_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "legal_acceptances" ALTER COLUMN "business_name" DROP NOT NULL;--> statement-breakpoint
--
-- The two new columns are NOT NULL, and this table already holds rows.
--
-- They arrive with a DDL default that is then dropped, rather than with an
-- `UPDATE` backfill, and that is not a style choice: the immutability trigger
-- installed by `0029` refuses every `UPDATE` on this table, so a backfill
-- statement would fail. `ADD COLUMN ... DEFAULT` is DDL — it fills the existing
-- rows without firing a row trigger — and dropping the default afterwards
-- leaves every *future* writer obliged to state both values.
--
-- **The defaults are true of the rows they land on, not convenient.** At `0029`
-- this table had exactly two writers, and `terms_of_service` had none:
--
--   * `POST /vendor/agreement/accept`, whose screen has always been an unticked
--     checkbox naming the business, disabled until it is ticked — clickwrap.
--   * `db:seed:e2e`, whose rows are fixture data in disposable lane databases.
--
-- Both accepted `vendor-agreement.md`, whose bytes have not changed since
-- `0029` landed, so the hash below is the hash of what they actually read. The
-- seeded rows are the one imprecision: they are labelled `clickwrap_checkbox`
-- where `seed_fixture` would be exact. They exist only in development
-- databases that are re-seeded on every `lane:up`, and the seed writes
-- `seed_fixture` from here on.
--
ALTER TABLE "legal_acceptances" ADD COLUMN "document_sha256" varchar(64) NOT NULL DEFAULT 'f32236c9778dc6a20818fe74fb150ee9e7159b2519253b6686185fd6c60249f2';--> statement-breakpoint
ALTER TABLE "legal_acceptances" ALTER COLUMN "document_sha256" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "legal_acceptances" ADD COLUMN "acceptance_method" "legal_acceptance_method" NOT NULL DEFAULT 'clickwrap_checkbox';--> statement-breakpoint
ALTER TABLE "legal_acceptances" ALTER COLUMN "acceptance_method" DROP DEFAULT;--> statement-breakpoint
CREATE INDEX "legal_acceptances_user_document_idx" ON "legal_acceptances" USING btree ("accepted_by_user_id","document","accepted_at" DESC NULLS LAST);--> statement-breakpoint
--
-- The delete rule has to move with the anchor, and it is not optional.
--
-- `0029` allowed exactly one delete: the cascade from erasing the vendor, keyed
-- on `NOT EXISTS (the vendor named by OLD.vendor_id)`. With `vendor_id` now
-- nullable that predicate is **true for every Terms row**, because no vendor is
-- named by a null — so leaving the function alone would have made every
-- customer's acceptance freely deletable by anyone with a psql prompt, silently,
-- as a side effect of a column becoming nullable. That is the precise failure
-- this migration exists to avoid.
--
-- The replacement asks the question the row is now about: **is the person this
-- acceptance is about still here.** Two branches, each one question:
--
--   1. The accepting user is gone. This is the users cascade, and it is
--      *required* rather than permitted: `accepted_by_user_id` is `ON DELETE
--      CASCADE`, so refusing here would make erasing an account impossible
--      rather than making the record safer. Every writer sets this column to
--      the person who ticked the box.
--   2. The row names a vendor profile and that profile is gone. The cascade
--      `0029` built for, unchanged in behaviour for vendor-agreement rows, and
--      unreachable for a Terms row because `OLD.vendor_id IS NOT NULL` gates it.
--
-- `0029` reached branch 1 through a JOIN to `vendor_profiles.user_id` — the
-- vendor's *owner* — rather than through the accepting user, to close a hole
-- where an acceptance made by somebody other than the owner became deletable
-- while the vendor traded. That hole cannot be reached from the product: both
-- writers resolve the vendor profile *from* the accepting user, so acceptor and
-- owner are the same person. Keying on the acceptor is what makes the rule
-- state one thing and check that thing.
--
-- A direct DELETE still has both parents present and is still refused, which is
-- the tampering shape the table exists to make impossible.
--
-- `SET search_path` is carried over verbatim and is load-bearing for the same
-- reason it was in `0029`: without it, a role that can `CREATE SCHEMA` plants an
-- empty shadow `users` table and every `NOT EXISTS` above waves the delete
-- through. The tests reproduce that rather than reasoning about it.
--
CREATE OR REPLACE FUNCTION legal_acceptances_are_immutable() RETURNS trigger
  SET search_path = pg_catalog, public
AS $$
BEGIN
  IF TG_OP = 'DELETE'
     AND (
       NOT EXISTS (
         SELECT 1 FROM public.users u WHERE u.id = OLD.accepted_by_user_id
       )
       OR (
         OLD.vendor_id IS NOT NULL
         AND NOT EXISTS (
           SELECT 1 FROM public.vendor_profiles vp WHERE vp.id = OLD.vendor_id
         )
       )
     )
  THEN
    RETURN OLD;
  END IF;

  RAISE EXCEPTION 'legal_acceptances is append-only: % is not allowed', TG_OP
    USING ERRCODE = 'restrict_violation';
END;
$$ LANGUAGE plpgsql;
