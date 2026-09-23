CREATE TYPE "public"."booking_event_subject" AS ENUM('booking_request', 'booking');--> statement-breakpoint
CREATE TABLE "booking_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subject_type" "booking_event_subject" NOT NULL,
	"subject_id" uuid NOT NULL,
	"from_status" varchar(32),
	"to_status" varchar(32) NOT NULL,
	"actor_user_id" uuid,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"payload" jsonb
);
--> statement-breakpoint
ALTER TABLE "booking_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "booking_requests" ADD COLUMN "package_snapshot" jsonb;--> statement-breakpoint
ALTER TABLE "booking_requests" ADD COLUMN "event_timezone" varchar(64);--> statement-breakpoint
ALTER TABLE "booking_requests" ADD COLUMN "currency" char(3) DEFAULT 'USD' NOT NULL;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "full_refund_cutoff_hours" integer DEFAULT 48 NOT NULL;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "late_refund_rate_bps" integer DEFAULT 5000 NOT NULL;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "event_timezone" varchar(64);--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "currency" char(3) DEFAULT 'USD' NOT NULL;--> statement-breakpoint
CREATE INDEX "booking_events_subject_idx" ON "booking_events" USING btree ("subject_id","at");--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_full_refund_cutoff_hours_non_negative" CHECK ("bookings"."full_refund_cutoff_hours" >= 0);--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_late_refund_rate_bps_range" CHECK ("bookings"."late_refund_rate_bps" >= 0 AND "bookings"."late_refund_rate_bps" <= 10000);