-- VEN-647: what a booking was agreed as, and how it got where it is.
--
-- 1. `booking_events` is written by the database, in the statement that moves
--    the row. Every insert into `booking_requests` or `bookings`, every update
--    that changes `status`, and every update that changes a request's quoted
--    price appends one row — so the history commits or rolls back with the
--    transition itself, and no writer (a service, an operator path, a seed) can
--    forget it.
--
--    The actor is the transaction-local `app.booking_actor` (`asBookingActor`),
--    or the request identity's `app.user_id`, or NULL: the system.
--
-- 2. `booking_events` is append-only, the way `admin_actions` is (0030).
--
-- 3. `booking_requests.package_snapshot` is write-once: the accept writes it,
--    and nothing may change it afterwards.
--
-- `SET search_path` is load-bearing for the reason given in 0029: the functions
-- are SECURITY INVOKER and must not resolve names through the caller's path.

CREATE FUNCTION booking_event_actor() RETURNS uuid
  SET search_path = pg_catalog, public
AS $$
  SELECT coalesce(
    nullif(current_setting('app.booking_actor', true), ''),
    nullif(current_setting('app.user_id', true), '')
  )::uuid;
$$ LANGUAGE sql STABLE;--> statement-breakpoint

CREATE FUNCTION record_booking_request_event() RETURNS trigger
  SET search_path = pg_catalog, public
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW.status IS NOT DISTINCT FROM OLD.status
     AND NEW.quoted_price_cents IS NOT DISTINCT FROM OLD.quoted_price_cents
  THEN
    RETURN NULL;
  END IF;

  INSERT INTO booking_events (subject_type, subject_id, from_status, to_status, actor_user_id, payload)
  VALUES (
    'booking_request',
    NEW.id,
    CASE WHEN TG_OP = 'UPDATE' THEN OLD.status::text END,
    NEW.status::text,
    booking_event_actor(),
    nullif(
      jsonb_strip_nulls(jsonb_build_object(
        'quotedPriceCents', NEW.quoted_price_cents,
        'finalPriceCents', NEW.final_price_cents
      )),
      '{}'::jsonb
    )
  );

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint

CREATE FUNCTION record_booking_event() RETURNS trigger
  SET search_path = pg_catalog, public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NULL;
  END IF;

  INSERT INTO booking_events (subject_type, subject_id, from_status, to_status, actor_user_id, payload)
  VALUES (
    'booking',
    NEW.id,
    CASE WHEN TG_OP = 'UPDATE' THEN OLD.status::text END,
    NEW.status::text,
    booking_event_actor(),
    nullif(
      jsonb_strip_nulls(jsonb_build_object(
        'totalAmountCents', CASE WHEN TG_OP = 'INSERT' THEN NEW.total_amount_cents END,
        'refundAmountCents', NEW.refund_amount_cents,
        'cancelledBy', NEW.cancelled_by::text
      )),
      '{}'::jsonb
    )
  );

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint

CREATE TRIGGER booking_requests_record_event
  AFTER INSERT OR UPDATE OF status, quoted_price_cents ON "booking_requests"
  FOR EACH ROW EXECUTE FUNCTION record_booking_request_event();--> statement-breakpoint
CREATE TRIGGER bookings_record_event
  AFTER INSERT OR UPDATE OF status ON "bookings"
  FOR EACH ROW EXECUTE FUNCTION record_booking_event();--> statement-breakpoint

CREATE FUNCTION booking_events_are_immutable() RETURNS trigger
  SET search_path = pg_catalog, public
AS $$
BEGIN
  RAISE EXCEPTION 'booking_events is append-only: % is not allowed', TG_OP
    USING ERRCODE = 'restrict_violation';
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
CREATE TRIGGER booking_events_no_update
  BEFORE UPDATE ON "booking_events"
  FOR EACH ROW EXECUTE FUNCTION booking_events_are_immutable();--> statement-breakpoint
CREATE TRIGGER booking_events_no_delete
  BEFORE DELETE ON "booking_events"
  FOR EACH ROW EXECUTE FUNCTION booking_events_are_immutable();--> statement-breakpoint
CREATE TRIGGER booking_events_no_truncate
  BEFORE TRUNCATE ON "booking_events"
  FOR EACH STATEMENT EXECUTE FUNCTION booking_events_are_immutable();--> statement-breakpoint

CREATE FUNCTION booking_requests_package_snapshot_write_once() RETURNS trigger
  SET search_path = pg_catalog, public
AS $$
BEGIN
  IF OLD.package_snapshot IS NOT NULL
     AND NEW.package_snapshot IS DISTINCT FROM OLD.package_snapshot
  THEN
    RAISE EXCEPTION 'booking_requests.package_snapshot is written once, at acceptance'
      USING ERRCODE = 'restrict_violation';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
CREATE TRIGGER booking_requests_package_snapshot_write_once
  BEFORE UPDATE OF package_snapshot ON "booking_requests"
  FOR EACH ROW EXECUTE FUNCTION booking_requests_package_snapshot_write_once();--> statement-breakpoint

CREATE POLICY "app_api_unscoped" ON "booking_events" TO "app_api" USING (true) WITH CHECK (true);
