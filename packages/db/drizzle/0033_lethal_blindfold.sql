CREATE TYPE "public"."email_delivery_entity" AS ENUM('booking_request', 'booking');--> statement-breakpoint
CREATE TYPE "public"."email_delivery_outcome" AS ENUM('sent', 'failed', 'delivered', 'bounced', 'complained');--> statement-breakpoint
CREATE TABLE "email_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"notification_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"recipient_email" text NOT NULL,
	"notification_type" varchar(50) NOT NULL,
	"related_entity_type" "email_delivery_entity",
	"related_entity_id" uuid,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	"outcome" "email_delivery_outcome" NOT NULL,
	"provider_message_id" text,
	"failure_reason" varchar(500),
	"outcome_updated_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "email_deliveries" ADD CONSTRAINT "email_deliveries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "email_deliveries_provider_message_id_idx" ON "email_deliveries" USING btree ("provider_message_id") WHERE "email_deliveries"."provider_message_id" is not null;--> statement-breakpoint
CREATE INDEX "email_deliveries_user_idx" ON "email_deliveries" USING btree ("user_id","sent_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "email_deliveries_related_entity_idx" ON "email_deliveries" USING btree ("related_entity_id","related_entity_type","sent_at" DESC NULLS LAST) WHERE "email_deliveries"."related_entity_id" is not null;