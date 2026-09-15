ALTER TYPE "public"."admin_action" ADD VALUE 'platform_setting_changed';--> statement-breakpoint
ALTER TYPE "public"."admin_action" ADD VALUE 'vendor_payout_hold_set';--> statement-breakpoint
ALTER TYPE "public"."admin_action" ADD VALUE 'vendor_payout_hold_released';--> statement-breakpoint
ALTER TYPE "public"."admin_action_subject" ADD VALUE 'platform_settings';--> statement-breakpoint
CREATE TABLE "platform_settings" (
	"id" uuid PRIMARY KEY DEFAULT '00000000-0000-4000-8000-000000000001' NOT NULL,
	"booking_requests_paused" boolean DEFAULT false NOT NULL,
	"checkout_paused" boolean DEFAULT false NOT NULL,
	"payout_release_paused" boolean DEFAULT false NOT NULL,
	"max_booking_cents" integer,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "platform_settings_singleton" CHECK ("platform_settings"."id" = '00000000-0000-4000-8000-000000000001'),
	CONSTRAINT "platform_settings_max_booking_cents_positive" CHECK ("platform_settings"."max_booking_cents" IS NULL OR "platform_settings"."max_booking_cents" > 0)
);
--> statement-breakpoint
ALTER TABLE "vendor_profiles" ADD COLUMN "payout_hold" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "platform_settings" ADD CONSTRAINT "platform_settings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;