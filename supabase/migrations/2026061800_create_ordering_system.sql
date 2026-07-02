-- Migration: Create ordering system tables, RLS policies, and enable realtime
-- Target: Supabase Postgres

-- 1. Create public.restaurants table
CREATE TABLE IF NOT EXISTS public.restaurants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    address TEXT,
    gstin TEXT,
    upi_id TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Create public.restaurant_tables table
CREATE TABLE IF NOT EXISTS public.restaurant_tables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID REFERENCES public.restaurants(id) ON DELETE CASCADE,
    table_number INTEGER NOT NULL,
    CONSTRAINT unique_restaurant_table UNIQUE (restaurant_id, table_number)
);

-- 3. Create public.table_sessions table
CREATE TABLE IF NOT EXISTS public.table_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID REFERENCES public.restaurants(id) ON DELETE CASCADE,
    table_id UUID REFERENCES public.restaurant_tables(id) ON DELETE CASCADE,
    pin TEXT NOT NULL,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'bill_generated', 'closed')),
    opened_at TIMESTAMPTZ DEFAULT now(),
    closed_at TIMESTAMPTZ
);

-- 4. Create public.customers table
CREATE TABLE IF NOT EXISTS public.customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID REFERENCES public.restaurants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    phone TEXT,
    whatsapp_opted_in BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Create public.orders table
CREATE TABLE IF NOT EXISTS public.orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES public.table_sessions(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
    round_number INTEGER NOT NULL,
    status TEXT DEFAULT 'received',
    placed_at TIMESTAMPTZ DEFAULT now()
);

-- 6. Create public.order_items table
CREATE TABLE IF NOT EXISTS public.order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
    dish_id UUID REFERENCES public.dishes(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    price NUMERIC NOT NULL,
    quantity INTEGER NOT NULL
);

-- 7. Create public.bills table
CREATE TABLE IF NOT EXISTS public.bills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES public.table_sessions(id) ON DELETE CASCADE,
    subtotal NUMERIC NOT NULL,
    gst_amount NUMERIC NOT NULL,
    total NUMERIC NOT NULL,
    generated_at TIMESTAMPTZ DEFAULT now()
);

-- 8. Create public.print_jobs table
CREATE TABLE IF NOT EXISTS public.print_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID REFERENCES public.restaurants(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('kot', 'bill')),
    payload JSONB NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable Row Level Security (RLS) on all tables
ALTER TABLE public.restaurants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.table_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.print_jobs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for idempotency)
DROP POLICY IF EXISTS "Allow public select on restaurants" ON public.restaurants;
DROP POLICY IF EXISTS "Allow public insert on restaurants" ON public.restaurants;
DROP POLICY IF EXISTS "Allow admin update on restaurants" ON public.restaurants;
DROP POLICY IF EXISTS "Allow admin delete on restaurants" ON public.restaurants;

DROP POLICY IF EXISTS "Allow public select on restaurant_tables" ON public.restaurant_tables;
DROP POLICY IF EXISTS "Allow public insert on restaurant_tables" ON public.restaurant_tables;
DROP POLICY IF EXISTS "Allow admin update on restaurant_tables" ON public.restaurant_tables;
DROP POLICY IF EXISTS "Allow admin delete on restaurant_tables" ON public.restaurant_tables;

DROP POLICY IF EXISTS "Allow public select on table_sessions" ON public.table_sessions;
DROP POLICY IF EXISTS "Allow public insert on table_sessions" ON public.table_sessions;
DROP POLICY IF EXISTS "Allow admin update on table_sessions" ON public.table_sessions;
DROP POLICY IF EXISTS "Allow admin delete on table_sessions" ON public.table_sessions;

DROP POLICY IF EXISTS "Allow public select on customers" ON public.customers;
DROP POLICY IF EXISTS "Allow public insert on customers" ON public.customers;
DROP POLICY IF EXISTS "Allow admin update on customers" ON public.customers;
DROP POLICY IF EXISTS "Allow admin delete on customers" ON public.customers;

