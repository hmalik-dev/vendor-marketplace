-- VEN-433: `expires_at` on an accepted request now means "pay by", not "reply by".
-- Rows accepted before this still hold the reply deadline, which is usually long
-- past, so the first expiry sweep would release every one of them with no
-- payment window at all.

-- Paid: a booking stands behind it, so there is no deadline left to lapse on.
UPDATE "booking_requests" AS r
SET "expires_at" = NULL
WHERE r."status" = 'accepted'
  AND EXISTS (SELECT 1 FROM "bookings" AS b WHERE b."request_id" = r."id");
--> statement-breakpoint
-- Unpaid: a fresh week from now, capped at the moment the event date is past
-- everywhere (event day + 2, UTC) — the same cap `paymentDeadline` applies.
UPDATE "booking_requests" AS r
SET "expires_at" = LEAST(
  now() + interval '7 days',
  ((r."event_date" + 2)::timestamp AT TIME ZONE 'UTC')
)
WHERE r."status" = 'accepted'
  AND NOT EXISTS (SELECT 1 FROM "bookings" AS b WHERE b."request_id" = r."id");
