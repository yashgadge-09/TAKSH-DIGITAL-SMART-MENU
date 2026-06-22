# T09 — Order confirmation screen (C3)

**Day 2 · Phase 2/5 · depends on: T08 · unblocks: reorder UX**

## Goal
Final screen after placing an order: confirm success, list the ordered items, prominently remind the table PIN (for reordering), re-trigger the preserved dish-rating feedback, and (optionally) reflect approval status live.

## ✅ Ground truth verified against the repo (2026-06-22)
- **The PIN is NOT returned by `placeOrder`** (`lib/database.ts:1278` → `{ orderId, roundNumber }`). It must be **threaded from `OrderFlow` state**:
  - create path: `OrderFlow.displayPin` (set at `components/OrderFlow.tsx:73`).
  - join path: the guest typed it (`pinInputs.join("")`), and `createOrJoinSession` also returns `pin` on success (`lib/database.ts:1203`) — but `handlePinSubmit` (`:111`) currently **discards it**. → Store a unified `confirmedPin` in OrderFlow on **both** paths so the confirmation screen always has it.
- **`OrderFlow` has no `confirmation` view yet** — enum is `idle | show-pin | enter-pin | checkout` (`components/OrderFlow.tsx:9`). T09 **adds** `confirmation`. T08's `onPlaced` advances `view` to it.
- **OrderLikeModal re-trigger is already wired in `app/menu/page.tsx`** — `handleOrderConfirmed(orderedItems)` (`:220`) sets `lastConfirmedOrderItems` + opens `OrderLikeModal` (`:626`). It is currently **unconnected to OrderFlow** (`<OrderFlow isOpen onClose />` at `:624` passes no callback). T09 wires it: add an `onOrderConfirmed?(items)` prop to `OrderFlow`, pass `handleOrderConfirmed` from `menu/page.tsx`, and fire it with the **snapshotted** items (cart is already cleared by T08).
- **Items snapshot** comes from T08's `onPlaced({ items, orderId })` — store it in `OrderFlow` state (`confirmedItems`). `CartItem` already carries `name`, `price`, `quantity` for the list.
- **Realtime (optional) needs `orderId`** (from `placeOrder`, threaded via `onPlaced`). Subscribing to `orders` from the browser uses the **anon client under RLS** — confirm a SELECT policy exists for `orders` before relying on it; otherwise keep status static. Treat Realtime as **v2 / optional**, not blocking.

## Files
- `components/OrderConfirmation.tsx` — **new**. Props: `{ items: { name: string; quantity: number; price: number }[]; pin: string; tableNumber: number; orderId?: string }`.
- `components/OrderFlow.tsx` — **edit**: add `confirmation` to the `View` enum; add `confirmedPin` + `confirmedItems` state; store `pin` on both create/join paths; render `<OrderConfirmation … />` in the new view; accept + call `onOrderConfirmed?(items)`.
- `app/menu/page.tsx` — **edit**: pass `onOrderConfirmed={handleOrderConfirmed}` to `<OrderFlow />` (`:624`). No other change — `OrderLikeModal` + handlers already in place.
- `components/CLAUDE.md` — **edit**: document `OrderConfirmation`; update `OrderFlow` (new `confirmation` view, `onOrderConfirmed` prop).

## Logic
1. "Order placed!" heading (light celebratory feel; check-circle icon, mirror OrderFlow atoms).
2. List ordered items from `confirmedItems` with qty × price and a total.
3. **Prominent PIN reminder box**: "Your table PIN is **[PIN]** — remember this to order more later." (Reuse the gold PIN-box styling from OrderFlow's `show-pin` view.)
4. Reorder hint: "Want to order more? Scan the QR again and enter your PIN."
5. **Re-trigger dish feedback**: when the confirmation view mounts (or on a "Done" / close action), call `onOrderConfirmed?.(confirmedItems)` exactly once (guard against double-fire on re-render). This opens the preserved `OrderLikeModal`. Closing OrderConfirmation should also `handleClose()` the OrderFlow so the two modals don't stack — sequence: confirmation visible → user taps Done → OrderFlow closes → `OrderLikeModal` opens.
6. (Optional, v2) status pill: "Pending approval" → "Sent to kitchen ✅" when `orders.status` becomes `approved` via Supabase Realtime on `orderId`. Skip if no anon SELECT policy on `orders`.
7. Dark + gold styling throughout.

## Test
- After checkout → confirmation shows the correct items, totals, table number, and PIN.
- Create path PIN matches the one shown in `show-pin`; join path PIN matches what the guest entered.
- Tapping Done → OrderFlow closes and `OrderLikeModal` opens with the same items; rating submits via `submitDishRatingsFromOrder` (existing path).
- `onOrderConfirmed` fires once (no duplicate OrderLikeModal opens on re-render).
- (If Realtime wired) admin approves → pill flips to "Sent to kitchen".

## Definition of Done
- [ ] `confirmation` view added to `OrderFlow`; `confirmedPin` + `confirmedItems` stored on both create & join paths
- [ ] items + totals shown from the snapshot
- [ ] prominent PIN reminder + reorder instructions
- [ ] `onOrderConfirmed` prop wired `menu/page.tsx → OrderFlow`; `OrderLikeModal` re-triggers once with snapshot items (T07's deferred feedback restored)
- [ ] confirmation close sequence doesn't stack modals
- [ ] (optional) live pending→approved status, only if anon RLS allows
- [ ] `components/CLAUDE.md` updated (OrderConfirmation + OrderFlow changes)
- [ ] Build clean (`npm run build`)
