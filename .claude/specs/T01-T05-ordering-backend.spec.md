# Spec — Ordering System Backend (T01–T05)

**Feature:** Restaurant ordering-system data layer + server actions with a human approval gate.
**Location of code:** all server actions in `lib/database.ts` (`"use server"`, service-role `adminSupabase` client).
**Schema migration:** `supabase/migrations/2026062101_ordering_system.sql`.
**Branch:** `ordering_system`.
**Status:** implemented + live E2E smoke-tested 2026-06-21 (DB returned to clean baseline afterward).

---

## Core invariant (the whole point of this feature)

The kitchen must never print without human approval, and billing must never include rejected food:

1. `placeOrder` creates an order as `pending_approval` and **creates ZERO `print_jobs`**.
2. `approveOrder` is the **ONLY** function in the system that creates a `kot` print job — exactly one per order.
3. `rejectOrder` creates **zero** print jobs.
4. `generateBill` is the only function that creates a `bill` print job, and it **excludes `rejected` orders** from totals.

Any test suite must assert these four invariants hold.

---

## Data model (live, verified in T01)

All tables in `public` schema, RLS enabled. Relevant columns:

- `restaurants(id uuid pk, name, slug unique, address, gstin, upi_id, created_at)`
- `restaurant_tables(id uuid pk, restaurant_id → restaurants, table_number int, unique(restaurant_id, table_number))`
- `table_sessions(id uuid pk, restaurant_id → restaurants, table_id → restaurant_tables, pin text, status text default 'active' check in (active|bill_generated|closed), opened_at, closed_at)`
- `customers(id uuid pk, restaurant_id → restaurants, name not null, phone, whatsapp_opted_in bool, created_at)`
- `orders(id uuid pk, session_id → table_sessions, customer_id → customers, round_number int, status text default 'pending_approval' check in (pending_approval|approved|rejected|served), placed_at)`
- `order_items(id uuid pk, order_id → orders, dish_id → dishes, name text, price numeric, quantity int)`
- `bills(id uuid pk, session_id → table_sessions, subtotal numeric, gst_amount numeric, total numeric, generated_at)`
- `print_jobs(id uuid pk, restaurant_id → restaurants, type text check in (kot|bill), payload jsonb, status text default 'pending' check in (pending|sent|failed), created_at)`

Seed: restaurant `TAKSH Veg` / slug `taksh` (`c7b441fe-8639-4540-b78b-cb16744234ab`), tables 1–16.

Note: `round_number` and `placed_at` live on `orders`. `order_items` has no round/time — it inherits from its parent order.

---

## Server actions under test

### 1. `createOrJoinSession({ restaurantId, tableId, pinAttempt? })` → `SessionResult`

Creates a fresh table session with a 4-digit PIN, or lets a second guest join the active one by PIN.

**Inputs:** `restaurantId: string`, `tableId: string`, `pinAttempt?: string | number`.

**Return (discriminated union `SessionResult`):**
- `{ exists: false, sessionId, tableNumber, pin }` — new session created.
- `{ exists: true, requiresPin: true }` — active session exists, no PIN supplied.
- `{ exists: true, sessionId, tableNumber, pin }` — active session, correct PIN.

**Behavior / branches:**
1. Missing `restaurantId` or `tableId` → throws `"restaurantId and tableId are required"`.
2. `tableId` not found in `restaurant_tables` → throws `"Table not found"`.
3. No active session for the table → generates PIN `String(Math.floor(1000 + Math.random()*9000))`, inserts `table_sessions` row (status `active`), returns `exists:false`.
4. Active session + no/empty `pinAttempt` → returns `{ exists:true, requiresPin:true }` (no write).
5. Active session + `String(pinAttempt).trim() === session.pin` → returns success with `sessionId`.
6. Active session + wrong PIN → throws `"Incorrect PIN"`.

**Edge cases to test:** empty-string `pinAttempt` treated as "no PIN"; numeric `pinAttempt` coerced via `String().trim()`; only one row matched via `status='active'` + `maybeSingle()` (no duplicate active session per table).

---

### 2. `placeOrder({ sessionId, customerId, restaurantId, items })` → `{ orderId, roundNumber }`

Persists an order as `pending_approval`, snapshotting dish name/price. **Creates no print job.**

**Inputs:** `sessionId`, `customerId`, `restaurantId: string`; `items: { dishId: string; quantity: number }[]`.

**Behavior:**
1. Any missing field or empty `items` → throws `"sessionId, customerId, restaurantId, and items are required"`.
2. Reads `dishes.name_en` + `dishes.price` for all `dishId`s (snapshot at order time). No dishes found → throws `"Failed to fetch dish details"`.
3. `round_number` = max existing `round_number` for the session + 1; first order = 1.
4. Inserts `orders` row with **explicit** `status='pending_approval'` (does not rely on column default).
5. Inserts one `order_items` row per item with snapshotted `name`/`price` + `quantity`. Item whose dish wasn't found → throws `"Dish <id> not found"`.
6. Returns `{ orderId, roundNumber }`.

