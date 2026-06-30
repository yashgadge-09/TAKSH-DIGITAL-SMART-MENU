"use client"

import { useEffect, useState, type ReactNode } from "react"
import { AdminLayout } from "@/components/AdminSidebar"
import { getAnalyticsData } from "@/lib/database"
import { supabase } from "@/lib/supabase"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts"
import {
  TrendingUp,
  TrendingDown,
  Star,
  Eye,
  EyeOff,
  StarHalf,
  MessageSquare,
  ScanLine,
  MapPin,
  ExternalLink,
} from "lucide-react"
import Image from "next/image"

const EMPTY_RATING_DISTRIBUTION = [
  { stars: 5, count: 0, percentage: 0 },
  { stars: 4, count: 0, percentage: 0 },
  { stars: 3, count: 0, percentage: 0 },
  { stars: 2, count: 0, percentage: 0 },
  { stars: 1, count: 0, percentage: 0 },
]

type GoogleDistributionItem = {
  stars: number
  count: number
  percentage: number
}

type GoogleRecentReview = {
  id: string
  reviewer: string
  reviewerUrl?: string
  profilePhotoUrl?: string
  stars: number
  text: string
  relativeTime?: string
}

type GoogleStats = {
  rating: number
  reviewsCount: number
  distribution: GoogleDistributionItem[]
  recentReviews: GoogleRecentReview[]
  mapsUrl?: string
  source?: string
  placeName?: string
  lastUpdated?: string
  error?: string
}

const DATE_RANGES: Array<7 | 30 | 90> = [7, 30, 90]
const FALLBACK_DISH_IMAGE =
  "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=300&fit=crop"

const panelClassName =
  "relative overflow-hidden rounded-2xl border border-[#6B452E] bg-[radial-gradient(circle_at_top_right,rgba(232,101,10,0.22)_0%,rgba(36,23,14,0.97)_48%,rgba(20,12,8,1)_100%)] shadow-[0_18px_48px_rgba(25,14,8,0.55)]"

function PremiumPanel({
  title,
  subtitle,
  badge,
  children,
  className = "",
}: {
  title: string
  subtitle?: string
  badge?: string
  children: ReactNode
  className?: string
}) {
  return (
    <section className={`${panelClassName} ${className}`}>
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(110deg,rgba(255,191,118,0.08)_0%,rgba(255,191,118,0)_40%,rgba(232,101,10,0.08)_100%)]" />
      <div className="relative p-6 sm:p-7">
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-[#F7E4C4] text-lg font-semibold tracking-[0.01em]">{title}</h2>
            {subtitle ? <p className="mt-1 text-sm text-[#C9A983]">{subtitle}</p> : null}
          </div>
          {badge ? (
            <span className="rounded-md border border-[#80512E] bg-[#3B2314]/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#F2B55A]">
              {badge}
            </span>
          ) : null}
        </div>
        {children}
      </div>
    </section>
  )
}

const CustomTooltip = ({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ value: number; dataKey?: string }>
  label?: string
}) => {
  if (!active || !payload || payload.length === 0) {
    return null
  }

  return (
    <div className="rounded-xl border border-[#83522D] bg-[linear-gradient(160deg,rgba(55,34,21,0.98),rgba(21,12,7,0.98))] p-3 shadow-[0_16px_30px_rgba(0,0,0,0.55)] backdrop-blur-sm">
      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-[#F2C786]">{label}</p>
      <div className="space-y-1.5">
        {payload.map((entry, index) => (
          <p key={index} className="text-sm text-[#EAD2AF]">
            <span className="text-[#C7A67E]">{entry.dataKey}:</span> {entry.value}
          </p>
        ))}
      </div>
    </div>
  )
}

function StarRating({ rating, size = 16 }: { rating: number; size?: number }) {
  const fullStars = Math.floor(rating)
  const hasHalfStar = rating % 1 >= 0.5
  const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0)

  return (
    <div className="flex items-center gap-0.5">
      {Array(fullStars)
        .fill(0)
        .map((_, i) => (
          <Star
            key={`full-${i}`}
            className="fill-[#F3A33B] text-[#F2BC68]"
            style={{ width: size, height: size }}
          />
        ))}
      {hasHalfStar ? (
        <StarHalf className="fill-[#F3A33B] text-[#F2BC68]" style={{ width: size, height: size }} />
      ) : null}
      {Array(emptyStars)
        .fill(0)
        .map((_, i) => (
          <Star key={`empty-${i}`} className="text-[#916947]" style={{ width: size, height: size }} />
        ))}
    </div>
  )
}

