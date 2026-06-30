# T03 — placeOrder (server action) — FIXED (no auto-print)

**Day 1 · Phase 2 · depends on: T01 · unblocks: T08, T11**

## Goal
Persist a customer's order as **`pending_approval`**, snapshotting live name/price, and compute the round number. **It must NOT create any `print_jobs` row** — that only happens on approval (T04). This is the core fix for the flagged gap.

## Files
- `lib/database.ts` — add `placeOrder({ sessionId, customerId, restaurantId, tableNumber, items: [{ dishId, quantity }] })` (`"use server"`, service-role client).

## Logic
1. For each `dishId`, read current `dishes.name_en` and `dishes.price` (snapshot at order time).
2. `round_number` = (max `round_number` for this `sessionId` in `orders`) + 1; if none, `1`.
3. Insert `orders` row: `session_id, customer_id, round_number, status = 'pending_approval'`.
4. Insert one `order_items` row per item: `order_id, dish_id, name (snapshot), price (snapshot), quantity`.
5. **Do NOT touch `print_jobs`.**
6. Return `{ orderId, roundNumber }`.

## Test (direct call)
- Order created with `status = 'pending_approval'`.
- Item name/price match the snapshot (change a dish price afterward → order_items unchanged).
- Second call same session → `round_number` increments.
- **`select count(*) from print_jobs` is unchanged** (zero created).

## Definition of Done
- [x] Order saved as `pending_approval` (explicit — does not rely on column default)
- [x] `round_number` increments per session (max existing + 1, starts at 1)
- [x] name/price snapshotted into `order_items` from `dishes.name_en` / `dishes.price` at call time
- [x] **Zero `print_jobs` created by this function**

**Implemented:** `lib/database.ts:1209` — `placeOrder`. Applied 2026-06-21.
