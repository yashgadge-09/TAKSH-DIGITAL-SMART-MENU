# Tastefy Ordering System — Build Plan (analysis + per-task checkpoints)

## Context

**Why this work exists.** TAKSH Digital Smart Menu is currently a menu-browse + in-memory cart + post-order feedback app. "SHOW ORDER TO WAITER" does **not** persist any order. We are adding the real ordering system from the workflow diagram:

`Phase 1 table entry (QR → table → session)` → `Phase 2 browse & cart → place order` → `Phase 3 captain/owner approval BEFORE any KOT` → `Phase 4 kitchen print` → `Phase 5 mid-meal reorder via same QR` → `Phase 6 single aggregated bill at close`.

**Outcome:** a guest scans a per-table QR, orders, the order lands as *pending approval*, the owner approves it from an Incoming Orders panel (the only thing that fires a KOT), guests reorder on the same table/PIN, and at the end the owner generates one aggregated bill and closes the table.

**Confirmed decisions:**
- Backend logic = **Next.js server actions** in `lib/database.ts` (service role via `lib/supabase-admin.ts`), **not** edge functions — matches the existing codebase.
- **Incoming Orders approval panel lives inside the existing `/admin` dashboard** (single owner; no separate captain app for v1).
- Customer entry route = **`/[slug]/table/[number]`**.
- **Per-task deliverables:** each task gets its own self-contained file under **`docs/tasks/Txx-name.md`** (full spec + DoD checklist), executed as **daily checkpoints grouped by phase (~3 days)**.
- Supabase MCP was disconnected this session; **T1 first verifies the live schema/functions via MCP** before code depends on it.

## Execution protocol
Implement **one task at a time**, give test steps, and **wait for confirmation** before the next. Day grouping:
- **Day 1:** T1–T5 (schema + all server actions)
- **Day 2:** T6–T9 (customer entry route + order flow)
- **Day 3:** T10–T16 (admin panels + print bridge + QR + QA)

---

## Analysis pass (no code changed)

