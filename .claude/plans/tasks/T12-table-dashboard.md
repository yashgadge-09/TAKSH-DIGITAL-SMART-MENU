# T12 — Live table dashboard + Realtime + drawer (D2)

**Day 3 · Phase 6 · depends on: T05, T10 · unblocks: billing flow**

## Goal
A live grid of all tables with status + running totals, and a drawer to Generate Bill / Close Table.

## Files
- `app/admin/tables/page.tsx` — new (client component).
- Drawer component (inline or `components/TableDetailDrawer.tsx`).

## Logic
1. Fetch `restaurant_tables`; for each, latest `table_sessions` (status `active`/`bill_generated` → show; else OPEN).
2. For active sessions: fetch `orders` + `order_items` → running total, item list, customer, elapsed time.
3. Cards (responsive 3/4 cols): table #, status badge (OPEN=grey, ACTIVE=green, BILL GENERATED=orange), total + customer + elapsed.
4. Top summary bar: total billed today, tables served today, active count.
5. **Realtime:** subscribe to `table_sessions` (INSERT/UPDATE) and `orders` (INSERT) filtered by restaurant; refresh affected card. **Unsubscribe on unmount.**
6. **Drawer on card click:** rounds grouped by `round_number` + running total.
   - status `active` → **Generate Bill** → `generateBill({ sessionId })` (or `supabase.functions.invoke` if function path chosen — but we use the server action).
   - status `bill_generated` → **Close Table** → update `table_sessions.status='closed'`.

## Test
- Place/approve an order → table card updates total live.
- Generate Bill → bill prints (T14) + status → BILL GENERATED.
- Close Table → returns to OPEN.

## Definition of Done
- [ ] grid + status badges + running totals + summary bar
- [ ] Realtime updates (sessions + orders), cleaned up on unmount
- [ ] Generate Bill works
- [ ] Close Table works
