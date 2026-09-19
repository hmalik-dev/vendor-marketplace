CREATE TABLE "stripe_webhook_failures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"failure" text NOT NULL,
	"failed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "stripe_webhook_failures_failure_failed_at_idx" ON "stripe_webhook_failures" USING btree ("failure","failed_at");