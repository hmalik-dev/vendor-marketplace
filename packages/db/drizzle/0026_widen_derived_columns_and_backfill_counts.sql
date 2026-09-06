-- #408: two derived values were stored in columns sized for their *inputs*.
--
-- `notifications.title` interpolates a business name at its own 200-character
-- limit, so "<name> sent a quote" is 214. The write happens after the state
-- transition has committed, so the overflow turned a legal quote or decline
-- into an opaque 500 on a request that had already moved — with no in-app row
-- and no email for the other party, and a retry answering 409 because the
-- state really had changed.
--
-- `tags.slug` is category-prefixed (`language-…`, up to nine more characters)
-- on top of a name at its own 100-character limit, so approving a legal
-- 100-character suggestion rolled its transaction back and left the suggestion
-- in the queue with no way to resolve it.
ALTER TABLE "tags" ALTER COLUMN "slug" SET DATA TYPE varchar(128);--> statement-breakpoint
ALTER TABLE "notifications" ALTER COLUMN "title" SET DATA TYPE varchar(256);--> statement-breakpoint

-- And the third derived value, which had no writer at all.
--
-- `users.total/completed/cancelled_bookings_count` are documented as derived
-- from bookings, and nothing anywhere wrote them — so every customer read as a
-- permanent 0-booking "New member" on their own profile, in `/admin/customers`
-- and in the profile a vendor sees before agreeing to work with them.
-- `refreshCustomerBookingCounts` now recomputes them from the three DAO
-- functions that are the only writers of a `bookings` row, but that is a
-- write-time fix: every customer who booked before this stays at zero until
-- their next booking changes state. This is the one-off catch-up.
UPDATE "users" SET
  "total_bookings_count" = counts.total,
  "completed_bookings_count" = counts.completed,
  "cancelled_bookings_count" = counts.cancelled
FROM (
  SELECT
    "customer_id",
    count(*)::int AS total,
    count(*) FILTER (WHERE "status" = 'completed')::int AS completed,
    count(*) FILTER (WHERE "status" = 'cancelled')::int AS cancelled
  FROM "bookings"
  GROUP BY "customer_id"
) AS counts
WHERE "users"."id" = counts."customer_id";
