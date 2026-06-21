# T04 — approveOrder / rejectOrder (server actions) — NEW (Phase 3)

**Day 1 · Phase 3 · depends on: T01, T03 · unblocks: T11**

## Goal
Implement the captain/owner approval step. **`approveOrder` is the ONLY thing in the whole system that creates a KOT `print_jobs` row.** This is the human gate the diagram requires before anything reaches the kitchen.

## Files
- `lib/database.ts` — add `approveOrder(orderId)` and `rejectOrder(orderId)` (`"use server"`, service-role client).

## Logic
### approveOrder(orderId)
1. Load the order + its `order_items` + the session's `table_number` + `restaurant_id` + `round_number`.
2. Update `orders.status = 'approved'`.
3. Insert `print_jobs`:
   - `type: 'kot'`
   - `restaurant_id`
   - `payload: { tableNumber, roundNumber, time: "HH:MM", items: [{ name, qty: quantity }] }`
   - `status: 'pending'`
4. Return `{ orderId, status:'approved' }`.

### rejectOrder(orderId)
1. Update `orders.status = 'rejected'`.
2. **No `print_jobs` insert.**
3. Return `{ orderId, status:'rejected' }`.

## Test (direct call)
- `approveOrder` → order `approved` **and exactly one** `kot` print_jobs row created (verify count delta = 1).
- `rejectOrder` → order `rejected`, **no** print_jobs created (count delta = 0).

## Definition of Done
- [ ] approve sets `approved` + creates exactly 1 KOT print job
- [ ] reject sets `rejected` + creates 0 print jobs
- [ ] KOT payload shape matches print-bridge expectation (T14)
