-- Notification queue table for scheduling push notifications

create extension if not exists pgcrypto;

create table if not exists public.notification_queue (
  id uuid primary key default gen_random_uuid(),
  session_id text not null,
  type text not null default 'feedback',
  dishes jsonb null,
  send_at timestamptz not null,
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed')),
  review_url text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_notification_queue_status_send_at
  on public.notification_queue (status, send_at);

create index if not exists idx_notification_queue_session_id
  on public.notification_queue (session_id);

create index if not exists idx_notification_queue_created_at
  on public.notification_queue (created_at desc);

grant select, insert, update on table public.notification_queue to service_role;

alter table public.notification_queue enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'notification_queue' and policyname = 'notification_queue_service_role'
  ) then
    create policy notification_queue_service_role on public.notification_queue
      for all to service_role
      using (true)
      with check (true);
  end if;
end $$;
