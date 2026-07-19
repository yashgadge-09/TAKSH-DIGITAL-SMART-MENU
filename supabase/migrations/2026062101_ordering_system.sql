-- Ordering system schema: idempotent convergence migration.
-- All 8 tables, RLS policies, realtime, and seed were built directly via
-- dashboard/MCP and have no prior repo migration. This file captures them
-- for version control and applies the ONE outstanding fix:
--   orders.status default 'received' → 'pending_approval' + check constraint.

-- ============================================================
-- 1. TABLES
-- ============================================================

create table if not exists public.restaurants (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  slug       text unique not null,
  address    text,
  gstin      text,
  upi_id     text,
  created_at timestamptz default now()
);

create table if not exists public.restaurant_tables (
  id            uuid primary key default gen_random_uuid(),
  restaurant_id uuid references public.restaurants(id),
  table_number  integer not null,
  constraint unique_restaurant_table unique (restaurant_id, table_number)
);

create table if not exists public.table_sessions (
  id            uuid primary key default gen_random_uuid(),
  restaurant_id uuid references public.restaurants(id),
  table_id      uuid references public.restaurant_tables(id),
  pin           text not null,
  status        text default 'active'
                  check (status in ('active', 'bill_generated', 'closed')),
  opened_at     timestamptz default now(),
  closed_at     timestamptz
);

create table if not exists public.customers (
  id                uuid primary key default gen_random_uuid(),
  restaurant_id     uuid references public.restaurants(id),
  name              text not null,
  phone             text,
  whatsapp_opted_in boolean default false,
  created_at        timestamptz default now()
);

create table if not exists public.orders (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid references public.table_sessions(id),
  customer_id uuid references public.customers(id),
  round_number integer not null,
  status      text default 'pending_approval',
  placed_at   timestamptz default now()
);

create table if not exists public.order_items (
  id       uuid primary key default gen_random_uuid(),
  order_id uuid references public.orders(id),
  dish_id  uuid references public.dishes(id),
  name     text not null,
  price    numeric not null,
  quantity integer not null
);

create table if not exists public.bills (
  id           uuid primary key default gen_random_uuid(),
  session_id   uuid references public.table_sessions(id),
  subtotal     numeric not null,
  gst_amount   numeric not null,
  total        numeric not null,
  generated_at timestamptz default now()
);

create table if not exists public.print_jobs (
  id            uuid primary key default gen_random_uuid(),
  restaurant_id uuid references public.restaurants(id),
  type          text not null check (type in ('kot', 'bill')),
  payload       jsonb not null,
  status        text default 'pending' check (status in ('pending', 'sent', 'failed')),
  created_at    timestamptz default now()
);

-- ============================================================
-- 2. ORDERS APPROVAL FIX  ← only effective change
-- ============================================================

-- Was 'received', must be 'pending_approval' for the approval gate to work.
alter table public.orders alter column status set default 'pending_approval';

-- Add status lifecycle check if absent (orders has 0 rows, no backfill needed).
do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.orders'::regclass
      and conname  = 'orders_status_check'
  ) then
    alter table public.orders add constraint orders_status_check
      check (status in ('pending_approval', 'approved', 'rejected', 'served'));
  end if;
end $$;

-- ============================================================
-- 3. RLS — enable + policies (idempotent)
-- ============================================================

alter table public.restaurants     enable row level security;
alter table public.restaurant_tables enable row level security;
alter table public.table_sessions  enable row level security;
alter table public.customers       enable row level security;
alter table public.orders          enable row level security;
alter table public.order_items     enable row level security;
alter table public.bills           enable row level security;
alter table public.print_jobs      enable row level security;

