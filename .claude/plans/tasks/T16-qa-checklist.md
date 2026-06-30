# T16 — Full system QA checklist (P3)

**Day 3 · cross-cutting · depends on: all prior (T01–T15) · unblocks: go-live (real printers)**

## Goal
A manual, end-to-end QA checklist covering customer app + admin panel + print bridge (mock), with
the **approval gate explicitly verified** (no KOT reaches the kitchen without an Approve).

## Files
- `docs/qa-checklist.md` — new (markdown with checkboxes; this is a deliverable doc, not code).

## Pre-requisites (write these as a setup block at the top of the checklist)
1. `npm run dev` running (customer app + admin at localhost:3000).
2. **Print bridge running in mock mode**: `cd print-bridge && npm i && npm start` with
   `MOCK_PRINT=true` and a valid `SUPABASE_SERVICE_ROLE_KEY` in `print-bridge/.env`. KOT/bill
   "prints" show up in **this console**.
3. Admin logged in (`/admin` → dashboard) — Approve / Generate Bill need the authenticated JWT;
   the bridge needs the service role key.
4. Tables 1–16 seeded for `taksh` (already done in T01).
5. (Optional) Supabase table editor open on `print_jobs` and `orders` for direct verification.

## Where to check (reference map — put near the top)
- Customer order flow → `components/OrderFlow.tsx` (state machine
  `idle → show-pin | enter-pin → checkout → confirmation`), `CheckoutForm.tsx`, `OrderConfirmation.tsx`.
- Pending queue → **`/admin/incoming`** (T11). Live tables → **`/admin/tables`** (T12).
- Customers → **`/admin/customers`**, Reports → **`/admin/reports`** (T13).
- KOT/bill output → **print-bridge console** (mock) AND **`print_jobs`** rows (`type`, `status`).

## Cases (each: exact steps / expected result / where to check)
1. **First order at a table** — open `/taksh/table/3`, add 2 items, PLACE ORDER → a 4-digit **PIN
   is shown** → Confirm → checkout with **name only** (phone left blank) → confirmation shows the
   items + the PIN.
   - *Expected:* order appears in **Incoming Orders as pending** and is **NOT yet printed** (bridge
     console silent; no `kot` row in `print_jobs`). Admin **Approve** → a KOT prints in the bridge
     console; the card leaves the queue. `/admin/tables` shows **Table 3 ACTIVE** with the running
     total — **no page refresh needed** (Realtime).
2. **Approval gate (the core fix)** — verify the gate both directions.
   - Before Approve: **no `kot` row exists** for the order (check `print_jobs`); bridge silent.
   - After Approve: **exactly one** `kot` row (`status` → `sent` once the bridge processes it).
   - **Reject** a different pending order → it leaves the queue, **no `kot` row** is ever created.
3. **Second person joins (reorder, round 2)** — on another device/tab open the **same** table URL
   `/taksh/table/3`, add an item, PLACE ORDER → prompted to **enter the existing PIN** (not given a
   new one) → enter the correct PIN → order pending → Approve → a **round-2 KOT** prints. The
   `/admin/tables` drawer for Table 3 shows **both rounds** and the **combined total**.
4. **Wrong PIN** — same flow, enter an incorrect PIN → clear inline "Incorrect PIN" error, **no
   order created** (nothing new in Incoming Orders; `createOrJoinSession` throws and is caught).
5. **Bill generation** — `/admin/tables` → Table 3 → **Generate Bill** → a **bill prints** in the
   bridge console with **both rounds**, correct **subtotal / GST (5%) / total**; a `bill` row lands
   in `print_jobs`; Table 3 status → **BILL GENERATED**. Confirm it also shows in **`/admin/reports`**
   for today (total/count/avg update).
6. **Close table** — Table 3 drawer → **Close Table** → card returns to **OPEN** (session
   `status=closed`); drawer closes.
7. **Menu availability** — `/admin/menu` mark an item unavailable → it disappears on the customer
   app; re-enable → it reappears.
8. **Customer data + WhatsApp** — place an order entering **name + phone**, then tick the **"Send me
   offers on WhatsApp"** checkbox (note: the checkbox **only appears after a phone number is
   entered**) → the guest shows in **`/admin/customers`** with the WhatsApp **✓**, most-recent first.
   A name+phone order **without** ticking → shows with **–**.

## Definition of Done
- [ ] pre-requisites + "where to check" reference block written
- [ ] all 8 cases written with steps / expected / where-to-check, as checkboxes
- [ ] approval gate (pending → approve → exactly one KOT; reject → none) explicitly covered both ways
- [ ] reorder/round-2, wrong PIN, bill (both rounds + GST), close, availability, customer+WhatsApp covered
