# T08 — Checkout form (C2)

**Day 2 · Phase 2 · depends on: T03, T07 · unblocks: T09**

## Goal
Collect minimal customer info, upsert the customer, and place the order (which lands as `pending_approval`). Rendered inside `OrderFlow`'s `checkout` view once a `sessionId` is confirmed.

## ✅ Ground truth verified against the repo (2026-06-22)
- **`placeOrder` signature has NO `tableNumber`** (`lib/database.ts:1209`): it is `{ sessionId, customerId, restaurantId, items }` where `items: { dishId: string; quantity: number }[]`. The old draft passed `tableNumber` — **drop it**. Returns `{ orderId, roundNumber }`.
- **Cart item shape** (`context/CartContext.tsx`): `CartItem.id` is the dish UUID. Map `items.map(i => ({ dishId: i.id, quantity: i.quantity }))` for `placeOrder`. `name`/`price` are snapshotted **server-side** inside `placeOrder` (re-reads `dishes`), so the client does not send them.
- **No customer helper exists yet.** There is no `findOrCreateCustomer`/upsert function in `lib/database.ts`, and `customers` is **RLS-enabled**. A browser anon-client insert will be blocked by RLS. → **T08 must add a `"use server"` action** that uses `adminSupabase`. Do **not** attempt the customer upsert from the client with the anon key.
- **`placeOrder` already validates dish IDs and rolls back** the orders row if `order_items` insert fails (`lib/database.ts:1237`, `:1271`) — no orphan-row handling needed in the form. Just `try/catch` and surface the thrown message.
- **`OrderFlow` owns the stage** (`components/OrderFlow.tsx`): `checkout` view currently renders a T08 placeholder (`:210`). It already holds `confirmedSessionId`, `confirmedTableNumber`, and `table` (→ `restaurantId`). CheckoutForm is a child of this view.
- **`clearCart()` lives in `useCart()`** and per T07 was deferred to T08. **Snapshot the cart items before clearing** — T09's confirmation screen and the preserved `OrderLikeModal` both need the ordered items, and the cart will be empty after `clearCart()`.

## New server action (add to `lib/database.ts`)
```ts
export async function findOrCreateCustomer({
  restaurantId, name, phone, wantsWhatsapp,
}: {
  restaurantId: string
  name: string
  phone?: string
  wantsWhatsapp?: boolean
}): Promise<{ customerId: string }>
```
- Validate `restaurantId` + non-empty `name` (throw on missing, like the other ordering actions).
- If `phone` is provided: look up existing `customers` by `(restaurant_id, phone)` via `adminSupabase` → reuse its id; otherwise insert. (Optionally update `name`/`wants_whatsapp` on reuse — confirm column names against the `customers` table with `list_tables` before writing.)
- If no `phone`: insert a name-only row.
- Return `{ customerId }`. Document it in `lib/CLAUDE.md` under the Ordering group.

> Before coding, run `list_tables` (Supabase) to confirm `customers` columns — the root CLAUDE.md says "name + optional phone, reused by phone per restaurant", but verify exact column names (`wants_whatsapp`? `whatsapp_opt_in`?) and any unique constraint on `(restaurant_id, phone)`.

## Files
- `components/CheckoutForm.tsx` — **new**; client component, rendered by `OrderFlow` in the `checkout` view.
- `lib/database.ts` — **edit**; add `findOrCreateCustomer` (see above).
- `components/OrderFlow.tsx` — **edit**; replace the `checkout` placeholder (`:210`) with `<CheckoutForm … />`; pass props; on success advance to T09 (`confirmation` view — added in T09) and snapshot items.
- `lib/CLAUDE.md` / `components/CLAUDE.md` — **edit**; document `findOrCreateCustomer` and `CheckoutForm`.

## CheckoutForm props (suggested)
```ts
interface CheckoutFormProps {
  sessionId: string
  restaurantId: string
  items: CartItem[]          // current cart (from OrderFlow via useCart, or read here)
  onPlaced: (snapshot: { items: CartItem[]; orderId: string }) => void
}
```
- `OrderFlow` passes `confirmedSessionId`, `table.restaurantId`, cart `items`, and an `onPlaced` handler that: stores the snapshot, calls `clearCart()`, advances `view` to `confirmation` (T09).

## Logic
1. Fields: **Name (required)**, Phone (optional), checkbox "Send me offers on WhatsApp" (default unchecked) + helper "Your number stays with this restaurant only".
2. Client-side validation: name non-empty (trim); if phone given, light sanity check (10-digit Indian mobile) — don't hard-block, but trim/normalize.
3. On submit (guard with an `isSubmitting` boolean like `OrderFlow`):
   - `const { customerId } = await findOrCreateCustomer({ restaurantId, name, phone, wantsWhatsapp })`
   - `await placeOrder({ sessionId, customerId, restaurantId, items: items.map(i => ({ dishId: i.id, quantity: i.quantity })) })`
   - On success: snapshot the cart items, call `onPlaced({ items: snapshot, orderId })`, then `clearCart()`. (Order: snapshot → onPlaced → clearCart.)
   - `try/catch` the whole thing; show the thrown message inline (reuse OrderFlow's error styling).
4. Match dark + gold style (mirror `OrderFlow` atoms / `OrderLikeModal`). Reuse `GoldButton`-style CTA.

## Test
- Submit name-only → a `customers` row is created, an `orders` row lands as `pending_approval`, `order_items` populated with snapshotted name/price.
- Submit name+phone twice (same table/restaurant) → second reuses the same `customerId` (no duplicate customer row).
- Submit with empty cart → blocked (OrderFlow already disables Place Order at `itemCount === 0`, but guard here too).
- After success → cart is empty and the flow advances to the confirmation view (T09).
- Network/throw from `placeOrder` → inline error shown, cart **not** cleared, form still submittable.

## Definition of Done
- [x] `findOrCreateCustomer` server action added (service-role, reuse-by-phone) + documented in `lib/CLAUDE.md`
- [x] name required, phone/WhatsApp optional
- [x] customer reuse-by-phone or insert (verified no duplicate on repeat)
- [x] `placeOrder` called with the **correct** payload (`{ sessionId, customerId, restaurantId, items:[{dishId,quantity}] }` — no `tableNumber`)
- [x] ordered items snapshotted before `clearCart()`; snapshot handed to `OrderFlow` via `onPlaced`
- [x] cart cleared on success, advances to confirmation (T09 placeholder renders PIN reminder)
- [x] error path: thrown message shown inline, cart preserved
- [x] `components/CLAUDE.md` updated (CheckoutForm) and OrderFlow `checkout` placeholder replaced
- [x] Build clean (`npm run build`)

**Implemented 2026-06-22:**
- `lib/database.ts` — `findOrCreateCustomer` added; SELECT-then-INSERT pattern (no unique constraint on `(restaurant_id, phone)`); uses `adminSupabase` (RLS bypassed); `whatsapp_opted_in` column
- `components/CheckoutForm.tsx` — new; name/phone/WhatsApp fields; calls `findOrCreateCustomer` + `placeOrder`; snapshots items before calling `onPlaced`
- `components/OrderFlow.tsx` — `confirmation` added to View enum; `confirmedPin` + `confirmedItems` state added; `clearCart` wired; `onOrderConfirmed?` prop added; checkout view now renders `<CheckoutForm>`; confirmation view shows success + PIN reminder + Done button
- `app/menu/page.tsx` — `onOrderConfirmed={handleOrderConfirmed}` wired to `<OrderFlow>` (re-connects the deferred T07 dish-rating feedback)
- `lib/CLAUDE.md`, `components/CLAUDE.md` — updated
