-- VEN-649. One person is one account: from the next migration on, addresses
-- are unique up to case. Two live accounts whose addresses differ only by case
-- are two sets of bookings under what is really one person, and merging them
-- is a person's decision, so this stops and names them rather than choosing.
-- Retired rows are outside the unique index and never collide.
DO $$
DECLARE
  collisions text;
BEGIN
  SELECT string_agg(ids, '; ')
    INTO collisions
    FROM (
      SELECT string_agg("id"::text, ', ' ORDER BY "created_at") AS ids
        FROM "users"
       WHERE "deleted_at" IS NULL
       GROUP BY lower("email")
      HAVING count(*) > 1
    ) AS colliding;
  IF collisions IS NOT NULL THEN
    RAISE EXCEPTION 'live users share an email address up to case; resolve these accounts before migrating: %', collisions;
  END IF;
END $$;--> statement-breakpoint
-- The rows written before the writers lowercased, so the CHECK that follows holds.
UPDATE "users" SET "email" = lower("email") WHERE "email" <> lower("email");
