# Ordering System Improvements — T01–T05
Branch: `ordering_system` | Reviewed: 2026-06-21 | File: `lib/database.ts` lines 1153–1526

---

## ❌ BLOCKING (fix before any production use)

### I-01 — Rotate `NEXT_PUBLIC_SUPABASE_SERVICE_ROLE` (service role key in client bundle)
**Files:** `lib/database.ts` line 10, `lib/supabase-admin.ts` line 9
`NEXT_PUBLIC_` vars are embedded in the browser bundle at build time. This key bypasses ALL RLS on every table. The key may already have been shipped to clients on `main`.
- Rename `NEXT_PUBLIC_SUPABASE_SERVICE_ROLE` → `SUPABASE_SERVICE_ROLE_KEY` in all `.env` files, Vercel settings, and all code references
- Rotate the key in the Supabase dashboard immediately
- Add `import 'server-only'` to the top of `lib/database.ts` and `lib/supabase-admin.ts` as a build-time guard

### I-02 — Add server-side auth guard to `approveOrder`, `rejectOrder`, `generateBill`
**File:** `lib/database.ts` — `approveOrder`, `rejectOrder`, `generateBill`
Any guest who knows a valid `orderId` or `sessionId` (world-readable via public SELECT RLS) can approve/reject orders, trigger KOT kitchen prints, or lock a session as `bill_generated`. The admin layout's client-side redirect cannot gate direct Server Action invocations.
```ts
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

async function requireAdminSession() {
  const cookieStore = cookies()
  const serverClient = createServerClient(url, anonKey, { cookies: { getAll: () => cookieStore.getAll() } })
  const { data: { session } } = await serverClient.auth.getSession()
  if (!session) throw new Error('Unauthorized')
}
// Add await requireAdminSession() as first line in each of the three functions
```

### I-03 — Remove public SELECT on `table_sessions.pin` (PINs world-readable)
**File:** `supabase/migrations/2026062101_ordering_system.sql`
The `table_sessions` table has `for select to public using (true)`, which means any anon client can read all active PINs directly — no brute-force needed. Also affects `customers` (name/phone), `bills`, and `print_jobs`.
- Remove public SELECT from `table_sessions`, `customers`, `bills`, `print_jobs`
- Replace with `for select to authenticated using (true)` for admin-only tables
- For `orders`/`order_items`, scope public SELECT to the guest's own session via a row-level auth check

---

## 🔴 MUST FIX (data integrity bugs)

### I-04 — `createOrJoinSession`: swallowed error on `maybeSingle()` creates duplicate sessions
**File:** `lib/database.ts` — `createOrJoinSession`
The `error` field from the active session query is dropped. A transient DB error makes `activeSession` null, which falls through to create a new session for a table that already has one — corrupting session state silently.
```ts
const { data: activeSession, error: activeSessionError } = await adminSupabase
  .from('table_sessions').select('id, pin').eq('table_id', tableId).eq('status', 'active').maybeSingle()
if (activeSessionError) throw new Error('Failed to check active session')
```

### I-05 — `placeOrder`: dead `restaurantId` parameter
**File:** `lib/database.ts` — `placeOrder`
`restaurantId` is required, validated, and included in error messages — but never written to any DB row (`orders` has no `restaurant_id` column). Misleading API contract; a wrong `restaurantId` passes silently.
- **Option A (simpler):** Remove parameter from signature entirely
- **Option B (safer):** Verify the session belongs to `restaurantId` with a DB query before inserting

### I-06 — `placeOrder`: no `quantity > 0` validation
**File:** `lib/database.ts` — `placeOrder`
`quantity: 0` or `quantity: -5` are accepted and written to `order_items` (no DB constraint). Negative quantities silently reduce bill totals.
```ts
for (const item of items) {
  if (!Number.isInteger(item.quantity) || item.quantity < 1)
    throw new Error(`Invalid quantity for dish ${item.dishId}`)
}
```

### I-07 — `approveOrder`: non-atomic status flip → lost KOT if print_job insert fails
**File:** `lib/database.ts` — `approveOrder`
Order status is set to `'approved'` BEFORE the KOT `print_jobs` insert. If the insert fails, the order is permanently stuck in `'approved'` with no KOT — the retry idempotency guard no-ops forever. Kitchen never sees the order.
- Fix: make the status update conditional (`.eq('status', 'pending_approval')` in the WHERE) and only proceed to print_jobs insert if count > 0; on concurrent-call loss, return the existing approved state

