-- Shared cart per table session.
-- Adds host tracking to table_sessions and a new session_cart_items table.

-- ============================================================
-- 1. HOST COLUMNS ON TABLE_SESSIONS
-- ============================================================

alter table public.table_sessions add column if not exists host_device_id text;
alter table public.table_sessions add column if not exists host_name text;

-- ============================================================
-- 2. SHARED CART TABLE
-- ============================================================

create table if not exists public.session_cart_items (
  id                 uuid primary key default gen_random_uuid(),
  session_id         uuid not null references public.table_sessions(id) on delete cascade,
  dish_id            uuid not null,
  name               text not null,
  price              numeric not null,
  image              text,
  category           text,
  quantity           integer not null default 1 check (quantity > 0),
  added_by_device_id text not null,
  added_by_name      text not null default 'Guest',
  created_at         timestamptz default now(),
  updated_at         timestamptz default now(),
  unique (session_id, dish_id, added_by_device_id)
);

-- ============================================================
-- 3. RLS
-- ============================================================

alter table public.session_cart_items enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'session_cart_items'
      and policyname = 'Allow public select on session_cart_items'
  ) then
    create policy "Allow public select on session_cart_items"
      on public.session_cart_items for select to public using (true);
  end if;
end $$;

-- ============================================================
-- 4. REALTIME PUBLICATION (idempotent)
-- ============================================================

do $$ begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'session_cart_items'
  ) then
    alter publication supabase_realtime add table public.session_cart_items;
  end if;
end $$;