### Repo ground truth (verified by exploration)
- **Customer:** cart `context/CartContext.tsx`; `components/CartDrawer.tsx` "SHOW ORDER TO WAITER" → `components/OrderSummarySheet.tsx` → `components/OrderLikeModal.tsx`. **No** order persisted, **no** table route / session / PIN / checkout / confirmation, **no** notion of `restaurantId`/`tableId`. Cart shape: `{id,name,price,image,quantity,category}`.
- **Admin:** Supabase email/password auth `app/admin/layout.tsx`; sidebar `components/AdminSidebar.tsx` (Dashboard/Menu/Categories/Today's Special/Analytics/Review Prompts/Preview). **No** live table dashboard, **no Realtime anywhere**, **no** approval/KOT panel, **no** Customers/Reports/Settings.
- **Supabase (repo):** migrations only for `dish_ratings`, `notification_queue`, `push_subscriptions`. Privileged writes via **server actions in `lib/database.ts`** (`"use server"`) using `lib/supabase-admin.ts`. **No `supabase/functions/`**; the 8 ordering tables are documented "created (0 rows)" in `supabase/CLAUDE.md` but have **no repo migrations** and were unverifiable this session.

### Phase mapping (diagram → PRD task)
| Phase | PRD task(s) | Verdict |
|---|---|---|
| 1 Table entry | E1, S2, P2 QR | ⚠️ No task builds the customer table route; C1 assumes ids already known. |
| 2 Browse & cart → place | cart (exists), C1, C2, E2 | OK except the merge below. |
| 3 Captain approval | — | ❌ MISSING ENTIRELY. |
| 4 Kitchen print | P1 | KOT row created in wrong step. |
| 5 Mid-meal reorder | E1, E2 round_number, C1/C3 | Partial; inherits approval gap. |
| 6 Billing | E3, D2, D4 | OK. |
| Cross-cutting | S1, D1, D3 (exists), D4, P3 | OK. |

### Flagged gap — CONFIRMED, still merged ❌
- **E2 `place-order` (prd.md:258-268)** inserts the `kot` `print_jobs` row on customer submit → kitchen prints with zero approval. Violates Phase 3.
- **S1 (prd.md:118-119)** `orders.status` default `'received'` → no `pending_approval`.
- **D2 (prd.md:522-528)** has only Generate Bill / Close Table — no Approve/Reject UI.

**Fix (in the tasks):** `placeOrder` → `pending_approval`, **no** print job; **new `approveOrder`** is the only KOT creator (+`rejectOrder`); **new Incoming Orders panel**; `orders.status` default `pending_approval`, lifecycle `pending_approval → approved → served`, plus `rejected`.

### Other conflicts flagged
- Phase 1 entry route unowned → new T6.
- Reorders (round 2+) must also flow through Incoming Orders, not auto-print.
- PRD assumes edge functions; we use server actions by decision.

---

## Build order (dependency-correct)
Schema → server logic → approval logic → customer UI → admin UI → print bridge/QA.

`T1 schema` → `T2 createOrJoinSession` → `T3 placeOrder` → `T4 approve/rejectOrder` → `T5 generateBill` → `T6 table route` → `T7 OrderFlow+PIN` → `T8 checkout` → `T9 confirmation` → `T10 admin nav` → `T11 Incoming Orders` → `T12 table dashboard` → `T13 customers/reports/settings` → `T14 print bridge` → `T15 QR` → `T16 QA`.

---

## Per-task index
See `docs/tasks/` for the full spec of each task.

| Task | File | Day | What it builds |
|------|------|-----|----------------|
| T01 | [T01-schema.md](tasks/T01-schema.md) | 1 | Schema verify + migrate + seed |
| T02 | [T02-create-or-join-session.md](tasks/T02-create-or-join-session.md) | 1 | createOrJoinSession server action |
| T03 | [T03-place-order.md](tasks/T03-place-order.md) | 1 | placeOrder (pending_approval, NO print job) |
| T04 | [T04-approve-reject-order.md](tasks/T04-approve-reject-order.md) | 1 | approveOrder / rejectOrder (only KOT creator) |
| T05 | [T05-generate-bill.md](tasks/T05-generate-bill.md) | 1 | generateBill server action |
| T06 | [T06-table-entry-route.md](tasks/T06-table-entry-route.md) | 2 | /[slug]/table/[number] entry route |
| T07 | [T07-order-flow-pin.md](tasks/T07-order-flow-pin.md) | 2 | OrderFlow + PIN (replaces Show to Waiter) |
| T08 | [T08-checkout-form.md](tasks/T08-checkout-form.md) | 2 | Checkout form (customer upsert + place order) |
| T09 | [T09-order-confirmation.md](tasks/T09-order-confirmation.md) | 2 | Order confirmation + PIN reminder |
| T10 | [T10-admin-nav.md](tasks/T10-admin-nav.md) | 3 | Admin sidebar nav additions |
| T11 | [T11-incoming-orders.md](tasks/T11-incoming-orders.md) | 3 | Incoming Orders panel (Phase 3 approval UI) |
| T12 | [T12-table-dashboard.md](tasks/T12-table-dashboard.md) | 3 | Live table dashboard + Generate Bill / Close |
| T13 | [T13-customers-reports-settings.md](tasks/T13-customers-reports-settings.md) | 3 | Customers + Reports + Settings pages |
| T14 | [T14-print-bridge.md](tasks/T14-print-bridge.md) | 3 | Print bridge (mock mode) |
| T15 | [T15-qr-generator.md](tasks/T15-qr-generator.md) | 3 | QR code PDF generator |
| T16 | [T16-qa-checklist.md](tasks/T16-qa-checklist.md) | 3 | Full system QA checklist |

---

## Verification (end-to-end)
- After T1–T5: verify `placeOrder` creates **no** print job and `approveOrder` creates **exactly one** KOT.
- Full path: `npm run dev` → `/taksh/table/3` → add items → Place Order → PIN → checkout → confirmation (pending) → admin Incoming Orders → Approve → print bridge (mock) prints KOT → reorder round 2 via PIN → approve → dashboard running total → Generate Bill → bill prints → Close Table → OPEN.
- Build: `npm run build`. Print bridge run separately with `MOCK_PRINT=true`.
