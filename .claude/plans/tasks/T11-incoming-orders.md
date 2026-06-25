# T11 — Incoming Orders panel (Phase 3 UI — the gap fix)

**Day 3 · Phase 3 · depends on: T04, T10 · unblocks: kitchen flow**

## Goal
The visible human-approval gate the diagram requires: a live queue of `pending_approval` orders that the owner Approves or Rejects. **Approve is what fires the KOT** (via `approveOrder`, T04). Nothing reaches the kitchen without passing through here.

## Files
- `app/admin/incoming/page.tsx` — replace the T10 placeholder with the real client component.
  Wrap in `<AdminLayout>` (auth + sidebar), gold/dark theme (`#3B2416` text) like its siblings.

**No new server action needed.** Read `orders` directly via the anon `supabase` client from the
client component — RLS already grants `select to public using (true)` on `orders`, `order_items`,
`table_sessions`, `restaurant_tables`, `customers` (migration `2026062101_ordering_system.sql`),
and `orders` is in the `supabase_realtime` publication. This mirrors the existing convention in
`app/admin/reviews/page.tsx` (which reads `push_sessions` directly via anon). `approveOrder` /
`rejectOrder` already exist in `lib/database.ts` (each takes only `orderId`; both **throw** on bad
state and are idempotent on double-tap — wrap calls in `try/catch`).

## Logic
1. **Initial fetch** via anon client — single embedded select, ordered FIFO (oldest first):
   ```ts
   supabase
     .from('orders')
     .select('id, round_number, placed_at, status, ' +
             'order_items(name, quantity), customers(name), ' +
             'table_sessions(restaurant_tables(table_number))')
     .eq('status', 'pending_approval')
     .order('placed_at', { ascending: true })   // NOTE: column is placed_at, not created_at
   ```
   (PostgREST embeds resolve through the existing FKs.)
2. **Realtime as a trigger, not a data source.** Subscribe to
   `supabase.channel('admin-incoming').on('postgres_changes', { event:'*', schema:'public',
   table:'orders' }, …)`. The payload carries **only the bare `orders` row** (`session_id,
   customer_id, round_number, status, placed_at`) — NOT the joined items/table/customer — so do
   **not** build cards from it. On any event, just **re-run the fetch in step 1** (always
   consistent; sidesteps the missing-joins and "approve is an UPDATE not a DELETE" pitfalls).
   - Subscribe inside a `useEffect` with a ref guard (React StrictMode double-mounts in dev).
   - Cleanup: `return () => supabase.removeChannel(channel)` (fuller teardown than
     `channel.unsubscribe()`).
3. Each card: table #, round #, items + qty, `placed_at` time, customer name.
4. **Approve** → `await approveOrder(id)` in `try/catch` (toast on throw); optimistically remove
   the card and disable both buttons while pending. The Realtime re-fetch reconciles. KOT prints
   via the bridge (T14).
5. **Reject** → `await rejectOrder(id)`, same handling, no KOT.
6. **States:** loading, empty ("No pending orders"), and error toast (sonner).

> Status transitions are **UPDATE** events (`pending_approval → approved | rejected`), never
> deletes — the `.eq('status','pending_approval')` re-fetch naturally drops them from the list.

## Test
- Place an order (customer flow or `placeOrder`) → appears in panel live (no refresh).
- Approve → leaves queue; a `kot` row lands in `print_jobs`; bridge (T14, mock) shows the KOT.
- Reject → leaves queue; no new `print_jobs` row.
- Reload the page → no duplicate subscriptions / leaked channels (StrictMode-safe).

## Definition of Done
- [ ] live pending list via Realtime (re-fetch on event), ordered FIFO by `placed_at`
- [ ] Approve fires exactly one KOT and clears the card
- [ ] Reject clears the card with no KOT
- [ ] channel cleaned up via `removeChannel` on unmount; double-subscribe guarded
