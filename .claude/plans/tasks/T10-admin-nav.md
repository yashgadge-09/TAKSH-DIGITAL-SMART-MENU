# T10 — Admin nav additions (D1)

**Day 3 · cross-cutting · depends on: nothing · unblocks: T11, T12, T13**

## Goal
Add navigation entry points for the new admin surfaces, under the existing auth, matching the gold/dark theme.

## Files
- `components/AdminSidebar.tsx` — edit the `navItems` array (line ~21). Currently: Dashboard / Menu / Categories / Today's Special / Analytics / Review Prompts / Preview Menu.

## Logic
Add 5 entries to `navItems`, each `{ href, label, icon }`. Import the icons from `lucide-react` alongside the existing imports (line ~5):

| Label | href | Suggested icon | Used by |
|---|---|---|---|
| Incoming Orders | `/admin/incoming` | `Inbox` | T11 |
| Tables | `/admin/tables` | `LayoutGrid` | T12 |
| Customers | `/admin/customers` | `Users` | T13 |
| Reports | `/admin/reports` | `FileBarChart` | T13 |
| Settings | `/admin/settings` | `Settings` | T13 |

**Suggested order** (operational items near the top): Dashboard → **Incoming Orders** → **Tables** → Menu → Categories → Today's Special → Analytics → **Customers** → **Reports** → Review Prompts → **Settings** → Preview Menu. Order is flexible — adjust to taste.

No other changes needed: the nav loop, active-state styling, collapsed mode, and the header label chip (`activeItem` on line ~44/117) all derive automatically from `navItems`.

## Auth & layout (important — read before T11–T13)
There are **two** layers, both already in place:
1. `app/admin/layout.tsx` — route-level guard; redirects to `/admin` when there's no Supabase session. Renders `{children}` only (no sidebar).
2. `AdminLayout` exported from `components/AdminSidebar.tsx` — renders the sidebar (`navItems`) **and** repeats the auth check.

The sidebar is NOT injected by the route layout — **each admin page wraps its own content in `<AdminLayout>`** (see `app/admin/dashboard/page.tsx`). So the new routes inherit auth automatically, but each placeholder/real page (T11–T13) must do:

```tsx
import { AdminLayout } from "@/components/AdminSidebar"
export default function Page() {
  return <AdminLayout>{/* page content */}</AdminLayout>
}
```

## Notes / limitations
- Active state is **exact match** (`pathname === item.href`). Landing pages highlight correctly; nested routes (e.g. `/admin/incoming/123`) will not. Out of scope for T10 — flag if T11 needs prefix matching.

## Test
- Sidebar shows the 5 new links (expanded + collapsed) with consistent gold/dark styling.
- Clicking each lands on its route and highlights the active item; the header chip shows the label. (Minimal `<AdminLayout>`-wrapped placeholder pages are fine until T11–T13.)
- Logged out → any new route redirects to `/admin`.

## Definition of Done
- [ ] 5 new links present in `navItems` with imported icons
- [ ] each lands on its route and shows active styling + header label
- [ ] auth-gated (logged-out → `/admin`)
- [ ] styling consistent with existing items (expanded & collapsed)

    