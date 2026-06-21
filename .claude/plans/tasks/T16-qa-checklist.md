# T16 — Full system QA checklist (P3)

**Day 3 · cross-cutting · depends on: all prior · unblocks: go-live (real printers)**

## Goal
A manual, end-to-end QA checklist covering customer app + admin panel + print bridge (mock), with the **approval path explicitly verified**.

## Files
- `docs/qa-checklist.md` — new

## Cases (each with exact steps / expected result / where to check)
1. **First order at a table** — `/taksh/table/3`, add 2 items, Place Order → PIN shown → checkout (name only) → confirmation shows items + PIN; order appears in **Incoming Orders as pending** (NOT yet printed); admin **Approve** → KOT prints in bridge console; table dashboard shows Table 3 ACTIVE with total.
2. **Approval gate (the fix)** — confirm that before Approve, **no KOT exists**; after Approve, exactly one KOT; **Reject** path → no KOT.
3. **Second person joins (reorder round 2)** — other device, same table URL, add item, Place Order → asked for PIN (not new) → correct PIN → order pending → approve → round-2 KOT; dashboard shows combined total.
4. **Wrong PIN** — clear error, no order created.
5. **Bill generation** — dashboard → Table 3 → Generate Bill → bill prints with both rounds, correct subtotal/GST/total; status → BILL GENERATED.
6. **Close table** — Close Table → returns to OPEN.
7. **Menu availability** — mark item unavailable → gone on customer app; re-enable → reappears.
8. **Customer data** — order with name+phone+WhatsApp → appears in Customers with opted-in ✓.

## Definition of Done
- [ ] all cases written with steps/expected/where-to-check, checkboxes
- [ ] approval gate (pending → approve → KOT; reject → none) explicitly covered
- [ ] reorder, wrong PIN, bill, close, availability, customer data covered
