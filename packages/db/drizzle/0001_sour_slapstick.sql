CREATE TYPE "public"."budget_tier" AS ENUM('budget', 'mid_range', 'premium', 'luxury');--> statement-breakpoint
CREATE TYPE "public"."tag_category" AS ENUM('language', 'cultural', 'religious_dietary');--> statement-breakpoint
CREATE TYPE "public"."tag_suggestion_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TABLE "tag_suggestions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vendor_id" uuid NOT NULL,
	"suggested_name" varchar(100) NOT NULL,
	"category" "tag_category" NOT NULL,
	"status" "tag_suggestion_status" DEFAULT 'pending' NOT NULL,
	"resolved_tag_id" uuid,
	"admin_note" varchar(500),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"slug" varchar(100) NOT NULL,
	"category" "tag_category" NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vendor_tags" (
	"vendor_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	CONSTRAINT "vendor_tags_vendor_id_tag_id_pk" PRIMARY KEY("vendor_id","tag_id")
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "bio" varchar(300);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "city" varchar(100);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "state" varchar(100);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "budget_tier" "budget_tier";--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "typical_guest_count_min" integer;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "typical_guest_count_max" integer;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "avg_customer_rating" numeric(3, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "customer_review_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "total_bookings_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "completed_bookings_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "cancelled_bookings_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "reviews" ADD COLUMN "is_public" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "tag_suggestions" ADD CONSTRAINT "tag_suggestions_vendor_id_users_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tag_suggestions" ADD CONSTRAINT "tag_suggestions_resolved_tag_id_tags_id_fk" FOREIGN KEY ("resolved_tag_id") REFERENCES "public"."tags"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_tags" ADD CONSTRAINT "vendor_tags_vendor_id_vendor_profiles_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendor_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_tags" ADD CONSTRAINT "vendor_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tag_suggestions_status_created_at_idx" ON "tag_suggestions" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "tag_suggestions_vendor_id_idx" ON "tag_suggestions" USING btree ("vendor_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tags_slug_key" ON "tags" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "tags_category_name_key" ON "tags" USING btree ("category","name");--> statement-breakpoint
CREATE INDEX "tags_category_display_order_idx" ON "tags" USING btree ("category","display_order") WHERE "tags"."is_active" = true;--> statement-breakpoint
CREATE INDEX "vendor_tags_tag_id_idx" ON "vendor_tags" USING btree ("tag_id");