-- `accepted_at` is new (#10), and the rows already accepted do not have one.
--
-- The column exists because checkout opens on "…accepted your request on May 2"
-- and `updated_at` cannot supply that date going forward: recording a payment
-- intent against the request moves it, so the line would start reporting when
-- the customer last opened checkout rather than when the vendor said yes.
--
-- But **at this instant** `updated_at` is exactly the acceptance time for every
-- already-accepted row, and that is not a coincidence:
--
--   * `accepted` is terminal in `BOOKING_REQUEST_TRANSITIONS`, so no later
--     transition touches the row;
--   * the lazy expiry sweep returns early for statuses that cannot expire;
--   * and the only new writer of `updated_at` on an accepted request —
--     `recordPaymentIntent` — cannot have run yet, because it is shipping in
--     the same change as this migration.
--
-- So this is the one moment the value is recoverable. Without it, every request
-- accepted before today renders checkout with the clause silently dropped —
-- which reads fine and is quietly wrong, the failure mode `db-schema.md` warns
-- about: nullable, merely worse rather than invalid, so no constraint fails and
-- no test notices.
--
-- Scoped to `accepted` deliberately. A declined, cancelled or expired request
-- was never accepted, and giving it an acceptance timestamp would invent a fact
-- rather than recover one.
UPDATE booking_requests
   SET accepted_at = updated_at
 WHERE status = 'accepted'
   AND accepted_at IS NULL;