---

## 🟡 SHOULD FIX (correctness + performance)

### I-08 — `generateBill`: `pending_approval` orders included (overbilling risk)
**File:** `lib/database.ts` — `generateBill`
`.neq('status', 'rejected')` includes `pending_approval` orders. If such an order is later rejected after the bill is generated, the customer is overbilled and the session is locked — no way to correct.
```ts
// Change from:
.neq('status', 'rejected')
// To:
.in('status', ['approved', 'served'])
// Or: throw if any pending_approval orders still exist for the session
```

### I-09 — `generateBill`: 3 sequential independent queries (~100ms wasted)
**File:** `lib/database.ts` — `generateBill` lines ~1463–1487
Customer, restaurant, and table lookups have no dependencies on each other and run sequentially.
```ts
const [{ data: customer }, { data: restaurant }, { data: table }] = await Promise.all([
  latestOrder?.customer_id
    ? adminSupabase.from('customers').select('name').eq('id', latestOrder.customer_id).maybeSingle()
    : Promise.resolve({ data: null }),
  adminSupabase.from('restaurants').select('name, address, gstin, upi_id').eq('id', session.restaurant_id).maybeSingle(),
  adminSupabase.from('restaurant_tables').select('table_number').eq('id', session.table_id).maybeSingle(),
])
```

### I-10 — `generateBill`: error ignored on existing-bill lookup (idempotency bypass)
**File:** `lib/database.ts` — `generateBill`
If the `bills` re-fetch query fails when `session.status === 'bill_generated'`, the guard falls through and creates a duplicate bill row.
```ts
const { data: existing, error: existingError } = await adminSupabase.from('bills')...
if (existingError) throw new Error('Failed to retrieve existing bill')
```

### I-11 — `generateBill`: concurrent double-bill race condition
**File:** `lib/database.ts` — `generateBill`
Two simultaneous calls both pass the `session.status` guard and each insert a `bills` row + `print_jobs` row.
- Move the session status flip to before the `bills` INSERT with `.eq('status', 'active')` condition
- Add a `UNIQUE` constraint on `bills(session_id)` as a DB-level backstop

### I-12 — `createOrJoinSession`: `restaurantId` not validated against `tableId`
**File:** `lib/database.ts` — `createOrJoinSession`
Table lookup uses only `.eq('id', tableId)` — a caller can mix IDs from different tenants.
```ts
.eq('id', tableId).eq('restaurant_id', restaurantId)  // add the restaurant_id filter
```

### I-13 — `SessionResult` type: weak discriminant (`requiresPin?: false`)
**File:** `lib/database.ts` line 1158
`requiresPin?: false` (optional) can't be used as a clean TypeScript discriminant. Should be `requiresPin: false` (required) and pass it explicitly in the return.

### I-14 — `approveOrder`: sequential session + items queries (~50ms wasted)
**File:** `lib/database.ts` — `approveOrder`
Items only need `orderId` (known immediately after order fetch). Run `[session, items]` in parallel, then fetch table from session result.

### I-15 — `placeOrder`: no `is_available` filter on dishes
**File:** `lib/database.ts` — `placeOrder`
Unavailable dishes can be ordered; they'll appear on the KOT and confuse kitchen staff.
```ts
.in('id', dishIds).eq('is_available', true)
```

---

## 🟢 CONSIDER (low priority / polish)

### I-16 — Extract GST rate to a named module-level constant
`const RESTAURANT_GST_RATE_PERCENT = 5` with a comment explaining the tax category.

### I-17 — Simplify `latestOrder` sort in `generateBill`
`orders` is already fetched `.order('round_number', { ascending: true })`. `orders[orders.length - 1]` is simpler than `[...orders].sort(...)`.

### I-18 — Deduplicate `dishId` values in `placeOrder`
Duplicate `dishId` entries create two KOT lines for the same dish instead of one merged line. Dedup and sum quantities before `validatedItems`.

---

## Fix order (suggested)

1. I-01 (rotate key) — do immediately, independent of code changes
2. I-02 + I-03 (auth guard + PIN RLS) — together, before any UI wires up to these actions
3. I-04 + I-05 + I-06 (data integrity in createOrJoinSession + placeOrder) — before T07
4. I-07 + I-08 + I-11 (approveOrder atomicity + generateBill correctness) — before T12/T13
5. I-09 + I-10 + I-12–I-15 (perf + type safety + minor correctness) — anytime
6. I-16–I-18 — optional polish
