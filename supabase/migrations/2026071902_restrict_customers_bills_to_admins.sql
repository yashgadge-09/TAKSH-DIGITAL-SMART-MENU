-- Privilege-escalation fix: customers (PII) and bills (revenue) were readable by
-- ANY authenticated user via "TO authenticated USING (true)". Captains are also
-- authenticated (app_metadata.role = 'captain'), so a captain — who is blocked
-- from the /admin UI — could still run supabase.from('customers'|'bills').select()
-- from the browser and exfiltrate every phone number and the full revenue history.
--
-- Fix: exclude captains at the RLS layer. Admins have no role claim, so
-- (role IS DISTINCT FROM 'captain') is TRUE for them and FALSE for captains.
-- Service-role Server Actions bypass RLS and are unaffected; the captain panel
-- reads orders/table_sessions (not these tables) so it keeps working.

drop policy if exists "Staff read customers" on public.customers;
create policy "Admins read customers" on public.customers
  for select to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') is distinct from 'captain');

drop policy if exists "Staff read bills" on public.bills;
create policy "Admins read bills" on public.bills
  for select to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') is distinct from 'captain');
