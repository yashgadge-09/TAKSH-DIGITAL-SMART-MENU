# T02 — createOrJoinSession (server action)

**Day 1 · Phase 1/5 · depends on: T01 · unblocks: T07**

## Goal
A server action that either creates a new table session with a fresh 4-digit PIN, or lets a second guest join the existing active session by PIN.

## ✅ Verified 2026-06-21 — a working edge function already exists
There **is** a deployed, ACTIVE Supabase edge function `create-or-join-session` (v2) that already implements this exact logic. This contradicts the planning-time assumption of "no `supabase/functions/`". Treat it as the **reference implementation** to port — its logic is correct and battle-shaped:

- Validates `restaurantId` + `tableId` (400 if missing).
- Looks up `restaurant_tables.table_number` (404 if not found) to return in every response.
- Finds active session via `.eq('table_id', tableId).eq('status','active').maybeSingle()`.
- Active + no `pinAttempt` → `{ exists:true, requiresPin:true }`.
- Active + `pinAttempt` → compares `String(pinAttempt).trim() === activeSession.pin`; match returns `{exists:true, sessionId, tableNumber, pin}`, mismatch returns `"Incorrect PIN"`.
- No active session → PIN `String(Math.floor(1000 + Math.random()*9000))`, insert, return `{exists:false, sessionId, tableNumber, pin}`.

> **Decision (unchanged):** per the project architecture decision (server actions in `lib/database.ts`, not edge functions), reimplement this as a server action. **Do not call the edge function.** After T02 ships and is verified end-to-end (T07), the `create-or-join-session` edge function should be **decommissioned** to avoid two divergent code paths — add this to T16 QA cleanup.

## Files
- `lib/database.ts` — add `createOrJoinSession({ restaurantId, tableId, pinAttempt? })` (file already has `"use server"`; uses the existing service-role admin client per `lib/supabase-admin.ts`).

## Logic (port from edge fn, server-action shape)
1. Validate `restaurantId` + `tableId` (throw on missing).
2. Look up `restaurant_tables.table_number` by `tableId` (throw "Table not found" if absent) — needed in the return payload.
3. Find a `table_sessions` row where `table_id` matches and `status = 'active'` (`maybeSingle`).
4. **No active session** → generate random 4-digit PIN (1000–9999), insert `table_sessions` (status `active`), return `{ exists:false, sessionId, tableNumber, pin }`.
5. **Active session + no `pinAttempt`** → return `{ exists:true, requiresPin:true }`.
6. **Active session + `pinAttempt`:**
   - `String(pinAttempt).trim() === session.pin` → `{ exists:true, sessionId, tableNumber, pin }`
   - else → throw/return error `"Incorrect PIN"`.

> Service role bypasses RLS for this trusted server-side write. Never expose this beyond the server-action boundary. Return a discriminated result (success vs. `requiresPin` vs. error) so the T07 client can branch cleanly.

## Test (direct call)
- Fresh table → `exists:false` + PIN returned; row created. *(table_sessions currently has 0 rows — clean slate for testing)*
- Call again no pin → `requiresPin:true`.
- Call with wrong pin → "Incorrect PIN".
- Call with correct pin → success with sessionId.
- Cross-check: result shape matches the edge fn so existing/early clients stay compatible.

## Definition of Done
- [x] Creates session + 4-digit PIN when none active
- [x] `requiresPin` path when active + no pin
- [x] Correct-PIN and incorrect-PIN paths
- [x] No duplicate active session per table (query filters `status='active'`, one result via `maybeSingle`)
- [x] Edge function `create-or-join-session` flagged for decommission in T16 (no client calls it)

**Implemented:** `lib/database.ts:1160` — `createOrJoinSession` + `SessionResult` discriminated union type. Applied 2026-06-21.
