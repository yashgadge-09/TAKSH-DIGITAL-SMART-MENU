-- Migration: Lock down RLS on the ordering-system tables (security fix #2)
-- Target: Supabase Postgres
--
-- BEFORE: every ordering table had `FOR SELECT USING (true)` and
-- `FOR INSERT WITH CHECK (true)` for the anon role. Consequences:
--   * table_sessions.pin was world-readable  → the 4-digit PIN protection was
--     defeated (anyone with the public anon key could read every table's PIN).
--   * customers (name + phone) was world-readable → PII / privacy breach.
--   * orders / order_items / bills were world-readable → full sales history.
--   * public INSERT on print_jobs → attackers could inject arbitrary print
--     jobs and make the kitchen/bill printer print anything.
--   * public INSERT on orders / bills / table_sessions / customers → forgery.
--
-- AFTER: the anon (guest) role has NO direct access to any of these tables.
-- All guest interactions already flow through service-role Server Actions
-- (`adminSupabase` in lib/database.ts), which bypass RLS entirely and are now
-- additionally guarded by server-side auth checks (security fix #1). Staff read
-- paths (admin analytics/customers pages, admin/captain Realtime on orders &
-- table_sessions) run as the `authenticated` role and keep working via the
-- SELECT-to-authenticated policies below.
--
-- NOTE: session_cart_items is intentionally NOT touched here — its anon SELECT
-- policy (from 2026062501_shared_cart.sql) is required for guest shared-cart
-- Realtime delivery, and all of its writes already go through the service role.
--
-- Menu/engagement tables (dishes, categories, reviews, favourites,
-- dish_ratings) are also untouched — guests must keep reading those with the
-- anon key.

-- ── Drop every legacy anon/"public" policy on the ordering tables ────────────

-- Restaurants
DROP POLICY IF EXISTS "Allow public select on restaurants" ON public.restaurants;
DROP POLICY IF EXISTS "Allow public insert on restaurants" ON public.restaurants;
DROP POLICY IF EXISTS "Allow admin update on restaurants" ON public.restaurants;
DROP POLICY IF EXISTS "Allow admin delete on restaurants" ON public.restaurants;

-- Restaurant Tables
DROP POLICY IF EXISTS "Allow public select on restaurant_tables" ON public.restaurant_tables;
DROP POLICY IF EXISTS "Allow public insert on restaurant_tables" ON public.restaurant_tables;
DROP POLICY IF EXISTS "Allow admin update on restaurant_tables" ON public.restaurant_tables;
DROP POLICY IF EXISTS "Allow admin delete on restaurant_tables" ON public.restaurant_tables;

-- Table Sessions
DROP POLICY IF EXISTS "Allow public select on table_sessions" ON public.table_sessions;
DROP POLICY IF EXISTS "Allow public insert on table_sessions" ON public.table_sessions;
DROP POLICY IF EXISTS "Allow admin update on table_sessions" ON public.table_sessions;
DROP POLICY IF EXISTS "Allow admin delete on table_sessions" ON public.table_sessions;

-- Customers
DROP POLICY IF EXISTS "Allow public select on customers" ON public.customers;
DROP POLICY IF EXISTS "Allow public insert on customers" ON public.customers;
DROP POLICY IF EXISTS "Allow admin update on customers" ON public.customers;
DROP POLICY IF EXISTS "Allow admin delete on customers" ON public.customers;

-- Orders
DROP POLICY IF EXISTS "Allow public select on orders" ON public.orders;
DROP POLICY IF EXISTS "Allow public insert on orders" ON public.orders;
DROP POLICY IF EXISTS "Allow admin update on orders" ON public.orders;
DROP POLICY IF EXISTS "Allow admin delete on orders" ON public.orders;

-- Order Items
DROP POLICY IF EXISTS "Allow public select on order_items" ON public.order_items;
DROP POLICY IF EXISTS "Allow public insert on order_items" ON public.order_items;
DROP POLICY IF EXISTS "Allow admin update on order_items" ON public.order_items;
DROP POLICY IF EXISTS "Allow admin delete on order_items" ON public.order_items;

-- Bills
DROP POLICY IF EXISTS "Allow public select on bills" ON public.bills;
DROP POLICY IF EXISTS "Allow public insert on bills" ON public.bills;
DROP POLICY IF EXISTS "Allow admin update on bills" ON public.bills;
DROP POLICY IF EXISTS "Allow admin delete on bills" ON public.bills;

-- Print Jobs
DROP POLICY IF EXISTS "Allow public insert on print_jobs" ON public.print_jobs;

-- ── Recreate least-privilege policies ────────────────────────────────────────
-- RLS stays ENABLED on all tables (from the original migration). With RLS on
-- and no matching policy, the anon role is denied by default. The service-role
-- key used by lib/database.ts bypasses RLS, so all Server Actions keep working.

-- Staff-only SELECT. The `authenticated` role = logged-in admin/captain.
-- Needed for: admin analytics page (restaurants, bills), admin customers page
-- (restaurants, customers), and admin/captain Realtime (orders, table_sessions).
CREATE POLICY "Staff read restaurants"       ON public.restaurants       FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff read restaurant_tables" ON public.restaurant_tables FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff read table_sessions"    ON public.table_sessions    FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff read customers"         ON public.customers         FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff read orders"            ON public.orders            FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff read order_items"       ON public.order_items       FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff read bills"             ON public.bills             FOR SELECT TO authenticated USING (true);

-- Restaurant details are edited by the (future) admin Settings screen directly
-- from the authenticated browser client — keep an UPDATE path for staff only.
CREATE POLICY "Staff update restaurants" ON public.restaurants FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- print_jobs: no browser access at all. Only the print-bridge (service role,
-- bypasses RLS) reads/updates it, and only approveOrder/generateBill/reprintKot
-- (service role) insert into it. No policy = anon and authenticated both denied.
