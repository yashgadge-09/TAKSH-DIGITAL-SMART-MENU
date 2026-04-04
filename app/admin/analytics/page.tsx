"use client"

import { useEffect, useState } from "react"
import { AdminLayout } from "@/components/AdminSidebar"
import { getAnalyticsData } from "@/lib/database"
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts"
import { TrendingUp, TrendingDown, Star, Eye, EyeOff, StarHalf } from "lucide-react"
import Image from "next/image"

const weeklyScansData = [
  { day: "Mon", scans: 120 },
  { day: "Tue", scans: 180 },
  { day: "Wed", scans: 210 },
  { day: "Thu", scans: 280 },
  { day: "Fri", scans: 320 },
  { day: "Sat", scans: 350 },
  { day: "Sun", scans: 290 },
]

const scansVsFavouritesData = [
  { day: "Mon", scans: 120, favourites: 45 },
  { day: "Tue", scans: 180, favourites: 89 },
  { day: "Wed", scans: 210, favourites: 120 },
  { day: "Thu", scans: 280, favourites: 156 },
  { day: "Fri", scans: 320, favourites: 189 },
  { day: "Sat", scans: 350, favourites: 145 },
  { day: "Sun", scans: 290, favourites: 134 },
]

const mostAddedToCartData = [
  { name: "Paneer Tikka", count: 145 },
  { name: "Butter Paneer", count: 132 },
  { name: "Veg Biryani", count: 98 },
  { name: "Samosa", count: 87 },
  { name: "Dal Makhani", count: 76 },
]

const mostFavouritedData = [
  { name: "Paneer Tikka", count: 89 },
  { name: "Gulab Jamun", count: 67 },
  { name: "Butter Paneer", count: 54 },
  { name: "Mango Lassi", count: 43 },
  { name: "Masala Dosa", count: 38 },
]

const topDishesData = [
  {
    rank: 1,
    name: "Paneer Tikka",
    category: "Starter",
    views: 145,
    trending: "up",
    image: "https://images.unsplash.com/photo-1567188040759-fb8a883dc6d8?w=100&h=100&fit=crop",
  },
  {
    rank: 2,
    name: "Butter Chicken",
    category: "Main Course",
    views: 132,
    trending: "up",
    image: "https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?w=100&h=100&fit=crop",
  },
  {
    rank: 3,
    name: "Gulab Jamun",
    category: "Desserts",
    views: 98,
    trending: "up",
    image: "https://images.unsplash.com/photo-1666190094745-d1ff2fa8f924?w=100&h=100&fit=crop",
  },
  {
    rank: 4,
    name: "Chicken Biryani",
    category: "Main Course",
    views: 87,
    trending: "down",
    image: "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=100&h=100&fit=crop",
  },
  {
    rank: 5,
    name: "Mango Lassi",
    category: "Cold Drinks",
    views: 76,
    trending: "up",
    image: "https://images.unsplash.com/photo-1527661591475-527312dd65f5?w=100&h=100&fit=crop",
  },
]

// Review Analytics Data
const reviewsData = {
  totalReviews: 8,
  averageRating: 4.2,
  publicReviews: 5,
  privateReviews: 3,
  ratingDistribution: [
    { stars: 5, count: 4, percentage: 50 },
    { stars: 4, count: 2, percentage: 25 },
    { stars: 3, count: 1, percentage: 12.5 },
    { stars: 2, count: 1, percentage: 12.5 },
    { stars: 1, count: 0, percentage: 0 },
  ],
}

const recentReviews = [
  { id: 1, stars: 5, text: "Amazing Paneer Tikka! Best I had.", reviewer: "Priya S.", date: "Mar 15", isPublic: true },
  { id: 2, stars: 5, text: "Dal Makhani was absolutely divine.", reviewer: "Rahul M.", date: "Mar 14", isPublic: true },
  { id: 3, stars: 4, text: "Great food and lovely ambiance.", reviewer: "Sneha K.", date: "Mar 13", isPublic: true },
  { id: 4, stars: 2, text: "Service was slow, food was cold.", reviewer: "Anonymous", date: "Mar 12", isPublic: false },
  { id: 5, stars: 1, text: "Very disappointed with quality.", reviewer: "Anonymous", date: "Mar 11", isPublic: false },
]

