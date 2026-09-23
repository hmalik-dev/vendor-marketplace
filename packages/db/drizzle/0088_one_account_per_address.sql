-- allow-destructive: each DROP is replaced in this same migration: the email index by one on lower(email), and the four foreign keys by the same columns with ON DELETE restrict instead of cascade. No data is removed, and the release still serving never hard-deletes a user, so it cannot tell the difference.
ALTER TYPE "public"."operator_alert_kind" ADD VALUE 'auth_identity_kept' BEFORE 'daily_digest';--> statement-breakpoint
ALTER TABLE "conversations" DROP CONSTRAINT "conversations_customer_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "messages" DROP CONSTRAINT "messages_sender_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "review_tombstones" DROP CONSTRAINT "review_tombstones_reviewer_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "reviews" DROP CONSTRAINT "reviews_reviewer_id_users_id_fk";
--> statement-breakpoint
DROP INDEX "users_email_key";--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_customer_id_users_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_tombstones" ADD CONSTRAINT "review_tombstones_reviewer_id_users_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_reviewer_id_users_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_key" ON "users" USING btree (lower("email")) WHERE "users"."deleted_at" is null;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_email_lowercase" CHECK ("users"."email" = lower("users"."email"));