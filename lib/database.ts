"use server"

import { supabase } from './supabase'
import { createClient, type User } from '@supabase/supabase-js'
import { randomInt, randomUUID } from 'crypto'
import { revalidateTag, unstable_cache } from 'next/cache'
import { headers } from 'next/headers'
import { getOptionalUser, requireAdmin, requireStaff } from './auth-guard'
import { requireServerEnv } from './env'
import { REMOVAL_REASONS, type ActivityAction, type RemovalReason } from './activity'
import { isValidIndianPhone, PHONE_VALIDATION_MESSAGE } from './phone'

const adminSupabase = createClient(
  requireServerEnv('NEXT_PUBLIC_SUPABASE_URL'),
  requireServerEnv('SUPABASE_SERVICE_ROLE_KEY')
)

// ── Activity log (A01) — immutable audit trail of staff actions ─────────────

function staffRole(user: Pick<User, 'app_metadata'>): 'admin' | 'captain' {
  return user.app_metadata?.role === 'captain' ? 'captain' : 'admin'
}

type ActivityLogInsert = {
  restaurantId: string | null
  /** null = guest-triggered (e.g. "Request Bill") */
  actor: User | null
  action: ActivityAction
  sessionId?: string | null
  orderId?: string | null
  label?: string | null
  dishName?: string | null
  qtyBefore?: number | null
  qtyAfter?: number | null
  /** Signed ₹ impact — negative when money leaves the order. */
  amountDelta?: number | null
  reason?: string | null
  details?: Record<string, unknown> | null
}

/**
 * Writes audit rows to `activity_log` (service-role only, no UPDATE/DELETE
 * path — immutable once written). Accepts one entry or a batch (one insert
 * round-trip either way). Best-effort by design: a logging failure must
 * never abort the service action that calls it, so errors go to the server
 * log and are swallowed. Callers must AWAIT it — a floating promise can be
 * dropped when the serverless invocation ends.
 */
async function logActivity(entry: ActivityLogInsert | ActivityLogInsert[]): Promise<void> {
  const entries = Array.isArray(entry) ? entry : [entry]
  if (!entries.length) return
  try {
    const { error } = await adminSupabase.from('activity_log').insert(
      entries.map((e) => ({
        restaurant_id: e.restaurantId,
        actor_id: e.actor?.id ?? null,
        actor_email: e.actor?.email ?? null,
        actor_role: e.actor ? staffRole(e.actor) : 'guest',
        action: e.action,
        session_id: e.sessionId ?? null,
        order_id: e.orderId ?? null,
        label: e.label ?? null,
        dish_name: e.dishName ?? null,
        qty_before: e.qtyBefore ?? null,
        qty_after: e.qtyAfter ?? null,
        amount_delta: e.amountDelta ?? null,
        reason: e.reason ?? null,
        details: e.details ?? null,
      }))
    )
    if (error) console.error('[activity_log] insert failed:', error.message)
  } catch (e) {
    console.error('[activity_log] insert failed:', e)
  }
}

/**
 * One-query label + restaurant resolver for log entries on actions that only
 * hold a sessionId (settle, move, force reset, cancel).
 */
async function getSessionLogContext(
  sessionId: string
): Promise<{ restaurantId: string | null; label: string | null }> {
  const { data, error } = await adminSupabase
    .from('table_sessions')
    .select('restaurant_id, session_type, token_number, host_name, restaurant_tables(table_number)')
    .eq('id', sessionId)
    .maybeSingle()
  if (error) console.error('[activity_log] label lookup failed:', error.message)
  if (!data) return { restaurantId: null, label: null }
  return {
    restaurantId: data.restaurant_id,
    label: billLabel(data as unknown as Parameters<typeof billLabel>[0]),
  }
}

/**
 * Total ₹ of a session's non-rejected items — what gets discarded by a force
 * reset or parcel cancel, logged so the pattern is visible to the admin.
 * Returns null when the query fails (never a silent ₹0 — that would hide
 * exactly the money this rollup exists to surface); callers mark the log row
 * with `amountUnknown` instead.
 */
async function sessionDiscardedTotal(sessionId: string): Promise<number | null> {
  const { data, error } = await adminSupabase
    .from('orders')
    .select('status, order_items(price, quantity)')
    .eq('session_id', sessionId)
    .neq('status', 'rejected')
  if (error) {
    console.error('[activity_log] discarded-total query failed:', error.message)
    return null
  }
  return (data ?? []).reduce(
    (sum, order) =>
      sum +
      ((order.order_items as { price: number; quantity: number }[] | null) ?? []).reduce(
        (s, i) => s + (Number(i.price) || 0) * (Number(i.quantity) || 0),
        0
      ),
    0
  )
}

function parseHostname(value: string | null | undefined) {
  if (!value) return ''
  const trimmed = value.trim()
  if (!trimmed) return ''

  try {
    if (trimmed.includes('://')) {
      return new URL(trimmed).hostname.toLowerCase()
    }
  } catch {
    return ''
  }

  const withoutPort = trimmed.split('/')[0]?.split(':')[0] || ''
  return withoutPort.toLowerCase()
}

function isLocalHostname(hostname: string) {
  if (!hostname) return false
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '::1' ||
    hostname.endsWith('.localhost')
  )
}

function matchesAllowedHost(hostname: string, allowedHost: string) {
  if (!hostname || !allowedHost) return false
  return hostname === allowedHost || hostname.endsWith(`.${allowedHost}`)
}

function getAllowedTrackingHosts() {
  const rawHosts = [
    process.env.ANALYTICS_ALLOWED_HOSTS,
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.APP_URL,
    process.env.VERCEL_PROJECT_PRODUCTION_URL,
    process.env.VERCEL_URL,
  ]
    .filter(Boolean)
    .flatMap((value) => String(value).split(','))
    .map((value) => parseHostname(value))
    .filter(Boolean)

  return Array.from(new Set(rawHosts))
}

async function shouldTrackProductionTrafficOnly() {
  const requestHeaders = await headers()
  const candidates = [
    requestHeaders.get('origin'),
    requestHeaders.get('referer'),
    requestHeaders.get('x-forwarded-host'),
    requestHeaders.get('host'),
  ]
    .map((value) => parseHostname(value))
    .filter(Boolean)

  if (!candidates.length) return false
  if (candidates.some((hostname) => isLocalHostname(hostname))) return false

  const allowedHosts = getAllowedTrackingHosts()
  if (!allowedHosts.length) return true

  return candidates.some((hostname) =>
    allowedHosts.some((allowedHost) => matchesAllowedHost(hostname, allowedHost))
  )
}

function normalizeImageUrl(imageUrl: unknown): string {
  if (typeof imageUrl === 'string' && imageUrl.startsWith('[')) {
    try {
      const parsed = JSON.parse(imageUrl)
      if (Array.isArray(parsed) && parsed.length > 0) return String(parsed[0])
    } catch {
      return imageUrl
    }
  }

  if (Array.isArray(imageUrl) && imageUrl.length > 0) {
    return String(imageUrl[0])
  }

  if (typeof imageUrl === 'string' && imageUrl.length > 0) {
    return imageUrl
  }

  return ''
}

function isPermissionDeniedError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const maybeError = error as { code?: string }
  return maybeError.code === '42501'
}

function getPriorityValue(dish: any): number {
  const parsed = Number(dish?.priority)
  return Number.isFinite(parsed) ? parsed : Number.MAX_SAFE_INTEGER
}

function pickByPriorityTiers(recommendations: any[], targetCount: number): any[] {
  const tierCaps = [4, 3, 3]
  const sorted = [...recommendations].sort((a, b) => {
    const priorityDiff = getPriorityValue(a) - getPriorityValue(b)
    if (priorityDiff !== 0) return priorityDiff
    return Number(b?.price || 0) - Number(a?.price || 0)
  })

  const groups = new Map<number, any[]>()
  for (const dish of sorted) {
    const priority = getPriorityValue(dish)
    if (!groups.has(priority)) groups.set(priority, [])
    groups.get(priority)!.push(dish)
  }

  const orderedPriorities = Array.from(groups.keys()).sort((a, b) => a - b)
  const selected: any[] = []
  const selectedIds = new Set<string>()

  for (let i = 0; i < tierCaps.length && i < orderedPriorities.length; i++) {
    const priority = orderedPriorities[i]
    const candidates = groups.get(priority) || []

    for (const dish of candidates) {
      if (selected.length >= targetCount) break
      if (selectedIds.has(dish.id)) continue
      if (selected.filter((d) => getPriorityValue(d) === priority).length >= tierCaps[i]) continue

      selected.push(dish)
      selectedIds.add(dish.id)
    }
  }

  if (selected.length < targetCount) {
    for (const dish of sorted) {
      if (selected.length >= targetCount) break
      if (selectedIds.has(dish.id)) continue
      selected.push(dish)
      selectedIds.add(dish.id)
    }
  }

  return selected
}

function shuffleArray<T>(items: T[]): T[] {
  const next = [...items]
  for (let i = next.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const temp = next[i]
    next[i] = next[j]
    next[j] = temp
  }
  return next
}

function shuffleWithinCategoryPreserveCategoryOrder(items: any[]): any[] {
  const categoryOrder: string[] = []
  const groupedByCategory = new Map<string, any[]>()

  for (const item of items) {
    const category = String(item?.category || '')
    if (!groupedByCategory.has(category)) {
      groupedByCategory.set(category, [])
      categoryOrder.push(category)
    }
    groupedByCategory.get(category)!.push(item)
  }

  const output: any[] = []
  for (const category of categoryOrder) {
    const categoryItems = groupedByCategory.get(category) || []
    output.push(...shuffleArray(categoryItems))
  }

  return output
}

const getRecommendationsCached = unstable_cache(
  async (currentDishId: string, currentCategory: string, limitPerCategory: number) => {
    const { data, error } = await supabase.rpc('get_recommendations', {
      current_dish_id: currentDishId,
      current_category: currentCategory,
      limit_per_category: limitPerCategory,
    })

    if (error) throw error

    return (data || []).map((dish: any) => ({
      ...dish,
      image: normalizeImageUrl(dish.image_url),
    }))
  },
  ['recommendations'],
  { revalidate: 300, tags: ['recommendations'] }
)

export async function getRecommendations(
  currentDishId: string,
  currentCategory: string,
  limitPerCategory = 4
) {
  return getRecommendationsCached(currentDishId, currentCategory, limitPerCategory)
}

export async function getFallbackDishes(
  currentDishId: string,
  currentCategory: string,
  itemLimit = 8
) {
  const { data, error } = await supabase.rpc('get_fallback_dishes', {
    current_dish_id: currentDishId,
    current_category: currentCategory,
    item_limit: itemLimit,
  })

  if (error) throw error

  return (data || []).map((dish: any) => ({
    ...dish,
    image: normalizeImageUrl(dish.image_url),
  }))
}

export async function getDishRecommendations(
  currentDishId: string,
  currentCategory: string,
  limitPerCategory = 4,
  targetCount = 10
) {
  try {
    const recommendations = await getRecommendations(
      currentDishId,
      currentCategory,
      limitPerCategory
    )

    if (recommendations.length > 0) {
      const prioritizedRecommendations = pickByPriorityTiers(recommendations, targetCount).slice(0, targetCount)
      return shuffleWithinCategoryPreserveCategoryOrder(prioritizedRecommendations)
    }
  } catch (error) {
    if (!isPermissionDeniedError(error)) {
      console.error('get_recommendations failed:', error)
    }
  }

  return []
}

export async function getMoreLikeThisDishes(
  currentDishId: string,
  currentCategory: string,
  limit = 10
) {
  const { data, error } = await supabase
    .from('dishes')
    .select('*')
    .eq('is_available', true)
    .eq('category', currentCategory)
    .neq('id', currentDishId)
    .order('is_guest_favorite', { ascending: false })
    .order('is_trending', { ascending: false })
    .order('is_chef_special', { ascending: false })
    .order('price', { ascending: false })
    .limit(limit)

  if (error) throw error

  return (data || []).map((dish: any) => ({
    ...dish,
    image: normalizeImageUrl(dish.image_url),
  }))
}

const getAllDishesCached = unstable_cache(
  async () => {
    const { data, error } = await supabase
      .from('dishes')
      .select('*')
      .eq('is_available', true)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return data;
  },
  ['all-dishes'],
  { revalidate: 300, tags: ['dishes'] }
);

export async function getAllDishes(timestamp?: number) {
  if (timestamp) {
    const { data, error } = await supabase
      .from('dishes')
      .select('*')
      .eq('is_available', true)
      .neq('name_en', `CACHE_BUST_${timestamp}`)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return data;
  }
  return getAllDishesCached();
}

// ── Menu grid list — narrowed columns, SSR-cached (perf: avoids shipping
// ingredients_*/etc for a card grid that never renders them) ───────────────
const MENU_LIST_COLUMNS =
  'id, name_en, name_hi, name_mr, description_en, description_hi, description_mr, ' +
  'taste_en, taste_hi, taste_mr, price, image_url, category, spice_level, ' +
  'is_chef_special, is_guest_favorite, is_trending, is_todays_special, created_at'

const getMenuListCached = unstable_cache(
  async () => {
    const { data, error } = await supabase
      .from('dishes')
      .select(MENU_LIST_COLUMNS)
      .eq('is_available', true)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return data;
  },
  ['menu-dishes-v2'],
  { revalidate: 300, tags: ['dishes'] }
);

export async function getMenuListDishes() {
  return getMenuListCached();
}

const getCategoriesCachedInternal = unstable_cache(
  async () => {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .order('order_index', { ascending: true });
    if (error) throw error;
    return data;
  },
  ['categories-v1'],
  { revalidate: 300, tags: ['categories'] }
);

export async function getCategoriesCached() {
  return getCategoriesCachedInternal();
}

export async function getMenuInitialData() {
  const [dishes, categories] = await Promise.all([
    getMenuListDishes(),
    getCategoriesCached(),
  ]);
  return { dishes: dishes || [], categories: categories || [] };
}

const getDishByIdCached = unstable_cache(
  async (id: string) => {
    const { data, error } = await supabase
      .from('dishes')
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  },
  ['dish'],
  { revalidate: 300, tags: ['dishes'] }
);

export async function getDishById(id: string, timestamp?: number) {
  if (timestamp) {
    const { data, error } = await supabase
      .from('dishes')
      .select('*')
      .eq('id', id)
      .neq('name_en', `CACHE_BUST_${timestamp}`)
      .single();
    if (error) throw error;
    return data;
  }
  return getDishByIdCached(id);
}

export async function getAllDishesAdmin(timestamp?: number) {
  await requireAdmin()
  let query = adminSupabase
    .from('dishes')
    .select('*');

  if (timestamp) {
    // Force bypass cache
    query = query.neq('name_en', `CACHE_BUST_${timestamp}`);
  }

  const { data, error } = await query
    .order('created_at', { ascending: true })
    .order('id', { ascending: true });
  if (error) throw error
  return data
}

export async function addDish(dish: any) {
  await requireAdmin()
  const { data, error } = await adminSupabase
    .from('dishes')
    .insert(dish)
    .select()
    .single()
  if (error) throw error
  revalidateTag('dishes')
  return data
}

export async function updateDish(id: string, dish: any) {
  await requireAdmin()
  const { data, error } = await adminSupabase
    .from('dishes')
    .update(dish)
    .eq('id', id)
    .select()
    .maybeSingle()
  if (error) throw error
  revalidateTag('dishes')
  return data
}

export async function deleteDish(id: string) {
  await requireAdmin()
  const { error } = await adminSupabase
    .from('dishes')
    .delete()
    .eq('id', id)
  if (error) throw error
  revalidateTag('dishes')
}

export async function toggleAvailability(
  id: string,
  isAvailable: boolean
) {
  await requireAdmin()
  const { error } = await adminSupabase
    .from('dishes')
    .update({ is_available: isAvailable })
    .eq('id', id)
  if (error) throw error
  revalidateTag('dishes')
}

export async function getCategories() {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .order('order_index', { ascending: true })
  if (error) throw error
  return data
}

export async function addCategory(name: string) {
  await requireAdmin()
  const { data, error } = await adminSupabase
    .from('categories')
    .insert({ name })
    .select()
    .maybeSingle()
  if (error) throw error
  revalidateTag('categories')
  return data
}

