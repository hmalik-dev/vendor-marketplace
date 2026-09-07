ALTER TYPE "public"."admin_action" ADD VALUE 'payout_retried';--> statement-breakpoint
ALTER TABLE "vendor_profiles" ADD COLUMN "stripe_disabled_reason" text;--> statement-breakpoint
ALTER TABLE "vendor_profiles" ADD COLUMN "stripe_requirements_due" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
CREATE INDEX "bookings_payout_failing_idx" ON "bookings" USING btree ("paid_at" DESC NULLS FIRST) WHERE "bookings"."paid_at" is not null and "bookings"."payout_released_at" is null and "bookings"."payout_attempts" > 0;