const topRatedDishes = [
  { rank: 1, name: "Paneer Tikka", category: "Starter", rating: 4.8, mentions: 3, image: "https://images.unsplash.com/photo-1567188040759-fb8a883dc6d8?w=100&h=100&fit=crop" },
  { rank: 2, name: "Dal Makhani", category: "Main Course", rating: 5.0, mentions: 2, image: "https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=100&h=100&fit=crop" },
  { rank: 3, name: "Veg Biryani", category: "Rice", rating: 4.5, mentions: 2, image: "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=100&h=100&fit=crop" },
  { rank: 4, name: "Gulab Jamun", category: "Desserts", rating: 4.0, mentions: 1, image: "https://images.unsplash.com/photo-1666190094745-d1ff2fa8f924?w=100&h=100&fit=crop" },
  { rank: 5, name: "Mango Lassi", category: "Cold Drinks", rating: 4.0, mentions: 1, image: "https://images.unsplash.com/photo-1527661591475-527312dd65f5?w=100&h=100&fit=crop" },
]

const CustomTooltip = ({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ value: number; dataKey: string; color: string }>
  label?: string
}) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white border border-[#EDE4D5] border border-[#EDE4D5] rounded-lg p-3 shadow-lg">
        <p className="text-[#2C1810] text-sm font-medium mb-1">{label}</p>
        {payload.map((entry, index) => (
          <p key={index} className="text-[#B89A7D] text-sm">
            {entry.dataKey}: {entry.value}
          </p>
        ))}
      </div>
    )
  }
  return null
}

// Star rating component
function StarRating({ rating, size = 16 }: { rating: number; size?: number }) {
  const fullStars = Math.floor(rating)
  const hasHalfStar = rating % 1 >= 0.5
  const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0)

  return (
    <div className="flex items-center gap-0.5">
      {Array(fullStars).fill(0).map((_, i) => (
        <Star key={`full-${i}`} className="fill-[#E28B4B] text-[#C4956A]" style={{ width: size, height: size }} />
      ))}
      {hasHalfStar && <StarHalf className="fill-[#E28B4B] text-[#C4956A]" style={{ width: size, height: size }} />}
      {Array(emptyStars).fill(0).map((_, i) => (
        <Star key={`empty-${i}`} className="text-[#C4956A]" style={{ width: size, height: size }} />
      ))}
    </div>
  )
}

// Review stars based on rating number
function ReviewStars({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array(5).fill(0).map((_, i) => (
        <Star
          key={i}
          className={`w-3.5 h-3.5 ${i < rating ? "fill-[#E28B4B] text-[#C4956A]" : "text-[#8E7F71]"}`}
        />
      ))}
    </div>
  )
}

