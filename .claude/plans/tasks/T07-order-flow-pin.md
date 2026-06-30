# T07 — OrderFlow + PIN (replaces "Show to Waiter") (C1)

**Day 2 · Phase 2/5 · depends on: T02, T06 · unblocks: T08**

## Goal
Replace the "SHOW ORDER TO WAITER" behavior with a real Place Order flow: create-or-join the table session (ids from `TableSessionContext`), handle the PIN, and hand a confirmed `sessionId` to checkout (T08).

## ✅ Ground truth verified against the repo (2026-06-22)
- **`useTableSession()` returns `null` off-table** (T06, `context/TableSessionContext.tsx`). On a plain `/menu` visit (no QR), there is no `restaurantId`/`tableId`. T07 **must** branch on this — see Logic step 0. The old plan assumed ids are always present; they are not.
- **`createOrJoinSession` THROWS on wrong PIN** — it does *not* return an error variant. `SessionResult` (`lib/database.ts:1155`) is only `{exists:false,…}` | `{exists:true,requiresPin:true}` | `{exists:true,sessionId,…}`. Incorrect PIN / "Table not found" come back as a **thrown `Error`**. OrderFlow must `try/catch` and map the message to the inline error.
- **It's a `"use server"` action** — callable directly from the client OrderFlow (`await createOrJoinSession({ restaurantId, tableId, pinAttempt? })`). No API route needed.
- **Existing post-order chain that this replaces** (`app/menu/page.tsx`): `CartDrawer onShowOrder` (line 622) → `OrderSummarySheet` (the fake "show this screen to the waiter" bill) → `handleOrderConfirmed` (line 220) → `OrderLikeModal` dish-rating feedback (`handleDishRatingsSubmit` → `submitDishRatingsFromOrder`). `OrderSummarySheet` **also calls `clearCart()`** today. The dish-rating feedback is real and must be **preserved**, not deleted — see "Disposition of the old flow".
- `CartDrawer` button currently reads `SHOW ORDER TO WAITER - ₹{finalTotal}` (line 209) where `finalTotal` includes a **mock 10% tax** (line 37). Real GST is computed at bill time (T05) — the cart's tax line stays cosmetic.
- `placeOrder` signature is `{ sessionId, customerId, restaurantId, items }` — **no `tableNumber`** (`lib/database.ts:1209`). (Flagged for T08, whose draft passes `tableNumber`.)

## Files
- `components/OrderFlow.tsx` — **new**; client modal orchestrating session/PIN, then rendering `CheckoutForm` (T08). Reads ids via `useTableSession()`.
- `components/CartDrawer.tsx` — edit: footer button label/behavior → **"Place Order"** (lines 201–211). Keep the `onShowOrder` prop name or rename to `onPlaceOrder` (cosmetic; if renamed, update the one call site in `app/menu/page.tsx`).
- `app/menu/page.tsx` — edit wiring: `onShowOrder` should open `OrderFlow` instead of `OrderSummarySheet` (line 622); remove the `OrderSummarySheet` render (line 624). Re-anchor the dish-rating feedback per below.

## Logic
0. **Off-table guard.** Read `const table = useTableSession()`. If `table === null` (user on `/menu` with no QR scan): clicking "Place Order" must **not** call `createOrJoinSession`. Show a friendly prompt — "Scan the QR code on your table to place an order" — and stop. (Keeps `/menu` browsing functional; ordering only works under `/[slug]/table/[number]`.)
1. **Place Order (on-table).** `await createOrJoinSession({ restaurantId, tableId })` (ids from context). Wrap in `try/catch`.
2. `exists:false` → stage `show-pin`: "You're the first to order! Share this PIN with your table: **[PIN]**" + Continue → proceed to checkout with the returned `sessionId`.
3. `exists:true && requiresPin` → stage `enter-pin`: OTP-style 4-box input → `await createOrJoinSession({ restaurantId, tableId, pinAttempt })`.
   - **caught error** whose message is `Incorrect PIN` → inline "Incorrect PIN, try again", stay on the PIN stage.
   - success (`exists:true` with `sessionId`) → proceed to checkout.
4. **Confirmed `sessionId`** → stage `checkout`: render `<CheckoutForm sessionId restaurantId tableNumber items … />` (T08). (`createOrJoinSession` also returns `tableNumber` for display.)
5. Suggested stage enum to keep this cohesive: `idle | placing | show-pin | enter-pin | checkout`. Disable buttons while `placing` to prevent double-submit / duplicate sessions.
6. Match existing dark + gold styling (CSS vars in `app/globals.css`; mirror `OrderSummarySheet`/`OrderLikeModal`).

## Disposition of the old flow (don't orphan the feedback)
- **Remove** the fake `OrderSummarySheet` "show to waiter" path (it persisted nothing).
- **`clearCart()`** no longer fires from `OrderSummarySheet` — it now fires on successful `placeOrder` in **T08**.
- **Preserve** the dish-rating feedback: `OrderLikeModal` + `handleDishRatingsSubmit` (`submitDishRatingsFromOrder`) stay. Re-trigger them **after** order confirmation — wire the trigger in **T09** (order-confirmation), not on the dead `handleOrderConfirmed`. In T07, leave `OrderLikeModal` mounted but stop driving it from the removed sheet; T09 owns the new trigger. (Note this dependency in T09.)

## Reorder note (Phase 5)
A 2nd order on the same active table re-enters this flow: `createOrJoinSession` finds the active session → returns `requiresPin` → the guest re-enters the PIN (the join path). Acceptable for v1. Optional later optimization: cache the confirmed `sessionId` client-side to skip re-PIN on the same device — out of scope for T07 unless requested.

## Test
- On `/taksh/table/3`, first device → "Place Order" → PIN shown; Continue → checkout (T08) opens.
- Second device same table → asked for PIN; wrong PIN → inline error, stays; correct PIN → checkout.
- On plain `/menu` (no table) → "Place Order" shows the "scan the QR" prompt, no session created.
- Double-click "Place Order" → only one session created (button disabled while `placing`).

## Definition of Done
- [x] "Show to Waiter" / `OrderSummarySheet` path replaced with `OrderFlow` → Place Order
- [x] off-table (`useTableSession()===null`) shows scan-QR prompt, never calls the session action
- [x] create path shows PIN; join path asks for PIN
- [x] wrong-PIN thrown error caught and shown inline; correct PIN proceeds
- [x] confirmed `sessionId` stored in `OrderFlow` state, checkout placeholder shown (T08 fills it in)
- [x] dish-rating feedback (`OrderLikeModal`) preserved and mounted, re-trigger deferred to T09; `clearCart` moves to T08
- [x] no duplicate session on double-submit (`isSubmitting` guard)
- [x] Build clean (`npm run build`)

**Implemented 2026-06-22:**
- `components/OrderFlow.tsx` — new; view state machine (`idle | show-pin | enter-pin | checkout`); off-table guard; `try/catch` on `createOrJoinSession`; OTP PIN inputs with focus management; T08 placeholder on `checkout` stage
- `components/CartDrawer.tsx` — button relabeled "PLACE ORDER · ₹{finalTotal}"
- `app/menu/page.tsx` — swapped `OrderSummarySheet` import + render for `OrderFlow`; `isOrderSummaryOpen` → `isOrderFlowOpen`; `OrderLikeModal` + handlers preserved for T09
