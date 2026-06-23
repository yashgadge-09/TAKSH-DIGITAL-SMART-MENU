# TAKSH Digital Smart Menu — End-to-End QA Checklist

> Run this checklist before going live with real printers. All 8 cases must pass.

---

## Setup (complete before starting)

- [ ] `npm run dev` is running — customer app + admin at `http://localhost:3000`
- [ ] Print bridge running in **mock mode**:
  ```
  cd print-bridge && npm i && npm start
  ```
  Requires `print-bridge/.env` with `MOCK_PRINT=true` and a valid `SUPABASE_SERVICE_ROLE_KEY`.
  KOT/bill output appears in **this terminal** (not the browser).
- [ ] Admin is logged in at `/admin` (dashboard loads). Approve / Generate Bill require an authenticated JWT.
- [ ] Tables 1–16 seeded for `taksh` (done in T01 migration).
- [ ] *(Optional)* Supabase table editor open on `orders` and `print_jobs` for direct row-level verification.

---

## Reference Map

| Area | Location |
|------|----------|
| Customer order flow | `components/OrderFlow.tsx` · states: `idle → show-pin \| enter-pin → checkout → confirmation` |
| Checkout form | `components/CheckoutForm.tsx` |
| Order confirmation | `components/OrderConfirmation.tsx` |
| Pending orders queue | `/admin/incoming` (T11) |
| Live table grid | `/admin/tables` (T12) |
| Customer directory | `/admin/customers` (T13) |
| Daily billing report | `/admin/reports` (T13) |
| KOT / bill output | Print-bridge console (mock) **and** `print_jobs` rows (`type`, `status`) |

---

## Cases

### Case 1 — First order at a table

**Steps:**
1. Open `http://localhost:3000/taksh/table/3` in the browser.
2. Add 2 different menu items to the cart.
3. Tap **PLACE ORDER**.
4. A **4-digit PIN is displayed** — note it down.
5. Confirm and proceed to checkout.
6. Enter a **name only** (leave phone blank).
7. Submit the order.

**Expected:**
- [ ] The order confirmation screen shows the ordered items and the PIN.
- [ ] `/admin/incoming` shows the order card with status **pending** — **no prompt** required, it appears without page refresh (Realtime).
- [ ] Print-bridge console is **silent** (no KOT output yet).
- [ ] In `print_jobs`: **no `kot` row exists** for this order yet.
- [ ] Admin clicks **Approve** on the card → a KOT prints in the bridge console; the card disappears from the queue.
- [ ] `/admin/tables` shows **Table 3 ACTIVE** with the correct running total — **no page refresh needed** (Supabase Realtime).

---

### Case 2 — Approval gate (both directions)

**Steps (Approve path):**
1. Place a new order on any table.
2. Before touching Approve — open `print_jobs` in the Supabase table editor.
3. Confirm no `kot` row exists for this order yet.
4. Click **Approve** in `/admin/incoming`.
5. Wait ~2 s for the bridge tick.

**Expected:**
- [ ] Before Approve: **zero** `kot` rows for the order in `print_jobs`; bridge console silent.
- [ ] After Approve: **exactly one** `kot` row appears; its `status` changes from `pending` → `sent` after the bridge processes it.

**Steps (Reject path):**
1. Place another new order on a different table.
2. Click **Reject** in `/admin/incoming`.

**Expected:**
- [ ] The order card leaves the queue immediately.
- [ ] **No** `kot` row is ever created for the rejected order (check `print_jobs`).
- [ ] Bridge console remains silent for this order.

---

### Case 3 — Second person joins (reorder / round 2)

**Steps:**
1. Table 3 must have an active session from Case 1 (do not close it).
2. Open `http://localhost:3000/taksh/table/3` in a **second browser tab or device**.
3. Add 1 menu item to the cart.
4. Tap **PLACE ORDER**.
5. The flow should prompt to **enter the existing PIN** (not generate a new one).
6. Enter the correct PIN from Case 1.
7. Complete checkout (name optional).
8. Admin Approves the new order.

**Expected:**
- [ ] The second order is placed using the **same session** (same PIN, no new session created).
- [ ] A **round-2 KOT** prints in the bridge console (contains only the new item).
- [ ] `/admin/tables` drawer for Table 3 shows **both rounds** and the **combined total** of all approved orders.

---

### Case 4 — Wrong PIN

**Steps:**
1. Table 3 still has an active session from Cases 1–3.
2. Open `http://localhost:3000/taksh/table/3` in a new tab.
3. Add an item, tap **PLACE ORDER**.
4. Enter an **incorrect PIN** (e.g., change one digit).

**Expected:**
- [ ] An inline **"Incorrect PIN"** error appears in the UI — no order is created.
- [ ] `/admin/incoming` shows **no new order card** for Table 3.
- [ ] `createOrJoinSession` threw and was caught cleanly (no unhandled error in browser console).

---

### Case 5 — Bill generation

**Steps:**
1. Go to `/admin/tables` → click on **Table 3** to open its drawer.
2. Confirm both rounds are visible with correct items and per-round totals.
3. Click **Generate Bill**.
4. Wait ~2 s for the bridge tick.

**Expected:**
- [ ] A **bill** prints in the bridge console containing **both rounds**, line items, subtotal, **GST 5%**, and final total.
- [ ] A `bill` row appears in `print_jobs` with `status: sent`.
- [ ] Table 3 status in the grid changes to **BILL GENERATED**.
- [ ] `/admin/reports` for today shows an updated total, order count, and average — the new bill is included.

---

### Case 6 — Close table

**Steps:**
1. Table 3 drawer (status: BILL GENERATED) → click **Close Table**.

**Expected:**
- [ ] The drawer closes.
- [ ] Table 3 card in the grid returns to **OPEN** (session `status = closed`).
- [ ] Table 3 is ready to accept a new session from scratch.

---

### Case 7 — Menu item availability toggle

**Steps:**
1. Go to `/admin/menu`.
2. Find any currently-available dish and mark it **Unavailable**.
3. Open the customer-facing menu at `http://localhost:3000/menu`.

**Expected:**
- [ ] The dish is **no longer visible** on the customer menu (or is shown as unavailable, depending on implementation).

**Steps (re-enable):**
4. Go back to `/admin/menu` and mark the dish **Available** again.
5. Refresh the customer menu.

**Expected:**
- [ ] The dish **reappears** on the customer menu.

---

### Case 8 — Customer data and WhatsApp opt-in

**Steps (with WhatsApp opt-in):**
1. Place a fresh order on any open table.
2. At checkout, enter a **name** and a **phone number**.
3. Confirm the **"Send me offers on WhatsApp"** checkbox becomes visible only after a phone number is typed.
4. Tick the checkbox, then submit.

**Expected:**
- [ ] The guest appears in `/admin/customers`, most-recent first.
- [ ] Their row shows a WhatsApp **✓** (opted in).

**Steps (without WhatsApp opt-in):**
5. Place another order on a different table.
6. Enter name + phone at checkout, but **do not** tick the WhatsApp checkbox.
7. Submit.

**Expected:**
- [ ] The guest appears in `/admin/customers`.
- [ ] Their row shows **–** in the WhatsApp column (not opted in).

---

## Sign-off

| Case | Tester | Date | Pass / Fail | Notes |
|------|--------|------|-------------|-------|
| 1 — First order | | | | |
| 2 — Approval gate | | | | |
| 3 — Round 2 reorder | | | | |
| 4 — Wrong PIN | | | | |
| 5 — Bill generation | | | | |
| 6 — Close table | | | | |
| 7 — Availability toggle | | | | |
| 8 — Customer + WhatsApp | | | | |
