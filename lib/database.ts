"use server"

import { supabase } from './supabase'
import { createClient } from '@supabase/supabase-js'
import { revalidateTag, unstable_cache } from 'next/cache'
import { headers } from 'next/headers'

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE!
)

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
  const { data, error } = await adminSupabase
    .from('categories')
    .insert({ name })
    .select()
    .maybeSingle()
  if (error) throw error
  return data
}

export async function deleteCategory(id: string) {
  const { error } = await adminSupabase
    .from('categories')
    .delete()
    .eq('id', id)
  if (error) throw error
}

export async function updateCategory(id: string, payload: { image_url?: string | null }) {
  const { data, error } = await adminSupabase
    .from('categories')
    .update(payload)
    .eq('id', id)
    .select()
    .maybeSingle()
  if (error) throw error
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
  const isPublic = review.stars >= 4
  const { error } = await supabase
    .from('reviews')
    .insert({ ...review, is_public: isPublic })
  if (error) throw error
}

export async function toggleReviewVisibility(
  id: string,
  isPublic: boolean
) {
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
    reviewsInRange
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
      .gte('created_at', weekStartISO)
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

  const { data: activeSession } = await adminSupabase
    .from('table_sessions')
    .select('id, pin')
    .eq('table_id', tableId)
    .eq('status', 'active')
    .maybeSingle()

  if (!activeSession) {
    const pin = String(Math.floor(1000 + Math.random() * 9000))
    const { data: newSession, error: insertError } = await adminSupabase
      .from('table_sessions')
      .insert({ restaurant_id: restaurantId, table_id: tableId, pin, status: 'active' })
      .select('id')
      .single()
    if (insertError || !newSession) throw new Error('Failed to create session')
    return { exists: false, sessionId: newSession.id, tableNumber, pin }
  }

  if (pinAttempt === undefined || pinAttempt === null || pinAttempt === '') {
    return { exists: true, requiresPin: true }
  }

  if (String(pinAttempt).trim() === activeSession.pin) {
    return { exists: true, sessionId: activeSession.id, tableNumber, pin: activeSession.pin }
  }

  throw new Error('Incorrect PIN')
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

  // Snapshot dish name + price at order time.
  // Use the public anon client — dishes are public-readable via RLS, no service-role needed.
  const dishIds = items.map((i) => i.dishId)
  const { data: dishes, error: dishError } = await supabase
    .from('dishes')
    .select('id, name_en, price')
    .in('id', dishIds)
  if (dishError || !dishes?.length) throw new Error('Failed to fetch dish details')

  const dishMap = new Map(dishes.map((d) => [d.id, d]))

  // Validate ALL dish IDs before any insert — prevents orphaned orders rows.
  // If any dishId is absent from the DB result, throw here before touching orders.
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

export async function approveOrder(
  orderId: string
): Promise<{ orderId: string; status: 'approved' }> {
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

  // Resolve restaurant_id + table_number via session → table
  const { data: session, error: sessionError } = await adminSupabase
    .from('table_sessions')
    .select('restaurant_id, table_id')
    .eq('id', order.session_id)
    .single()
  if (sessionError || !session) throw new Error('Session not found')

  const { data: table, error: tableError } = await adminSupabase
    .from('restaurant_tables')
    .select('table_number')
    .eq('id', session.table_id)
    .single()
  if (tableError || !table) throw new Error('Table not found')

  // Load items for the KOT payload
  const { data: items, error: itemsError } = await adminSupabase
    .from('order_items')
    .select('name, quantity')
    .eq('order_id', orderId)
  if (itemsError || !items?.length) throw new Error('Order has no items')

  // Flip status first so a concurrent call sees it as no longer pending
  const { error: updateError } = await adminSupabase
    .from('orders')
    .update({ status: 'approved' })
    .eq('id', orderId)
  if (updateError) throw new Error('Failed to approve order')

  // approveOrder is the ONLY creator of a KOT print job
  const { error: printError } = await adminSupabase.from('print_jobs').insert({
    restaurant_id: session.restaurant_id,
    type: 'kot',
    status: 'pending',
    payload: {
      tableNumber: table.table_number,
      roundNumber: order.round_number,
      time: formatTimeIST(order.placed_at),
      items: items.map((i) => ({ name: i.name, qty: i.quantity })),
    },
  })
  if (printError) throw new Error('Failed to queue KOT print job')

  return { orderId, status: 'approved' }
}

export async function rejectOrder(
  orderId: string
): Promise<{ orderId: string; status: 'rejected' }> {
  if (!orderId) throw new Error('orderId is required')

  const { data: order, error: orderError } = await adminSupabase
    .from('orders')
    .select('id, status')
    .eq('id', orderId)
    .single()
  if (orderError || !order) throw new Error('Order not found')

  // Idempotent no-op on double-tap; never creates a print job either way.
  if (order.status === 'rejected') return { orderId, status: 'rejected' }
  if (order.status !== 'pending_approval') {
    throw new Error(`Cannot reject order in status '${order.status}'`)
  }

  const { error: updateError } = await adminSupabase
    .from('orders')
    .update({ status: 'rejected' })
    .eq('id', orderId)
  if (updateError) throw new Error('Failed to reject order')

  return { orderId, status: 'rejected' }
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
    .select('id, status, restaurant_id, table_id')
    .eq('id', sessionId)
    .single()
  if (sessionError || !session) throw new Error('Session not found')

  // Guard: if already billed, return the existing bill (no duplicate rows/jobs)
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

  // Customer name = most recent order's customer
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

  const { data: restaurant } = await adminSupabase
    .from('restaurants')
    .select('name, address, gstin, upi_id')
    .eq('id', session.restaurant_id)
    .maybeSingle()

  const { data: table } = await adminSupabase
    .from('restaurant_tables')
    .select('table_number')
    .eq('id', session.table_id)
    .maybeSingle()

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
    payload: {
      restaurantName: restaurant?.name ?? '',
      address: restaurant?.address ?? '',
      gstin: restaurant?.gstin ?? '',
      upiId: restaurant?.upi_id ?? '',
      tableNumber: table?.table_number ?? null,
      customerName,
      rounds,
      subtotal,
      gstRate,
      gstAmount,
      total,
    },
  })
  if (printError) throw new Error('Failed to queue bill print job')

  // Flip the session
  const { error: sessionUpdateError } = await adminSupabase
    .from('table_sessions')
    .update({ status: 'bill_generated' })
    .eq('id', sessionId)
  if (sessionUpdateError) throw new Error('Failed to update session status')

  return { billId: bill.id, total }
}

