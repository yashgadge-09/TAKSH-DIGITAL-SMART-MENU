---
name: ordering-system-review
description: Quality review findings from the ordering system backend (lib/database.ts, ordering_system branch), reviewed 2026-06-21
metadata:
  type: project
---

Ordering system backend (5 server actions) was reviewed on 2026-06-21 on the `ordering_system` branch.

Key findings documented — do not re-flag on follow-up reviews:
- `formatTimeIST` timezone bug: already fixed in commit 28d29db (deterministic UTC+5:30 arithmetic using `getTimezoneOffset()`). Works correctly on Vercel (UTC). Breaks in local IST dev (offset = -330).
- Orphan row on items insert failure: fixed in same commit (best-effort rollback added).
- PIN range `Math.floor(1000 + Math.random() * 9000)`: confirmed safe — max is 9999 (Math.random returns [0,1) exclusive).
- `approveOrder` non-atomicity (status update before KOT insert): still present, intentional per design — "status flip first so concurrent call sees it as non-pending."

Recurring patterns to watch for in follow-up code:
- `restaurantId` accepted in `placeOrder` but not written to any DB row (dead parameter after validation).
- No quantity > 0 guard in `placeOrder`.
- Sequential queries in `generateBill` that could be `Promise.all`.
- `pending_approval` orders included in `generateBill` via `.neq('status', 'rejected')` — intentional per spec, but creates overbilling risk if order is rejected after bill is issued.

**Why:** Ordering system is in-progress schema, 0 live rows, no UI callers yet as of 2026-06-21. The review focused on server action correctness before any frontend is built.

**How to apply:** When the frontend ordering components are built, re-check callers of these actions for correct parameter passing (especially `restaurantId` in `placeOrder` and quantity validation).

[[supabase-error-handling-patterns]]
