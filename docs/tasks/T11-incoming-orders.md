# T11 — Incoming Orders panel (Phase 3 UI — the gap fix)

**Day 3 · Phase 3 · depends on: T04, T10 · unblocks: kitchen flow**

## Goal
The visible human-approval gate the diagram requires: a live queue of `pending_approval` orders that the owner Approves or Rejects. **Approve is what fires the KOT** (via `approveOrder`, T04). Nothing reaches the kitchen without passing through here.

## Files
- `app/admin/incoming/page.tsx` — new (client component for Realtime).

## Logic
1. Initial fetch: `orders` where `status='pending_approval'` (+ join `order_items`, table number, customer).
2. **Realtime:** `supabase.channel('admin-incoming').on('postgres_changes', { event:'*', schema:'public', table:'orders' }, …)` — add new pending orders live, remove on status change.
3. Each card: table #, round #, items + qty, time, customer.
4. **Approve** → `approveOrder(orderId)` → card leaves queue (and KOT prints via bridge).
5. **Reject** → `rejectOrder(orderId)` → card leaves queue, no KOT.
6. **`channel.unsubscribe()` on unmount** (avoid duplicate events / leaks).

## Test
- Place an order (customer flow or `placeOrder`) → appears in panel live (no refresh).
- Approve → leaves queue; print bridge (T14, mock) shows the KOT.
- Reject → leaves queue; no KOT printed.

## Definition of Done
- [ ] live pending list via Realtime
- [ ] Approve fires exactly one KOT and clears the card
- [ ] Reject clears the card with no KOT
- [ ] channel cleaned up on unmount
