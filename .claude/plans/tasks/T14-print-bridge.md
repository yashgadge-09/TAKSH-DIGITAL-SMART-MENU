# T14 — Print bridge (mock mode) (P1)

**Day 3 · Phase 4 · depends on: T01, T04 (KOT), T05 (bill) · unblocks: T16 QA**

## Goal
A standalone Node.js (TypeScript) script — NOT part of Next.js — that polls `print_jobs` and "prints" pending jobs. Mock mode first (console), real ESC/POS later.

## Files
- `print-bridge/index.ts` — new (standalone)
- `print-bridge/.env.example` — `MOCK_PRINT=true`, Supabase URL + **service role key**, `KITCHEN_PRINTER_IP`, `RECEPTION_PRINTER_IP`
- `print-bridge/package.json` (own deps: `@supabase/supabase-js`, `dotenv`)

## Logic
1. Supabase client with **service role key** (elevated read/update on `print_jobs`).
2. Every 2s: query `print_jobs` where `status='pending'`, order by `created_at` asc.
3. Per job:
   - `MOCK_PRINT=true` → log formatted receipt to console (KOT/bill formats per PRD §P1).
   - else → TCP socket to printer IP (`KITCHEN_PRINTER_IP` for kot, `RECEPTION_PRINTER_IP` for bill) port 9100, send ESC/POS, close.
4. On success → `update({status:'sent'}).eq('id', job.id)`.
5. On failure → `status='failed'`, log error, **keep the loop running** (never crash).

## Mock formats (must match payloads from T04/T05)
- KOT: table, round, time, `qty x name` lines.
- Bill: restaurant header, table/customer, rounds with `qty x name  ₹amount`, subtotal, GST, total, UPI.

## Test
- `MOCK_PRINT=true`, run bridge → approve an order (T11) → KOT prints to console, row → `sent`.
- Generate a bill (T12) → bill prints to console, row → `sent`.

## Definition of Done
- [ ] polls pending every 2s with service role
- [ ] mock KOT + bill console formats correct
- [ ] status → sent / failed
- [ ] loop survives errors (no crash)
