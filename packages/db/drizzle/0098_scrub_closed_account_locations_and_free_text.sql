-- VEN-687: an account closed before closure scrubbed where the person lives and
-- what they wrote still has it on file. Idempotent: each predicate excludes a
-- row already scrubbed, so a second run matches nothing. No row is dropped or
-- retyped. The placeholder repeats CLOSED_ACCOUNT_PLACEHOLDER in
-- packages/shared, and a test pins the two together.
--
-- A vendor application is keyed by the address it was made with, which closure
-- has already replaced, so applications closed before this cannot be found here.
UPDATE "vendor_profiles" SET "bio" = NULL, "tagline" = NULL
WHERE ("bio" IS NOT NULL OR "tagline" IS NOT NULL)
  AND "user_id" IN (SELECT "id" FROM "users" WHERE "deleted_at" IS NOT NULL);--> statement-breakpoint
UPDATE "booking_requests"
SET "event_location" = 'Removed when the account was closed', "custom_details" = 'Removed when the account was closed'
WHERE ("event_location" IS DISTINCT FROM 'Removed when the account was closed'
    OR "custom_details" IS DISTINCT FROM 'Removed when the account was closed')
  AND ("customer_id" IN (SELECT "id" FROM "users" WHERE "deleted_at" IS NOT NULL)
    OR "vendor_id" IN (SELECT "id" FROM "vendor_profiles"
                       WHERE "user_id" IN (SELECT "id" FROM "users" WHERE "deleted_at" IS NOT NULL)));--> statement-breakpoint
UPDATE "bookings" SET "event_location" = 'Removed when the account was closed'
WHERE "event_location" IS DISTINCT FROM 'Removed when the account was closed'
  AND ("customer_id" IN (SELECT "id" FROM "users" WHERE "deleted_at" IS NOT NULL)
    OR "vendor_id" IN (SELECT "id" FROM "vendor_profiles"
                       WHERE "user_id" IN (SELECT "id" FROM "users" WHERE "deleted_at" IS NOT NULL)));--> statement-breakpoint
UPDATE "support_cases" SET "message" = 'Removed when the account was closed'
WHERE "message" <> 'Removed when the account was closed'
  AND "sender_email" IN (SELECT "email" FROM "users" WHERE "deleted_at" IS NOT NULL);