DROP POLICY IF EXISTS "Allow public select on orders" ON public.orders;
DROP POLICY IF EXISTS "Allow public insert on orders" ON public.orders;
DROP POLICY IF EXISTS "Allow admin update on orders" ON public.orders;
DROP POLICY IF EXISTS "Allow admin delete on orders" ON public.orders;

DROP POLICY IF EXISTS "Allow public select on order_items" ON public.order_items;
DROP POLICY IF EXISTS "Allow public insert on order_items" ON public.order_items;
DROP POLICY IF EXISTS "Allow admin update on order_items" ON public.order_items;
DROP POLICY IF EXISTS "Allow admin delete on order_items" ON public.order_items;

DROP POLICY IF EXISTS "Allow public select on bills" ON public.bills;
DROP POLICY IF EXISTS "Allow public insert on bills" ON public.bills;
DROP POLICY IF EXISTS "Allow admin update on bills" ON public.bills;
DROP POLICY IF EXISTS "Allow admin delete on bills" ON public.bills;

DROP POLICY IF EXISTS "Allow public insert on print_jobs" ON public.print_jobs;

-- Recreate policies

-- Restaurants
CREATE POLICY "Allow public select on restaurants" ON public.restaurants FOR SELECT USING (true);
CREATE POLICY "Allow public insert on restaurants" ON public.restaurants FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow admin update on restaurants" ON public.restaurants FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow admin delete on restaurants" ON public.restaurants FOR DELETE TO authenticated USING (true);

-- Restaurant Tables
CREATE POLICY "Allow public select on restaurant_tables" ON public.restaurant_tables FOR SELECT USING (true);
CREATE POLICY "Allow public insert on restaurant_tables" ON public.restaurant_tables FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow admin update on restaurant_tables" ON public.restaurant_tables FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow admin delete on restaurant_tables" ON public.restaurant_tables FOR DELETE TO authenticated USING (true);

-- Table Sessions
CREATE POLICY "Allow public select on table_sessions" ON public.table_sessions FOR SELECT USING (true);
CREATE POLICY "Allow public insert on table_sessions" ON public.table_sessions FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow admin update on table_sessions" ON public.table_sessions FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow admin delete on table_sessions" ON public.table_sessions FOR DELETE TO authenticated USING (true);

-- Customers
CREATE POLICY "Allow public select on customers" ON public.customers FOR SELECT USING (true);
CREATE POLICY "Allow public insert on customers" ON public.customers FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow admin update on customers" ON public.customers FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow admin delete on customers" ON public.customers FOR DELETE TO authenticated USING (true);

-- Orders
CREATE POLICY "Allow public select on orders" ON public.orders FOR SELECT USING (true);
CREATE POLICY "Allow public insert on orders" ON public.orders FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow admin update on orders" ON public.orders FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow admin delete on orders" ON public.orders FOR DELETE TO authenticated USING (true);

-- Order Items
CREATE POLICY "Allow public select on order_items" ON public.order_items FOR SELECT USING (true);
CREATE POLICY "Allow public insert on order_items" ON public.order_items FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow admin update on order_items" ON public.order_items FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow admin delete on order_items" ON public.order_items FOR DELETE TO authenticated USING (true);

-- Bills
CREATE POLICY "Allow public select on bills" ON public.bills FOR SELECT USING (true);
CREATE POLICY "Allow public insert on bills" ON public.bills FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow admin update on bills" ON public.bills FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow admin delete on bills" ON public.bills FOR DELETE TO authenticated USING (true);

-- Print Jobs (only insert is allowed for public, SELECT/UPDATE restricted to service role bypassing RLS)
CREATE POLICY "Allow public insert on print_jobs" ON public.print_jobs FOR INSERT WITH CHECK (true);

-- Enable Realtime
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'table_sessions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.table_sessions;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'orders'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    NULL;
END $$;
