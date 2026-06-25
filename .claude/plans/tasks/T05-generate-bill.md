# T05 — generateBill (server action)

**Day 1 · Phase 6 · depends on: T01, T03 · unblocks: T12, T13**

## Goal
Aggregate every item across all rounds of a session, compute GST, persist the bill, queue a bill print job, and flip the session to `bill_generated`.

## Files
- `lib/database.ts` — add `generateBill({ sessionId })` (`"use server"`, service-role client).

## Data model note (verified live in T01)
- `round_number` and `placed_at` live on **`orders`**; `order_items` has no round/time of its own — it inherits them from its parent order (`order_items.order_id` → `orders`).
- Bill items therefore come from joining `order_items` back to their `orders` row for `round_number` + `placed_at`.

## Logic
1. Fetch session; fetch all `orders` for the session **excluding `status='rejected'`** (bill only `approved`/`served`); fetch all `order_items` for those orders.
   - **Required, not optional** — rejected orders must never appear on the bill (see DoD).
   - Optional guard: if `table_sessions.status` is already `bill_generated`, skip re-billing / return the existing bill (avoid duplicate bill rows + print jobs).
2. Group items by their parent order's `round_number` → `rounds: [{ number, time (from orders.placed_at, IST), items: [{ name, qty, price }] }]`.
3. Compute:
   - `subtotal = Σ (price * quantity)`
   - `gstRate = 5` (hardcoded for v1)
   - `gstAmount = subtotal * gstRate/100`
   - `total = subtotal + gstAmount`
4. Look up customer name (most recent order's `customer_id`) + restaurant `name/address/gstin/upi_id`.
5. Insert `bills` (`session_id, subtotal, gst_amount, total`).
6. Insert `print_jobs`:
   - `type: 'bill'`
   - `payload: { restaurantName, address, gstin, upiId, tableNumber, customerName, rounds, subtotal, gstRate, gstAmount, total }`
   - `status: 'pending'`
7. Update `table_sessions.status = 'bill_generated'`.
8. Return `{ billId, total }`.

## Test (direct call)
- Seed a session with 2 rounds → `subtotal`, `gstAmount`, `total` correct.
- One `bills` row + one `bill` print_jobs row created.
- Session status → `bill_generated`.

## Definition of Done
- [x] Totals (subtotal/GST/total) correct across rounds (GST 5%, rounded to paisa)
- [x] `bills` row + `bill` print job created
- [x] Session flipped to `bill_generated`
- [x] Rejected orders excluded from total (`.neq('status','rejected')`)
- [x] Idempotency guard: already-billed session returns existing bill, no duplicates

**Implemented:** `lib/database.ts` — `generateBill`. Applied 2026-06-21.