-- Helper macro pattern: create policy only when absent
do $$ begin
  -- restaurants
  if not exists (select 1 from pg_policies where tablename='restaurants' and policyname='Allow public select on restaurants') then
    create policy "Allow public select on restaurants"  on public.restaurants for select to public using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='restaurants' and policyname='Allow public insert on restaurants') then
    create policy "Allow public insert on restaurants"  on public.restaurants for insert to public with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='restaurants' and policyname='Allow admin update on restaurants') then
    create policy "Allow admin update on restaurants"   on public.restaurants for update to authenticated using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='restaurants' and policyname='Allow admin delete on restaurants') then
    create policy "Allow admin delete on restaurants"   on public.restaurants for delete to authenticated using (true);
  end if;

  -- restaurant_tables
  if not exists (select 1 from pg_policies where tablename='restaurant_tables' and policyname='Allow public select on restaurant_tables') then
    create policy "Allow public select on restaurant_tables"  on public.restaurant_tables for select to public using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='restaurant_tables' and policyname='Allow public insert on restaurant_tables') then
    create policy "Allow public insert on restaurant_tables"  on public.restaurant_tables for insert to public with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='restaurant_tables' and policyname='Allow admin update on restaurant_tables') then
    create policy "Allow admin update on restaurant_tables"   on public.restaurant_tables for update to authenticated using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='restaurant_tables' and policyname='Allow admin delete on restaurant_tables') then
    create policy "Allow admin delete on restaurant_tables"   on public.restaurant_tables for delete to authenticated using (true);
  end if;

  -- table_sessions
  if not exists (select 1 from pg_policies where tablename='table_sessions' and policyname='Allow public select on table_sessions') then
    create policy "Allow public select on table_sessions"  on public.table_sessions for select to public using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='table_sessions' and policyname='Allow public insert on table_sessions') then
    create policy "Allow public insert on table_sessions"  on public.table_sessions for insert to public with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='table_sessions' and policyname='Allow admin update on table_sessions') then
    create policy "Allow admin update on table_sessions"   on public.table_sessions for update to authenticated using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='table_sessions' and policyname='Allow admin delete on table_sessions') then
    create policy "Allow admin delete on table_sessions"   on public.table_sessions for delete to authenticated using (true);
  end if;

  -- customers
  if not exists (select 1 from pg_policies where tablename='customers' and policyname='Allow public select on customers') then
    create policy "Allow public select on customers"  on public.customers for select to public using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='customers' and policyname='Allow public insert on customers') then
    create policy "Allow public insert on customers"  on public.customers for insert to public with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='customers' and policyname='Allow admin update on customers') then
    create policy "Allow admin update on customers"   on public.customers for update to authenticated using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='customers' and policyname='Allow admin delete on customers') then
    create policy "Allow admin delete on customers"   on public.customers for delete to authenticated using (true);
  end if;

  -- orders
  if not exists (select 1 from pg_policies where tablename='orders' and policyname='Allow public select on orders') then
    create policy "Allow public select on orders"  on public.orders for select to public using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='orders' and policyname='Allow public insert on orders') then
    create policy "Allow public insert on orders"  on public.orders for insert to public with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='orders' and policyname='Allow admin update on orders') then
    create policy "Allow admin update on orders"   on public.orders for update to authenticated using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='orders' and policyname='Allow admin delete on orders') then
    create policy "Allow admin delete on orders"   on public.orders for delete to authenticated using (true);
  end if;

  -- order_items
  if not exists (select 1 from pg_policies where tablename='order_items' and policyname='Allow public select on order_items') then
    create policy "Allow public select on order_items"  on public.order_items for select to public using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='order_items' and policyname='Allow public insert on order_items') then
    create policy "Allow public insert on order_items"  on public.order_items for insert to public with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='order_items' and policyname='Allow admin update on order_items') then
    create policy "Allow admin update on order_items"   on public.order_items for update to authenticated using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='order_items' and policyname='Allow admin delete on order_items') then
    create policy "Allow admin delete on order_items"   on public.order_items for delete to authenticated using (true);
  end if;

  -- bills
  if not exists (select 1 from pg_policies where tablename='bills' and policyname='Allow public select on bills') then
    create policy "Allow public select on bills"  on public.bills for select to public using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='bills' and policyname='Allow public insert on bills') then
    create policy "Allow public insert on bills"  on public.bills for insert to public with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='bills' and policyname='Allow admin update on bills') then
    create policy "Allow admin update on bills"   on public.bills for update to authenticated using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='bills' and policyname='Allow admin delete on bills') then
    create policy "Allow admin delete on bills"   on public.bills for delete to authenticated using (true);
  end if;

  -- print_jobs: public INSERT only; no SELECT/UPDATE policy (service role bypasses RLS)
  if not exists (select 1 from pg_policies where tablename='print_jobs' and policyname='Allow public insert on print_jobs') then
    create policy "Allow public insert on print_jobs" on public.print_jobs for insert to public with check (true);
  end if;
end $$;

-- ============================================================
-- 4. REALTIME (idempotent)
-- ============================================================

do $$ begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'table_sessions'
  ) then
    alter publication supabase_realtime add table public.table_sessions;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'orders'
  ) then
    alter publication supabase_realtime add table public.orders;
  end if;
end $$;

-- ============================================================
-- 5. SEED (idempotent)
-- ============================================================

insert into public.restaurants (name, slug, address, gstin, upi_id)
values ('TAKSH Veg', 'taksh', 'Chinchwad, Pune', '27AAAAA1111A1Z1', 'takshveg@ybl')
on conflict (slug) do update set
  name    = excluded.name,
  address = excluded.address,
  gstin   = excluded.gstin,
  upi_id  = excluded.upi_id;

insert into public.restaurant_tables (restaurant_id, table_number)
select r.id, t.n
from   public.restaurants r
cross  join generate_series(1, 10) as t(n)
where  r.slug = 'taksh'
on conflict (restaurant_id, table_number) do nothing;
