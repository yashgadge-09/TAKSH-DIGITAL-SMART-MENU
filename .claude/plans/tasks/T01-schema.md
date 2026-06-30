# T01 — Schema verify + migrate

**Day 1 · Phase 1/cross-cutting · depends on: nothing · unblocks: T02–T05, T11, T12, T13**

## Goal
Converge the live Supabase DB to the ordering schema **with the approval fix** (`orders.status` default `pending_approval` + status check), and capture the already-applied schema as a repo migration for reproducibility.

## ✅ Verified live state — MCP run 2026-06-21
The schema was built directly via dashboard/MCP (no repo migrations existed). Almost everything the original plan called for is **already done**. Verified findings:

| Item | Status |
|---|---|
| All 8 ordering tables exist, columns per spec | ✅ done |
| RLS **enabled** on all 8 | ✅ done |
| RLS **policies** (7 tables: public INSERT+SELECT, authenticated UPDATE+DELETE; `print_jobs`: public INSERT only) | ✅ done — match spec |
| Realtime on `orders` + `table_sessions` (`supabase_realtime` publication) | ✅ done |
| `restaurant_tables` `UNIQUE(restaurant_id, table_number)` (`unique_restaurant_table`) | ✅ done |
| `table_sessions.status` default `active` + check `(active\|bill_generated\|closed)` | ✅ done |
| Seed: restaurant `TAKSH Veg` / slug `taksh` / `takshveg@ybl` / gstin `27AAAAA1111A1Z1` | ✅ done (id `c7b441fe-8639-4540-b78b-cb16744234ab`) |
| Seed: tables | ✅ **16 tables (1–16)** already seeded (plan said 1–10 — more is fine) |
| **`orders.status` default = `pending_approval`** | ❌ **default is `'received'`, NO check constraint** |

> **Net remaining DB work = the approval fix on `orders` only.** Everything else is a no-op convergence.

## Files
- `supabase/migrations/<timestamp>_ordering_system.sql` — **idempotent** (`create table if not exists`, `alter ... add column if not exists`, guarded constraint/policy creation via `DO $$ ... IF NOT EXISTS`). It documents the full ordering schema for version control (none exists in-repo today) and **safely re-applies** against the already-built DB. The only statement that actually changes live data is the `orders` status fix below.

## The one effective change — orders approval fix
```sql
alter table orders alter column status set default 'pending_approval';
-- guarded: add check only if absent
do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'orders'::regclass and conname = 'orders_status_check'
  ) then
    alter table orders add constraint orders_status_check
      check (status in ('pending_approval','approved','rejected','served'));
  end if;
end $$;
```
> ⚠️ `orders` currently has **0 rows**, so the check constraint adds cleanly with no backfill needed. If any legacy `received` rows appear before this runs, normalize them first (`update orders set status='pending_approval' where status='received'`).

> Note for T03: until this migration is applied, the DB default is still `received`. `placeOrder` **must explicitly set `status='pending_approval'`** regardless of the column default — do not rely on it.

## Tables / columns (reference — already live, included in migration for idempotent converge)
- `restaurants(id uuid pk default gen_random_uuid(), name text not null, slug text unique not null, address text, gstin text, upi_id text, created_at timestamptz default now())`
- `restaurant_tables(id uuid pk, restaurant_id uuid → restaurants, table_number int, unique(restaurant_id, table_number))`
- `table_sessions(id uuid pk, restaurant_id uuid → restaurants, table_id uuid → restaurant_tables, pin text, status text default 'active' check in (active|bill_generated|closed), opened_at timestamptz default now(), closed_at timestamptz)`
- `customers(id uuid pk, restaurant_id uuid → restaurants, name text not null, phone text, whatsapp_opted_in bool default false, created_at timestamptz default now())`
- `orders(id uuid pk, session_id uuid → table_sessions, customer_id uuid → customers, round_number int, status text default 'pending_approval' check in (pending_approval|approved|rejected|served), placed_at timestamptz default now())`
- `order_items(id uuid pk, order_id uuid → orders, dish_id uuid → dishes, name text, price numeric, quantity int)`
- `bills(id uuid pk, session_id uuid → table_sessions, subtotal numeric, gst_amount numeric, total numeric, generated_at timestamptz default now())`
- `print_jobs(id uuid pk, restaurant_id uuid → restaurants, type text check in (kot|bill), payload jsonb, status text default 'pending' check in (pending|sent|failed), created_at timestamptz default now())`

## RLS (already live — re-assert idempotently)
- RLS enabled on all 8.
- Customer-facing (`restaurants, restaurant_tables, table_sessions, customers, orders, order_items, bills`): public (anon) **INSERT + SELECT**; **UPDATE/DELETE authenticated only**.
- `print_jobs`: public **INSERT** only; **SELECT/UPDATE service-role only** (no SELECT/UPDATE policy → service role bypasses RLS).
- Realtime on `table_sessions` + `orders` — already in publication.

## Seed (already live — keep ON CONFLICT guards)
- `restaurants`: `TAKSH Veg` / `taksh` / `Chinchwad, Pune` / `27AAAAA1111A1Z1` / `takshveg@ybl` — `ON CONFLICT (slug) DO UPDATE`.
- `restaurant_tables`: ensure 1–10 exist for that restaurant — `ON CONFLICT (restaurant_id, table_number) DO NOTHING`. (16 already present; this is a no-op.)

## Test (MCP `execute_sql`)
- `select` from each of the 8 tables (no error). ✅ already confirmed.
- **Confirm `orders` default = `pending_approval`** (the actual change) + `orders_status_check` present.
- Confirm `table_sessions` + `orders` in `supabase_realtime` publication. ✅
- Confirm restaurant slug `taksh` + tables seeded. ✅

## Definition of Done
- [x] All 8 tables present with correct columns *(verified live)*
- [x] **`orders.status` default = `pending_approval` + check constraint** *(applied 2026-06-21, migration version `20260621154153`)*
- [x] RLS policies as specified *(verified live)*
- [x] Realtime enabled on `table_sessions` + `orders` *(verified live)*
- [x] `TAKSH Veg` + tables seeded *(verified live — 16 tables)*
- [x] Migration committed to `supabase/migrations/2026062101_ordering_system.sql` and applied idempotently
