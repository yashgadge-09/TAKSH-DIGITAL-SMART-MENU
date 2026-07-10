-- Staff table: splits admin access into two tiers.
--
-- Today, /admin is protected only by "is there a session" (no role concept),
-- and every server action in lib/database.ts runs under the service-role key
-- with zero caller check. This introduces owners (full /admin — revenue,
-- analytics, menu) vs captains (floor ops only — approve orders, manage
-- tables — no revenue/analytics visibility) for the new /captain panel.

create table if not exists public.staff (
  id            uuid primary key references auth.users(id) on delete cascade,
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  name          text not null,
  role          text not null check (role in ('owner', 'captain')),
  is_active     boolean not null default true,
  created_at    timestamptz not null default now()
);

alter table public.staff enable row level security;

-- A logged-in user may only ever read their own row — enough for middleware
-- and pages to resolve "my own role" using the caller's own session (anon
-- key), without needing the service-role key on the edge.
do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'staff' and policyname = 'staff_self_select'
  ) then
    create policy staff_self_select
      on public.staff for select to authenticated using (auth.uid() = id);
  end if;
end $$;
