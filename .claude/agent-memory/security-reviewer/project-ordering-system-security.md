---
name: project-ordering-system-security
description: Security findings for the ordering system server actions in lib/database.ts (reviewed 2026-06-21)
metadata:
  type: project
---

Security audit of 378-line ordering system block added to lib/database.ts on the ordering_system branch (2026-06-21).

**Key architectural fact:** All five functions (createOrJoinSession, placeOrder, approveOrder, rejectOrder, generateBill) are "use server" server actions with zero caller-side authentication checks. The admin layout.tsx auth guard is client-side only (useEffect) — it cannot gate Server Actions called directly.

**Why:** approveOrder and rejectOrder are intended to be called from the admin panel (T11/T12), but there is no server-side check that the caller is an authenticated admin before mutating order status and creating print_jobs rows. A guest who discovers the orderId (e.g., via Realtime subscription since orders has a public SELECT policy) can call approveOrder or rejectOrder directly.

**Critical findings to track:**
1. approveOrder/rejectOrder have no admin authentication check — any caller with an orderId can approve/reject orders and generate KOT print jobs.
2. generateBill has no admin authentication check — any caller with a sessionId can generate a bill and mark a session as bill_generated.
3. createOrJoinSession does not verify restaurantId owns tableId — cross-tenant session injection possible (minor in single-tenant deploy, critical if multi-tenant).
4. placeOrder does not validate is_available on dishes — unavailable dishes can be ordered.
5. placeOrder does not validate quantity > 0 — zero or negative quantities are accepted.
6. placeOrder does not verify sessionId belongs to the calling party — any sessionId accepted.
7. NEXT_PUBLIC_SUPABASE_SERVICE_ROLE is a NEXT_PUBLIC_ var (bundle-exposed) used as fallback in lib/database.ts line 10. lib/supabase-admin.ts also uses it exclusively.
8. orders, table_sessions, bills, customers, order_items all have "Allow public SELECT" RLS policies — all order data is world-readable.
9. PIN is generated with Math.random() (not cryptographically secure) but acceptable for 4-digit restaurant POS.
10. No rate limiting or brute-force lockout on PIN verification in createOrJoinSession.

**STATUS (updated 2026-07-18):** Findings #1, #2, #8 FIXED, and the broader "server actions have no auth" gap closed.
- lib/auth-guard.ts added: `requireStaff()` (any authenticated admin/captain) and `requireAdmin()` (authenticated, non-captain). Both use `createServerClient` + `cookies()` + `getUser()` (verifies JWT, not just decode).
- Guards wired into 24 privileged server actions in lib/database.ts: requireAdmin on dish/category/review CRUD + getAnalyticsData + getAllDishesAdmin; requireStaff on approveOrder, rejectOrder, getPendingOrders, getRestaurantId, getTablesWithSessions, getDailyBillsSummary, closeTable, forceResetTable, settleBill, getSessionBill, moveTableSession, reprintKot, updateOrderItemQuantity.
- Guest actions intentionally remain unguarded: createOrJoinSession, joinTable, registerHost, placeOrder, generateBill (guest "Request Bill"), getOrdersForSession, shared-cart ops, findOrCreateCustomer, getTableEntry, submitReview, ratings/favourites.
- Migration 2026071801_lock_down_ordering_rls.sql: dropped all anon public SELECT/INSERT on the 8 ordering tables (killed world-readable table_sessions.pin + customers PII + public print_jobs INSERT). SELECT now TO authenticated only; restaurants keeps an authenticated UPDATE path. session_cart_items untouched (guest Realtime).
- STILL OPEN from this list: #3 (createOrJoinSession cross-tenant), #4/#5 (placeOrder is_available + quantity>0 validation), #6 (session↔caller binding), #7 (NEXT_PUBLIC_SUPABASE_SERVICE_ROLE rename+rotate), #9/#10 (PIN Math.random + brute-force). Migration must be applied to prod (`supabase db push`) — writing the file does NOT apply it.

**How to apply:** When reviewing any future Server Action that touches orders, bills, or print_jobs, always check for server-side admin auth before the first DB mutation. The client-side layout guard is NOT sufficient. Use requireStaff()/requireAdmin() from lib/auth-guard.ts.

See [[project-rls-policies]] for the full RLS policy set on ordering tables.
