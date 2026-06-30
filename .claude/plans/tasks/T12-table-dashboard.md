# T12 — Live table dashboard + Realtime + drawer (D2)

**Day 3 · Phase 6 · depends on: T05, T10 · unblocks: billing flow**

## Goal
A live grid of all tables with status + running totals, and a drawer to Generate Bill / Close Table.

## Files
- `app/admin/tables/page.tsx` — replace the T10 placeholder with the real client component.
  Wrap in `<AdminLayout>`, gold/dark theme like siblings (see `app/admin/dashboard/page.tsx`).
- Drawer: inline in the page is fine (no shared reuse). Only extract `components/TableDetailDrawer.tsx`
  if the file gets unwieldy.

**Auth / RLS basis (important):** the admin logs in via `supabase.auth.signInWithPassword`
(`app/admin/page.tsx`), so the shared browser client (`lib/supabase.ts`) carries the `authenticated`
JWT. RLS grants public SELECT on `restaurant_tables`/`table_sessions`/`orders`/`order_items`/
`customers` and `update to authenticated using(true)` on `table_sessions`. So **all reads and the
Close-Table update run directly through the anon/browser `supabase` client — no new server action.**
Billing uses the existing `generateBill` server action (it needs `adminSupabase`).

**`restaurantId`:** no helper exists. Resolve once on mount: `supabase.from('restaurants')
.select('id').eq('slug','taksh').single()` (single-restaurant app). Use it for the summary
queries below. (Realtime filtering by restaurant is optional — single restaurant means every event
is relevant.)

## Logic
1. Fetch `restaurant_tables` (ordered by `table_number`). For each, find its **latest**
   `table_sessions` row (by `opened_at desc`): status `active`/`bill_generated` → show that
   session; no session or `closed` → **OPEN**.
2. For non-OPEN sessions: fetch `orders` (+ `order_items`) for the session. **Running total =
   sum over non-rejected orders** (`.neq('status','rejected')`) — matches what `generateBill`
   bills. Also derive item list, customer name, and elapsed time from `opened_at`.
3. Cards (responsive 3/4 cols): table #, status badge (OPEN=grey, ACTIVE=green,
   BILL GENERATED=orange), running total + customer + elapsed.
4. Top summary bar (for resolved `restaurantId`, "today" in IST):
   - **Total billed today** — Σ `bills.total` joined via `table_sessions` for the restaurant, today.
   - **Tables served today** — distinct sessions billed/closed today.
   - **Active count** — sessions currently `active`.
5. **Realtime:** one channel subscribing to `table_sessions` (`*`) and `orders` (`*`). On any
   event, **re-run the full fetch** (steps 1–4) — same trigger-not-data-source pattern as T11;
   avoids stale per-card patching. Cleanup `supabase.removeChannel(channel)` on unmount;
   ref-guard against StrictMode double-subscribe.
6. **Drawer on card click:** rounds grouped by `round_number`, each with its items + line total,
   plus the running total.
   - status `active` → **Generate Bill** → `await generateBill({ sessionId })` in `try/catch`
     (toast on throw; it flips the session to `bill_generated` and queues the bill print job).
   - status `bill_generated` → **Close Table** → `await supabase.from('table_sessions')
     .update({ status:'closed' }).eq('id', sessionId)` (works as authenticated admin). Optional:
     also set `closed_at: new Date().toISOString()`.
   - Disable action buttons while the call is in flight; Realtime re-fetch reconciles the grid.

## Test
- Place/approve an order → table card running total updates live (no refresh).
- Generate Bill → bill print job queued (T14 prints it) + card → BILL GENERATED.
- Close Table → card returns to OPEN.
- Reload → no duplicate Realtime subscriptions / leaked channels.

## Definition of Done
- [ ] grid + status badges + running totals (non-rejected) + summary bar
- [ ] Realtime updates (sessions + orders) via re-fetch, cleaned up via `removeChannel`
- [ ] Generate Bill works (via `generateBill` server action)
- [ ] Close Table works (direct authenticated update → status `closed`)
