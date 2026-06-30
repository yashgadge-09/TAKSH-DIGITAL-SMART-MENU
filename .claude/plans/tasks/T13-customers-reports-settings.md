# T13 — Customers + Reports + Settings pages (D4)

**Day 3 · Phase 6/cross-cutting · depends on: T01, T05, T10 · unblocks: T15 (QR via settings)**

## Goal
Three admin pages: customer directory, daily sales report, and restaurant settings (incl. table/QR section).

## Files
- `app/admin/customers/page.tsx` — replace the T10 placeholder (client component).
- `app/admin/reports/page.tsx` — replace the T10 placeholder (client component).
- `app/admin/settings/page.tsx` — replace the T10 placeholder (client component).

Each wraps in `<AdminLayout>`, gold/dark theme like siblings.

**Auth / RLS basis:** admin is logged in (`supabase.auth.signInWithPassword`), so the shared
browser client (`lib/supabase.ts`) carries the `authenticated` JWT. RLS grants public SELECT on
`customers`/`bills`/`table_sessions`/`restaurants`/`restaurant_tables` and
`update to authenticated using(true)` on `restaurants`. So **all three pages read directly via the
anon/browser `supabase` client, and Settings-save is a direct authenticated update — no new server
action.**

**`restaurantId`:** no helper exists. Resolve on mount via
`supabase.from('restaurants').select('id, name, address, gstin, upi_id').eq('slug','taksh').single()`.
Settings reuses this same row for both display and edit.

## Logic
### Customers (`/admin/customers`)
- `supabase.from('customers').select('name, phone, whatsapp_opted_in, created_at')
  .eq('restaurant_id', restaurantId).order('created_at', { ascending:false })`.
- Table columns: Name, Phone (or "—"), WhatsApp opted-in (✓ / –), Created date. (No WhatsApp
  sending — display only.) Loading + empty states.

### Reports (`/admin/reports`)
- Date picker, default **today** (IST). Bills timestamp is `bills.generated_at`.
- `supabase.from('bills').select('total, subtotal, gst_amount, generated_at,
  table_sessions!inner(restaurant_id, table_id)').eq('table_sessions.restaurant_id', restaurantId)`
  then filter `generated_at` within the chosen day's IST bounds (compute UTC start/end of the IST
  day; don't string-compare raw timestamps).
- Show: **Total billed** (Σ `total`), **# bills** (count), **Average bill** (total ÷ count, guard
  ÷0). Plus a list of each bill: time (IST `HH:MM`) + amount. Empty state when no bills.

### Settings (`/admin/settings`)
- Editable fields from the resolved `restaurants` row: name, address, GSTIN (`gstin`), UPI ID
  (`upi_id`). Save → `await supabase.from('restaurants').update({ name, address, gstin, upi_id })
  .eq('id', restaurantId)` (authenticated). Toast on success/failure; disable Save while in flight.
- QR Codes section: list `restaurant_tables` (ordered by `table_number`); **"Download QR Codes PDF"**
  button is a disabled/placeholder stub here — real generation lands in T15, encoding
  `/{slug}/table/{number}` (slug `taksh`).

## Test
- Place an order with name+phone+WhatsApp opt-in (guest flow / `findOrCreateCustomer`) → appears
  in Customers with ✓, most-recent first.
- Generate a bill (T12) → appears in Reports for today; total/count/avg correct.
- Edit a Settings field + Save → persists on reload (row actually updated).

## Definition of Done
- [ ] customers list (recent first) with WhatsApp ✓/– column
- [ ] reports totals (billed/count/avg) + per-bill list, date-filtered (IST)
- [ ] settings edit + save (direct authenticated update, persists)
- [ ] table list + disabled QR-download entry point (real gen in T15)
