"use client"

import { useEffect, useState, type ReactNode } from "react"
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
  ShieldCheck,
  ShieldOff,
} from "lucide-react"
import Image from "next/image"

const EMPTY_RATING_DISTRIBUTION = [
  { stars: 5, count: 0, percentage: 0 },
  { stars: 4, count: 0, percentage: 0 },
  { stars: 3, count: 0, percentage: 0 },
  { stars: 2, count: 0, percentage: 0 },
  { stars: 1, count: 0, percentage: 0 },
]

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

export default function AnalyticsPage() {
  const [activeFilter, setActiveFilter] = useState<number | null>(null)
  const [analytics, setAnalytics] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [rangeDays, setRangeDays] = useState<7 | 30 | 90>(7)

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

  const menuViewsToday = analytics?.menuViewsToday ?? 0
  const avgRatingValue = analytics?.avgRating ?? 0
  const totalReviewsValue = analytics?.totalReviews ?? 0
  const publicReviewsValue = analytics?.publicReviews ?? 0
  const privateReviewsValue = totalReviewsValue - publicReviewsValue

  const topCartBarData = analytics?.topCartDishes || []
  const topFavouritesBarData = analytics?.topFavourites || []
  const weeklyLineData = analytics?.weeklyScans || []
  const scansVsFavouritesBarData = analytics?.scansVsFavourites || []
  const topDishesWeekData = analytics?.topDishesThisWeek || []
  const ratingDistributionData = analytics?.ratingDistribution || EMPTY_RATING_DISTRIBUTION
  const reviewListData = analytics?.recentReviews || []
  const topRatedDishesData = analytics?.topRatedDishes || []
  const queryWarning = analytics?.queryWarning || null

  const filteredReviews =
    activeFilter === null ? reviewListData : reviewListData.filter((r: any) => r.stars === activeFilter)

  const maxWeekViews = Math.max(...topDishesWeekData.map((dish: any) => Number(dish.views) || 0), 1)
  const maxMentions = Math.max(...topRatedDishesData.map((dish: any) => Number(dish.mentions) || 0), 1)

  return (
    <AdminLayout>
      <div className="relative">
        <div className="pointer-events-none absolute -top-16 left-[20%] h-44 w-44 rounded-full bg-[#E8650A]/20 blur-3xl" />
        <div className="pointer-events-none absolute top-[30%] right-[12%] h-56 w-56 rounded-full bg-[#A05822]/20 blur-3xl" />

        <div className="relative mb-6 overflow-hidden rounded-3xl border border-[#6D4428] bg-[linear-gradient(140deg,#2A180F_0%,#1A100A_60%,#140C08_100%)] p-6 shadow-[0_20px_54px_rgba(17,9,5,0.55)] sm:p-8">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,191,118,0.18),transparent_45%),radial-gradient(circle_at_bottom_right,rgba(232,101,10,0.2),transparent_40%)]" />

          <div className="relative flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="mb-2 inline-flex items-center gap-2 rounded-full border border-[#7E4F2D] bg-[#3B2314]/80 px-3 py-1 text-xs font-medium uppercase tracking-[0.1em] text-[#F2C786]">
                <ScanLine className="h-3.5 w-3.5" />
                Live insights
              </p>
              <h1 className="text-3xl font-bold text-[#F7E4C4] sm:text-4xl">Analytics Dashboard</h1>
              <p className="mt-2 text-sm text-[#C9A983] sm:text-base">
                Premium view of scans, engagement, and guest sentiment. Menu views today:{" "}
                <span className="font-semibold text-[#F2C786]">
                  {isLoading ? "..." : menuViewsToday.toLocaleString()}
                </span>
              </p>
            </div>

            <div className="flex items-center gap-2 rounded-xl border border-[#704828] bg-[#1D120B]/90 p-1.5">
              {DATE_RANGES.map((days) => (
                <button
                  key={days}
                  onClick={() => setRangeDays(days)}
                  className={`rounded-md px-3 py-1.5 text-sm font-semibold tracking-wide transition-all duration-200 ${
                    rangeDays === days
                      ? "bg-[#F0A33D] text-[#24150D] shadow-[0_0_20px_rgba(240,163,61,0.35)]"
                      : "text-[#C39B70] hover:bg-[#3A2518] hover:text-[#F2C786]"
                  }`}
                  type="button"
                >
                  {days}D
                </button>
              ))}
            </div>
          </div>

          <div className="relative mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-[#6A4329] bg-[#1A100A]/85 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.08em] text-[#B99267]">Avg rating</p>
              <p className="mt-1 text-2xl font-bold text-[#F3B85E]">{isLoading ? "..." : avgRatingValue}</p>
            </div>
            <div className="rounded-xl border border-[#6A4329] bg-[#1A100A]/85 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.08em] text-[#B99267]">Total reviews</p>
              <p className="mt-1 text-2xl font-bold text-[#F1DDC0]">{isLoading ? "..." : totalReviewsValue}</p>
            </div>
            <div className="rounded-xl border border-[#6A4329] bg-[#1A100A]/85 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.08em] text-[#B99267]">Public</p>
              <p className="mt-1 text-2xl font-bold text-[#B9F4B1]">{isLoading ? "..." : publicReviewsValue}</p>
            </div>
            <div className="rounded-xl border border-[#6A4329] bg-[#1A100A]/85 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.08em] text-[#B99267]">Private</p>
              <p className="mt-1 text-2xl font-bold text-[#FFBFAE]">{isLoading ? "..." : privateReviewsValue}</p>
            </div>
          </div>
        </div>

        {error ? (
          <div className="mb-6 rounded-xl border border-[#A63B21] bg-[#2C1510] p-4 text-[#FFB3A0]">{error}</div>
        ) : null}

        {queryWarning ? (
          <div className="mb-6 rounded-xl border border-[#9A672C] bg-[#2D1B10] p-4 text-[#EBC086]">{queryWarning}</div>
        ) : null}

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <PremiumPanel title="Weekly QR Scans" subtitle="Fri to Thu trendline" badge="+INSIGHTS">
            <div className="h-72">
              {weeklyLineData.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={weeklyLineData} margin={{ top: 8, right: 8, bottom: 4, left: 0 }}>
                    <CartesianGrid stroke="rgba(231,207,168,0.08)" vertical={false} />
                    <XAxis
                      dataKey="day"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "#CDAE8A", fontSize: 12 }}
                    />
                    <YAxis hide />
                    <Tooltip content={<CustomTooltip />} />
                    <Line
                      type="monotone"
                      dataKey="scans"
                      stroke="#F0A33D"
                      strokeWidth={3}
                      dot={{ r: 3, fill: "#F0A33D", stroke: "#1E120C", strokeWidth: 2 }}
                      activeDot={{ r: 5, fill: "#F2BC68", stroke: "#1E120C", strokeWidth: 2 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-[#AF8B63]">
                  No scan data yet for this range.
                </div>
              )}
            </div>
          </PremiumPanel>

          <PremiumPanel title="Scans vs Favourites" subtitle="Daily comparison" badge="ENGAGEMENT">
            <div className="h-72">
              {scansVsFavouritesBarData.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={scansVsFavouritesBarData} barGap={6} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
                    <CartesianGrid stroke="rgba(231,207,168,0.08)" vertical={false} />
                    <XAxis
                      dataKey="day"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "#CDAE8A", fontSize: 12 }}
                    />
                    <YAxis hide />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend
                      wrapperStyle={{ paddingTop: 16 }}
                      formatter={(value) => <span className="text-xs text-[#C6A378]">{value}</span>}
                    />
                    <Bar dataKey="scans" fill="#F0A33D" radius={[6, 6, 0, 0]} name="QR scans" />
                    <Bar dataKey="favourites" fill="#A76122" radius={[6, 6, 0, 0]} name="Favourites" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-[#AF8B63]">
                  No scan/favourite events yet for this range.
                </div>
              )}
            </div>
          </PremiumPanel>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
          <PremiumPanel title="Most Added to Cart" subtitle="Top dishes by cart additions" badge="THIS WEEK">
            <div className="h-72">
              {topCartBarData.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topCartBarData} layout="vertical" margin={{ top: 4, right: 12, bottom: 4, left: 12 }}>
                    <CartesianGrid stroke="rgba(231,207,168,0.08)" horizontal={false} />
                    <XAxis
                      type="number"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "#CDAE8A", fontSize: 12 }}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "#EFD6B2", fontSize: 12 }}
                      width={118}
                      tickFormatter={(value: string) =>
                        value.length > 14 ? `${value.slice(0, 14)}...` : value
                      }
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="count" fill="#F0A33D" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-[#AF8B63]">
                  No cart events tracked yet.
                </div>
              )}
            </div>
          </PremiumPanel>

          <PremiumPanel title="Most Favourited" subtitle="Top dishes by favourites" badge="THIS WEEK">
            <div className="h-72">
              {topFavouritesBarData.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topFavouritesBarData} layout="vertical" margin={{ top: 4, right: 12, bottom: 4, left: 12 }}>
                    <CartesianGrid stroke="rgba(231,207,168,0.08)" horizontal={false} />
                    <XAxis
                      type="number"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "#CDAE8A", fontSize: 12 }}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "#EFD6B2", fontSize: 12 }}
                      width={118}
                      tickFormatter={(value: string) =>
                        value.length > 14 ? `${value.slice(0, 14)}...` : value
                      }
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="count" fill="#A76122" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-[#AF8B63]">
                  No favourites tracked yet.
                </div>
              )}
            </div>
          </PremiumPanel>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
          <PremiumPanel title="Top Dishes This Week" subtitle="Ranked by views" badge="TRENDING">
            {topDishesWeekData.length ? (
              <div className="space-y-3">
                {topDishesWeekData.map((dish: any) => {
                  const views = Number(dish.views) || 0
                  const width = Math.max((views / maxWeekViews) * 100, 8)

                  return (
                    <div
                      key={dish.rank}
                      className="group rounded-xl border border-[#5F3D27] bg-[#1B120C]/90 p-3.5 transition-all duration-200 hover:border-[#8B5A34] hover:bg-[#22150D]"
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
                        <div className="flex items-center gap-2 text-xs text-[#CEA87F]">
                          <span>{views} views</span>
                          {dish.trending === "up" ? (
                            <TrendingUp className="h-4 w-4 text-[#73DC6D]" />
                          ) : (
                            <TrendingDown className="h-4 w-4 text-[#E28963]" />
                          )}
                        </div>
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

          <PremiumPanel title="Top Rated Dishes" subtitle="Most loved by guests" badge="REVIEWS">
            {topRatedDishesData.length ? (
              <div className="space-y-3">
                {topRatedDishesData.map((dish: any) => {
                  const mentions = Number(dish.mentions) || 0
                  const width = Math.max((mentions / maxMentions) * 100, 8)
                  const rating = Number(dish.rating) || 0

                  return (
                    <div
                      key={dish.rank}
                      className="group rounded-xl border border-[#5F3D27] bg-[#1B120C]/90 p-3.5 transition-all duration-200 hover:border-[#8B5A34] hover:bg-[#22150D]"
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
                        <div className="text-right">
                          <StarRating rating={rating} size={12} />
                          <p className="mt-1 text-xs text-[#CEA87F]">{mentions} mentions</p>
                        </div>
                      </div>

                      <div className="h-2 overflow-hidden rounded-full bg-[#382518]">
                        <div
                          className="h-full rounded-full bg-[linear-gradient(90deg,#8C4D21_0%,#D98A31_55%,#F0BD6E_100%)]"
                          style={{ width: `${Math.min(width, 100)}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="text-sm text-[#AF8B63]">No dish mentions available in reviews yet.</div>
            )}
          </PremiumPanel>
        </div>

        <div className="mt-8 mb-4 flex items-end justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold text-[#2C1810]">Review Intelligence</h2>
            <p className="text-sm text-[#8E7F71]">Detailed insight from guest sentiment and rating patterns.</p>
          </div>
        </div>

        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-[#6D4428] bg-[linear-gradient(145deg,#27170E,#150D08)] p-4 shadow-[0_12px_30px_rgba(22,13,8,0.45)]">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs uppercase tracking-[0.08em] text-[#B99267]">Total Reviews</span>
              <MessageSquare className="h-4 w-4 text-[#F2B55A]" />
            </div>
            <p className="text-3xl font-bold text-[#F3E1C2]">{isLoading ? "..." : totalReviewsValue}</p>
            <p className="mt-1 text-xs text-[#A88560]">All time</p>
          </div>

          <div className="rounded-xl border border-[#6D4428] bg-[linear-gradient(145deg,#27170E,#150D08)] p-4 shadow-[0_12px_30px_rgba(22,13,8,0.45)]">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs uppercase tracking-[0.08em] text-[#B99267]">Average Rating</span>
              <Star className="h-4 w-4 fill-[#F3A33B] text-[#F3A33B]" />
            </div>
            <p className="text-3xl font-bold text-[#F2B55A]">{isLoading ? "..." : avgRatingValue}</p>
            <div className="mt-1">
              <StarRating rating={avgRatingValue} size={13} />
            </div>
          </div>

          <div className="rounded-xl border border-[#6D4428] bg-[linear-gradient(145deg,#27170E,#150D08)] p-4 shadow-[0_12px_30px_rgba(22,13,8,0.45)]">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs uppercase tracking-[0.08em] text-[#B99267]">Public Reviews</span>
              <ShieldCheck className="h-4 w-4 text-[#86E07F]" />
            </div>
            <p className="text-3xl font-bold text-[#B8F6B0]">{isLoading ? "..." : publicReviewsValue}</p>
            <p className="mt-1 text-xs text-[#A88560]">Visible to guests</p>
          </div>

          <div className="rounded-xl border border-[#6D4428] bg-[linear-gradient(145deg,#27170E,#150D08)] p-4 shadow-[0_12px_30px_rgba(22,13,8,0.45)]">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs uppercase tracking-[0.08em] text-[#B99267]">Private Reviews</span>
              <ShieldOff className="h-4 w-4 text-[#FF9D7F]" />
            </div>
            <p className="text-3xl font-bold text-[#FFBFAE]">{isLoading ? "..." : privateReviewsValue}</p>
            <p className="mt-1 text-xs text-[#A88560]">Hidden from guests</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <PremiumPanel title="Rating Distribution" subtitle="How guests score your menu" badge="QUALITY">
            <div className="space-y-3">
              {ratingDistributionData.map((item: any) => (
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
                  <span className="w-8 text-right text-sm text-[#EED3AD]">{item.count}</span>
                  <span className="w-12 text-right text-xs text-[#B89469]">({item.percentage}%)</span>
                </div>
              ))}
            </div>
          </PremiumPanel>

          <PremiumPanel title="Recent Guest Reviews" subtitle="Latest feedback and visibility status" badge="VOICE">
            <div className="mb-4 flex flex-wrap gap-2">
              <button
                onClick={() => setActiveFilter(null)}
                className={`rounded-full border px-3 py-1 text-xs font-semibold transition-all duration-200 ${
                  activeFilter === null
                    ? "border-[#F0A33D] bg-[#F0A33D] text-[#2B180E] shadow-[0_0_18px_rgba(240,163,61,0.35)]"
                    : "border-[#6A442A] bg-[#2A1B11] text-[#C7A67E] hover:border-[#875632] hover:text-[#F2C786]"
                }`}
                type="button"
              >
                All
              </button>
              {[5, 4, 3, 2, 1].map((star) => (
                <button
                  key={star}
                  onClick={() => setActiveFilter(star)}
                  className={`rounded-full border px-3 py-1 text-xs font-semibold transition-all duration-200 ${
                    activeFilter === star
                      ? "border-[#F0A33D] bg-[#F0A33D] text-[#2B180E] shadow-[0_0_18px_rgba(240,163,61,0.35)]"
                      : "border-[#6A442A] bg-[#2A1B11] text-[#C7A67E] hover:border-[#875632] hover:text-[#F2C786]"
                  }`}
                  type="button"
                >
                  {star} star
                </button>
              ))}
            </div>

            {filteredReviews.length ? (
              <div className="space-y-2">
                {filteredReviews.map((review: any) => (
                  <div
                    key={review.id}
                    className="rounded-xl border border-[#5E3D27] bg-[#1B120C]/90 p-3 transition-all duration-200 hover:border-[#865730]"
                  >
                    <div className="mb-1.5 flex items-center justify-between">
                      <ReviewStars rating={review.stars} />
                      <span className="text-xs text-[#AD8861]">{review.date}</span>
                    </div>
                    <p className="mb-2 line-clamp-2 text-sm italic text-[#ECD7B8]">"{review.text}"</p>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-[#F2C786]">{review.reviewer}</span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                          review.isPublic
                            ? "border border-[#3E6B3D] bg-[#193019] text-[#94E18E]"
                            : "border border-[#7E4334] bg-[#351A16] text-[#FFBAA4]"
                        }`}
                      >
                        {review.isPublic ? "Public" : "Private"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-4 text-sm text-[#AF8B63]">No reviews found for this filter.</div>
            )}
          </PremiumPanel>
        </div>
      </div>
    </AdminLayout>
  )
}
