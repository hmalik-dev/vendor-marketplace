CREATE TYPE "public"."vendor_application_status" AS ENUM('new', 'invited', 'declined');--> statement-breakpoint
ALTER TYPE "public"."admin_action" ADD VALUE 'vendor_invited';--> statement-breakpoint
ALTER TYPE "public"."admin_action" ADD VALUE 'vendor_invite_revoked';--> statement-breakpoint
ALTER TYPE "public"."admin_action" ADD VALUE 'vendor_application_declined';--> statement-breakpoint
ALTER TYPE "public"."admin_action_subject" ADD VALUE 'vendor_invite';--> statement-breakpoint
ALTER TYPE "public"."admin_action_subject" ADD VALUE 'vendor_application';--> statement-breakpoint
CREATE TABLE "vendor_applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"business_name" varchar(100) NOT NULL,
	"category" varchar(100) NOT NULL,
	"city" varchar(100) NOT NULL,
	"message" text NOT NULL,
	"status" "vendor_application_status" DEFAULT 'new' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "vendor_applications_email_lowercase" CHECK ("vendor_applications"."email" = lower("vendor_applications"."email"))
);
--> statement-breakpoint
CREATE TABLE "vendor_invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"invited_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"accepted_at" timestamp with time zone,
	CONSTRAINT "vendor_invites_email_lowercase" CHECK ("vendor_invites"."email" = lower("vendor_invites"."email"))
);
--> statement-breakpoint
ALTER TABLE "platform_settings" ADD COLUMN "vendor_invite_only" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "vendor_invites" ADD CONSTRAINT "vendor_invites_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "vendor_applications_email_key" ON "vendor_applications" USING btree ("email");--> statement-breakpoint
CREATE INDEX "vendor_applications_created_at_idx" ON "vendor_applications" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "vendor_invites_email_key" ON "vendor_invites" USING btree ("email");