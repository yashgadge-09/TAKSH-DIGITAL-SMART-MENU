# T02 — createOrJoinSession (server action)

**Day 1 · Phase 1/5 · depends on: T01 · unblocks: T07**

## Goal
A server action that either creates a new table session with a fresh 4-digit PIN, or lets a second guest join the existing active session by PIN.

## Files
- `lib/database.ts` — add `createOrJoinSession({ restaurantId, tableId, pinAttempt? })` (`"use server"`, uses `lib/supabase-admin.ts` service-role client).

## Logic
1. Find a `table_sessions` row where `table_id` matches and `status = 'active'`.
2. **No active session** → generate random 4-digit PIN (1000–9999), insert `table_sessions` (status `active`), return `{ exists:false, sessionId, tableNumber, pin }`.
3. **Active session + no `pinAttempt`** → return `{ exists:true, requiresPin:true }`.
4. **Active session + `pinAttempt`:**
   - matches → `{ exists:true, sessionId, tableNumber, pin }`
   - mismatch → throw/return error `"Incorrect PIN"`.

> Service role bypasses RLS for this trusted server-side write. Never expose this to the client beyond the server-action boundary.

## Test (direct call)
- Fresh table → `exists:false` + PIN returned; row created.
- Call again no pin → `requiresPin:true`.
- Call with wrong pin → "Incorrect PIN".
- Call with correct pin → success with sessionId.

## Definition of Done
- [ ] Creates session + 4-digit PIN when none active
- [ ] `requiresPin` path when active + no pin
- [ ] Correct-PIN and incorrect-PIN paths
- [ ] No duplicate active session per table
