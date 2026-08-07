---
name: project-activity-log-captain-roles
description: Security review of the admin-captain-k-rishta branch (activity_log audit trail, captain role-based post-bill lockdown, captain walk-in orders) — reviewed 2026-08-06
metadata:
  type: project
---

Reviewed `admin-captain-k-rishta` vs `main` (commit range ending 6be1ec3 "feat(db): activity_log audit trail + post-bill edit lockdown"). This branch closes real gaps and introduces solid patterns — worth recording as **known-good reference implementations**, not just findings.

**Known-good patterns confirmed in this branch (use as reference for future reviews):**
- Role check for "captain vs admin" is always `user.app_metadata?.role === 'captain'` off a `requireStaff()`-verified `User` (never `user_metadata`, which is user-editable). Central helper: `staffRole()` in `lib/database.ts`.
- Server Actions that gate a stricter sub-permission (e.g. `addItemsToSession({ printKot: false })` admin-only, `updateOrderItemQuantity` post-bill-decrease admin-only) do the check **inside the server action itself**, not just in the calling UI. Client props like `isAdmin` on `TableSheet`/`ParcelSheet` are explicitly commented "UI shaping only, server enforces" — verified true by reading the server code, not just the comment.
- `activity_log` (migration `2026080601_activity_log.sql`): RLS enabled, **zero policies** (service-role/BYPASSRLS only), plus a belt-and-braces `revoke update, delete on public.activity_log from anon, authenticated`. No FKs by design (audit rows must outlive the rows they describe). This is the correct pattern for an immutable audit table in this codebase — same as `print_jobs` and `parcel_counters`.
- `logActivity()` in `lib/database.ts` is a best-effort, swallowed-error insert called AFTER the state-mutating write in every caller — so a logging failure can never block or roll back the actual action, and (checked) no attacker-controlled unbounded string reaches the insert (dish names come from the `dishes` table set by admins; customer name is server-trimmed to 60 chars before it reaches `details.customerName`). This means the "swallow errors" pattern does not give a captain a way to force-fail the log to hide their own action.
- PIN exposure: `table_sessions.pin` is only ever read via `getTablesWithSessions()`, which is `requireStaff()`-gated. No browser/anon-key query against `table_sessions` exists outside `lib/database.ts`'s `adminSupabase` calls (verified via grep across `app/`, `components/`, `context/`). Confirmed NOT reachable by guests.
- `startCaptainOrder` correctly checks `tableRow.restaurant_id !== restaurantId` before opening a session (cross-tenant guard, relevant if multi-tenant is ever added), and relies on the pre-existing partial unique index `table_sessions_one_active_per_table` (migration `2026070203`) + Postgres error code `23505` for the race condition instead of a check-then-insert TOCTOU.

**Open finding from this review (not yet fixed as of 2026-08-06):**
- `startCaptainOrder({ customerPhone })` in `lib/database.ts` — client (`NewTableOrderModal.tsx`) validates the phone is exactly 10 digits, but the server action passes `customerPhone` straight into `findOrCreateCustomer()` with no format/length validation. An authenticated captain (trusted, but still worth closing) can persist arbitrary garbage into `customers.phone`, which is a phone-lookup key (`findOrCreateCustomer` dedupes by exact phone match) and may feed WhatsApp opt-in messaging later. Low exploitability (staff-only caller) but a real input-validation gap. Fix: validate `/^\d{10}$/` server-side in `startCaptainOrder` before calling `findOrCreateCustomer`, mirroring the client check.

**Architectural note:** This app remains single-tenant (`restaurants.slug = 'taksh'` only) per [[project-ordering-system-security]], so cross-restaurant IDOR concerns (e.g. `updateOrderItemQuantity` not checking the caller belongs to the item's restaurant) are theoretical, not live risks. Re-flag as real if multi-tenancy is ever introduced.

**How to apply:** When reviewing future captain/admin role-split features, check three things in order: (1) is the sub-permission check inside the server action, not just client props, (2) does `logActivity`/audit-insert happen after the mutation and stay best-effort, (3) does any new field returned by a `requireStaff()`-gated action (like `pin`) get rendered only inside staff-only components. This branch got all three right — use it as the template.

See [[project-ordering-system-security]] for the original 2026-06-21 findings and their fix status (most are now closed — RLS lockdown, auth guards on approve/reject/generateBill-adjacent actions, PIN brute-force lockout all landed in migrations `2026071801`–`2026071903`).
