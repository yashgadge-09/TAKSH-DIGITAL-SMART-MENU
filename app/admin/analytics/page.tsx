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

const mostAddedToCartData = [
  { name: "Paneer Tikka", count: 145 },
  { name: "Butter Paneer", count: 132 },
  { name: "Veg Biryani", count: 98 },
  { name: "Samosa", count: 87 },
  { name: "Dal Makhani", count: 76 },
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

// Google Review Analytics Data
const reviewsData = {
  totalReviews: 1009,
  averageRating: 4.3,
  publicReviews: 880,
  privateReviews: 129,
  ratingDistribution: [
    { stars: 5, count: 760, percentage: 75.3 },
    { stars: 4, count: 120, percentage: 11.9 },
    { stars: 3, count: 40, percentage: 4.0 },
    { stars: 2, count: 20, percentage: 2.0 },
    { stars: 1, count: 69, percentage: 6.8 },
  ],
}

const recentReviews = [
  { id: 1, stars: 5, text: "Good Service, Best Food, Great Staff. Meal type: Dinner", reviewer: "Sanket Ghodekar", date: "2 weeks ago", isPublic: true },
  { id: 2, stars: 5, text: "The experience was good. Meal type: Dinner. Food: 5, Service: 5, Atmosphere: 5", reviewer: "Aditya Gupta", date: "2 weeks ago", isPublic: true },
  { id: 3, stars: 5, text: "Meal type: Dinner. Food: 4, Service: 4, Atmosphere: 4", reviewer: "anita joshi", date: "2 weeks ago", isPublic: true },
  { id: 4, stars: 5, text: "Food: 5, Service: 5. Good food, nice atmosphere. Meal type: Dinner", reviewer: "Omkar Chavan", date: "3 weeks ago", isPublic: true },
  { id: 5, stars: 5, text: "Amazing food quality. Highly recommended for family dinner.", reviewer: "Pratik Pawar", date: "1 month ago", isPublic: true },
]

const topRatedDishes = [
  { rank: 1, name: "Paneer Tikka", category: "Starter", rating: 4.9, mentions: 145, image: "https://images.unsplash.com/photo-1567188040759-fb8a883dc6d8?w=100&h=100&fit=crop" },
  { rank: 2, name: "Dal Makhani", category: "Main Course", rating: 4.8, mentions: 132, image: "https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=100&h=100&fit=crop" },
  { rank: 3, name: "Veg Biryani", category: "Rice", rating: 4.7, mentions: 98, image: "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=100&h=100&fit=crop" },
  { rank: 4, name: "Gulab Jamun", category: "Desserts", rating: 4.7, mentions: 87, image: "https://images.unsplash.com/photo-1666190094745-d1ff2fa8f924?w=100&h=100&fit=crop" },
  { rank: 5, name: "Mango Lassi", category: "Cold Drinks", rating: 4.6, mentions: 76, image: "https://images.unsplash.com/photo-1527661591475-527312dd65f5?w=100&h=100&fit=crop" },
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
      <div className="bg-[#1C1510] border border-white/10 rounded-lg p-3 shadow-lg">
        <p className="text-white text-sm font-medium mb-1">{label}</p>
        {payload.map((entry, index) => (
          <p key={index} className="text-[#8a6a52] text-sm">
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
        <Star key={`full-${i}`} className="fill-[#E28B4B] text-[#E28B4B]" style={{ width: size, height: size }} />
      ))}
      {hasHalfStar && <StarHalf className="fill-[#E28B4B] text-[#E28B4B]" style={{ width: size, height: size }} />}
      {Array(emptyStars).fill(0).map((_, i) => (
        <Star key={`empty-${i}`} className="text-[#E28B4B]" style={{ width: size, height: size }} />
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
          className={`w-3.5 h-3.5 ${i < rating ? "fill-[#E28B4B] text-[#E28B4B]" : "text-[#8E7F71]"}`}
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
  
  // Transform topRatedDishes for the bar chart
  const topRatedBarData = topRatedDishes.map(d => ({
    name: d.name,
    count: d.rating // Use rating as the value for the bar
  }))

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
        <h1 className="text-white font-bold text-3xl mb-2">Business Analytics</h1>
        <p className="text-[#8a6a52]">
          Real-time performance metrics and guest engagement data for <span className="text-white font-medium">TAKSH Veg</span>.
        </p>
      </div>

      {/* Row 0: Metric Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-[#151210] border border-white/[0.05] rounded-xl p-6 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-[#E8650A]/5 blur-3xl rounded-full" />
          <p className="text-[#8a6a52] text-sm font-medium mb-1">QR Scans Today</p>
          <div className="flex items-end gap-2">
            <p className="text-white font-bold text-3xl">{menuViewsToday.toLocaleString()}</p>
            <span className="text-[#22c55e] text-xs font-bold mb-1 flex items-center">
              <TrendingUp className="w-3 h-3 mr-0.5" /> +12%
            </span>
          </div>
        </div>
        <div className="bg-[#151210] border border-white/[0.05] rounded-xl p-6 relative overflow-hidden">
          <p className="text-[#8a6a52] text-sm font-medium mb-1">Cart Additions</p>
          <div className="flex items-end gap-2">
            <p className="text-white font-bold text-3xl">342</p>
            <span className="text-[#22c55e] text-xs font-bold mb-1 flex items-center">
              <TrendingUp className="w-3 h-3 mr-0.5" /> +8%
            </span>
          </div>
        </div>
        <div className="bg-[#151210] border border-white/[0.05] rounded-xl p-6 relative overflow-hidden">
          <p className="text-[#8a6a52] text-sm font-medium mb-1">Top Dish Today</p>
          <p className="text-[#E28B4B] font-bold text-xl truncate">Paneer Tikka</p>
          <p className="text-[#8a6a52] text-[10px] uppercase font-bold mt-1">145 Orders</p>
        </div>
        <div className="bg-[#151210] border border-white/[0.05] rounded-xl p-6 relative overflow-hidden">
          <p className="text-[#8a6a52] text-sm font-medium mb-1">Google Rating</p>
          <div className="flex items-center gap-2">
            <p className="text-white font-bold text-3xl">{reviewsData.averageRating}</p>
            <div className="flex flex-col">
              <ReviewStars rating={Math.floor(reviewsData.averageRating)} />
              <span className="text-[#8a6a52] text-[10px] font-bold">1,009 REVIEWS</span>
            </div>
          </div>
        </div>
      </div>

      {/* Row 1: Symmetrical 3-Column Chart Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Weekly QR Scans */}
        <div className="bg-[#151210] border border-white/[0.03] rounded-xl p-6 flex flex-col h-[380px]">
          <h2 className="text-white font-bold text-lg mb-6">Weekly QR scans</h2>
          <div className="flex-1 min-h-0">
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
                  dot={{ r: 4, fill: "#E8650A", strokeWidth: 2, stroke: "#151210" }}
                  activeDot={{ r: 6, strokeWidth: 0 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Most Added to Cart */}
        <div className="bg-[#151210] border border-white/[0.03] rounded-xl p-6 flex flex-col h-[380px]">
          <h2 className="text-white font-bold text-lg mb-6">Most Added to Cart</h2>
          <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topCartBarData} layout="vertical">
                <XAxis type="number" hide />
                <YAxis
                  type="category"
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#fff", fontSize: 11 }}
                  width={90}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar 
                  dataKey="count" 
                  fill="#E8650A" 
                  radius={[0, 4, 4, 0]} 
                  barSize={12}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Rated Dishes */}
        <div className="bg-[#151210] border border-white/[0.03] rounded-xl p-6 flex flex-col h-[380px]">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-white font-bold text-lg">Top Rated Dishes</h2>
            <div className="flex items-center gap-1 group cursor-help">
              <Star className="w-4 h-4 fill-[#E28B4B] text-[#E28B4B]" />
              <span className="text-[#E28B4B] font-bold text-xs uppercase tracking-wider">Verified</span>
            </div>
          </div>
          <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topRatedBarData} layout="vertical">
                <XAxis type="number" domain={[0, 5]} hide />
                <YAxis
                  type="category"
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#fff", fontSize: 11 }}
                  width={90}
                />
                <Tooltip 
                  content={<CustomTooltip />}
                  formatter={(value) => [`${value} Stars`, 'Rating']}
                />
                <Bar 
                  dataKey="count" 
                  fill="#E28B4B" 
                  radius={[0, 4, 4, 0]} 
                  barSize={12}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Row 2: Top Dishes This Week */}
      <div className="bg-[#151210] border border-white/[0.03] rounded-xl p-6 mb-8">
        <h2 className="text-white font-bold text-lg mb-6">
          Top Dishes This Week
        </h2>
        <div className="space-y-1">
          {topDishesData.map((dish, index) => (
            <div
              key={dish.rank}
              className={`flex items-center gap-4 p-4 rounded-lg ${index % 2 === 0 ? "bg-white/[0.02]" : ""
                }`}
            >
              <span className="text-[#E8650A] font-bold text-lg w-8">
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
                <p className="text-white font-medium">{dish.name}</p>
                <p className="text-[#8a6a52] text-sm">{dish.category}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[#8a6a52] text-sm">
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

      {/* ============ GOOGLE REVIEW ANALYTICS SECTION ============ */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h2 className="text-[#E7CFA8] font-bold text-2xl">Google Review Analytics</h2>
            <div className="flex items-center gap-1.5 px-2 py-0.5 bg-[#4285F4]/10 border border-[#4285F4]/20 rounded-md">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31l3.58 2.78c2.09-1.93 3.3-4.77 3.3-8.1z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.58-2.78c-1 .67-2.28 1.07-3.7 1.07-2.85 0-5.27-1.92-6.13-4.51H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.87 14.12c-.22-.67-.35-1.38-.35-2.12s.13-1.45.35-2.12V7.04H2.18C1.43 8.55 1 10.22 1 12c0 1.78.43 3.45 1.18 4.96l3.69-2.84z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.04l3.69 2.84c.86-2.59 3.28-4.51 6.13-4.51z" fill="#EA4335"/>
              </svg>
              <span className="text-[#4285F4] text-[10px] font-bold uppercase tracking-wider">Verified Business</span>
            </div>
          </div>
          <p className="text-[#8E7F71] text-sm">Real-time data synced with your Google Business Profile.</p>
        </div>
        <a 
          href="https://www.google.com/maps/place/TAKSH+Veg/@18.6412482,73.7539021,17z/data=!4m8!3m7!1s0x3bc2b9f2ecc97da9:0xbe640886b8aa715f!8m2!3d18.6412431!4d73.756477!9m1!1b1!16s%2Fg%2F11jzpjmcr9"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#E28B4B] text-sm font-medium hover:underline flex items-center gap-1.5"
        >
          View all on Google Maps
        </a>
      </div>

      {/* Row 1: 4 Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {/* Total Reviews */}
        <div className="bg-[#15110F] rounded-xl p-5 border border-white/[0.03]">
          <div className="flex items-start justify-between mb-3">
            <span className="text-[#8E7F71] text-sm">Total Reviews</span>
            <Star className="w-5 h-5 text-[#E28B4B]" />
          </div>
          <p className="text-[#E7CFA8] font-bold text-3xl mb-1">
            {reviewsData.totalReviews}
          </p>
          <p className="text-[#22c55e] text-xs flex items-center gap-1">
            <TrendingUp className="w-3 h-3" /> +12 this week
          </p>
        </div>

        {/* Average Rating */}
        <div className="bg-[#15110F] rounded-xl p-5 border border-white/[0.03]">
          <div className="flex items-start justify-between mb-3">
            <span className="text-[#8E7F71] text-sm">Average Rating</span>
            <div className="w-10 h-10 -mt-2 -mr-2 bg-[#4285F4]/10 rounded-full flex items-center justify-center">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31l3.58 2.78c2.09-1.93 3.3-4.77 3.3-8.1z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.58-2.78c-1 .67-2.28 1.07-3.7 1.07-2.85 0-5.27-1.92-6.13-4.51H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.87 14.12c-.22-.67-.35-1.38-.35-2.12s.13-1.45.35-2.12V7.04H2.18C1.43 8.55 1 10.22 1 12c0 1.78.43 3.45 1.18 4.96l3.69-2.84z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.04l3.69 2.84c.86-2.59 3.28-4.51 6.13-4.51z" fill="#EA4335"/>
              </svg>
            </div>
          </div>
          <p className="text-[#E28B4B] font-bold text-3xl mb-2">
            {reviewsData.averageRating}
          </p>
          <StarRating rating={reviewsData.averageRating} size={16} />
        </div>

        {/* 5-Star Reviews */}
        <div className="bg-[#15110F] rounded-xl p-5 border border-white/[0.03]">
          <div className="flex items-start justify-between mb-3">
            <span className="text-[#8E7F71] text-sm">5-Star Reviews</span>
            <div className="w-5 h-5 rounded-full bg-[#22c55e]/20 flex items-center justify-center">
              <TrendingUp className="w-3 h-3 text-[#22c55e]" />
            </div>
          </div>
          <p className="text-[#22c55e] font-bold text-3xl mb-1">
            {reviewsData.ratingDistribution[0].count}
          </p>
          <p className="text-[#8E7F71] text-xs">75.3% of total</p>
        </div>

        {/* Review Mentions */}
        <div className="bg-[#15110F] rounded-xl p-5 border border-white/[0.03]">
          <div className="flex items-start justify-between mb-3">
            <span className="text-[#8E7F71] text-sm">Review Mentions</span>
            <TrendingUp className="w-5 h-5 text-[#E7CFA8]" />
          </div>
          <p className="text-[#E7CFA8] font-bold text-3xl mb-1">
            450+
          </p>
          <p className="text-[#8E7F71] text-xs">Dish specific feedback</p>
        </div>
      </div>

      {/* Row 2: Rating Distribution + Recent Reviews */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Rating Distribution */}
        <div className="bg-[#15110F] rounded-xl p-6">
          <h3 className="text-[#E7CFA8] font-bold text-lg mb-5">Rating Distribution</h3>
          <div className="space-y-3">
            {reviewsData.ratingDistribution.map((item) => (
              <div key={item.stars} className="flex items-center gap-3">
                <span className="text-[#E7CFA8] text-sm w-10">{item.stars} ★</span>
                <div className="flex-1 h-2.5 bg-[#221C18] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${item.percentage}%`,
                      backgroundColor: getBarColor(item.stars),
                    }}
                  />
                </div>
                <span className="text-[#E7CFA8] text-sm w-7 text-right">{item.count}</span>
                <span className="text-[#8E7F71] text-xs w-12 text-right">({item.percentage}%)</span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Guest Reviews */}
        <div className="bg-[#15110F] rounded-xl p-6">
          <h3 className="text-[#E7CFA8] font-bold text-lg mb-4">Recent Guest Reviews</h3>

          {/* Filter Pills */}
          <div className="flex flex-wrap gap-2 mb-4">
            <button
              onClick={() => setActiveFilter(null)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${activeFilter === null
                ? "bg-[#E28B4B] text-[#0D0B0A]"
                : "bg-[#221C18] text-[#8E7F71] hover:text-[#E7CFA8]"
                }`}
            >
              All
            </button>
            {[5, 4, 3, 2, 1].map((star) => (
              <button
                key={star}
                onClick={() => setActiveFilter(star)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${activeFilter === star
                  ? "bg-[#E28B4B] text-[#0D0B0A]"
                  : "bg-[#221C18] text-[#8E7F71] hover:text-[#E7CFA8]"
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
                <p className="text-[#E7CFA8] text-sm italic line-clamp-2 mb-2">
                  {'"'}{review.text}{'"'}
                </p>
                <div className="flex items-center justify-between">
                  <span className="text-[#E28B4B] text-sm font-bold">{review.reviewer}</span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-medium ${review.isPublic
                      ? "bg-[#22c55e]/20 text-[#22c55e]"
                      : "bg-[#ef4444] text-white"
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

      {/* Google Review Analytics Info Footer */}
      <div className="bg-[#15110F] rounded-xl p-6 border border-white/[0.03] text-center">
        <p className="text-[#8E7F71] text-sm">
          Analytics are updated daily using Google Places API. Showing data for <span className="text-[#E7CFA8] font-bold">TAKSH Veg, Nigdi</span>.
        </p>
      </div>
    </AdminLayout>
  )
}
