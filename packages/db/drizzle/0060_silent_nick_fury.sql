DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "users" WHERE "auth_provider"::text = 'legacy_clerk') THEN
    RAISE EXCEPTION 'users still carry auth_provider legacy_clerk; migrate or remove them before dropping the value';
  END IF;
END $$;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "auth_provider" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "auth_provider" SET DEFAULT 'neon_auth'::text;--> statement-breakpoint
DROP TYPE "public"."auth_provider";--> statement-breakpoint
CREATE TYPE "public"."auth_provider" AS ENUM('neon_auth', 'seed');--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "auth_provider" SET DEFAULT 'neon_auth'::"public"."auth_provider";--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "auth_provider" SET DATA TYPE "public"."auth_provider" USING "auth_provider"::"public"."auth_provider";