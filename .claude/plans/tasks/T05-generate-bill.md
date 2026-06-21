# T05 — generateBill (server action)

**Day 1 · Phase 6 · depends on: T01, T03 · unblocks: T12, T13**

## Goal
Aggregate every item across all rounds of a session, compute GST, persist the bill, queue a bill print job, and flip the session to `bill_generated`.

## Files
- `lib/database.ts` — add `generateBill({ sessionId })` (`"use server"`, service-role client).

## Logic
1. Fetch session; fetch all `orders` for the session; fetch all `order_items` for those orders.
   - Optionally exclude `rejected` orders from billing (bill only `approved`/`served`).
2. Group items by `round_number` → `rounds: [{ number, time, items: [{ name, qty, price }] }]`.
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
- [ ] Totals (subtotal/GST/total) correct across rounds
- [ ] `bills` row + `bill` print job created
- [ ] Session flipped to `bill_generated`
- [ ] Rejected orders excluded from total
