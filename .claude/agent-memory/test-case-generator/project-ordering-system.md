---
name: project-ordering-system
description: Ordering system backend (T01–T05) status, invariants, and key implementation facts for test generation
metadata:
  type: project
---

Ordering system backend (five server actions in lib/database.ts) was implemented and E2E smoke-tested on 2026-06-21. DB returned to clean baseline after smoke test. Schema migration: supabase/migrations/2026062101_ordering_system.sql. Branch: ordering_system.

**Why:** Restaurant kitchen must never print without human approval; billing must never include rejected food. These are safety invariants, not just functional requirements.

**How to apply:** Every test suite touching these five functions MUST assert the four core invariants (see below) as explicit, high-priority assertions. Do not treat them as implied.

## Four Core Invariants (highest priority in any test)
1. `placeOrder` creates ZERO print_jobs — never fires the printer, always lands in pending_approval
2. `approveOrder` is the ONLY kot-print-job creator — exactly one KOT per pending→approved transition
3. `rejectOrder` creates zero print_jobs — no KOT ever emitted for rejected orders
4. `generateBill` excludes rejected orders from totals AND is the only bill-print-job creator

## Seed Data
- Restaurant: TAKSH Veg, slug `taksh`, id `c7b441fe-8639-4540-b78b-cb16744234ab`
- Tables 1–16 available in restaurant_tables

## GST Formula
`gstAmount = Math.round(subtotal * 5) / 100` (NOT Math.round(subtotal * 0.05))
Verified: 2×90 + 1×140 = 320 subtotal → gst = Math.round(320*5)/100 = Math.round(16) = 16 → total 336

## Cleanup Order for Integration Tests
Delete in FK order: print_jobs → bills → order_items → orders → table_sessions → customers

## Key Implementation Notes
- `createOrJoinSession`: uses `.maybeSingle()` for active session lookup — guarantees at most one active session per table
- `placeOrder`: dish snapshot uses `name_en` (not name_hi/mr); round_number computed as max existing + 1 via `.maybeSingle()`
- `approveOrder`: flips status to `approved` BEFORE inserting KOT print_job (concurrent-call safety)
- `generateBill`: idempotency guard checks `session.status === 'bill_generated'` and returns existing bill from bills table
- `formatTimeIST`: uses `Asia/Kolkata` timezone, `hour12: false`, format `HH:MM`

See [[project-ordering-system]] for E2E smoke test results.
