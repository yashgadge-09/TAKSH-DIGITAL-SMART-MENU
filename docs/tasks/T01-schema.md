# T01 — Schema verify + migrate

**Day 1 · Phase 1/cross-cutting · depends on: nothing · unblocks: T02–T05, T11, T12, T13**

## Goal
Converge the live Supabase DB to the ordering schema **with the approval fix** (`orders.status` default `pending_approval`), enable Realtime, and seed the restaurant + 10 tables.

## Pre-step (Supabase MCP — do first)
1. `list_tables` — confirm which of the 8 ordering tables already exist and their exact columns.
2. `list_edge_functions` — if a `place-order` (or any ordering) function exists, read it (`get_edge_function`) and **note the divergence** (esp. whether it creates `print_jobs` immediately — the flagged gap).
3. Reconcile findings with the schema below before writing the migration.

> MCP was disconnected during planning — this verification is mandatory before any code depends on the schema.

## Files
- `supabase/migrations/<timestamp>_ordering_system.sql` — **idempotent** (`create table if not exists`, `alter ... add column if not exists`, guarded constraint/policy creation) so it safely converges whatever already exists.

## Tables / columns
- `restaurants(id uuid pk default gen_random_uuid(), name text not null, slug text unique not null, address text, gstin text, upi_id text, created_at timestamptz default now())`
- `restaurant_tables(id uuid pk, restaurant_id uuid → restaurants, table_number int, unique(restaurant_id, table_number))`
- `table_sessions(id uuid pk, restaurant_id uuid → restaurants, table_id uuid → restaurant_tables, pin text, status text default 'active' check in (active|bill_generated|closed), opened_at timestamptz default now(), closed_at timestamptz)`
- `customers(id uuid pk, restaurant_id uuid → restaurants, name text not null, phone text, whatsapp_opted_in bool default false, created_at timestamptz default now())`
- `orders(id uuid pk, session_id uuid → table_sessions, customer_id uuid → customers, round_number int, status text default 'pending_approval' check in (pending_approval|approved|rejected|served), placed_at timestamptz default now())`
- `order_items(id uuid pk, order_id uuid → orders, dish_id uuid → dishes, name text, price numeric, quantity int)`
- `bills(id uuid pk, session_id uuid → table_sessions, subtotal numeric, gst_amount numeric, total numeric, generated_at timestamptz default now())`
- `print_jobs(id uuid pk, restaurant_id uuid → restaurants, type text check in (kot|bill), payload jsonb, status text default 'pending' check in (pending|sent|failed), created_at timestamptz default now())`

> ⚠️ Approval fix: `orders.status` default **MUST** be `pending_approval` (not `received`). If the live table already defaults to `received`, `alter column ... set default 'pending_approval'`.

## RLS
- Enable RLS on all 8 tables.
- Customer-facing (`restaurants, restaurant_tables, table_sessions, customers, orders, order_items, bills`): allow public (anon) **INSERT + SELECT**; **UPDATE/DELETE admin/authenticated only**.
- `print_jobs`: public **INSERT** only; **SELECT/UPDATE service-role only** (print bridge uses service role).
- **Enable Realtime** on `table_sessions` and `orders` (add to `supabase_realtime` publication).

## Seed (S2)
- Insert `restaurants`: name `TAKSH Veg`, slug `taksh`, address `Chinchwad, Pune`, gstin `27AAAAA1111A1Z1`, upi_id `takshveg@ybl` — `ON CONFLICT (slug) DO UPDATE`.
- Insert `restaurant_tables` 1–10 for that restaurant — `ON CONFLICT (restaurant_id, table_number) DO NOTHING`.

## Test
- MCP `execute_sql`: `select` from each of the 8 tables (no error).
- Confirm `orders` column default = `pending_approval`.
- Confirm `table_sessions` + `orders` are in the `supabase_realtime` publication.
- Confirm 1 restaurant (slug `taksh`) + 10 tables seeded.

## Definition of Done
- [ ] All 8 tables present with correct columns
- [ ] `orders.status` default = `pending_approval`
- [ ] RLS policies as specified
- [ ] Realtime enabled on `table_sessions` + `orders`
- [ ] `TAKSH Veg` + tables 1–10 seeded
- [ ] Migration is idempotent (safe re-run)
