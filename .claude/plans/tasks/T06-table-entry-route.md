# T06 — Table entry route `/[slug]/table/[number]` (Phase 1)

**Day 2 · Phase 1 · depends on: T01, T02 · unblocks: T07, T08**

## Goal
Close the missing Phase-1 gap: a QR-scannable per-table URL that **resolves `slug` + `number` into the `restaurantId` / `tableId` that T02 `createOrJoinSession` already requires** (it takes ids, not slug/number — this route is the only place that conversion happens), and exposes those ids to the existing menu/cart/order flow.

## ✅ Ground truth verified against the repo (2026-06-22)
- `app/menu/page.tsx` is `"use client"`. `MenuPageContent` is a **local, un-exported** function; the only export is the default `MenuPage` (wraps `MenuPageContent` + `NotificationPrompt` in its own `<Suspense>`). → Reuse by **rendering `<MenuPage />`**, not by reaching for `MenuPageContent`.
- Root `app/layout.tsx` already wraps **all** routes with `LanguageProvider` → `CartProvider`. The table route inherits both. → T06 only needs to add **`TableSessionProvider`** around the menu; do **not** re-add Cart/Language.
- `createOrJoinSession({ restaurantId, tableId, pinAttempt? })` (`lib/database.ts:1160`) expects ids and throws `'Table not found'` only by `tableId`. **Nothing in the repo currently resolves `slug`/`table_number` → ids.** T06 must add that resolver.
- Schema (T01, live): `restaurants(slug unique)`, `restaurant_tables(restaurant_id, table_number, UNIQUE(restaurant_id, table_number))`. 16 tables (1–16) seeded for slug `taksh`. Reads on both tables are public-SELECT under RLS, but keep DB access in `lib/database.ts` per project convention.

## Files
- `lib/database.ts` — **add** `getTableEntry(slug, tableNumber)` (`"use server"`, uses `adminSupabase` like the rest of the file). Resolves restaurant by `slug`, then table by `(restaurant_id, table_number)`. Returns a **plain serializable** object `{ restaurantId, tableId, tableNumber, slug, restaurantName }` or `null` when either lookup misses.
- `context/TableSessionContext.tsx` — **new** `"use client"` provider + `useTableSession()` hook holding `{ restaurantId, tableId, tableNumber, slug }`. Mirror the shape/exports of `context/LanguageContext.tsx`. `useTableSession()` returns the value or `null` (so `/menu` without a table still works; T07 branches on presence).
- `app/[slug]/table/[number]/page.tsx` — **new** async **server** component: `await params`, parse/validate `number`, call `getTableEntry`, then render `<TableSessionProvider value={...}><MenuPage /></TableSessionProvider>` (a server component can render a client provider and pass a serializable `value` prop — no extra client wrapper needed).

## Logic
1. `const { slug, number } = await params` (Next 16 — `params` is a Promise).
2. Parse `number`: `Number.parseInt(number, 10)`; if `NaN` (or `< 1`) → render the "Table not found" screen (don't query).
3. `const entry = await getTableEntry(slug, tableNumber)`; `null` → "Table not found" screen.
4. On success → wrap `<MenuPage />` in `<TableSessionProvider value={{ restaurantId, tableId, tableNumber, slug }}>`.
5. "Table not found" screen: match the existing dark + gold theme (CSS vars in `app/globals.css`), friendly copy, no crash.

## Routing note (verify, don't assume)
Only the **3-segment** path `/{slug}/table/{number}` matches this file. Static siblings (`/menu`, `/admin`, `/dish`, `/category`, `/preview`, `/chefs-favourites`, …) take priority over the dynamic `[slug]` segment, and no bare `app/[slug]/page.tsx` is being created — so existing routes are unaffected. Confirm by visiting `/menu` after adding the route.

## Test
- Visit `/taksh/table/3` → existing menu renders unchanged; `useTableSession()` returns `{ restaurantId, tableId, tableNumber:3, slug:'taksh' }` downstream (spot-check via a temporary log or React DevTools).
- Visit `/taksh/table/999` (no such table) → graceful "Table not found", no crash.
- Visit `/nope/table/3` (bad slug) → "Table not found".
- Visit `/taksh/table/abc` (non-numeric) → "Table not found", **no** DB query.
- Regression: `/menu` and `/admin` still resolve normally.

## Definition of Done
- [x] `getTableEntry(slug, tableNumber)` added to `lib/database.ts`, returns serializable ids or `null`
- [x] restaurant + table resolved from URL into `restaurantId` / `tableId` (the shape T02/T07 consume)
- [x] ids exposed via `TableSessionContext` (`useTableSession()` hook; `null`-safe off-table)
- [x] existing menu reused via `<MenuPage />` (no catalog duplication; no duplicate Cart/Language providers)
- [x] async `params` awaited; non-numeric / missing slug / missing table all handled gracefully
- [x] Build clean (`npm run build`) — route appears as `ƒ /[slug]/table/[number]`; `/menu` and `/admin` unchanged

**Implemented 2026-06-22:**
- `lib/database.ts:1528` — `TableEntry` interface + `getTableEntry(slug, tableNumber)`
- `context/TableSessionContext.tsx` — `TableSessionProvider` + `useTableSession()` hook (null when off-table)
- `app/[slug]/table/[number]/page.tsx` — async server component: awaits params, parses number, calls `getTableEntry`, wraps `<MenuPage />` in `<TableSessionProvider>` or renders `<TableNotFound />`