export interface TableEntry {
  restaurantId: string
  tableId: string
  tableNumber: number
  slug: string
  restaurantName: string
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

export async function joinTable({
  restaurantId,
  tableId,
  deviceId,
  displayName,
}: {
  restaurantId: string
  tableId: string
  deviceId: string
  displayName?: string
}): Promise<{ sessionId: string; pin: string; isHost: boolean; hostName: string }> {
  if (!restaurantId || !tableId || !deviceId) throw new Error('restaurantId, tableId, and deviceId are required')

  const effectiveName = displayName?.trim() || 'Guest'

  const { data: tableRow, error: tableError } = await adminSupabase
    .from('restaurant_tables')
    .select('table_number')
    .eq('id', tableId)
    .single()
  if (tableError || !tableRow) throw new Error('Table not found')

  const { data: activeSession } = await adminSupabase
    .from('table_sessions')
    .select('id, pin, host_device_id, host_name')
    .eq('table_id', tableId)
    .eq('status', 'active')
    .maybeSingle()

  if (!activeSession) {
    const pin = String(Math.floor(1000 + Math.random() * 9000))
    const { data: newSession, error: insertError } = await adminSupabase
      .from('table_sessions')
      .insert({
        restaurant_id: restaurantId,
        table_id: tableId,
        pin,
        status: 'active',
        host_device_id: deviceId,
        host_name: effectiveName,
      })
      .select('id')
      .single()
    if (insertError || !newSession) throw new Error('Failed to create session')
    return { sessionId: newSession.id, pin, isHost: true, hostName: effectiveName }
  }

  const isHost = activeSession.host_device_id === deviceId
  return {
    sessionId: activeSession.id,
    pin: activeSession.pin,
    isHost,
    hostName: activeSession.host_name ?? 'Host',
  }
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
    .select('added_by_device_id')
    .eq('id', itemId)
    .eq('session_id', sessionId)
    .maybeSingle()
  if (!item) throw new Error('Item not found')

  const { data: session } = await adminSupabase
    .from('table_sessions')
    .select('host_device_id')
    .eq('id', sessionId)
    .maybeSingle()

  const canEdit = item.added_by_device_id === deviceId || session?.host_device_id === deviceId
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
    .select('added_by_device_id')
    .eq('id', itemId)
    .eq('session_id', sessionId)
    .maybeSingle()
  if (!item) throw new Error('Item not found')

  const { data: session } = await adminSupabase
    .from('table_sessions')
    .select('host_device_id')
    .eq('id', sessionId)
    .maybeSingle()

  const canEdit = item.added_by_device_id === deviceId || session?.host_device_id === deviceId
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
