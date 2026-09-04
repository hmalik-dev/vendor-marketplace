-- #401: a request's reply window used to be a flat seven days from creation,
-- whatever the event date was. A request sent for an event three days out
-- therefore stayed live for four days *after* it — the vendor was still shown
-- `Accept` and `Send quote` on a date nobody could work, and the customer's
-- history read "awaiting reply · expires in 4d" for something already missed.
--
-- `createBookingRequest` now writes `replyDeadline(now, eventDate)`, but that
-- is a write-time fix and acceptance 3 is a property of the data, not of the
-- writer: every row created before this keeps the flat week, so the reported
-- symptom survives in every existing database for up to seven days.
--
-- The cap is `event_date + 2 days` at UTC midnight, which is the exact instant
-- `isUniversallyPastDate` starts returning true — and therefore the instant
-- `transitionRequest` starts refusing an accept. Aligning the two means a row
-- can never be live but unacceptable, which is the state this backfill exists
-- to clear. The two days are the timezone tail: a date is still somebody's
-- today as late as UTC-12, so anything tighter can expire a request while the
-- event is still today for the vendor being asked.
--
-- Only live rows. `accepted`, `declined`, `expired` and `cancelled` are
-- settled, and rewriting the deadline they were settled under would falsify
-- the history rather than correct it.
--
-- A live row with a NULL `expires_at` is deliberately out of reach. The writer
-- has always stamped one, so such a row can only have come from a seed; giving
-- it a deadline here would be inventing a decision the product never made
-- about it. The `IS NOT NULL` clause is therefore explicit rather than load-
-- bearing — `NULL > x` is already not true.
UPDATE booking_requests
   SET expires_at = (event_date + 2)::timestamp AT TIME ZONE 'UTC'
 WHERE status IN ('pending', 'quoted')
   AND expires_at IS NOT NULL
   AND expires_at > (event_date + 2)::timestamp AT TIME ZONE 'UTC';
