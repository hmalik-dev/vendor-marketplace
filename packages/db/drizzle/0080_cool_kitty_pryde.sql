ALTER TABLE "vendor_applications" ADD COLUMN "confirmation_email_attempts" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "vendor_applications" ADD COLUMN "confirmation_email_last_attempt_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "vendor_applications" ADD COLUMN "confirmation_email_sent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "vendor_applications" ADD COLUMN "confirmation_email_failure_reason" varchar(500);