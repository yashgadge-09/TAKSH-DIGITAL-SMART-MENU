# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**TAKSH Digital Smart Menu** — a Next.js 16 (App Router, React 19, TypeScript) digital menu system for a pure-veg restaurant. It serves two audiences:
- **Guests:** Browse/search dishes by category, view dish details, manage a floating cart, rate dishes, and submit reviews.
- **Admin:** Manage menu items, categories, analytics, today's specials, and customer reviews.

Deployed on **Vercel**. Database on **Supabase (PostgreSQL)**. Push notifications via **OneSignal** (primary) and **Firebase FCM** (legacy). Images via **Cloudinary / res.tastefy.food CDN**.

---

## Commands

```bash
npm run dev       # Start dev server (localhost:3000)
npm run build     # Production build
npm run start     # Start production server
npm run lint      # ESLint
```

> `typescript.ignoreBuildErrors: true` is set in `next.config.mjs` — TypeScript errors won't block builds.

---

## Environment Variables

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key (browser) |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (server-only writes) |
| `NEXT_PUBLIC_SUPABASE_SERVICE_ROLE` | Fallback service role key |
| `NEXT_PUBLIC_IMAGE_CDN_HOST` | CDN host (default: `res.tastefy.food`) |
| `ANALYTICS_ALLOWED_HOSTS` | Comma-separated hosts for analytics gating |
| `NEXT_PUBLIC_SITE_URL` / `NEXT_PUBLIC_APP_URL` | Production URL for analytics gating |
| `VERCEL_PROJECT_PRODUCTION_URL` / `VERCEL_URL` | Auto-set by Vercel |
| `ONESIGNAL_APP_ID` / `ONESIGNAL_REST_API_KEY` | Push notifications |
| Firebase config vars | FCM legacy push notifications |

---

## Architecture

### Routing (`app/`)

```
/               → redirects to /menu
/menu           → main dish catalog
/category/[name]→ dishes by category
/dish/[id]      → dish detail page
/chefs-favourites, /most-loved, /todays-special → curated views
/preview        → customer-side preview
/admin/dashboard        → admin home
/admin/menu             → dish CRUD
/admin/categories       → category management
/admin/analytics        → engagement metrics
/admin/reviews          → review moderation
/admin/todays-special   → toggle daily specials
```

API routes under `/api/`:
- `cron/notify` — scheduled review notification trigger
- `push/send` — send push notifications
- `save-token` — store OneSignal player_id
- `send-review-notifications` — queue review asks
- `review-click` — track notification → review funnel
- `upload` — image upload with HEIC conversion + S3
- `admin-analytics`, `google-stats` — analytics aggregation
- `proxy-image` — image proxy

### Two Supabase Clients

**Critical pattern in `lib/database.ts` and `lib/supabase.ts`:**

```ts
// lib/supabase.ts — browser client (anon key, RLS enforced)
export const supabase = createBrowserClient(url, anonKey)

// lib/database.ts — server client (service role, bypasses RLS)
const adminSupabase = createClient(url, serviceRoleKey)
```

- **`supabase`** (anon) → read-only public data (dishes, categories, reviews, favourites query)
- **`adminSupabase`** (service role) → all writes, analytics inserts, admin reads

### Analytics Traffic Gating

`shouldTrackProductionTrafficOnly()` in `lib/database.ts` checks request headers against `ANALYTICS_ALLOWED_HOSTS` + Vercel URL env vars. Analytics events (`menu_views`, `dish_views`, `cart_events`) are **silently skipped on localhost and preview deployments** — only production traffic is tracked. `trackCartEvent` does NOT gate (always writes).

### Caching Strategy

`unstable_cache` from Next.js with `revalidate: 300` (5 min) and tags:
- `getAllDishesCached` → tag `dishes`
- `getDishByIdCached` → tag `dishes`
- `getRecommendationsCached` → tag `recommendations`

Cache busting: pass a `timestamp` param to force a fresh Supabase query bypassing the Next.js cache (uses a dummy `.neq('name_en', 'CACHE_BUST_...')` filter).

### i18n

Three languages: **English (`en`)**, **Hindi (`hi`)**, **Marathi (`mr`)**, stored in `LanguageContext` and persisted to `localStorage` as `taksh_lang`.

Dish content is multilingual at the DB level: `name_en/hi/mr`, `description_en/hi/mr`, `ingredients_en/hi/mr`, `taste_en/hi/mr`.

### Cart

Client-side only (`CartContext`). State lives in React memory — not persisted. Adding to cart fires `trackCartEvent` (analytics) and a two-tone audio chime (Web Audio API).

### Push Notifications Flow

1. Guest visits → OneSignal SDK registers → `player_id` saved to `push_sessions` via `/api/save-token`
2. After session, `/api/send-review-notifications` queues a notification in `notification_queue`
3. Cron (`/api/cron/notify`) processes the queue and fires OneSignal push
4. Guest clicks notification → tracked in `push_sessions.review_clicked` via `/api/review-click`

---

## Database Tables (Supabase, all RLS enabled)

**Menu data:**
- `dishes` (440 rows) — core menu items; flags: `is_chef_special`, `is_guest_favorite`, `is_trending`, `is_todays_special`, `is_available`
- `categories` (24 rows) — ordered by `order_index`
- `category_complements` — cross-category "complete your meal" suggestions

**Engagement / Analytics:**
- `menu_views` — QR scan / page loads
- `dish_views` — dish detail page views
- `cart_events` — add-to-cart actions
- `favourites` — per-session dish likes (`session_id` + `dish_id` unique)
- `dish_ratings` — 1–5 star ratings per session per dish

**Reviews:**
- `reviews` — customer reviews; auto-published (`is_public = true`) if `stars >= 4`

**Push / Notifications:**
- `push_sessions` — OneSignal player_id + notification sent/clicked tracking
- `push_subscriptions` — raw Web Push subscription payloads
- `notification_queue` — pending/sent notification jobs
- `review_analytics` — notification → review funnel tracking

**Restaurant ops (in-progress schema):**
- `restaurants`, `restaurant_tables`, `table_sessions`, `customers`, `orders`, `order_items`, `bills`, `print_jobs`

---

## Key Conventions

- **Server Actions / DB functions** live in `lib/database.ts` (`"use server"` at top). Never import `adminSupabase` from client components.
- **shadcn/ui** components live in `components/ui/`. Run `npx shadcn@latest add <component>` to add new primitives.
- **Image upload** flow: client crops with `react-easy-crop` → `ImageCropperModal` → `/api/upload` → Cloudinary/S3 → URL stored in DB.
- **Recommendations** use a Supabase RPC `get_recommendations` (PostgreSQL function); fallback via `get_fallback_dishes` RPC.
- `normalizeImageUrl()` in `database.ts` handles legacy image URLs stored as JSON arrays.
- The `favourites` table has a unique constraint on `(dish_id, session_id)` — use upsert, not insert.

See `app/CLAUDE.md`, `lib/CLAUDE.md`, `components/CLAUDE.md`, `context/CLAUDE.md`, `supabase/CLAUDE.md` for folder-level detail.
