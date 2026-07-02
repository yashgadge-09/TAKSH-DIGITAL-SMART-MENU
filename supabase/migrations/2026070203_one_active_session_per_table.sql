-- Guarantee at most ONE active session per table.
--
-- Problem: two guests who scan the same table QR within milliseconds both run
-- joinTable()/createOrJoinSession(), both read "no active session", and both
-- INSERT a new session — producing two hosts and two different PINs for one
-- table. A read-then-write check in application code cannot close this race.
--
-- Fix: a partial unique index on (table_id) WHERE status = 'active'. The second
-- concurrent INSERT now fails with a unique-violation (SQLSTATE 23505); the
-- application catches that, re-reads the winning session, and joins it via PIN.

-- ============================================================
-- 1. CLEAN UP ANY EXISTING DUPLICATE ACTIVE SESSIONS
--    (index creation fails if duplicates already exist)
--    Keep the earliest-opened active session per table; close the rest.
-- ============================================================

with ranked as (
  select
    id,
    row_number() over (
      partition by table_id
      order by opened_at asc, id asc
    ) as rn
  from public.table_sessions
  where status = 'active'
)
update public.table_sessions ts
set status = 'closed'
from ranked
where ts.id = ranked.id
  and ranked.rn > 1;

-- ============================================================
-- 2. PARTIAL UNIQUE INDEX — one active session per table
-- ============================================================

create unique index if not exists table_sessions_one_active_per_table
  on public.table_sessions (table_id)
  where status = 'active';