**Invariants to assert:**
- `print_jobs` count unchanged (delta = 0).
- Order status is `pending_approval`.
- Changing a dish's price *after* the call does NOT change `order_items.price` (snapshot immutability).
- Second `placeOrder` on same session → `roundNumber` increments.

---

### 3. `approveOrder(orderId)` → `{ orderId, status: 'approved' }`

The approval gate. **Only creator of a `kot` print job.**

**Behavior:**
1. Empty `orderId` → throws `"orderId is required"`.
2. Order not found → throws `"Order not found"`.
3. **Idempotency:** if status already `approved` → returns `{status:'approved'}` as a no-op (NO second KOT).
4. If status is `rejected` or `served` (not `pending_approval`) → throws `"Cannot approve order in status '<status>'"`.
5. Resolves `restaurant_id` + `table_id` from session, then `table_number` from `restaurant_tables`. Session/table missing → throws.
6. Order has no `order_items` → throws `"Order has no items"`.
7. Updates `orders.status='approved'` **first** (so a concurrent call sees it non-pending), then inserts ONE `print_jobs` row:
   - `type:'kot'`, `restaurant_id`, `status:'pending'`
   - `payload: { tableNumber, roundNumber, time: "HH:MM" (IST, via formatTimeIST), items: [{ name, qty }] }`

**Invariants:** exactly one KOT per pending→approved transition; double-approve = delta 0; KOT payload shape matches T14 print-bridge contract.

---

### 4. `rejectOrder(orderId)` → `{ orderId, status: 'rejected' }`

**Behavior:**
1. Empty `orderId` → throws.
2. Order not found → throws.
3. **Idempotency:** already `rejected` → no-op return.
4. Not `pending_approval` (e.g. `approved`/`served`) → throws `"Cannot reject order in status '<status>'"`.
5. Updates `orders.status='rejected'`. **Never inserts a print job.**

**Invariant:** `print_jobs` count unchanged (delta = 0) in all paths.

---

### 5. `generateBill({ sessionId })` → `{ billId, total }`

Aggregates all non-rejected orders, computes GST, persists bill, queues bill print job, flips session.

**Behavior:**
1. Empty `sessionId` → throws.
2. Session not found → throws `"Session not found"`.
3. **Idempotency:** if `table_sessions.status === 'bill_generated'`, returns the existing latest bill (no duplicate bill row / print job).
4. Loads orders for session `WHERE status != 'rejected'`. None → throws `"No billable orders for this session"`.
5. Loads `order_items` for those orders. None → throws `"No items to bill"`.
6. Groups items by parent order's `round_number` → `rounds: [{ number, time(IST), items:[{name,qty,price}] }]`.
7. Computes: `subtotal = Σ(price*quantity)`; `gstRate = 5`; `gstAmount = Math.round(subtotal*5)/100`; `total = subtotal + gstAmount`.
8. Customer name = most recent order's customer; restaurant name/address/gstin/upi + table_number for header.
9. Inserts `bills(session_id, subtotal, gst_amount, total)`.
10. Inserts ONE `print_jobs` row `type:'bill'`, `status:'pending'`, with full payload (`restaurantName, address, gstin, upiId, tableNumber, customerName, rounds, subtotal, gstRate, gstAmount, total`).
11. Updates `table_sessions.status='bill_generated'`.
12. Returns `{ billId, total }`.

**Invariants to assert:**
- Rejected orders excluded from `subtotal`/`total`.
- Totals correct across multiple rounds (e.g. 2×90 + 1×140 = 320 → GST 16 → total 336).
- Exactly one `bills` row + one `bill` print job created per first call.
- Session status becomes `bill_generated`.
- Re-calling on a billed session returns the same bill (no duplicates).

---

## Reference: live E2E smoke test (already passed 2026-06-21)

| Step | Expected | Actual |
|---|---|---|
| placeOrder (R1, 2 items) | print_jobs = 0 | 0 ✅ |
| approveOrder | print_jobs = 1 (kot) | 1 ✅ |
| placeOrder R2 + rejectOrder | print_jobs = 1 (no extra) | 1 ✅ |
| Bill totals (R1 only) | 320 / 16 / 336 | 320 / 16 / 336 ✅ |
| Rejected R2 excluded | yes | yes ✅ |
| generateBill | 1 bill row, 2 print_jobs total | ✅ |
| Session status | bill_generated | ✅ |

## Test safety notes (for taksh-test-executor)

- These are service-role writes that **bypass RLS** — any live test must clean up after itself (delete in FK order: print_jobs → bills → order_items → orders → table_sessions → customers).
- Prefer mocked `adminSupabase` for unit tests; reserve live DB for explicit, self-cleaning integration runs against the `taksh` seed restaurant.
- Never expose `SUPABASE_SERVICE_ROLE_KEY`.
