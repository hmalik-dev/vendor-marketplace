-- Accepting a request used to write `availability.status = 'pending'`; it now
-- writes `'booked'`, because acceptance is the commitment (#212, #307).
--
-- Without this backfill every date accepted before that change keeps a
-- `pending` row that nothing will ever revisit: `accepted` is terminal in
-- `BOOKING_REQUEST_TRANSITIONS`, so no later write touches the vendor and date,
-- and the lazy expiry sweep returns early for statuses that cannot expire.
--
-- That matters because all three double-booking guards compare against the
-- literal `'booked'` and there is no database constraint behind them:
--
--   * `createBookingRequest` 409s only on `booked`
--   * the `accept` branch of `prepareTransition` 409s only on `booked`
--   * `setOwnAvailability` refuses to edit only `booked`
--
-- So a legacy accepted date would accept a second request and then accept it
-- again, leaving one vendor committed twice on one day, both customers' contact
-- details disclosed, and the vendor's own calendar reading `Pending request`
-- for a date they are contractually on the hook for.
UPDATE availability a
   SET status = 'booked'
  FROM booking_requests r
 WHERE r.vendor_id = a.vendor_id
   AND r.event_date = a.date
   AND r.status = 'accepted'
   AND a.status <> 'booked';
--> statement-breakpoint
-- Whatever `pending` rows remain were written by the same old accept path for
-- requests that have since been declined, cancelled or expired, and they are
-- holding dates the vendor is free on. `pending` is not vendor-settable —
-- `VENDOR_SETTABLE_AVAILABILITY_STATUSES` is `available` and `blocked` — so a
-- row in this state can only have come from the request lifecycle, and the
-- lifecycle no longer stores one.
DELETE FROM availability
 WHERE status = 'pending';
