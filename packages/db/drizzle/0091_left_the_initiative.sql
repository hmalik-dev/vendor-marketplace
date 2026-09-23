CREATE TABLE "rate_limit_counters" (
	"key" text PRIMARY KEY NOT NULL,
	"hits" integer NOT NULL,
	"window_ends_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "rate_limit_counters" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "realtime_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payload" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "realtime_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "step_up_challenges" (
	"admin_id" uuid PRIMARY KEY NOT NULL,
	"digest" text NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "step_up_challenges" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "step_up_grants" (
	"admin_id" uuid PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "step_up_grants" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "step_up_challenges" ADD CONSTRAINT "step_up_challenges_admin_id_users_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "step_up_grants" ADD CONSTRAINT "step_up_grants_admin_id_users_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "rate_limit_counters_window_ends_at_idx" ON "rate_limit_counters" USING btree ("window_ends_at");--> statement-breakpoint
CREATE INDEX "realtime_events_created_at_idx" ON "realtime_events" USING btree ("created_at");--> statement-breakpoint
CREATE POLICY "app_api_unscoped" ON "rate_limit_counters" TO "app_api" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "app_api_unscoped" ON "realtime_events" TO "app_api" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "app_api_unscoped" ON "step_up_challenges" TO "app_api" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "app_api_unscoped" ON "step_up_grants" TO "app_api" USING (true) WITH CHECK (true);
