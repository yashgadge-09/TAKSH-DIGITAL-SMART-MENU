-- Links a table_sessions row to the customers row created when the host
-- completes onboarding (name + phone) at the very start of the session,
-- instead of at checkout time. NULL until the host submits the onboarding form.
alter table public.table_sessions
  add column if not exists host_customer_id uuid references public.customers(id);
