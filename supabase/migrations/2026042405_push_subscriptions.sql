-- Push notification subscriptions table

create extension if not exists pgcrypto;

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  session_id text not null unique,
  subscription jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_push_subscriptions_session_id
  on public.push_subscriptions (session_id);

grant select, insert, update, delete on table public.push_subscriptions to service_role;

alter table public.push_subscriptions enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'push_subscriptions' and policyname = 'push_subscriptions_service_role'
  ) then
    create policy push_subscriptions_service_role on public.push_subscriptions
      for all to service_role
      using (true)
      with check (true);
  end if;
end $$;
