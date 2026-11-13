BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

-- Stop before changing permissions or backfilling data on an unexpected database.
DO $$
DECLARE
  required_table text;
BEGIN
  FOREACH required_table IN ARRAY ARRAY[
    'public.members', 'public.receipts', 'public.events', 'public.expenses',
    'public.invoices', 'public.user_roles', 'public.audit_logs', 'auth.sessions'
  ] LOOP
    IF to_regclass(required_table) IS NULL THEN
      RAISE EXCEPTION 'Treasury migration stopped: missing table %', required_table;
    END IF;
  END LOOP;

  IF to_regclass('public.income') IS NOT NULL OR EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'receipts'
      AND column_name IN ('receipt_date', 'void_reason')
  ) THEN
    RAISE EXCEPTION 'Treasury migration stopped: income or receipt changes already exist.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'super_admin') THEN
    RAISE EXCEPTION 'Treasury migration stopped: assign a Super Admin before running this migration.';
  END IF;
END;
$$;

CREATE SCHEMA IF NOT EXISTS treasury_private;

-- Use the live role and session for every protected request.
CREATE FUNCTION treasury_private.current_role()
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT r.role FROM public.user_roles r
  WHERE r.user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM auth.sessions s
      WHERE s.user_id = r.user_id
        AND s.id = (auth.jwt() ->> 'session_id')::uuid
        AND (s.not_after IS NULL OR s.not_after > now())
    );
$$;

REVOKE ALL ON SCHEMA treasury_private FROM PUBLIC;
REVOKE ALL ON FUNCTION treasury_private.current_role() FROM PUBLIC;
GRANT USAGE ON SCHEMA treasury_private TO authenticated;
GRANT EXECUTE ON FUNCTION treasury_private.current_role() TO authenticated;

-- Keep issued receipts and original recording timestamps.
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS status varchar(20)
  NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive'));

-- Older deployments omitted creator attribution. Historical creators are unknown.
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id);
ALTER TABLE public.receipts ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id);

ALTER TABLE public.receipts DROP CONSTRAINT receipts_member_id_fkey;
ALTER TABLE public.receipts ADD CONSTRAINT receipts_member_id_fkey
  FOREIGN KEY (member_id) REFERENCES public.members(id) ON DELETE RESTRICT;
ALTER TABLE public.receipts ADD COLUMN receipt_date date, ADD COLUMN void_reason text;
UPDATE public.receipts SET receipt_date = (created_at AT TIME ZONE 'Asia/Kolkata')::date;
ALTER TABLE public.receipts ALTER COLUMN receipt_date SET NOT NULL;
ALTER TABLE public.receipts ALTER COLUMN receipt_date SET DEFAULT ((now() AT TIME ZONE 'Asia/Kolkata')::date);
CREATE INDEX receipts_receipt_date_idx ON public.receipts (receipt_date DESC, id);
CREATE INDEX receipts_member_id_idx ON public.receipts (member_id);
CREATE INDEX IF NOT EXISTS members_name_id_idx ON public.members (name, id);
CREATE INDEX IF NOT EXISTS expenses_created_at_id_idx ON public.expenses (created_at DESC, id);
CREATE INDEX IF NOT EXISTS expenses_event_id_idx ON public.expenses (event_id);
CREATE INDEX IF NOT EXISTS events_created_at_id_idx ON public.events (created_at DESC, id);
CREATE INDEX IF NOT EXISTS audit_logs_created_at_id_idx ON public.audit_logs (created_at DESC, id);
CREATE SEQUENCE treasury_private.receipt_number;
SELECT pg_catalog.setval(
  'treasury_private.receipt_number',
  COALESCE(MAX(substring(receipt_no FROM '^TOLOBA-REC-([0-9]+)$')::bigint), 0) + 1,
  false
) FROM public.receipts;

