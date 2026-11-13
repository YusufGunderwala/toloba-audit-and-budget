-- Fresh Supabase projects only. Apply the treasury migration immediately afterward.
-- Existing deployments should apply only the migration.
BEGIN;

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

ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

COMMIT;
