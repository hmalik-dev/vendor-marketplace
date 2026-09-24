CREATE TYPE "public"."platform_notice_tone" AS ENUM('info', 'warning');--> statement-breakpoint
ALTER TABLE "platform_settings" ADD COLUMN "notice_message" text;--> statement-breakpoint
ALTER TABLE "platform_settings" ADD COLUMN "notice_tone" "platform_notice_tone" DEFAULT 'info' NOT NULL;--> statement-breakpoint
ALTER TABLE "platform_settings" ADD CONSTRAINT "platform_settings_notice_message_length" CHECK ("platform_settings"."notice_message" IS NULL OR char_length("platform_settings"."notice_message") BETWEEN 1 AND 280);