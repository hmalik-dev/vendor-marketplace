CREATE TYPE "public"."auth_provider" AS ENUM('neon_auth', 'legacy_clerk', 'seed');--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "auth_provider" "auth_provider" DEFAULT 'neon_auth' NOT NULL;