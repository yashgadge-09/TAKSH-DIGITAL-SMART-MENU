
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
  dishName: string
) {
  await supabase
    .from('favourites')
    .insert({
      dish_id: dishId,
      dish_name: dishName
    })
}

export async function getAnalyticsData() {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayISO = today.toISOString()

  const [
    menuViewsToday,
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
      .from('dish_views')
      .select('dish_name, category'),
    supabase
      .from('cart_events')
      .select('dish_name, category, price'),
    supabase
      .from('cart_events')
      .select('price')
      .gte('created_at', todayISO),
    supabase
      .from('favourites')
      .select('dish_name'),
    supabase
      .from('reviews')
      .select('stars, is_public')
  ])

  const dishViewCounts: Record<string, number> = {}
  dishViewsAll.data?.forEach(view => {
    dishViewCounts[view.dish_name] =
      (dishViewCounts[view.dish_name] || 0) + 1
  })

  const cartCounts: Record<string, number> = {}
  cartEventsAll.data?.forEach(event => {
    cartCounts[event.dish_name] =
      (cartCounts[event.dish_name] || 0) + 1
  })

  const favCounts: Record<string, number> = {}
  favouritesAll.data?.forEach(fav => {
    favCounts[fav.dish_name] =
      (favCounts[fav.dish_name] || 0) + 1
  })

  const estimatedRevenue = cartEventsToday.data?.reduce(
    (sum, event) => sum + (event.price || 0), 0
  ) || 0

  const reviews = reviewsAll.data || []
  const avgRating = reviews.length > 0
    ? reviews.reduce((sum, r) => sum + r.stars, 0) 
      / reviews.length
    : 0

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
    avgRating: Math.round(avgRating * 10) / 10
  }
}
