UPDATE "users" SET "auth_provider" = 'seed' WHERE "auth_user_id" LIKE 'seed\_%';--> statement-breakpoint
UPDATE "users" SET "auth_provider" = 'legacy_clerk' WHERE "auth_provider" = 'neon_auth' AND "auth_user_id" ~ '^user_[A-Za-z0-9]{24,}$';
