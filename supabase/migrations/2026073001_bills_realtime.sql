-- Live revenue dashboard (/admin/analytics): stream bills changes to the admin
-- browser so settling a bill updates the tiles/chart without a manual refresh.
-- RLS still applies to Realtime delivery — the existing "Admins read bills"
-- SELECT policy keeps captains from receiving these events.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'bills'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.bills;
  END IF;
END $$;