export async function deleteCategory(id: string) {
  await requireAdmin()
  const { error } = await adminSupabase
    .from('categories')
    .delete()
    .eq('id', id)
  if (error) throw error
  revalidateTag('categories')
}

export async function updateCategory(id: string, payload: { image_url?: string | null }) {
  await requireAdmin()
  const { data, error } = await adminSupabase
    .from('categories')
    .update(payload)
    .eq('id', id)
    .select()
    .maybeSingle()
  if (error) throw error
  revalidateTag('categories')
  return data
}

export async function getPublicReviews() {
  const { data, error } = await supabase
    .from('reviews')
    .select('*')
    .eq('is_public', true)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function getAllReviewsAdmin() {
  await requireAdmin()
  const { data, error } = await adminSupabase
    .from('reviews')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function submitReview(review: {
  stars: number
  text: string
  reviewer: string
  dishes: string[]
}) {
  // Public, unauthenticated endpoint whose content is shown on the site — validate
  // strictly. Never spread the raw client object into the insert (mass-assignment:
  // a caller could set is_public/source/etc). Pick only the allowed fields.
  const stars = Number(review?.stars)
  if (!Number.isInteger(stars) || stars < 1 || stars > 5) {
    throw new Error('Rating must be a whole number between 1 and 5')
  }
  const text = String(review?.text ?? '').trim().slice(0, 2000)
  const reviewer = String(review?.reviewer ?? '').trim().slice(0, 80) || 'Guest'
  const dishes = Array.isArray(review?.dishes)
    ? review.dishes.filter((d) => typeof d === 'string').slice(0, 50).map((d) => d.slice(0, 120))
    : []

  const { error } = await supabase
    .from('reviews')
    .insert({ stars, text, reviewer, dishes, is_public: stars >= 4 })
  if (error) throw error
}

export async function toggleReviewVisibility(
  id: string,
  isPublic: boolean
) {
  await requireAdmin()
  const { error } = await adminSupabase
    .from('reviews')
    .update({ is_public: isPublic })
    .eq('id', id)
  if (error) throw error
}

export async function trackMenuView() {
  if (!(await shouldTrackProductionTrafficOnly())) return
  await adminSupabase
    .from('menu_views')
    .insert({ page: 'menu' })
}

export async function trackDishView(
  dishId: string,
  dishName: string,
  category: string
) {
  if (!(await shouldTrackProductionTrafficOnly())) return
  await adminSupabase
    .from('dish_views')
    .insert({
      dish_id: dishId,
      dish_name: dishName,
      category
    })
}

export async function trackCartEvent(
  dishId: string,
  dishName: string,
  category: string,
  price: number
) {
  await adminSupabase
    .from('cart_events')
    .insert({
      dish_id: dishId,
      dish_name: dishName,
      category,
      price
    })
}

export async function trackFavourite(
  dishId: string,
  dishName: string,
  sessionId: string,
  isActive: boolean
) {
  const payload = {
    dish_id: dishId,
    dish_name: dishName,
    session_id: sessionId,
    is_active: isActive,
    updated_at: new Date().toISOString(),
  }

  let { error } = await adminSupabase
    .from('favourites')
    .upsert(payload, {
      onConflict: 'dish_id,session_id',
      ignoreDuplicates: false,
    })

  // Backward compatibility for environments where newer columns are not applied yet.
  if (error?.code === '42703') {
    if (isActive) {
      const fallbackUpsert = await adminSupabase
        .from('favourites')
        .upsert(
          {
            dish_id: dishId,
            dish_name: dishName,
            session_id: sessionId,
          },
          {
            onConflict: 'dish_id,session_id',
            ignoreDuplicates: false,
          }
        )
      error = fallbackUpsert.error
    } else {
      const fallbackDelete = await adminSupabase
        .from('favourites')
        .delete()
        .eq('dish_id', dishId)
        .eq('session_id', sessionId)
      error = fallbackDelete.error
    }
  }

  // Ignore duplicate key conflict after session-level unique index is enabled.
  if (error && error.code !== '23505') {
    throw error
  }
}

export async function getMostLovedDishIds(days = 7, limit = 10) {
  const safeDays = Math.max(1, Math.min(30, Math.floor(Number(days) || 7)))
  const safeLimit = Math.max(1, Math.min(50, Math.floor(Number(limit) || 10)))
  const since = new Date(Date.now() - safeDays * 24 * 60 * 60 * 1000).toISOString()

  let rows: any[] = []
  let error: any = null

  const primary = await supabase
    .from('favourites')
    .select('dish_id, is_active, updated_at, created_at')
    .gte('updated_at', since)
    .eq('is_active', true)

  rows = primary.data || []
  error = primary.error

  // Backward compatibility for environments before active-state migration.
  if (error?.code === '42703') {
    const fallback = await supabase
      .from('favourites')
      .select('dish_id, created_at')
      .gte('created_at', since)

    rows = fallback.data || []
    error = fallback.error
  }

  if (error) throw error

  const scoreByDishId = new Map<string, { count: number; lastTouchedAt: string }>()

  rows.forEach((row: any) => {
    const dishId = String(row?.dish_id || '').trim()
    if (!dishId) return
    if (row?.is_active === false) return

    const touchedAt = String(row?.updated_at || row?.created_at || '')
    const existing = scoreByDishId.get(dishId)

    if (!existing) {
      scoreByDishId.set(dishId, { count: 1, lastTouchedAt: touchedAt })
      return
    }

    scoreByDishId.set(dishId, {
      count: existing.count + 1,
      lastTouchedAt: touchedAt > existing.lastTouchedAt ? touchedAt : existing.lastTouchedAt,
    })
  })

  return Array.from(scoreByDishId.entries())
    .sort((a, b) => {
      const countDiff = b[1].count - a[1].count
      if (countDiff !== 0) return countDiff
      return b[1].lastTouchedAt.localeCompare(a[1].lastTouchedAt)
    })
    .slice(0, safeLimit)
    .map(([dishId]) => dishId)
}

export async function trackLikedDishesFromOrder(
  dishes: Array<{ id: string; name: string }>,
  sessionId: string
) {
  const normalizedSessionId = String(sessionId || '').trim()
  if (!normalizedSessionId) return

  const uniqueDishes = new Map<string, { id: string; name: string }>()

  dishes.forEach((dish) => {
    const id = String(dish?.id || '').trim()
    const name = String(dish?.name || '').trim()
    if (!id || !name) return
    if (!uniqueDishes.has(id)) {
      uniqueDishes.set(id, { id, name })
    }
  })

  if (uniqueDishes.size === 0) return

  await Promise.all(
    Array.from(uniqueDishes.values()).map((dish) =>
      trackFavourite(dish.id, dish.name, normalizedSessionId, true)
    )
  )
}

export async function submitDishRatingsFromOrder(
  ratings: Array<{ id: string; name: string; rating: number }>,
  sessionId: string
) {
  const normalizedSessionId = String(sessionId || '').trim()
  if (!normalizedSessionId) return

  const sanitizedRatings = new Map<string, { id: string; name: string; rating: number }>()

  ratings.forEach((entry) => {
    const id = String(entry?.id || '').trim()
    const name = String(entry?.name || '').trim()
    const numericRating = Math.floor(Number(entry?.rating || 0))

    if (!id || !name) return
    if (numericRating < 1 || numericRating > 5) return

    sanitizedRatings.set(id, { id, name, rating: numericRating })
  })

  if (sanitizedRatings.size === 0) return

  const now = new Date().toISOString()
  const payload = Array.from(sanitizedRatings.values()).map((entry) => ({
    dish_id: entry.id,
    dish_name: entry.name,
    session_id: normalizedSessionId,
    rating: entry.rating,
    created_at: now,
    updated_at: now,
  }))

  const { error } = await adminSupabase
    .from('dish_ratings')
    .insert(payload)

  if (error) throw error
}

export async function getMostLovedDishRatings(limit = 10) {
  const safeLimit = Math.max(1, Math.min(50, Math.floor(Number(limit) || 10)))

  const { data, error } = await supabase
    .from('dish_ratings')
    .select('dish_id, rating, updated_at')

  if (error) {
    // Gracefully degrade if migration is not applied yet.
    if (error.code === '42P01') return []
    throw error
  }

  const aggregate = new Map<string, { total: number; count: number; lastRatedAt: string }>()

    ; (data || []).forEach((row: any) => {
      const dishId = String(row?.dish_id || '').trim()
      const rating = Number(row?.rating || 0)
      const updatedAt = String(row?.updated_at || '')

      if (!dishId) return
      if (!Number.isFinite(rating) || rating < 1 || rating > 5) return

      const existing = aggregate.get(dishId)
      if (!existing) {
        aggregate.set(dishId, {
          total: rating,
          count: 1,
          lastRatedAt: updatedAt,
        })
        return
      }

      aggregate.set(dishId, {
        total: existing.total + rating,
        count: existing.count + 1,
        lastRatedAt: updatedAt > existing.lastRatedAt ? updatedAt : existing.lastRatedAt,
      })
    })

  return Array.from(aggregate.entries())
    .map(([dishId, value]) => ({
      dishId,
      averageRating: value.count > 0 ? value.total / value.count : 0,
      ratingsCount: value.count,
      lastRatedAt: value.lastRatedAt,
    }))
    .sort((a, b) => {
      const avgDiff = b.averageRating - a.averageRating
      if (avgDiff !== 0) return avgDiff

      const countDiff = b.ratingsCount - a.ratingsCount
      if (countDiff !== 0) return countDiff

      return b.lastRatedAt.localeCompare(a.lastRatedAt)
    })
    .slice(0, safeLimit)
}

export async function getMostOrderedDishes(limit = 10, days = 30) {
  const safeLimit = Math.max(1, Math.min(50, Math.floor(Number(limit) || 10)))
  const safeDays = Math.max(1, Math.min(90, Math.floor(Number(days) || 30)))
  const since = new Date(Date.now() - safeDays * 24 * 60 * 60 * 1000).toISOString()

  const { data, error } = await adminSupabase
    .from('orders')
    .select('status, placed_at, order_items(dish_id, quantity)')
    .neq('status', 'rejected')
    .gte('placed_at', since)

  if (error) throw error

  const totals = new Map<string, number>()
  ;(data || []).forEach((order: any) => {
    ;(order.order_items || []).forEach((item: any) => {
      const dishId = String(item?.dish_id || '').trim()
      const qty = Number(item?.quantity) || 0
      if (!dishId || qty <= 0) return
      totals.set(dishId, (totals.get(dishId) || 0) + qty)
    })
  })

  return Array.from(totals.entries())
    .map(([dishId, orderCount]) => ({ dishId, orderCount }))
    .sort((a, b) => b.orderCount - a.orderCount)
    .slice(0, safeLimit)
}

// Recomputing the 30-day order aggregation per guest is wasteful — it barely
// changes minute to minute. Short TTL cache keeps the "Most Ordered" strip fresh.
const getMostOrderedDishesCachedInternal = unstable_cache(
  async (limit: number, days: number) => getMostOrderedDishes(limit, days),
  ['most-ordered'],
  { revalidate: 120 }
);

export async function getMostOrderedDishesCached(limit = 10, days = 30) {
  return getMostOrderedDishesCachedInternal(limit, days);
}

function buildDayBuckets(days: number) {
  const buckets: Array<{
    key: string
    label: string
    scans: number
    favourites: number
    carts: number
  }> = []

  for (let offset = days - 1; offset >= 0; offset--) {
    const date = new Date()
    date.setHours(0, 0, 0, 0)
    date.setDate(date.getDate() - offset)

    const key = formatLocalDayKey(date)
    const label = date.toLocaleDateString('en-US', { weekday: 'short' })

    buckets.push({
      key,
      label,
      scans: 0,
      favourites: 0,
      carts: 0,
    })
  }

  return buckets
}

function formatLocalDayKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function parseReviewDishes(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((dish) => String(dish || '').trim())
      .filter(Boolean)
  }

  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return []

    if (trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed)
        if (Array.isArray(parsed)) {
          return parsed
            .map((dish) => String(dish || '').trim())
            .filter(Boolean)
        }
      } catch {
        return []
      }
    }

    return trimmed
      .split(',')
      .map((dish) => dish.trim())
      .filter(Boolean)
  }

  return []
}

function normalizeDayKey(value: string | null | undefined) {
  if (!value) return ''
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value.slice(0, 10)
  return formatLocalDayKey(parsed)
}

function toShortDate(value: string | null | undefined) {
  if (!value) return '—'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return '—'
  return parsed.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}

function getFavouriteIdentity(event: { session_id?: string | null; id?: string | number | null }) {
  const sessionId = String(event.session_id || '').trim()
  if (sessionId) return sessionId

  if (event.id !== undefined && event.id !== null) {
    return `legacy-${event.id}`
  }

  return ''
}

