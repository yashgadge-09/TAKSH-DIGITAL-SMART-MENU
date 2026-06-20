# CLAUDE.md — `app/`

This file provides guidance to Claude Code (claude.ai/code) when working with code in this directory.

## App Router Structure

All routes use Next.js 16 App Router. The root `page.tsx` immediately redirects to `/menu`.

### Customer-Facing Routes

| Route | File | Notes |
|---|---|---|
| `/menu` | `app/menu/page.tsx` | Main catalog — server component, fetches all dishes |
| `/category/[name]` | `app/category/[name]/page.tsx` | Dynamic category view |
| `/dish/[id]` | `app/dish/[id]/page.tsx` | Dish detail with recommendations |
| `/chefs-favourites` | `app/chefs-favourites/page.tsx` | `is_chef_special = true` dishes |
| `/most-loved` | `app/most-loved/page.tsx` | Ranked by favourites count |
| `/todays-special` | `app/todays-special/page.tsx` | `is_todays_special = true` dishes |
| `/preview` | `app/preview/page.tsx` | Admin preview of customer view |

### Admin Routes (`/admin/`)

All admin routes share `app/admin/layout.tsx` which wraps with `AdminSidebar`.

| Route | Purpose |
|---|---|
| `/admin/dashboard` | Overview with key stats |
| `/admin/menu` | CRUD for dishes — add/edit/delete/toggle availability |
| `/admin/categories` | Category ordering and images |
| `/admin/analytics` | Engagement charts (menu views, cart, favourites, reviews) |
| `/admin/reviews` | Review moderation — toggle `is_public` |
| `/admin/todays-special` | Toggle `is_todays_special` per dish |
| `/admin/preview` | Admin can preview guest-facing menu |

Admin has **no authentication** in the current codebase — the `/admin` routes are security-by-obscurity only.

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
