-- Enforce one favourite per dish per browser session.
-- This migration is additive and safe to apply after 2026040901_analytics_events.sql.

alter table public.favourites
  add column if not exists session_id text;

alter table public.favourites
  add column if not exists user_id text;

-- Backfill legacy rows so session_id can be non-null without losing old analytics records.
update public.favourites
set session_id = 'legacy-' || id::text
where session_id is null;

alter table public.favourites
  alter column session_id set not null;

-- Remove accidental duplicates before enforcing uniqueness.
with ranked as (
  select
    id,
    row_number() over (
      partition by dish_id, session_id
      order by created_at asc, id asc
    ) as rn
  from public.favourites
)
delete from public.favourites f
using ranked r
where f.id = r.id
  and r.rn > 1;

create unique index if not exists idx_favourites_dish_session_unique
  on public.favourites (dish_id, session_id);

create index if not exists idx_favourites_session_id
  on public.favourites (session_id);

create index if not exists idx_favourites_user_id
  on public.favourites (user_id);
