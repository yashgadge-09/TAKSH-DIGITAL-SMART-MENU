# T08 — Checkout form (C2)

**Day 2 · Phase 2 · depends on: T03, T07 · unblocks: T09**

## Goal
Collect minimal customer info, upsert the customer, and place the order (which lands as `pending_approval`).

## Files
- `components/CheckoutForm.tsx` — new; rendered by `OrderFlow` once `sessionId` is confirmed.

## Logic
1. Fields: **Name (required)**, Phone (optional), checkbox "Send me offers on WhatsApp" (unchecked) + helper "Your number stays with this restaurant only".
2. On submit:
   - If phone given → look up existing `customers` by `(restaurant_id, phone)`; reuse `customerId` if found, else insert.
   - If no phone → insert new customer (name only).
   - Call `placeOrder({ sessionId, customerId, restaurantId, tableNumber, items })` mapping cart items → `{ dishId, quantity }`.
   - On success → `clearCart()` and advance to `OrderConfirmation` (T09).
3. Match dark + gold style. Customer-facing reads/writes use the browser supabase client / server action (never service role on the client).

## Test
- Submit name-only → customer row created, order `pending_approval`.
- Submit name+phone twice → second reuses the same `customerId` (no duplicate).

## Definition of Done
- [ ] name required, phone/WhatsApp optional
- [ ] customer reuse-by-phone or insert
- [ ] `placeOrder` called with correct payload
- [ ] cart cleared, advances to confirmation
