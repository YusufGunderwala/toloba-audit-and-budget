BEGIN;

CREATE OR REPLACE FUNCTION treasury_private.audit_change()
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
    WHEN TG_TABLE_NAME = 'income' AND TG_OP = 'INSERT' THEN 'RECORD_INCOME'
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

CREATE POLICY treasury_delete ON public.income FOR DELETE TO authenticated
  USING ((SELECT treasury_private.current_role()) IN ('super_admin', 'treasurer'));
GRANT DELETE ON public.income TO authenticated;

COMMIT;
