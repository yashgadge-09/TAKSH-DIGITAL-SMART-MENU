-- Tracks which devices have been PIN-verified into a table_sessions row.
-- Host is auto-added on session creation; other devices must supply the
-- correct PIN once (via joinTable's pinAttempt) before being appended here.
alter table public.table_sessions
  add column if not exists joined_device_ids text[] not null default '{}';
