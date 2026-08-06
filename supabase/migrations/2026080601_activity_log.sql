-- Activity log — immutable audit trail of staff actions (A01)
--
-- Every action that can move money on a live order (item edits/removals,
-- bill print/reprint/settle, table moves, force resets, parcel cancels,
-- captain-started orders) writes one row here from inside the server action
-- itself — if the action ran, the entry exists. The admin reviews it on
-- /admin/activity; captains have no access at all.
--
-- Deliberately NO foreign keys: an audit row must survive any cleanup of the
-- data it describes (orders are deleted on rollback paths, order_items on
-- removal). Referential integrity is the job of the live tables, not the log.

create table if not exists public.activity_log (
  id            uuid primary key default gen_random_uuid(),
  restaurant_id uuid,
  actor_id      uuid,          -- auth.users id; null for guest-triggered actions
  actor_email   text,
  actor_role    text not null default 'guest'
                check (actor_role in ('admin', 'captain', 'guest')),
  action        text not null
                check (action in (
                  'order_started', 'item_added', 'item_qty_changed', 'item_removed',
                  'bill_printed', 'bill_reprinted', 'bill_settled', 'table_moved',
                  'order_approved', 'order_rejected', 'parcel_cancelled', 'force_reset'
                )),
  session_id    uuid,
  order_id      uuid,
  label         text,          -- snapshot at log time: 'Table 6' / 'Parcel #7'
  dish_name     text,
  qty_before    integer,
  qty_after     integer,
  amount_delta  numeric,       -- signed ₹ impact of the action (negative = money removed)
  reason        text,          -- removal reason picked by staff
  details       jsonb,
  created_at    timestamptz not null default now()
);

-- The admin activity page reads by restaurant + time range, newest first.
create index if not exists activity_log_restaurant_time_idx
  on public.activity_log (restaurant_id, created_at desc);

alter table public.activity_log enable row level security;
-- No policies by design: service-role only, same as print_jobs. The browser
-- clients (anon AND authenticated) can neither read nor write it, and the
-- application has no UPDATE/DELETE path — entries are immutable once written.

-- Belt and braces: even if a permissive policy is ever added by mistake, the
-- app roles hold no UPDATE/DELETE privilege on the table.
revoke update, delete on public.activity_log from anon, authenticated;
