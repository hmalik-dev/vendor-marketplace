ALTER TABLE "users" ADD COLUMN "pending_email" varchar(255);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "email_sync_failed_at" timestamp with time zone;