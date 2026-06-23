# T15 — QR code generator (P2)

**Day 3 · Phase 1 assets · depends on: T06 (URL shape), T14 (print-bridge setup) · unblocks: T13 settings download (stub → real)**

## Goal
Generate one QR per table, bundled into a printable PDF, each encoding the table-entry URL that
T06 resolves (`/{slug}/table/{number}`).

## Where it lives (reuse the print-bridge — do NOT make a 3rd standalone setup)
T14 already created a self-contained `print-bridge/` with a `tsx` runner, its own `package.json`,
and a **service-role Supabase client** (`SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` in
`print-bridge/.env`). Put the generator there and reuse all of it.

## Files
- `print-bridge/generateQR.ts` — new (standalone CLI script, run via tsx).
- `print-bridge/package.json` — add deps `qrcode`, `pdfkit` and devDeps `@types/qrcode`,
  `@types/pdfkit`; add script `"qr": "tsx generateQR.ts"`.
- `print-bridge/.gitignore` — add `output/` (PDF output is a build artifact, not committed).
- `print-bridge/.env.example` — add `QR_BASE_URL=https://tastefy.food` (confirm the real
  production domain before printing for real; this is the host the QR points at).

Run: `cd print-bridge && npm i && npm run qr`.

## Logic
1. **Config** (env first, arg/default fallback):
   - `slug` — `"taksh"` (single-restaurant app).
   - `baseUrl` — `process.env.QR_BASE_URL` (default `https://tastefy.food`). **No trailing slash**;
     strip one if present.
2. **Table list — read from DB, don't hardcode the count.** `taksh` has **16** tables seeded
   (not 10). Use the existing service-role client:
   ```ts
   const { data: rest } = await db.from("restaurants").select("id").eq("slug", slug).single()
   const { data: tables } = await db.from("restaurant_tables")
     .select("table_number").eq("restaurant_id", rest.id).order("table_number")
   ```
   Fallback only if DB unreachable: `tableCount` env (default 16) → `[1..N]`.
3. **Per table** (`table_number`):
   - URL = `${baseUrl}/${slug}/table/${table_number}`.
   - `const png = await QRCode.toBuffer(url, { errorCorrectionLevel: "H", width: 600, margin: 1 })`
     — **ecc level H** (required), PNG buffer for embedding.
4. **PDF** with `pdfkit`:
   - `new PDFDocument({ size: "A5", margin: 40 })`, pipe to
     `fs.createWriteStream("./output/qr-codes-taksh.pdf")` (mkdir `output/` first).
   - The first page exists by default; for tables after the first call `doc.addPage()`.
   - Per page: QR centered (`doc.image(png, x, y, { width: 250 })`, compute `x` to center),
     **`TABLE {n}`** bold below it, small **`Scan to order`** subtitle.
   - `doc.end()`; await the stream `"finish"` event before exiting so the file is flushed.
5. Log the output path + table count on success.

## Relationship to T13 Settings
The T13 Settings page has a **disabled "Download PDF"** button (stub). T15 delivers the generator
as a **CLI script**, not a wired button — generating a multi-page PDF server-side from a browser
click would need a new API route (out of scope). Leave the button disabled; optionally update its
tooltip to "Run `npm run qr` in print-bridge". (Document this; don't build the route.)

## Test
- `cd print-bridge && npm i && npm run qr` → `print-bridge/output/qr-codes-taksh.pdf` exists with
  **16 pages** (one per seeded table).
- Scanning page 3's QR opens `https://tastefy.food/taksh/table/3` → T06 resolves it to the menu
  with a live table session context.
- ecc level is H (dense QR, corner-correctable).

## Definition of Done
- [ ] `generateQR.ts` in `print-bridge/`, runnable via `npm run qr` (tsx), deps added to its package.json
- [ ] table list read from `restaurant_tables` (16 pages), not a hardcoded 10
- [ ] one A5 page per table: centered QR + `TABLE {n}` + `Scan to order`
- [ ] URLs are `{baseUrl}/{slug}/table/{n}` matching the T06 route, ecc level **H**
- [ ] output to `print-bridge/output/`, `output/` gitignored
