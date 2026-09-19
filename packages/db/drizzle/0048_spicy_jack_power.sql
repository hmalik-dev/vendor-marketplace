ALTER TABLE "users" RENAME COLUMN "clerk_user_id" TO "auth_user_id";--> statement-breakpoint
DROP INDEX "users_clerk_user_id_key";--> statement-breakpoint
CREATE UNIQUE INDEX "users_auth_user_id_key" ON "users" USING btree ("auth_user_id");