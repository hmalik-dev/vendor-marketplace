ALTER TABLE "bookings" ADD COLUMN "payout_released_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "payout_attempts" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "payout_failure_reason" text;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "dispute_reason" text;--> statement-breakpoint
CREATE INDEX "bookings_payout_due_idx" ON "bookings" USING btree ("event_date") WHERE "bookings"."payout_released_at" is null and "bookings"."status" <> 'cancelled';--> statement-breakpoint
--
-- Backfill: every booking that already exists was paid by a DESTINATION charge.
--
-- The DDL above is generated; this statement is not, and it is the half that
-- matters. `payout_released_at` defaults to null, and the #423 sweep reads null
-- as "this vendor has not been paid". Every row written before this migration
-- was paid through `transfer_data`, so Stripe moved the vendor's share at the
-- instant the card succeeded — and on the first tick after deploy the sweep
-- would transfer all of it a second time, out of the platform's balance, for
-- every past booking on the platform at once.
--
-- Marking them released is the true statement: the money was released, and it
-- was released when it was paid, which is why `paid_at` is the timestamp rather
-- than `now()`. `stripe_transfer_id` is left null on purpose — there is no
-- transfer object for a destination charge, which is exactly what that column's
-- comment recorded for its whole life until now.
--
-- That pair, released with no transfer id, is what identifies a legacy row
-- afterwards, and it is named rather than left to be re-derived:
-- `isLegacyDestinationPayout` in `packages/shared`. `refundAndUnwind` calls it
-- and refuses to refund one, rather than issuing the plain refund the new model
-- calls for: the vendor has already been paid, so a refund with nothing
-- reversed would return the customer's money AND leave the vendor holding their
-- share. Those cancellations need an operator. It is a refusal rather than a
-- second unwind path because there are no such rows in production to serve — no
-- production Stripe credentials have been minted at all (#362) — and a
-- dual-mode refund carried forever on the money path is a worse thing to own
-- than a loud stop.
UPDATE "bookings"
SET "payout_released_at" = coalesce("paid_at", "created_at")
WHERE "status" <> 'cancelled' AND "payout_released_at" IS NULL;