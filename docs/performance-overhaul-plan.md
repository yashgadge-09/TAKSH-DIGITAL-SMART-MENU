# Performance Overhaul — TAKSH Digital Smart Menu

> Master implementation plan. Status: **implemented** on branch `speedup` (all 9 phases). Two intentional deviations from the original write-up, both discovered mid-implementation:
> 1. Phase 1's cached data functions live directly in `lib/database.ts` rather than a separate `lib/menu-data.server.ts` module — it's already server-only and already holds the `supabase` client, so a second module would only duplicate it.
> 2. `MenuPageContent` calling `useSearchParams()` was found to force Next to render only the `loading.tsx` fallback in the static HTML and defer the real dish grid to client hydration — silently defeating SSR. Fixed by threading `category`/`search`/`cart` through as server-rendered props (`page.tsx`'s `searchParams` prop) instead of the client hook. Verified in the prod build: `/menu`'s server HTML now contains all dish cards with prices, not a spinner.
>
> Ordered phases — each is shippable/testable independently. Run `npx tsc --noEmit` after every phase (`ignoreBuildErrors: true` means the build won't catch type mistakes).

## Context

Guests scan a QR and stare at a spinner: `/menu` is fully client-side (`"use client"`, 737 lines) and fetches all 440 dishes via Server-Action POST *after* hydration, so first paint contains zero dish HTML. On top of that: the curated pages (`/chefs-favourites`, `/todays-special`, `/most-loved`) call `getAllDishes(Date.now())` which **defeats the 5-min cache on every visit**; `select('*')` ships all 12 multilingual fields per dish; no `next/dynamic` exists anywhere (CartDrawer/OrderFlow/OneSignal all in the entry bundle); **zero `loading.tsx` files** exist, so every navigation freezes the old page with no feedback ("stale data" complaint); and a fixed 2.3–3.3s splash animation plays on every route including admin.

Goal: QR scan → menu visible near-instantly; every pending navigation/fetch shows a round loader or skeleton — never stale data, never a frozen page.

Confirmed decisions:
- **Splash:** guest-only, once per browser session, shortened (~1.2s).
- **Cleanup:** delete orphan `/category/[name]` route + dead `OrderLikeModal`. (Sidebar 404-links claim was verified FALSE — all AdminSidebar hrefs exist; skip that.)
- **Loader scope:** everything — guest + admin + captain.

## Global constraints (do not touch)

- `getAllDishes(timestamp?)` / `getDishById(id, timestamp?)` signatures + `CACHE_BUST_` escape hatch — admin pages depend on them.
- Analytics gating (`shouldTrackProductionTrafficOnly`, `trackMenuView`, `trackCartEvent`).
- `TableSessionProvider` / `SharedSessionProvider` prop shapes; ordering flow (`approveOrder`, `generateBill`, `updateOrderItemQuantity`, print payloads).
- Focus-refetch in menu page (60s cooldown) — keep behavior, just seed the timer.
- `lib/database.ts` is `"use server"` — only async exports allowed there.

---

## Phase 1 — SSR initial menu data (biggest win)

**Files:** NEW `lib/menu-data.server.ts`; `app/menu/page.tsx` → server shell; NEW `app/menu/menu-client.tsx`; `app/[slug]/table/[number]/page.tsx`; small additions in `lib/database.ts`.

1. **NEW `lib/menu-data.server.ts`** — starts with `import 'server-only'` (add package if absent). Creates its own anon Supabase client (same env vars as `lib/supabase.ts`; cannot reuse `lib/database.ts` — its `getAllDishesCached` at L403 is module-private and `"use server"` blocks non-async exports). Exports:
   - `getMenuDishes` = `unstable_cache(fetcher, ['menu-dishes-v1'], { revalidate: 300, tags: ['dishes'] })` — same query as today (`select('*')`, `is_available=true`, order `created_at`); narrowed in Phase 2. Reusing tag `'dishes'` means existing `revalidateTag('dishes')` calls (addDish/updateDish/deleteDish/toggleAvailability) invalidate it for free.
   - `getCategoriesCached` = `unstable_cache(..., ['categories-v1'], { revalidate: 300, tags: ['categories'] })` (same select as `getCategories()` L525–532).
   - `getMenuInitialData()` = `Promise.all` of both → `{ dishes, categories }`.
2. **`lib/database.ts`:** add `revalidateTag('categories')` to category mutations (nothing invalidates categories today).
3. **Split menu page:** move entire `app/menu/page.tsx` contents to `app/menu/menu-client.tsx` (keep `"use client"`), named export `MenuPage` with optional props `{ initialDishes?, initialCategories? }`.
   - Lift the row→view-model mapping (current L237–258) into module-scope `mapDishRows(rows)` — pure lift-and-shift, don't rewrite.
   - Seed state lazily: `useState(() => initialDishes ? mapDishRows(initialDishes) : [])`, same for categories/categoryImageMap; `isLoading = !initialDishes`.
   - Mount effect: if seeded, skip initial `loadData()` but set `lastLoadRef.current = Date.now()` (focus-refetch cooldown starts at SSR time), still call `trackMenuView`, keep focus listener calling full `loadData()` unchanged.
   - `getMostOrderedDishes(10)`: defer to its own small client effect (strip renders nothing while empty → pops in after paint). Optionally wrap its body in `unstable_cache` (`['most-ordered']`, `revalidate: 120`) inside `database.ts` so the 30-day aggregation isn't recomputed per guest.
4. **NEW `app/menu/page.tsx`** (async Server Component): `const { dishes, categories } = await getMenuInitialData(); return <MenuPage initialDishes={dishes} initialCategories={categories} />`.
5. **Table route** `app/[slug]/table/[number]/page.tsx` (only file importing MenuPage — verified):
   - Change import to `@/app/menu/menu-client`.
   - Add cached lookup in `database.ts`: `getTableEntryCached(slug, n)` via private `unstable_cache` (`['table-entry']`, `revalidate: 3600`, tag `'tables'`) — 16 static rows. Keep uncached `getTableEntry` export.
   - `Promise.all([getTableEntryCached(...), getMenuInitialData()])`, pass props into `<MenuPage />` inside existing providers unchanged.

**Risk:** RSC payload carries full rows until Phase 2 — ship Phase 2 in the same PR. Ensure the cached fetchers touch no request-scoped APIs (cookies/headers).

## Phase 2 — Trim the payload

**File:** `lib/menu-data.server.ts` only.

- Narrow `getMenuDishes` select to: `id, name_en, name_hi, name_mr, description_en, description_hi, description_mr, taste_en, taste_hi, taste_mr, price, image_url, category, spice_level, is_chef_special, is_guest_favorite, is_trending, is_todays_special, created_at`.
- Keeps all 3 languages of name/description/taste (search matches description; language toggle must stay instant with zero refetch). **Drops `ingredients_en/hi/mr`** (text[] — heaviest fields; only the dish detail page uses them, and it fetches its own full row via `getDishById`).
- Column names verified: primary is `taste_en/hi/mr` (admin writes `taste_en`, supabase/CLAUDE.md confirms); `taste_description_*` in `mapDishRows` are legacy fallbacks — safe to not select.
- Bump cache key to `['menu-dishes-v2']` (shape changed).
- `mapDishRows` already tolerates missing ingredients (`Array.isArray(...) ? ... : []`).
- Dish detail page keeps `getDishById` full row — do not "optimize" it onto the narrow fetch.

## Phase 3 — Kill the `Date.now()` cache-bust on curated pages

**Files:** `app/chefs-favourites/page.tsx`, `app/todays-special/page.tsx`, `app/most-loved/page.tsx`; DELETE `app/category/[name]/` (approved — orphan, nothing links to it; menu chips filter client-side; grep `"/category/"` once more before deleting; update `app/CLAUDE.md`).

Per curated page (minimal-risk, ~5-line change each):
- `getAllDishes(Date.now())` → `getAllDishes()` (cached path).
- Remove `lang` from the fetch-effect deps; keep raw rows in state and localize via `useMemo` keyed on `lang` (mirror menu-client) — language toggle becomes zero-network.

## Phase 4 — `next/dynamic` for heavy modals

**File:** `app/menu/menu-client.tsx`.

- Dynamic with `ssr: false` + `loading: () => <ModalPendingSpinner />` (from Phase 5): `CartDrawer`, `OrderFlow`, `ReviewModal`, `NotificationPrompt` (pulls `react-onesignal` — biggest win). `OrderLikeModal` → delete instead (Phase 9).
- **Lazy-mount, stay-mounted:** gate each with a "has ever opened" flag (`{hasOpenedCart && <CartDrawer isOpen={...} />}`, set true on first open, never reset) so the chunk loads on first tap and close animations survive. `NotificationPrompt`: mount after a ~3s idle-delay effect (self-triggering, not user-opened).
- `RateUsCard` stays static (small, in-flow).
- **Verify first:** if `OrderFlow` runs mount effects while closed (session subscriptions), keep it dynamic-but-always-rendered instead of gated.

## Phase 5 — Loaders everywhere (the "no stale data" fix)

**Files:** NEW `components/BrandLoader.tsx`; NEW `loading.tsx` files; NEW `hooks/usePendingNavigation.ts`; `app/admin/layout.tsx`; `app/admin/analytics/page.tsx`; `app/captain/tables/page.tsx`; `app/menu/menu-client.tsx` + curated pages.

1. **`components/BrandLoader.tsx`** built on existing unused `components/ui/spinner.tsx` + `skeleton.tsx`:
   - `BrandSpinner` (round, brand-gold, sm/md/lg, optional label);
   - `FullScreenLoader` (centered, guest dark theme + `variant="admin"` cream);
   - `PendingOverlay` (absolute translucent `bg-black/40` layer + centered spinner — for "data being replaced" states: old content visibly dimmed under a live loader, never presented as fresh).
   - Migrate the ~12 ad-hoc inline loaders as files are touched (no big-bang sweep).
2. **Route `loading.tsx`** (instant nav feedback — currently zero exist):
   - `app/loading.tsx` (FullScreenLoader, guest theme);
   - `app/menu/loading.tsx` — layout-matched skeleton: header + 6 circle skeletons (category tabs) + 6 card skeletons;
   - `app/[slug]/table/[number]/loading.tsx` — same skeleton (shows during server-side table+menu await);
   - `app/dish/[id]/loading.tsx` — hero + text-line skeleton;
   - `app/admin/loading.tsx`, `app/captain/loading.tsx` — themed FullScreenLoader.
   - Also `app/error.tsx` (branded error + retry) — today an SSR failure white-screens.
3. **Admin layout blanking fix** (`app/admin/layout.tsx` L22/L57): stop resetting `isSessionReady=false` on every pathname change. `getSession()` once on mount + `onAuthStateChange` subscription; pathname effect keeps only the redirect decision using the resolved session. Don't touch captain-role redirect logic.
4. **`/admin/analytics`:** add `isFetching` set by user-initiated range/date changes (Realtime silent refetches skip it); wrap charts+tiles region in `relative` + `<PendingOverlay show={isFetching} />`; disable range buttons while pending.
5. **`/captain/tables`:** `isInitialLoading` → FullScreenLoader instead of bare text; gate pending-approvals + parcel strips' empty-states on `!isInitialLoading` (skeleton chips while loading — never "nothing pending" before first data). Background Realtime refetches stay silent.
6. **`hooks/usePendingNavigation.ts`:** `useTransition`-wrapped `router.push` returning `{ push, isPending }`. Use in menu-client (dish open, see-all, curated links), curated pages, dish back button; render `<PendingOverlay show={isPending} />` at page root. Guarantees: tap → dimmed page + spinner → destination skeleton → content.
7. Reference (don't change): `/admin/history`'s `loading && !result` gate + per-row `detailLoadingId` — copy this pattern for in-place list refetches.

## Phase 6 — Image discipline

**Files:** `app/menu/menu-client.tsx`, three curated pages, `app/preview/page.tsx`.

- **Category tab circles** (menu ~L537 — currently RAW full-size, eager, above the fold; biggest first-paint waste): `thumbUrl(imgSrc, 112)` + `width={56} height={56}`, keep eager.
- **DishMedia:** add `width`/`height` attrs from its `width` prop (kills per-img CLS); new `eager?: boolean` → `loading="eager" fetchPriority="high"` (React casing: `fetchPriority`) for the first ~4 cards of the first section only.
- Curated pages: hardcoded `thumbUrl(url, 400)` for 88px boxes → `176`.
- `app/preview/page.tsx`: route raw URLs through `thumbUrl`.
- Do NOT migrate to `next/image` this pass — plain `<img>` + Cloudinary transforms already delivers the payload win.

## Phase 7 — Render fewer cards

**File:** `app/menu/menu-client.tsx`.

- Incremental rendering, NOT virtualization (variable heights + sticky headers + horizontal strips make windowing high-risk for little gain at 440 rows).
- Module-scope hook `useIncrementalList(items, batch = 24)` → `{ visible, sentinelRef, done }`; `visibleCount` resets on `items` identity change (automatic — `filteredDishes` is a new array per query/category change); IntersectionObserver sentinel bumps by `batch`.
- Apply to the two unbounded branches: search results (currently up to ~440 cards in one commit) and the category-selected branch. Tail: sentinel div with small `BrandSpinner` while `!done`.
- Leave "All"-tab `PREVIEW_LIMIT = 6` previews and horizontal strips alone (already bounded). DishCard memoization untouched — hook only slices.

## Phase 8 — Dish page: parallelize + stream

**File:** `app/dish/[id]/page.tsx` (L202–251, three sequential awaits today).

- Await `getDishById(id)` alone → `setDish`, clear main spinner immediately. Then `Promise.allSettled([getDishRecommendations(...), getMoreLikeThisDishes(...)])` (they need `dish.category` — that's the real dependency) with a separate `recsLoading` state.
- While `recsLoading`: skeleton strips (3 card skeletons) in the recommendation sections.
- Back button stays `router.push('/menu')` — cheap after Phase 1 SSR. `trackDishView` stays fire-and-forget.

## Phase 9 — Cleanup + splash (approved scope)

- **Delete `OrderLikeModal` usage** in menu-client (import + render + `isOrderRatingOpen` state + `handleDishRatingsSubmit` wiring) — verify the open handler is truly a no-op first; leave the component file itself if the post-order rating flow may return.
- **`/category/[name]`** deleted in Phase 3.
- **SplashScreen** (`app/layout.tsx`, fixed 2.3–3.3s timer): make it client-aware — skip entirely when `pathname` starts with `/admin` or `/captain`; guest routes show once per browser session (`sessionStorage` flag); cut duration to ~1.2s. Isolated change, easily revertable.
- Update `app/CLAUDE.md` where it disagrees with reality (dish page has no `generateMetadata`; deleted routes).

## Verification (run `npm run build && npm run start` — unstable_cache is unreliable in dev)

1. **SSR:** View Source on `/menu` and `/taksh/table/3` — dish names in initial HTML; Network shows no `getAllDishes` POST on mount, only the deferred `getMostOrderedDishes`.
2. **Cache:** two hits within 5 min → one Supabase query; admin dish edit → menu updates via tag; admin `getAllDishes(Date.now())` still fresh.
3. **Payload:** RSC payload size drop; no `ingredients_*` strings in it.
4. **Ordering regression:** QR → PIN → place order → `/admin/incoming` → approve → KOT print job row. Focus-refetch after >60s background works.
5. **Bundle:** `/menu` first-load JS drop; cart chunk fetched only on first cart tap; no `react-onesignal` in entry chunk.
6. **Loaders (Fast-3G throttle):** every nav shows spinner/skeleton immediately; admin nav no blanking; analytics range click dims charts under spinner; captain tables never says "nothing pending" pre-data.
7. **Images:** category circles carry `w_112`; grid thumbs right-sized; first row `fetchpriority=high`; Lighthouse mobile CLS < 0.05.
8. **Render volume:** broad search commits ≤24 cards; scroll loads batches.
9. **Dish page:** paints after 1 round-trip; rec skeletons stream in.
10. **i18n:** en/hi/mr toggle on menu + curated pages — zero network, all text switches (incl. taste lines — confirms Phase 2 columns).
11. `npx tsc --noEmit` after each phase.
