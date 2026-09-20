ALTER TABLE "vendor_invites" ADD COLUMN "email_attempts" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "vendor_invites" ADD COLUMN "email_last_attempt_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "vendor_invites" ADD COLUMN "email_sent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "vendor_invites" ADD COLUMN "email_failure_reason" varchar(500);