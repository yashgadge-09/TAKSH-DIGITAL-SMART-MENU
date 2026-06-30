# T14 — Print bridge (mock mode) (P1)

**Day 3 · Phase 4 · depends on: T01, T04 (KOT), T05 (bill) · unblocks: T16 QA**

## Goal
A standalone Node.js (TypeScript) script — NOT part of Next.js — that polls `print_jobs` and "prints" pending jobs. Mock mode first (console), real ESC/POS later.

## Files
- `print-bridge/index.ts` — new (standalone; NOT imported by Next.js).
- `print-bridge/.env.example` — `MOCK_PRINT=true`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
  `KITCHEN_PRINTER_IP`, `RECEPTION_PRINTER_IP`, `POLL_MS=2000`.
- `print-bridge/package.json` — **own deps** (`@supabase/supabase-js`, `dotenv`) + a TS runner.
  `dotenv` is NOT a root dependency, so the bridge must be self-contained. Use `tsx`
  (devDep) with `"scripts": { "start": "tsx index.ts" }`; run via `cd print-bridge && npm i && npm start`.
- `print-bridge/.gitignore` — ignore `.env` and `node_modules`.
- (Optional) add `"print-bridge"` to the root `tsconfig.json` `exclude` so the Next build /
  root `tsc` doesn't pick it up.

## Logic
1. Supabase client with **service role key** (REQUIRED — `print_jobs` has only a public INSERT
   policy and no public SELECT/UPDATE; the service role bypasses RLS for the read + status update).
2. Every `POLL_MS` (default 2s): query `print_jobs` where `status='pending'`, order by
   `created_at` asc. Process sequentially.
3. Per job (`job.type` is `'kot'` | `'bill'`, data in `job.payload`):
   - `MOCK_PRINT=true` → log formatted receipt to console (formats below).
   - else → TCP socket to printer IP (`KITCHEN_PRINTER_IP` for `kot`, `RECEPTION_PRINTER_IP` for
     `bill`) port 9100, send ESC/POS bytes, close.
4. On success → `update({ status:'sent' }).eq('id', job.id)`.
5. On failure → `update({ status:'failed' })`, log error, **keep the loop running** (wrap each
   tick AND each job in try/catch; never let a throw kill the process).
6. Avoid overlapping ticks: guard with an `isRunning` flag (or `setTimeout` chained after each
   tick completes rather than a bare `setInterval`).

## Payload contracts (EXACT field names — copy from the code, do not invent)
KOT — set by `approveOrder` (`lib/database.ts`), `job.payload`:
```ts
{ tableNumber: number, roundNumber: number, time: string /* "HH:MM" IST */,
  items: { name: string, qty: number }[] }
```
Bill — set by `generateBill` (`lib/database.ts`), `job.payload`:
```ts
{ restaurantName, address, gstin, upiId,
  tableNumber: number|null, customerName: string,
  rounds: { number: number, time: string, items: { name: string, qty: number, price: number }[] }[],
  subtotal: number, gstRate: number /* 5 */, gstAmount: number, total: number }
```

## Mock formats
- **KOT:** header "KOT", `Table {tableNumber} · Round {roundNumber}`, `time`, then `{qty} x {name}` lines.
- **Bill:** `restaurantName` + `address` + `GSTIN: {gstin}` header; `Table {tableNumber}` /
  `Customer: {customerName}`; each round (`Round {number} — {time}`) with `{qty} x {name}  ₹{price*qty}`
  lines; then `Subtotal ₹{subtotal}`, `GST ({gstRate}%) ₹{gstAmount}`, `TOTAL ₹{total}`, `UPI: {upiId}`.

## Test
- `MOCK_PRINT=true`, run bridge → approve an order (T11) → KOT prints to console, row → `sent`.
- Generate a bill (T12) → bill prints to console, row → `sent`.
- Force a bad job (e.g. unreachable printer in non-mock) → row → `failed`, loop keeps polling.

## Definition of Done
- [ ] self-contained `print-bridge/` (own package.json + deps + tsx runner), runs outside Next
- [ ] polls pending every `POLL_MS` with the **service role** client
- [ ] mock KOT + bill console formats match the exact payload contracts above
- [ ] status → `sent` on success / `failed` on error
- [ ] loop survives errors (per-job + per-tick try/catch; no crash, no overlapping ticks)
