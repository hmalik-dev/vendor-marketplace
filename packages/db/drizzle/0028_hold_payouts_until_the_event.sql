CREATE TYPE "public"."payout_model" AS ENUM('destination', 'separate');--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "payout_model" "payout_model" DEFAULT 'destination' NOT NULL;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "payout_released_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "payout_attempts" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "payout_failure_reason" text;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "dispute_reason" text;--> statement-breakpoint
CREATE INDEX "bookings_payout_due_idx" ON "bookings" USING btree ("event_date") WHERE "bookings"."payout_released_at" is null and "bookings"."payout_model" = 'separate' and "bookings"."vendor_payout_cents" > 0;--> statement-breakpoint
--
-- Backfill: every booking that already exists was paid by a DESTINATION charge.
--
-- The DDL above is generated; this statement is not, and it is the half that
-- matters. Every row written before #423 was paid through `transfer_data`, so
-- Stripe moved the vendor's share at the instant the card succeeded. Recording
-- that is what stops the payout sweep transferring all of it a second time.
--
-- **`payout_model` is the guard, and it needs no backfill at all** — its
-- default is `destination` and only `recordSuccessfulPayment` writes
-- `separate`, so a legacy row identifies itself, and so does one written by the
-- *old image* during the deploy window between this migration and the new code
-- serving. That window is the case a backfill alone cannot reach, because those
-- rows do not exist yet when it runs.
--
-- This statement is therefore the honest record rather than the guard: the
-- money was released, and it was released when it was paid, which is why
-- `paid_at` is the timestamp rather than `now()`. `stripe_transfer_id` stays
-- null on purpose — a destination charge has no transfer object, which is
-- exactly what that column's comment recorded for its whole life until now.
--
-- That pair, released with no transfer id, is named as
-- `isLegacyDestinationPayout` rather than left as a shape to re-derive.
-- `refundAndUnwind` and the ban unwind both refuse such a row instead of
-- refunding it: the vendor has already been paid, so a refund with nothing
-- reversed would return the customer's money AND leave the vendor holding their
-- share. Those cancellations need an operator. A refusal rather than a second
-- unwind path, because there are no such rows in production to serve — no
-- production Stripe credentials have been minted at all (#362) — and a
-- dual-mode refund carried forever on the money path is a worse thing to own
-- than a loud stop.
UPDATE "bookings"
SET "payout_released_at" = coalesce("paid_at", "created_at")
WHERE "status" <> 'cancelled' AND "payout_released_at" IS NULL;