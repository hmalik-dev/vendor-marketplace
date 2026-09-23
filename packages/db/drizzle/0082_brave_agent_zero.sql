CREATE TABLE "vendor_slug_aliases" (
	"slug" varchar(200) PRIMARY KEY NOT NULL,
	"vendor_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "vendor_slug_aliases" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "vendor_slug_aliases" ADD CONSTRAINT "vendor_slug_aliases_vendor_id_vendor_profiles_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendor_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "vendor_slug_aliases_vendor_id_idx" ON "vendor_slug_aliases" USING btree ("vendor_id");