export async function getAnalyticsData(days = 7) {
  await requireAdmin()
  const safeDays = Math.max(1, Math.min(90, Math.floor(Number(days) || 7)))
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayISO = today.toISOString()
  const weekStart = new Date(today)
  weekStart.setDate(today.getDate() - (safeDays - 1))
  const weekStartISO = weekStart.toISOString()

  const [
    menuViewsToday,
    menuViewsInRange,
    dishViewsInRange,
    cartEventsInRange,
    cartEventsToday,
    favouritesInRange,
    reviewsInRange,
    ordersInRange,
  ] = await Promise.all([
    adminSupabase
      .from('menu_views')
      .select('*', { count: 'exact' })
      .gte('created_at', todayISO),
    adminSupabase
      .from('menu_views')
      .select('created_at')
      .gte('created_at', weekStartISO),
    adminSupabase
      .from('dish_views')
      .select('dish_name, category, created_at')
      .gte('created_at', weekStartISO),
    adminSupabase
      .from('cart_events')
      .select('dish_name, category, price, created_at')
      .gte('created_at', weekStartISO),
    adminSupabase
      .from('cart_events')
      .select('price')
      .gte('created_at', todayISO),
    adminSupabase
      .from('favourites')
      .select('id, dish_name, created_at, session_id, is_active, updated_at')
      .gte('created_at', weekStartISO),
    adminSupabase
      .from('reviews')
      .select('id, stars, is_public, text, reviewer, dishes, created_at')
      .gte('created_at', weekStartISO),
    adminSupabase
      .from('orders')
      .select('customer_id, placed_at')
      .gte('placed_at', weekStartISO)
      .neq('status', 'rejected'),
  ])

  let favouritesRows = (favouritesInRange.data || []).map((row: any) => ({
    ...row,
    is_active: row.is_active ?? true,
    updated_at: row.updated_at ?? row.created_at,
  }))
  let favouritesError = favouritesInRange.error

  if (favouritesError && favouritesError.code === '42703') {
    const fallbackFavourites = await adminSupabase
      .from('favourites')
      .select('id, dish_name, created_at, session_id')
      .gte('created_at', weekStartISO)

    favouritesRows = (fallbackFavourites.data || []).map((row) => ({
      ...row,
      is_active: true,
      updated_at: row.created_at,
    }))
    favouritesError = fallbackFavourites.error
  }

  if (favouritesError && favouritesError.code === '42703') {
    const fallbackLegacy = await adminSupabase
      .from('favourites')
      .select('id, dish_name, created_at')
      .gte('created_at', weekStartISO)

    favouritesRows = (fallbackLegacy.data || []).map((row) => ({
      ...row,
      session_id: null,
      is_active: true,
      updated_at: row.created_at,
    }))
    favouritesError = fallbackLegacy.error
  }

  const queryErrors = [
    menuViewsToday.error,
    menuViewsInRange.error,
    dishViewsInRange.error,
    cartEventsInRange.error,
    cartEventsToday.error,
    favouritesError,
    reviewsInRange.error,
  ].filter(Boolean)

  const queryWarning = queryErrors.length
    ? 'Some analytics queries failed due to missing permissions or schema. Check Supabase table policies and columns for analytics events.'
    : null

  const dishViewCounts: Record<string, number> = {}
  const weeklyDishViewCounts: Record<string, { count: number; category: string }> = {}

  dishViewsInRange.data?.forEach(view => {
    dishViewCounts[view.dish_name] =
      (dishViewCounts[view.dish_name] || 0) + 1

    weeklyDishViewCounts[view.dish_name] = {
      count: (weeklyDishViewCounts[view.dish_name]?.count || 0) + 1,
      category: view.category || 'General',
    }
  })

  const cartCounts: Record<string, number> = {}
  cartEventsInRange.data?.forEach(event => {
    cartCounts[event.dish_name] =
      (cartCounts[event.dish_name] || 0) + 1
  })

  const favouriteSessionSets: Record<string, Set<string>> = {}
  favouritesRows.forEach((fav: any) => {
    if (fav.is_active === false) return

    const identity = getFavouriteIdentity(fav)
    if (!identity || !fav.dish_name) return

    if (!favouriteSessionSets[fav.dish_name]) {
      favouriteSessionSets[fav.dish_name] = new Set<string>()
    }

    favouriteSessionSets[fav.dish_name].add(identity)
  })

  const favCounts: Record<string, number> = {}
  Object.entries(favouriteSessionSets).forEach(([dishName, sessionSet]) => {
    favCounts[dishName] = sessionSet.size
  })

  const estimatedRevenue = cartEventsToday.data?.reduce(
    (sum, event) => sum + (event.price || 0), 0
  ) || 0

  const reviews = reviewsInRange.data || []
  const avgRating = reviews.length > 0
    ? reviews.reduce((sum, r) => sum + r.stars, 0)
    / reviews.length
    : 0

  const dayBuckets = buildDayBuckets(safeDays)
  const bucketMap = new Map(dayBuckets.map((bucket) => [bucket.key, bucket]))

  menuViewsInRange.data?.forEach((event) => {
    const key = normalizeDayKey(event.created_at)
    const bucket = bucketMap.get(key)
    if (bucket) bucket.scans += 1
  })

  const favouriteBucketKeys = new Set<string>()
  favouritesRows.forEach((event: any) => {
    if (event.is_active === false) return

    const key = normalizeDayKey(event.updated_at || event.created_at)
    const bucket = bucketMap.get(key)

    const identity = getFavouriteIdentity(event)
    if (!bucket || !identity || !event.dish_name) return

    const uniqueBucketKey = `${key}:${event.dish_name}:${identity}`
    if (favouriteBucketKeys.has(uniqueBucketKey)) return

    favouriteBucketKeys.add(uniqueBucketKey)
    bucket.favourites += 1
  })

  cartEventsInRange.data?.forEach((event) => {
    const key = normalizeDayKey(event.created_at)
    const bucket = bucketMap.get(key)
    if (bucket) bucket.carts += 1
  })

  const weeklyScans = dayBuckets.map((bucket) => ({
    day: bucket.label,
    scans: bucket.scans,
  }))

  // Count unique customers per day bucket
  const customersByDay = new Map<string, Set<string>>()
  dayBuckets.forEach(b => customersByDay.set(b.key, new Set()))
  ordersInRange.data?.forEach((order: any) => {
    const key = normalizeDayKey(order.placed_at)
    const set = customersByDay.get(key)
    if (set && order.customer_id) set.add(order.customer_id)
  })
  const weeklyCustomers = dayBuckets.map((bucket) => ({
    day: bucket.label,
    customers: customersByDay.get(bucket.key)?.size ?? 0,
  }))

  const scansVsFavourites = dayBuckets.map((bucket) => ({
    day: bucket.label,
    scans: bucket.scans,
    favourites: bucket.favourites,
  }))

  const topDishesThisWeek = Object.entries(weeklyDishViewCounts)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 5)
    .map(([name, value], index) => {
      return {
        rank: index + 1,
        name,
        category: value.category || 'General',
        views: value.count,
        trending: 'up',
        image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=100&h=100&fit=crop',
      }
    })

  const ratingDistribution = [5, 4, 3, 2, 1].map((stars) => {
    const count = reviews.filter((review) => review.stars === stars).length
    const percentage = reviews.length
      ? Math.round((count / reviews.length) * 1000) / 10
      : 0
    return { stars, count, percentage }
  })

  const recentReviews = [...reviews]
    .sort((a, b) => {
      const dateA = new Date(a.created_at || 0).getTime()
      const dateB = new Date(b.created_at || 0).getTime()
      return dateB - dateA
    })
    .slice(0, 8)
    .map((review) => ({
      id: review.id,
      stars: review.stars || 0,
      text: review.text || 'No review text provided.',
      reviewer: review.reviewer || 'Anonymous',
      date: toShortDate(review.created_at),
      isPublic: Boolean(review.is_public),
      dishes: Array.isArray(review.dishes) ? review.dishes : [],
    }))

  const topRatedMap: Record<string, { stars: number; count: number }> = {}
  reviews.forEach((review) => {
    const dishes = parseReviewDishes(review.dishes)
    dishes.forEach((dishName: string) => {
      topRatedMap[dishName] = {
        stars: (topRatedMap[dishName]?.stars || 0) + (review.stars || 0),
        count: (topRatedMap[dishName]?.count || 0) + 1,
      }
    })
  })

  const topRatedDishes = Object.entries(topRatedMap)
    .map(([name, value]) => ({
      name,
      rating: value.count ? value.stars / value.count : 0,
      mentions: value.count,
    }))
    .sort((a, b) => {
      if (b.rating !== a.rating) return b.rating - a.rating
      return b.mentions - a.mentions
    })
    .slice(0, 5)
    .map((dish, index) => ({
      rank: index + 1,
      name: dish.name,
      category: 'Guest Reviews',
      rating: Math.round(dish.rating * 10) / 10,
      mentions: dish.mentions,
      image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=100&h=100&fit=crop',
    }))

  return {
    menuViewsToday: menuViewsToday.count || 0,
    topDishViews: Object.entries(dishViewCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count })),
    topCartDishes: Object.entries(cartCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count })),
    topFavourites: Object.entries(favCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count })),
    estimatedRevenueToday: estimatedRevenue,
    totalReviews: reviews.length,
    publicReviews: reviews.filter(r => r.is_public).length,
    avgRating: Math.round(avgRating * 10) / 10,
    weeklyScans,
    weeklyCustomers,
    scansVsFavourites,
    topDishesThisWeek,
    ratingDistribution,
    recentReviews,
    topRatedDishes,
    totalScans: menuViewsInRange.data?.length || 0,
    windowDays: safeDays,
    queryWarning,
  }
}

// ─── Ordering system ────────────────────────────────────────────────────────

// Returns the UTC Date corresponding to midnight IST today.
// Any session whose opened_at is before this cutoff is from a previous day.
function todayMidnightIST(): Date {
  const istNow = new Date(Date.now() + 5.5 * 60 * 60 * 1000)
  const dateStr = istNow.toISOString().split('T')[0] // "YYYY-MM-DD" in IST
  return new Date(`${dateStr}T00:00:00+05:30`)
}

async function closeStaleSession(sessionId: string): Promise<void> {
  await adminSupabase
    .from('table_sessions')
    .update({ status: 'closed', closed_at: new Date().toISOString() })
    .eq('id', sessionId)
}

// ── PIN brute-force lockout ──────────────────────────────────────────────────
const MAX_PIN_ATTEMPTS = 5
const PIN_LOCKOUT_MS = 15 * 60 * 1000 // 15 minutes

type PinGuardSession = {
  id: string
  pin: string
  pin_failed_attempts?: number | null
  pin_locked_until?: string | null
}

/**
 * Verifies a PIN attempt against a session with brute-force protection.
 * - If the session is currently locked, throws immediately (no PIN check).
 * - On a wrong PIN, increments the failure counter and locks the session for
 *   15 minutes once MAX_PIN_ATTEMPTS is reached.
 * - On the correct PIN, clears the counter/lock.
 * State lives in Postgres (via the service-role client), so the limit holds
 * across all serverless instances — unlike per-instance in-memory counters.
 */
async function verifyPinWithLockout(session: PinGuardSession, pinAttempt: string): Promise<void> {
  if (session.pin_locked_until && new Date(session.pin_locked_until) > new Date()) {
    const mins = Math.max(1, Math.ceil((new Date(session.pin_locked_until).getTime() - Date.now()) / 60000))
    throw new Error(`Too many incorrect PIN attempts. Please try again in ${mins} minute${mins === 1 ? '' : 's'}.`)
  }

  if (String(pinAttempt).trim() === session.pin) {
    if ((session.pin_failed_attempts ?? 0) > 0 || session.pin_locked_until) {
      await adminSupabase
        .from('table_sessions')
        .update({ pin_failed_attempts: 0, pin_locked_until: null })
        .eq('id', session.id)
    }
    return
  }

  const attempts = (session.pin_failed_attempts ?? 0) + 1
  const update: { pin_failed_attempts: number; pin_locked_until?: string } = { pin_failed_attempts: attempts }
  if (attempts >= MAX_PIN_ATTEMPTS) {
    update.pin_locked_until = new Date(Date.now() + PIN_LOCKOUT_MS).toISOString()
  }
  await adminSupabase.from('table_sessions').update(update).eq('id', session.id)
  throw new Error('Incorrect PIN')
}

export type SessionResult =
  | { exists: false; sessionId: string; tableNumber: number; pin: string }
  | { exists: true; requiresPin: true }
  | { exists: true; requiresPin?: false; sessionId: string; tableNumber: number; pin: string }

export async function createOrJoinSession({
  restaurantId,
  tableId,
  pinAttempt,
}: {
  restaurantId: string
  tableId: string
  pinAttempt?: string | number
}): Promise<SessionResult> {
  if (!restaurantId || !tableId) throw new Error('restaurantId and tableId are required')

  const { data: tableRow, error: tableError } = await adminSupabase
    .from('restaurant_tables')
    .select('table_number')
    .eq('id', tableId)
    .single()

  if (tableError || !tableRow) throw new Error('Table not found')
  const tableNumber: number = tableRow.table_number

  const { data: foundSession } = await adminSupabase
    .from('table_sessions')
    .select('id, pin, opened_at, pin_failed_attempts, pin_locked_until')
    .eq('table_id', tableId)
    .eq('status', 'active')
    .maybeSingle()

  // Auto-close sessions opened before today's midnight IST (stale from a previous day)
  let activeSession = foundSession
  if (foundSession && new Date(foundSession.opened_at) < todayMidnightIST()) {
    await closeStaleSession(foundSession.id)
    activeSession = null
  }

  if (!activeSession) {
    // CSPRNG — Math.random() is predictable and would let an attacker guess a
    // table's join PIN. randomInt() is crypto-secure and uniform over 1000–9999.
    const pin = String(randomInt(1000, 10000))
    const { data: newSession, error: insertError } = await adminSupabase
      .from('table_sessions')
      .insert({ restaurant_id: restaurantId, table_id: tableId, pin, status: 'active' })
      .select('id')
      .single()

    if (!insertError && newSession) {
      return { exists: false, sessionId: newSession.id, tableNumber, pin }
    }

    // Lost the create race to a concurrent scan — the partial unique index
    // (one active session per table) rejected this INSERT with SQLSTATE 23505.
    // Re-read the winning session so this caller is asked for its PIN instead.
    if (insertError?.code !== '23505') throw new Error('Failed to create session')

    const { data: winner } = await adminSupabase
      .from('table_sessions')
      .select('id, pin, opened_at, pin_failed_attempts, pin_locked_until')
      .eq('table_id', tableId)
      .eq('status', 'active')
      .maybeSingle()
    if (!winner) throw new Error('Failed to create session')
    activeSession = winner
  }

  if (pinAttempt === undefined || pinAttempt === null || pinAttempt === '') {
    return { exists: true, requiresPin: true }
  }

  // Throws 'Incorrect PIN' on mismatch, or a lockout message after too many tries.
  await verifyPinWithLockout(activeSession, String(pinAttempt))
  return { exists: true, sessionId: activeSession.id, tableNumber, pin: activeSession.pin }
}

export async function placeOrder({
  sessionId,
  customerId,
  restaurantId,
  items,
}: {
  sessionId: string
  customerId: string
  restaurantId: string
  items: { dishId: string; quantity: number }[]
}): Promise<{ orderId: string; roundNumber: number }> {
  if (!sessionId || !customerId || !restaurantId || !items?.length) {
    throw new Error('sessionId, customerId, restaurantId, and items are required')
  }

  // Validate client-supplied quantities BEFORE anything else. Without this a
  // caller could POST a negative quantity (→ negative bill line, lowering the
  // total) or an absurd quantity. Require positive integers with a sane cap.
  for (const item of items) {
    if (!Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 99) {
      throw new Error('Item quantity must be a whole number between 1 and 99')
    }
  }

  // Verify the target session actually exists, belongs to this restaurant, and
  // is still ACTIVE. Prevents injecting orders into another table's session, a
  // closed session, or one whose bill was already generated.
  const { data: sessionRow, error: sessionRowError } = await adminSupabase
    .from('table_sessions')
    .select('id, status, restaurant_id')
    .eq('id', sessionId)
    .maybeSingle()
  if (sessionRowError || !sessionRow) throw new Error('Session not found')
  if (sessionRow.restaurant_id !== restaurantId) {
    throw new Error('Session does not belong to this restaurant')
  }
  if (sessionRow.status !== 'active') {
    throw new Error('This table is not currently accepting orders')
  }

  // Snapshot dish name + price at order time.
  // Use the public anon client — dishes are public-readable via RLS, no service-role needed.
  const dishIds = items.map((i) => i.dishId)
  const { data: dishes, error: dishError } = await supabase
    .from('dishes')
    .select('id, name_en, price, is_available')
    .in('id', dishIds)
  if (dishError || !dishes?.length) throw new Error('Failed to fetch dish details')

  const dishMap = new Map(dishes.map((d) => [d.id, d]))

  // Validate ALL dish IDs before any insert — prevents orphaned orders rows.
  // If any dishId is absent from the DB result, throw here before touching orders.
  const validatedItems = items.map((item) => {
    const dish = dishMap.get(item.dishId)
    if (!dish) throw new Error(`Dish ${item.dishId} not found`)
    // Never let an unavailable dish be ordered, even if the client sends its id.
    if (!dish.is_available) throw new Error(`${dish.name_en} is no longer available`)
    return {
      dish_id: item.dishId,
      name: dish.name_en,
      price: dish.price,
      quantity: item.quantity,
    }
  })

  // Compute round number: max existing round for this session + 1
  const { data: lastOrder } = await adminSupabase
    .from('orders')
    .select('round_number')
    .eq('session_id', sessionId)
    .order('round_number', { ascending: false })
    .limit(1)
    .maybeSingle()
  const roundNumber = (lastOrder?.round_number ?? 0) + 1

  // Insert order — all dishes validated above, no orphan risk remains.
  // Status must be explicit; do not rely on column default.
  const { data: order, error: orderError } = await adminSupabase
    .from('orders')
    .insert({ session_id: sessionId, customer_id: customerId, round_number: roundNumber, status: 'pending_approval' })
    .select('id')
    .single()
  if (orderError || !order) throw new Error('Failed to create order')

  // Attach order_id now that we have it, then persist all items.
  const orderItems = validatedItems.map((item) => ({ ...item, order_id: order.id }))

  const { error: itemsError } = await adminSupabase.from('order_items').insert(orderItems)
  if (itemsError) {
    // Best-effort rollback: delete the orphaned orders row so the admin queue
    // and round_number counter stay clean. Do not suppress the original error.
    await adminSupabase.from('orders').delete().eq('id', order.id)
    throw new Error('Failed to save order items')
  }

  return { orderId: order.id, roundNumber }
}

export type SessionOrder = {
  orderId: string
  roundNumber: number
  status: string
  placedAt: string
  items: { name: string; quantity: number; price: number }[]
}

export async function getOrdersForSession(sessionId: string): Promise<SessionOrder[]> {
  if (!sessionId) return []
  const { data, error } = await adminSupabase
    .from('orders')
    .select('id, round_number, status, placed_at, order_items(name, quantity, price)')
    .eq('session_id', sessionId)
    .neq('status', 'rejected')
    .order('round_number', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []).map((row: any) => ({
    orderId: row.id,
    roundNumber: row.round_number,
    status: row.status,
    placedAt: row.placed_at,
    items: (row.order_items as { name: string; quantity: number; price: number }[]) ?? [],
  }))
}

