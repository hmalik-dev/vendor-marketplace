ALTER TYPE "public"."operator_alert_kind" ADD VALUE 'expiry_payment_unsettled' BEFORE 'refund_unrecorded';--> statement-breakpoint
ALTER TABLE "booking_requests" ADD COLUMN "expiry_check_attempts" integer;--> statement-breakpoint
ALTER TABLE "booking_requests" ADD COLUMN "expiry_last_attempt_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "booking_requests_expiry_sweep_order_idx" ON "booking_requests" USING btree ("expiry_last_attempt_at" asc nulls first,"expires_at") WHERE "booking_requests"."status" in ('pending', 'quoted', 'accepted');--> statement-breakpoint
ALTER TABLE "booking_requests" ADD CONSTRAINT "booking_requests_expiry_check_attempts_non_negative" CHECK ("booking_requests"."expiry_check_attempts" IS NULL OR "booking_requests"."expiry_check_attempts" >= 0);