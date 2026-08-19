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
- `getRevenueAnalytics({ restaurantId, date?, rangeDays? })` → `RevenueAnalytics` — the **settled-revenue** figures behind `/admin/analytics`. Counts only bills with `settled_at IS NOT NULL` (stamped by `settleBill`); bills that are merely generated are reported as `pendingAmount`/`pendingCount` and never as revenue. `date` is an IST `YYYY-MM-DD` (defaults to today IST), `rangeDays` clamps to 1–90. One bills query spanning `min(rangeStart, monthStart) → dayEnd` feeds the day tiles, the trend buckets and month-to-date; a second query fetches the day's non-rejected `order_items` for the dish mix. Bill labels resolve to `"Table 6"` / `"Parcel #7"` from the nested `table_sessions → restaurant_tables` embed. `requireAdmin()` — captains never see revenue.
- `getDailyBillsSummary(restaurantId)` — **unused legacy helper**; counts by `generated_at`, not settlement. Prefer `getRevenueAnalytics`.

**Order history (H01)** — backs `/admin/history` and `/captain/history`
- `getOrderHistory({ restaurantId, from?, to? })` → `OrderHistoryResult` — billed orders in an IST day range, newest first. `from`/`to` are `YYYY-MM-DD` day keys (default: today; reversed pairs are swapped, not rejected). Filters on **`generated_at`**, not `settled_at` — a bill enters history the moment it is printed, and a late bill settled after midnight stays on the service day it was served. Each entry carries `status: 'settled' | 'unsettled'` plus the totals; the result also rolls up `settledTotal/Count` and `unsettledTotal/Count`. Capped at 500 rows (`truncated: true` when the range held more). Guarded by `requireStaff()`, **not** `requireAdmin()` — the captain prints and settles these bills, so per-bill totals are already theirs; aggregate revenue analytics stay admin-only.
- `getOrderHistoryDetail(sessionId)` → `OrderHistoryRound[]` — non-rejected rounds of one billed session with items and per-round totals. Fetched on demand when a history row is opened, deliberately **not** joined into `getOrderHistory`, so a month-wide list stays one light query.
- `lib/order-history.ts` (plain module, **not** `"use server"`) holds the shared range maths + formatters both history screens import: `HISTORY_PRESETS`, `rangeForPreset`, `rangeLabel`, `todayIST`, `shiftDay`, `startOfMonth`, `endOfMonth`, `timeIST`, `dateTimeIST`, `inr`, `inrExact`, `PAYMENT_LABELS`. Presets anchor on the picked date, so `week` = 7 days ending on it and `month` = its calendar month capped at today.

