# T07 — OrderFlow + PIN (replaces "Show to Waiter") (C1)

**Day 2 · Phase 2/5 · depends on: T02, T06 · unblocks: T08**

## Goal
Replace the "SHOW ORDER TO WAITER" behavior with a real Place Order flow: create-or-join the table session, handle the PIN, and hand a confirmed `sessionId` to checkout.

## Files
- `components/OrderFlow.tsx` — new; orchestrates the session/PIN modal flow.
- `components/CartDrawer.tsx` — edit: button label/behavior → "Place Order" (currently `onShowOrder` at ~line 201–212).
- `app/menu/page.tsx` — edit wiring (currently `onShowOrder` opens `OrderSummarySheet` ~line 622).

## Logic
1. On "Place Order" → call `createOrJoinSession({ restaurantId, tableId })` (ids from `TableSessionContext`).
2. `exists:false` → modal: "You're the first to order! Share this PIN: **[PIN]**" + Continue.
3. `requiresPin:true` → OTP-style 4-box PIN input → re-call `createOrJoinSession` with `pinAttempt`.
   - wrong → inline error "Incorrect PIN, try again".
   - correct → proceed.
4. On confirmed `sessionId` → render `CheckoutForm` (T08) / call `onSessionConfirmed(sessionId)`.
5. Match existing dark + gold styling.

## Test
- First device on a fresh table → PIN shown.
- Second device same table → asked for PIN; wrong errors; correct proceeds.

## Definition of Done
- [ ] "Show to Waiter" replaced with Place Order
- [ ] create path shows PIN; join path asks for PIN
- [ ] wrong-PIN error shown
- [ ] confirmed `sessionId` handed to checkout