function formatTimeIST(value: string | Date): string {
  // Deterministic HH:MM in IST (UTC+5:30) — avoids toLocaleTimeString ICU
  // variance across Node.js builds, ensuring KOT/bill payloads always match
  // the print-bridge contract /^\d{2}:\d{2}$/.
  const d = new Date(value)
  const utcMs = d.getTime() + d.getTimezoneOffset() * 60000
  const istMs = utcMs + 5.5 * 3600000
  const ist = new Date(istMs)
  const hh = String(ist.getUTCHours()).padStart(2, '0')
  const mm = String(ist.getUTCMinutes()).padStart(2, '0')
  return `${hh}:${mm}`
}

export type SessionPrintContext = {
  restaurantId: string
  tableNumber: number | null
  orderType: 'dine_in' | 'parcel'
  tokenNumber: number | null
  customerName: string | null
}

/**
 * Everything a KOT header needs, for dine-in and parcel sessions alike.
 * A parcel session has no table_id — it is identified by its daily token
 * number — so the restaurant_tables lookup is skipped rather than throwing.
 */
async function getSessionPrintContext(sessionId: string): Promise<SessionPrintContext> {
  const { data: session, error } = await adminSupabase
    .from('table_sessions')
    .select('restaurant_id, table_id, session_type, token_number, host_name')
    .eq('id', sessionId)
    .single()
  if (error || !session) throw new Error('Session not found')

  let tableNumber: number | null = null
  if (session.table_id) {
    const { data: table, error: tableError } = await adminSupabase
      .from('restaurant_tables')
      .select('table_number')
      .eq('id', session.table_id)
      .single()
    if (tableError || !table) throw new Error('Table not found')
    tableNumber = table.table_number
  }

  const orderType = session.session_type === 'parcel' ? 'parcel' : 'dine_in'
  return {
    restaurantId: session.restaurant_id,
    tableNumber,
    orderType,
    tokenNumber: session.token_number ?? null,
    // Only parcels carry a name on the KOT — it is how the counter calls the
    // order out. Dine-in KOTs stay exactly as the kitchen already knows them.
    customerName: orderType === 'parcel' ? (session.host_name ?? null) : null,
  }
}

export async function approveOrder(
  orderId: string
): Promise<{ orderId: string; status: 'approved' }> {
  const user = await requireStaff()
  if (!orderId) throw new Error('orderId is required')

  // Load order + idempotency guard
  const { data: order, error: orderError } = await adminSupabase
    .from('orders')
    .select('id, status, round_number, session_id, placed_at')
    .eq('id', orderId)
    .single()
  if (orderError || !order) throw new Error('Order not found')

  // Idempotent no-op on double-tap; reject conflicting states so we never
  // create a second KOT or "approve" something already rejected/served.
  if (order.status === 'approved') return { orderId, status: 'approved' }
  if (order.status !== 'pending_approval') {
    throw new Error(`Cannot approve order in status '${order.status}'`)
  }

  // Resolve restaurant_id + table number (or parcel token) for the KOT header
  const ctx = await getSessionPrintContext(order.session_id)

  // Claim the order atomically: the update only lands if it is still
  // pending_approval. Two staff devices tapping Approve at once used to both
  // pass the status check above and both queue a KOT — this conditional
  // update makes the claim itself the serialization point, so only one wins.
  const { data: claimed, error: claimError } = await adminSupabase
    .from('orders')
    .update({ status: 'approved' })
    .eq('id', orderId)
    .eq('status', 'pending_approval')
    .select('id')
  if (claimError) throw new Error('Failed to approve order')
  if (!claimed?.length) {
    // Lost the race — reflect whatever the winner already left behind.
    const { data: current } = await adminSupabase.from('orders').select('status').eq('id', orderId).single()
    if (current?.status === 'approved') return { orderId, status: 'approved' }
    throw new Error(`Cannot approve order in status '${current?.status ?? 'unknown'}'`)
  }

  // Read items only AFTER the claim succeeds: staff can edit a pending
  // order's items right up until this instant (updateOrderItemQuantity
  // refuses a non-pending order), so the KOT always reflects the final state
  // rather than whatever was there when this call started.
  const { data: items, error: itemsError } = await adminSupabase
    .from('order_items')
    .select('name, quantity')
    .eq('order_id', orderId)
  if (itemsError || !items?.length) throw new Error('Order has no items')

  // approveOrder is the ONLY creator of a KOT print job
  const { error: printError } = await adminSupabase.from('print_jobs').insert({
    restaurant_id: ctx.restaurantId,
    type: 'kot',
    status: 'pending',
    payload: {
      tableNumber: ctx.tableNumber,
      orderType: ctx.orderType,
      tokenNumber: ctx.tokenNumber,
      customerName: ctx.customerName,
      roundNumber: order.round_number,
      time: formatTimeIST(order.placed_at),
      items: items.map((i) => ({ name: i.name, qty: i.quantity })),
    },
  })
  if (printError) throw new Error('Failed to queue KOT print job')

  await logActivity({
    restaurantId: ctx.restaurantId,
    actor: user,
    action: 'order_approved',
    sessionId: order.session_id,
    orderId,
    label: ctx.orderType === 'parcel' ? `Parcel #${ctx.tokenNumber ?? '?'}` : `Table ${ctx.tableNumber ?? '?'}`,
    details: { roundNumber: order.round_number },
  })

  return { orderId, status: 'approved' }
}

export async function rejectOrder(
  orderId: string
): Promise<{ orderId: string; status: 'rejected' }> {
  const user = await requireStaff()
  if (!orderId) throw new Error('orderId is required')

  const { data: order, error: orderError } = await adminSupabase
    .from('orders')
    .select('id, status, round_number, session_id')
    .eq('id', orderId)
    .single()
  if (orderError || !order) throw new Error('Order not found')

  // Idempotent no-op on double-tap; never creates a print job either way.
  if (order.status === 'rejected') return { orderId, status: 'rejected' }
  if (order.status !== 'pending_approval') {
    throw new Error(`Cannot reject order in status '${order.status}'`)
  }

  // Same conditional-claim pattern as approveOrder — a simultaneous
  // Approve/Reject tap on two devices now resolves to exactly one outcome
  // instead of a read-then-write race.
  const { data: claimed, error: claimError } = await adminSupabase
    .from('orders')
    .update({ status: 'rejected' })
    .eq('id', orderId)
    .eq('status', 'pending_approval')
    .select('id')
  if (claimError) throw new Error('Failed to reject order')
  if (!claimed?.length) {
    const { data: current } = await adminSupabase.from('orders').select('status').eq('id', orderId).single()
    if (current?.status === 'rejected') return { orderId, status: 'rejected' }
    throw new Error(`Cannot reject order in status '${current?.status ?? 'unknown'}'`)
  }

  // Best-effort: hand the guest their items back in the shared cart instead
  // of making them rebuild it from memory. Must never fail the rejection —
  // the order is already rejected regardless of whether this succeeds.
  await restoreRejectedItemsToCart(orderId, order.session_id).catch((e) => {
    console.error('[rejectOrder] cart restore failed', e)
  })

  const ctx = await getSessionLogContext(order.session_id)
  await logActivity({
    restaurantId: ctx.restaurantId,
    actor: user,
    action: 'order_rejected',
    sessionId: order.session_id,
    orderId,
    label: ctx.label,
    details: { roundNumber: order.round_number },
  })

  return { orderId, status: 'rejected' }
}

/**
 * Puts a rejected order's items back into the guest's shared cart so they
 * don't have to rebuild it from memory. Fires only AFTER rejection — the
 * cart still clears at placement time as before, avoiding the double-order
 * risk a "hold the cart open while pending" design has in shared mode
 * (another guest's phone could re-submit the same items, or merge new
 * round-2 adds into a cart that's really an old, still-pending round).
 * Restored rows use a synthetic device id since order_items carries no
 * per-guest attribution — they land as a distinct cart line rather than
 * silently inflating a live guest's own quantity.
 */
async function restoreRejectedItemsToCart(orderId: string, sessionId: string): Promise<void> {
  const { data: session } = await adminSupabase
    .from('table_sessions')
    .select('status')
    .eq('id', sessionId)
    .maybeSingle()
  // The table may have moved on (billed, closed) between placement and
  // rejection — don't hand items back into a session no longer taking orders.
  if (!session || session.status !== 'active') return

  const { data: items, error: itemsError } = await adminSupabase
    .from('order_items')
    .select('dish_id, name, price, quantity')
    .eq('order_id', orderId)
  if (itemsError || !items?.length) return

  const dishIds = [...new Set(items.map((i) => i.dish_id))]
  const { data: dishes } = await adminSupabase
    .from('dishes')
    .select('id, image_url, category, is_available')
    .in('id', dishIds)
  const dishMap = new Map((dishes ?? []).map((d) => [d.id, d]))

  const rows = items
    // A dish that went unavailable between order and rejection can't be
    // handed back — placeOrder would refuse it on the next attempt anyway.
    .filter((item) => dishMap.get(item.dish_id)?.is_available !== false)
    .map((item) => ({
      session_id: sessionId,
      dish_id: item.dish_id,
      name: item.name,
      price: item.price,
      image: normalizeImageUrl(dishMap.get(item.dish_id)?.image_url ?? null) || null,
      category: dishMap.get(item.dish_id)?.category ?? null,
      quantity: item.quantity,
      added_by_device_id: `restored:${orderId}`,
      added_by_name: 'Returned by staff',
    }))
  if (!rows.length) return

  await adminSupabase.from('session_cart_items').insert(rows)
}

export type PendingOrder = {
  id: string
  round_number: number
  placed_at: string
  customers: { name: string } | null
  // `id` is required here (not just name/quantity) so the incoming queue can
  // edit a pending order's items via updateOrderItemQuantity before Approve.
  order_items: { id: string; name: string; quantity: number }[]
  table_sessions: { restaurant_tables: { table_number: number } | null } | null
}

export async function getPendingOrders(): Promise<PendingOrder[]> {
  await requireStaff()
  const { data, error } = await adminSupabase
    .from('orders')
    .select(
      'id, round_number, placed_at, ' +
      'order_items(id, name, quantity), ' +
      'customers(name), ' +
      'table_sessions(restaurant_tables(table_number))'
    )
    .eq('status', 'pending_approval')
    .order('placed_at', { ascending: true })

  if (error) throw new Error(error.message)
  return (data as unknown as PendingOrder[]) ?? []
}

// ── Admin tables page server actions ────────────────────────────────────────

export async function getRestaurantId(slug: string): Promise<string | null> {
  await requireStaff()
  const { data } = await adminSupabase
    .from('restaurants')
    .select('id')
    .eq('slug', slug)
    .single()
  return data?.id ?? null
}

export type RawTableRow = {
  id: string
  table_number: number
  table_sessions: {
    id: string
    status: string
    opened_at: string
    host_name: string | null
    pin: string | null
    orders: {
      id: string
      round_number: number
      placed_at: string
      status: string
      customers: { name: string } | null
      order_items: { id: string; name: string; quantity: number; price: number }[]
    }[]
  }[]
}

export async function getTablesWithSessions(restaurantId: string): Promise<RawTableRow[]> {
  await requireStaff()
  const { data, error } = await adminSupabase
    .from('restaurant_tables')
    .select(`
      id, table_number,
      table_sessions(
        id, status, opened_at, host_name, pin,
        orders(
          id, round_number, placed_at, status,
          customers(name),
          order_items(id, name, quantity, price)
        )
      )
    `)
    .eq('restaurant_id', restaurantId)
    .order('table_number')
  if (error) throw new Error(error.message)
  return (data as unknown as RawTableRow[]) ?? []
}

export type DailyBillsSummary = {
  billedToday: number
  servedToday: number
}

export async function getDailyBillsSummary(restaurantId: string): Promise<DailyBillsSummary> {
  // Revenue figure — admins only. Captains are blocked (they call the table/order
  // actions, not this one), matching the customers/bills RLS restriction.
  await requireAdmin()
  const now = new Date()
  const istNow = new Date(now.getTime() + 5.5 * 60 * 60 * 1000)
  const d = istNow.toISOString().slice(0, 10)
  const start = `${d}T00:00:00+05:30`
  const end = `${d}T23:59:59+05:30`

  const { data: bills } = await adminSupabase
    .from('bills')
    .select('total, generated_at, table_sessions!inner(restaurant_id)')
    .eq('table_sessions.restaurant_id', restaurantId)
    .gte('generated_at', start)
    .lte('generated_at', end)

  const rows = bills ?? []
  return {
    billedToday: rows.reduce((s: number, b: any) => s + (b.total ?? 0), 0),
    servedToday: rows.length,
  }
}

// ── Revenue analytics (settled bills only) ──────────────────────────────────
// Money is only counted once the captain settles the bill — `settleBill` stamps
// `payment_method` + `settled_at`. A bill that has merely been generated and
// printed is reported separately as "awaiting settlement" and is NOT revenue,
// so the dashboard can never book cash that was not actually taken.

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000

/** "YYYY-MM-DD" of an instant, as seen in IST. */
function istDayKey(value: string | Date): string {
  const d = typeof value === 'string' ? new Date(value) : value
  return new Date(d.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10)
}

/** UTC instant of IST midnight starting the given IST day. */
function istDayStart(dayKey: string): Date {
  return new Date(`${dayKey}T00:00:00+05:30`)
}

function istDayLabel(dayKey: string): string {
  return istDayStart(dayKey).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    timeZone: 'Asia/Kolkata',
  })
}

export type SettledBillRow = {
  billId: string
  label: string
  customerName: string | null
  paymentMethod: PaymentMethod | null
  subtotal: number
  gstAmount: number
  total: number
  settledAt: string
}

export type RevenueAnalytics = {
  date: string
  rangeDays: number
  /** Selected day, settled bills only */
  revenue: number
  netSales: number
  gstCollected: number
  billCount: number
  avgBill: number
  itemsSold: number
  /** Generated but not yet settled on the selected day — excluded from revenue */
  pendingAmount: number
  pendingCount: number
  byPaymentMethod: { method: PaymentMethod; amount: number; count: number }[]
  trend: { key: string; label: string; revenue: number; bills: number }[]
  rangeRevenue: number
  rangeBillCount: number
  monthRevenue: number
  monthBillCount: number
  monthLabel: string
  topDishes: { name: string; qty: number; revenue: number }[]
  bills: SettledBillRow[]
}

type SettledBillQueryRow = {
  id: string
  session_id: string | null
  subtotal: number | string
  gst_amount: number | string
  total: number | string
  payment_method: string | null
  settled_at: string
  table_sessions: {
    session_type: string | null
    token_number: number | null
    host_name: string | null
    restaurant_tables: { table_number: number } | null
  } | null
}

const SETTLED_BILL_SELECT = `
  id, session_id, subtotal, gst_amount, total, payment_method, settled_at,
  table_sessions!inner(
    restaurant_id, session_type, token_number, host_name,
    restaurant_tables(table_number)
  )
`

function billLabel(session: SettledBillQueryRow['table_sessions']): string {
  if (!session) return 'Unknown'
  if (session.session_type === 'parcel') {
    return session.token_number ? `Parcel #${session.token_number}` : 'Parcel'
  }
  const tableNumber = session.restaurant_tables?.table_number
  return tableNumber ? `Table ${tableNumber}` : 'Table'
}

/**
 * Settled-revenue dashboard for /admin/analytics. Reads with the service-role
 * client (admins only) and aggregates in JS so a single bills query serves the
 * day tiles, the trend chart and the month-to-date figure.
 */
