# T06 — Table entry route `/[slug]/table/[number]` (Phase 1)

**Day 2 · Phase 1 · depends on: T01 · unblocks: T07, T08**

## Goal
Close the missing Phase-1 gap: a QR-scannable per-table URL that resolves the restaurant + table and makes those ids available to the existing menu/cart/order flow.

## Files
- `app/[slug]/table/[number]/page.tsx` — resolve restaurant by `slug` + table by `number`, then render the existing menu UI.
- `context/TableSessionContext.tsx` — new provider holding `{ restaurantId, tableId, tableNumber, slug }` for downstream consumers (OrderFlow/checkout).
- Wire the provider into the menu render path (reuse the existing `/menu` components — do not duplicate the catalog).

## Logic
1. Look up `restaurants` by `slug` and `restaurant_tables` by `(restaurant_id, table_number)` — via a small server action or server-component read.
2. Put ids into `TableSessionContext`.
3. Invalid slug/table → friendly "Table not found" screen.

## Test
- Visit `/taksh/table/3` → existing menu renders; `restaurantId/tableId/tableNumber` available downstream.
- Visit `/taksh/table/999` (nonexistent) → graceful error, no crash.

## Definition of Done
- [ ] restaurant + table resolved from URL
- [ ] ids exposed via TableSessionContext
- [ ] existing menu reused (not re-built)
- [ ] invalid table handled gracefully
