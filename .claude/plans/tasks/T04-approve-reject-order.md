# T04 — approveOrder / rejectOrder (server actions) — NEW (Phase 3)

**Day 1 · Phase 3 · depends on: T01, T03 · unblocks: T11**

## Goal
Implement the captain/owner approval step. **`approveOrder` is the ONLY thing in the whole system that creates a KOT `print_jobs` row.** This is the human gate the diagram requires before anything reaches the kitchen.

## Files
- `lib/database.ts` — add `approveOrder(orderId)` and `rejectOrder(orderId)` (`"use server"`, service-role client).

## Data model note (verified live in T01)
- `round_number` lives on the **`orders`** row itself (not the session).
- `table_number` path: `orders.session_id` → `table_sessions.table_id` → `restaurant_tables.table_number`.
- `restaurant_id` is available on `table_sessions` (and on `restaurant_tables`).

## Logic
### approveOrder(orderId)
1. Load the order (`status`, `round_number`, `session_id`) + its `order_items`. From `session_id`, load `table_sessions` (`restaurant_id`, `table_id`), then `restaurant_tables.table_number`.
2. **Idempotency guard:** only proceed if `orders.status = 'pending_approval'`. If already `approved`/`rejected`/`served`, throw/return without creating a print job (prevents a second KOT).
3. Update `orders.status = 'approved'`.
4. Insert `print_jobs`:
   - `type: 'kot'`
   - `restaurant_id`
   - `payload: { tableNumber, roundNumber, time: "HH:MM" (IST), items: [{ name, qty: quantity }] }`
   - `status: 'pending'`
5. Return `{ orderId, status:'approved' }`.

### rejectOrder(orderId)
1. **Idempotency guard:** only proceed if `orders.status = 'pending_approval'`.
2. Update `orders.status = 'rejected'`.
3. **No `print_jobs` insert.**
4. Return `{ orderId, status:'rejected' }`.

## Test (direct call)
- `approveOrder` → order `approved` **and exactly one** `kot` print_jobs row created (verify count delta = 1).
- `approveOrder` **again** on the same order → no-op, **no** second KOT (count delta = 0).
- `rejectOrder` → order `rejected`, **no** print_jobs created (count delta = 0).

## Definition of Done
- [x] approve sets `approved` + creates exactly 1 KOT print job
- [x] **double-approve is a no-op (idempotent) — never a second KOT** (already-`approved` returns; `rejected`/`served` throws)
- [x] reject sets `rejected` + creates 0 print jobs (idempotent on double-reject)
- [x] KOT payload shape matches print-bridge expectation (T14): `{ tableNumber, roundNumber, time, items:[{name,qty}] }`

**Implemented:** `lib/database.ts` — `approveOrder` / `rejectOrder` + `formatTimeIST` helper. Applied 2026-06-21.
