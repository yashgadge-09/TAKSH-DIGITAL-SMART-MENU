-- Brute-force protection for the 4-digit table join PIN. A 4-digit PIN is only
-- 10k combinations; without a lockout an attacker could script createOrJoinSession
-- / joinTable and enumerate a table's PIN to hijack its shared cart / order on its
-- tab. These columns let the app lock a session's PIN after repeated failures.
-- Store-backed (Postgres) so the limit holds across all serverless instances.
alter table public.table_sessions
  add column if not exists pin_failed_attempts integer not null default 0,
  add column if not exists pin_locked_until timestamptz;
