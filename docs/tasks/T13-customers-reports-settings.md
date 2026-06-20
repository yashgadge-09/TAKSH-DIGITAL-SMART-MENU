# T13 — Customers + Reports + Settings pages (D4)

**Day 3 · Phase 6/cross-cutting · depends on: T01, T05, T10 · unblocks: T15 (QR via settings)**

## Goal
Three admin pages: customer directory, daily sales report, and restaurant settings (incl. table/QR section).

## Files
- `app/admin/customers/page.tsx` — new
- `app/admin/reports/page.tsx` — new
- `app/admin/settings/page.tsx` — new

## Logic
### Customers (`/admin/customers`)
- Fetch `customers` for restaurant; table: Name, Phone, WhatsApp opted-in (✓/–), Created date; sort most-recent first. (No WhatsApp sending yet.)

### Reports (`/admin/reports`)
- Date picker (default today).
- Query `bills` joined `table_sessions` for that date/restaurant.
- Show: Total billed (Σ totals), # bills (count), Average bill. Plus a clean list of each bill (time + amount).

### Settings (`/admin/settings`)
- Editable fields from `restaurants`: name, address, GSTIN, UPI ID; Save → update row.
- QR Codes section: list `restaurant_tables`; "Download QR Codes PDF" button (placeholder initially; real generation in T15, encoding `/{slug}/table/{number}`).

## Test
- Place an order with name+phone+WhatsApp → appears in Customers with ✓.
- Generate a bill → appears in Reports for today; totals correct.
- Edit a Settings field + Save → persists on reload.

## Definition of Done
- [ ] customers list (recent first)
- [ ] reports totals (billed/count/avg) + list
- [ ] settings edit + save
- [ ] table list + QR download entry point
