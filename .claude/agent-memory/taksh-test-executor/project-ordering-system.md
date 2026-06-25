---
name: project-ordering-system
description: Ordering system T01-T05 test execution facts — implementation verified 2026-06-21, live E2E passed, key findings on TC-015 orphan risk and TC-025 ordering
metadata:
  type: project
---

Ordering system server actions (`createOrJoinSession`, `placeOrder`, `approveOrder`, `rejectOrder`, `generateBill`) implemented in `lib/database.ts` starting at line 1153. All five functions verified by static code analysis on 2026-06-21. Live E2E smoke test passed same date.

**TC-015 (orphan order risk):** CONFIRMED RISK. In `placeOrder`, the `orders` row is inserted at line 1245 BEFORE the `orderItems.map()` at line 1253 tries `dishMap.get(item.dishId)`. If an unknown dishId is in the items array but at least one valid dish was returned from the initial fetch (line 1230 guard `!dishes?.length` is false), the orders row will be persisted and then a synchronous throw happens during `items.map()`. Result: orphaned `orders` row with no `order_items`. This is a confirmed partial-write risk requiring a database-level fix (FK transaction) or pre-validation.

**TC-025 (approveOrder item check ordering):** PASSES. Items are loaded at line 1316-1320 BEFORE the `orders.update({status:'approved'})` at line 1323. The spec concern is NOT a real bug — the implementation is correctly ordered.

**Core invariants — all four PASS:**
1. `placeOrder` has zero calls to `print_jobs.insert` — confirmed by reading entire function body (lines 1209-1269).
2. `approveOrder` has exactly one `print_jobs.insert` call (line 1330), inside the single code path that passes all guards.
3. `rejectOrder` has zero `print_jobs.insert` calls — confirmed by reading entire function body (lines 1346-1371).
4. `generateBill` excludes rejected via `.neq('status','rejected')` at line 1405; has exactly one `print_jobs.insert` call (line 1484); idempotency guard at line 1389 returns early before any inserts.

**formatTimeIST:** returns `HH:MM` via `toLocaleTimeString` with `hour12:false, timeZone:'Asia/Kolkata'` — matches `/^\d{2}:\d{2}$/` pattern.

**Why:** First full static execution of T01-T05 ordering backend test suite.
**How to apply:** Use as baseline for next test run — only TC-015 requires a code fix.
