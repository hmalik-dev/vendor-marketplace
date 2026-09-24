-- VEN-672: an account closed before closure scrubbed these tables still has its
-- real address on file. Idempotent: each predicate excludes a row already
-- scrubbed, so a second run matches nothing. No row is dropped or retyped.
UPDATE "email_deliveries" SET "recipient_email" = 'closed+' || "user_id" || '@invalid'
WHERE "user_id" IN (SELECT "id" FROM "users" WHERE "deleted_at" IS NOT NULL)
  AND "recipient_email" <> 'closed+' || "user_id" || '@invalid';--> statement-breakpoint
UPDATE "support_cases" SET "sender_email" = 'closed+' || "sender_user_id" || '@invalid'
WHERE "sender_user_id" IN (SELECT "id" FROM "users" WHERE "deleted_at" IS NOT NULL)
  AND "sender_email" IS NOT NULL
  AND "sender_email" <> 'closed+' || "sender_user_id" || '@invalid';--> statement-breakpoint
UPDATE "vendor_profiles" SET "address" = NULL, "latitude" = NULL, "longitude" = NULL
WHERE ("address" IS NOT NULL OR "latitude" IS NOT NULL OR "longitude" IS NOT NULL)
  AND "user_id" IN (SELECT "id" FROM "users" WHERE "deleted_at" IS NOT NULL);
