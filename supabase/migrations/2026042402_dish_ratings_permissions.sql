-- Ensure runtime roles can write/read dish ratings (fixes 42501 on upsert).

do $$
begin
  if to_regclass('public.dish_ratings') is not null then
    grant select, insert, update on table public.dish_ratings to anon, authenticated;
  end if;

  if to_regclass('public.dish_ratings_id_seq') is not null then
    grant usage, select on sequence public.dish_ratings_id_seq to anon, authenticated;
  end if;
end $$;