export async function getRevenueAnalytics({
  restaurantId,
  date,
  rangeDays = 7,
}: {
  restaurantId: string
  date?: string
  rangeDays?: number
}): Promise<RevenueAnalytics> {
  await requireAdmin()
  if (!restaurantId) throw new Error('restaurantId is required')

  const safeRange = Math.max(1, Math.min(90, Math.floor(Number(rangeDays) || 7)))
  const dayKey = /^\d{4}-\d{2}-\d{2}$/.test(date ?? '') ? (date as string) : istDayKey(new Date())

  const dayStart = istDayStart(dayKey)
  const dayEnd = new Date(dayStart.getTime() + DAY_MS)
  const rangeStart = new Date(dayStart.getTime() - (safeRange - 1) * DAY_MS)
  const monthStart = istDayStart(`${dayKey.slice(0, 7)}-01`)
  // One query covers day + trend range + month-to-date.
  const fetchStart = new Date(Math.min(rangeStart.getTime(), monthStart.getTime()))

  const [settledRes, pendingRes] = await Promise.all([
    adminSupabase
      .from('bills')
      .select(SETTLED_BILL_SELECT)
      .eq('table_sessions.restaurant_id', restaurantId)
      .not('settled_at', 'is', null)
      .gte('settled_at', fetchStart.toISOString())
      .lt('settled_at', dayEnd.toISOString())
      .order('settled_at', { ascending: false }),
    adminSupabase
      .from('bills')
      .select('id, total, table_sessions!inner(restaurant_id)')
      .eq('table_sessions.restaurant_id', restaurantId)
      .is('settled_at', null)
      .gte('generated_at', dayStart.toISOString())
      .lt('generated_at', dayEnd.toISOString()),
  ])

  if (settledRes.error) throw new Error(settledRes.error.message)

  const settled = (settledRes.data ?? []) as unknown as SettledBillQueryRow[]
  const rangeStartMs = rangeStart.getTime()
  const monthStartMs = monthStart.getTime()

  const trendBuckets = new Map<string, { revenue: number; bills: number }>()
  for (let offset = safeRange - 1; offset >= 0; offset--) {
    trendBuckets.set(istDayKey(new Date(dayStart.getTime() - offset * DAY_MS)), { revenue: 0, bills: 0 })
  }

  const dayBills: SettledBillRow[] = []
  const methodTotals = new Map<PaymentMethod, { amount: number; count: number }>()
  let revenue = 0
  let netSales = 0
  let gstCollected = 0
  let rangeRevenue = 0
  let rangeBillCount = 0
  let monthRevenue = 0
  let monthBillCount = 0

  for (const row of settled) {
    const total = Number(row.total) || 0
    const settledMs = new Date(row.settled_at).getTime()
    const key = istDayKey(row.settled_at)

    const bucket = trendBuckets.get(key)
    if (bucket) {
      bucket.revenue += total
      bucket.bills += 1
    }
    if (settledMs >= rangeStartMs) {
      rangeRevenue += total
      rangeBillCount += 1
    }
    if (settledMs >= monthStartMs) {
      monthRevenue += total
      monthBillCount += 1
    }
    if (key !== dayKey) continue

    revenue += total
    netSales += Number(row.subtotal) || 0
    gstCollected += Number(row.gst_amount) || 0

    const method = (row.payment_method as PaymentMethod) ?? null
    if (method) {
      const entry = methodTotals.get(method) ?? { amount: 0, count: 0 }
      entry.amount += total
      entry.count += 1
      methodTotals.set(method, entry)
    }

    dayBills.push({
      billId: row.id,
      label: billLabel(row.table_sessions),
      customerName: row.table_sessions?.host_name ?? null,
      paymentMethod: method,
      subtotal: Number(row.subtotal) || 0,
      gstAmount: Number(row.gst_amount) || 0,
      total,
      settledAt: row.settled_at,
    })
  }

  // Dish mix for the day — items from every non-rejected round of the settled sessions.
  const sessionIds = Array.from(
    new Set(settled.filter((r) => istDayKey(r.settled_at) === dayKey && r.session_id).map((r) => r.session_id as string))
  )
  const dishTotals = new Map<string, { qty: number; revenue: number }>()
  let itemsSold = 0

  if (sessionIds.length) {
    const { data: orders, error: ordersError } = await adminSupabase
      .from('orders')
      .select('id, session_id, status, order_items(name, quantity, price)')
      .in('session_id', sessionIds)
      .neq('status', 'rejected')
    if (ordersError) throw new Error(ordersError.message)

    for (const order of (orders ?? []) as any[]) {
      for (const item of order.order_items ?? []) {
        const qty = Number(item.quantity) || 0
        const name = item.name || 'Unknown item'
        const entry = dishTotals.get(name) ?? { qty: 0, revenue: 0 }
        entry.qty += qty
        entry.revenue += qty * (Number(item.price) || 0)
        dishTotals.set(name, entry)
        itemsSold += qty
      }
    }
  }

  const pendingRows = (pendingRes.data ?? []) as any[]

  return {
    date: dayKey,
    rangeDays: safeRange,
    revenue,
    netSales,
    gstCollected,
    billCount: dayBills.length,
    avgBill: dayBills.length ? revenue / dayBills.length : 0,
    itemsSold,
    pendingAmount: pendingRows.reduce((s, b) => s + (Number(b.total) || 0), 0),
    pendingCount: pendingRows.length,
    byPaymentMethod: (['cash', 'upi', 'card', 'other'] as PaymentMethod[])
      .map((method) => ({ method, ...(methodTotals.get(method) ?? { amount: 0, count: 0 }) }))
      .filter((entry) => entry.count > 0),
    trend: Array.from(trendBuckets.entries()).map(([key, value]) => ({
      key,
      label: istDayLabel(key),
      revenue: value.revenue,
      bills: value.bills,
    })),
    rangeRevenue,
    rangeBillCount,
    monthRevenue,
    monthBillCount,
    monthLabel: istDayStart(dayKey).toLocaleDateString('en-IN', {
      month: 'long',
      year: 'numeric',
      timeZone: 'Asia/Kolkata',
    }),
    topDishes: Array.from(dishTotals.entries())
      .map(([name, value]) => ({ name, qty: value.qty, revenue: value.revenue }))
      .sort((a, b) => b.revenue - a.revenue || b.qty - a.qty)
      .slice(0, 8),
    bills: dayBills,
  }
}

// ── Order history (billed sessions) ─────────────────────────────────────────
// A session enters history the moment its bill exists: `generateBill` inserts
// the row and `settleBill` stamps payment onto it later. Both states are
// listed — a bill that was printed but never settled is still an order that
// happened, it just has no money against it yet — so the range filter keys off
// `generated_at`, not `settled_at`. That also keeps a late bill settled after
// midnight on the service day it was actually served.

export type OrderHistoryStatus = 'settled' | 'unsettled'

export type OrderHistoryEntry = {
  billId: string
  sessionId: string | null
  /** "Table 6" / "Parcel #7" */
  label: string
  orderType: 'dine_in' | 'parcel'
  customerName: string | null
  subtotal: number
  gstAmount: number
  total: number
  paymentMethod: PaymentMethod | null
  generatedAt: string
  settledAt: string | null
  status: OrderHistoryStatus
}

export type OrderHistoryResult = {
  from: string
  to: string
  entries: OrderHistoryEntry[]
  settledTotal: number
  settledCount: number
  unsettledTotal: number
  unsettledCount: number
  /** True when the range held more bills than the row cap. */
  truncated: boolean
}

// A month of a busy service stays well under this; the cap only exists so a
// wide custom range can never pull an unbounded result set into the browser.
const HISTORY_ROW_LIMIT = 500

const HISTORY_BILL_SELECT = `
  id, session_id, subtotal, gst_amount, total, payment_method, generated_at, settled_at,
  table_sessions!inner(
    restaurant_id, session_type, token_number, host_name,
    restaurant_tables(table_number)
  )
`

type HistoryBillQueryRow = {
  id: string
  session_id: string | null
  subtotal: number | string
  gst_amount: number | string
  total: number | string
  payment_method: string | null
  generated_at: string
  settled_at: string | null
  table_sessions: SettledBillQueryRow['table_sessions']
}

/**
 * Billed orders in an IST day range, newest first — the data behind the
 * History tab on both the admin and the captain panel.
 *
 * Guarded by `requireStaff()`, not `requireAdmin()`: the captain is the one who
 * prints and settles these bills at the counter, so the per-bill totals are
 * already in their hands. Aggregate revenue *analytics* stay admin-only.
 */
export async function getOrderHistory({
  restaurantId,
  from,
  to,
}: {
  restaurantId: string
  from?: string
  to?: string
}): Promise<OrderHistoryResult> {
  await requireStaff()
  if (!restaurantId) throw new Error('restaurantId is required')

  const isDayKey = (value?: string) => /^\d{4}-\d{2}-\d{2}$/.test(value ?? '')
  const rawTo = isDayKey(to) ? (to as string) : istDayKey(new Date())
  const rawFrom = isDayKey(from) ? (from as string) : rawTo
  const fromKey = rawFrom <= rawTo ? rawFrom : rawTo
  const toKey = rawFrom <= rawTo ? rawTo : rawFrom

  const rangeStart = istDayStart(fromKey)
  const rangeEnd = new Date(istDayStart(toKey).getTime() + DAY_MS)

  const { data, error } = await adminSupabase
    .from('bills')
    .select(HISTORY_BILL_SELECT)
    .eq('table_sessions.restaurant_id', restaurantId)
    .gte('generated_at', rangeStart.toISOString())
    .lt('generated_at', rangeEnd.toISOString())
    .order('generated_at', { ascending: false })
    .limit(HISTORY_ROW_LIMIT + 1)
  if (error) throw new Error(error.message)

  const rows = (data ?? []) as unknown as HistoryBillQueryRow[]
  const truncated = rows.length > HISTORY_ROW_LIMIT

  const entries: OrderHistoryEntry[] = rows.slice(0, HISTORY_ROW_LIMIT).map((row) => ({
    billId: row.id,
    sessionId: row.session_id,
    label: billLabel(row.table_sessions),
    orderType: row.table_sessions?.session_type === 'parcel' ? 'parcel' : 'dine_in',
    customerName: row.table_sessions?.host_name ?? null,
    subtotal: Number(row.subtotal) || 0,
    gstAmount: Number(row.gst_amount) || 0,
    total: Number(row.total) || 0,
    paymentMethod: (row.payment_method as PaymentMethod) ?? null,
    generatedAt: row.generated_at,
    settledAt: row.settled_at,
    status: row.settled_at ? 'settled' : 'unsettled',
  }))

  let settledTotal = 0
  let settledCount = 0
  let unsettledTotal = 0
  let unsettledCount = 0
  for (const entry of entries) {
    if (entry.status === 'settled') {
      settledTotal += entry.total
      settledCount += 1
    } else {
      unsettledTotal += entry.total
      unsettledCount += 1
    }
  }

  return {
    from: fromKey,
    to: toKey,
    entries,
    settledTotal,
    settledCount,
    unsettledTotal,
    unsettledCount,
    truncated,
  }
}

export type OrderHistoryRound = {
  orderId: string
  roundNumber: number
  placedAt: string
  status: string
  customerName: string | null
  items: { id: string; name: string; quantity: number; price: number }[]
  roundTotal: number
}

/**
 * Every non-rejected round of one billed session — the KOT breakdown behind a
 * single history row. Fetched on demand when a row is opened rather than
 * joined into `getOrderHistory`, so a month-wide list stays a single light query.
 */
export async function getOrderHistoryDetail(sessionId: string): Promise<OrderHistoryRound[]> {
  await requireStaff()
  if (!sessionId) return []

  const { data, error } = await adminSupabase
    .from('orders')
    .select('id, round_number, placed_at, status, customers(name), order_items(id, name, quantity, price)')
    .eq('session_id', sessionId)
    .neq('status', 'rejected')
    .order('round_number', { ascending: true })
  if (error) throw new Error(error.message)

  return (data ?? []).map((row: any) => {
    const items = (row.order_items ?? []) as OrderHistoryRound['items']
    return {
      orderId: row.id,
      roundNumber: row.round_number,
      placedAt: row.placed_at,
      status: row.status,
      customerName: row.customers?.name ?? null,
      items,
      roundTotal: items.reduce((sum, item) => sum + (Number(item.price) || 0) * (Number(item.quantity) || 0), 0),
    }
  })
}

export async function closeTable(sessionId: string): Promise<void> {
  await requireStaff()
  if (!sessionId) throw new Error('sessionId is required')
  const { error } = await adminSupabase
    .from('table_sessions')
    .update({ status: 'closed', closed_at: new Date().toISOString() })
    .eq('id', sessionId)
  if (error) throw new Error(error.message)
}

// Table-level force reset: closes every live session on the table (including
// hidden pending-only sessions that the grid shows as "open") and clears their
// shared carts. No-op if the table has no live session.
export async function forceResetTableById(tableId: string): Promise<void> {
  // Discards live sessions with no bill — staff only, and every discard is
  // logged with the ₹ it walked away from.
  const user = await requireStaff()
  if (!tableId) throw new Error('tableId is required')
  const { data: sessions, error } = await adminSupabase
    .from('table_sessions')
    .select('id, restaurant_id, restaurant_tables(table_number)')
    .eq('table_id', tableId)
    .in('status', ['active', 'bill_generated'])
  if (error) throw new Error(error.message)
  if (!sessions?.length) return

  const sessionIds = sessions.map((s) => s.id)
  const { error: closeError } = await adminSupabase
    .from('table_sessions')
    .update({ status: 'closed', closed_at: new Date().toISOString() })
    .in('id', sessionIds)
  if (closeError) throw new Error(closeError.message)
  await adminSupabase
    .from('session_cart_items')
    .delete()
    .in('session_id', sessionIds)

  const logEntries: ActivityLogInsert[] = []
  for (const session of sessions) {
    const table = session.restaurant_tables as unknown as { table_number: number } | null
    const discarded = await sessionDiscardedTotal(session.id)
    logEntries.push({
      restaurantId: session.restaurant_id,
      actor: user,
      action: 'force_reset',
      sessionId: session.id,
      label: table ? `Table ${table.table_number}` : null,
      amountDelta: discarded !== null && discarded > 0 ? -discarded : null,
      details: discarded === null ? { amountUnknown: true } : null,
    })
  }
  await logActivity(logEntries)
}

export async function forceResetTable(sessionId: string): Promise<void> {
  const user = await requireStaff()
  if (!sessionId) throw new Error('sessionId is required')
  const ctx = await getSessionLogContext(sessionId)
  const discarded = await sessionDiscardedTotal(sessionId)
  await adminSupabase
    .from('table_sessions')
    .update({ status: 'closed', closed_at: new Date().toISOString() })
    .eq('id', sessionId)
  await adminSupabase
    .from('session_cart_items')
    .delete()
    .eq('session_id', sessionId)

  await logActivity({
    restaurantId: ctx.restaurantId,
    actor: user,
    action: 'force_reset',
    sessionId,
    label: ctx.label,
    amountDelta: discarded !== null && discarded > 0 ? -discarded : null,
    details: discarded === null ? { amountUnknown: true } : null,
  })
}

type BillPayload = {
  restaurantName: string
  address: string
  gstin: string
  upiId: string
  tableNumber: number | null
  orderType: 'dine_in' | 'parcel'
  tokenNumber: number | null
  customerName: string
  rounds: { number: number; time: string; items: { name: string; qty: number; price: number }[] }[]
  subtotal: number
  gstRate: number
  gstAmount: number
  total: number
}

// Columns generateBill / reprintBill must select for computeBillForSession.
const BILL_SESSION_COLUMNS = 'id, status, restaurant_id, table_id, session_type, token_number, host_name'

