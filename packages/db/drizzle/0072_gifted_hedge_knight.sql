CREATE TABLE "stream_tickets" (
	"fingerprint" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "stream_tickets" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "throttle_hits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bucket" text NOT NULL,
	"hit_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "throttle_hits" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "stream_tickets" ADD CONSTRAINT "stream_tickets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "stream_tickets_user_id_idx" ON "stream_tickets" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "throttle_hits_bucket_hit_at_idx" ON "throttle_hits" USING btree ("bucket","hit_at");