CREATE TABLE public.income (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source varchar(255) NOT NULL CHECK (btrim(source) <> ''),
  description varchar(255) NOT NULL CHECK (btrim(description) <> ''),
  amount numeric(12,2) NOT NULL CHECK (amount > 0 AND amount <> 'NaN'::numeric),
  received_on date NOT NULL DEFAULT ((now() AT TIME ZONE 'Asia/Kolkata')::date),
  payment_mode varchar(50) NOT NULL CHECK (payment_mode IN ('Cash', 'UPI', 'Bank Transfer', 'Cheque')),
  reference varchar(100),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX income_received_on_idx ON public.income (received_on DESC, id);
ALTER TABLE public.income ENABLE ROW LEVEL SECURITY;

CREATE FUNCTION treasury_private.prepare_financial_entry()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  effective_date date;
  number_text text;
BEGIN
  IF TG_TABLE_NAME = 'receipts' THEN
    effective_date := NEW.receipt_date;
    IF NOT EXISTS (SELECT 1 FROM public.members WHERE id = NEW.member_id AND status = 'active' FOR SHARE) THEN
      RAISE EXCEPTION 'Select an active member.' USING ERRCODE = '23514';
    END IF;
    number_text := nextval('treasury_private.receipt_number')::text;
    NEW.receipt_no := 'TOLOBA-REC-' || lpad(number_text, greatest(4, length(number_text)), '0');
    NEW.status := 'valid';
  ELSE
    effective_date := NEW.received_on;
  END IF;
  IF NOT isfinite(effective_date) OR effective_date > (now() AT TIME ZONE 'Asia/Kolkata')::date THEN
    RAISE EXCEPTION 'Choose a date through today.' USING ERRCODE = '23514';
  END IF;
  NEW.created_by := auth.uid();
  NEW.created_at := now();
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION treasury_private.prepare_financial_entry() FROM PUBLIC;

CREATE TRIGGER prepare_receipt BEFORE INSERT ON public.receipts
  FOR EACH ROW EXECUTE FUNCTION treasury_private.prepare_financial_entry();
CREATE TRIGGER prepare_income BEFORE INSERT ON public.income
  FOR EACH ROW EXECUTE FUNCTION treasury_private.prepare_financial_entry();

CREATE FUNCTION treasury_private.void_receipt()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM 'valid' OR NEW.status IS DISTINCT FROM 'void'
      OR NULLIF(btrim(NEW.void_reason), '') IS NULL THEN
    RAISE EXCEPTION 'A valid receipt can only be changed by voiding it with a reason.' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_receipt_void BEFORE UPDATE ON public.receipts
  FOR EACH ROW EXECUTE FUNCTION treasury_private.void_receipt();

-- Earlier deployments may have policies beyond the checked-in bootstrap.
-- Replace policies on these application tables with the treasury role model.
DO $$
DECLARE
  app_table text;
  existing_policy record;
BEGIN
  FOREACH app_table IN ARRAY ARRAY['members','receipts','expenses','events','invoices','user_roles','audit_logs','income'] LOOP
    FOR existing_policy IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = app_table LOOP
      EXECUTE format('DROP POLICY %I ON public.%I', existing_policy.policyname, app_table);
    END LOOP;
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', app_table);
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC, anon, authenticated', app_table);
    EXECUTE format('GRANT SELECT ON public.%I TO authenticated', app_table);
    IF app_table NOT IN ('user_roles', 'audit_logs') THEN
      EXECUTE format('CREATE POLICY treasury_read ON public.%I FOR SELECT TO authenticated USING ((SELECT treasury_private.current_role()) IS NOT NULL)', app_table);
    END IF;
  END LOOP;

  FOREACH app_table IN ARRAY ARRAY['members', 'expenses', 'events', 'receipts', 'income'] LOOP
    EXECUTE format('CREATE POLICY treasury_insert ON public.%I FOR INSERT TO authenticated WITH CHECK ((SELECT treasury_private.current_role()) IN (''super_admin'', ''treasurer''))', app_table);
  END LOOP;

  FOREACH app_table IN ARRAY ARRAY['expenses', 'events'] LOOP
    EXECUTE format('CREATE POLICY treasury_delete ON public.%I FOR DELETE TO authenticated USING ((SELECT treasury_private.current_role()) IN (''super_admin'', ''treasurer''))', app_table);
    EXECUTE format('GRANT DELETE ON public.%I TO authenticated', app_table);
  END LOOP;

  FOREACH app_table IN ARRAY ARRAY['members', 'receipts'] LOOP
    EXECUTE format('CREATE POLICY treasury_update ON public.%I FOR UPDATE TO authenticated USING ((SELECT treasury_private.current_role()) IN (''super_admin'', ''treasurer'')) WITH CHECK ((SELECT treasury_private.current_role()) IN (''super_admin'', ''treasurer''))', app_table);
  END LOOP;
END;
$$;

CREATE POLICY treasury_role_read ON public.user_roles FOR SELECT TO authenticated
  USING ((SELECT treasury_private.current_role()) IS NOT NULL
    AND (user_id = (SELECT auth.uid()) OR (SELECT treasury_private.current_role()) = 'super_admin'));
CREATE POLICY treasury_role_insert ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK ((SELECT treasury_private.current_role()) = 'super_admin');
CREATE POLICY treasury_role_update ON public.user_roles FOR UPDATE TO authenticated
  USING ((SELECT treasury_private.current_role()) = 'super_admin')
  WITH CHECK ((SELECT treasury_private.current_role()) = 'super_admin');
CREATE POLICY treasury_audit_read ON public.audit_logs FOR SELECT TO authenticated
  USING ((SELECT treasury_private.current_role()) IN ('super_admin', 'treasurer'));

GRANT INSERT (its_number, name, phone, status),
  UPDATE (its_number, name, phone, status) ON public.members TO authenticated;
GRANT INSERT (member_id, amount, payment_mode, transaction_id, period_month, period_year, remarks, receipt_date),
  UPDATE (status, void_reason) ON public.receipts TO authenticated;
GRANT INSERT (source, description, amount, received_on, payment_mode, reference) ON public.income TO authenticated;
GRANT INSERT (title, amount, category, payment_mode, event_id, voucher_no, vendor_name, notes) ON public.expenses TO authenticated;
GRANT INSERT (event_name, budget_amount, start_date, end_date, status, notes) ON public.events TO authenticated;
GRANT INSERT (user_id, role, display_name), UPDATE (role) ON public.user_roles TO authenticated;
ALTER TABLE public.expenses ALTER COLUMN created_by SET DEFAULT auth.uid();

-- Keep at least the current administrator's own role intact during user management.
CREATE FUNCTION treasury_private.protect_own_role()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF OLD.user_id = auth.uid() AND NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'Another administrator must change your role.' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER protect_own_role BEFORE UPDATE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION treasury_private.protect_own_role();

CREATE FUNCTION treasury_private.audit_change()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  before_row jsonb;
  after_row jsonb;
  action_name text;
  actor uuid := auth.uid();
BEGIN
  before_row := to_jsonb(OLD);
  after_row := to_jsonb(NEW);
  action_name := CASE
    WHEN TG_TABLE_NAME = 'receipts' AND TG_OP = 'UPDATE' THEN 'VOID_RECEIPT'
    WHEN TG_TABLE_NAME = 'receipts' THEN 'CREATE_RECEIPT'
    WHEN TG_TABLE_NAME = 'income' THEN 'RECORD_INCOME'
    WHEN TG_TABLE_NAME = 'user_roles' AND TG_OP = 'INSERT' THEN 'ASSIGN_USER_ROLE'
    WHEN TG_TABLE_NAME = 'user_roles' AND TG_OP = 'UPDATE' THEN 'CHANGE_USER_ROLE'
    ELSE TG_OP || '_' || upper(TG_TABLE_NAME)
  END;

  INSERT INTO public.audit_logs (user_id, user_email, action, details)
  VALUES (actor, COALESCE(auth.jwt() ->> 'email', 'system'), action_name,
    jsonb_strip_nulls(jsonb_build_object('before', before_row, 'after', after_row))::text);
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION treasury_private.audit_change() FROM PUBLIC;

DO $$
DECLARE
  app_table text;
BEGIN
  FOREACH app_table IN ARRAY ARRAY['members','receipts','expenses','events','user_roles','income'] LOOP
    EXECUTE format('CREATE TRIGGER treasury_audit AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION treasury_private.audit_change()', app_table);
  END LOOP;
END;
$$;

-- Use the server-side Supabase Auth Admin API for account creation and resets.
DROP FUNCTION IF EXISTS public.admin_reset_user_password(uuid, text);
DROP FUNCTION IF EXISTS public.admin_create_user(text, text, text, text);

COMMIT;
