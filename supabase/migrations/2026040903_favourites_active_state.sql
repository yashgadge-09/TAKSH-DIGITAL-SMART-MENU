-- Persist favourite on/off state so removals are reflected in analytics.
-- Apply after 2026040902_favourites_session_dedupe.sql.

alter table public.favourites
  add column if not exists is_active boolean;

update public.favourites
set is_active = true
where is_active is null;

alter table public.favourites
  alter column is_active set not null,
  alter column is_active set default true;

alter table public.favourites
  add column if not exists updated_at timestamptz;

update public.favourites
set updated_at = coalesce(updated_at, created_at, now())
where updated_at is null;

alter table public.favourites
  alter column updated_at set not null,
  alter column updated_at set default now();

create index if not exists idx_favourites_is_active
  on public.favourites (is_active);

create index if not exists idx_favourites_updated_at
  on public.favourites (updated_at desc);
