ALTER TYPE "public"."support_case_origin" ADD VALUE 'fraud_warning';--> statement-breakpoint
ALTER TYPE "public"."operator_alert_kind" ADD VALUE 'early_fraud_warning' BEFORE 'payout_failed';--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "vendor_owed_cents" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_vendor_owed_cents_non_negative" CHECK ("bookings"."vendor_owed_cents" >= 0);