CREATE TYPE "public"."report_reason" AS ENUM('spam-or-scam', 'off-platform-payment', 'harassment', 'inappropriate-content', 'misleading-information', 'something-else');--> statement-breakpoint
CREATE TYPE "public"."report_subject" AS ENUM('vendor_profile', 'review', 'conversation', 'portfolio_item');--> statement-breakpoint
ALTER TYPE "public"."admin_action" ADD VALUE 'conversation_messages_read';--> statement-breakpoint
ALTER TYPE "public"."admin_action_subject" ADD VALUE 'conversation';--> statement-breakpoint
ALTER TYPE "public"."support_case_origin" ADD VALUE 'user_report';--> statement-breakpoint
ALTER TABLE "support_cases" ADD COLUMN "subject_type" "report_subject";--> statement-breakpoint
ALTER TABLE "support_cases" ADD COLUMN "subject_id" uuid;--> statement-breakpoint
ALTER TABLE "support_cases" ADD COLUMN "report_reason" "report_reason";--> statement-breakpoint
CREATE INDEX "support_cases_subject_idx" ON "support_cases" USING btree ("status","subject_type","subject_id");