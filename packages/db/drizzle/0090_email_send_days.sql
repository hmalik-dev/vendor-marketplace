CREATE TABLE "email_send_days" (
	"day" date PRIMARY KEY NOT NULL,
	"sent" integer DEFAULT 0 NOT NULL,
	"closed_reason" text,
	"closed_at" timestamp with time zone,
	CONSTRAINT "email_send_days_closed_reason_known" CHECK ("email_send_days"."closed_reason" IS NULL OR "email_send_days"."closed_reason" IN ('cap', 'quota'))
);
--> statement-breakpoint
ALTER TABLE "email_send_days" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "app_api_unscoped" ON "email_send_days" TO "app_api" USING (true) WITH CHECK (true);