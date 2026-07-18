-- Migration: PIN brute-force throttling (security fix #5)
-- Target: Supabase Postgres
--
-- A table session's PIN is only 4 digits (~10k combinations), so without a
-- lockout it can be brute-forced in seconds. These columns let the app track
-- failed PIN attempts per session and lock PIN entry for a cooldown window once
-- the limit is hit (see registerPinFailure / isPinLocked in lib/database.ts).
-- Both columns are written only via the service-role Server Actions.

alter table public.table_sessions
  add column if not exists pin_failed_attempts integer not null default 0,
  add column if not exists pin_locked_until timestamptz;
