# CLAUDE.md — `lib/`

This file provides guidance to Claude Code (claude.ai/code) when working with code in this directory.

## Files

| File | Purpose |
|---|---|
| `supabase.ts` | Browser Supabase client (anon key) |
| `supabase-admin.ts` | (if present) Server-side admin client alias |
| `database.ts` | All DB operations — `"use server"` |
| `session.ts` | Session ID utilities |
| `menu-data.ts` | Static fallback/constant menu data |
| `cropImage.ts` | Client-side canvas crop helper for `react-easy-crop` |
| `utils.ts` | `cn()` utility (clsx + tailwind-merge) |

---

## `database.ts` — The Core Data Layer

Marked `"use server"` at the top — all exports are Next.js Server Actions or server-only functions.

### Two Supabase clients

```ts
// Public anon client — respects RLS, safe for read queries
const supabase = createBrowserClient(url, anonKey)

// Service role client — bypasses RLS, used for all writes + admin reads
const adminSupabase = createClient(url, serviceRoleKey)
```

**Rule:** Use `supabase` (anon) for reads that guests trigger. Use `adminSupabase` for all inserts, updates, deletes, and admin panel queries. Never expose `adminSupabase` to client components.

---

### Analytics Traffic Gating

`shouldTrackProductionTrafficOnly()` reads request headers (`origin`, `referer`, `x-forwarded-host`, `host`) and returns `true` only when the hostname matches `ANALYTICS_ALLOWED_HOSTS` or Vercel URL env vars, AND is not localhost.

Functions that call this before inserting:
- `trackMenuView()` — inserts to `menu_views`
- `trackDishView()` — inserts to `dish_views`

`trackCartEvent()` does **NOT** gate — always writes to `cart_events`.

---

### Caching

Uses Next.js `unstable_cache` with `revalidate: 300` (5 min) and named cache tags:

```ts
getAllDishesCached    → tag: 'dishes'
getDishByIdCached    → tag: 'dishes'
getRecommendationsCached → tag: 'recommendations'
```

`revalidateTag('dishes')` is called after any dish mutation (add/update/delete/toggle).

**Cache-bust pattern:** Callers can pass a `timestamp` parameter to skip the Next.js cache and hit Supabase directly:
```ts
// Forces a live fetch by adding a dummy filter that never matches
query.neq('name_en', `CACHE_BUST_${timestamp}`)
```

---

### Key Function Groups

**Dishes (public)**
- `getAllDishes(timestamp?)` — all available dishes, ordered by `created_at`
- `getDishById(id, timestamp?)` — single dish
- `getMoreLikeThisDishes(id, category)` — same-category dishes ranked by flags
- `getDishRecommendations(id, category)` — calls `get_recommendations` RPC, falls back gracefully

**Dishes (admin)**
- `getAllDishesAdmin(timestamp?)` — includes unavailable dishes
- `addDish(dish)`, `updateDish(id, dish)`, `deleteDish(id)`, `toggleAvailability(id, bool)`

**Categories**
- `getCategories()` — ordered by `order_index`
- `addCategory(name)`, `deleteCategory(id)`, `updateCategory(id, payload)`

**Reviews**
- `getPublicReviews()` — `is_public = true` only
- `getAllReviewsAdmin()` — all reviews
- `submitReview({ stars, text, reviewer, dishes })` — auto-publishes if `stars >= 4`
- `toggleReviewVisibility(id, bool)`

**Favourites**
- `trackFavourite(dishId, dishName, sessionId, isActive)` — upserts on `(dish_id, session_id)`
- `getMostLovedDishIds(days, limit)` — ranks by favourite count in time window
- `trackLikedDishesFromOrder(dishes, sessionId)` — batch favourite after order review

**Dish Ratings**
- `submitDishRatingsFromOrder(ratings, sessionId)` — batch insert 1–5 star ratings
- `getMostLovedDishRatings(limit)` — aggregate average ratings

**Analytics**
- `getAnalyticsData(days)` — aggregates `menu_views`, `dish_views`, `cart_events`, `favourites`, `reviews` into dashboard-ready shape

**Ordering (T02–T05)**
- `createOrJoinSession({ restaurantId, tableId, pinAttempt? })` → `SessionResult` — creates a new table session with a 4-digit PIN, or joins an existing one by PIN. **Throws** on wrong PIN or missing table (never returns an error variant — callers must `try/catch`).
- `placeOrder({ sessionId, customerId, restaurantId, items })` → `{ orderId, roundNumber }` — inserts order as `pending_approval` with snapshotted item names/prices. Does **not** create a KOT print job.
- `approveOrder(orderId)` — transitions order to `approved` and creates a `kot` print job.
- `rejectOrder(orderId)` — transitions order to `rejected`.
- `generateBill(sessionId)` — aggregates all approved order rounds, computes GST, inserts `bills` row, queues a `bill` print job, flips session to `bill_generated`.
- `getTableEntry(slug, tableNumber)` → `TableEntry | null` (T06) — resolves restaurant slug + table number into `{ restaurantId, tableId, tableNumber, slug, restaurantName }`. Used by `app/[slug]/table/[number]/page.tsx` only.

---

### Supabase RPC Functions (PostgreSQL)

Two DB-level functions called from `database.ts`:
- `get_recommendations(current_dish_id, current_category, limit_per_category)` — cross-category dish recommendations using `category_complements`
- `get_fallback_dishes(current_dish_id, current_category, item_limit)` — simpler fallback when recommendations return empty

---

### `normalizeImageUrl(imageUrl)`

Handles legacy `image_url` values stored as JSON arrays (e.g., `'["https://..."]'`). Always use this when reading `image_url` from the DB before rendering.

---

## `session.ts`

Generates and persists a random `session_id` (UUID) to `localStorage`. Used as the anonymous user identifier across `favourites`, `dish_ratings`, `push_sessions`.

## `cropImage.ts`

Client-side canvas-based crop utility. Takes a `src` image URL and a `PixelCrop` object, returns a `Blob`. Used by `ImageCropperModal` before uploading to `/api/upload`.

## `utils.ts`

```ts
import { cn } from '@/lib/utils'
// cn(...) merges Tailwind class strings with clsx + tailwind-merge
```
