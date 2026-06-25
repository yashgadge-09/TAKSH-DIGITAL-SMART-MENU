# CLAUDE.md — `supabase/`

This file provides guidance to Claude Code (claude.ai/code) when working with code in this directory.

## Project

Supabase project ref: `otrswbefptqfqscbncen`

## Migrations

All schema changes are tracked in `supabase/migrations/` as timestamped SQL files.

```
2026042401_dish_ratings.sql                    — dish_ratings table creation
2026042402_dish_ratings_permissions.sql        — RLS policies for dish_ratings
2026042403_dish_ratings_allow_multiple_ratings.sql — allow >1 rating per dish/session
2026042404_notification_queue.sql              — notification_queue table
2026042405_push_subscriptions.sql              — push_subscriptions table
2026042501_add_todays_special.sql              — is_todays_special column on dishes
2026062101_ordering_system.sql                 — ordering system: restaurants/tables/sessions/customers/orders/order_items/bills/print_jobs; fixes orders.status default → 'pending_approval' + adds status check constraint
2026062501_shared_cart.sql                     — shared cart: host_device_id/host_name on table_sessions; session_cart_items table with RLS + realtime
```

To create a new migration:
```bash
supabase migration new <descriptive_name>
```

To apply locally:
```bash
supabase db push
```

---

## Schema Overview (all tables in `public` schema, all RLS enabled)

### Menu Tables

**`dishes`** — 440 rows  
Core menu items. Key columns:
- Multilingual content: `name_en/hi/mr`, `description_en/hi/mr`, `ingredients_en/hi/mr` (text[]), `taste_en/hi/mr`
- `price` (integer, INR), `category` (text, FK-free, matches `categories.name`)
- `spice_level` (0–3), `servings`, `kcal`, `protein`, `fat`, `carbs`, `fibre`
- Flags: `is_chef_special`, `is_guest_favorite`, `is_trending`, `is_todays_special`, `is_available`
- `image_url` — may be stored as JSON array string (legacy); always use `normalizeImageUrl()` to read

**`categories`** — 24 rows  
- `name` (unique), `order_index` (display order), `image_url`
- Referenced by `category_complements` (not a FK to `dishes.category`)

**`category_complements`** — 25 rows  
Maps category → related_category for "Complete Your Meal" recommendations. Both columns FK to `categories.name`.

---

### Analytics Tables

**`menu_views`** — 2049 rows  
Insert-only. `page` (text) + `created_at`. Gated to production traffic.

**`dish_views`** — 875 rows  
`dish_id`, `dish_name`, `category`, `created_at`. Gated to production.

**`cart_events`** — 433 rows  
`dish_id`, `dish_name`, `category`, `price`, `created_at`. Always written (no gating).

**`favourites`** — 28 rows  
`session_id` + `dish_id` unique pair. `is_active` (bool) tracks toggle state. Use upsert on `(dish_id, session_id)`.

**`dish_ratings`** — 13 rows  
Per-dish per-session 1–5 star ratings. `rating` has check constraint `>= 1 AND <= 5`.

---

### Reviews

**`reviews`** — 8 rows  
`stars`, `text`, `reviewer`, `dishes` (text[]), `is_public`, `source`. Auto-published when `stars >= 4`.

---

### Push / Notifications

**`push_sessions`** — 26 rows  
Tracks OneSignal `player_id` per visit. Columns:
- `player_id` — OneSignal subscription ID
- `notification_sent` / `notification_sent_at` — first notification tracking
- `second_notification_sent` / `second_notification_sent_at` — follow-up
- `review_clicked` / `review_clicked_at` — click tracking

**`push_subscriptions`** — 3 rows  
Raw Web Push `subscription` JSONB payloads (legacy FCM path).

**`notification_queue`** — 12 rows  
Pending/sent notification jobs. `status`: `'pending'` → `'sent'`. Contains `dishes` (JSONB), `send_at`, `review_url`.

**`review_analytics`** — 0 rows  
Notification → review funnel by table number and date.

---

### Restaurant Ops (ordering system — live)

All tables are seeded and actively used by the ordering flow (T01–T14).

- **`restaurants`** (1 row) — slug `taksh`, id `c7b441fe-…`; columns: `name`, `address`, `gstin`, `upi_id`
- **`restaurant_tables`** (16 rows) — tables 1–16 seeded for `taksh`; FK to `restaurants`
- **`table_sessions`** — active dining sessions with 4-digit PIN; status: `active` / `bill_generated` / `closed`; `host_device_id` + `host_name` columns for shared-cart host tracking (added by `2026062501_shared_cart.sql`)
- **`customers`** — name + optional phone; reused by `(restaurant_id, phone)`; `whatsapp_opted_in` bool
- **`orders`** — round-based ordering per session; status: `pending_approval` / `approved` / `rejected` / `served`; default `pending_approval`
- **`order_items`** — snapshotted dish `name` + `price` at order time; FK to `orders`
- **`bills`** — `subtotal`, `gst_amount`, `total` per session; created by `generateBill()`
- **`print_jobs`** — KOT/bill print queue; type: `kot` / `bill`; status: `pending` / `sent` / `failed`; KOT rows created **only** by `approveOrder()`, never by `placeOrder()`
- **`session_cart_items`** — shared DB-backed cart; one row per (session, dish, device); `added_by_device_id` + `added_by_name` for attribution; `on delete cascade` from `table_sessions`; in `supabase_realtime` publication; SELECT open to anon (for Realtime delivery); all writes via service role

---

## RLS Notes

- All tables have RLS enabled.
- The anon client can read `dishes`, `categories`, `reviews` (public ones), `favourites`.
- All inserts/writes use the service role client (`adminSupabase`) which bypasses RLS.
- When adding new tables, always enable RLS and create appropriate policies. See root `CLAUDE.md` security checklist.

## PostgreSQL Functions (RPCs)

- `get_recommendations(current_dish_id, current_category, limit_per_category)` — cross-category dish suggestions via `category_complements`
- `get_fallback_dishes(current_dish_id, current_category, item_limit)` — simpler fallback suggestions
