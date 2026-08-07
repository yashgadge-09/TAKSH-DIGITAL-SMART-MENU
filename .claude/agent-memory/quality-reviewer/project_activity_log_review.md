---
name: activity-log-review
description: Quality review of the A01 activity log + captain walk-in order (W01) feature on branch admin-captain-k-rishta, reviewed 2026-08-06
metadata:
  type: project
---

Reviewed the activity-log/audit-trail feature and captain walk-in ordering (`lib/database.ts` +580 lines, `lib/activity.ts` new, `app/admin/activity/page.tsx` new, `components/captain/NewTableOrderModal.tsx` + `RemoveReasonDialog.tsx` new, edits to `TableSheet`/`ParcelSheet`/`AddItemModal`/`app/admin/history/page.tsx`) on 2026-08-06, branch `admin-captain-k-rishta` vs `main`.

Key findings (see full review output for line numbers — will drift, re-grep before reusing):
- `sessionDiscardedTotal()` and `getSessionLogContext()` in `lib/database.ts` both destructure Supabase results without checking `error` — another instance of [[supabase-error-handling-patterns]]. Notably `sessionDiscardedTotal` feeds the fraud-detection ₹ rollup on `/admin/activity`, so a swallowed query error silently under-reports discarded revenue instead of surfacing a gap.
- `app/admin/history/page.tsx`'s `handleQtyChange`/`handleReprint` wrap the mutating call AND the post-mutation `refreshDetail()`/`load()` refetch in the same try/catch, so a refetch failure after a successful mutation shows a false "failed" toast. The same file has the *correct* pattern 100 lines below it (`AddItemModal.onAdded` wraps only the refetch in its own try/catch with a comment explaining why) — worth pointing reviewees at their own correct example.
- Found a real TOCTOU race: `AddItemModal`'s close button/Escape (via `ResponsiveSheet`) is never disabled during `saving`, so closing mid-`addItemsToSession` request races `cancelEmptySession`'s abandon-guard (count-check then close, not atomic) in the new captain walk-in flow (`pendingTableAdd` in `app/captain/tables/page.tsx`). Can close a session status to `closed` moments before the in-flight add commits, producing a KOT that prints for an already-closed/hidden session.
- Duplicated reason-value list: `lib/database.ts` hardcodes `REMOVAL_REASON_VALUES` as a literal tuple instead of deriving from `Object.keys(REMOVAL_REASONS)` in `lib/activity.ts` — a drift risk if reasons are ever added/renamed in one file only.
- `addItemsToSession` logs activity with a sequential `for...of` + `await logActivity(...)` per item — N+1-shaped, worth batching into one multi-row insert or at least `Promise.all`.
- New captain-facing edit UI in `app/admin/history/page.tsx` (qty +/- buttons, "Done" button) lacks `data-testid` that the sibling `TableSheet`/`ParcelSheet` components consistently add for equivalent controls — inconsistent with the codebase's test-coverage convention.

**Why:** Captured so a follow-up review on this branch (or the next activity-log iteration) doesn't need to re-derive these from scratch, and so the Supabase-error-handling pattern's known blast radius includes financial rollup logic, not just session-lookup branching.

**How to apply:** When reviewing further changes to `lib/database.ts`'s logging helpers or the captain walk-in flow, check whether these were fixed; don't re-flag as new if already addressed. If `cancelEmptySession`/`AddItemModal` race is fixed, prefer a guard that disables closing while `saving` is true, or makes the abandon-check atomic (e.g. a single conditional UPDATE with a NOT EXISTS subquery on `orders`).

[[supabase-error-handling-patterns]]
[[ordering-system-review]]
