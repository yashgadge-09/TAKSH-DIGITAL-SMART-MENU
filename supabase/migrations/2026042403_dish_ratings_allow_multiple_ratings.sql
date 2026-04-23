-- Allow multiple ratings per dish across time/sessions so averages are truly aggregated.

-- Remove constraint-like unique index that caused latest rating to overwrite prior ratings.
drop index if exists public.idx_dish_ratings_dish_session_unique;

-- Keep a normal lookup index for analytics and filtering.
create index if not exists idx_dish_ratings_dish_session
  on public.dish_ratings (dish_id, session_id);
