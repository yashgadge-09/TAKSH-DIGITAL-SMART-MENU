
import { supabase } from './supabase'

export async function getAllDishes(timestamp?: number) {
  let query = supabase
    .from('dishes')
    .select('*')
    .eq('is_available', true);
    
  if (timestamp) {
    // Add a unique query param via a dummy filter to bypass cache
    query = query.neq('id', '00000000-0000-0000-0000-000000000000');
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
    query = query.neq('name_en', 'NON_EXISTENT_DISH_NAME_FOR_CACHE_BUST');
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
    query = query.neq('id', '00000000-0000-0000-0000-000000000000');
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
