CREATE TYPE "public"."operator_alert_kind" AS ENUM('dispute_opened', 'payout_failed', 'refund_failed', 'stripe_webhook_failing', 'vendor_payouts_disabled', 'report_filed', 'launch_switch_flipped', 'daily_digest');--> statement-breakpoint
CREATE TYPE "public"."operator_alert_outcome" AS ENUM('sent', 'logged', 'skipped');--> statement-breakpoint
CREATE TABLE "operator_alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" "operator_alert_kind" NOT NULL,
	"subject_id" text NOT NULL,
	"outcome" "operator_alert_outcome" NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "operator_alerts_kind_subject_sent_at_idx" ON "operator_alerts" USING btree ("kind","subject_id","sent_at");--> statement-breakpoint
CREATE UNIQUE INDEX "operator_alerts_digest_date_key" ON "operator_alerts" USING btree ("subject_id") WHERE "operator_alerts"."kind" = 'daily_digest';