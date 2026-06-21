# T09 — Order confirmation screen (C3)

**Day 2 · Phase 2/5 · depends on: T08 · unblocks: reorder UX**

## Goal
Final screen after placing an order: confirm success, list items, prominently remind the PIN for reordering, and (optionally) reflect approval status live.

## Files
- `components/OrderConfirmation.tsx` — new. Props: `{ items:[{name,quantity,price}], pin, tableNumber }`.
- Optional: subscribe (Supabase Realtime) to this order's `status` to flip the UI on approval.

## Logic
1. "Order placed!" heading (light celebratory feel).
2. List ordered items with qty + price.
3. Reminder box: "Your table PIN is **[PIN]** — remember this to order more later."
4. Hint: "Want to order more? Scan the QR again and enter your PIN."
5. (Optional) status pill: "Pending approval" → "Sent to kitchen ✅" when `orders.status` becomes `approved` (Realtime).
6. No further action required (end of flow). Dark + gold style.

## Test
- After checkout → confirmation shows correct items + PIN.
- (If Realtime wired) admin approves → pill flips to "Sent to kitchen".

## Definition of Done
- [ ] items + totals shown
- [ ] prominent PIN reminder
- [ ] reorder instructions
- [ ] (optional) live pending→approved status
