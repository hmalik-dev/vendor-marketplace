--
-- `users.role` changes only through the operator-grant path.
--
-- The role was immutable by convention: no DAO update method and an update
-- schema that omits it. Nothing in the database said so, which left a stray
-- UPDATE, a seed's upsert or a future code path free to promote or demote an
-- account with no `admin_actions` row behind it.
--
-- A role change is refused unless the transaction has set
-- `app.operator_role_grant = 'on'`. That setting is **reserved for the
-- operator-grant path (VEN-506) and the one-time first-operator bootstrap in
-- docs/pre-launch.md**; nothing else sets it, and it is deliberately not
-- `app.role` or `app.operator`, which request identity sets on every request.
-- `SET LOCAL` scopes it to one transaction, so it cannot leak to the next
-- statement or to a pooled connection's next borrower.
--
-- INSERT is left alone (the sign-up path chooses the role at first acceptance)
-- and so is any UPDATE that does not change `role`.
--
-- `SET search_path` is load-bearing for the reason given in 0029: the function
-- is SECURITY INVOKER and must not resolve names through the caller's path.
CREATE FUNCTION users_role_change_guard() RETURNS trigger
  SET search_path = pg_catalog, public
AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role
     AND coalesce(current_setting('app.operator_role_grant', true), '') <> 'on'
  THEN
    RAISE EXCEPTION 'users.role can only change through the operator grant path'
      USING ERRCODE = 'restrict_violation';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
CREATE TRIGGER users_role_change_guard
  BEFORE UPDATE OF role ON "users"
  FOR EACH ROW EXECUTE FUNCTION users_role_change_guard();
