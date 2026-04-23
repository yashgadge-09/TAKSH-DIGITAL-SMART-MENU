
import { supabase } from './supabase'

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

  return 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=300&fit=crop'
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

export async function getRecommendations(
  currentDishId: string,
  currentCategory: string,
  limitPerCategory = 4
) {
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

export async function getAllDishes(timestamp?: number) {
  let query = supabase
    .from('dishes')
    .select('*')
    .eq('is_available', true);
    
  if (timestamp) {
    // Add a unique query param via a dummy filter to bypass cache
    query = query.neq('name_en', `CACHE_BUST_${timestamp}`);
  }
  
  const { data, error } = await query.order('created_at', { ascending: true });
  if (error) throw error
  return data
}

export async function getDishById(id: string, timestamp?: number) {
  let query = supabase
    .from('dishes')
    .select('*')
    .eq('id', id);

  if (timestamp) {
    // Force bypass cache
    query = query.neq('name_en', `CACHE_BUST_${timestamp}`);
  }

  const { data, error } = await query.single();
  if (error) throw error
  return data
}

export async function getAllDishesAdmin(timestamp?: number) {
  let query = supabase
    .from('dishes')
    .select('*');

  if (timestamp) {
    // Force bypass cache
    query = query.neq('name_en', `CACHE_BUST_${timestamp}`);
  }

  const { data, error } = await query.order('created_at', { ascending: true });
  if (error) throw error
  return data
}

export async function addDish(dish: any) {
  const { data, error } = await supabase
    .from('dishes')
    .insert(dish)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateDish(id: string, dish: any) {
  const { data, error } = await supabase
    .from('dishes')
    .update(dish)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteDish(id: string) {
  const { error } = await supabase
    .from('dishes')
    .delete()
    .eq('id', id)
  if (error) throw error
}

export async function toggleAvailability(
  id: string,
  isAvailable: boolean
) {
  const { error } = await supabase
    .from('dishes')
    .update({ is_available: isAvailable })
    .eq('id', id)
  if (error) throw error
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
  const { data, error } = await supabase
    .from('categories')
    .insert({ name })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteCategory(id: string) {
  const { error } = await supabase
    .from('categories')
    .delete()
    .eq('id', id)
  if (error) throw error
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
  const { data, error } = await supabase
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
  const { error } = await supabase
    .from('reviews')
    .update({ is_public: isPublic })
    .eq('id', id)
  if (error) throw error
}

export async function trackMenuView() {
  await supabase
    .from('menu_views')
    .insert({ page: 'menu' })
}

export async function trackDishView(
  dishId: string,
  dishName: string,
  category: string
) {
  await supabase
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
  await supabase
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

  let { error } = await supabase
    .from('favourites')
    .upsert(payload, {
      onConflict: 'dish_id,session_id',
      ignoreDuplicates: false,
    })

  // Backward compatibility for environments where newer columns are not applied yet.
  if (error?.code === '42703') {
    if (isActive) {
      const fallbackUpsert = await supabase
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
      const fallbackDelete = await supabase
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

  const { error } = await supabase
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

  ;(data || []).forEach((row: any) => {
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

    const key = date.toISOString().slice(0, 10)
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
  return value.slice(0, 10)
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

  const previousWeekStart = new Date(weekStart)
  previousWeekStart.setDate(weekStart.getDate() - safeDays)
  const previousWeekStartISO = previousWeekStart.toISOString()

  const [
    menuViewsToday,
    menuViewsLast7,
    dishViewsAll,
    cartEventsAll,
    cartEventsToday,
    favouritesAll,
    reviewsAll
  ] = await Promise.all([
    supabase
      .from('menu_views')
      .select('*', { count: 'exact' })
      .gte('created_at', todayISO),
    supabase
      .from('menu_views')
      .select('created_at')
      .gte('created_at', weekStartISO),
    supabase
      .from('dish_views')
      .select('dish_name, category, created_at')
      .gte('created_at', previousWeekStartISO),
    supabase
      .from('cart_events')
      .select('dish_name, category, price, created_at'),
    supabase
      .from('cart_events')
      .select('price')
      .gte('created_at', todayISO),
    supabase
      .from('favourites')
      .select('id, dish_name, created_at, session_id, is_active, updated_at'),
    supabase
      .from('reviews')
      .select('id, stars, is_public, text, reviewer, dishes, created_at')
  ])

  let favouritesRows = (favouritesAll.data || []).map((row: any) => ({
    ...row,
    is_active: row.is_active ?? true,
    updated_at: row.updated_at ?? row.created_at,
  }))
  let favouritesError = favouritesAll.error

  if (favouritesError && favouritesError.code === '42703') {
    const fallbackFavourites = await supabase
      .from('favourites')
      .select('id, dish_name, created_at, session_id')

    favouritesRows = (fallbackFavourites.data || []).map((row) => ({
      ...row,
      is_active: true,
      updated_at: row.created_at,
    }))
    favouritesError = fallbackFavourites.error
  }

  if (favouritesError && favouritesError.code === '42703') {
    const fallbackLegacy = await supabase
      .from('favourites')
      .select('id, dish_name, created_at')

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
    menuViewsLast7.error,
    dishViewsAll.error,
    cartEventsAll.error,
    cartEventsToday.error,
    favouritesError,
    reviewsAll.error,
  ].filter(Boolean)

  const queryWarning = queryErrors.length
    ? 'Some analytics queries failed due to missing permissions or schema. Check Supabase table policies and columns for analytics events.'
    : null

  const dishViewCounts: Record<string, number> = {}
  const weeklyDishViewCounts: Record<string, { count: number; category: string }> = {}
  const previousWeeklyDishCounts: Record<string, number> = {}

  dishViewsAll.data?.forEach(view => {
    dishViewCounts[view.dish_name] =
      (dishViewCounts[view.dish_name] || 0) + 1

    const dayKey = normalizeDayKey(view.created_at)
    if (dayKey >= normalizeDayKey(weekStartISO)) {
      weeklyDishViewCounts[view.dish_name] = {
        count: (weeklyDishViewCounts[view.dish_name]?.count || 0) + 1,
        category: view.category || 'General',
      }
    } else {
      previousWeeklyDishCounts[view.dish_name] =
        (previousWeeklyDishCounts[view.dish_name] || 0) + 1
    }
  })

  const cartCounts: Record<string, number> = {}
  cartEventsAll.data?.forEach(event => {
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

  const reviews = reviewsAll.data || []
  const avgRating = reviews.length > 0
    ? reviews.reduce((sum, r) => sum + r.stars, 0) 
      / reviews.length
    : 0

  const dayBuckets = buildDayBuckets(safeDays)
  const bucketMap = new Map(dayBuckets.map((bucket) => [bucket.key, bucket]))

  menuViewsLast7.data?.forEach((event) => {
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

  cartEventsAll.data?.forEach((event) => {
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
      const prev = previousWeeklyDishCounts[name] || 0
      return {
        rank: index + 1,
        name,
        category: value.category || 'General',
        views: value.count,
        trending: value.count >= prev ? 'up' : 'down',
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
    totalScans: menuViewsLast7.data?.length || 0,
    windowDays: safeDays,
    queryWarning,
  }
}