function ReviewStars({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array(5)
        .fill(0)
        .map((_, i) => (
          <Star
            key={i}
            className={`h-3.5 w-3.5 ${i < rating ? "fill-[#F3A33B] text-[#F2BC68]" : "text-[#7A5A40]"}`}
          />
        ))}
    </div>
  )
}

function getBarColor(stars: number) {
  if (stars === 5) return "#F6B34A"
  if (stars === 4) return "#E79334"
  if (stars === 3) return "#C8752A"
  if (stars === 2) return "#A75824"
  return "#8D4422"
}

function getInitials(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "G"
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase()
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
}

// ── Reports helpers ──────────────────────────────────────────────────────────

type BillRow = { total: number; generated_at: string }

function todayIST() {
  const istNow = new Date(Date.now() + 5.5 * 60 * 60 * 1000)
  return istNow.toISOString().slice(0, 10)
}

function getISTDayBounds(dateStr: string) {
  return {
    start: `${dateStr}T00:00:00+05:30`,
    end:   `${dateStr}T23:59:59+05:30`,
  }
}

function billTimeIST(iso: string) {
  return new Date(iso).toLocaleTimeString("en-IN", {
    hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata",
  })
}

export default function AnalyticsPage() {
  const [activeFilter, setActiveFilter] = useState<number | null>(null)
  const [analytics, setAnalytics] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [rangeDays, setRangeDays] = useState<7 | 30 | 90>(7)
  const [googleStats, setGoogleStats] = useState<GoogleStats | null>(null)
  const [isGoogleLoading, setIsGoogleLoading] = useState(true)

  // Reports state
  const [selectedDate, setSelectedDate] = useState(todayIST())
  const [bills, setBills] = useState<BillRow[]>([])
  const [billsLoading, setBillsLoading] = useState(true)
  const [restId, setRestId] = useState<string | null>(null)

  useEffect(() => {
    const fetchGoogleStats = async () => {
      try {
        const res = await fetch("/api/google-stats")
        const data = (await res.json()) as GoogleStats
        setGoogleStats(data)
      } catch (e) {
        console.error("Failed to fetch Google stats", e)
      } finally {
        setIsGoogleLoading(false)
      }
    }
    fetchGoogleStats()
  }, [])

  useEffect(() => {
    let mounted = true
    ;(async () => {
      setError(null)
      setIsLoading(true)
      try {
        const res = await getAnalyticsData(rangeDays)
        if (!mounted) return
        setAnalytics(res)
      } catch (e: any) {
        if (!mounted) return
        setError(e?.message || "Failed to load analytics")
      } finally {
        if (!mounted) return
        setIsLoading(false)
      }
    })()

    return () => {
      mounted = false
    }
  }, [rangeDays])

  // Reports: resolve restaurant ID once
  useEffect(() => {
    let mounted = true
    ;(async () => {
      const { data: rest, error } = await supabase
        .from("restaurants").select("id").eq("slug", "taksh").single()
      if (mounted && !error && rest) setRestId(rest.id)
      else if (mounted) setBillsLoading(false)
    })()
    return () => { mounted = false }
  }, [])

  // Reports: fetch bills when date or restId changes
  useEffect(() => {
    if (!restId) return
    let mounted = true
    setBillsLoading(true)
    ;(async () => {
      const { start, end } = getISTDayBounds(selectedDate)
      const { data, error } = await supabase
        .from("bills")
        .select("total, generated_at, table_sessions!inner(restaurant_id)")
        .eq("table_sessions.restaurant_id", restId)
        .gte("generated_at", start)
        .lte("generated_at", end)
        .order("generated_at", { ascending: false })
      if (!mounted) return
      if (error) { setBillsLoading(false); return }
      setBills((data ?? []) as unknown as BillRow[])
      setBillsLoading(false)
    })()
    return () => { mounted = false }
  }, [restId, selectedDate])

  const menuViewsToday = analytics?.menuViewsToday ?? 0
  const avgRatingValue = analytics?.avgRating ?? 0
  const totalReviewsValue = analytics?.totalReviews ?? 0
  const publicReviewsValue = analytics?.publicReviews ?? 0
  const privateReviewsValue = totalReviewsValue - publicReviewsValue

  const weeklyLineData = analytics?.weeklyCustomers || []
  const topDishesWeekData = analytics?.topDishesThisWeek || []
  const ratingDistributionData = analytics?.ratingDistribution || EMPTY_RATING_DISTRIBUTION
  const reviewListData = analytics?.recentReviews || []
  const topRatedDishesData = analytics?.topRatedDishes || []
  const queryWarning = analytics?.queryWarning || null
  const googleRatingValue = Number(googleStats?.rating || 0)
  const googleReviewsCount = Number(googleStats?.reviewsCount || 0)
  const googleMapsUrl = googleStats?.mapsUrl || ""
  const googleDistributionData = googleStats?.distribution || EMPTY_RATING_DISTRIBUTION
  const googleRecentReviews = googleStats?.recentReviews || []
  const googleLastUpdated = googleStats?.lastUpdated
    ? new Date(googleStats.lastUpdated).toLocaleString("en-IN")
    : "Not synced yet"

  const filteredReviews =
    activeFilter === null ? reviewListData : reviewListData.filter((r: any) => r.stars === activeFilter)

  const maxWeekViews = Math.max(...topDishesWeekData.map((dish: any) => Number(dish.views) || 0), 1)
  const maxMentions = Math.max(...topRatedDishesData.map((dish: any) => Number(dish.mentions) || 0), 1)

  return (
    <AdminLayout>
      <div className="space-y-6">

        {/* Date picker */}
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-[#6B5744]">Date</label>
          <input
            type="date"
            value={selectedDate}
            max={todayIST()}
            onChange={e => setSelectedDate(e.target.value)}
            className="rounded-xl border border-[#D4B391] bg-white px-3 py-2 text-sm text-[#2C1810] focus:outline-none focus:ring-2 focus:ring-[#A46833]"
          />
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Total billed", value: billsLoading ? "…" : `₹${bills.reduce((s, b) => s + b.total, 0).toLocaleString("en-IN")}` },
            { label: "# Bills",      value: billsLoading ? "…" : bills.length },
            { label: "Avg bill",     value: billsLoading ? "…" : bills.length > 0 ? `₹${Math.round(bills.reduce((s, b) => s + b.total, 0) / bills.length).toLocaleString("en-IN")}` : "—" },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-2xl border border-[#CFAF8C] bg-[linear-gradient(145deg,#FFF8EE_0%,#F7E6D2_100%)] p-4 text-center shadow-[0_8px_20px_rgba(90,53,25,0.1)]">
              <div className="text-2xl font-bold text-[#2C1810]">{value}</div>
              <div className="mt-1 text-xs text-[#8E6D4E]">{label}</div>
            </div>
          ))}
        </div>

        {/* Weekly Customers */}
        <PremiumPanel title="Weekly Customers" subtitle={`Unique customers per day — last ${rangeDays} days`} badge="+INSIGHTS">
          <div className="h-72">
            {weeklyLineData.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={weeklyLineData} margin={{ top: 8, right: 8, bottom: 4, left: 0 }}>
                  <CartesianGrid stroke="rgba(231,207,168,0.08)" vertical={false} />
                  <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: "#CDAE8A", fontSize: 12 }} />
                  <YAxis hide />
                  <Tooltip content={<CustomTooltip />} />
                  <Line
                    type="monotone"
                    dataKey="customers"
                    stroke="#F0A33D"
                    strokeWidth={3}
                    dot={{ r: 3, fill: "#F0A33D", stroke: "#1E120C", strokeWidth: 2 }}
                    activeDot={{ r: 5, fill: "#F2BC68", stroke: "#1E120C", strokeWidth: 2 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-[#AF8B63]">
                No customer data yet for this range.
              </div>
            )}
          </div>
        </PremiumPanel>

        {/* Bills table */}
        {!billsLoading && bills.length > 0 && (
          <div className="overflow-hidden rounded-2xl border border-[#CFAF8C] bg-[linear-gradient(145deg,#FFF8EE_0%,#F7E6D2_100%)] shadow-[0_14px_32px_rgba(90,53,25,0.14)]">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#E8D5BC]">
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[#8E6D4E]">Time (IST)</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-[#8E6D4E]">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EDE0CC]">
                {bills.map((b, i) => (
                  <tr key={i} className="transition-colors hover:bg-[#F5EBD8]">
                    <td className="px-5 py-3 text-[#6B5744]">{billTimeIST(b.generated_at)}</td>
                    <td className="px-5 py-3 text-right font-semibold text-[#2C1810]">₹{b.total.toLocaleString("en-IN")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex justify-between border-t border-[#E8D5BC] px-5 py-3 text-sm">
              <span className="text-[#8E6D4E]">Total</span>
              <span className="font-bold text-[#2C1810]">₹{bills.reduce((s, b) => s + b.total, 0).toLocaleString("en-IN")}</span>
            </div>
          </div>
        )}

        {error ? (
          <div className="rounded-xl border border-[#A63B21] bg-[#2C1510] p-4 text-[#FFB3A0]">{error}</div>
        ) : null}

        {queryWarning ? (
          <div className="rounded-xl border border-[#9A672C] bg-[#2D1B10] p-4 text-[#EBC086]">{queryWarning}</div>
        ) : null}

        <PremiumPanel title="Top Dishes This Week" subtitle="Ranked by views" badge="TRENDING">
          {topDishesWeekData.length ? (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {topDishesWeekData.map((dish: any) => {
                  const views = Number(dish.views) || 0
                  const width = Math.max((views / maxWeekViews) * 100, 8)

                  return (
                    <div
                      key={dish.rank}
                      className="group rounded-xl border border-[#5F3D27] bg-[#1B120C]/90 p-4 transition-all duration-200 hover:border-[#8B5A34] hover:bg-[#22150D]"
                    >
                      <div className="mb-3 flex items-center gap-3">
                        <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-[#8A5B37] bg-[#3B2314] text-xs font-semibold text-[#F2C786]">
                          {dish.rank}
                        </span>
                        <div className="h-10 w-10 overflow-hidden rounded-full ring-1 ring-[#8A5B37]">
                          <Image
                            src={dish.image || FALLBACK_DISH_IMAGE}
                            alt={dish.name}
                            width={40}
                            height={40}
                            className="h-full w-full object-cover"
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-[#F1DDC0]">{dish.name}</p>
                          <p className="truncate text-xs text-[#B7946D]">{dish.category}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between mb-2 text-xs text-[#CEA87F]">
                        <span>{views} views</span>
                        {dish.trending === "up" ? (
                          <span className="flex items-center gap-1 text-[#73DC6D]"><TrendingUp className="h-3 w-3" /> Trending</span>
                        ) : (
                          <span className="flex items-center gap-1 text-[#E28963]"><TrendingDown className="h-3 w-3" /> Stable</span>
                        )}
                      </div>

                      <div className="h-2 overflow-hidden rounded-full bg-[#382518]">
                        <div
                          className="h-full rounded-full bg-[linear-gradient(90deg,#A45B22_0%,#F0A33D_100%)]"
                          style={{ width: `${Math.min(width, 100)}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="text-sm text-[#AF8B63]">No dish view data yet for this range.</div>
            )}
          </PremiumPanel>

        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold text-[#2C1810]">Google Business Intelligence</h2>
            <p className="text-sm text-[#8E7F71]">
              Real-time sentiment from {googleStats?.placeName || "your Google Maps profile"}.
            </p>
          </div>
          {googleMapsUrl ? (
            <a
              href={googleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-xl bg-[#F0A33D] px-4 py-2 text-sm font-bold text-[#2A180F] shadow-lg transition-transform hover:scale-105"
            >
              <MapPin className="h-4 w-4" />
              Manage on Google
            </a>
          ) : null}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-xl border border-[#6D4428] bg-[linear-gradient(145deg,#27170E,#150D08)] p-4 shadow-[0_12px_30px_rgba(22,13,8,0.45)]">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs uppercase tracking-[0.08em] text-[#B99267]">Overall Rating</span>
              <Star className="h-4 w-4 fill-[#F2B55A] text-[#F2B55A]" />
            </div>
            <p className="text-3xl font-bold text-[#F3E1C2]">
              {isGoogleLoading ? "..." : googleRatingValue > 0 ? googleRatingValue.toFixed(1) : "N/A"}
            </p>
            <div className="mt-2">
              <StarRating rating={googleRatingValue} size={16} />
            </div>
          </div>

          <div className="rounded-xl border border-[#6D4428] bg-[linear-gradient(145deg,#27170E,#150D08)] p-4 shadow-[0_12px_30px_rgba(22,13,8,0.45)]">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs uppercase tracking-[0.08em] text-[#B99267]">Data Source</span>
              <TrendingUp className="h-4 w-4 text-[#86E07F]" />
            </div>
            <p className="text-lg font-bold text-[#B8F6B0]">{googleStats?.source || "Google Places API"}</p>
            <p className="mt-1 text-xs text-[#A88560]">Last sync: {isGoogleLoading ? "..." : googleLastUpdated}</p>
          </div>

          <div className="rounded-xl border border-[#6D4428] bg-[linear-gradient(145deg,#27170E,#150D08)] p-4 shadow-[0_12px_30px_rgba(22,13,8,0.45)]">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs uppercase tracking-[0.08em] text-[#B99267]">Total Reviews</span>
              <MessageSquare className="h-4 w-4 text-[#F2B55A]" />
            </div>
            <p className="text-3xl font-bold text-[#F2B55A]">
              {isGoogleLoading ? "..." : googleReviewsCount.toLocaleString()}
            </p>
            <p className="mt-1 text-xs text-[#A88560]">Verified Google Reviews</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <PremiumPanel title="Rating Distribution" subtitle="Based on latest fetched Google reviews" badge="VERIFIED">
            <div className="space-y-3">
              {googleDistributionData.map((item: GoogleDistributionItem) => (
                <div key={item.stars} className="flex items-center gap-3">
                  <span className="w-10 text-sm font-medium text-[#EED3AD]">{item.stars} star</span>
                  <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-[#3A2618]">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${item.percentage}%`,
                        background: `linear-gradient(90deg, ${getBarColor(item.stars)} 0%, #F4C071 100%)`,
                      }}
                    />
                  </div>
                  <span className="w-12 text-right text-sm text-[#EED3AD]">{item.count}</span>
                  <span className="w-12 text-right text-xs text-[#B89469]">({item.percentage}%)</span>
                </div>
              ))}
            </div>
          </PremiumPanel>

          <PremiumPanel title="Real-time Reviews" subtitle="Latest feedback from Google Maps" badge="LIVE">
            <div className="flex h-full flex-col">
              <div className="mb-4 flex-1 rounded-xl border border-[#5E3D27] bg-[#1B120C]/90 p-6">
                {googleStats?.error ? (
                  <p className="mb-4 text-sm text-[#E8A57C]">{googleStats.error}</p>
                ) : null}

                {isGoogleLoading ? (
                  <div className="text-sm text-[#CEA87F]">Loading Google reviews...</div>
                ) : googleRecentReviews.length ? (
                  <div className="flex flex-col gap-3">
                    {googleRecentReviews.map((review: GoogleRecentReview) => (
                      <div key={review.id} className="rounded-lg bg-[#2A1B11] p-3">
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <div className="flex items-center gap-3">
                            <div className="h-8 w-8 overflow-hidden rounded-full bg-[#4285F4] text-white">
                              {review.profilePhotoUrl ? (
                                <img
                                  src={review.profilePhotoUrl}
                                  alt={review.reviewer}
                                  className="h-8 w-8 object-cover"
                                />
                              ) : (
                                <div className="flex h-8 w-8 items-center justify-center text-xs font-bold">
                                  {getInitials(review.reviewer)}
                                </div>
                              )}
                            </div>
                            <div className="text-left">
                              <p className="text-xs font-bold text-[#F1DDC0]">{review.reviewer}</p>
                              <ReviewStars rating={review.stars} />
                            </div>
                          </div>
                          <span className="text-[10px] text-[#8E6D4E]">{review.relativeTime || "Recently"}</span>
                        </div>
                        {review.text ? <p className="text-xs text-[#CDAE8A]">{review.text}</p> : null}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-[#CEA87F]">No public Google reviews available right now.</div>
                )}

                {googleMapsUrl ? (
                  <a
                    href={googleMapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-6 inline-flex items-center gap-2 text-xs font-semibold text-[#F2C786] hover:underline"
                  >
                    View all reviews on Google <ExternalLink className="h-3 w-3" />
                  </a>
                ) : null}
              </div>
            </div>
          </PremiumPanel>
      </div>
    </AdminLayout>
  )
}
