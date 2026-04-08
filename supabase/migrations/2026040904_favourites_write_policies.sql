-- Allow favourite toggle state changes under RLS.
-- Apply after 2026040903_favourites_active_state.sql.

alter table public.favourites enable row level security;

-- Required for upsert conflict updates (on dish_id, session_id).
do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'favourites'
      and policyname = 'favourites_update_all'
  ) then
    create policy favourites_update_all on public.favourites
      for update to anon, authenticated
      using (true)
      with check (true);
  end if;
end $$;

-- Required for fallback delete path when older schema is still active.
do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'favourites'
      and policyname = 'favourites_delete_all'
  ) then
    create policy favourites_delete_all on public.favourites
      for delete to anon, authenticated
      using (true);
  end if;
end $$;