// Shared by generateBill (first print) and reprintBill (after captain edits):
// aggregates the session's non-rejected rounds into the print-bridge payload.
async function computeBillForSession(session: {
  id: string
  restaurant_id: string
  table_id: string | null
  session_type?: string | null
  token_number?: number | null
  host_name?: string | null
}): Promise<{ payload: BillPayload; subtotal: number; gstAmount: number; total: number }> {
  const sessionId = session.id

  // Billable orders only — rejected never appears on the bill
  const { data: orders, error: ordersError } = await adminSupabase
    .from('orders')
    .select('id, round_number, placed_at, customer_id')
    .eq('session_id', sessionId)
    .neq('status', 'rejected')
    .order('round_number', { ascending: true })
  if (ordersError) throw new Error('Failed to load orders')
  if (!orders?.length) throw new Error('No billable orders for this session')

  const orderIds = orders.map((o) => o.id)
  const { data: items, error: itemsError } = await adminSupabase
    .from('order_items')
    .select('order_id, name, price, quantity')
    .in('order_id', orderIds)
  if (itemsError) throw new Error('Failed to load order items')
  if (!items?.length) throw new Error('No items to bill')

  // Group items by their parent order's round
  const orderById = new Map(orders.map((o) => [o.id, o]))
  const roundsMap = new Map<
    number,
    { number: number; time: string; items: { name: string; qty: number; price: number }[] }
  >()
  let subtotal = 0
  for (const item of items) {
    const parent = orderById.get(item.order_id)
    if (!parent) continue
    const round = parent.round_number
    if (!roundsMap.has(round)) {
      roundsMap.set(round, {
        number: round,
        time: formatTimeIST(parent.placed_at),
        items: [],
      })
    }
    roundsMap.get(round)!.items.push({
      name: item.name,
      qty: item.quantity,
      price: Number(item.price),
    })
    subtotal += Number(item.price) * item.quantity
  }
  const rounds = Array.from(roundsMap.values()).sort((a, b) => a.number - b.number)

  const gstRate = 5
  const gstAmount = Math.round(subtotal * gstRate) / 100
  const total = subtotal + gstAmount

  // Customer name = most recent order's customer. Parcel rounds are punched by
  // the captain and carry no customer row, so fall back to the name captured
  // when the parcel was opened.
  const latestOrder = [...orders].sort(
    (a, b) => new Date(b.placed_at).getTime() - new Date(a.placed_at).getTime()
  )[0]
  let customerName = ''
  if (latestOrder?.customer_id) {
    const { data: customer } = await adminSupabase
      .from('customers')
      .select('name')
      .eq('id', latestOrder.customer_id)
      .maybeSingle()
    customerName = customer?.name ?? ''
  }
  if (!customerName) customerName = session.host_name ?? ''

  const { data: restaurant } = await adminSupabase
    .from('restaurants')
    .select('name, address, gstin, upi_id')
    .eq('id', session.restaurant_id)
    .maybeSingle()

  // Parcel sessions have no table — the token number identifies them instead.
  let tableNumber: number | null = null
  if (session.table_id) {
    const { data: table } = await adminSupabase
      .from('restaurant_tables')
      .select('table_number')
      .eq('id', session.table_id)
      .maybeSingle()
    tableNumber = table?.table_number ?? null
  }

  return {
    payload: {
      restaurantName: restaurant?.name ?? '',
      address: restaurant?.address ?? '',
      gstin: restaurant?.gstin ?? '',
      upiId: restaurant?.upi_id ?? '',
      tableNumber,
      orderType: session.session_type === 'parcel' ? 'parcel' : 'dine_in',
      tokenNumber: session.token_number ?? null,
      customerName,
      rounds,
      subtotal,
      gstRate,
      gstAmount,
      total,
    },
    subtotal,
    gstAmount,
    total,
  }
}

