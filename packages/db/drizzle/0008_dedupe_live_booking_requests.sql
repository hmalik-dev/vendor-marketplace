-- `POST /booking-requests` had no server-side dedupe, so a retried submission
-- created a second and third identical pending request — all of which sat in
-- the vendor's queue permanently. The next migration adds the unique partial
-- indexes that make that impossible, and those indexes cannot be created while
-- the duplicates they forbid are still in the table.
--
-- The oldest request of each natural key survives: it is the one the customer
-- meant to send, and the one whose id the API already handed back. A NULL
-- `package_id` is a custom request, and two of those are as duplicate as two
-- package requests, so the grouping folds NULL into a value of its own.
--
-- `pending` and `quoted` together are the live statuses — the ones still
-- awaiting a decision and still in the vendor's queue — and they are exactly
-- what the indexes in the next migration are predicated on.
CREATE TEMPORARY TABLE duplicate_live_requests AS
SELECT id, keeper
  FROM (
    SELECT id,
           first_value(id) OVER (
             PARTITION BY customer_id, vendor_id, event_date, coalesce(package_id::text, '')
             ORDER BY created_at, id
           ) AS keeper
      FROM booking_requests
     WHERE status IN ('pending', 'quoted')
  ) ranked
 WHERE id <> keeper;
--> statement-breakpoint
-- The thread survives the request that started it; only its context link moves.
UPDATE conversations
   SET booking_request_id = d.keeper
  FROM duplicate_live_requests d
 WHERE conversations.booking_request_id = d.id;
--> statement-breakpoint
-- One vendor notification per duplicate was sent. They point at rows that are
-- about to stop existing, and a bell that opens nothing is worse than no bell.
DELETE FROM notifications
 USING duplicate_live_requests d
 WHERE notifications.data->>'bookingRequestId' = d.id::text;
--> statement-breakpoint
DELETE FROM booking_requests
 USING duplicate_live_requests d
 WHERE booking_requests.id = d.id;
--> statement-breakpoint
DROP TABLE duplicate_live_requests;
