/mco# CLAUDE.md — `app/`

This file provides guidance to Claude Code (claude.ai/code) when working with code in this directory.

## App Router Structure

All routes use Next.js 16 App Router. The root `page.tsx` immediately redirects to `/menu`.

### Customer-Facing Routes

| Route | File | Notes |
|---|---|---|
| `/menu` | `app/menu/page.tsx` | Main catalog — `"use client"`, fetches all dishes |
| `/[slug]/table/[number]` | `app/[slug]/table/[number]/page.tsx` | T06 — QR table entry; resolves restaurant+table, wraps `<MenuPage />` in `<TableSessionProvider>` |
| `/category/[name]` | `app/category/[name]/page.tsx` | Dynamic category view |
| `/dish/[id]` | `app/dish/[id]/page.tsx` | Dish detail with recommendations |
| `/chefs-favourites` | `app/chefs-favourites/page.tsx` | `is_chef_special = true` dishes |
| `/most-loved` | `app/most-loved/page.tsx` | Ranked by favourites count |
| `/todays-special` | `app/todays-special/page.tsx` | `is_todays_special = true` dishes |
| `/preview` | `app/preview/page.tsx` | Admin preview of customer view |

### Admin Routes (`/admin/`)

**Two-layer auth model:**
1. `app/admin/layout.tsx` — route-level session guard: checks `supabase.auth.getSession()`, redirects unauthenticated users to `/admin` (the login page). Renders only `{children}` — no sidebar.
2. `AdminLayout` from `components/AdminSidebar.tsx` — renders the sidebar AND repeats the session check. Every admin page must wrap its content in `<AdminLayout>`. Admin login is email/password via `supabase.auth.signInWithPassword`.

After login the shared browser client (`lib/supabase.ts`) carries the `authenticated` JWT. RLS grants `update to authenticated using(true)` on `restaurants` — so Settings-save is a direct browser update. **However, `table_sessions` writes must go through `adminSupabase` server actions** (`closeTable`, `forceResetTable`) — the RLS policy does not reliably allow browser-client updates for table lifecycle operations.

All admin pages are `"use client"` components wrapped in `<AdminLayout>`. Gold/dark theme: dark header card (`bg-[linear-gradient(130deg,#2A180F…)]`), cream content cards (`bg-[linear-gradient(145deg,#FFF8EE…)]`).

| Route | File | Purpose |
|---|---|---|
| `/admin` | `app/admin/page.tsx` | Login page (email/password) |
| `/admin/dashboard` | `app/admin/dashboard/page.tsx` | Overview — QR scans, trending |
| `/admin/incoming` | `app/admin/incoming/page.tsx` | Live pending-orders queue (T11); Approve → KOT, Reject → no KOT; Realtime. Data via `getPendingOrders()` server action (adminSupabase — anon client can't do nested joins here) |
| `/admin/tables` | `app/admin/tables/page.tsx` | Live table grid (T12); status badges, host name, round count, running total, bill-requested tag. Drawer: per-round itemised breakdown, Generate Bill, Mark Paid & Free Table (`closeTable` server action), Force Reset (`forceResetTable` server action). Browser `supabase` used only for Realtime subscription — all data via `getTablesWithSessions` + `getDailyBillsSummary` server actions |
| `/admin/menu` | `app/admin/menu/page.tsx` | Dish CRUD — add/edit/delete/toggle availability |
| `/admin/categories` | `app/admin/categories/page.tsx` | Category ordering and images |
| `/admin/analytics` | `app/admin/analytics/page.tsx` | Engagement charts (menu views, cart, favourites, reviews) |
| `/admin/reviews` | `app/admin/reviews/page.tsx` | Review moderation — toggle `is_public` |
| `/admin/todays-special` | `app/admin/todays-special/page.tsx` | Toggle `is_todays_special` per dish |
| `/admin/customers` | `app/admin/customers/page.tsx` | Customer directory (T13) — name/phone/WhatsApp opted-in, most-recent first |
| `/admin/reports` | `app/admin/reports/page.tsx` | Daily billing report (T13) — date picker (IST), totals/count/avg, per-bill list |
| `/admin/settings` | `app/admin/settings/page.tsx` | Restaurant details (T13) — editable name/address/GSTIN/UPI; table list + disabled QR-download stub (T15) |
| `/admin/preview` | `app/admin/preview/page.tsx` | Admin preview of guest-facing menu |

### API Routes (`/api/`)

All API routes are Next.js Route Handlers (`route.ts`).

| Route | Method | Purpose |
|---|---|---|
| `/api/push/send` | POST | Send OneSignal push notification |
| `/api/save-token` | POST | Store OneSignal `player_id` to `push_sessions` |
| `/api/send-review-notifications` | POST | Queue review notifications after a session |
| `/api/review-click` | POST/GET | Track notification → review click |
| `/api/cron/notify` | GET | Process `notification_queue` — sends pending notifications |
| `/api/upload` | POST | Image upload: HEIC → JPEG conversion + S3/Cloudinary storage |
| `/api/admin-analytics` | GET | Aggregate analytics for admin dashboard |
| `/api/google-stats` | GET | Google Business / GMB stats aggregation |
| `/api/proxy-image` | GET | Proxy external images to avoid CORS |

### Server vs Client Components

- **Default is Server Component** in App Router. Async data fetching happens at the page level via `lib/database.ts` functions.
- Pages that need interactivity (cart, search, language switcher) delegate to `"use client"` child components.
- `lib/database.ts` is `"use server"` — its exports are Server Actions safe for import in Server Components and client-triggered Server Actions.
- Never import `adminSupabase` (service role client) in any client component or route that could be reached client-side without authentication.

### Metadata & SEO

Dish detail pages export `generateMetadata()` using dish name/description for per-page Open Graph tags. Images are served via Next.js `<Image>` with remote patterns: `images.unsplash.com`, `res.cloudinary.com`, and `NEXT_PUBLIC_IMAGE_CDN_HOST`.

### Globals

`app/globals.css` — Tailwind CSS 4 base styles + custom CSS variables for the restaurant's dark gold/cream color theme using OKLCH color space (e.g., `oklch(0.18 0.025 50)` for dark background, `oklch(0.82 0.13 82)` for gold accents).

`app/layout.tsx` — Root layout wraps all routes with:
1. `SplashScreen` (branding loader on first visit)
2. `LanguageProvider` (i18n context)
3. `CartProvider` (cart state)
4. `Toaster` (Sonner toast notifications)
5. Vercel `Analytics`

Fonts: `Inter` (body, `--font-inter`) and `Playfair_Display` (headings, `--font-playfair`) from Google Fonts.
