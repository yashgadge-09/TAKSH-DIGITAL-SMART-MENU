# T10 — Admin nav additions (D1)

**Day 3 · cross-cutting · depends on: nothing · unblocks: T11, T12, T13**

## Goal
Add navigation entry points for the new admin surfaces, under the existing auth, matching the gold/dark theme.

## Files
- `components/AdminSidebar.tsx` — edit `navItems` (currently Dashboard/Menu/Categories/Today's Special/Analytics/Review Prompts/Preview).

## Logic
Add links:
- **Incoming Orders** → `/admin/incoming` (T11)
- **Tables** → `/admin/tables` (T12)
- **Customers** → `/admin/customers` (T13)
- **Reports** → `/admin/reports` (T13)
- **Settings** → `/admin/settings` (T13)

All routes inherit `app/admin/layout.tsx` auth (redirects to `/admin` if unauthenticated). Use existing lucide icon pattern + active-state styling.

## Test
- Sidebar shows the 5 new links; clicking each lands on its route (placeholder pages ok until T11–T13).
- Logged out → redirected to `/admin`.

## Definition of Done
- [ ] 5 new links present
- [ ] auth-gated via existing layout
- [ ] styling consistent with existing items
