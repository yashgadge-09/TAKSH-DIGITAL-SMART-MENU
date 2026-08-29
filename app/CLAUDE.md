/mco# CLAUDE.md — `app/`

This file provides guidance to Claude Code (claude.ai/code) when working with code in this directory.

## App Router Structure

All routes use Next.js 16 App Router. The root `page.tsx` immediately redirects to `/menu`.

### Customer-Facing Routes

| Route | File | Notes |
|---|---|---|
| `/menu` | `app/menu/page.tsx` + `app/menu/menu-client.tsx` | Main catalog. `page.tsx` is an **async Server Component** — awaits `getMenuInitialData()` (`lib/database.ts`, `unstable_cache`-backed, narrowed columns) and reads the `searchParams` prop, passing both down as props to `MenuPage`/`MenuPageContent` in `menu-client.tsx` (`"use client"`). Dishes render in the initial server HTML — no client-side fetch on first paint. `MenuPageContent` deliberately does **not** call `useSearchParams()` (that hook forces Next to defer the whole subtree to client rendering during SSR); initial `category`/`search`/`cart` state comes from the server props instead, with `usePathname()` + `router.replace` used to keep the URL in sync afterwards. Heavy modals (`CartDrawer`, `OrderFlow`, `ReviewModal`, `NotificationPrompt`) are `next/dynamic({ ssr: false })` and lazy-mounted on first interaction |
| `/[slug]/table/[number]` | `app/[slug]/table/[number]/page.tsx` | T06 — QR table entry; async Server Component. Resolves restaurant+table via cached `getTableEntryCached` and fetches `getMenuInitialData()` in parallel, then wraps `<MenuPage initialDishes initialCategories initialCategory initialSearch initialCartOpen />` in `<TableSessionProvider>` — same SSR treatment as `/menu` |
| `/dish/[id]` | `app/dish/[id]/page.tsx` | Dish detail with recommendations. `"use client"` — no `generateMetadata()`. Fetches `getDishById` first and paints immediately, then `Promise.allSettled`s the two recommendation queries in parallel (previously three sequential awaits) |
| `/todays-special` | `app/todays-special/page.tsx` | `is_todays_special = true` dishes. Same cached-fetch pattern |
| `/preview` | `app/preview/page.tsx` | Admin preview of customer view |

`/category/[name]` was removed (2026) — it was dead code (nothing linked to it; the menu's category chips filter client-side over already-loaded dishes).

`/chefs-favourites` and `/most-loved` were removed (2026) — their homepage carousel sections were dropped from `app/menu/menu-client.tsx` to give the dish grid more space, leaving both curated pages unreachable. `getMostOrderedDishesCached` (`lib/database.ts`) is now unused by the guest menu but left in place — it may still be useful for an admin-side "most ordered" view.

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
| `/admin/analytics` | `app/admin/analytics/page.tsx` | Revenue + engagement dashboard. Settled-revenue tiles (day / month-to-date), revenue trend bar chart (7/30/90d), payment mix, top earning dishes, settled-bills table — all from `getRevenueAnalytics` (adminSupabase). A bill is revenue **only** once `bills.settled_at` is stamped by `settleBill`; generated-but-unpaid bills show as "Awaiting settlement" and are excluded. Realtime subscription on `bills` refetches on every insert/settle (toast on settle). Engagement charts below come from `getAnalyticsData` |
| `/admin/history` | `app/admin/history/page.tsx` | Order history (H01) — Day/Week/Month/Custom IST range over every billed order (dine-in + parcel). Summary tiles (billed count, settled, awaiting payment), sortable-by-time table, click a row to expand its KOT rounds + items + subtotal/GST/total. Data via `getOrderHistory`; row detail lazy-loads through `getOrderHistoryDetail` |
| `/admin/reviews` | `app/admin/reviews/page.tsx` | Review moderation — toggle `is_public` |
| `/admin/todays-special` | `app/admin/todays-special/page.tsx` | Toggle `is_todays_special` per dish |
| `/admin/customers` | `app/admin/customers/page.tsx` | Customer directory (T13) — name/phone/WhatsApp opted-in, most-recent first |
| `/admin/reports` | `app/admin/reports/page.tsx` | Redirects to `/admin/analytics` — the daily billing report is a section there |
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

`/dish/[id]` is a client component and does **not** export `generateMetadata()`. Guest-facing images (menu grid, dish page) are plain `<img>` tags run through `thumbUrl()` (`lib/media.ts`) for Cloudinary-style resizing — not `next/image`. Admin pages (`admin/menu`, `admin/categories`) do use Next's `<Image>`, with remote patterns: `images.unsplash.com`, `res.cloudinary.com`, and `NEXT_PUBLIC_IMAGE_CDN_HOST`.

### Loading states

Every route group has a `loading.tsx` (`app/loading.tsx`, `app/menu/loading.tsx`, `app/[slug]/table/[number]/loading.tsx`, `app/dish/[id]/loading.tsx`, `app/admin/loading.tsx`, `app/captain/loading.tsx`) plus a root `app/error.tsx`. Shared loader primitives live in `components/BrandLoader.tsx`: `BrandSpinner`, `FullScreenLoader`, and `PendingOverlay` (an absolute translucent layer that dims stale content in place while a filter/range change is in flight — used on `/admin/analytics` and available for any other "don't show old data as current" case). `components/MenuSkeleton.tsx` backs the two menu `loading.tsx` files.

### Globals

`app/globals.css` — Tailwind CSS 4 base styles + custom CSS variables for the restaurant's dark gold/cream color theme using OKLCH color space (e.g., `oklch(0.18 0.025 50)` for dark background, `oklch(0.82 0.13 82)` for gold accents).

`app/layout.tsx` — Root layout wraps all routes with:
1. `SplashScreen` (branding loader on first visit)
2. `LanguageProvider` (i18n context)
3. `CartProvider` (cart state)
4. `Toaster` (Sonner toast notifications)
5. Vercel `Analytics`

Fonts: `Inter` (body, `--font-inter`) and `Playfair_Display` (headings, `--font-playfair`) from Google Fonts.