export default function AnalyticsPage() {
  const [activeFilter, setActiveFilter] = useState<number | null>(null)
  const [analytics, setAnalytics] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let mounted = true
      ; (async () => {
        try {
          const res = await getAnalyticsData()
          if (!mounted) return
          setAnalytics(res)
        } finally {
          if (!mounted) return
          setIsLoading(false)
        }
      })()

    return () => {
      mounted = false
    }
  }, [])

  const menuViewsToday = analytics?.menuViewsToday ?? 0
  const avgRatingValue = analytics?.avgRating ?? reviewsData.averageRating
  const totalReviewsValue = analytics?.totalReviews ?? reviewsData.totalReviews
  const publicReviewsValue = analytics?.publicReviews ?? reviewsData.publicReviews
  const privateReviewsValue =
    totalReviewsValue - publicReviewsValue

  const topCartBarData =
    analytics?.topCartDishes?.length ? analytics.topCartDishes : mostAddedToCartData
  const topFavouritesBarData =
    analytics?.topFavourites?.length ? analytics.topFavourites : mostFavouritedData

  const filteredReviews = activeFilter === null
    ? recentReviews
    : recentReviews.filter(r => r.stars === activeFilter)

  const getBarColor = (stars: number) => {
    if (stars === 5) return "#22c55e"
    if (stars === 4) return "#E28B4B"
    if (stars === 3) return "#C18F58"
    return "#ef4444"
  }

  return (
    <AdminLayout>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-[#2C1810] font-bold text-3xl mb-2">Analytics</h1>
        <p className="text-[#B89A7D]">
          Track QR scans and engagement. Menu views today:{" "}
          {isLoading ? "..." : menuViewsToday.toLocaleString()}
        </p>
      </div>

      {/* Row 1: Line Chart and Grouped Bar Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Weekly QR Scans - Line Chart */}
        <div className="bg-white border border-[#EDE4D5] rounded-xl p-6">
          <h2 className="text-[#2C1810] font-bold text-lg mb-6">Weekly QR scans</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={weeklyScansData}>
                <XAxis
                  dataKey="day"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#8a6a52", fontSize: 12 }}
                />
                <YAxis hide />
                <Tooltip content={<CustomTooltip />} />
                <Line
                  type="monotone"
                  dataKey="scans"
                  stroke="#E8650A"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Scans vs Favourites - Grouped Bar Chart */}
        <div className="bg-white border border-[#EDE4D5] rounded-xl p-6">
          <h2 className="text-[#2C1810] font-bold text-lg mb-6">
            Scans vs favourites
          </h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={scansVsFavouritesData} barGap={2}>
                <XAxis
                  dataKey="day"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#8a6a52", fontSize: 12 }}
                />
                <YAxis hide />
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  wrapperStyle={{ paddingTop: 20 }}
                  formatter={(value) => (
                    <span className="text-[#B89A7D] text-sm">{value}</span>
                  )}
                />
                <Bar
                  dataKey="scans"
                  fill="#E8650A"
                  radius={[4, 4, 0, 0]}
                  name="QR scans"
                />
                <Bar
                  dataKey="favourites"
                  fill="#B85A00"
                  radius={[4, 4, 0, 0]}
                  name="Favourites"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Row 2: Horizontal Bar Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Most Added to Cart */}
        <div className="bg-white border border-[#EDE4D5] rounded-xl p-6">
          <h2 className="text-[#2C1810] font-bold text-lg mb-6">
            Most Added to Cart
          </h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topCartBarData} layout="vertical">
                <XAxis
                  type="number"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#8a6a52", fontSize: 12 }}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#fff", fontSize: 12 }}
                  width={100}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="count" fill="#E8650A" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Most Favourited */}
        <div className="bg-white border border-[#EDE4D5] rounded-xl p-6">
          <h2 className="text-[#2C1810] font-bold text-lg mb-6">Most Favourited</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topFavouritesBarData} layout="vertical">
                <XAxis
                  type="number"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#8a6a52", fontSize: 12 }}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#fff", fontSize: 12 }}
                  width={100}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="count" fill="#E8650A" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Row 3: Top Dishes This Week */}
      <div className="bg-white border border-[#EDE4D5] rounded-xl p-6 mb-8">
        <h2 className="text-[#2C1810] font-bold text-lg mb-6">
          Top Dishes This Week
        </h2>
        <div className="space-y-1">
          {topDishesData.map((dish, index) => (
            <div
              key={dish.rank}
              className={`flex items-center gap-4 p-4 rounded-lg ${index % 2 === 0 ? "bg-white/[0.02]" : ""
                }`}
            >
              <span className="text-[#C4956A] font-bold text-lg w-8">
                #{dish.rank}
              </span>
              <div className="w-10 h-10 rounded-full overflow-hidden">
                <Image
                  src={dish.image || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=300&fit=crop"}
                  alt={dish.name}
                  width={40}
                  height={40}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex-1">
                <p className="text-[#2C1810] font-medium">{dish.name}</p>
                <p className="text-[#B89A7D] text-sm">{dish.category}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[#B89A7D] text-sm">
                  {dish.views} views
                </span>
                {dish.trending === "up" ? (
                  <TrendingUp className="w-4 h-4 text-[#22c55e]" />
                ) : (
                  <TrendingDown className="w-4 h-4 text-[#ef4444]" />
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ============ REVIEW ANALYTICS SECTION ============ */}

      {/* Review Analytics Header */}
      <div className="mb-6">
        <h2 className="text-[#2C1810] font-bold text-2xl mb-1">Review Analytics</h2>
        <p className="text-[#8E7F71] text-sm">Based on guest feedback collected.</p>
      </div>

      {/* Row 1: 4 Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {/* Total Reviews */}
        <div className="bg-white border border-[#EDE4D5] rounded-xl p-5">
          <div className="flex items-start justify-between mb-3">
            <span className="text-[#8E7F71] text-sm">Total Reviews</span>
            <Star className="w-5 h-5 text-[#C4956A]" />
          </div>
          <p className="text-[#2C1810] font-bold text-3xl mb-1">
            {isLoading ? "..." : totalReviewsValue}
          </p>
          <p className="text-[#8E7F71] text-xs">All time</p>
        </div>

        {/* Average Rating */}
        <div className="bg-white border border-[#EDE4D5] rounded-xl p-5">
          <div className="flex items-start justify-between mb-3">
            <span className="text-[#8E7F71] text-sm">Average Rating</span>
            <Star className="w-5 h-5 fill-[#E28B4B] text-[#C4956A]" />
          </div>
          <p className="text-[#C4956A] font-bold text-3xl mb-2">
            {isLoading ? "..." : avgRatingValue}
          </p>
          <StarRating rating={avgRatingValue} size={16} />
        </div>

        {/* Public Reviews */}
        <div className="bg-white border border-[#EDE4D5] rounded-xl p-5">
          <div className="flex items-start justify-between mb-3">
            <span className="text-[#8E7F71] text-sm">Public Reviews</span>
            <Eye className="w-5 h-5 text-[#22c55e]" />
          </div>
          <p className="text-[#22c55e] font-bold text-3xl mb-1">
            {isLoading ? "..." : publicReviewsValue}
          </p>
          <p className="text-[#8E7F71] text-xs">Visible to guests</p>
        </div>

        {/* Private Reviews */}
        <div className="bg-white border border-[#EDE4D5] rounded-xl p-5">
          <div className="flex items-start justify-between mb-3">
            <span className="text-[#8E7F71] text-sm">Private Reviews</span>
            <EyeOff className="w-5 h-5 text-[#ef4444]" />
          </div>
          <p className="text-[#ef4444] font-bold text-3xl mb-1">
            {isLoading ? "..." : privateReviewsValue}
          </p>
          <p className="text-[#8E7F71] text-xs">Hidden from guests</p>
        </div>
      </div>

      {/* Row 2: Rating Distribution + Recent Reviews */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Rating Distribution */}
        <div className="bg-white border border-[#EDE4D5] rounded-xl p-6">
          <h3 className="text-[#2C1810] font-bold text-lg mb-5">Rating Distribution</h3>
          <div className="space-y-3">
            {reviewsData.ratingDistribution.map((item) => (
              <div key={item.stars} className="flex items-center gap-3">
                <span className="text-[#2C1810] text-sm w-10">{item.stars} ★</span>
                <div className="flex-1 h-2.5 bg-[#221C18] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${item.percentage}%`,
                      backgroundColor: getBarColor(item.stars),
                    }}
                  />
                </div>
                <span className="text-[#2C1810] text-sm w-7 text-right">{item.count}</span>
                <span className="text-[#8E7F71] text-xs w-12 text-right">({item.percentage}%)</span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Guest Reviews */}
        <div className="bg-white border border-[#EDE4D5] rounded-xl p-6">
          <h3 className="text-[#2C1810] font-bold text-lg mb-4">Recent Guest Reviews</h3>

          {/* Filter Pills */}
          <div className="flex flex-wrap gap-2 mb-4">
            <button
              onClick={() => setActiveFilter(null)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${activeFilter === null
                ? "bg-[#3B2314] text-[#E7CFA8] text-[#E7CFA8]"
                : "bg-[#221C18] text-[#8E7F71] hover:text-[#2C1810]"
                }`}
            >
              All
            </button>
            {[5, 4, 3, 2, 1].map((star) => (
              <button
                key={star}
                onClick={() => setActiveFilter(star)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${activeFilter === star
                  ? "bg-[#3B2314] text-[#E7CFA8] text-[#E7CFA8]"
                  : "bg-[#221C18] text-[#8E7F71] hover:text-[#2C1810]"
                  }`}
              >
                {star}★
              </button>
            ))}
          </div>

          {/* Reviews List */}
          <div className="space-y-0">
            {filteredReviews.map((review) => (
              <div
                key={review.id}
                className="py-3 border-b border-white/[0.06] last:border-b-0"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <ReviewStars rating={review.stars} />
                  <span className="text-[#8E7F71] text-xs">{review.date}</span>
                </div>
                <p className="text-[#2C1810] text-sm italic line-clamp-2 mb-2">
                  {'"'}{review.text}{'"'}
                </p>
                <div className="flex items-center justify-between">
                  <span className="text-[#C4956A] text-sm font-bold">{review.reviewer}</span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-medium ${review.isPublic
                      ? "bg-[#22c55e]/20 text-[#22c55e]"
                      : "bg-[#ef4444] text-[#2C1810]"
                      }`}
                  >
                    {review.isPublic ? "Public" : "Private"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Row 3: Top Rated Dishes */}
      <div className="bg-white border border-[#EDE4D5] rounded-xl p-6">
        <h3 className="text-[#2C1810] font-bold text-lg mb-5">Top Rated Dishes</h3>
        <div className="space-y-0">
          {topRatedDishes.map((dish, index) => (
            <div
              key={dish.rank}
              className={`flex items-center gap-4 py-3 border-b border-white/[0.05] last:border-b-0 hover:bg-white/[0.02] transition-colors ${index === 0 ? "pt-0" : ""
                }`}
            >
              <div
                className="w-7 h-7 rounded-full bg-[#3B2314] text-[#E7CFA8] text-[#E7CFA8] flex items-center justify-center font-bold text-sm"
              >
                #{dish.rank}
              </div>
              <div className="w-10 h-10 rounded-full overflow-hidden">
                <Image
                  src={dish.image || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=300&fit=crop"}
                  alt={dish.name}
                  width={40}
                  height={40}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex-1">
                <p className="text-[#2C1810] font-bold text-sm">{dish.name}</p>
                <p className="text-[#8E7F71] text-xs">{dish.category}</p>
              </div>
              <div className="flex items-center gap-1">
                {Array(Math.floor(dish.rating)).fill(0).map((_, i) => (
                  <Star key={i} className="w-3.5 h-3.5 fill-[#E28B4B] text-[#C4956A]" />
                ))}
                {dish.rating % 1 >= 0.5 && (
                  <StarHalf className="w-3.5 h-3.5 fill-[#E28B4B] text-[#C4956A]" />
                )}
              </div>
              <span className="text-[#8E7F71] text-sm">{dish.mentions} mentions</span>
            </div>
          ))}
        </div>
      </div>
    </AdminLayout>
  )
}
