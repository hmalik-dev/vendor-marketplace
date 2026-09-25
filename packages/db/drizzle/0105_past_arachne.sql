CREATE TYPE "public"."backup_withholding_reason" AS ENUM('missing_tin', 'irs_notice');--> statement-breakpoint
ALTER TYPE "public"."admin_action" ADD VALUE 'vendor_backup_withholding_set';--> statement-breakpoint
ALTER TYPE "public"."admin_action" ADD VALUE 'vendor_backup_withholding_cleared';--> statement-breakpoint
ALTER TYPE "public"."admin_action" ADD VALUE 'backup_withholding_withheld';--> statement-breakpoint
ALTER TABLE "vendor_profiles" ADD COLUMN "backup_withholding_reason" "backup_withholding_reason";--> statement-breakpoint
ALTER TABLE "vendor_profiles" ADD COLUMN "backup_withholding_notice_date" date;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "backup_withheld_cents" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "vendor_profiles" ADD CONSTRAINT "vendor_profiles_backup_withholding_pair" CHECK (("vendor_profiles"."backup_withholding_reason" IS NULL) = ("vendor_profiles"."backup_withholding_notice_date" IS NULL));--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_backup_withheld_cents_non_negative" CHECK ("bookings"."backup_withheld_cents" >= 0);