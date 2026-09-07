CREATE TYPE "public"."support_case_origin" AS ENUM('support_message', 'chargeback');--> statement-breakpoint
CREATE TYPE "public"."support_case_status" AS ENUM('open', 'resolved');--> statement-breakpoint
CREATE TYPE "public"."support_topic" AS ENUM('something-broke', 'booking-or-payment', 'vendor-profile', 'trust-and-safety', 'something-else');--> statement-breakpoint
ALTER TYPE "public"."admin_action" ADD VALUE 'support_case_resolved';--> statement-breakpoint
ALTER TYPE "public"."admin_action_subject" ADD VALUE 'support_case';--> statement-breakpoint
CREATE TABLE "support_cases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reference" text NOT NULL,
	"origin" "support_case_origin" NOT NULL,
	"status" "support_case_status" DEFAULT 'open' NOT NULL,
	"topic" "support_topic",
	"sender_user_id" uuid,
	"sender_email" text,
	"message" text NOT NULL,
	"booking_id" uuid,
	"stripe_dispute_id" text,
	"hold_refusal" text,
	"email_failed_at" timestamp with time zone,
	"network_outcome" text,
	"resolved_by" uuid,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "support_cases_reference_unique" UNIQUE("reference"),
	CONSTRAINT "support_cases_stripe_dispute_id_unique" UNIQUE("stripe_dispute_id")
);
--> statement-breakpoint
ALTER TABLE "support_cases" ADD CONSTRAINT "support_cases_sender_user_id_users_id_fk" FOREIGN KEY ("sender_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_cases" ADD CONSTRAINT "support_cases_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_cases" ADD CONSTRAINT "support_cases_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "support_cases_status_created_at_idx" ON "support_cases" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "support_cases_booking_idx" ON "support_cases" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "bookings_payment_intent_idx" ON "bookings" USING btree ("stripe_payment_intent_id");