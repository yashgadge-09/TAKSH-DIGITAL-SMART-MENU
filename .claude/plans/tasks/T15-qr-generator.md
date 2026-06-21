# T15 — QR code generator (P2)

**Day 3 · Phase 1 assets · depends on: T06 (URL shape) · unblocks: T13 settings download**

## Goal
Generate one QR per table, bundled into a printable PDF, each encoding the table-entry URL from T06.

## Files
- `print-bridge/generateQR.ts` (or `scripts/generateQR.ts`) — new
- deps: `qrcode`, `pdfkit`

## Logic
- Inputs (args or hardcoded): `restaurantSlug` (e.g. `taksh`), `tableCount` (10), `baseUrl` (e.g. `https://tastefy.food`).
- For table 1..N:
  1. QR encoding `{baseUrl}/{restaurantSlug}/table/{tableNumber}`, error-correction level `H`.
  2. Add to PDF: one A5 page per table, QR centered ~250×250, "TABLE {n}" bold below, "Scan to order" small.
- Save to `./output/qr-codes-{restaurantSlug}.pdf`.
- Runnable: `npx ts-node generateQR.ts`.

## Test
- Run → `output/qr-codes-taksh.pdf` exists, 10 pages, scanning page 3 opens `/taksh/table/3`.

## Definition of Done
- [ ] PDF generated to output/
- [ ] one A5 page per table
- [ ] URLs match T06 route, ecc level H