export async function generateBill({
  sessionId,
}: {
  sessionId: string
}): Promise<{ billId: string; total: number }> {
  if (!sessionId) throw new Error('sessionId is required')

  // Load session + restaurant + table for the bill header
  const { data: session, error: sessionError } = await adminSupabase
    .from('table_sessions')
    .select(BILL_SESSION_COLUMNS)
    .eq('id', sessionId)
    .single<{
      id: string
      status: string
      restaurant_id: string
      table_id: string | null
      session_type: string | null
      token_number: number | null
      host_name: string | null
    }>()
  if (sessionError || !session) throw new Error('Session not found')
  if (session.status === 'closed') throw new Error('Session is closed')

  // Guard: if already billed, return the existing bill (no duplicate rows/jobs).
  // Use reprintBill to print a billed session again.
  if (session.status === 'bill_generated') {
    const { data: existing } = await adminSupabase
      .from('bills')
      .select('id, total')
      .eq('session_id', sessionId)
      .order('generated_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (existing) return { billId: existing.id, total: Number(existing.total) }
  }

  const { payload, subtotal, gstAmount, total } = await computeBillForSession(session)

  // Persist the bill
  const { data: bill, error: billError } = await adminSupabase
    .from('bills')
    .insert({ session_id: sessionId, subtotal, gst_amount: gstAmount, total })
    .select('id')
    .single()
  if (billError || !bill) throw new Error('Failed to create bill')

  // Queue the bill print job
  const { error: printError } = await adminSupabase.from('print_jobs').insert({
    restaurant_id: session.restaurant_id,
    type: 'bill',
    status: 'pending',
    payload,
  })
  if (printError) throw new Error('Failed to queue bill print job')

  // Flip the session
  const { error: sessionUpdateError } = await adminSupabase
    .from('table_sessions')
    .update({ status: 'bill_generated' })
    .eq('id', sessionId)
  if (sessionUpdateError) throw new Error('Failed to update session status')

  // Guests trigger this too (Request Bill) — actor null logs as 'guest'.
  await logActivity({
    restaurantId: session.restaurant_id,
    actor: await getOptionalUser(),
    action: 'bill_printed',
    sessionId,
    label:
      payload.orderType === 'parcel'
        ? `Parcel #${payload.tokenNumber ?? '?'}`
        : `Table ${payload.tableNumber ?? '?'}`,
    details: { total },
  })

  return { billId: bill.id, total }
}

/**
 * Reprints the bill for an already-billed session. Recomputes totals from the
 * session's CURRENT items (the captain may have edited quantities or added a
 * round after the first print), updates the existing bills row in place —
 * never inserts a second row, so daily reports stay accurate — and queues a
 * fresh bill print job. Blocked once the bill is settled.
 */
export async function reprintBill({
  sessionId,
}: {
  sessionId: string
}): Promise<{ billId: string; total: number }> {
  const user = await requireStaff()
  if (!sessionId) throw new Error('sessionId is required')

  const { data: session, error: sessionError } = await adminSupabase
    .from('table_sessions')
    .select(BILL_SESSION_COLUMNS)
    .eq('id', sessionId)
    .single<{
      id: string
      status: string
      restaurant_id: string
      table_id: string | null
      session_type: string | null
      token_number: number | null
      host_name: string | null
    }>()
  if (sessionError || !session) throw new Error('Session not found')
  if (session.status === 'closed') throw new Error('Session is closed — cannot reprint bill')

  const { data: bill, error: billError } = await adminSupabase
    .from('bills')
    .select('id, settled_at')
    .eq('session_id', sessionId)
    .order('generated_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (billError) throw new Error(billError.message)
  if (!bill) throw new Error('No bill found — generate the bill first')
  if (bill.settled_at) throw new Error('Bill already settled — cannot reprint')

  const { payload, subtotal, gstAmount, total } = await computeBillForSession(session)

  const { error: updateError } = await adminSupabase
    .from('bills')
    .update({ subtotal, gst_amount: gstAmount, total })
    .eq('id', bill.id)
  if (updateError) throw new Error('Failed to update bill')

  const { error: printError } = await adminSupabase.from('print_jobs').insert({
    restaurant_id: session.restaurant_id,
    type: 'bill',
    status: 'pending',
    payload,
  })
  if (printError) throw new Error('Failed to queue bill print job')

  await logActivity({
    restaurantId: session.restaurant_id,
    actor: user,
    action: 'bill_reprinted',
    sessionId,
    label:
      payload.orderType === 'parcel'
        ? `Parcel #${payload.tokenNumber ?? '?'}`
        : `Table ${payload.tableNumber ?? '?'}`,
    details: { total },
  })

  return { billId: bill.id, total }
}

// ── Captain panel server actions (C01) ──────────────────────────────────────

export type PaymentMethod = 'cash' | 'upi' | 'card' | 'other'

/**
 * Stamps the latest bill of a session with the payment method and closes the
 * table. Requires a bill to exist — call generateBill first.
 */
export async function settleBill({
  sessionId,
  paymentMethod,
}: {
  sessionId: string
  paymentMethod: PaymentMethod
}): Promise<{ billId: string; total: number }> {
  const user = await requireStaff()
  if (!sessionId) throw new Error('sessionId is required')
  if (!['cash', 'upi', 'card', 'other'].includes(paymentMethod)) {
    throw new Error('Invalid payment method')
  }

  const { data: bill, error: billError } = await adminSupabase
    .from('bills')
    .select('id, total, settled_at')
    .eq('session_id', sessionId)
    .order('generated_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (billError) throw new Error(billError.message)
  if (!bill) throw new Error('No bill found for this session — generate the bill first')

  // Idempotent: settling an already-settled bill just re-stamps the method
  const { error: settleError } = await adminSupabase
    .from('bills')
    .update({ payment_method: paymentMethod, settled_at: new Date().toISOString() })
    .eq('id', bill.id)
  if (settleError) throw new Error('Failed to settle bill')

  const { error: closeError } = await adminSupabase
    .from('table_sessions')
    .update({ status: 'closed', closed_at: new Date().toISOString() })
    .eq('id', sessionId)
  if (closeError) throw new Error('Bill settled but failed to close table')

  const ctx = await getSessionLogContext(sessionId)
  await logActivity({
    restaurantId: ctx.restaurantId,
    actor: user,
    action: 'bill_settled',
    sessionId,
    label: ctx.label,
    details: { paymentMethod, total: Number(bill.total) },
  })

  return { billId: bill.id, total: Number(bill.total) }
}

export type SessionBill = {
  billId: string
  subtotal: number
  gstAmount: number
  total: number
  paymentMethod: PaymentMethod | null
  settledAt: string | null
}

/** Latest bill for a session, or null if none generated yet. */
export async function getSessionBill(sessionId: string): Promise<SessionBill | null> {
  await requireStaff()
  if (!sessionId) throw new Error('sessionId is required')
  const { data, error } = await adminSupabase
    .from('bills')
    .select('id, subtotal, gst_amount, total, payment_method, settled_at')
    .eq('session_id', sessionId)
    .order('generated_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return null
  return {
    billId: data.id,
    subtotal: Number(data.subtotal),
    gstAmount: Number(data.gst_amount),
    total: Number(data.total),
    paymentMethod: (data.payment_method as PaymentMethod) ?? null,
    settledAt: data.settled_at,
  }
}

/**
 * Moves an active session (orders, cart, guests) to another table.
 * Fails if the target table already has an active/bill_generated session.
 */
export async function moveTableSession({
  sessionId,
  targetTableId,
}: {
  sessionId: string
  targetTableId: string
}): Promise<{ targetTableNumber: number }> {
  const user = await requireStaff()
  if (!sessionId) throw new Error('sessionId is required')
  if (!targetTableId) throw new Error('targetTableId is required')

  const { data: session, error: sessionError } = await adminSupabase
    .from('table_sessions')
    // restaurant_tables embed = the SOURCE table's number, for the log label
    .select('id, status, restaurant_id, table_id, session_type, restaurant_tables(table_number)')
    .eq('id', sessionId)
    .single()
  if (sessionError || !session) throw new Error('Session not found')
  if (session.status === 'closed') throw new Error('Cannot move a closed session')
  if (session.session_type === 'parcel') throw new Error('A parcel order has no table to move')
  if (session.table_id === targetTableId) throw new Error('Session is already on that table')

  const { data: target, error: targetError } = await adminSupabase
    .from('restaurant_tables')
    .select('id, table_number, restaurant_id')
    .eq('id', targetTableId)
    .single()
  if (targetError || !target) throw new Error('Target table not found')
  if (target.restaurant_id !== session.restaurant_id) {
    throw new Error('Target table belongs to a different restaurant')
  }

  const { data: occupied, error: occupiedError } = await adminSupabase
    .from('table_sessions')
    .select('id')
    .eq('table_id', targetTableId)
    .in('status', ['active', 'bill_generated'])
    .limit(1)
    .maybeSingle()
  if (occupiedError) throw new Error(occupiedError.message)
  if (occupied) throw new Error(`Table ${target.table_number} is already occupied`)

  // Source label resolved before the move overwrites table_id.
  const sourceTable = session.restaurant_tables as unknown as { table_number: number } | null

  const { error: moveError } = await adminSupabase
    .from('table_sessions')
    .update({ table_id: targetTableId })
    .eq('id', sessionId)
  if (moveError) throw new Error('Failed to move table')

  await logActivity({
    restaurantId: session.restaurant_id,
    actor: user,
    action: 'table_moved',
    sessionId,
    label: sourceTable ? `Table ${sourceTable.table_number}` : null,
    details: { toTable: target.table_number },
  })

  return { targetTableNumber: target.table_number }
}

/**
 * Re-queues the KOT print job for an already-approved order (e.g. printer
 * jam, kitchen lost the slip). Never changes order status.
 */
export async function reprintKot(orderId: string): Promise<void> {
  await requireStaff()
  if (!orderId) throw new Error('orderId is required')

  const { data: order, error: orderError } = await adminSupabase
    .from('orders')
    .select('id, status, round_number, session_id, placed_at')
    .eq('id', orderId)
    .single()
  if (orderError || !order) throw new Error('Order not found')
  if (order.status !== 'approved' && order.status !== 'served') {
    throw new Error('Only approved orders can be reprinted')
  }

  const ctx = await getSessionPrintContext(order.session_id)

  const { data: items } = await adminSupabase
    .from('order_items')
    .select('name, quantity')
    .eq('order_id', orderId)
  if (!items?.length) throw new Error('Order has no items')

  const { error: printError } = await adminSupabase.from('print_jobs').insert({
    restaurant_id: ctx.restaurantId,
    type: 'kot',
    status: 'pending',
    payload: {
      tableNumber: ctx.tableNumber,
      orderType: ctx.orderType,
      tokenNumber: ctx.tokenNumber,
      customerName: ctx.customerName,
      roundNumber: order.round_number,
      time: formatTimeIST(order.placed_at),
      items: items.map((i) => ({ name: i.name, qty: i.quantity })),
    },
  })
  if (printError) throw new Error('Failed to queue KOT print job')
}

/**
 * Captain bill edit: change the quantity of an order item (e.g. wrongly
 * punched, or guest cancels one). Quantity 0 removes the item. Allowed while
 * the session is active OR bill_generated — after editing a printed bill the
 * captain must call reprintBill so the printed total matches. Blocked once
 * the session is closed.
 */
// Derived from the UI's reason list so the server can never reject a reason
// the RemoveReasonDialog just offered.
const REMOVAL_REASON_VALUES = Object.keys(REMOVAL_REASONS) as RemovalReason[]

export async function updateOrderItemQuantity({
  orderItemId,
  quantity,
  reason,
}: {
  orderItemId: string
  quantity: number
  /** Required when quantity is 0 — lands in the activity log. */
  reason?: RemovalReason
}): Promise<void> {
  const user = await requireStaff()
  const role = staffRole(user)
  if (!orderItemId) throw new Error('orderItemId is required')
  if (!Number.isInteger(quantity) || quantity < 0 || quantity > 99) {
    throw new Error('Quantity must be between 0 and 99')
  }
  if (reason && !REMOVAL_REASON_VALUES.includes(reason)) {
    throw new Error('Invalid removal reason')
  }

  const { data: item, error: itemError } = await adminSupabase
    .from('order_items')
    .select(`
      id, name, price, quantity, order_id,
      orders(
        id, status, session_id,
        table_sessions(status, restaurant_id, session_type, token_number, host_name, restaurant_tables(table_number))
      )
    `)
    .eq('id', orderItemId)
    .single()
  if (itemError || !item) throw new Error('Order item not found')

  const order = item.orders as unknown as {
    id: string
    status: string
    session_id: string
    table_sessions: {
      status: string
      restaurant_id: string
      session_type: string | null
      token_number: number | null
      host_name: string | null
      restaurant_tables: { table_number: number } | null
    } | null
  } | null
  if (!order) throw new Error('Parent order not found')
  if (order.status === 'rejected') throw new Error('Cannot edit a rejected order')
  const session = order.table_sessions
  if (session?.status === 'closed') {
    throw new Error('Session is closed — cannot edit items')
  }

  const currentQty = Number(item.quantity) || 0
  if (quantity === currentQty) return

  // Post-bill lockdown: once the bill is printed, a captain may only ADD.
  // A quantity increase rides the same trust as Add Item — the total can only
  // go up. Reducing or removing a billed item is the classic fraud vector,
  // so it takes an admin (who does it from /admin/history).
  if (session?.status === 'bill_generated' && role === 'captain' && quantity < currentQty) {
    throw new Error('Bill already printed — only an admin can reduce or remove items')
  }

  // Removals must say why; the reason is stored on the immutable log row.
  if (quantity === 0 && !reason) {
    throw new Error('A reason is required to remove an item')
  }

  if (quantity === 0) {
    // An order can never be emptied out to zero items via edit — a pending
    // order with no items would jam getPendingOrders (approveOrder throws on
    // an empty order), and a served/billed order with no items makes no
    // sense either. The whole order/round has its own cancel path (Reject).
    const { count } = await adminSupabase
      .from('order_items')
      .select('id', { count: 'exact', head: true })
      .eq('order_id', order.id)
    if ((count ?? 0) <= 1) {
      throw new Error(
        order.status === 'pending_approval'
          ? 'Cannot remove the last item — reject the order instead'
          : 'Cannot remove the last item from an order'
      )
    }

    const { error } = await adminSupabase
      .from('order_items')
      .delete()
      .eq('id', orderItemId)
    if (error) throw new Error('Failed to remove item')
  } else {
    const { error } = await adminSupabase
      .from('order_items')
      .update({ quantity })
      .eq('id', orderItemId)
    if (error) throw new Error('Failed to update quantity')
  }

  const price = Number(item.price) || 0
  await logActivity({
    restaurantId: session?.restaurant_id ?? null,
    actor: user,
    action: quantity === 0 ? 'item_removed' : 'item_qty_changed',
    sessionId: order.session_id,
    orderId: order.id,
    label: session ? billLabel(session) : null,
    dishName: item.name,
    qtyBefore: currentQty,
    qtyAfter: quantity,
    amountDelta: (quantity - currentQty) * price,
    reason: reason ?? null,
  })
}

/**
 * Captain adds items directly to a live session (e.g. guest orders more after
 * the bill is printed, or orders verbally). Creates a new round already
 * 'approved' — the captain is the approver — and queues a KOT so the kitchen
 * prepares the items. On a bill_generated session, follow with reprintBill so
 * the printed bill picks up the new round.
 */
export async function addItemsToSession({
  sessionId,
  items,
  printKot = true,
}: {
  sessionId: string
  items: { dishId: string; quantity: number }[]
  /**
   * false = admin-only bill correction from /admin/history: the food was
   * already served, so no cook ticket must reach the kitchen.
   */
  printKot?: boolean
}): Promise<{ orderId: string; roundNumber: number }> {
  // Creates an ALREADY-APPROVED round and fires a KOT — staff only.
  const user = await requireStaff()
  if (!printKot && staffRole(user) !== 'admin') {
    throw new Error('Only an admin can add items without a kitchen ticket')
  }
  if (!sessionId || !items?.length) throw new Error('sessionId and items are required')
  for (const item of items) {
    if (!Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 99) {
      throw new Error('Quantity must be between 1 and 99')
    }
  }

  const { data: session, error: sessionError } = await adminSupabase
    .from('table_sessions')
    .select('id, status, restaurant_id, table_id, host_customer_id')
    .eq('id', sessionId)
    .single()
  if (sessionError || !session) throw new Error('Session not found')
  if (session.status === 'closed') throw new Error('Session is closed — cannot add items')

  // Snapshot dish name + price at order time (same pattern as placeOrder)
  const dishIds = items.map((i) => i.dishId)
  const { data: dishes, error: dishError } = await supabase
    .from('dishes')
    .select('id, name_en, price')
    .in('id', dishIds)
  if (dishError || !dishes?.length) throw new Error('Failed to fetch dish details')
  const dishMap = new Map(dishes.map((d) => [d.id, d]))
  const validatedItems = items.map((item) => {
    const dish = dishMap.get(item.dishId)
    if (!dish) throw new Error(`Dish ${item.dishId} not found`)
    return {
      dish_id: item.dishId,
      name: dish.name_en,
      price: dish.price,
      quantity: item.quantity,
    }
  })

  // Next round number; reuse the latest round's customer for attribution
  const { data: lastOrder } = await adminSupabase
    .from('orders')
    .select('round_number, customer_id')
    .eq('session_id', sessionId)
    .order('round_number', { ascending: false })
    .limit(1)
    .maybeSingle()
  const roundNumber = (lastOrder?.round_number ?? 0) + 1

  const { data: order, error: orderError } = await adminSupabase
    .from('orders')
    .insert({
      session_id: sessionId,
      // Captain-started sessions have no prior round — fall back to the
      // customer captured when the table was opened.
      customer_id: lastOrder?.customer_id ?? session.host_customer_id ?? null,
      round_number: roundNumber,
      status: 'approved',
    })
    .select('id, placed_at')
    .single()
  if (orderError || !order) throw new Error('Failed to create order')

  const orderItems = validatedItems.map((item) => ({ ...item, order_id: order.id }))
  const { error: itemsError } = await adminSupabase.from('order_items').insert(orderItems)
  if (itemsError) {
    // Best-effort rollback so no empty approved round lingers on the table
    await adminSupabase.from('orders').delete().eq('id', order.id)
    throw new Error('Failed to save order items')
  }

  const ctx = await getSessionPrintContext(sessionId)

  // Kitchen must still cook captain-added items — queue the KOT. Skipped only
  // on admin bill corrections (printKot: false), where the food already exists.
  if (printKot) {
    const { error: printError } = await adminSupabase.from('print_jobs').insert({
      restaurant_id: ctx.restaurantId,
      type: 'kot',
      status: 'pending',
      payload: {
        tableNumber: ctx.tableNumber,
        orderType: ctx.orderType,
        tokenNumber: ctx.tokenNumber,
        customerName: ctx.customerName,
        roundNumber,
        time: formatTimeIST(order.placed_at),
        items: validatedItems.map((i) => ({ name: i.name, qty: i.quantity })),
      },
    })
    if (printError) throw new Error('Items added but failed to queue KOT print job')
  }

  const label =
    ctx.orderType === 'parcel' ? `Parcel #${ctx.tokenNumber ?? '?'}` : `Table ${ctx.tableNumber ?? '?'}`
  await logActivity(
    validatedItems.map((added) => ({
      restaurantId: ctx.restaurantId,
      actor: user,
      action: 'item_added' as const,
      sessionId,
      orderId: order.id,
      label,
      dishName: added.name,
      qtyBefore: 0,
      qtyAfter: added.quantity,
      amountDelta: (Number(added.price) || 0) * added.quantity,
      details: { roundNumber, kot: printKot },
    }))
  )

  return { orderId: order.id, roundNumber }
}

// ── Parcel / takeaway (P01) ─────────────────────────────────────────────────

export type RawParcelRow = {
  id: string
  status: string
  opened_at: string
  host_name: string | null
  token_number: number | null
  orders: {
    id: string
    round_number: number
    placed_at: string
    status: string
    customers: { name: string } | null
    order_items: { id: string; name: string; quantity: number; price: number }[]
  }[]
}

/**
 * Opens a takeaway order: a session with no table, identified by a token
 * number that resets every IST day. The captain then punches items into it
 * with addItemsToSession exactly as they would for a table.
 */
export async function createParcelSession({
  restaurantId,
  customerName,
}: {
  restaurantId: string
  customerName?: string
}): Promise<{ sessionId: string; tokenNumber: number }> {
  await requireStaff()
  if (!restaurantId) throw new Error('restaurantId is required')

  const name = customerName?.trim().slice(0, 60) || null

  // Atomic per-day counter — two captains tapping at once can never be handed
  // the same token.
  const { data: token, error: tokenError } = await adminSupabase.rpc('next_parcel_token', {
    p_restaurant_id: restaurantId,
  })
  // Surface the underlying cause — a bare "failed" message hides the two
  // things that actually go wrong here: a missing migration and a missing
  // EXECUTE grant for service_role.
  if (tokenError) {
    throw new Error(`Failed to allocate a parcel token: ${tokenError.message}`)
  }
  if (typeof token !== 'number') {
    throw new Error('Failed to allocate a parcel token: RPC returned no token')
  }

  const { data: session, error } = await adminSupabase
    .from('table_sessions')
    .insert({
      restaurant_id: restaurantId,
      table_id: null,
      session_type: 'parcel',
      token_number: token,
      status: 'active',
      // table_sessions.pin is NOT NULL, but no guest device ever joins a
      // parcel. A non-numeric placeholder can never match the 4-digit PIN
      // entry, so this session is unjoinable by construction.
      pin: '----',
      host_name: name,
    })
    .select('id')
    .single()
  if (error || !session) throw new Error('Failed to open parcel order')

  return { sessionId: session.id, tokenNumber: token }
}

/** Live takeaway orders for the captain panel — never returns closed ones. */
export async function getParcelSessions(restaurantId: string): Promise<RawParcelRow[]> {
  await requireStaff()
  if (!restaurantId) throw new Error('restaurantId is required')

  const { data, error } = await adminSupabase
    .from('table_sessions')
    .select(`
      id, status, opened_at, host_name, token_number,
      orders(
        id, round_number, placed_at, status,
        customers(name),
        order_items(id, name, quantity, price)
      )
    `)
    .eq('restaurant_id', restaurantId)
    .eq('session_type', 'parcel')
    .in('status', ['active', 'bill_generated'])
    .order('opened_at', { ascending: true })
  if (error) throw new Error(error.message)
  return (data as unknown as RawParcelRow[]) ?? []
}

/**
 * Discards a parcel the customer walked away from. Refuses once payment has
 * been taken — a settled parcel is already closed and belongs to the day's
 * report.
 */
export async function cancelParcelSession(sessionId: string): Promise<void> {
  const user = await requireStaff()
  if (!sessionId) throw new Error('sessionId is required')

  const { data: session, error } = await adminSupabase
    .from('table_sessions')
    .select('id, status, session_type, restaurant_id, token_number')
    .eq('id', sessionId)
    .single()
  if (error || !session) throw new Error('Parcel not found')
  if (session.session_type !== 'parcel') throw new Error('Not a parcel order')
  if (session.status === 'closed') throw new Error('This parcel is already closed')

  const { data: bill } = await adminSupabase
    .from('bills')
    .select('settled_at')
    .eq('session_id', sessionId)
    .not('settled_at', 'is', null)
    .limit(1)
    .maybeSingle()
  if (bill) throw new Error('Payment already taken — cannot cancel this parcel')

  const discarded = await sessionDiscardedTotal(sessionId)

  const { error: closeError } = await adminSupabase
    .from('table_sessions')
    .update({ status: 'closed', closed_at: new Date().toISOString() })
    .eq('id', sessionId)
  if (closeError) throw new Error(closeError.message)

  await logActivity({
    restaurantId: session.restaurant_id,
    actor: user,
    action: 'parcel_cancelled',
    sessionId,
    label: `Parcel #${session.token_number ?? '?'}`,
    amountDelta: discarded !== null && discarded > 0 ? -discarded : null,
    details: discarded === null ? { amountUnknown: true } : null,
  })
}

// ── Captain walk-in orders (W01) ────────────────────────────────────────────

/**
 * Opens a table for a walk-in who didn't scan the QR: the captain picks a free
 * table, takes name + optional phone, and punches the first round via
 * addItemsToSession (already-approved, KOT fires). The session is a completely
 * normal dine-in session afterwards — billing, moving, settling, history and
 * analytics all behave as if the guest had scanned.
 */
export async function startCaptainOrder({
  restaurantId,
  tableId,
  customerName,
  customerPhone,
  wantsWhatsapp,
}: {
  restaurantId: string
  tableId: string
  customerName: string
  customerPhone?: string
  wantsWhatsapp?: boolean
}): Promise<{ sessionId: string; pin: string; tableNumber: number }> {
  const user = await requireStaff()
  if (!restaurantId || !tableId) throw new Error('restaurantId and tableId are required')
  const name = customerName?.trim().slice(0, 60)
  if (!name) throw new Error('Customer name is required')
  // Client validates too, but phone is the customers dedup key — never let a
  // bypassed client write garbage into it.
  const phone = customerPhone?.trim() || undefined
  if (phone && !isValidIndianPhone(phone)) {
    throw new Error(PHONE_VALIDATION_MESSAGE)
  }

  const { data: tableRow, error: tableError } = await adminSupabase
    .from('restaurant_tables')
    .select('id, table_number, restaurant_id')
    .eq('id', tableId)
    .single()
  if (tableError || !tableRow) throw new Error('Table not found')
  if (tableRow.restaurant_id !== restaurantId) {
    throw new Error('Table belongs to a different restaurant')
  }

  // Friendly pre-check. The unique index only covers ACTIVE sessions, so a
  // billed-but-unsettled session would not collide on insert — check both.
  const { data: existing } = await adminSupabase
    .from('table_sessions')
    .select('id')
    .eq('table_id', tableId)
    .in('status', ['active', 'bill_generated'])
    .limit(1)
    .maybeSingle()
  if (existing) throw new Error(`Table ${tableRow.table_number} already has a running session`)

  const { customerId } = await findOrCreateCustomer({
    restaurantId,
    name,
    phone,
    wantsWhatsapp,
  })

  const pin = String(randomInt(1000, 10000))
  const { data: session, error: insertError } = await adminSupabase
    .from('table_sessions')
    .insert({
      restaurant_id: restaurantId,
      table_id: tableId,
      pin,
      status: 'active',
      // Synthetic host id: joinTable() auto-closes sessions whose
      // host_device_id is NULL as orphans. 'captain:…' can never match a real
      // guest device, so a guest who scans mid-meal is routed down the normal
      // PIN-join path (the captain reads the PIN off the TableSheet) instead
      // of silently killing the live session or becoming its host.
      host_device_id: `captain:${randomUUID()}`,
      host_name: name,
      host_customer_id: customerId,
      joined_device_ids: [],
    })
    .select('id')
    .single()
  if (insertError || !session) {
    // Lost a race with a QR scan or another captain — the partial unique
    // index rejected the second INSERT.
    if (insertError?.code === '23505') {
      throw new Error(`Table ${tableRow.table_number} already has a running session`)
    }
    throw new Error('Failed to open table session')
  }

  await logActivity({
    restaurantId,
    actor: user,
    action: 'order_started',
    sessionId: session.id,
    label: `Table ${tableRow.table_number}`,
    details: { customerName: name },
  })

  return { sessionId: session.id, pin, tableNumber: tableRow.table_number }
}

/**
 * Abandon guard for the walk-in flow: if the captain opened a table but closed
 * the dish picker without adding anything, free the table again. Strictly a
 * no-op once the session has any order — never a data-loss path.
 *
 * Race-safe close-then-verify: an addItemsToSession racing this call either
 * sees the closed session and throws (no order created), or its order lands
 * before the recount below — in which case the close is undone and the
 * session stays live with the order intact.
 */
export async function cancelEmptySession(sessionId: string): Promise<void> {
  await requireStaff()
  if (!sessionId) return

  const { count: before, error: beforeError } = await adminSupabase
    .from('orders')
    .select('id', { count: 'exact', head: true })
    .eq('session_id', sessionId)
  // On a failed count, do nothing — closing a session we can't prove empty
  // could discard a live order. Force reset remains the manual escape hatch.
  if (beforeError) throw new Error(beforeError.message)
  if ((before ?? 0) > 0) return

  const { error: closeError } = await adminSupabase
    .from('table_sessions')
    .update({ status: 'closed', closed_at: new Date().toISOString() })
    .eq('id', sessionId)
    .eq('status', 'active')
  if (closeError) throw new Error(closeError.message)

  const { count: after, error: afterError } = await adminSupabase
    .from('orders')
    .select('id', { count: 'exact', head: true })
    .eq('session_id', sessionId)
  if (afterError || (after ?? 0) > 0) {
    // Either an add raced the cancel and won, or we can't prove it didn't —
    // reopen; a live order must never sit on a closed session.
    const { error: reopenError } = await adminSupabase
      .from('table_sessions')
      .update({ status: 'active', closed_at: null })
      .eq('id', sessionId)
      .eq('status', 'closed')
    if (reopenError) console.error('[cancelEmptySession] reopen failed:', reopenError.message)
  }
}

// ── Activity log reads (A01, admin-only) ────────────────────────────────────

export type ActivityLogEntry = {
  id: string
  createdAt: string
  actorEmail: string | null
  actorRole: 'admin' | 'captain' | 'guest'
  action: ActivityAction
  label: string | null
  dishName: string | null
  qtyBefore: number | null
  qtyAfter: number | null
  amountDelta: number | null
  reason: string | null
  details: Record<string, unknown> | null
}

export type ActivityLogResult = {
  from: string
  to: string
  entries: ActivityLogEntry[]
  truncated: boolean
  /** Rollup of item_removed rows in range — the tile the admin scans first. */
  removedCount: number
  removedAmount: number
}

const ACTIVITY_ROW_LIMIT = 500

/**
 * Audit trail for /admin/activity — every logged staff action in an IST day
 * range, newest first. Same range semantics as getOrderHistory. Strictly
 * requireAdmin: captains must never see their own surveillance.
 */
export async function getActivityLog({
  restaurantId,
  from,
  to,
}: {
  restaurantId: string
  from?: string
  to?: string
}): Promise<ActivityLogResult> {
  await requireAdmin()
  if (!restaurantId) throw new Error('restaurantId is required')

  const isDayKey = (value?: string) => /^\d{4}-\d{2}-\d{2}$/.test(value ?? '')
  const rawTo = isDayKey(to) ? (to as string) : istDayKey(new Date())
  const rawFrom = isDayKey(from) ? (from as string) : rawTo
  const fromKey = rawFrom <= rawTo ? rawFrom : rawTo
  const toKey = rawFrom <= rawTo ? rawTo : rawFrom

  const rangeStart = istDayStart(fromKey)
  const rangeEnd = new Date(istDayStart(toKey).getTime() + DAY_MS)

  const { data, error } = await adminSupabase
    .from('activity_log')
    .select(
      'id, created_at, actor_email, actor_role, action, label, dish_name, qty_before, qty_after, amount_delta, reason, details'
    )
    .eq('restaurant_id', restaurantId)
    .gte('created_at', rangeStart.toISOString())
    .lt('created_at', rangeEnd.toISOString())
    .order('created_at', { ascending: false })
    .limit(ACTIVITY_ROW_LIMIT + 1)
  if (error) throw new Error(error.message)

  const rows = data ?? []
  const truncated = rows.length > ACTIVITY_ROW_LIMIT

  const entries: ActivityLogEntry[] = rows.slice(0, ACTIVITY_ROW_LIMIT).map((row) => ({
    id: row.id,
    createdAt: row.created_at,
    actorEmail: row.actor_email,
    actorRole: (row.actor_role as ActivityLogEntry['actorRole']) ?? 'guest',
    action: row.action as ActivityAction,
    label: row.label,
    dishName: row.dish_name,
    qtyBefore: row.qty_before,
    qtyAfter: row.qty_after,
    amountDelta: row.amount_delta === null ? null : Number(row.amount_delta),
    reason: row.reason,
    details: (row.details as Record<string, unknown> | null) ?? null,
  }))

  let removedCount = 0
  let removedAmount = 0
  for (const entry of entries) {
    if (entry.action === 'item_removed') {
      removedCount += 1
      removedAmount += Math.abs(entry.amountDelta ?? 0)
    }
  }

  return { from: fromKey, to: toKey, entries, truncated, removedCount, removedAmount }
}

export interface TableEntry {
  restaurantId: string
  tableId: string
  tableNumber: number
  slug: string
  restaurantName: string
}

export async function getDefaultRestaurantSlug(): Promise<string | null> {
  const { data } = await adminSupabase
    .from('restaurants')
    .select('slug')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  return data?.slug ?? null
}

export async function getTableEntry(
  slug: string,
  tableNumber: number
): Promise<TableEntry | null> {
  const { data: restaurant } = await adminSupabase
    .from('restaurants')
    .select('id, name')
    .eq('slug', slug)
    .maybeSingle()

  if (!restaurant) return null

  const { data: table } = await adminSupabase
    .from('restaurant_tables')
    .select('id, table_number')
    .eq('restaurant_id', restaurant.id)
    .eq('table_number', tableNumber)
    .maybeSingle()

  if (!table) return null

  return {
    restaurantId: restaurant.id,
    tableId: table.id,
    tableNumber: table.table_number,
    slug,
    restaurantName: restaurant.name,
  }
}

// Tables are static seed data (16 rows) — safe to cache for an hour so every
// QR scan doesn't do two sequential adminSupabase round-trips.
const getTableEntryCachedInternal = unstable_cache(
  async (slug: string, tableNumber: number) => getTableEntry(slug, tableNumber),
  ['table-entry'],
  { revalidate: 3600, tags: ['tables'] }
);

export async function getTableEntryCached(slug: string, tableNumber: number) {
  return getTableEntryCachedInternal(slug, tableNumber);
}

// ─── Shared cart ────────────────────────────────────────────────────────────

export interface SharedCartItem {
  id: string
  dishId: string
  name: string
  price: number
  image: string | null
  category: string | null
  quantity: number
  addedByDeviceId: string
  addedByName: string
}

export type JoinTableResult =
  | { requiresPin: true }
  | { requiresPin?: false; sessionId: string; pin: string; isHost: boolean; hostName: string; hostCustomerId: string | null }

export async function joinTable({
  restaurantId,
  tableId,
  deviceId,
  displayName,
  pinAttempt,
}: {
  restaurantId: string
  tableId: string
  deviceId: string
  displayName?: string
  pinAttempt?: string
}): Promise<JoinTableResult> {
  if (!restaurantId || !tableId || !deviceId) throw new Error('restaurantId, tableId, and deviceId are required')

  const effectiveName = displayName?.trim() || 'Guest'

  const { data: tableRow, error: tableError } = await adminSupabase
    .from('restaurant_tables')
    .select('table_number')
    .eq('id', tableId)
    .single()
  if (tableError || !tableRow) throw new Error('Table not found')

  const { data: foundSession } = await adminSupabase
    .from('table_sessions')
    .select('id, pin, host_device_id, host_name, host_customer_id, opened_at, joined_device_ids, pin_failed_attempts, pin_locked_until')
    .eq('table_id', tableId)
    .eq('status', 'active')
    .maybeSingle()

  // Auto-close sessions that are stale (previous day) or orphaned (no host_device_id set)
  let activeSession = foundSession
  const isOrphaned = foundSession && !foundSession.host_device_id
  const isStale = foundSession && new Date(foundSession.opened_at) < todayMidnightIST()
  if (foundSession && (isStale || isOrphaned)) {
    await closeStaleSession(foundSession.id)
    activeSession = null
  }

  if (!activeSession) {
    // CSPRNG — Math.random() is predictable and would let an attacker guess a
    // table's join PIN. randomInt() is crypto-secure and uniform over 1000–9999.
    const pin = String(randomInt(1000, 10000))
    const { data: newSession, error: insertError } = await adminSupabase
      .from('table_sessions')
      .insert({
        restaurant_id: restaurantId,
        table_id: tableId,
        pin,
        status: 'active',
        host_device_id: deviceId,
        host_name: effectiveName,
        joined_device_ids: [deviceId],
      })
      .select('id')
      .single()

    if (!insertError && newSession) {
      // Won the race — this device is the sole host.
      return { sessionId: newSession.id, pin, isHost: true, hostName: effectiveName, hostCustomerId: null }
    }

    // Lost the create race: another device scanned within milliseconds and its
    // INSERT landed first. The partial unique index (one active session per
    // table) rejected ours with SQLSTATE 23505. Re-read the winning session and
    // fall through to the join-as-guest path so this device enters the PIN.
    if (insertError?.code !== '23505') throw new Error('Failed to create session')

    const { data: winner } = await adminSupabase
      .from('table_sessions')
      .select('id, pin, host_device_id, host_name, host_customer_id, opened_at, joined_device_ids, pin_failed_attempts, pin_locked_until')
      .eq('table_id', tableId)
      .eq('status', 'active')
      .maybeSingle()
    if (!winner) throw new Error('Failed to create session')
    activeSession = winner
  }

  const isHost = activeSession.host_device_id === deviceId
  const joinedDeviceIds: string[] = activeSession.joined_device_ids ?? []
  const alreadyJoined = isHost || joinedDeviceIds.includes(deviceId)

  // Non-host devices that haven't joined this session before must supply the
  // correct table PIN — prevents anyone with just the table URL (screenshotted,
  // forwarded, or a stale QR) from silently joining someone else's shared cart.
  if (!alreadyJoined) {
    if (!pinAttempt) {
      return { requiresPin: true }
    }
    // Throws 'Incorrect PIN' on mismatch, or a lockout message after too many tries.
    await verifyPinWithLockout(activeSession, String(pinAttempt))
    await adminSupabase
      .from('table_sessions')
      .update({ joined_device_ids: [...joinedDeviceIds, deviceId] })
      .eq('id', activeSession.id)
  }

  return {
    sessionId: activeSession.id,
    pin: activeSession.pin,
    isHost,
    hostName: activeSession.host_name ?? 'Host',
    hostCustomerId: activeSession.host_customer_id ?? null,
  }
}

// Called once by the host right after they open the table, before browsing —
// collects name + phone up front (instead of at checkout) and links the
// session to a customers row. Only the host device may call this.
export async function registerHost({
  sessionId,
  deviceId,
  restaurantId,
  name,
  phone,
  wantsWhatsapp,
}: {
  sessionId: string
  deviceId: string
  restaurantId: string
  name: string
  phone?: string
  wantsWhatsapp?: boolean
}): Promise<{ customerId: string }> {
  if (!sessionId || !deviceId || !restaurantId || !name?.trim()) {
    throw new Error('sessionId, deviceId, restaurantId, and name are required')
  }

  const { data: session, error: sessionError } = await adminSupabase
    .from('table_sessions')
    .select('id, host_device_id, status')
    .eq('id', sessionId)
    .single()
  if (sessionError || !session) throw new Error('Session not found')
  if (session.status !== 'active') throw new Error('Session is no longer active')
  if (session.host_device_id !== deviceId) throw new Error('Only the host can register table details')

  const trimmedName = name.trim()
  const { customerId } = await findOrCreateCustomer({ restaurantId, name: trimmedName, phone, wantsWhatsapp })

  const { error: updateError } = await adminSupabase
    .from('table_sessions')
    .update({ host_name: trimmedName, host_customer_id: customerId })
    .eq('id', sessionId)
  if (updateError) throw new Error('Failed to save host details')

  return { customerId }
}

export async function getSharedCart(sessionId: string): Promise<SharedCartItem[]> {
  if (!sessionId) return []
  const { data, error } = await adminSupabase
    .from('session_cart_items')
    .select('id, dish_id, name, price, image, category, quantity, added_by_device_id, added_by_name')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true })
  if (error) throw new Error('Failed to fetch shared cart')
  return (data ?? []).map((row) => ({
    id: row.id,
    dishId: row.dish_id,
    name: row.name,
    price: Number(row.price),
    image: row.image,
    category: row.category,
    quantity: row.quantity,
    addedByDeviceId: row.added_by_device_id,
    addedByName: row.added_by_name,
  }))
}

export async function addSharedCartItem({
  sessionId,
  deviceId,
  displayName,
  dish,
}: {
  sessionId: string
  deviceId: string
  displayName: string
  dish: { id: string; name: string; price: number; image: string; category: string }
}): Promise<void> {
  if (!sessionId || !deviceId || !dish?.id) throw new Error('sessionId, deviceId, and dish are required')

  const { data: existing } = await adminSupabase
    .from('session_cart_items')
    .select('id, quantity')
    .eq('session_id', sessionId)
    .eq('dish_id', dish.id)
    .eq('added_by_device_id', deviceId)
    .maybeSingle()

  if (existing) {
    await adminSupabase
      .from('session_cart_items')
      .update({ quantity: existing.quantity + 1, updated_at: new Date().toISOString() })
      .eq('id', existing.id)
  } else {
    await adminSupabase.from('session_cart_items').insert({
      session_id: sessionId,
      dish_id: dish.id,
      name: dish.name,
      price: dish.price,
      image: dish.image || null,
      category: dish.category || null,
      quantity: 1,
      added_by_device_id: deviceId,
      added_by_name: displayName || 'Guest',
    })
  }
}

export async function updateSharedCartItemQty({
  sessionId,
  deviceId,
  itemId,
  quantity,
}: {
  sessionId: string
  deviceId: string
  itemId: string
  quantity: number
}): Promise<void> {
  if (!sessionId || !deviceId || !itemId) throw new Error('sessionId, deviceId, and itemId are required')

  const { data: item } = await adminSupabase
    .from('session_cart_items')
    .select('id')
    .eq('id', itemId)
    .eq('session_id', sessionId)
    .maybeSingle()
  if (!item) throw new Error('Item not found')

  const { data: session } = await adminSupabase
    .from('table_sessions')
    .select('host_device_id, joined_device_ids')
    .eq('id', sessionId)
    .maybeSingle()

  // Any device that has actually joined this table's shared session — host or
  // guest — may edit any item's quantity, not just the one they personally
  // added. It's one shared cart for the whole table.
  const canEdit =
    session?.host_device_id === deviceId || (session?.joined_device_ids ?? []).includes(deviceId)
  if (!canEdit) throw new Error('Permission denied')

  if (quantity <= 0) {
    await adminSupabase.from('session_cart_items').delete().eq('id', itemId)
  } else {
    await adminSupabase
      .from('session_cart_items')
      .update({ quantity, updated_at: new Date().toISOString() })
      .eq('id', itemId)
  }
}

export async function removeSharedCartItem({
  sessionId,
  deviceId,
  itemId,
}: {
  sessionId: string
  deviceId: string
  itemId: string
}): Promise<void> {
  if (!sessionId || !deviceId || !itemId) throw new Error('sessionId, deviceId, and itemId are required')

  const { data: item } = await adminSupabase
    .from('session_cart_items')
    .select('id')
    .eq('id', itemId)
    .eq('session_id', sessionId)
    .maybeSingle()
  if (!item) throw new Error('Item not found')

  const { data: session } = await adminSupabase
    .from('table_sessions')
    .select('host_device_id, joined_device_ids')
    .eq('id', sessionId)
    .maybeSingle()

  const canEdit =
    session?.host_device_id === deviceId || (session?.joined_device_ids ?? []).includes(deviceId)
  if (!canEdit) throw new Error('Permission denied')

  await adminSupabase.from('session_cart_items').delete().eq('id', itemId)
}

export async function clearSharedCart(sessionId: string): Promise<void> {
  if (!sessionId) return
  await adminSupabase.from('session_cart_items').delete().eq('session_id', sessionId)
}

export async function findOrCreateCustomer({
  restaurantId,
  name,
  phone,
  wantsWhatsapp,
}: {
  restaurantId: string
  name: string
  phone?: string
  wantsWhatsapp?: boolean
}): Promise<{ customerId: string }> {
  if (!restaurantId || !name?.trim()) throw new Error('restaurantId and name are required')

  const normalizedPhone = phone?.trim() || null
  // The dedup key for `customers` — validate here regardless of what the
  // caller already checked, since this is the one function every phone-
  // collecting flow (checkout, host onboarding, captain walk-in) ends at.
  if (normalizedPhone && !isValidIndianPhone(normalizedPhone)) {
    throw new Error(PHONE_VALIDATION_MESSAGE)
  }

  if (normalizedPhone) {
    const { data: existing } = await adminSupabase
      .from('customers')
      .select('id')
      .eq('restaurant_id', restaurantId)
      .eq('phone', normalizedPhone)
      .maybeSingle()
    if (existing) return { customerId: existing.id }
  }

  const { data: customer, error } = await adminSupabase
    .from('customers')
    .insert({
      restaurant_id: restaurantId,
      name: name.trim(),
      phone: normalizedPhone,
      whatsapp_opted_in: wantsWhatsapp ?? false,
    })
    .select('id')
    .single()
  if (error || !customer) throw new Error('Failed to create customer')
  return { customerId: customer.id }
}

/**
 * Data-deletion / "right to be forgotten" for a customer (T-privacy).
 * Anonymizes rather than hard-deletes so historical orders/bills keep their FK
 * integrity and daily-sales totals stay correct — but ALL personal data (name,
 * phone, WhatsApp opt-in) is irreversibly stripped. Admin-only.
 */
export async function anonymizeCustomer(customerId: string): Promise<void> {
  await requireAdmin()
  if (!customerId) throw new Error('customerId is required')
  const { error } = await adminSupabase
    .from('customers')
    .update({
      name: 'Deleted guest',
      phone: null,
      whatsapp_opted_in: false,
    })
    .eq('id', customerId)
  if (error) throw new Error(error.message)
}