**Ordering (T02–T05)**
- `createOrJoinSession({ restaurantId, tableId, pinAttempt? })` → `SessionResult` — creates a new table session with a 4-digit PIN, or joins an existing one by PIN. **Throws** on wrong PIN or missing table. Auto-closes stale sessions (opened before today's IST midnight via `todayMidnightIST()`) before creating a new one — prevents cross-day session bleed.
- `placeOrder({ sessionId, customerId, restaurantId, items })` → `{ orderId, roundNumber }` — inserts order as `pending_approval` with snapshotted item names/prices. Does **not** create a KOT print job.
- `approveOrder(orderId)` — transitions order to `approved` and creates a `kot` print job.
- `rejectOrder(orderId)` — transitions order to `rejected`.
- `generateBill({ sessionId })` — aggregates all non-rejected order rounds, computes GST (5%), inserts `bills` row, queues a `bill` print job, flips session to `bill_generated`. Takes an **object**, not a bare string. Called by both admin and guest (via "Request Bill" button).
- `getTableEntry(slug, tableNumber)` → `TableEntry | null` (T06) — resolves restaurant slug + table number into `{ restaurantId, tableId, tableNumber, slug, restaurantName }`. Used by `app/[slug]/table/[number]/page.tsx` only.
- `findOrCreateCustomer({ restaurantId, name, phone?, wantsWhatsapp? })` → `{ customerId }` (T08) — looks up an existing `customers` row by `(restaurant_id, phone)` and reuses it, or inserts a new one. `whatsapp_opted_in` column is set on insert. Uses `adminSupabase` (RLS bypassed). Called by `CheckoutForm` before `placeOrder`.

**Session Lifecycle Helpers**
- `todayMidnightIST()` → `Date` — returns `new Date(\`${istDateStr}T00:00:00+05:30\`)` for today in IST. Used to detect stale sessions.
- `joinTable({ restaurantId, tableId, deviceId, displayName })` — auto-closes sessions that are stale (opened before today's midnight IST) OR orphaned (`host_device_id IS NULL`) before joining/creating a new one. First joiner becomes host.
- `forceResetTable(sessionId)` — admin escape hatch: sets session `status: closed` AND deletes all `session_cart_items` for that session. Use when a table is stuck (e.g. orphaned session, test data).

**Admin Tables (all use `adminSupabase` — required for RLS bypass)**
- `getRestaurantId(slug)` → `string` — resolves restaurant slug to UUID.
- `getTablesWithSessions(restaurantId)` → `RawTableRow[]` — fetches all tables with nested session → orders → order_items + customers. **Critical PostgREST rule:** `customers(name)` must be nested inside `orders(...)`, not `table_sessions(...)`, because the FK is `orders.customer_id → customers.id`.
- `getDailyBillsSummary(restaurantId)` → `DailyBillsSummary` — today's bill totals by `generated_at`. Currently unused; `/admin/analytics` uses `getRevenueAnalytics` (settlement-based) instead.
- `getPendingOrders()` → `PendingOrder[]` — fetches `pending_approval` orders with items and table info. Used by `/admin/incoming`. Must use `adminSupabase` — anon client fails on nested joins due to RLS.
- `closeTable(sessionId)` — server action: sets session `status: closed` via `adminSupabase`. Never use the browser `supabase` client to update `table_sessions` — RLS blocks it even for authenticated users.

**Captain panel (C01)**
- `settleBill({ sessionId, paymentMethod })` — stamps `payment_method` (`'cash'|'upi'|'card'|'other'`) + `settled_at` on the latest bill, then closes the session. Throws if no bill exists.
- `getSessionBill(sessionId)` → `SessionBill | null` — latest bill for a session (used by the settle popup to show the GST-inclusive total).
- `moveTableSession({ sessionId, targetTableId })` — moves a live session to another table; rejects occupied targets and cross-restaurant moves.
- `reprintKot(orderId)` — re-queues a `kot` print job for an approved order; never changes order status.
- `updateOrderItemQuantity({ orderItemId, quantity, reason? })` — staff bill edit; quantity `0` deletes the item and **requires `reason`** (`RemovalReason` from `lib/activity.ts`). **Post-bill lockdown:** on a `bill_generated` session a captain may only increase; any decrease/removal throws unless the caller is admin (role read off the `requireStaff()` user). Throws once the session is `closed`. Every change is written to `activity_log` with qty before/after and the signed ₹ delta.
- `addItemsToSession({ sessionId, items, printKot? })` — staff adds items as a **new round already `approved`** (captain is the approver) and queues a KOT print job. `printKot: false` (admin-only, throws for captains) skips the cook ticket — used by the /admin/history bill correction where the food was already served. Falls back to `session.host_customer_id` when there is no prior round (captain-started sessions). Logs one `item_added` row per dish. Each item optionally carries a `note` (max 140 chars, e.g. "half portion", "extra spicy") — stored on `order_items.note` and printed under the item on the KOT via `reprintKot` too; guest-placed orders (`placeOrder`) never set it.
- `reprintBill({ sessionId })` — recomputes the bill from the session's current items, **updates the existing `bills` row in place** (never inserts a second row — daily reports stay accurate), and queues a fresh `bill` print job. Throws if no bill exists, the bill is settled, or the session is closed. Shares `computeBillForSession()` with `generateBill`.

**Captain walk-in orders (W01)**
- `startCaptainOrder({ restaurantId, tableId, customerName, customerPhone?, wantsWhatsapp? })` → `{ sessionId, pin, tableNumber }` — opens a free table for a guest who didn't scan. Real 4-digit PIN (guests can join mid-meal via the PIN shown in TableSheet), `host_device_id: 'captain:<uuid>'` (defuses joinTable's orphan auto-close), `host_customer_id` via `findOrCreateCustomer`. Pre-checks `active`+`bill_generated` occupancy (the unique index only covers `active`), catches `23505` on the insert race. First round is then punched with `addItemsToSession`.
- `cancelEmptySession(sessionId)` — abandon guard: closes the session **only if it has zero orders**; strict no-op otherwise. Called when the captain closes the walk-in dish picker without adding anything.

**Activity log (A01)**
- `logActivity(entry)` (private) — best-effort insert into `activity_log`; failures go to the server log and never abort the calling action. Always awaited (a floating promise can be dropped when a serverless invocation ends). Wired into: `approveOrder`, `rejectOrder`, `generateBill` (actor via `getOptionalUser()` — guests log as `'guest'`), `reprintBill`, `settleBill`, `moveTableSession`, `updateOrderItemQuantity`, `addItemsToSession`, `cancelParcelSession`, `forceResetTable`, `forceResetTableById` (which now also carries `requireStaff()` — it previously had **no guard**), `startCaptainOrder`. Discard paths (force reset, parcel cancel) log the ₹ they walked away from via `sessionDiscardedTotal()`.
- `getActivityLog({ restaurantId, from?, to? })` → `ActivityLogResult` — `requireAdmin()`. IST day-range semantics identical to `getOrderHistory`, capped at 500 rows (`truncated`), plus `removedCount`/`removedAmount` rollups for the page tiles.
- `lib/activity.ts` (plain module, **not** `"use server"`): `RemovalReason` + `REMOVAL_REASONS` labels, `ActivityAction` + `ACTIVITY_ACTION_LABELS`, `FLAGGED_ACTIONS` (removals/resets/cancels — rendered red on /admin/activity).

**Parcel / takeaway (P01)**

A parcel is a `table_sessions` row with **no table**: `session_type = 'parcel'`, `table_id NULL`, identified by `token_number` (resets daily, IST). Everything downstream — `orders`, `order_items`, `bills`, `print_jobs`, `/admin/reports` — is keyed on `session_id`, so parcels reuse the entire ordering pipeline unchanged.

- `createParcelSession({ restaurantId, customerName? })` → `{ sessionId, tokenNumber }` — allocates a token via the `next_parcel_token` RPC (atomic per-restaurant-per-IST-day counter), then inserts the session. `pin` is the non-numeric placeholder `'----'`: the column is NOT NULL but no guest device ever joins a parcel, and a non-numeric value can never match 4-digit PIN entry. Optional name is stored in `host_name`.
- `getParcelSessions(restaurantId)` → `RawParcelRow[]` — live parcels (`active` + `bill_generated`) with nested orders/items. **Cannot** come from `getTablesWithSessions` — that query starts at `restaurant_tables`, which a parcel has no row in.
- `cancelParcelSession(sessionId)` — discards an unpaid parcel. Refuses once a bill is settled.
- `getSessionPrintContext(sessionId)` (private) — resolves the KOT header for either session type; skips the `restaurant_tables` lookup when `table_id` is null. Used by `approveOrder`, `reprintKot`, and `addItemsToSession`, all three of which previously used `.single()` on the table and would throw for a parcel.
- `computeBillForSession` emits `orderType` + `tokenNumber`, and falls back to `session.host_name` for `customerName` (captain-punched parcel rounds carry no `customers` row).
- `moveTableSession` explicitly rejects parcels — there is no table to move.

**Print payload additions** (optional fields; jobs queued before this shipped still print identically):
- KOT: `orderType?: 'dine_in'|'parcel'`, `tokenNumber?`, `customerName?` → prints `P A R C E L` / `TOKEN #7` / `NAME: RAHUL` instead of `TABLE 6`
- Bill: `orderType?`, `tokenNumber?` → header reads `PARCEL #7` instead of `Table: 6`

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
