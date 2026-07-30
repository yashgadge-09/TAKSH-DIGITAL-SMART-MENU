-- Parcel / takeaway orders (P01)
--
-- A parcel is a table_sessions row with NO table: session_type = 'parcel',
-- table_id NULL, identified by a per-day token number instead of a table
-- number. Everything downstream (orders, order_items, bills, print_jobs)
-- already keys off session_id, so parcels reuse the whole ordering pipeline
-- and land in the daily reports without any further change.

-- ============================================================
-- 1. table_sessions — session_type + token_number
-- ============================================================

alter table public.table_sessions
  add column if not exists session_type text not null default 'dine_in',
  add column if not exists token_number integer;

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.table_sessions'::regclass
      and conname  = 'table_sessions_session_type_check'
  ) then
    alter table public.table_sessions add constraint table_sessions_session_type_check
      check (session_type in ('dine_in', 'parcel'));
  end if;
end $$;

-- A dine-in session must have a table; a parcel must not. Added NOT VALID so
-- the migration cannot fail on any legacy row with a null table_id — the rule
-- is enforced on every new and updated row from here on.
do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.table_sessions'::regclass
      and conname  = 'table_sessions_table_matches_type_check'
  ) then
    alter table public.table_sessions add constraint table_sessions_table_matches_type_check
      check (
        (session_type = 'dine_in' and table_id is not null)
        or (session_type = 'parcel' and table_id is null)
      ) not valid;
  end if;
end $$;

-- ============================================================
-- 2. One-active-session-per-table index — dine-in only
-- ============================================================

-- Postgres already treats multiple NULL table_id rows as distinct, so parcels
-- would not collide either way. Scoping the index to dine_in makes that
-- intent explicit and keeps the constraint meaningful if table_id ever gains
-- a non-null default.
drop index if exists public.table_sessions_one_active_per_table;
create unique index if not exists table_sessions_one_active_per_table
  on public.table_sessions (table_id)
  where status = 'active' and session_type = 'dine_in';

-- Live-parcel lookups for the captain panel (getParcelSessions)
create index if not exists table_sessions_parcel_live_idx
  on public.table_sessions (restaurant_id, status)
  where session_type = 'parcel';

-- ============================================================
-- 3. Daily token counter
-- ============================================================

-- One row per restaurant per IST day. Incremented atomically by
-- next_parcel_token() so two captains tapping "New Parcel" at the same
-- moment can never be handed the same token.
create table if not exists public.parcel_counters (
  restaurant_id uuid not null references public.restaurants(id),
  token_date    date not null,
  counter       integer not null default 0,
  primary key (restaurant_id, token_date)
);

alter table public.parcel_counters enable row level security;
-- No policies by design: service-role access only, same as print_jobs.

create or replace function public.next_parcel_token(p_restaurant_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_day   date := (now() at time zone 'Asia/Kolkata')::date;
  v_token integer;
begin
  insert into public.parcel_counters (restaurant_id, token_date, counter)
  values (p_restaurant_id, v_day, 1)
  on conflict (restaurant_id, token_date)
  do update set counter = public.parcel_counters.counter + 1
  returning counter into v_token;

  return v_token;
end;
$$;

-- Token allocation is a staff action performed through the service-role
-- client; no browser role may call it.
--
-- Order matters: EXECUTE on a function is granted to PUBLIC by default, and
-- service_role inherits it that way. Revoking from PUBLIC therefore locks out
-- service_role too, so the grant below must follow the revokes — without it
-- createParcelSession fails with "Failed to allocate a parcel token".
revoke all on function public.next_parcel_token(uuid) from public;
revoke all on function public.next_parcel_token(uuid) from anon;
revoke all on function public.next_parcel_token(uuid) from authenticated;
grant execute on function public.next_parcel_token(uuid) to service_role;
