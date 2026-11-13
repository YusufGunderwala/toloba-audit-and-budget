BEGIN;

SET LOCAL lock_timeout = '5s';

-- Check new entries while preserving historical data for review.
CREATE FUNCTION treasury_private.validate_treasury_insert()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  CASE TG_TABLE_NAME
    WHEN 'receipts' THEN
      IF NEW.amount IS NULL OR NEW.amount <= 0 OR NEW.amount >= 'Infinity'::numeric THEN
        RAISE EXCEPTION 'Receipt amount must be a positive, finite number.' USING ERRCODE = '23514';
      END IF;
      IF NEW.payment_mode = 'UPI' AND NULLIF(btrim(NEW.transaction_id), '') IS NULL THEN
        RAISE EXCEPTION 'Enter the UPI transaction reference.' USING ERRCODE = '23514';
      END IF;
    WHEN 'expenses' THEN
      IF NEW.amount IS NULL OR NEW.amount <= 0 OR NEW.amount >= 'Infinity'::numeric
          OR NULLIF(btrim(NEW.title), '') IS NULL THEN
        RAISE EXCEPTION 'Enter an expense title and a positive, finite amount.' USING ERRCODE = '23514';
      END IF;
    WHEN 'events' THEN
      IF NEW.budget_amount IS NULL OR NEW.budget_amount <= 0 OR NEW.budget_amount >= 'Infinity'::numeric
          OR NULLIF(btrim(NEW.event_name), '') IS NULL THEN
        RAISE EXCEPTION 'Enter an event name and a positive, finite budget.' USING ERRCODE = '23514';
      END IF;
      IF NEW.end_date < NEW.start_date THEN
        RAISE EXCEPTION 'The event end date must be on or after the start date.' USING ERRCODE = '23514';
      END IF;
  END CASE;
  RETURN NEW;
END;
$$;

CREATE TRIGGER check_treasury_receipt BEFORE INSERT ON public.receipts
  FOR EACH ROW EXECUTE FUNCTION treasury_private.validate_treasury_insert();
CREATE TRIGGER check_treasury_expense BEFORE INSERT ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION treasury_private.validate_treasury_insert();
CREATE TRIGGER check_treasury_event BEFORE INSERT ON public.events
  FOR EACH ROW EXECUTE FUNCTION treasury_private.validate_treasury_insert();

-- Serialize role changes before PostgreSQL locks any target rows.
CREATE FUNCTION treasury_private.lock_role_changes()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(20261114, 1);
  IF auth.uid() IS NOT NULL AND treasury_private.current_role() IS DISTINCT FROM 'super_admin' THEN
    RAISE EXCEPTION 'Super Admin access is required.' USING ERRCODE = '42501';
  END IF;
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION treasury_private.lock_role_changes() FROM PUBLIC;
CREATE TRIGGER lock_treasury_role_changes BEFORE INSERT OR UPDATE ON public.user_roles
  FOR EACH STATEMENT EXECUTE FUNCTION treasury_private.lock_role_changes();

COMMIT;
