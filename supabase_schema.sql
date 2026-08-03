-- ====================================================================
-- TOLOBA UL KULLIYAAT IL MUMINOON - ENTERPRISE TREASURY SYSTEM SCHEMA
-- ====================================================================

-- Step 1: Clean/Reset Tables (Safe for fresh setup)
DROP TABLE IF EXISTS public.audit_logs CASCADE;
DROP TABLE IF EXISTS public.invoices CASCADE;
DROP TABLE IF EXISTS public.expenses CASCADE;
DROP TABLE IF EXISTS public.events CASCADE;
DROP TABLE IF EXISTS public.receipts CASCADE;
DROP TABLE IF EXISTS public.members CASCADE;
DROP TABLE IF EXISTS public.user_roles CASCADE;

-- 1. MEMBERS TABLE
CREATE TABLE public.members (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    its_number VARCHAR(8) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    email VARCHAR(255),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. RECEIPTS TABLE (Incoming Lawazam & Contributions)
CREATE TABLE public.receipts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    receipt_no VARCHAR(50) NOT NULL UNIQUE,
    member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
    amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
    payment_mode VARCHAR(50) NOT NULL CHECK (payment_mode IN ('Cash', 'UPI', 'Bank Transfer', 'Cheque')),
    transaction_id VARCHAR(100),
    period_month VARCHAR(50) NOT NULL,
    period_year VARCHAR(10) NOT NULL,
    status VARCHAR(20) DEFAULT 'valid' CHECK (status IN ('valid', 'void')),
    remarks TEXT,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. EVENTS TABLE (Budgeting & Event Expense Management)
CREATE TABLE public.events (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    event_name VARCHAR(255) NOT NULL,
    budget_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    start_date DATE,
    end_date DATE,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('upcoming', 'active', 'completed')),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. EXPENSES TABLE (Outflow / Committee Expenses)
CREATE TABLE public.expenses (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
    category VARCHAR(100) NOT NULL CHECK (category IN ('Catering', 'Logistics', 'Venue & Rent', 'Printing & Stationery', 'Sound & Light', 'Administrative', 'Maintenance', 'Miscellaneous')),
    payment_mode VARCHAR(50) NOT NULL CHECK (payment_mode IN ('Cash', 'UPI', 'Bank Transfer', 'Cheque')),
    event_id UUID REFERENCES public.events(id) ON DELETE SET NULL,
    voucher_no VARCHAR(50),
    vendor_name VARCHAR(255),
    notes TEXT,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. INVOICES TABLE (Billing & Debit Notes)
CREATE TABLE public.invoices (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    invoice_no VARCHAR(50) NOT NULL UNIQUE,
    client_name VARCHAR(255) NOT NULL,
    client_its VARCHAR(8),
    client_phone VARCHAR(20),
    title VARCHAR(255) NOT NULL,
    amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
    due_date DATE NOT NULL,
    status VARCHAR(20) DEFAULT 'unpaid' CHECK (status IN ('unpaid', 'paid', 'overdue', 'cancelled')),
    payment_date TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. USER ROLES TABLE (RBAC)
CREATE TABLE public.user_roles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    role VARCHAR(50) NOT NULL DEFAULT 'viewer' CHECK (role IN ('super_admin', 'treasurer', 'viewer')),
    display_name VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 7. AUDIT LOGS TABLE
CREATE TABLE public.audit_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    user_email VARCHAR(255),
    action VARCHAR(100) NOT NULL,
    details TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ====================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ====================================================================

ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- READ POLICIES (All authenticated users can read)
CREATE POLICY "Auth users read members" ON public.members FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth users read receipts" ON public.receipts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth users read events" ON public.events FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth users read expenses" ON public.expenses FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth users read invoices" ON public.invoices FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth users read user_roles" ON public.user_roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth users read audit_logs" ON public.audit_logs FOR SELECT TO authenticated USING (true);

-- WRITE POLICIES (Super Admin & Treasurer can write)
CREATE POLICY "Admin/Treasurer write members" ON public.members FOR ALL TO authenticated 
USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('super_admin', 'treasurer')));

CREATE POLICY "Admin/Treasurer write receipts" ON public.receipts FOR ALL TO authenticated 
USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('super_admin', 'treasurer')));

CREATE POLICY "Admin/Treasurer write events" ON public.events FOR ALL TO authenticated 
USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('super_admin', 'treasurer')));

CREATE POLICY "Admin/Treasurer write expenses" ON public.expenses FOR ALL TO authenticated 
USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('super_admin', 'treasurer')));

CREATE POLICY "Admin/Treasurer write invoices" ON public.invoices FOR ALL TO authenticated 
USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('super_admin', 'treasurer')));

CREATE POLICY "Super Admin write user_roles" ON public.user_roles FOR ALL TO authenticated 
USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin'));

CREATE POLICY "System insert audit_logs" ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (true);

-- ====================================================================
-- RPC FUNCTION FOR SUPER ADMIN TO RESET ANY USER'S PASSWORD
-- ====================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.admin_reset_user_password(target_user_id UUID, new_password TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Verify caller is super_admin
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'super_admin'
  ) THEN
    RAISE EXCEPTION 'Unauthorized: Only Super Admins can reset user passwords.';
  END IF;

  -- Update target user's encrypted password in auth.users
  UPDATE auth.users
  SET encrypted_password = crypt(new_password, gen_salt('bf'))
  WHERE id = target_user_id;
END;
$$;
